"""Experiment 3: unchanged Experiment 1C on verified simplishsong1.aif; decoding/report metadata only."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import time

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / 'audio' / 'simplishsong1.aif'
EXPECTED = '0637f1f93a257035a7af6948e35cd079c60d377da44041ce838467177d154211'
ALGORITHM = ROOT / 'experiment_01c.py'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


if __name__ == '__main__':
    if sha(SOURCE) != EXPECTED:
        raise ValueError('Input SHA-256 does not match the approved simplishsong1.aif')
    algorithm_hash = sha(ALGORITHM)
    if algorithm_hash != 'eb8fd4895b4a62fe7d57c97c6004685d184a00258ca8fe29b68115c89994a6d7':
        raise ValueError('Experiment 1C differs from the previous run')
    previous = {str(p.relative_to(ROOT)): sha(p) for p in ROOT.rglob('*')
                if p.is_file() and HERE not in p.parents}
    with (HERE / 'preservation-before.json').open('x') as output:
        json.dump(previous, output, indent=2)
        output.write('\n')
    decoder = load('retained_decoder', ROOT / 'results/recording-01c/run_adapter.py')
    experiment = load('unchanged_1c', ALGORITHM)
    experiment.read_audio = decoder.decode_aifc
    save_json = experiment.save_json

    def save_with_input_identity(path, value):
        if Path(path).name == 'report.json':
            value['run_label'] = 'Experiment 3'
            value['processing_seconds_before_report_export'] = time.monotonic()-started
            value['computational_limitations'] = json.loads((HERE/'preflight.json').read_text())
            value['input_filename'] = SOURCE.name
            value['input_path'] = str(SOURCE.resolve())
            value['algorithm_sha256'] = algorithm_hash
            value['reference_files_used'] = []
            value['normalization_applied'] = False
            value['fitted_per_event_gains'] = [
                {'component': 'component_%02d.wav' % (i+1),
                 'template_event_zero_based': item['template_event'],
                 'allocations': item['allocations']}
                for i,item in enumerate(value['passes']) if 'allocations' in item]
        save_json(path, value)

    experiment.save_json = save_with_input_identity
    started = time.monotonic()
    experiment.run(argparse.Namespace(input=str(SOURCE), output=str(HERE/'separation'),
                                      threshold=.015, max_lag_ms=5))
    assert sha(SOURCE) == EXPECTED
    assert sha(ALGORITHM) == algorithm_hash
    assert all(sha(ROOT/path) == digest for path,digest in previous.items())
    save_json(HERE/'provenance.json', {
        'input_filename': SOURCE.name, 'input_path': str(SOURCE.resolve()),
        'input_sha256': EXPECTED, 'input_hash_verified_before_run': True,
        'algorithm_sha256': algorithm_hash, 'algorithm_unchanged': True,
        'settings': {'threshold': .015, 'max_lag_ms': 5, 'max_components': 4},
        'adapter': 'Retained AIFC fl32 decoder; no scaling, clipping or resampling',
        'reference_files_used': [], 'normalization_applied': False,
        'previous_files_verified_unchanged': len(previous),
        'component_count': json.loads((HERE/'separation/report.json').read_text())['component_count'],
        'elapsed_seconds': time.monotonic()-started})

"""Run Experiment 1B on AIFC fl32 samples, without PCM quantization.
Only the file-decoding boundary is adapted; all discovery/defaults/exports are original.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import time

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'audio' / 'DPTE Kick 111 Clap 808.aif'
ALGORITHM = ROOT / 'experiment_01b.py'
OUTPUT = Path(__file__).resolve().parent / 'separation'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode_aifc(path):
    raw = Path(path).read_bytes()
    if raw[:4] != b'FORM' or raw[8:12] != b'AIFC':
        raise ValueError('Expected AIFC')
    position, comm, sound = 12, None, None
    while position + 8 <= len(raw):
        tag, size = struct.unpack_from('>4sI', raw, position)
        chunk = raw[position + 8:position + 8 + size]
        if len(chunk) != size:
            raise ValueError('Truncated chunk')
        if tag == b'COMM':
            comm = chunk
        if tag == b'SSND':
            sound = chunk
        position += 8 + size + size % 2
    channels, frames, bits = struct.unpack_from('>hIh', comm)
    exponent, mantissa = struct.unpack_from('>HQ', comm, 8)
    rate = math.ldexp(mantissa, (exponent & 0x7fff) - 16383 - 63)
    if exponent & 0x8000 or rate != int(rate) or rate <= 0:
        raise ValueError('Invalid rate')
    if comm[18:22] != b'fl32' or bits != 32 or channels not in (1, 2):
        raise ValueError('Expected mono/stereo big-endian float32')
    offset, block = struct.unpack_from('>II', sound)
    payload = sound[8 + offset:]
    if block != 0 or len(payload) != frames * channels * 4 or frames * channels > 4_000_000:
        raise ValueError('Unexpected sound data layout/size')
    values = list(struct.unpack('>' + 'f' * (frames * channels), payload))
    if not all(map(math.isfinite, values)):
        raise ValueError('Nonfinite input')
    return int(rate), channels, values


if __name__ == '__main__':
    original_hash, algorithm_hash = sha(SOURCE), sha(ALGORITHM)
    spec = importlib.util.spec_from_file_location('experiment', ALGORITHM)
    experiment = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(experiment)
    # Adapt I/O only, retaining direct float32 values exactly in Python float64.
    experiment.read_audio = decode_aifc
    started = time.monotonic()
    experiment.run(argparse.Namespace(input=str(SOURCE), output=str(OUTPUT),
                                      threshold=.015, max_lag_ms=5))
    assert sha(SOURCE) == original_hash
    assert sha(ALGORITHM) == algorithm_hash
    experiment.save_json(OUTPUT.parent / 'provenance.json', {
        'input': str(SOURCE), 'input_sha256': original_hash,
        'algorithm_sha256': algorithm_hash, 'algorithm_unchanged': True,
        'adapter': 'AIFC fl32 big-endian decode only; no scaling, clipping or resampling',
        'reference_files_used': [], 'elapsed_seconds': time.monotonic() - started})

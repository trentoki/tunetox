"""Unchanged 1C variable-volume benchmark; no reference stems or discovery changes."""
import argparse,hashlib,importlib.util,json,resource,sys,time
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run():
 begin=time.perf_counter();algorithm=ROOT/'experiment_01c.py';assert sha(algorithm)=='eb8fd4895b4a62fe7d57c97c6004685d184a00258ca8fe29b68115c89994a6d7'
 src=ROOT/'audio/varvol2.aif';assert sha(src)=='5eab41d64b97a895b0c5ef6ffe81cf146e2d91e595bfb1245f1079e29a4298d4'
 a=load('benchmark_unchanged_1c',algorithm);decoder=load('benchmark_decoder',ROOT/'results/recording-01c/run_adapter.py');a.read_audio=decoder.decode_aifc
 out=HERE/'regression-1c';a.run(argparse.Namespace(input=str(src),output=str(out),threshold=.015,max_lag_ms=5))
 previous=ROOT/'results/varvol2-01c/separation';comparison={p.name:{'new_sha256':sha(p),'old_sha256':sha(previous/p.name),'identical':sha(p)==sha(previous/p.name)} for p in out.glob('*.wav')};old=json.loads((previous/'report.json').read_text());new=json.loads((out/'report.json').read_text());assert all(v['identical'] for v in comparison.values());assert old['passes']==new['passes']
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 report={'benchmark':'corrected varvol2 1C','algorithm_sha256':sha(algorithm),'settings':new['parameters'],'input_sha256':sha(src),'wav_comparison':comparison,'fitted_allocations_identical':True,'component_count':new['component_count'],'residual_energy_fraction':new['residual_energy_fraction'],'elapsed_seconds':time.perf_counter()-begin,'peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024,'quality_regression':'No output change versus saved 1C; source purity was not newly validated.'}
 with (HERE/'regression-report.json').open('x') as f:json.dump(report,f,indent=2)
 print(json.dumps(report,indent=2))
if __name__=='__main__':run()

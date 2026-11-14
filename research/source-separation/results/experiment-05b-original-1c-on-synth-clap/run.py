"""Original 1C on the new mixture; only its decoder boundary is adapted."""
import argparse,hashlib,importlib.util,json,resource,sys,time
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def run():
 begin=time.perf_counter();algorithm=ROOT/'experiment_01c.py';source=ROOT/'audio/MajorsawwackClap.aif'
 assert sha(algorithm)=='eb8fd4895b4a62fe7d57c97c6004685d184a00258ca8fe29b68115c89994a6d7'
 assert sha(source)=='5eb47bcae4b439165ee318ac9eca95c05f508ae08e7e229860ca0746429f7b23'
 prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
 a=load('original_1c_5b',algorithm);decoder=load('retained_decoder_5b',ROOT/'results/recording-01c/run_adapter.py')
 a.read_audio=decoder.decode_aifc
 # This is the sole compatibility change. Recognition, grouping, lag/gain fitting,
 # residual passes, settings and native exports execute through original a.run.
 started=time.perf_counter();out=HERE/'separation';a.run(argparse.Namespace(input=str(source),output=str(out),threshold=.015,max_lag_ms=5));separation_seconds=time.perf_counter()-started
 report=json.loads((out/'report.json').read_text());rate,ch,original=decoder.decode_aifc(source);tracks=[a.read_float_wav(out/row['file'])[2] for row in report['outputs']];_,_,residual=a.read_float_wav(out/'residual.wav')
 a.write_float_wav(HERE/'original_reference.wav',rate,ch,original)
 stems=[sum(t[i] for t in tracks) for i in range(len(original))]
 a.write_float_wav(HERE/'recombined.wav',rate,ch,[v+r for v,r in zip(stems,residual)])
 a.write_float_wav(HERE/'components_only.wav',rate,ch,stems)
 _,_,recombined=a.read_float_wav(HERE/'recombined.wav');conservation=max(abs(x-y-r) for x,y,r in zip(original,stems,residual));assert conservation<2e-7
 assert all(sha(Path(p))==h for p,h in prior.items())
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 provenance={'experiment':'5B','input_path':str(source.resolve()),'input_sha256':sha(source),'algorithm_path':str(algorithm.resolve()),'algorithm_sha256':sha(algorithm),'algorithm_unchanged':True,'only_compatibility_change':'read_audio replaced by retained AIFC fl32 big-endian decoder; exact float32 samples, no scaling/resampling/quantization','settings':report['parameters'],'references_used':[],'methods_4n_4q_5a_used_for_separation':False,'component_count':len(tracks),'detected_events':len(report['events']),'residual_energy_ratio_float64':report['residual_energy_fraction'],'residual_energy_ratio_exported':a.energy(residual)/a.energy(original),'recombined_definition':'sum of separated components plus explicit residual; components_only.wav excludes residual','conservation_max_error':conservation,'recombined_reference_max_error':max(abs(x-y) for x,y in zip(original,recombined)),'timings':{'unchanged_1c_run_seconds':separation_seconds,'total_before_json_seconds':time.perf_counter()-begin},'peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024,'source_sha256':sha(Path(__file__)),'outputs':{str(p.relative_to(HERE)):sha(p) for p in HERE.rglob('*.wav')},'prior_files_verified':len(prior),'normalization_or_clipping':False,'listening_performed':False}
 for name,value in [('provenance.json',provenance),('preservation.json',prior)]:
  with (HERE/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False)
 print(json.dumps(provenance,indent=2))
if __name__=='__main__':run()

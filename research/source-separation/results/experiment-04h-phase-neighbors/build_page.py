"""Small local listening page from measured 4H results; no new audio processing."""
import json
import statistics
from pathlib import Path
HERE=Path(__file__).resolve().parent

def run():
    r=json.loads((HERE/'report.json').read_text());m=r['metrics'];b=r['baseline_metrics'];t=r['timings'];steps=r['artifact_sample_steps'];rows=r['new_cycle_metrics']
    table=f'''<div class="scroll"><table><thead><tr><th>Measurement</th><th>Frozen 4F-B</th><th>4H</th></tr></thead><tbody>
<tr><td>Additional cycles versus 4F-B</td><td>—</td><td>{m['additional_cycles']}</td></tr>
<tr><td>Total rendered cycles</td><td>1,938</td><td>{m['total_rendered_cycles']:,}</td></tr>
<tr><td>Remaining ambiguous cycles</td><td>194</td><td>{m['remaining_ambiguous_cycles']}</td></tr>
<tr><td>Recording-time coverage</td><td>{100*b['coverage_fraction']:.2f}%</td><td>{100*m['coverage_fraction']:.2f}%</td></tr>
<tr><td>Residual / original energy</td><td>{100*b['residual_energy_ratio']:.2f}%</td><td>{100*m['residual_energy_ratio']:.2f}%</td></tr>
<tr><td>Error / input energy within modeled frames</td><td>{100*b['modeled_error_to_modeled_input_ratio']:.3f}%</td><td>{100*m['modeled_error_to_modeled_input_ratio']:.3f}%</td></tr>
<tr><td>Reconstruction RMSE</td><td>{b['reconstruction_rmse']:.6f}</td><td>{m['reconstruction_rmse']:.6f}</td></tr>
<tr><td>Accepted contiguous runs</td><td>273</td><td>{r['model']['accepted_runs']}</td></tr>
<tr><td>Total execution before JSON report</td><td>{r['baseline_timings']['total_before_report_seconds']:.3f} s (historical)</td><td>{t['total_run_before_json_seconds']:.3f} s</td></tr>
<tr><td>Whole-process peak RSS</td><td>{r['baseline_peak_process_rss_bytes']/2**20:.2f} MiB</td><td>{r['peak_process_rss_bytes']/2**20:.2f} MiB</td></tr>
</tbody></table></div>'''
    timing='<table><thead><tr><th>4H execution stage</th><th>Seconds</th></tr></thead><tbody>'+''.join(f'<tr><td>{name}</td><td>{t[key]:.4f}</td></tr>' for key,name in [
        ('setup_load_and_hash_seconds','Metadata loading, frozen-file checks, preservation snapshot'),
        ('recognition_analysis_seconds','Neighbor indexing and recognition analysis of 194 omitted candidates'),
        ('synthesis_seconds','Unchanged 64-position synthesis'),
        ('residual_and_three_wav_exports_seconds','Residual calculation and three WAV exports'),
        ('evaluation_and_preservation_seconds','Readback, artifact/error measurements, final preservation checks')])+'</tbody></table>'
    players=''
    for label,src in [('4H reconstructed','reconstructed.wav'),('4H residual','residual.wav'),('Original reference','original_reference.wav'),('Unchanged 4F-B reconstructed','../experiment-04f-independent/b-related-shapes/reconstructed.wav'),('Unchanged 4F-B residual','../experiment-04f-independent/b-related-shapes/residual.wav')]:
        players+=f'<section class="audio"><h3>{label}</h3><p><a href="{src}">Open WAV</a></p><audio controls preload="none" aria-label="{label}" src="{src}">Use the WAV link to listen.</audio></section>'
    body=f'''<h1>Experiment 4H — phase-tolerant neighbor recognition</h1>
<p class="lead"><strong>{m['additional_cycles']} additional cycles recovered.</strong> Continuity improved modestly, with {m['remaining_ambiguous_cycles']} ambiguous cycles still unresolved. No family merging or changes to discovery, target gates or synthesis.</p>
<h2>Listen</h2><p>Every new file is full-length six-second stereo 44.1 kHz, 32-bit floating-point WAV. No normalization, clipping, mastering or source-waveform fallback. Original reference is a byte-identical copy of the existing decoded conversion.</p>{players}
<h2>Direct comparison</h2>{table}<p>Coverage improved by {(m['coverage_fraction']-b['coverage_fraction'])*100:.2f} percentage points and residual/input energy fell by {(b['residual_energy_ratio']-m['residual_energy_ratio'])*100:.2f} percentage points. These are measurements on this recording, not source-identity or generalization claims.</p>
<h2>Precisely what changed</h2><p>Only the neighbor test for originally ambiguous cycles still omitted by 4F-B changes. The frozen 4F-B chooser supplies all target and competing-family requirements unchanged. Each side uses the nearest reliable temporal neighbor, with a maximum gap of <strong>0.1 target period</strong> and the existing <strong>2% duration-change limit</strong>. Neighbor cosine must still reach <strong>0.995</strong>, but five comparison offsets are permitted: −0.5, −0.25, 0, +0.25 and +0.5 of a 64-position slot (at most 1/128 cycle).</p>
<p>Comparison shifts are <strong>never applied to synthesis</strong>. Saved family exemplars, cycle duration, start time, amplitude scale, channel offsets and 4D/4F-B linear interpolation/Hermite joins remain unchanged. Skipped unreliable intervals are not filled. All 4F-B rendered cycles and render-family choices remain. Family identity stays unresolved for newly supported ambiguous occurrences.</p>
<p>Of the 75 additions, 64 use a nearby reliable neighbor beyond a tiny rejected crossing interval. The remaining 11 benefit from bounded-phase comparison without such a skipped interval. Different shapes, inverted polarity, unsupported relationships, genuine time gaps, duration transitions and weak target evidence remain rejected in the synthetic tests. The original 399 unreliable candidate intervals and four provisional occurrences remain outside this experiment.</p>
<h2>Quality and artifact checks</h2><ul>
<li>New-cycle error/input energy: <strong>{100*m['additional_cycles_error_ratio']:.3f}%</strong>; worst individual added cycle: {100*max(v['error_energy_ratio'] for v in rows):.3f}%. No large energetic-cycle error over 25% was found.</li>
<li>Added-cycle model/original RMS ratios range {min(v['render_to_original_rms_ratio'] for v in rows):.3f}–{max(v['render_to_original_rms_ratio'] for v in rows):.3f}; median {statistics.median(v['render_to_original_rms_ratio'] for v in rows):.3f}. No per-cycle peak or gain correction was applied after rendering.</li>
<li>Maximum adjacent-sample step at the same evaluated cycle boundaries is unchanged at {steps['4h']['maximum_cycle_boundary_sample_step']:.6f}. Median boundary step rises from {steps['4f_b_at_4h_boundaries']['median_cycle_boundary_sample_step']:.6f} to {steps['4h']['median_cycle_boundary_sample_step']:.6f}, with more modeled audio present.</li>
<li>Maximum whole-waveform step rises slightly from {steps['4f_b_at_4h_boundaries']['maximum_whole_waveform_sample_step']:.6f} to {steps['4h']['maximum_whole_waveform_sample_step']:.6f} (about 0.61%). A sample-step statistic cannot classify all audible clicks or modulation.</li>
<li>Exported reconstruction + residual maximum sample difference from original is <strong>{m['float32_sum_maximum_error']:.3g}</strong>. This is subtraction/export conservation, not reconstruction quality.</li>
</ul><p><strong>Listening is still required.</strong> No new listening or device playback test was performed. The 64-position upper-harmonic loss remains intentionally unchanged. Fractional descriptor comparison also slightly smooths its samples, so acceptance does not prove exact physical phase error or common sound origin. Eight synthetic and two saved-export tests passed; they do not prove zero false estimates on unfamiliar recordings.</p>
<h2>Execution timing and memory</h2>{timing}<p>Recognition analysis is <strong>{t['recognition_analysis_seconds']:.4f} seconds</strong>, reported separately from setup, rendering, export and QA. The total is {t['total_run_before_json_seconds']:.3f} seconds before JSON writing. Ten tests ran separately in 0.070 seconds; source inspection/development and this page generation are not included in algorithm timings.</p>
<p>Peak RSS is {r['peak_process_rss_bytes']/2**20:.2f} MiB for the entire process, including full audit metadata, baseline/original/new PCM and readback evaluation. The baseline’s {r['baseline_peak_process_rss_bytes']/2**20:.2f} MiB and time are historical single-run measurements with different export/evaluation work, not a controlled performance comparison. No full-song or target-device guarantee.</p>
<h2>Scope and records</h2><p>All earlier source, results and audio are preserved. No 4F-A 256-position/cubic/harmonic sampler was used, no A+B render exists, and no 4I was started. No MIDI, isolated stems, scale or instrument identity entered recognition.</p><p><a href="report.json">Metrics, timing and provenance</a> · <a href="new-decisions.json">All 194 decisions and neighbor evidence</a> · <a href="README.md">Method and reproducibility</a></p>'''
    page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Experiment 4H listening comparison</title><style>body{font:17px/1.5 system-ui,sans-serif;max-width:1000px;margin:30px auto;padding:0 18px;color:#1d2b39}h1{line-height:1.15}h2{margin-top:32px}.lead{font-size:1.2em}a{color:#125da8}table{border-collapse:collapse;width:100%;font-size:.94rem}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #c8d1db}th{background:#edf1f5}.scroll{overflow-x:auto}.audio{margin:20px 0;padding:8px 0;border-top:1px solid #c8d1db}audio{display:block;max-width:100%;width:420px}li{margin:9px 0}</style></head><body>'''+body+'</body></html>'
    with (HERE/'listen.html').open('x') as f:f.write(page)

if __name__=='__main__':run()

"""Compact static 4I report: four annotated measured waveform windows, no new audio."""
import html
import importlib.util
import json
import math
from pathlib import Path
import statistics
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]

def load(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def table(headers,rows):
    return '<div class="scroll"><table><thead><tr>'+''.join('<th>'+html.escape(v)+'</th>' for v in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(v)+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'

def run():
    r=json.loads((HERE/'report.json').read_text());rows=r['cycles'];by_id={v['cycle']:v for v in rows};rate=r['rate'];channels=r['channels'];H=ROOT/'results/experiment-04h-phase-neighbors'
    io=load('wav_reader',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py');charts=load('chart_helpers',ROOT/'diagnostic_04c/plots.py')
    waves={name:io.read_export(H/file)[2] for name,file in [('Original','original_reference.wav'),('4H reconstructed','reconstructed.wav'),('Residual','residual.wav')]}
    isolated=[v for v in rows if v.get('isolated_ordinary_gap')];target=[v for v in isolated if v['failure_category']=='target_shape_rejection']
    first=max(target,key=lambda v:v['original_energy']);second=max((v for v in isolated if v['failure_category']=='target_period_confidence_rejection'),key=lambda v:v['original_energy'])
    bad_gap=max((v for v in r['gaps'] if v['significant'] and v['dominant_category']=='detection_reliability_rejection'),key=lambda v:v['original_energy'])
    third=max((by_id[i] for i in bad_gap['cycle_ids'] if by_id[i]['failure_category']=='detection_reliability_rejection'),key=lambda v:v['original_energy'])
    spike=next(v for v in r['spikes'] if .05<v['peak_seconds']<.1);fourth=by_id[spike['cycle']]
    cases=[('I1','Ordinary isolated ramp rejected by target score',first),('I2','Detected cycle rejected by periodicity confidence',second),
           ('I3','Detected candidate rejected before reliable recognition',third),('I4','Sharp-edge residual spikes inside rendered periods',fourth)]
    code={'rendered_model_error':'R','target_shape_rejection':'T','target_period_confidence_rejection':'P','detection_reliability_rejection':'D',
          'neighbor_rejection':'N','provisional_family_rejection':'V','unsupported_family_relationship':'U'}
    figures=[];trace_rows=[]
    for label,title,row in cases:
        center=(row['start_seconds']+row['end_seconds'])/2;span=.014 if label!='I3' else .022
        a=max(0,math.floor((center-span/2)*rate));z=min(r['frames'],math.ceil((center+span/2)*rate));series=[]
        for name,values in waves.items():series.append((name,[((frame-a)/rate,values[frame*channels]) for frame in range(a,z)]))
        top=max(abs(v) for name,pts in series for x,v in pts)*1.3
        body=f'<text x="80" y="35" font-size="23" font-weight="700">{label} — {html.escape(title)}</text>'
        for gap in r['gaps']:
            if not gap['significant']:continue
            left=max(a,gap['start_frame']);right=min(z,gap['end_frame'])
            if right>left:body+=f'<rect x="{90+(left-a)/(z-a)*920:.2f}" y="140" width="{(right-left)/(z-a)*920:.2f}" height="230" fill="#fff0c8"/>'
        body+=charts.chart(90,140,920,230,series,(z-a)/rate,-top,top,'Seconds from displayed window start','Decoded amplitude',f'Original time {a/rate:.6f}–{z/rate:.6f} s')
        label_positions=[];target_x=90+(row['start_frame']-a)/(z-a)*920
        for current in rows:
            start=current['start_frame'];edge=current['sharpest_original_edge']
            if a<=start<z:
                x=90+(start-a)/(z-a)*920;anchor='end' if x>955 else 'start';tx=x-2 if anchor=='end' else x+2
                body+=f'<line x1="{x:.2f}" x2="{x:.2f}" y1="140" y2="370" stroke="#64748b" stroke-width="1"/>'
                if current['cycle']==row['cycle'] or (abs(x-target_x)>=65 and all(abs(x-v)>=65 for v in label_positions)):
                    body+=f'<text x="{tx:.2f}" y="154" text-anchor="{anchor}" font-size="12">{current["cycle"]}:{code.get(current["failure_category"],"?")}</text>'
                    label_positions.append(x)
            if edge and a<=edge['fractional_frame']<z:
                x=90+(edge['fractional_frame']-a)/(z-a)*920
                body+=f'<line x1="{x:.2f}" x2="{x:.2f}" y1="166" y2="370" stroke="#64748b" stroke-width="1" stroke-dasharray="2 4"/>'
        body+='<text x="90" y="490" font-size="13">Solid gray: detected rising crossing. Dotted: steepest original edge. Yellow: significant flat-output interval.</text>'
        charts.save_svg(HERE/f'{label.lower()}.svg',title,'Frozen original, reconstruction and residual with candidate boundaries, reset proxies, decision codes and gap annotations.',body,520)
        svg=(HERE/f'{label.lower()}.svg').read_text().replace('id="title"',f'id="{label}-title"').replace('id="desc"',f'id="{label}-desc"').replace('aria-labelledby="title desc"',f'aria-labelledby="{label}-title {label}-desc"')
        caption=f"Cycle {row['cycle']}; {row['start_seconds']:.6f}–{row['end_seconds']:.6f} s. Candidate detected: yes; reliable: {row['detection_reliability']}; signature: {row['signature_present']}; rendered: {row['4h_supported']}."
        if row.get('historical_best_similarity') is not None:caption+=f" Best historical match {row['historical_best_similarity']:.6f}; bounded descriptor probe {row['bounded_descriptor_phase_probe']['similarity']:.6f}; native boundary-translation probe {row['boundary_translation_probe']['similarity']:.6f}."
        if row['recognition_rejection_reasons']:caption+=' Rejection: '+html.escape('; '.join(row['recognition_rejection_reasons']))+'.'
        if row['detection_rejection_reasons']:caption+=' Detection/reliability reasons: '+html.escape('; '.join(row['detection_rejection_reasons']))+'.'
        figures.append(f'<figure id="{label}">{svg}<figcaption>{caption}</figcaption></figure>')
        trace_rows.append([f'<a href="#{label}">{label}</a>',str(row['cycle']),f"{row['start_seconds']:.6f}",html.escape(row['failure_category'])])
    categories=r['category_summary'];category_rows=[]
    order=['outside_candidate_support','detection_reliability_rejection','signature_missing','provisional_family_rejection','unsupported_family_relationship',
           'target_shape_rejection','target_period_confidence_rejection','neighbor_rejection','accepted_not_rendered','rendered_model_error']
    for name in order:
        item=categories.get(name,{'cycle_count':0,'residual_energy':0,'fraction_of_total_residual':0})
        count=f"{item['fragment_count']} partial fragments" if 'fragment_count' in item else str(item['cycle_count'])
        category_rows.append([html.escape(name.replace('_',' ')),count,f"{item['residual_energy']:.4f}",f"{100*item['fraction_of_total_residual']:.2f}%"])
    significant=[v for v in r['gaps'] if v['significant']];low=[v for v in rows if v['failure_category']=='target_shape_rejection']
    stable=[v for v in target if v.get('next_edge_context_reliable') and v.get('next_period_change_fraction',1)<.02]
    score_before=statistics.median(v['historical_best_similarity'] for v in target);score_after=statistics.median(v['bounded_descriptor_phase_probe']['similarity'] for v in target)
    period_error=statistics.median(v['period_error_fraction'] for v in target);reset_error=statistics.median(v['edge_interval_vs_crossing_period_fraction'] for v in stable)
    spike=r['spike_summary'];total_res=sum(v['residual_energy'] for v in categories.values())
    body=f'''<h1>Experiment 4I — why ordinary ramps disappear</h1><p class="lead"><strong>They are usually not lost in rendering.</strong> The trace finds detected cycles with correctly generated signatures that fail fixed target-confidence checks, so the renderer intentionally writes no audio there. The original ramp then remains in the residual.</p>
<p>Frozen 4H baseline · diagnostic only · no audio exports, recognition changes, new synthesis, linear256 combination, MIDI or 4J.</p>
<h2>Direct findings</h2><ul><li><strong>102 significant flat-output intervals</strong> are traced in the CSV/JSON. None intersects declared accepted support. All have original waveform energy and residual samples identical to original.</li><li><strong>70 isolated rejected cycles</strong> have accurately rendered neighbors within 0.1 period on both sides. Of these, 57 fail target shape, 8 fail neighbor checks and 5 fail target periodicity confidence.</li><li><strong>No accepted-but-unrendered cycle</strong>, no missing reliable-cycle signature, and no output outside declared support was found. All 2,013 accepted cycles have nonzero modeled energy.</li><li>All regenerated reliable rejected-cycle signatures match the saved signatures exactly (<strong>maximum difference 0</strong>). This rules out a missing/corrupted-signature path for these gaps.</li></ul>
<p>The 102 significant intervals have these dominant causes: <strong>75 target-shape, 9 detection/reliability, 8 neighbor, 7 target-periodicity, 2 partial-boundary, and 1 unsupported-relationship</strong>. Intervals may contain more than one candidate; their full mixed-cause energy traces remain in JSON.</p><h2>Counts and energy by stage</h2>{table(['Exclusive failure stage','Candidate cycles / fragments','Residual energy (sum of squared samples)','Share of H residual'],category_rows)}
<p>Counts describe candidate intervals, not certified physical periods: many of the 399 unreliable intervals are tiny extra crossings. Energy categories partition the entire residual without double counting. “Rendered model error” is retained as a separate non-gap category. Two outside-support fragments are partial first/last periods, not evidence of an undetected full interior note. Significance prioritizes original energy and duration, not listener audibility.</p>
<h2>Representative traces</h2><p>Codes: <strong>R</strong> rendered; <strong>T</strong> target-shape rejection; <strong>P</strong> periodicity-confidence rejection; <strong>D</strong> unreliable detection candidate; <strong>N</strong> neighbor rejection; <strong>V</strong> provisional; <strong>U</strong> unsupported relationship. Labels are candidate IDs plus decision code. Very close labels are suppressed for readability; all boundary lines and full JSON IDs remain. Original times and metadata are preserved.</p>{table(['Plot','Cycle','Original start (s)','Trace endpoint'],trace_rows)}{''.join(figures)}
<h2>Boundary accuracy and the isolated ordinary cycles</h2><p>Detected boundaries are rising mean-level crossings. Sharp resets are internal cycle landmarks, so their approximately half-period displacement from the boundary is intentional. Compare <em>intervals</em> and relative phase, not absolute coincidence of the two landmarks.</p>
<p>For the 57 isolated target-shape failures, median stored score is <strong>{score_before:.6f}</strong>, narrowly below the frozen 0.995 target requirement. A diagnostic ±0.5-position comparison moves <strong>57/57</strong> above 0.995; every best adjustment in this subset is ±0.25 of a 64-position slot. Median score becomes <strong>{score_after:.6f}</strong>. Neighbor tolerance in 4H never applied to this target-side test, which explains why these cycles still disappear.</p>
<p>Independently remeasuring each rejected cycle with both original-audio boundaries translated together by −1, −0.5, 0, +0.5 or +1 sample moves <strong>40/57</strong> isolated target failures above the gate. Across all 93 exclusive target-shape failures, the descriptor probe passes 91 and the native translation probe passes 68. Period duration is held fixed during these probes. Median isolated target period error is <strong>{100*period_error:.3f}%</strong>; median source reset-to-reset versus crossing-period difference in reliable same-period context is <strong>{100*reset_error:.3f}%</strong>. These do not indicate a gross missing/misplaced period.</p>
<p><strong>Confirmed:</strong> tiny phase/sampling changes can flip a hard confidence decision while the audio remains periodic. <strong>Not proved:</strong> that every saved boundary is physically wrong, or every rejected cycle should be accepted. Descriptor rotation linearly smooths sampled shapes; translated audio signatures change interpolation, mean and RMS estimates. Genuine shape/phase changes and 64-position sampling sensitivity remain confounded. No probe result was applied to recognition or audio.</p>
<h2>Detection versus rejection versus rendering</h2><p>The 119 omitted reliable ambiguous cycles partition into 93 target-shape, 11 target-periodicity, 13 neighbor, and 2 unsupported-relationship cases. Another shape-low reason overlaps an unsupported pair, hence 94 cycles carry that reason in the original logs but only 93 belong to the exclusive target-shape category here. Each gap’s owner IDs link to its full detection, signature, historical exemplar scores, 4F-B/4H support, rejection and actual output-energy records in report.json.</p>
<p>Unreliable detection candidates already existed but were screened out before normal recognition. This is different from never finding a candidate. Missing support at 0–0.001905 s and 5.997120–6 s lies outside the first/last complete candidate intervals. No rendering omission after acceptance was found. The trace does not reinterpret confidence as ground truth or force release/transition material into a family.</p>
<h2>Repeated spikes are not missing ramps</h2><p>4H has <strong>{spike['narrow_rendered_events']}</strong> detected narrow residual events entirely within rendered support. With a fixed 20%-of-original-peak threshold and width ≤15% of the local observed period, median width is one sample (22.7 microseconds), median phase is <strong>{spike['median_phase']:.4f}</strong>, and median distance to the original sharpest edge is one sample. <strong>Zero</strong> occur in the bridge phase zone. Their energy is {100*spike['energy']/total_res:.2f}% of total residual energy.</p>
<p>These spikes are consistent with sharp-edge approximation and sub-sample/high-harmonic phase mismatch in the frozen 64-position model, not erased whole periods or large placement shifts. A sampled maximum-slope location is only a reset proxy, not a physical discontinuity timestamp. This trace cannot uniquely split sharp-edge bandwidth loss from very small phase errors. Entire missing ramps have zero reconstructed support and original-like residual over much of a period; they are classified separately.</p>
<h2>What this supports next — no correction implemented</h2><p>The most direct future controlled test would address bounded <em>target-side</em> alignment sensitivity while keeping strict evidence for different shapes and retaining original timing/phase in any synthesis. 4H changed only neighbors. The data does not justify simply lowering 0.995, automatically merging families, accepting all 119 cycles, or treating every sharp edge as a new cycle boundary. Periodicity and detection failures need separate evidence. No 4J or revised render was started.</p>
<h2>Execution and safeguards</h2><p>Main execution: <strong>{r['timings']['total_before_json_seconds']:.3f} s</strong> before JSON export, including {r['timings']['setup_verify_load_seconds']:.3f} s loading/hash verification, {r['timings']['trace_and_boundary_probes_seconds']:.3f} s tracing and boundary probes, and {r['timings']['spikes_aggregation_and_preservation_seconds']:.3f} s spikes/aggregation/preservation. Peak process RSS: <strong>{r['peak_process_rss_bytes']/2**20:.2f} MiB</strong>. Tests, report figures and HTML generation are separate. No recognition/discovery/synthesis rerun occurred.</p>
<p>Seven tests passed: stage classification, exclusive accounting, significance, internal-reset versus origin, saved energy partitions and signature/render consistency. All earlier files and exports pass before/after hashes. HTML/SVG syntax and links are checked; rendered browser preview and new listening were not performed. No MIDI, note names, supplied scale or isolated reference audio entered the trace.</p>
<p><a href="gap-trace.csv">Every flat interval, including all 102 significant gaps (CSV)</a> · <a href="report.json">Full per-cycle end-to-end traces and all diagnostic probes (JSON)</a> · <a href="README.md">Concise summary and commands</a></p>'''
    css='''body{font:17px/1.5 system-ui,sans-serif;max-width:1100px;margin:28px auto;padding:0 18px;color:#1d2b39}h1{line-height:1.15}h2{margin-top:30px}.lead{font-size:1.18rem}a{color:#125da8}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{padding:8px 10px;border-bottom:1px solid #c8d1db;text-align:left;vertical-align:top}th{background:#edf1f5}.scroll{overflow-x:auto}figure{margin:26px 0;border-top:1px solid #c8d1db}svg{max-width:100%;height:auto}figcaption{font-size:.92rem}figure:target{background:#fff6cf}li{margin:7px 0}'''
    with (HERE/'report.html').open('x') as f:f.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Experiment 4I — missing-cycle trace</title><style>'+css+'</style></head><body>'+body+'</body></html>')
    print('Compact report written with four annotated waveform windows.')

if __name__=='__main__':run()

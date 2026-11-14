"""4H: replace only frozen 4F-B's neighbor evidence. No synthesis or discovery changes."""
import importlib.util
from pathlib import Path

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

f=load('frozen_4f_methods',ROOT/'results/experiment-04f-independent/methods.py')
g=load('frozen_4g_phase_probe',ROOT/'results/experiment-04g-gap-family-diagnostics/contextualize.py')
MAX_GAP_PERIODS=.1
NEIGHBOR_REASONS={'unreliable immediate neighbor','neighbor period/continuity mismatch','neighbor geometry unstable'}


def temporal_neighbors(cycles):
    """Nearest reliable temporal predecessor/successor; no acceptance or filling."""
    ordered=sorted(cycles.values(),key=lambda row:row['start_frame'])
    previous={};following={};last=None
    for row in ordered:
        previous[row['cycle']]=last
        if row['reliable']:last=row
    last=None
    for row in reversed(ordered):
        following[row['cycle']]=last
        if row['reliable']:last=row
    return previous,following


def choose(row,assignment,cycles,families,allowed,neighbors):
    """Keep every target gate frozen; alter neighbor lookup/comparison only.

    Return a waveform render-family choice. Never mutate original shape identity,
    rotate a synthesis template, or render a skipped unreliable interval.
    """
    _,old_reasons=f.choose_related(row,assignment,cycles,families,allowed)
    reasons=[reason for reason in old_reasons if reason not in NEIGHBOR_REASONS]
    if reasons:return None,{'reasons':reasons,'neighbors':[],'target_gates_passed':False}
    duration=row['end_frame']-row['start_frame'];evidence=[]
    for side,lookup in [('previous',neighbors[0]),('following',neighbors[1])]:
        neighbor=lookup.get(row['cycle'])
        if neighbor is None:
            reasons.append('no reliable '+side+' temporal neighbor');continue
        gap=row['start_frame']-neighbor['end_frame'] if side=='previous' else neighbor['start_frame']-row['end_frame']
        gap_periods=gap/duration
        period_change=abs((neighbor['end_frame']-neighbor['start_frame'])/duration-1)
        detail={'side':side,'cycle':neighbor['cycle'],'gap_periods':gap_periods,'relative_period_change':period_change}
        if gap < -1e-8 or gap_periods>MAX_GAP_PERIODS:
            reasons.append('reliable '+side+' neighbor outside time bound');evidence.append(detail);continue
        if period_change>f.RELATION_POLICY['neighbor_period_change_max']:
            reasons.append('reliable '+side+' neighbor period mismatch');evidence.append(detail);continue
        probe=g.bounded_phase_similarity(row['shape'],neighbor['shape'])
        detail.update({'direct_similarity':f.cosine(row['shape'],neighbor['shape']),
                       'phase_tolerant_similarity':probe['similarity'],'comparison_shift_positions':probe['shift_positions']})
        evidence.append(detail)
        if probe['similarity']<f.RELATION_POLICY['neighbor_geometry_min']:
            reasons.append('reliable '+side+' neighbor geometry mismatch')
    if reasons:return None,{'reasons':reasons,'neighbors':evidence,'target_gates_passed':True}
    family=max(assignment['candidates'],key=lambda v:v['similarity'])['family']
    return family,{'reasons':[],'neighbors':evidence,'target_gates_passed':True,
                   'identity_interpretation':'Waveform render supported; source/family identity still ambiguous.'}

// One deck's workspace/section choices. Visibility never changes musical state.
export function createDeckNavigation(changed) {
  const state = { workspace:'performance-view', upperView:'wave-view', lowerView:'cues-view' };
  return {
    get workspace() { return state.workspace; },
    get upperView() { return state.upperView; },
    get lowerView() { return state.lowerView; },
    openLibrary() { state.workspace='library-view'; changed(); },
    showPerformance() { state.workspace='performance-view'; changed(); },
    toggleUpper() { state.upperView=state.upperView==='wave-view'?'stems-view':'wave-view'; changed(); },
    toggleLower() { state.lowerView=state.lowerView==='cues-view'?'controls':'cues-view'; changed(); },
    completed(result) { if(result?.kind==='loaded' && state.workspace==='library-view'){state.workspace='performance-view';changed();} }
  };
}

export const isWaveformTheme = () => document.documentElement.dataset.theme === 'waveform';

// One deck's workspace/section choices. Visibility never changes musical state.
export function createDeckNavigation(changed) {
  const state = { workspace:'performance-view', upperView:'wave-view', lowerView:'cues-view', configuration:'cues' };
  return {
    get workspace() { return state.workspace; },
    get upperView() { return isWaveformTheme() ? 'wave-view' : state.upperView; },
    get configuration() { return state.configuration; },
    get presentation() {
      const waveformTheme = isWaveformTheme();
      return { waveformTheme, configuration: state.configuration, sections: {
        wave: waveformTheme || state.upperView === 'wave-view',
        stems: waveformTheme ? state.configuration === 'stems' : state.upperView === 'stems-view',
        cues: waveformTheme ? state.configuration === 'cues' : state.lowerView === 'cues-view',
        controls: waveformTheme ? state.configuration === 'controls' : state.lowerView === 'controls'
      } };
    },
    get lowerView() { return state.lowerView; },
    openLibrary() { state.workspace='library-view'; changed(); },
    showPerformance() { state.workspace='performance-view'; changed(); },
    chooseConfiguration(index) {
      const configuration = ['cues','stems','controls'][Math.max(0,Math.min(2,index))];
      if (configuration === state.configuration) return;
      state.configuration = configuration;
      changed();
    },
    toggleUpper() {
      if (isWaveformTheme()) {
        state.configuration = {cues:'stems', stems:'controls', controls:'cues'}[state.configuration];
      } else {
        state.upperView = state.upperView === 'wave-view' ? 'stems-view' : 'wave-view';
      }
      changed();
    },
    toggleLower() { state.lowerView=state.lowerView==='cues-view'?'controls':'cues-view'; changed(); },
    completed(result) { if(result?.kind==='loaded' && state.workspace==='library-view'){state.workspace='performance-view';changed();} }
  };
}

// Relative vertical dragging follows the established roller/nudge anchor pattern.
// One 32px step selects the next configuration upward; tapping cycles all three.
export function connectWaveformPerformanceSelector(button, navigation) {
  let drag = null, suppressUntil = 0, pointerType = '';
  function finish() {
    const previous = drag; drag = null;
    if (previous && button.hasPointerCapture(previous.id)) button.releasePointerCapture(previous.id);
  }
  button.addEventListener('pointerdown', event => {
    if (!isWaveformTheme() || drag || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    pointerType = event.pointerType;
    drag = {id:event.pointerId, y:event.clientY, index:['cues','stems','controls'].indexOf(navigation.configuration), moved:false};
    button.focus({preventScroll:true}); button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    event.preventDefault();
    if (Math.abs(drag.y-event.clientY) > 6) drag.moved = true;
    if (drag.moved) navigation.chooseConfiguration(drag.index + Math.round((drag.y-event.clientY)/32));
  });
  button.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const tap = !drag.moved;
    suppressUntil = performance.now()+600; finish();
    if (tap) navigation.toggleUpper();
  });
  for (const type of ['pointercancel','lostpointercapture']) button.addEventListener(type,event=>{
    if (drag?.id === event.pointerId) { suppressUntil=performance.now()+600; finish(); }
  });
  button.addEventListener('click',event=>{
    if (isWaveformTheme() && performance.now()<suppressUntil && (event.detail || pointerType==='touch')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  },true);
  button.addEventListener('keydown',event=>{
    if (!isWaveformTheme()) return;
    suppressUntil=0;
    const delta={ArrowUp:1,ArrowDown:-1}[event.key];
    if (delta === undefined) return;
    event.preventDefault(); navigation.chooseConfiguration(['cues','stems','controls'].indexOf(navigation.configuration)+delta);
  });
  window.addEventListener('blur',finish); window.addEventListener('resize',finish);
  document.addEventListener('tunetox-theme-change',finish);
}

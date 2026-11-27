import { createGlobalNudgePresentation } from '../../visual/waveform/nudge-controls.js';
import { getNudgePercent, setNudgeDirection, setNudgePercent } from './nudging.js';

// One local held gesture per deck. No playback clock or established-tempo copy.
export function connectNudgeControls(deck, node, view, canOperate, changed, report) {
  let hold = null;
  const run = operation => { operation.catch(error => report('Nudge: ' + error.message)); changed(); };
  const eligible = () => canOperate() && deck.isPlaying && !deck.audio.paused && !deck.loadingSong;
  function render() { view.render({ direction:deck.nudgeDirection, enabled:eligible() }); }
  function release() {
    const previous = hold; hold = null;
    if (previous?.pointer !== undefined && previous.button.hasPointerCapture(previous.pointer)) previous.button.releasePointerCapture(previous.pointer);
    if (deck.nudgeDirection) run(setNudgeDirection(deck, 0));
    render();
  }
  function start(button, direction, pointer, key) {
    if (hold || !eligible()) return;
    hold = {button,pointer,key,source:deck.audio.src};
    run(setNudgeDirection(deck,direction)); render();
  }
  [[view.backward,-1],[view.forward,1]].forEach(([button,direction]) => {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || (!event.isPrimary && event.pointerType !== 'touch')) return;
      event.preventDefault(); event.stopPropagation();
      start(button,direction,event.pointerId);
      if (hold?.pointer === event.pointerId) { button.focus({preventScroll:true}); button.setPointerCapture(event.pointerId); }
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type,event => { if (hold?.pointer === event.pointerId) release(); });
    button.addEventListener('keydown', event => {
      if (![' ','Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); if (!event.repeat) start(button,direction,undefined,event.key);
    });
    button.addEventListener('keyup', event => { if (hold?.button === button && hold.key === event.key) { event.preventDefault(); release(); } });
    // Another deck's touch may take focus while this pointer remains captured.
    button.addEventListener('blur', () => { if (hold?.button === button && hold.pointer === undefined) release(); });
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  function cancel() { release(); }
  window.addEventListener('blur',cancel); window.addEventListener('resize',cancel);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) cancel(); });
  document.addEventListener('tunetox-theme-change',cancel);
  const validate = () => {
    if (hold && (!node.isConnected || node.inert || !view.group.getClientRects().length ||
        (hold && (!eligible() || hold.source !== deck.audio.src || deck.nudgeDirection === 0)))) cancel();
    render();
  };
  // Ignore ordinary waveform/time-label DOM updates. Only visibility/removal of
  // this control's ancestors can cancel its gesture; avoid layout reads per frame.
  new MutationObserver(records => {
    if (!hold) return;
    const relevant = records.some(record => record.type === 'attributes'
      ? record.target.contains(view.group)
      : [...record.removedNodes].some(removed => removed.contains(view.group)));
    if (relevant) validate();
  }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','inert','data-iphone-selected']});
  for (const type of ['pause','ended','error','emptied']) deck.audio.addEventListener(type,validate);
  render(); return {validate};
}

// Global amount gesture updates the same percentage used by every held deck.
export function connectGlobalNudgeControls(header, decks, report) {
  const view = createGlobalNudgePresentation(header);
  let drag = null;
  const render = () => view.render(getNudgePercent());
  const run = operation => { operation.catch(error => report('Nudge: ' + error.message)); render(); };
  function endDrag() {
    const previous = drag; drag = null;
    if (previous && view.percent.hasPointerCapture(previous.id)) view.percent.releasePointerCapture(previous.id);
  }
  view.percent.addEventListener('pointerdown', event => {
    if (drag || event.button !== 0 || (!event.isPrimary && event.pointerType !== 'touch')) return;
    event.preventDefault(); event.stopPropagation(); view.percent.focus({preventScroll:true});
    drag = {id:event.pointerId,y:event.clientY,value:getNudgePercent()}; view.percent.setPointerCapture(event.pointerId);
  });
  view.percent.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    event.preventDefault();
    const value = Math.max(2,Math.min(50,Math.round(drag.value+(drag.y-event.clientY)/4)));
    if (value !== getNudgePercent()) { run(setNudgePercent(value,decks)); render(); }
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) view.percent.addEventListener(type,event => { if (drag?.id === event.pointerId) endDrag(); });
  view.percent.addEventListener('keydown',event => {
    const value = {ArrowUp:getNudgePercent()+1,ArrowDown:getNudgePercent()-1,Home:2,End:50}[event.key];
    if (value === undefined) return;
    event.preventDefault(); event.stopPropagation(); run(setNudgePercent(Math.max(2,Math.min(50,value)),decks)); render();
  });
  view.percent.addEventListener('contextmenu',event=>event.preventDefault());

  window.addEventListener('blur',endDrag); window.addEventListener('resize',endDrag);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)endDrag();});
  document.addEventListener('tunetox-theme-change',endDrag);
  render();
}

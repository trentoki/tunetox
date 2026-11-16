// Upper adaptive buttons and lower scrub surface own separate captured pointers.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.h5CreateWave=function(id,getDeck,actions,zoom){
  const bar=ui.element('div','h5-wave-tools'),minus=ui.button('','−','Adaptive backward control',()=>{}),plus=ui.button('','+','Adaptive forward control',()=>{}),distance=ui.element('select'),status=ui.element('output');
  for(const beats of [1,2,4,8]){const option=ui.element('option','',beats+' beat'+(beats===1?'':'s'));option.value=beats;distance.append(option);}distance.setAttribute('aria-label','Beat skip distance');distance.addEventListener('pointerdown',e=>e.stopPropagation());distance.addEventListener('pointermove',e=>e.stopPropagation());distance.addEventListener('keydown',e=>e.stopPropagation());distance.addEventListener('change',()=>actions.wave(id,'distance',Number(distance.value)));
  bar.append(minus,distance,status,plus);
  let held=null,suppress=false;
  function release(){if(held){held.button.dataset.pressed='false';actions.wave(id,'nudge',0);held=null;}}
  for(const [button,direction] of [[minus,-1],[plus,1]]){
   button.addEventListener('pointerdown',e=>{if(e.button!==0||held)return;e.preventDefault();e.stopPropagation();suppress=true;held={pointer:e.pointerId,button};button.dataset.pressed='true';try{button.setPointerCapture(e.pointerId);}catch(_){}actions.wave(id,getDeck().beatMatch?'skip':'nudge',direction);});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{if(held?.pointer===e.pointerId){release();setTimeout(()=>{suppress=false;},0);}});
   button.addEventListener('click',e=>{e.stopPropagation();if(e.detail===0&&!e.pointerType&&!suppress&&getDeck().beatMatch)actions.wave(id,'skip',direction);});
   button.addEventListener('keydown',e=>{e.stopPropagation();if([' ','Enter'].includes(e.key)&&!e.repeat&&!getDeck().beatMatch){e.preventDefault();actions.wave(id,'nudge',direction);}});
   button.addEventListener('keyup',e=>{e.stopPropagation();if([' ','Enter'].includes(e.key)&&!getDeck().beatMatch){e.preventDefault();actions.wave(id,'nudge',0);}});
   button.addEventListener('blur',()=>{release();actions.wave(id,'nudge',0);});
  }
  window.addEventListener('blur',release);
  // Relative 12-second preview scrub window, independent of ± and BeatMatch.
  zoom.setAttribute('role','group');zoom.setAttribute('aria-label','Simulated waveform controls');const scrubFocus=ui.element('span','h51-scrub-access');scrubFocus.tabIndex=0;scrubFocus.setAttribute('role','slider');scrubFocus.setAttribute('aria-label','Scrub simulated song position; left drag moves forward');zoom.append(scrubFocus);zoom.style.touchAction='none';let scrub=null;
  zoom.addEventListener('pointerdown',e=>{if(e.button!==0||scrub||e.target.closest('.h5-wave-tools'))return;e.preventDefault();e.stopPropagation();scrubFocus.focus({preventScroll:true});scrub={pointer:e.pointerId,x:e.clientX,position:getDeck().position};try{zoom.setPointerCapture(e.pointerId);}catch(_){} });
  zoom.addEventListener('pointermove',e=>{if(e.pointerId!==scrub?.pointer)return;e.preventDefault();const width=zoom.getBoundingClientRect().width;actions.wave(id,'scrub',scrub.position-(e.clientX-scrub.x)/Math.max(1,width)*12);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])zoom.addEventListener(type,e=>{if(e.pointerId===scrub?.pointer)scrub=null;});
  zoom.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();actions.wave(id,'scrub',getDeck().position+(e.key==='ArrowRight'?1:-1));}});
  return {node:bar,render(){const deck=getDeck();distance.hidden=!deck.beatMatch;distance.value=deck.wave.beats;status.value=deck.wave.pending?'Pending · next beat':deck.beatMatch?'Beat skip':deck.wave.nudge?'Nudge '+(deck.wave.nudge>0?'+':'−')+'5%':'Hold · ±5% nudge';minus.setAttribute('aria-label',deck.beatMatch?'Skip backward on next beat':'Hold to slow playback temporarily');plus.setAttribute('aria-label',deck.beatMatch?'Skip forward on next beat':'Hold to speed playback temporarily');bar.dataset.pending=String(!!deck.wave.pending);scrubFocus.setAttribute('aria-valuemin','0');scrubFocus.setAttribute('aria-valuemax',d.h5.duration(deck));scrubFocus.setAttribute('aria-valuenow',deck.position.toFixed(2));}};
 };
})();

// Upper adaptive buttons and lower scrub surface own separate captured pointers.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.h5CreateWave=function(id,getDeck,actions,zoom){
  const bar=ui.element('div','h5-wave-tools'),minus=ui.button('','−','Adaptive backward control',()=>{}),plus=ui.button('','+','Adaptive forward control',()=>{}),distance=ui.element('select'),status=ui.element('output');
  for(const beats of [1,2,4,8]){const option=ui.element('option','',beats+' beat'+(beats===1?'':'s'));option.value=beats;distance.append(option);}distance.setAttribute('aria-label','Beat skip distance');distance.addEventListener('change',()=>actions.wave(id,'distance',Number(distance.value)));
  bar.append(minus,distance,status,plus);
  let held=null,suppress=false;
  function release(){if(held){actions.wave(id,'nudge',0);held=null;}}
  for(const [button,direction] of [[minus,-1],[plus,1]]){
   button.addEventListener('pointerdown',e=>{if(e.button!==0||held)return;e.preventDefault();e.stopPropagation();suppress=true;held={pointer:e.pointerId,button};try{button.setPointerCapture(e.pointerId);}catch(_){}actions.wave(id,getDeck().beatMatch?'skip':'nudge',direction);});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{if(held?.pointer===e.pointerId){release();setTimeout(()=>{suppress=false;},0);}});
   button.addEventListener('click',()=>{if(!suppress&&getDeck().beatMatch)actions.wave(id,'skip',direction);});
   button.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat&&!getDeck().beatMatch){e.preventDefault();actions.wave(id,'nudge',direction);}});
   button.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)&&!getDeck().beatMatch){e.preventDefault();actions.wave(id,'nudge',0);}});
   button.addEventListener('blur',()=>{release();actions.wave(id,'nudge',0);});
  }
  window.addEventListener('blur',release);
  // Relative 12-second preview scrub window, independent of ± and BeatMatch.
  zoom.tabIndex=0;zoom.setAttribute('role','slider');zoom.setAttribute('aria-label','Scrub simulated song position');zoom.style.touchAction='none';let scrub=null;
  zoom.addEventListener('pointerdown',e=>{if(e.button!==0||scrub)return;e.preventDefault();e.stopPropagation();scrub={pointer:e.pointerId,x:e.clientX,position:getDeck().position};try{zoom.setPointerCapture(e.pointerId);}catch(_){} });
  zoom.addEventListener('pointermove',e=>{if(e.pointerId!==scrub?.pointer)return;e.preventDefault();const width=zoom.getBoundingClientRect().width;actions.wave(id,'scrub',scrub.position+(e.clientX-scrub.x)/Math.max(1,width)*12);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])zoom.addEventListener(type,e=>{if(e.pointerId===scrub?.pointer)scrub=null;});
  zoom.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();actions.wave(id,'scrub',getDeck().position+(e.key==='ArrowRight'?1:-1));}});
  return {node:bar,render(){const deck=getDeck();distance.hidden=!deck.beatMatch;distance.value=deck.wave.beats;status.value=deck.wave.pending?'Pending · next beat':deck.beatMatch?'Beat skip':deck.wave.nudge?'Nudge '+(deck.wave.nudge>0?'+':'−')+'5%':'Hold · ±5% nudge';minus.setAttribute('aria-label',deck.beatMatch?'Skip backward on next beat':'Hold to slow playback temporarily');plus.setAttribute('aria-label',deck.beatMatch?'Skip forward on next beat':'Hold to speed playback temporarily');bar.dataset.pending=String(!!deck.wave.pending);zoom.setAttribute('aria-valuemin','0');zoom.setAttribute('aria-valuemax',d.h5.duration(deck));zoom.setAttribute('aria-valuenow',deck.position.toFixed(2));}};
 };
})();

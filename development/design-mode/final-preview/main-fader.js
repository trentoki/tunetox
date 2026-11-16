// Transition Main uses the proven visual geometry but owns its pointer surface.
// A native range must not apply a second, differently inset touch adjustment.
(() => {
 const d=globalThis.TuneToxDesign;
 d.h52AttachMain=function(input,change){
  const visual=d.h5AttachStem(input,change),frame=input.parentElement;let pointer=null;
  input.style.pointerEvents='none'; // Still focusable and keyboard-accessible.
  function update(event){const r=frame.getBoundingClientRect();const value=d.h51Fader.fromPoint(r.height,event.clientY-r.top,true);input.value=value;change(value);visual.render();}
  frame.addEventListener('pointerdown',event=>{if(event.button!==0||pointer!==null)return;event.preventDefault();event.stopPropagation();pointer=event.pointerId;input.focus();try{frame.setPointerCapture(pointer);}catch(_){}update(event);});
  frame.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();update(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(type,event=>{if(event.pointerId===pointer)pointer=null;});
  return visual;
 };
})();

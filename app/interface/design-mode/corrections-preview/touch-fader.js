// One geometry for input mapping AND visible endpoints. Native input stays accessible.
(() => {
 const d=globalThis.TuneToxDesign,attachH5=d.h5AttachStem;
 d.attachVerticalFader=(input,change)=>attachH5(input,change,()=>!!input.closest('.h5-transition-strip')&&d.h51Phone());
 const clamp=value=>Math.max(0,Math.min(1,value));
 function geometry(length,value,vertical){const radius=12,travel=Math.max(1,length-radius*2);return radius+(vertical?1-clamp(value):clamp(value))*travel;}
 function fromPoint(length,coordinate,vertical){const value=clamp((coordinate-12)/Math.max(1,length-24));return Math.round((vertical?1-value:value)*100)/100;}
 d.h51Fader={geometry,fromPoint};
 d.h5AttachStem=function(input,change){
  let pointer=null;const vertical=()=>d.h51Phone();
  const frame=document.createElement('span');frame.className='h51-fader';input.before(frame);frame.append(input);
  const rail=document.createElement('span'),handle=document.createElement('span');rail.className='h51-fader-rail';handle.className='h51-fader-handle';rail.setAttribute('aria-hidden','true');handle.setAttribute('aria-hidden','true');frame.append(rail,handle);
  function render(){const v=vertical(),r=frame.getBoundingClientRect(),position=geometry(v?r.height:r.width,input.valueAsNumber,v);frame.dataset.axis=v?'vertical':'horizontal';input.setAttribute('aria-orientation',v?'vertical':'horizontal');handle.style.left=v?'50%':position+'px';handle.style.top=v?position+'px':'50%';}
  function update(event){const r=frame.getBoundingClientRect(),v=vertical(),coordinate=v?event.clientY-r.top:event.clientX-r.left;const value=fromPoint(v?r.height:r.width,coordinate,v);input.value=value;change(value);render();}
  input.addEventListener('pointerdown',event=>{if(event.button!==0||pointer!==null)return;event.preventDefault();event.stopPropagation();pointer=event.pointerId;input.focus();try{input.setPointerCapture(pointer);}catch(_){}update(event);});
  input.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();update(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])input.addEventListener(type,event=>{if(event.pointerId===pointer)pointer=null;});
  return {render};
 };
})();

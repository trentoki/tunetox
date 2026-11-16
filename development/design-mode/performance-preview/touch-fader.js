// Axis-aware pointer capture on the existing native range. No duplicate gain state.
(() => {
 const d=globalThis.TuneToxDesign;
 d.h5AttachStem=function(input,change,getVertical){let pointer=null;
  const vertical=getVertical||(()=>matchMedia('(max-width:700px) and (orientation:portrait)').matches);
  function update(event){const r=input.getBoundingClientRect(),v=vertical();const length=v?r.height:r.width;
   const inset=22,travel=Math.max(1,length-inset*2),coordinate=v?r.bottom-event.clientY:event.clientX-r.left;
   const value=Math.round(Math.max(0,Math.min(1,(coordinate-inset)/travel))*100)/100;input.value=value;change(value);
  }
  input.addEventListener('pointerdown',event=>{if(event.button!==0||pointer!==null)return;event.preventDefault();event.stopPropagation();pointer=event.pointerId;input.focus();try{input.setPointerCapture(pointer);}catch(_){}update(event);});
  input.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();update(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])input.addEventListener(type,event=>{if(event.pointerId===pointer)pointer=null;});
  return {render(){input.setAttribute('aria-orientation',vertical()?'vertical':'horizontal');}};
 };
 d.attachVerticalFader=(input,change)=>d.h5AttachStem(input,change,()=>!!input.closest('.h5-transition-strip')&&d.isPhone());
})();

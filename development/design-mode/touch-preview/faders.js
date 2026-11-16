// Pointer-owned surfaces keep native range touch behavior from fighting other fingers.
// Existing appearance, 24px custom handle geometry and deck callbacks are unchanged.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 function attach(input,change,vertical,custom=true){
  const frame=document.createElement('span');frame.className=custom?'h51-fader':'h531-native-range';input.before(frame);frame.append(input);input.style.pointerEvents='none';
  let rail,handle,offset=0;
  if(custom){rail=document.createElement('span');handle=document.createElement('span');rail.className='h51-fader-rail';handle.className='h51-fader-handle';rail.setAttribute('aria-hidden','true');handle.setAttribute('aria-hidden','true');frame.append(rail,handle);}
  const hit=document.createElement('span');hit.className='h531-range-hit';hit.setAttribute('aria-hidden','true');frame.append(hit);
  function dimensions(){const r=frame.getBoundingClientRect(),v=vertical();return {r,v,length:v?r.height:r.width};}
  function center(length,value,v){return custom?d.h51Fader.geometry(length,value,v):8+value*Math.max(1,length-16);}
  function update(event){const {r,v,length}=dimensions();const point=(v?event.clientY-r.top:event.clientX-r.left)-offset;
   const value=custom?d.h51Fader.fromPoint(length,point,v):Math.round(Math.max(0,Math.min(1,(point-8)/Math.max(1,length-16)))*100)/100;
   input.value=value;change(value);render();
  }
  const gesture=d.h531Pointers.bind(frame,{start(event){const {r,v,length}=dimensions(),point=v?event.clientY-r.top:event.clientX-r.left,at=center(length,input.valueAsNumber,v);offset=Math.abs(point-at)<=22?point-at:0;input.focus({preventScroll:true});update(event);},move:update});
  function render(){const {v,length}=dimensions();if(gesture.active()&&!frame.getClientRects().length)gesture.cancel();input.setAttribute('aria-orientation',v?'vertical':'horizontal');if(custom){frame.dataset.axis=v?'vertical':'horizontal';const at=center(length,input.valueAsNumber,v);handle.style.left=v?'50%':at+'px';handle.style.top=v?at+'px':'50%';}}
  return {render};
 }
 d.h5AttachStem=(input,change)=>attach(input,change,()=>d.h51Phone());
 d.h52AttachMain=(input,change)=>attach(input,change,()=>true);
 const slider=ui.slider;
 ui.slider=function(label,id,change,openSampler){const base=slider(label,id,change,openSampler);if(!/^h1-main-\d+$/.test(id))return base;
  const surface=attach(base.node.querySelector('input'),change,()=>false,false);return {node:base.node,render(value){base.render(value);surface.render();}};
 };
})();

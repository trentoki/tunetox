// Transient pointer ownership only; musical values stay in the existing deck model.
(() => {
 const d=globalThis.TuneToxDesign;
 function createOwners(){
  const pointers=new Map(),controls=new Map();
  return {claim(id,control){if(pointers.has(id)||controls.has(control))return false;pointers.set(id,control);controls.set(control,id);return true;},
   release(id,control){if(pointers.get(id)!==control)return false;pointers.delete(id);controls.delete(control);return true;},
   owner:control=>controls.get(control),count:()=>pointers.size,entries:()=>[...pointers.entries()]};
 }
 const owners=createOwners(),cancelers=new Map();
 function bind(node,{start,move,end=()=>{}}){
  let pointer=null;
  function finish(event,reason){if(pointer===null||event&&event.pointerId!==pointer)return;const id=pointer;pointer=null;owners.release(id,node);cancelers.delete(id);end(event,reason);try{if(node.hasPointerCapture(id))node.releasePointerCapture(id);}catch(_){} }
  node.addEventListener('pointerdown',event=>{
   if(event.button!==0||pointer!==null||!owners.claim(event.pointerId,node))return;
   event.preventDefault();event.stopPropagation();pointer=event.pointerId;cancelers.set(pointer,()=>finish(null,'cancel'));
   try{node.setPointerCapture(pointer);}catch(_){/* Synthetic tests cannot capture. */}start(event);
  });
  node.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();move(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(type,event=>{if(event.pointerId===pointer){event.preventDefault();event.stopPropagation();finish(event,type);}});
  return {cancel:()=>finish(null,'cancel'),active:()=>pointer!==null};
 }
 function cancelAll(){for(const cancel of [...cancelers.values()])cancel();}
 if(typeof window!=='undefined')window.addEventListener('blur',cancelAll);
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAll();});
 d.h531Pointers={createOwners,bind,owner:node=>owners.owner(node),count:()=>owners.count(),cancelAll};
})();

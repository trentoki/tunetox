// F2 physical-input arbitration only; no allocation or audio state lives here.
(() => {
  const design=globalThis.TuneToxDesign;
  design.createStemTouchPriority=function(){
    const owners=new Map();
    return {
      begin(category,control,pointer){
        if(owners.has(category))return false;
        owners.set(category,{control,pointer});return true;
      },
      allows(category,control){return !owners.has(category)||owners.get(category).control===control;},
      end(pointer){for(const [category,owner] of owners)if(owner.pointer===pointer)owners.delete(category);},
      clear(){owners.clear();}
    };
  };
  design.attachStemTouchPriority=function(root,refresh,onTouch){
    const guard=design.createStemTouchPriority();
    const category=target=>target?.id?.match(/^demo-deck-[1-4]-stem-([0-3])$/)?.[1];
    root.addEventListener('pointerdown',event=>{
      const name=category(event.target);if(name===undefined)return;
      if(!guard.begin(name,event.target,event.pointerId)){
        event.preventDefault();event.stopImmediatePropagation();
      }else onTouch?.(Number(event.target.id.split('-')[2]),Number(name));
    },true);
    root.addEventListener('input',event=>{
      const name=category(event.target);if(name===undefined||guard.allows(name,event.target))return;
      event.stopImmediatePropagation();refresh();
    },true);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,event=>guard.end(event.pointerId),true);
    globalThis.addEventListener('blur',()=>guard.clear());
    return guard;
  };
})();

// Captured pointer stays on the selector while content changes underneath it.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.compact.createSlideSelector=function(id,getDeck,select,options={}){
  const node=ui.element('nav','h3-selector');node.setAttribute('aria-label',(options.label||'Performance mode for deck ')+id);node.setAttribute('role','tablist');
  const modes=options.modes||['wave','cue','controls'];const currentMode=options.current||(()=>getDeck().compact.mode);let pointer=null,suppressClick=false;node.style.gridTemplateColumns='repeat('+modes.length+',minmax(0,1fr))';
  const buttons=modes.map(mode=>{
   const b=ui.button('',options.labels?.[mode]||(mode==='wave'?'Wave':mode==='cue'?'Cue':'Controls'),'Show '+mode+' on deck '+id,()=>{if(!suppressClick)select(mode);});
   b.dataset.mode=mode;b.id=(options.prefix||'h3-mode-')+id+'-'+mode;b.setAttribute('role','tab');node.append(b);return b;
  });
  function at(x,force=false){const r=node.getBoundingClientRect();if(!r.width)return;const index=Math.max(0,Math.min(modes.length-1,Math.floor((x-r.left)*modes.length/r.width)));if(force||currentMode()!==modes[index])select(modes[index]);}
  node.addEventListener('pointerdown',event=>{
   if(event.button!==0||pointer!==null)return;
   event.preventDefault();event.stopPropagation();pointer=event.pointerId;suppressClick=true;at(event.clientX,!!options.reselect);
   try{node.setPointerCapture(event.pointerId);}catch(_){/* synthetic test pointer */}
  });
  node.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();at(event.clientX);});
  function end(event){if(event.pointerId!==pointer)return;event.preventDefault();event.stopPropagation();pointer=null;setTimeout(()=>{suppressClick=false;},0);}
  node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);node.addEventListener('lostpointercapture',end);
  node.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();}},true);
  node.addEventListener('keydown',event=>{
   const current=modes.indexOf(currentMode());let index;
   if(['ArrowRight','ArrowLeft'].includes(event.key))index=Math.max(0,Math.min(modes.length-1,current+(event.key==='ArrowRight'?1:-1)));
   else if(event.key==='Home')index=0;else if(event.key==='End')index=modes.length-1;else return;
   event.preventDefault();select(modes[index]);buttons[index].focus();
  });
  return {node,render(){for(const [index,b] of buttons.entries()){const active=currentMode()===modes[index];b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}}};
 };
})();

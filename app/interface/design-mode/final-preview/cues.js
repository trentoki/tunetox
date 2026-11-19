// Cue action commits on contact, so releasing Shift cannot turn deletion into a jump.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.h52CreateCues=function(id,getDeck,actions,zoom,loop){
  const node=ui.element('section','h3-cue h52-cue'),pads=ui.element('div','h3-hot-cues'),marks=ui.element('div','h52-cue-markers');node.id='h52-cues-'+id;node.setAttribute('aria-label','Cue workspace for deck '+id);zoom.append(marks);
  const buttons=Array.from({length:8},(_,index)=>{
   const b=ui.button('','', 'Cue '+(index+1),e=>{if(e.detail===0&&!e.pointerType)actions.cue(id,'cue',{index,shift:e.shiftKey});});
   b.dataset.cue=index;b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();actions.cue(id,'cue',{index,shift:e.shiftKey});});pads.append(b);return b;
  });
  function hold(kind,label){
   let pointer=null;const b=ui.button('',label,'Hold '+label,()=>{});b.dataset.modifier=kind;
   b.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null)return;e.preventDefault();e.stopPropagation();pointer=e.pointerId;try{b.setPointerCapture(pointer);}catch(_){}actions.cue(id,kind,true);});
   function release(e){if(pointer!==null&&(!e||pointer===e.pointerId)){pointer=null;actions.cue(id,kind,false);}}
   for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,release);
   b.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();actions.cue(id,kind,true);}});
   b.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();actions.cue(id,kind,false);}});
   b.addEventListener('blur',()=>{if(pointer===null)actions.cue(id,kind,false);});window.addEventListener('blur',()=>{release();actions.cue(id,kind,false);});return b;
  }
  const repeat=hold('repeat','Repeat'),shift=hold('shift','Shift'),bottom=ui.element('div','h52-cue-actions');bottom.append(loop,repeat,shift);node.append(pads,bottom);
  const markers=Array.from({length:8},(_,i)=>{const m=ui.element('span','h52-cue-marker',''+(i+1));marks.append(m);return m;});
  const time=value=>Math.floor(value/60)+':'+(value%60).toFixed(3).padStart(6,'0');
  return {node,render(){const deck=getDeck(),view=deck.compact;shift.setAttribute('aria-pressed',String(view.shift));repeat.setAttribute('aria-pressed',String(view.repeat));node.dataset.shift=String(view.shift);
   buttons.forEach((b,i)=>{const cue=view.cues[i],empty=cue===null;b.dataset.empty=String(empty);b.textContent=(i+1)+(empty?' · Set':(view.shift?' · ×':'')+'\n'+time(cue));b.setAttribute('aria-label','Cue '+(i+1)+(empty?' empty; set at playhead':(view.shift?' delete at ':' jump to ')+time(cue)));const x=empty?-1:50+(cue-deck.position)/12*100;markers[i].hidden=empty||x<0||x>100;markers[i].style.left=x+'%';markers[i].title=empty?'':'Cue '+(i+1)+' at '+time(cue);});
  }};
 };
})();

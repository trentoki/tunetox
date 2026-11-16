// Numeric touch pads: compact vertical-drag values, not large relocated sliders.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.compact.createHeader=function(getState,refresh,announce){
  const root=document.getElementById('h1-tuning');
  const cells=[1,2,3,4].map(id=>{
   const cell=ui.element('div','h1-tuning-cell');cell.dataset.deck=id;
   const select=document.createElement('select');select.setAttribute('aria-label','Header deck selection');
   for(const n of [1,2,3,4]){const o=ui.element('option','', 'D'+n);o.value=n;select.append(o);}select.value=id;
   select.addEventListener('change',()=>{getState().editingDeckId=Number(select.value);refresh();});
   const title=ui.element('span','h1-header-deck','D'+id);cell.append(title,select);
   const controls=['tempo','pitch'].map(key=>{
    const min=key==='tempo'?90:-6,max=key==='tempo'?150:6,step=key==='tempo'?.5:.1;
    const pad=ui.element('div','h1-value-pad');pad.tabIndex=0;pad.setAttribute('role','slider');
    pad.dataset.control=key;pad.setAttribute('aria-valuemin',min);pad.setAttribute('aria-valuemax',max);
    const label=ui.element('span','',key==='tempo'?'Tempo':'Pitch'),value=ui.element('output');pad.append(label,value);cell.append(pad);
    let drag=null;
    function set(next){d.model.adjustMatchedControl(getState(),id,key,Math.round(Math.max(min,Math.min(max,next))/step)*step);announce('D'+id+' '+key+' preview; no time-stretch or audio');refresh();}
    pad.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,y:e.clientY,value:d.compact.deck(getState(),id)[key]};try{pad.setPointerCapture(e.pointerId);}catch(_){}});
    pad.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();set(drag.value+(drag.y-e.clientY)*(key==='tempo'?.25:.05));});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,()=>{drag=null;});
    pad.addEventListener('keydown',e=>{const delta={ArrowUp:step,ArrowRight:step,ArrowDown:-step,ArrowLeft:-step,PageUp:step*10,PageDown:-step*10}[e.key];if(delta!==undefined){e.preventDefault();set(d.compact.deck(getState(),id)[key]+delta);}else if(['Home','End'].includes(e.key)){e.preventDefault();set(e.key==='Home'?min:max);}});
    return {key,pad,value};
   });root.append(cell);return {id,cell,select,controls};
  });
  return {render(){for(const {id,cell,select,controls} of cells){
   const deck=d.compact.deck(getState(),id);cell.classList.toggle('is-selected',getState().editingDeckId===id);select.value=getState().editingDeckId;
   for(const {key,pad,value} of controls){const text=(key==='pitch'&&deck[key]>=0?'+':'')+deck[key].toFixed(1);value.value=text;pad.setAttribute('aria-valuenow',deck[key]);pad.setAttribute('aria-label',key+' for simulated deck '+id);pad.setAttribute('aria-valuetext',text+(key==='tempo'?' BPM':' semitones'));
    pad.title='D'+id+' '+key+': drag vertically or use arrow keys · simulated';}
  }}};
 };
})();

// Shared discrete choice: vertical drag, tap cycle, arrows/Home/End. No native menus.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.createVerticalChoice=function({label,values,getValue,change,format=String}){
  const node=ui.button('h52-choice','',label,event=>{if(event.detail===0&&!event.pointerType&&!pointer)step(1);});
  node.setAttribute('role','slider');node.setAttribute('aria-orientation','vertical');let pointer=null;
  function step(delta){const list=values(),index=list.indexOf(getValue());change(list[(index+delta+list.length)%list.length]);}
  node.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;e.preventDefault();e.stopPropagation();pointer={id:e.pointerId,y:e.clientY,index:values().indexOf(getValue()),slid:false};try{node.setPointerCapture(e.pointerId);}catch(_){}node.dataset.active='true';});
  node.addEventListener('pointermove',e=>{if(e.pointerId!==pointer?.id)return;e.preventDefault();e.stopPropagation();const delta=Math.trunc((pointer.y-e.clientY)/18);if(Math.abs(e.clientY-pointer.y)>10)pointer.slid=true;const list=values(),index=Math.max(0,Math.min(list.length-1,pointer.index+delta));if(list[index]!==getValue())change(list[index]);});
  node.addEventListener('pointerup',e=>{if(e.pointerId!==pointer?.id)return;e.preventDefault();e.stopPropagation();const tap=!pointer.slid;pointer=null;node.dataset.active='false';if(tap)step(1);});
  for(const type of ['pointercancel','lostpointercapture'])node.addEventListener(type,e=>{if(pointer?.id===e.pointerId){pointer=null;node.dataset.active='false';}});
  node.addEventListener('keydown',e=>{e.stopPropagation();const list=values();if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault();step(['ArrowUp','ArrowRight'].includes(e.key)?1:-1);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();change(e.key==='Home'?list[0]:list[list.length-1]);}});
  return {node,render(){const list=values(),value=getValue();node.textContent=format(value);node.setAttribute('aria-valuemin','1');node.setAttribute('aria-valuemax',list.length);node.setAttribute('aria-valuenow',list.indexOf(value)+1);node.setAttribute('aria-valuetext',format(value));}};
 };
})();

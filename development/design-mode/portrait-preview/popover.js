// One body-level portal keeps choices outside locked/clipped performance panels.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 let active=null;
 const panel=ui.element('div','h53-popover');panel.hidden=true;panel.id='h53-choice-popover';panel.setAttribute('role','listbox');
 // Deferred scripts run after body parsing. This remains UI-only session state.
 document.body.append(panel);
 function close(returnFocus=false){if(!active)return;const previous=active;active=null;panel.hidden=true;previous.anchor.setAttribute('aria-expanded','false');if(returnFocus&&previous.anchor.getClientRects().length)previous.anchor.focus({preventScroll:true});}
 function mark(){if(!active)return;panel.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active.index)));}
 function position(){if(!active)return;const r=active.anchor.getBoundingClientRect(),v=window.visualViewport;const bounds={left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};
  panel.style.maxHeight=Math.max(36,bounds.height-12)+'px';panel.style.left=Math.max(bounds.left+6,Math.min(bounds.left+bounds.width-158,r.left))+'px';
  const height=panel.getBoundingClientRect().height;const below=r.bottom+4;panel.style.top=Math.max(bounds.top+6,Math.min(bounds.top+bounds.height-height-6,below+height<=bounds.top+bounds.height-6?below:r.top-height-4))+'px';
 }
 function commit(){if(!active)return;const choice=active,value=choice.values[choice.index];close();choice.change(value);choice.anchor.focus({preventScroll:true});}
 function open(config,focus=false){close();const values=config.values();active={...config,values,index:Math.max(0,values.indexOf(config.getValue())),key:config.context()};panel.replaceChildren();panel.setAttribute('aria-label',typeof config.label==='function'?config.label():config.label);panel.style.setProperty('--accent',getComputedStyle(config.anchor).getPropertyValue('--accent')||'#62e8e0');
  values.forEach((value,index)=>{const b=ui.button('',config.format(value),'Choose '+config.format(value),()=>{if(active){active.index=index;commit();}});b.setAttribute('role','option');panel.append(b);});panel.hidden=false;config.anchor.setAttribute('aria-expanded','true');mark();position();if(focus)panel.children[active.index]?.focus();
 }
 function highlight(y){if(!active)return;const items=[...panel.children];const index=items.findIndex(b=>{const r=b.getBoundingClientRect();return y>=r.top&&y<r.bottom;});active.index=index>=0?index:y<items[0].getBoundingClientRect().top?0:items.length-1;mark();}
 panel.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();close(true);}else if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();active.index=e.key==='Home'?0:e.key==='End'?active.values.length-1:Math.max(0,Math.min(active.values.length-1,active.index+(e.key==='ArrowDown'?1:-1)));mark();panel.children[active.index].focus();}else if(['Enter',' '].includes(e.key)){e.preventDefault();commit();}else if(e.key==='Tab')close(true);});
 document.addEventListener('pointerdown',e=>{if(active&&!panel.contains(e.target)&&!active.anchor.contains(e.target))close();},true);
 document.addEventListener('focusin',e=>{if(active&&!panel.contains(e.target)&&!active.anchor.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();close(true);}});
 window.addEventListener('resize',()=>close());window.visualViewport?.addEventListener('resize',()=>close());window.addEventListener('blur',()=>close());
 d.h53CreatePopover=function({label,values,getValue,change,context=()=>'',format=String,tapCycles=false}){
  let pointer=null,timer=null;const currentLabel=()=>typeof label==='function'?label():label;
  const anchor=ui.button('h52-choice h53-choice','',currentLabel(),e=>{if(e.detail===0&&!e.pointerType){open(config,true);}});
  anchor.setAttribute('aria-haspopup','listbox');anchor.setAttribute('aria-controls',panel.id);anchor.setAttribute('aria-expanded','false');const config={anchor,label,values,getValue,change,context,format};
  function cancel(){clearTimeout(timer);timer=null;pointer=null;anchor.dataset.active='false';}
  anchor.addEventListener('pointerdown',e=>{if(e.button!==0||pointer)return;e.preventDefault();e.stopPropagation();pointer={id:e.pointerId,y:e.clientY,opened:false};anchor.dataset.active='true';try{anchor.setPointerCapture(e.pointerId);}catch(_){}timer=setTimeout(()=>{if(pointer){pointer.opened=true;open(config);}},220);});
  anchor.addEventListener('pointermove',e=>{if(e.pointerId!==pointer?.id)return;e.preventDefault();e.stopPropagation();if(!pointer.opened&&Math.abs(e.clientY-pointer.y)>8){clearTimeout(timer);pointer.opened=true;open(config);}if(pointer.opened)highlight(e.clientY);});
  anchor.addEventListener('pointerup',e=>{if(e.pointerId!==pointer?.id)return;e.preventDefault();e.stopPropagation();const held=pointer.opened;cancel();if(held)commit();else if(tapCycles){const list=values();change(list[(list.indexOf(getValue())+1)%list.length]);}else open(config);});
  for(const type of ['pointercancel','lostpointercapture'])anchor.addEventListener(type,e=>{if(pointer?.id===e.pointerId){cancel();close();}});
  anchor.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();open(config,true);}});
  return {node:anchor,render(){anchor.setAttribute('aria-label',currentLabel());anchor.textContent=format(getValue());if(active?.anchor===anchor){if(active.key!==context()||!anchor.getClientRects().length||getComputedStyle(anchor).visibility==='hidden'){cancel();close();}else position();}}};
 };
})();

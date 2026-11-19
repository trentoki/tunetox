// H5.2 retains the existing matching popover, without cue quantization controls.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,ui=d.components;
 h.createMatching=function(id,node,getDeck,actions){
  const label=ui.button('h1-deck-id h3-deck-id','D'+id,'Deck '+id+' matching settings',()=>{});
  const indicators=ui.element('span','h2-indicators');
  const entries=[['beatMatch','B','BeatMatch'],['tuneMatch','T','TuneMatch'],['handoff','H','Handoff']];
  const status=entries.map(([key,text,name])=>{const span=ui.element('span','',text);span.setAttribute('role','img');indicators.append(span);return {key,name,span};});label.append(indicators);
  const menu=ui.element('section','h2-menu');menu.id='h3-menu-'+id;menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Matching for deck '+id);
  label.setAttribute('aria-haspopup','dialog');label.setAttribute('aria-controls',menu.id);
  const toggles=entries.map(([key,,name])=>{const b=ui.button('',name,name+' on simulated deck '+id,()=>actions.toggle(id,key));menu.append(b);return {key,b};});
  function set(open){getDeck().compact.menuOpen=open;render();}
  label.addEventListener('click',event=>{actions.select(id);const open=!getDeck().compact.menuOpen;set(open);if(open&&event.detail===0)toggles[0].b.focus();});
  function outside(event){if(getDeck().compact.menuOpen&&!menu.contains(event.target)&&!label.contains(event.target))set(false);}
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside,true);
  node.addEventListener('keydown',event=>{if(event.key==='Escape'&&getDeck().compact.menuOpen){event.preventDefault();set(false);label.focus();}});
  function render(){const deck=getDeck();menu.hidden=!deck.compact.menuOpen;label.setAttribute('aria-expanded',String(deck.compact.menuOpen));
   for(const {key,b} of toggles)b.setAttribute('aria-pressed',String(deck[key]));
   for(const {key,name,span} of status){span.dataset.enabled=String(deck[key]);span.setAttribute('aria-label',name+' '+(deck[key]?'on':'off'));}
  }
  return {label,menu,render};
 };
})();

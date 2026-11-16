// H2 presentation adapters over frozen H1 state/controls and a tiny deck derivative.
// One state/component per deck, overview and stem group; no audio/persistence.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,ui=d.components;
 const baseState=h.createState,baseDeck=h.createDeck,baseTools=h.createDesignTools;
 h.parameters={...h.parameters,
  matching:{label:'Matching popover button height',min:40,max:56,step:2,value:44,unit:'px'},
  overviewHeight:{label:'Full-song overview height',min:24,max:96,step:2,value:44,unit:'px'},
  waveHeight:{label:'Main waveform height · manual override',min:80,max:600,step:2,value:280,unit:'px'},
  stemSection:{label:'Stem section height',min:144,max:320,step:4,value:176,unit:'px'},
  sectionGap:{label:'Overview / waveform / stems spacing',min:3,max:14,step:1,value:6,unit:'px'}
 };
 delete h.parameters.overview; // H2 uses one explicit overview height, not H1's share.
 h.createState=function(){const state=baseState();for(const deck of state.decks)deck.compact.menuOpen=false;return state;};
 h.setMatchingMenu=function(state,id,open){const deck=h.deck(state,id);if(!deck||typeof open!=='boolean')return false;deck.compact.menuOpen=open;return true;};
 h.createDeck=function(id,getState,actions){
  const card=baseDeck(id,getState,actions),node=card.node,getDeck=()=>h.deck(getState(),id);
  const label=node.querySelector('.h1-deck-id'),menu=node.querySelector('.h1-matching');
  menu.classList.add('h2-menu');menu.id='h2-matching-'+id;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Simulated matching for deck '+id);
  label.setAttribute('aria-haspopup','dialog');label.setAttribute('aria-controls',menu.id);
  const indicators=ui.element('span','h2-indicators');indicators.setAttribute('aria-label','Matching status');
  const features=[['beatMatch','B','BeatMatch'],['tuneMatch','T','TuneMatch'],['handoff','H','Handoff']].map(([key,text,name])=>{
   const status=ui.element('span','',text);status.dataset.feature=key;status.setAttribute('role','img');indicators.append(status);return {key,name,status};
  });label.after(indicators);
  const wave=node.querySelector('.h1-wave'),overview=node.querySelector('.h1-overview'),content=node.querySelector('.h1-content'),stems=node.querySelector('.h1-stems'),controls=node.querySelector('.h1-controls');
  overview.classList.add('h2-overview');node.insertBefore(overview,content);
  function renderMenu(){
   const deck=getDeck();menu.hidden=!deck.compact.menuOpen;label.setAttribute('aria-expanded',String(deck.compact.menuOpen));label.setAttribute('aria-label','Deck '+id+' matching settings');
   for(const {key,name,status} of features){status.dataset.enabled=String(deck[key]);status.setAttribute('aria-label',name+' '+(deck[key]?'on':'off'));status.title=name+' '+(deck[key]?'ON':'OFF');}
  }
  function setMenu(open){h.setMatchingMenu(getState(),id,open);renderMenu();}
  label.addEventListener('click',event=>{const open=!getDeck().compact.menuOpen;setMenu(open);if(open&&event.detail===0)menu.querySelector('button').focus();});
  const closeOutside=event=>{if(getDeck().compact.menuOpen&&!menu.contains(event.target)&&!label.contains(event.target))setMenu(false);};
  document.addEventListener('pointerdown',closeOutside,true);document.addEventListener('focusin',closeOutside,true);
  node.addEventListener('keydown',event=>{if(event.key==='Escape'&&getDeck().compact.menuOpen){event.preventDefault();event.stopPropagation();setMenu(false);label.focus();}});
  menu.addEventListener('focusout',event=>{if(event.relatedTarget&&!menu.contains(event.relatedTarget)&&event.relatedTarget!==label)setMenu(false);});
  return {node,render(){
   card.render();const deck=getDeck();
   // H1 mounts tablet stems in Waveform only. H2 keeps Waveform+Stems paired on
   // every device and moves that same DOM group to Controls when requested.
   const target=deck.compact.page==='performance'&&deck.compact.waveCue==='waveform'?wave:controls;
   if(stems.parentElement!==target)target.append(stems);
   wave.classList.toggle('has-stems',target===wave);
   const first=node.querySelector('.h1-page-nav [data-page=performance]');
   first.textContent=(deck.compact.waveCue==='waveform'?'Wave+Stems':'Cue')+' ⇄';
   first.setAttribute('aria-label',deck.compact.page==='performance'?'Switch to '+(deck.compact.waveCue==='waveform'?'Cue':'Waveform + Stems')+' on deck '+id:'Return to '+(deck.compact.waveCue==='waveform'?'Waveform + Stems':'Cue')+' on deck '+id);
   renderMenu();
  }};
 };
 h.createDesignTools=function(){
  const tools=baseTools(),root=document.getElementById('h1-layout-inputs'),app=document.querySelector('.h2-app');
  const choice=ui.element('label','h2-overview-choice'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='h2-controls-overview';
  choice.append(checkbox,document.createTextNode('Show full-song overview on Controls'));root.append(choice);tools.values.overviewControls=false;
  checkbox.addEventListener('change',()=>{app.classList.toggle('h2-overview-controls',checkbox.checked);tools.values.overviewControls=checkbox.checked;});
  const note=ui.element('p','h2-layout-note','Waveform fills available height by default. Moving its height slider enables a manual height; Reset restores automatic fill. Stem height respects the minimum fader size.');root.append(note);
  const waveInput=root.querySelector('[data-parameter=waveHeight]');
  waveInput.addEventListener('input',()=>app.classList.add('h2-wave-fixed'));
  function reflectAutoHeight(){
   if(app.classList.contains('h2-wave-fixed'))return;
   const zoom=[...document.querySelectorAll('.h1-zoom')].find(node=>node.getBoundingClientRect().height>0);
   if(!zoom)return;const height=Math.max(80,Math.min(600,Math.round(zoom.getBoundingClientRect().height/2)*2));
   waveInput.value=height;waveInput.previousElementSibling.value=height+'px';waveInput.title='Automatic fill; move slider to use a manual waveform height';tools.values.waveHeight=height;
  }
  root.addEventListener('input',()=>requestAnimationFrame(reflectAutoHeight));
  document.getElementById('h1-tools-open').addEventListener('click',()=>requestAnimationFrame(reflectAutoHeight));
  document.getElementById('h1-layout-reset').addEventListener('click',()=>{app.classList.remove('h2-wave-fixed','h2-overview-controls');checkbox.checked=false;tools.values.overviewControls=false;requestAnimationFrame(reflectAutoHeight);});
  window.addEventListener('resize',()=>requestAnimationFrame(reflectAutoHeight));
  requestAnimationFrame(reflectAutoHeight);return tools;
 };
})();

// Phone-only two-deck view. Overview surfaces are intentionally read-only.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components,h=d.compact;
 d.h5CreateTransition=function(id,getState,actions){
  const node=ui.element('section','h52-transition'),overviews=ui.element('div','h52-transition-overviews'),mixers=ui.element('div','h52-transition-mixers');
  const views=[0,1].map(side=>{
   const getDeck=()=>h.deck(getState(),side?h.deck(getState(),id).transitionPartner:id);
   const overview=ui.element('section','h52-transition-overview');
   const header=side?d.createVerticalChoice({label:'Transition partner deck',values:()=>[1,2,3,4].filter(n=>n!==id),getValue:()=>getDeck().id,change:n=>actions.partner(id,n),format:n=>'D'+n+' · Partner'}):null;
   const label=header?.node||ui.element('strong','h52-overview-label','D'+id),songTitle=ui.element('span','h52-overview-song'),visual=ui.element('div','h52-overview-wave'),marker=ui.element('span','h52-overview-marker');visual.append(marker);overview.append(label,songTitle,visual);overviews.append(overview);let shown=null;
   const performance=d.createPerformanceControls({scope:'h52-mix-'+id+'-'+side,getDeck,actions,id});
   const main=performance.node.querySelector('.performance-transport .mix-control'),input=main.querySelector('input');
   const filter=performance.node.querySelector('[data-control=filter]'),high=performance.node.querySelector('[data-control=high]'),mid=performance.node.querySelector('[data-control=mid]'),low=performance.node.querySelector('[data-control=low]');
   const effect=performance.node.querySelector('.effect-control'),type=effect.querySelector('.h52-fx-type'),amount=effect.querySelector('.performance-knob');
   const fader=d.h52AttachMain(input,value=>actions.level(getDeck().id,null,value));
   const strip=ui.element('section','h52-mixer-strip'),mainColumn=ui.element('div','h52-main-column'),eqColumn=ui.element('div','h52-eq-column'),fxColumn=ui.element('div','h52-filter-fx-column');
   mainColumn.append(main);eqColumn.append(high,mid,low);fxColumn.append(filter,type,amount);strip.append(mainColumn,eqColumn,fxColumn);mixers.append(strip);
   return {getDeck,header,label,songTitle,visual,marker,overview,strip,performance,fader,input,render(){
    const deck=getDeck(),song=d.model.findSong(deck.songId);overview.dataset.deck=deck.id;strip.dataset.deck=deck.id;strip.setAttribute('aria-label','Mix controls for deck '+deck.id);
    if(shown!==deck.id){visual.prepend(ui.waveform(deck.id));visual.querySelectorAll('svg').forEach((svg,i)=>{if(i)svg.remove();});shown=deck.id;}
    if(header)header.render();songTitle.textContent=song?.title||'No song';songTitle.title=song?song.title+' — '+song.artist:'No song';
    marker.style.left=d.performanceProgress(deck).fraction*100+'%';performance.render();fader.render();input.setAttribute('aria-label','Main volume deck '+deck.id);input.setAttribute('aria-orientation','vertical');
   }};
  });
  node.append(overviews,mixers);return {node,render(){views.forEach(view=>view.render());}};
 };
})();

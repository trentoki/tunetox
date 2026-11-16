// Place the unchanged H1 tuning controls inside their deck's full workspace.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,ui=d.components,createHeader=h.createHeader;
 h.createHeader=function(getState,refresh,announce){
  const header=createHeader(getState,refresh,announce),root=document.querySelector('.h3-app');
  for(const cell of document.querySelectorAll('.h1-tuning-cell'))document.querySelector('.h3-deck[data-deck="'+cell.dataset.deck+'"] .h3-tuning-slot').append(cell);
  const phone=ui.element('nav','h3-phone-decks');phone.setAttribute('aria-label','Select one of four simulated decks');
  const buttons=[1,2,3,4].map(id=>{const b=ui.button('','Deck '+id,'Show simulated deck '+id,()=>{getState().editingDeckId=id;refresh();});b.dataset.deck=id;phone.append(b);return {id,b};});
  document.querySelector('.h1-header').append(phone);
  return {render(){header.render();root.dataset.selectedDeck=getState().editingDeckId;for(const {id,b} of buttons)b.setAttribute('aria-pressed',String(getState().editingDeckId===id));}};
 };
})();

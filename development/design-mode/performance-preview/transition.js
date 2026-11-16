// Two views onto existing deck values: no copied deck or effects state.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.h5CreateTransition=function(id,getState,actions){
  const node=ui.element('section','h5-transition'),toolbar=ui.element('div','h5-transition-partners'),strips=ui.element('div','h5-transition-strips');
  const partnerButtons=[1,2,3,4].filter(n=>n!==id).map(n=>{const b=ui.button('','D'+n,'Mix with deck '+n,()=>actions.partner(id,n));toolbar.append(b);return {n,b};});
  const views=[0,1].map(side=>{
   const getDeck=()=>d.compact.deck(getState(),side?d.compact.deck(getState(),id).transitionPartner:id);
   const wrapper=ui.element('div','h5-transition-strip'),label=ui.element('strong');
   const performance=d.createPerformanceControls({scope:'h5-mix-'+id+'-'+side,getDeck,actions,id});
   const strip=performance.node.querySelector('.vertical-mixer-strip'),transport=strip.querySelector('.performance-transport'),main=transport.querySelector('.mix-control'),eq=strip.querySelector('.performance-eq');
   transport.remove();strip.querySelector('.performance-middle').remove();strip.replaceChildren(main,...[...eq.children].reverse());
   const effects=performance.node.querySelector('.performance-effects');[...effects.children].slice(1).forEach(n=>n.remove());
   wrapper.append(label,performance.node);strips.append(wrapper);return {wrapper,label,performance,getDeck};
  });
  const back=ui.button('h5-transition-back','Controls','Return to Controls',()=>actions.page(id,'controls'));node.append(toolbar,strips,back);
  return {node,render(){const deck=d.compact.deck(getState(),id);partnerButtons.forEach(({n,b})=>b.setAttribute('aria-pressed',String(deck.transitionPartner===n)));views.forEach(view=>{const target=view.getDeck();view.wrapper.dataset.deck=target.id;view.label.textContent='D'+target.id;view.performance.render();view.wrapper.querySelector('input[type=range]').setAttribute('aria-orientation',d.isPhone()?'vertical':'horizontal');});}};
 };
})();

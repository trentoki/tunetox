// Extend the frozen H3 preview; native state and musical algorithms are not imported.
(() => {
 const h=globalThis.TuneToxDesign.compact,createH3State=h.createState;
 // Clone parameter metadata so this page owns its temporary layout adjustments.
 h.parameters=Object.fromEntries(Object.entries(h.parameters).map(([key,p])=>[key,{...p}]));
 const defaults={selectorWidth:156,matching:50,transportGap:6,overviewHeight:46,centralHeight:360,stemSection:244,fader:36,cuePad:44};
 for(const [key,value] of Object.entries(defaults))h.parameters[key].value=value;
 h.createState=function(){const state=createH3State();for(const deck of state.decks)deck.queuedSongId=null;return state;};
})();

// Reuse the existing knobs/state; replace only effect-type presentation.
(() => {
 const d=globalThis.TuneToxDesign,createEffects=d.createEffectsRow;
 // Assignment is direct slide/tap now; do not install the old native-select menu.
 d.attachEffectAssignment=()=>({close(){}});
 d.createEffectsRow=function(getDeck,actions,indices=[0,1,2]){
  const base=createEffects(getDeck,actions,indices);
  const choices=[...base.node.querySelectorAll('select')].map((select,i)=>{
   const index=indices[i],options=[...select.options].map(option=>option.value);
   const choice=d.createVerticalChoice({label:'Effect '+(index+1)+' type',values:()=>options,getValue:()=>getDeck().performance.effects[index].assignment,change:value=>actions.performance(getDeck().id,'effectAssignment',value,index)});
   choice.node.classList.add('h52-fx-type');select.replaceWith(choice.node);return choice;
  });
  return {node:base.node,render(){base.render();choices.forEach(choice=>choice.render());}};
 };
 // New Transition provides its own explicit endpoint-correct Main, not a second handler.
 d.attachVerticalFader=()=>{};
})();

// Keep H5.2 effect amounts and knob behavior; change only the type selector.
(() => {
 const d=globalThis.TuneToxDesign,createH52=d.createEffectsRow;
 d.createEffectsRow=function(getDeck,actions,indices=[0,1,2]){
  const base=createH52(getDeck,actions,indices),effects=['Echo','Reverb','Delay','Chorus','Flanger','None'];
  const choices=[...base.node.querySelectorAll('.h52-fx-type')].map((old,i)=>{
   const index=indices[i];const choice=d.h53CreatePopover({label:()=> 'Deck '+getDeck().id+' · Effect '+(index+1)+' type',values:()=>effects,getValue:()=>getDeck().performance.effects[index].assignment,change:value=>actions.performance(getDeck().id,'effectAssignment',value,index),context:()=>getDeck().id,format:String,tapCycles:true,holdOnly:true});
   choice.node.classList.add('h52-fx-type');old.replaceWith(choice.node);return choice;
  });
  return {node:base.node,render(){base.render();choices.forEach(choice=>choice.render());}};
 };
})();

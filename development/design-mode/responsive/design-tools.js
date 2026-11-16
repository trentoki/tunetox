// Two independent in-memory presentation presets. Rotation never modifies a deck.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.compact.createDesignTools=function(){
  const parameters=d.compact.parameters;
  const defaults=Object.fromEntries(Object.entries(parameters).map(([key,p])=>[key,p.value]));
  const presets={portrait:{...defaults,selectorWidth:132,matching:44,transportGap:5,overviewHeight:40,centralHeight:168,stemSection:144,fader:36,cuePad:36},
   landscape:{...defaults,selectorWidth:156,matching:50,transportGap:6,overviewHeight:46,centralHeight:360,stemSection:244,fader:36,cuePad:44}};
  const values={};const saved={portrait:{...presets.portrait},landscape:{...presets.landscape}};
  const dialog=document.getElementById('h1-tools'),root=document.getElementById('h1-layout-inputs');
  const description=dialog.querySelector('p');let orientation;
  const inputs=Object.entries(parameters).map(([key,p])=>{
   const label=ui.element('label','h1-layout-parameter',p.label),out=ui.element('output'),input=ui.element('input');
   input.type='range';input.min=p.min;input.max=p.max;input.step=p.step;input.dataset.parameter=key;input.setAttribute('aria-label',p.label);
   input.addEventListener('input',()=>{saved[orientation][key]=input.valueAsNumber;apply();});label.append(out,input);root.append(label);return {key,p,input,out};
  });
  function apply(){
   Object.assign(values,saved[orientation]);
   for(const {key,p,input,out} of inputs){input.value=values[key];out.value=values[key]+p.unit;document.documentElement.style.setProperty('--h1-'+key,values[key]+p.unit);}
   description.textContent='Editing '+orientation+' only · session preview; rotation preserves the other preset.';
   document.getElementById('h1-layout-reset').textContent='Reset '+orientation+' to H4 defaults';
   document.documentElement.dataset.h4Orientation=orientation;
  }
  function rotate(){const next=innerWidth>innerHeight?'landscape':'portrait';if(next!==orientation){orientation=next;apply();}}
  function reset(){saved[orientation]={...presets[orientation]};apply();}
  document.getElementById('h1-tools-open').addEventListener('click',()=>dialog.showModal());
  document.getElementById('h1-tools-close').addEventListener('click',()=>dialog.close());
  document.getElementById('h1-layout-reset').addEventListener('click',reset);
  window.addEventListener('resize',rotate);rotate();
  return {values,reset,getPresets:()=>JSON.parse(JSON.stringify(saved))};
 };
})();

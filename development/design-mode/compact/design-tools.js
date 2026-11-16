// CSS variables only; tuning/reset never reconstructs deck state or controls.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.compact.createDesignTools=function(){
  const dialog=document.getElementById('h1-tools'),root=document.getElementById('h1-layout-inputs');
  const values={};const inputs=Object.entries(d.compact.parameters).map(([key,p])=>{
   const label=ui.element('label','h1-layout-parameter',p.label),value=ui.element('output'),input=document.createElement('input');
   input.type='range';input.min=p.min;input.max=p.max;input.step=p.step;input.value=p.value;input.dataset.parameter=key;input.setAttribute('aria-label',p.label);
   function apply(){values[key]=input.valueAsNumber;document.documentElement.style.setProperty('--h1-'+key,input.value+p.unit);value.value=input.value+p.unit;}
   input.addEventListener('input',apply);label.append(value,input);root.append(label);apply();return {key,p,input,apply};
  });
  function reset(){inputs.forEach(({p,input,apply})=>{input.value=p.value;apply();});}
  document.getElementById('h1-tools-open').addEventListener('click',()=>dialog.showModal());
  document.getElementById('h1-tools-close').addEventListener('click',()=>dialog.close());
  document.getElementById('h1-layout-reset').addEventListener('click',reset);
  return {reset,values};
 };
})();

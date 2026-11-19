// Small local SVGs: currentColor follows each deck; no emoji/font dependencies.
(() => {
 const d=globalThis.TuneToxDesign;
 const paths={back:'M15 5 8 12l7 7M8 12h13',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',swap:'M4 7h15l-4-4m4 4-4 4M20 17H5l4-4m-4 4 4 4'};
 d.h5Icon=function(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('h5-icon');
  const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.back);p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.8');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.append(p);return svg;};
})();

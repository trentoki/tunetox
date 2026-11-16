// Visible viewport ownership for the isolated preview; no audio or musical state.
(() => {
  const design = globalThis.TuneToxDesign, root = document.documentElement;
  let pending = null, metrics = null;
  function refresh() {
    const viewport = window.visualViewport;
    // Preserve accessibility zoom instead of continuously resizing the instrument under it.
    const useVisual = viewport && Math.abs(viewport.scale - 1) < .01;
    const width = useVisual ? viewport.width : window.innerWidth;
    const height = useVisual ? viewport.height : window.innerHeight;
    const top = useVisual ? viewport.offsetTop : 0, left = useVisual ? viewport.offsetLeft : 0;
    if (!(width > 0 && height > 0)) return;
    metrics = { width, height, top, left, visual: !!useVisual };
    root.style.setProperty('--visible-width', width + 'px');
    root.style.setProperty('--visible-height', height + 'px');
    root.style.setProperty('--visible-top', top + 'px');
    root.style.setProperty('--visible-left', left + 'px');
    root.dataset.visibleSize = height <= 620 ? 'tiny' : height <= 740 ? 'compact' : 'regular';
  }
  function schedule() {
    if (pending !== null) return;
    pending = requestAnimationFrame(() => { pending = null; refresh(); });
  }
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  refresh();
  design.viewport = { refresh, getMetrics: () => metrics && { ...metrics } };
})();

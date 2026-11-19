// Browser gestures are separate from simulated musical actions. Single-finger
// library scrolling and editable fields retain their native behavior.
(() => {
 const editable = target => target instanceof Element && !!target.closest('input:not([type=range]),textarea,[contenteditable=true]');
 const surface = target => target instanceof Element && (target===document.body || target===document.documentElement || !!target.closest('.h531-app,.h53-popover,#h1-tools'));
 for (const type of ['gesturestart','gesturechange','gestureend']) {
  document.addEventListener(type, event => {
   if (surface(event.target) && !editable(event.target)) event.preventDefault();
  }, {passive:false});
 }
 for (const type of ['touchstart','touchmove']) {
  document.addEventListener(type, event => {
   if (event.touches.length > 1 && surface(event.target) && !editable(event.target)) event.preventDefault();
  }, {passive:false});
 }
 for (const type of ['selectstart','contextmenu','dblclick']) {
  document.addEventListener(type, event => {
   if (surface(event.target) && !editable(event.target)) event.preventDefault();
  });
 }
})();

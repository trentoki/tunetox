// Geometry + scroll-boundary checks. Mocked visualViewport is not native Safari validation.
async function runViewportChecks(frame, check) {
  const win = frame.contentWindow, doc = win.document, root = doc.documentElement;
  const pause = () => new Promise(resolve => setTimeout(resolve, 100));
  const settle = async () => { await pause(); win.TuneToxDesign.viewport.refresh(); };
  const app = doc.querySelector('.design-app');
  const limits = [];
  function visible(node) { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; }
  function outside(nodes) {
    const box = app.getBoundingClientRect(), style = win.getComputedStyle(app), inset = {
      left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight),
      top: box.top + parseFloat(style.paddingTop), bottom: box.bottom - parseFloat(style.paddingBottom)
    };
    return nodes.filter(visible).filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < inset.left - 2 || rect.right > inset.right + 2 || rect.top < inset.top - 2 || rect.bottom > inset.bottom + 2;
    });
  }
  function essential() {
    return [...doc.querySelectorAll('.design-header, .phone-controls-footer, .phone-tabs, .phone-deck-selectors, .stem-controls input, .performance-controls input[type="range"], .knob-dial, .effect-control select, .performance-loop button, .transition-partner, .transition-fx-target, .sampler-pad, .sampler-toolbar select, .sampler-toolbar input, .sampler-close')];
  }
  function lockCheck(label) {
    const before = doc.querySelector('.design-header').getBoundingClientRect();
    win.scrollTo(120, 200); root.scrollTop = 100; doc.body.scrollTop = 100;
    const after = doc.querySelector('.design-header').getBoundingClientRect();
    check(win.scrollX === 0 && win.scrollY === 0 && root.scrollTop === 0 && doc.body.scrollTop === 0, 'document cannot scroll ' + label);
    check(before.top === after.top && before.left === after.left, 'header stationary after scroll attempts ' + label);
    check(win.getComputedStyle(doc.body).touchAction !== 'none', 'no blanket touch restriction ' + label);
  }
  for (const [width,height] of [[320,568],[375,667],[390,844],[393,852],[430,932],[1024,768],[1194,834],[1366,1024]]) {
    frame.width = width; frame.height = height; await settle(); doc.querySelector('#reset-demo').click();
    check(Math.abs(app.getBoundingClientRect().height - height) < 1 && Math.abs(app.getBoundingClientRect().width - width) < 1, 'shell follows viewport ' + width);
    const phone = width < height && width <= 600;
    for (const mode of ['waveform','controls','transition','sampler']) {
      if (phone) {
        doc.querySelector('.phone-tab[data-tab="' + (mode === 'transition' ? 'controls' : mode) + '"]').click();
        if (mode === 'transition') doc.querySelector('.transition-controls-option').click();
      } else {
        if (mode === 'transition') continue;
        if (mode === 'sampler') doc.querySelector('.design-deck .stem-sampler-trigger').click();
        else doc.querySelector('.design-deck [data-mode="' + mode + '"]').click();
      }
      lockCheck(width + ' ' + mode);
      const unreachable = outside(essential());
      check(unreachable.length === 0, 'essential performance controls within viewport ' + width + ' ' + mode + ': ' + unreachable.map(n => n.className || n.id).join(','));
      check(![...doc.querySelectorAll('.slice-controls-overlay,.transition-card,.sampler-performance')].filter(visible).some(n => ['auto','scroll'].includes(win.getComputedStyle(n).overflowY)), 'only content regions permit scrolling ' + mode);
      if (mode === 'sampler') {
        const toolbar = doc.querySelector('.sampler-toolbar').getBoundingClientRect(), pads = doc.querySelector('.sampler-pads').getBoundingClientRect();
        check([...doc.querySelectorAll('.sampler-toolbar input')].every(n => n.getBoundingClientRect().bottom <= toolbar.bottom + 1) && pads.top >= toolbar.bottom - 1, 'sampler ranges do not overlap pads ' + width);
      }
      if (mode === 'controls') {
        const dial = [...doc.querySelectorAll('.knob-dial')].find(visible), topBefore = app.getBoundingClientRect().top;
        dial.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerId: 980, button: 0, clientY: 200 }));
        dial.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 980, clientY: 170 }));
        dial.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, pointerId: 980 }));
        check(win.getComputedStyle(dial).touchAction === 'none' && win.scrollY === 0 && app.getBoundingClientRect().top === topBefore, 'knob gesture cannot pan document ' + width);
      }
      if (mode === 'waveform') {
        const zones = [...doc.querySelectorAll('.waveform-navigate,.waveform-jog,input[type="range"]')].filter(visible);
        check(zones.every(n => win.getComputedStyle(n).touchAction === 'none'), 'fader/jog/waveform gestures are pan-isolated ' + width);
      }
    }
    if (phone) {
      doc.querySelector('.sampler-close').click(); doc.querySelector('.phone-tab[data-tab="library"]').click();
      const list = [...doc.querySelectorAll('.column-library .panel-list')].find(visible);
      const nodes = Array.from({ length: 8 }, () => { const node = doc.createElement('div'); node.style.height = '100px'; list.append(node); return node; });
      const old = list.scrollTop, headerTop = doc.querySelector('.design-header').getBoundingClientRect().top;
      list.scrollTop = 100;
      check(list.scrollTop > 0 && win.getComputedStyle(list).touchAction === 'pan-y' && win.scrollY === 0 && doc.querySelector('.design-header').getBoundingClientRect().top === headerTop, 'library scroll remains independent ' + width);
      nodes.forEach(n => n.remove()); list.scrollTop = old;
    }
  }
  // Model Safari chrome/keyboard viewport geometry without changing the layout viewport.
  frame.width = 390; frame.height = 844; await settle(); doc.querySelector('#reset-demo').click();
  const descriptor = Object.getOwnPropertyDescriptor(win, 'visualViewport');
  const original = win.visualViewport;
  try {
    const mock = { width: 390, height: 650, offsetTop: 12, offsetLeft: 0, scale: 1 };
    Object.defineProperty(win, 'visualViewport', { configurable: true, value: mock });
    win.TuneToxDesign.viewport.refresh();
    check(app.getBoundingClientRect().height === 650 && app.getBoundingClientRect().top === 12, 'visual viewport height and offset applied');
    doc.querySelector('.phone-tab[data-tab="controls"]').click();
    check(outside(essential()).length === 0, 'chrome-height contraction keeps Controls reachable');
    const decksBefore = JSON.stringify(win.TuneToxDesign.preview.getSnapshot().decks);
    mock.height = 568; mock.offsetTop = 0; win.TuneToxDesign.viewport.refresh();
    check(outside(essential()).length === 0, 'short visual viewport keeps Controls reachable');
    mock.height = 844; root.style.setProperty('--safe-top','20px'); root.style.setProperty('--safe-bottom','34px'); win.TuneToxDesign.viewport.refresh();
    check(outside(essential()).length === 0 && parseFloat(win.getComputedStyle(app).paddingTop) === 20 && parseFloat(win.getComputedStyle(app).paddingBottom) === 34, 'safe-area padding applied without hiding Controls');
    mock.height = 568; root.style.setProperty('--safe-top','44px'); win.TuneToxDesign.viewport.refresh();
    for (const mode of ['waveform','controls','transition','sampler']) {
      doc.querySelector('.phone-tab[data-tab="' + (mode === 'transition' ? 'controls' : mode) + '"]').click();
      if (mode === 'transition') doc.querySelector('.transition-controls-option').click();
      const unreachable = outside(essential());
      if (unreachable.length) limits.push({ viewport: '390×568', safeArea: '44 top + 34 bottom', mode, count: unreachable.length });
    }
    check(JSON.stringify(win.TuneToxDesign.preview.getSnapshot().decks) === decksBefore, 'viewport and safe-area changes preserve all deck state');
    mock.scale = 2; win.TuneToxDesign.viewport.refresh();
    check(!win.TuneToxDesign.viewport.getMetrics().visual, 'accessibility zoom is not counter-resized');
  } finally {
    if (descriptor) Object.defineProperty(win, 'visualViewport', descriptor); else Object.defineProperty(win, 'visualViewport', { configurable: true, value: original });
    root.style.removeProperty('--safe-top'); root.style.removeProperty('--safe-bottom'); win.TuneToxDesign.viewport.refresh();
  }
  frame.dataset.viewportLimits = JSON.stringify(limits);
  frame.width = 1194; frame.height = 834; await settle(); doc.querySelector('#reset-demo').click();
}

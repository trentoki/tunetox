// Visual-only navigation over the four already-mounted shared decks. No musical
// state, deck constructors or transport actions belong here. CSS owns visibility.
export function installDeckSelector(deckContainer) {
  const doc = deckContainer.ownerDocument;
  const win = doc.defaultView;
  const decks = [...deckContainer.querySelectorAll('.deck')];
  const phone = win.matchMedia('(max-width: 600px), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)');
  const shell = doc.createElement('section');
  shell.className = 'iphone-navigation';
  shell.setAttribute('aria-label', 'Deck navigation');
  const tabs = doc.createElement('div');
  tabs.className = 'iphone-deck-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Displayed deck');
  let selected = 0;
  const buttons = decks.map((deck, index) => {
    const tab = doc.createElement('button');
    tab.type = 'button';
    tab.id = 'iphone-deck-tab-' + (index + 1);
    tab.textContent = String(index + 1);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-label', 'Show Deck ' + (index + 1));
    deck.id = 'mixer-deck-' + (index + 1);
    tab.setAttribute('aria-controls', deck.id);
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 :
        event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : null;
      if (next === null) return;
      event.preventDefault();
      select(next);
      buttons[next].focus();
    });
    tabs.append(tab);
    return tab;
  });
  function select(index) {
    selected = index;
    decks.forEach((deck, position) => {
      deck.dataset.iphoneSelected = String(position === selected);
      // Hidden phone decks are also absent from keyboard/accessibility navigation.
      // The nodes and their shared Behavior/Audio objects stay mounted and live.
      deck.inert = phone.matches && position !== selected;
      if (phone.matches) {
        deck.setAttribute('role', 'tabpanel');
        deck.setAttribute('aria-labelledby', buttons[position].id);
      } else {
        deck.removeAttribute('role');
        deck.removeAttribute('aria-labelledby');
      }
      buttons[position].setAttribute('aria-selected', String(position === selected));
      buttons[position].tabIndex = position === selected ? 0 : -1;
    });
  }
  const transition = doc.createElement('div');
  transition.className = 'iphone-transition';
  transition.id = 'iphone-transition';
  transition.hidden = true;
  transition.setAttribute('role', 'region');
  transition.setAttribute('aria-label', 'Transition area; controls not yet designed');
  const handle = doc.createElement('button');
  handle.type = 'button';
  handle.className = 'iphone-transition-handle';
  handle.setAttribute('aria-controls', transition.id);
  let expanded = false, gesture = null, suppressClick = false;
  function expand(value) {
    expanded = value;
    transition.hidden = !value;
    handle.setAttribute('aria-expanded', String(value));
    handle.textContent = value ? 'Transition ▴' : 'Transition ▾';
    handle.setAttribute('aria-label', (value ? 'Collapse' : 'Expand') + ' transition area');
  }
  handle.addEventListener('click', event => {
    if (suppressClick && event.detail > 0) { suppressClick = false; return; }
    expand(!expanded);
  });
  // Swipes start only on the separate handle, never on a deck tab or control.
  handle.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || gesture) return;
    suppressClick = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (Math.abs(dy) >= 24 && Math.abs(dy) > Math.abs(dx)) {
      expand(dy > 0);
      suppressClick = true;
      event.preventDefault();
    }
    gesture = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  });
  const cancel = () => {
    const previous = gesture;
    gesture = null;
    suppressClick = false;
    if (previous && handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id);
  };
  handle.addEventListener('pointercancel', cancel);
  handle.addEventListener('lostpointercapture', () => { gesture = null; });
  win.addEventListener('blur', cancel);
  win.addEventListener('resize', cancel);
  phone.addEventListener('change', () => { cancel(); select(selected); });
  shell.append(tabs, transition, handle);
  deckContainer.before(shell);
  expand(false);
  select(0);
}

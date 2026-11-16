// Presentation-only landscape experiment. No deck/library DOM moves or resets.
(() => {
  const design = globalThis.TuneToxDesign, { element, button } = design.components;
  design.createLayoutPreview = function (getState, refresh) {
    const app = document.querySelector('.design-app');
    const toolbar = element('div', 'layout-preview-controls');
    toolbar.setAttribute('aria-label', 'Landscape layout experiment');
    function select(labelText, id, choices, change) {
      const label = element('label', '', labelText + ' '), input = element('select'); input.id = id;
      choices.forEach(([value, text]) => { const option = element('option', '', text); option.value = value; input.append(option); });
      input.addEventListener('change', () => { change(input.value); refresh(); }); label.append(input); toolbar.append(label); return input;
    }
    const layout = select('Library', 'preview-layout', [['sidebar', 'Sidebar'], ['full', 'Full-screen']], value => { getState().layout = value; });
    const arrangement = select('Decks', 'preview-arrangement', [['quadrants', 'Quadrants'], ['slices', 'Vertical Slices']], value => { getState().arrangement = value; });
    const side = select('Drawer', 'preview-drawer-side', [['left', 'Left'], ['right', 'Right']], value => { getState().drawerSide = value; });
    const toggle = button('quiet-button', 'Open library', 'Open library drawer', () => { getState().drawerOpen = !getState().drawerOpen; refresh(); });
    toggle.id = 'preview-drawer-toggle'; toggle.setAttribute('aria-controls', 'preview-library');
    document.querySelector('.library').id = 'preview-library';
    toolbar.append(toggle); document.querySelector('.design-header').insertBefore(toolbar, document.querySelector('.mode-badge'));
    // A second compact header row replaces the Slices-only global strip.
    // Number controls retain the existing per-deck action; modular ranges use preview-only matching.
    const tuning = element('div', 'slice-header-tuning');
    const deckLabel = element('label', '', 'Adjust deck '), deckSelect = element('select');
    deckSelect.id = 'slice-edit-deck';
    [1, 2, 3, 4].forEach(id => { const option = element('option', '', 'Deck ' + id); option.value = id; deckSelect.append(option); });
    deckSelect.addEventListener('change', () => { getState().editingDeckId = Number(deckSelect.value); refresh(); });
    deckLabel.append(deckSelect); tuning.append(deckLabel);
    const controlDeckId = state => design.isPhone() ? state.phone.selectedDeckId : state.editingDeckId;
    const tuningInputs = ['tempo', 'pitch'].map(key => {
      const label = element('label', 'header-deck-control', key === 'tempo' ? 'Tempo ' : 'Pitch '), input = element('input');
      const output = element('output', 'header-deck-value'); output.setAttribute('for', 'slice-' + key + ' slice-range-' + key);
      input.type = 'number'; input.id = 'slice-' + key;
      input.min = key === 'tempo' ? 90 : -6; input.max = key === 'tempo' ? 150 : 6; input.step = key === 'tempo' ? .5 : .1;
      const range = element('input', 'slice-range'); range.type = 'range'; range.id = 'slice-range-' + key;
      range.min = input.min; range.max = input.max; range.step = input.step;
      function update(control, matched) {
        const state = getState();
        if (matched) design.model.adjustMatchedControl(state, controlDeckId(state), key, control.valueAsNumber);
        else design.model.setDeckControl(state, controlDeckId(state), key, control.valueAsNumber);
        refresh(); control.value = getState().decks.find(deck => deck.id === controlDeckId(getState()))[key];
      }
      input.addEventListener('change', () => update(input, false));
      range.addEventListener('input', () => update(range, true));
      range.addEventListener('change', () => update(range, true));
      label.append(output, input, range); tuning.append(label); return { key, input, output, range };
    });
    tuning.append(button('quiet-button', 'Reset demo', 'Reset simulated session', () => document.getElementById('reset-demo').click()));
    document.querySelector('.design-header').append(tuning);
    // Escape closes only the layout drawer; context view handles its own Escape.
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !getState().context && getState().drawerOpen) { getState().drawerOpen = false; refresh(); }
    });
    return { render() {
      const state = getState();
      const editingDeck = state.decks.find(deck => deck.id === controlDeckId(state));
      deckSelect.value = editingDeck.id;
      tuningInputs.forEach(({ key, input, output, range }) => {
        output.value = editingDeck[key].toFixed(1);
        input.setAttribute('aria-label', 'Simulated ' + key + ' for deck ' + editingDeck.id);
        range.setAttribute('aria-label', 'Simulated matched ' + key + ' for deck ' + editingDeck.id);
        range.value = editingDeck[key];
        if (input.type === 'range' || document.activeElement !== input) input.value = editingDeck[key];
      });
      app.dataset.layout = state.layout;
      app.dataset.arrangement = state.arrangement;
      arrangement.value = state.arrangement;
      app.dataset.drawer = state.drawerOpen ? state.drawerSide : 'closed';
      layout.value = state.layout; side.value = state.drawerSide;
      side.hidden = toggle.hidden = state.layout !== 'full' || state.arrangement === 'slices';
      // Hide the side label as well, keeping the header compact.
      side.parentElement.hidden = state.layout !== 'full' || state.arrangement === 'slices';
      toggle.textContent = state.drawerOpen ? 'Close library' : 'Open library';
      toggle.setAttribute('aria-expanded', String(state.drawerOpen));
    } };
  };
})();

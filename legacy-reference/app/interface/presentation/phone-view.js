// Phone presentation reuses mounted deck/library components and shared deck actions.
(() => {
  const design = globalThis.TuneToxDesign, ui = design.components;
  design.isPhone = () => matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  design.createPhoneView = function (getState, refresh, actions) {
    const app = document.querySelector('.design-app'), mixer = document.querySelector('.mixer');
    const tabs = ui.element('nav', 'phone-tabs'); tabs.setAttribute('aria-label', 'Selected deck views');
    function showTab(name) {
      const state = getState(), id = state.phone.selectedDeckId;
      if (name === 'sampler') {
        if (state.phone.mode === 'sampler') return;
        state.phone.samplerReturnMode = state.phone.mode;
        design.samplerModel.open(state, id, state.sampler.stemIndex); state.phone.mode = 'sampler';
      } else {
        if (state.sampler.open) design.samplerModel.close(state);
        design.model.setDeckControl(state, id, 'columnMode', name);
        state.phone.mode = name === 'controls' && state.phone.transitionOpen ? 'transition' : 'decks';
      }
      refresh();
    }
    const tabButtons = ['waveform', 'controls', 'library', 'sampler'].map(name => {
      const button = ui.button('phone-tab', name[0].toUpperCase() + name.slice(1), 'Show ' + name + ' for selected deck', () => showTab(name));
      button.dataset.tab = name; tabs.append(button); return { name, button };
    });
    const selectors = ui.element('nav', 'phone-deck-selectors'); selectors.setAttribute('aria-label', 'Select visible deck');
    const deckButtons = [1,2,3,4].map(id => {
      const button = ui.button('phone-deck-select', 'Deck ' + id, 'Show deck ' + id, () => { design.model.selectPhoneDeck(getState(), id); refresh(); });
      button.dataset.deck = id; selectors.append(button); return button;
    });
    document.querySelector('.design-header').append(selectors, tabs);
    const transition = ui.element('section', 'phone-transition'); transition.setAttribute('aria-label', 'Two-deck transition preview');
    const pairSelectors = ui.element('div', 'transition-pair');
    const currentDeckLabel = ui.element('strong', 'transition-current-deck');
    const partners = ui.element('div', 'transition-partner-buttons');
    partners.setAttribute('aria-label', 'Choose Transition partner');
    const partnerButtons = [1,2,3,4].map(id => {
      const button = ui.button('transition-partner', 'Deck ' + id, 'Use deck ' + id + ' as Transition partner', () => {
        design.model.setTransitionPair(getState(), 1, id); refresh();
      });
      button.dataset.deck = id; partners.append(button); return { id, button };
    });
    pairSelectors.append(currentDeckLabel, partners);
    const cards = ui.element('div', 'transition-cards');
    const views = [0,1].map(side => {
      const card = ui.element('section', 'transition-card'), heading = ui.element('h2'), title = ui.element('strong', 'transition-song');
      const progress = ui.element('div', 'transition-progress'), mini = ui.element('div', 'transition-wave'); mini.append(ui.waveform(side + 1));
      const getDeck = () => getState().decks.find(deck => deck.id === getState().phone.pair[side]);
      const controls = design.createPerformanceControls({ scope: 'transition-' + side, getDeck, actions });
      card.append(heading, title, progress, mini, controls.node); cards.append(card);
      return { render() {
        const deck = getDeck(); card.dataset.deck = deck.id; heading.textContent = 'DECK ' + deck.id;
        title.textContent = design.model.findSong(deck.songId)?.title || 'No song loaded'; progress.textContent = design.performanceProgress(deck).text + ' · simulated';
        controls.render();
      } };
    });
    // This single control edits existing FX slot 1; it never owns another effect value.
    let fxTarget = 'primary';
    const fxStrip = ui.element('section', 'transition-single-fx'); fxStrip.setAttribute('aria-label', 'Transition FX slot 1');
    const targets = ui.element('div', 'transition-fx-targets'); targets.setAttribute('aria-label', 'FX target deck');
    const targetButtons = ['primary', 'partner'].map(target => {
      const button = ui.button('transition-fx-target', '', 'Target ' + target + ' deck FX slot 1', () => { fxTarget = target; refresh(); });
      button.dataset.target = target; targets.append(button); return { target, button };
    });
    function getFxDeck() {
      const state = getState(), id = fxTarget === 'primary' ? state.phone.selectedDeckId : state.phone.pair[1];
      return state.decks.find(deck => deck.id === id);
    }
    const effects = design.createEffectsRow(getFxDeck, actions, [0]);
    effects.node.classList.add('transition-effects');
    fxStrip.append(targets, effects.node);
    transition.append(cards, fxStrip); mixer.append(transition);
    const footer = ui.element('div', 'phone-controls-footer');
    const arrangement = ui.element('div', 'phone-controls-switch'); arrangement.setAttribute('aria-label', 'Mixer arrangement');
    const normal = ui.button('normal-controls-option', 'Controls', 'Show one mixer strip', () => { getState().phone.transitionOpen = false; getState().phone.mode = 'decks'; refresh(); });
    const dual = ui.button('transition-controls-option', 'Transition', 'Show selected and partner mixer strips', () => { getState().phone.transitionOpen = true; getState().phone.mode = 'transition'; refresh(); });
    arrangement.append(normal, dual); footer.append(pairSelectors, arrangement); mixer.append(footer);
    window.addEventListener('resize', refresh);
    return { render() {
      const state = getState(); app.dataset.phoneMode = state.phone.mode;
      const selected = state.decks.find(deck => deck.id === state.phone.selectedDeckId);
      if (state.phone.mode !== 'sampler') state.phone.mode = selected.columnMode === 'controls' && state.phone.transitionOpen ? 'transition' : 'decks';
      app.dataset.phoneMode = state.phone.mode;
      tabButtons.forEach(({ name, button }) => button.setAttribute('aria-pressed', String(name === (state.phone.mode === 'sampler' ? 'sampler' : selected.columnMode))));
      deckButtons.forEach(button => {
        button.setAttribute('aria-pressed', String(Number(button.dataset.deck) === state.phone.selectedDeckId));
        button.disabled = false;
      });
      [...document.querySelectorAll('.design-deck')].forEach(card => { card.dataset.phoneVisible = String(Number(card.dataset.deck) === state.phone.selectedDeckId); });
      currentDeckLabel.textContent = 'Deck ' + state.phone.selectedDeckId;
      partnerButtons.forEach(({ id, button }) => {
        button.hidden = id === state.phone.selectedDeckId;
        button.setAttribute('aria-pressed', String(id === state.phone.pair[1]));
      });
      const inControls = selected.columnMode === 'controls' && state.phone.mode !== 'sampler';
      footer.hidden = !design.isPhone() || !inControls;
      pairSelectors.hidden = state.phone.mode !== 'transition';
      normal.setAttribute('aria-pressed', String(state.phone.mode !== 'transition'));
      dual.setAttribute('aria-pressed', String(state.phone.mode === 'transition'));
      targetButtons.forEach(({ target, button }) => {
        const id = target === 'primary' ? selected.id : state.phone.pair[1];
        button.textContent = (target === 'primary' ? 'Primary' : 'Partner') + ' D' + id;
        button.setAttribute('aria-label', 'Target ' + target + ' deck ' + id + ' FX slot 1');
        button.setAttribute('aria-pressed', String(target === fxTarget));
      });
      fxStrip.dataset.deck = getFxDeck().id; effects.node.dataset.deck = getFxDeck().id; effects.render();
      views.forEach(view => view.render());
    } };
  };
})();

// One shared sampler UI. Deck cards and their library DOM remain mounted behind it.
(() => {
  const design = globalThis.TuneToxDesign, ui = design.components, model = design.samplerModel;
  design.createSamplerView = function (getState, refresh, announce) {
    const app = document.querySelector('.design-app'), mixer = document.querySelector('.mixer');
    const panel = ui.element('section', 'shared-sampler');
    panel.setAttribute('aria-label', 'Shared simulated sampler'); mixer.append(panel);
    const previews = ui.element('div', 'sampler-deck-previews');
    const previewCards = [1, 2, 3, 4].map(id => {
      const card = ui.element('section', 'sampler-deck-preview'); card.dataset.deck = id;
      const title = ui.element('strong'), song = ui.element('span'), wave = ui.element('div', 'sampler-mini-wave');
      wave.append(ui.waveform(id));
      const position = ui.element('span', 'sampler-preview-position');
      const marker = ui.element('span', 'sampler-playhead'); wave.append(marker);
      const play = ui.button('sampler-preview-play', '▶', 'Play/pause simulated deck ' + id, () => { design.model.togglePlay(getState(), id); refresh(); });
      card.append(title, song, wave, position, play); previews.append(card); return { card, title, song, position, marker, play };
    });
    const performance = ui.element('section', 'sampler-performance');
    const toolbar = ui.element('div', 'sampler-toolbar');
    function select(labelText, id, values, change) {
      const label = ui.element('label', '', labelText), input = ui.element('select'); input.id = id;
      values.forEach(([value, text]) => { const option = ui.element('option', '', text); option.value = value; input.append(option); });
      input.addEventListener('change', () => { change(Number(input.value)); refresh(); }); label.append(input); toolbar.append(label); return input;
    }
    const deckSelect = select('Source deck', 'sampler-source-deck', [1,2,3,4].map(id => [id, 'Deck ' + id]), id => { if (design.isPhone()) design.model.selectPhoneDeck(getState(), id); model.open(getState(), id, getState().sampler.stemIndex); });
    const stemSelect = select('Parent stem', 'sampler-source-stem', design.model.stems.map((name, index) => [index, name]), index => model.open(getState(), getState().sampler.deckId, index));
    function range(text, id, key) {
      const label = ui.element('label', 'sampler-range', text), output = ui.element('output'), input = ui.element('input');
      input.type = 'range'; input.id = id; input.min = 0; input.max = 1; input.step = .01;
      input.setAttribute('aria-label', text); output.setAttribute('for', id);
      input.addEventListener('input', () => { model.setLevel(getState(), key, input.valueAsNumber); refresh(); });
      label.append(output, input); toolbar.append(label); return { input, output };
    }
    const attenuation = range('Parent attenuation · global', 'sampler-attenuation', 'attenuation');
    const volume = range('Sampler output', 'sampler-output', 'outputVolume');
    const close = ui.button('sampler-close', 'Return to mixer', 'Close sampler and restore mixer', () => {
      model.close(getState());
      if (design.isPhone()) getState().phone.mode = getState().phone.samplerReturnMode;
      refresh(); opener?.focus();
    }); toolbar.append(close);
    const sourceLabel = ui.element('p', 'sampler-source-label'); sourceLabel.setAttribute('aria-live', 'polite');
    const pads = ui.element('div', 'sampler-pads'); pads.setAttribute('aria-label', '25 simulated performance pads');
    const padButtons = Array.from({ length: 25 }, (_, index) => {
      const pad = ui.button('sampler-pad', '', 'Trigger placeholder sample ' + (index + 1), () => {
        if (model.trigger(getState(), index)) { announce('Pad ' + (index + 1) + ' triggered — no audio'); refresh(); }
      });
      const number = ui.element('strong', '', String(index + 1).padStart(2, '0'));
      const name = ui.element('span', '', 'Sample ' + (index + 1)); pad.append(number, name); pads.append(pad); return pad;
    });
    performance.append(toolbar, sourceLabel, pads); panel.append(previews, performance);
    let wasVisible = false, opener = null;
    function active() {
      const state = getState();
      return state.sampler.open && (design.isPhone() && state.phone.mode === 'sampler' || state.layout === 'full' && state.arrangement === 'slices' &&
        matchMedia('(orientation: landscape) and (min-width: 900px) and (max-width: 1600px) and (min-height: 650px)').matches);
    }
    matchMedia('(orientation: landscape) and (min-width: 900px) and (max-width: 1600px) and (min-height: 650px)').addEventListener('change', refresh);
    window.addEventListener('resize', refresh);
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close.click(); } });
    return { render() {
      const state = getState(), sampler = state.sampler;
      model.syncKits(state);
      const visible = active(); app.dataset.sampler = visible ? 'open' : 'closed'; panel.hidden = !visible;
      // Hiding, never unmounting, retains column contexts and scroll positions.
      // CSS display:none removes the inactive mixer from keyboard/touch interaction.
      // No persistent inert flag can accidentally disable the portrait mixer.
      if (visible && !wasVisible) { opener = document.activeElement; close.focus(); }
      wasVisible = visible;
      deckSelect.value = sampler.deckId; stemSelect.value = sampler.stemIndex;
      attenuation.input.value = sampler.attenuation[sampler.stemIndex]; attenuation.output.value = Math.round(sampler.attenuation[sampler.stemIndex] * 100) + '%';
      volume.input.value = sampler.outputVolume; volume.output.value = Math.round(sampler.outputVolume * 100) + '%';
      panel.dataset.deck = sampler.deckId;
      previewCards.forEach((preview, index) => {
        const deck = state.decks[index]; preview.title.textContent = 'DECK ' + deck.id;
        preview.song.textContent = design.model.findSong(deck.songId)?.title || 'No song loaded';
        const progress = design.performanceProgress(deck);
        preview.position.textContent = progress.text; preview.marker.style.left = (progress.fraction * 100) + '%';
        preview.play.textContent = deck.playing ? 'Ⅱ' : '▶'; preview.play.disabled = !deck.songId; preview.play.setAttribute('aria-pressed', String(deck.playing));
      });
      const kit = sampler.kits[sampler.deckId - 1].stems[sampler.stemIndex];
      sourceLabel.textContent = 'Deck ' + sampler.deckId + ' / ' + design.model.stems[sampler.stemIndex] + ' · ' + (design.model.findSong(state.decks[sampler.deckId - 1].songId)?.title || 'Empty deck') + ' · PLACEHOLDER KIT / NO AUDIO';
      pads.setAttribute('aria-label', (design.isPhone() ? 20 : 25) + ' simulated performance pads');
      padButtons.forEach((pad, index) => { pad.hidden = design.isPhone() && index >= 20; pad.classList.toggle('was-triggered', sampler.lastPad === index); pad.querySelector('span').textContent = kit.pads[index]?.label || 'Unassigned'; });
    } };
  };
})();

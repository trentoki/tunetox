// Main-page opt-in adapter. No participation/default resets and no context until Load.
function createMainStemIntegration(complete) {
  const mixer = createNativeStemMixer();
  const origins = {}, refreshers = [], participationInputs = [];
  function refreshAll() {
    for (const refresh of refreshers) refresh();
    for (const [id, input] of participationInputs) input.checked = appActions.participation.get(id, 'stemHandoff');
  }
  const bridge = createNativeStemHandoffActions(appState, mixer, (state, details) => {
    if (details.directControl) origins[details.directControl] = 'direct human input';
    for (const id of details.automaticControls) origins[id] = 'automatic allocation';
    refreshAll();
  });
  const router = createStemSourceRouter(complete, mixer, bridge);
  bridge.synchronizeAudio();
  function mount(section, id) {
    const completeFileLabel = section.querySelector('input[type="file"]').parentElement;
    const participationLabel = document.createElement('label'); participationLabel.textContent = ' Stem handoff participation ';
    const participation = document.createElement('input'); participation.type = 'checkbox';
    participation.id = getParticipationControlId(id, 'stemHandoff');
    participation.addEventListener('change', () => {
      try { bridge.setParticipation(id, participation.checked); }
      catch (error) { section.querySelector('[data-display="status"]').textContent = error.message; }
      refreshAll();
    });
    participationLabel.append(participation); section.append(participationLabel); participationInputs.push([id, participation]);
    const label = document.createElement('label'); label.textContent = ' Audio source ';
    const select = document.createElement('select'); select.id = 'deck.' + id + '.sourceMode';
    for (const [value, text] of [['complete','Complete song'],['stems','Four stems (native, experimental)']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    label.append(select); section.append(label);
    const container = document.createElement('div'); section.append(container);
    const component = mountStemControls(container, id, { player: mixer.getDeck(id), state: appState,
      bridge, origins, refreshAll, loadFiles: files => router.loadStems(id, files),
      transportControls: false, participationControl: false, externalError: bridge.getLastError,
      controlsEnabled: () => router.getSourceMode(id) === 'stems' });
    refreshers.push(component.refresh);
    select.addEventListener('change', () => {
      if (router.setSourceMode(id, select.value)) {
        section.querySelector('[data-display="status"]').textContent = 'Source selected: ' + select.value + '. Load audio to begin.';
        section.querySelector('[data-display="tempo"]').textContent = 'BPM unknown — playback rate 1.000×';
      }
      update();
    });
    function update() {
      const stems = router.getSourceMode(id) === 'stems';
      select.value = router.getSourceMode(id); select.disabled = !router.canSwitchSource(id);
      container.hidden = false;
      component.section.classList.toggle('complete-source', !stems);
      completeFileLabel.hidden = stems;
      section.querySelector('[data-experiment]').hidden = stems || id !== 1;
      if (stems) {
        for (const field of ['original-bpm','target-bpm']) section.querySelector('[data-input="'+field+'"]').disabled = true;
        section.querySelector('[data-action="tempo"]').disabled = true;
        section.querySelector('[data-display="tempo"]').textContent = 'Native stems: no tempo or pitch processing.';
      }
      component.refresh();refreshAll();
    }
    return update;
  }
  window.addEventListener('pagehide', () => { void mixer.close().catch(console.error); });
  return Object.freeze({ router, mount, mixer, handoff: bridge });
}

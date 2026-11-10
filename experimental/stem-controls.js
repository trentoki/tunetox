// Reusable DOM adapter; host owns transport routing, state and refresh lifecycle.
let stemControlGesture = 0;
function mountStemControls(container, deckId, options) {
  const { player, state: domainState, bridge, origins, refreshAll, loadFiles = files => player.loadFiles(files), transportControls = true, participationControl = true, externalError = () => null, controlsEnabled = () => true } = options;
  const fileAssignments = createStemFileAssignments();
  const assignmentSelects = {};
  let assignmentMessages = [];
  let optionSignature = null;
  let errorMessage = '';
  let loadedAssignments = null;
  let loadFailureStage = '';
  const levelInputs = {}, levelDescriptions = {};
  let volumeInput;
  const section = document.createElement('section');
  const title = document.createElement('h2'); title.textContent = 'Deck ' + deckId; section.append(title);
  const batchLabel = document.createElement('label'); batchLabel.textContent = 'Select stem files together ';
  const batch = document.createElement('input'); batch.type = 'file'; batch.multiple = true;
  batch.id = 'prototype.deck.' + deckId + '.stem.batch';
  batch.addEventListener('change', () => {
    if (!batch.files.length) return;
    assignmentMessages = fileAssignments.addFiles(batch.files); errorMessage = ''; loadFailureStage = ''; refresh();
    batch.value = ''; // Reselecting the same batch can emit change; mappings remain in the model.
  });
  batchLabel.append(batch); section.append(batchLabel);
  const clear = document.createElement('button'); clear.textContent = 'Clear selected files';
  clear.addEventListener('click', () => { fileAssignments.clear(); assignmentMessages = []; errorMessage = ''; loadFailureStage = ''; refresh(); });
  section.append(clear);
  const assignmentStatus = document.createElement('p'); assignmentStatus.setAttribute('role','status'); section.append(assignmentStatus);
  function slider(labelText, id, action) {
    const label = document.createElement('label'); label.textContent = labelText + ' ';
    const input = document.createElement('input'); input.type = 'range'; input.min = 0; input.max = 1;
    input.step = 0.01; input.value = 1; input.id = id;
    input.addEventListener('input', () => {
      try { errorMessage = ''; action(Number(input.value)); } catch (error) { errorMessage = error.message; }
      refreshAll();
    });
    const value = document.createElement('output'); value.setAttribute('for', id);
    value.className = 'fader-value'; value.value = '1.00';
    label.append(input, value); return label;
  }
  const volumeLabel = slider('Main volume', getDeckVolumeControlId(deckId), value =>
    bridge.setMainVolume(deckId, value, 'stem-ui-' + ++stemControlGesture));
  volumeInput = volumeLabel.querySelector('input'); section.append(volumeLabel);
  const participationLabel = document.createElement('label'); participationLabel.textContent = ' Stem handoff participation ';
  const participationInput = document.createElement('input'); participationInput.type = 'checkbox';
  participationInput.id = getParticipationControlId(deckId, 'stemHandoff');
  participationInput.addEventListener('change', () => {
    try { errorMessage = ''; bridge.setParticipation(deckId, participationInput.checked); }
    catch (error) { errorMessage = error.message; }
    refreshAll();
  });
  participationLabel.append(participationInput); if (participationControl) section.append(participationLabel);
  for (const name of prototypeStemNames) {
    const row = document.createElement('p'), label = document.createElement('label');
    label.textContent = name[0].toUpperCase() + name.slice(1) + ' file ';
    const file = document.createElement('input'); file.type = 'file';
    file.id = 'prototype.deck.' + deckId + '.stem.' + name + '.file';
    file.addEventListener('change', () => {
      if (!file.files.length) return;
      try { fileAssignments.assign(name, file.files[0]); errorMessage = ''; }
      catch (error) { errorMessage = error.message; }
      file.value = ''; refresh();
    });
    label.append(file); row.append(label);
    const assignmentLabel = document.createElement('label'); assignmentLabel.textContent = ' Assigned file ';
    const assignment = document.createElement('select');
    assignment.id = 'prototype.deck.' + deckId + '.stem.' + name + '.assignment';
    assignment.addEventListener('change', () => {
      try {
        const candidate = fileAssignments.getState().candidates.find(item => item.key === assignment.value);
        fileAssignments.assign(name, candidate ? candidate.file : null); errorMessage = '';
      } catch (error) {
        errorMessage = error.message;
        if (name === 'load') loadFailureStage = 'Load failed: ';
      }
      refresh();
    });
    assignmentSelects[name] = assignment; assignmentLabel.append(assignment); row.append(assignmentLabel);
    const levelLabel = slider('Allocated level', getStemControlId(deckId, name), value =>
      bridge.setStemLevel(deckId, name, Math.round(value * 100) / 100, 'stem-ui-' + ++stemControlGesture));
    levelInputs[name] = levelLabel.querySelector('input');
    // Display continuous automatic allocations; direct gestures retain approved 0.01 steps.
    levelInputs[name].step = 'any';
    const description = document.createElement('span'); levelDescriptions[name] = description;
    row.append(levelLabel, description);
    section.append(row);
  }
  const buttons = {};
  for (const [name, action] of Object.entries({ load: () => loadFiles(fileAssignments.getFiles()),
    play: () => player.play(), pause: () => player.pause(), stop: () => player.stop(), eject: () => player.eject() })) {
    if (!transportControls && name !== 'load') continue;
    const button = document.createElement('button'); button.textContent = {load:'Load selected stems',play:'Play / Resume',pause:'Pause',stop:'Stop',eject:'Eject / Cancel load'}[name];
    button.id = 'prototype.deck.' + deckId + '.' + name;
    button.addEventListener('click', async () => {
      try {
        errorMessage = '';
        const selected = name === 'load' ? fileAssignments.getFiles() : null;
        // Invoke immediately in the human gesture, then refresh before awaiting decoding.
        if (name === 'load') loadFailureStage = '';
        const pending = action();
        refresh();
        const succeeded = await pending;
        if (name === 'load' && succeeded) loadedAssignments = selected;
      } catch (error) {
        errorMessage = error.message;
        if (name === 'load') loadFailureStage = 'Load failed: ';
      }
      refresh();
    });
    buttons[name] = button; section.append(button);
  }
  const status = document.createElement('pre'); status.setAttribute('role','status'); section.append(status);
  function refresh() {
    const state = player.getState();
    const selection = fileAssignments.getState();
    const signature = JSON.stringify(selection.candidates.map(item => item.key));
    for (const name of prototypeStemNames) {
      const select = assignmentSelects[name];
      if (signature !== optionSignature) {
        select.replaceChildren();
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Unassigned'; select.append(empty);
        for (const { key, file } of selection.candidates) {
          const option = document.createElement('option'); option.value = key; option.textContent = file.name; select.append(option);
        }
      }
      select.value = selection.assignments[name] || ''; select.disabled = state.closed;
    }
    optionSignature = signature;
    const assigned = selection.ready ? fileAssignments.getFiles() : null;
    const assignmentsLoaded = state.loaded && assigned && loadedAssignments &&
      prototypeStemNames.every(name => assigned[name] === loadedAssignments[name]);
    const reportedError = errorMessage || externalError()?.message;
    assignmentStatus.dataset.loadState = reportedError ? 'error' : state.loading ? 'loading' :
      assignmentsLoaded ? 'ready' : selection.ready ? 'assigned' : 'incomplete';
    assignmentStatus.textContent = (reportedError ? (loadFailureStage || 'Error: ') + reportedError +
      (state.loaded ? ' Previous decoded audio remains loaded.' : ' No decoded audio ready.') :
      state.loading ? 'Loading / decoding four stems…' :
      assignmentsLoaded ? 'Four stems loaded — ready to play.' :
      selection.ready ? 'Four assignments ready. Click Load to decode.' :
      'Assign one distinct file to each category before loading.') +
      (selection.candidates.length > 4 ? ' Extra files remain available for correction; only the four assignments will load.' : '') +
      (assignmentMessages.length ? ' Selection review: ' + assignmentMessages.join(' ') : '') +
      (selection.candidates.length > 4 ? ' To select a different song set, Clear selected files, then select all four matching stems together. Loaded audio is retained until Load succeeds.' : '');
    assignmentStatus.dataset.stage = state.loading ? 'decode' : loadFailureStage ? 'load-error' :
      assignmentsLoaded ? 'ready' : 'assignment';
    clear.disabled = state.closed;
    const domainDeck = domainState.decks.find(deck => deck.id === deckId);
    volumeInput.value = domainDeck.volume;
    volumeLabel.querySelector('output').value = domainDeck.volume.toFixed(2);
    participationInput.checked = domainState.participation.byDeck[deckId].stemHandoff;
    participationInput.disabled = state.closed;
    for (const name of prototypeStemNames) {
      const requested = domainDeck.stems.requestedLevels[name], allocated = domainDeck.stems.allocatedLevels[name];
      levelInputs[name].value = allocated;
      levelInputs[name].parentElement.querySelector('output').value = allocated.toFixed(3);
      levelDescriptions[name].textContent = ' Requested ' + requested.toFixed(2) +
        ' / allocated ' + allocated.toFixed(3) + ' — ' +
        (origins[getStemControlId(deckId, name)] || 'initialization') +
        (requested !== allocated ? ' (differs from human request)' : '');
    }
    status.textContent = (reportedError ? 'Error: ' + reportedError + '\n' : '') + JSON.stringify(state,null,2);
    for (const button of Object.values(buttons)) button.disabled = state.closed;
    buttons.load.disabled = state.closed || !controlsEnabled() || state.loading || !selection.ready;
    if (buttons.play) buttons.play.disabled = state.closed || state.loading || !state.loaded || state.isPlaying;
    for (const input of section.querySelectorAll('input')) input.disabled = state.closed || (!controlsEnabled() && input.type === 'range');
  }
  container.append(section); refresh();
  return Object.freeze({ refresh, section });
}

// Presentation only: move existing controls once. No playback, state or synthetic events.
(() => {
  function details(label, className) {
    const panel = document.createElement('details'); panel.className = className;
    const summary = document.createElement('summary'); summary.textContent = label;
    const content = document.createElement('div'); content.className = 'panel-content';
    const close = document.createElement('button'); close.type = 'button';
    close.className = 'panel-close'; close.textContent = 'Close ' + label;
    close.addEventListener('click', () => { panel.open = false; summary.focus(); });
    content.append(close);
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { panel.open = false; summary.focus(); event.stopPropagation(); }
    });
    panel.append(summary,content); return { panel,content };
  }
  for (const [index,deck] of [...document.querySelectorAll('#audio-decks > section')].entries()) {
    const id = index + 1;
    deck.classList.add('mixer-deck'); deck.dataset.deck = id;
    const heading = deck.querySelector('h2');
    const header = document.createElement('header'); header.className = 'deck-header';
    const participation = document.getElementById('deck.'+id+'.participation.stemHandoff').parentElement;
    // Shorter visible copy; retain the existing checkbox identity and action.
    for (const node of participation.childNodes) if(node.nodeType===Node.TEXT_NODE)node.textContent=' Handoff ';
    header.append(heading,participation);
    const transport = deck.querySelector('[data-action="play"]').parentElement;
    transport.className = 'deck-transport';
    const source = document.getElementById('deck.'+id+'.sourceMode').parentElement;
    source.className = 'source-control'; transport.append(source);
    const advanced = details('Full song / advanced','deck-advanced');
    const fullFile = deck.querySelector('input[type="file"]').parentElement;
    advanced.content.append(fullFile,deck.querySelector('[data-action="load-selected"]'));
    for(const selector of ['[data-experiment]','[data-comparison]','[data-display="tempo"]']) {
      const element=deck.querySelector(selector); advanced.content.append(element);
    }
    const tempoRow=deck.querySelector('[data-input="original-bpm"]').closest('p');
    advanced.content.append(tempoRow);
    const component=document.getElementById('prototype.deck.'+id+'.stem.batch').closest('section');
    component.classList.add('stem-mixer'); component.querySelector('h2').hidden=true;
    const files=details('Assign & load stems','stem-files');
    const fileHint=document.createElement('p');fileHint.className='file-hint';
    fileHint.textContent='1. Select the four matching stems from one song and review assignments. To switch songs, Clear selected files first. 2. Load selected stems to decode. Playback uses the last successfully loaded audio.';
    files.content.append(fileHint);
    const faders=document.createElement('div');faders.className='deck-faders';
    const main=document.getElementById('deck.'+id+'.volume').parentElement;
    main.className='main-fader';faders.append(main);
    for(const name of ['transients','flow','tune','voice']) {
      const input=document.getElementById('deck.'+id+'.stem.'+name+'.level');
      const label=input.parentElement;label.className='stem-fader';
      for(const node of label.childNodes)if(node.nodeType===Node.TEXT_NODE)node.textContent=name[0].toUpperCase()+name.slice(1)+' ';
      input.setAttribute('aria-label','Deck '+id+' '+name+' allocated level');
      faders.append(label);
    }
    // Keep controls inside their original component so its refresh/disable logic still owns them.
    const status=component.querySelector('pre');
    const diagnostics=details('Allocation details','allocation-details');diagnostics.content.append(status);
    const capture = document.createElement('button'); capture.type = 'button';
    capture.textContent = 'Capture native audio diagnostics';
    const audioSnapshot = document.createElement('pre'); audioSnapshot.setAttribute('aria-live','polite');
    capture.addEventListener('click', () => {
      audioSnapshot.textContent = JSON.stringify(mainStemIntegration.handoff.getDiagnostics(),null,2);
    });
    const testOutput = document.createElement('button'); testOutput.type = 'button';
    testOutput.textContent = 'Test shared output — pause all native decks';
    testOutput.addEventListener('click', async () => {
      try {
        if ([1,2,3,4].some(deckId => {
          const state = audioEngine.getState(deckId); return state.isPlaying || state.loading;
        })) throw new Error('Pause all decks and finish loading before testing shared output.');
        await mainStemIntegration.mixer.playDiagnosticTone();
        audioSnapshot.textContent = 'Playing 0.75-second tone through the existing shared context. Note whether Apollo meters respond.\n' +
          JSON.stringify(mainStemIntegration.handoff.getDiagnostics(),null,2);
      } catch (error) { audioSnapshot.textContent = error.message; }
    });
    const testFresh=document.createElement('button');testFresh.type='button';
    testFresh.textContent='Test fresh context — pause all decks';
    testFresh.addEventListener('click',async()=>{
      try {
        if([1,2,3,4].some(deckId=>{
          const state=audioEngine.getState(deckId);return state.isPlaying || state.loading;
        }))throw new Error('Pause all decks and finish loading before testing fresh output.');
        await mainStemIntegration.mixer.playFreshDiagnosticTone();
        audioSnapshot.textContent='Playing the same brief tone through a fresh temporary context; the retained context is untouched. Note Apollo sound/meters.\n'+
          JSON.stringify(mainStemIntegration.handoff.getDiagnostics(),null,2);
      }catch(error){audioSnapshot.textContent=error.message;}
    });
    diagnostics.content.append(capture,testOutput,testFresh,audioSnapshot);
    const remaining=[...component.children].filter(child=>!child.matches('h2')&&child!==faders);
    // Fader labels have already been detached; remaining file rows retain assignment controls
    // and requested/allocated provenance descriptions for review.
    files.content.append(...remaining);
    component.append(faders,files.panel,diagnostics.panel);
    const stateLine=document.createElement('div');stateLine.className='deck-state';
    stateLine.append(deck.querySelector('[data-display="status"]'),deck.querySelector('[data-display="position"]'));
    const tools=document.createElement('div');tools.className='deck-tools';tools.append(advanced.panel);
    // Existing container stays in place; source switching never reconstructs the controls.
    deck.prepend(header,transport);
    deck.append(stateLine,tools);
    // File and diagnostics details are overlays, so opening one never moves another deck.
    function fitPanels() {
      const top = Math.ceil(transport.getBoundingClientRect().bottom - deck.getBoundingClientRect().top + 6);
      for (const panel of [files.panel,diagnostics.panel,advanced.panel]) {
        panel.querySelector('.panel-content').style.top = top + 'px';
      }
    }
    window.addEventListener('resize', fitPanels);
    for(const panel of [files.panel,diagnostics.panel,advanced.panel])panel.addEventListener('toggle',()=>{
      fitPanels();
      if(panel.open)for(const other of [files.panel,diagnostics.panel,advanced.panel])if(other!==panel)other.open=false;
    });
  }
  // Preserve the existing experiment panels and handlers, but fold them out of the mixer.
  for(const panel of [...document.querySelectorAll('body > section')])document.getElementById('diagnostic-panels').append(panel);
})();

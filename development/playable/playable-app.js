// Separate Phase 1E host. Shared approved UI modules are imported unchanged.
(async () => {
  const design=globalThis.TuneToxDesign, model=design.model, components=design.components;
  const status=document.getElementById('design-status');
  const announce=message=>{status.textContent=message;status.title=message;};
  try {
    const persistent=document.body.dataset.persistentAudio==='true';
    const store=persistent?await design.createLocalAudioStore():null;
    let catalog;
    if(store)catalog={songs:await store.list()};
    else{const response=await fetch('/two-deck-manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('Catalog HTTP '+response.status);catalog=await response.json();}
    const controller=design.createPlayableController(catalog,announce,{store,fourDeck:document.body.dataset.fourDeck==='true',incremental:document.body.dataset.incremental==='true',firstPlayIncremental:document.body.dataset.firstPlayIncremental==='true',liveLifecycle:document.body.dataset.liveLifecycle==='true'});
    const state=controller.createViewState();
    const actions={
      sampler(){announce('Sampler inactive in Phase 1E');}, waveform(){announce('Illustrative waveform; jog/scrubbing inactive');},
      performance(){announce('EQ, filter, effects and looping are inactive');},
      transition(){state.phone.transitionOpen=!state.phone.transitionOpen;state.phone.mode=state.phone.transitionOpen?'transition':'decks';render();},
      view(id){const d=state.decks[id-1];model.setDeckControl(state,id,'sliceView',d.sliceView==='controls'?'waveform':'controls');render();},
      links(id){if(columns.active())columns.showLinks(id);else{state.context={type:'links',deckId:id};if(state.layout==='full')state.drawerOpen=true;}render();},
      load(id){void controller.load(id,state.songId);}, play(id){void controller.play(id);},
      eject(id){controller.release(id);},
      toggle(id,key){if(key==='handoff')controller.handoff(id);else announce('Matching inactive; original rate and pitch');},
      control(id,key,value){model.setDeckControl(state,id,key,value);render();},
      level(id,index,value){controller.level(id,index,value);}
    };
    if(document.body.dataset.incremental==='true')design.attachStemTouchPriority(document,()=>render(),(id,index)=>controller.touchLevel(id,index));
    const decks=[1,2,3,4].map(id=>components.createDeckCard(id,actions));
    document.getElementById('design-decks').append(...decks.map(d=>d.node));
    const playlistList=components.createList(document.getElementById('playlist-list'),components.playlistRow,'No matching playlists.');
    const songList=components.createList(document.getElementById('song-list'),components.songRow,'No matching prepared songs.');
    const loadTargets=[1,2,3,4].map(id=>{
      const button=components.button('library-load',String(id),'Load selected real song into deck '+id,()=>actions.load(id));
      button.dataset.deck=id;document.getElementById('library-load-targets').append(button);return button;
    });
    design.enableDragDrop(document.querySelector('.library'),(songId,target)=>{model.dropSong(state,songId,target);announce('Session playlist updated; not persisted');render();},announce);
    const layout=design.createLayoutPreview(()=>state,render);
    const columns=design.createColumnLibraries(decks,()=>state,render,announce);
    const sampler=design.createSamplerView(()=>state,render,announce);
    const phone=design.createPhoneView(()=>state,render,actions);
    const context=design.createLibraryContext(document.querySelector('.library'),()=>state,render,announce);
    document.querySelector('.library').addEventListener('manage-song',event=>{state.context={type:'manage',songId:event.detail};render();});
    const songSearch=document.getElementById('song-search'),playlistSearch=document.getElementById('playlist-search');
    songSearch.addEventListener('input',()=>{model.setSongQuery(state,songSearch.value);render();});
    playlistSearch.addEventListener('input',()=>{state.playlistQuery=playlistSearch.value;render();});
    const dialog=document.getElementById('audio-diagnostics');
    function diagnostics(){
      if(!dialog.open)return;
      const details=controller.diagnostics();
      const rate=details.audio.nativeAudio.contextNow?.sampleRate || 44100;
      const bytes=state.decks.reduce((sum,d)=>{const s=model.findSong(d.songId);return sum+(s?Object.values(s.metadata.stems).reduce((n,m)=>n+m.frames*m.channels*4*rate/m.sampleRate,0):0);},0);
      document.getElementById('audio-details').textContent=JSON.stringify({...details,perDeckPCMReferencesMiB:bytes/1048576,estimatedDecodedMiB:(details.sharedPCM?.uniqueDecodedBytes ?? bytes)/1048576,physicalAudibility:'Requires user confirmation'},null,2);
    }
    function openDiagnostics(){dialog.showModal();diagnostics();}
    document.getElementById('reset-demo').addEventListener('click',openDiagnostics);
    document.getElementById('audio-open').addEventListener('click',openDiagnostics);
    document.getElementById('audio-close').addEventListener('click',()=>dialog.close());
    const diagnosticActions=document.getElementById('audio-actions');
    for(const id of [1,2,3,4])for(const [name,action] of [['Stop',()=>controller.stop(id)],['Release',()=>controller.release(id)]]){
      const button=components.button('quiet-button',name+' D'+id,name+' deck '+id,action);diagnosticActions.append(button);
    }
    function refreshControlAvailability() {
      const busy=controller.busy();
      if(busy.loadingId!==null){status.textContent='Deck '+busy.loadingId+' · '+controller.message(busy.loadingId);status.title=status.textContent;}
      document.querySelectorAll('[data-control="beatMatch"],[data-control="tuneMatch"],.waveform-jog,.stem-sampler-trigger,.phone-tab[data-tab="sampler"]').forEach(node=>{
        node.disabled=true;node.title='Inactive in Phase 1E — no audio processing';node.setAttribute('aria-description',node.title);
      });
      document.querySelectorAll('.performance-knob,.performance-loop,.effect-control,.transition-single-fx').forEach(node=>{
        node.inert=true;node.classList.add('audio-inactive');node.title='Inactive — EQ, filter, FX and looping are not connected to audio';
      });
      document.querySelectorAll('.deck-tuning input,.slice-header-tuning input,#demo-tempo,#demo-pitch').forEach(input=>{input.disabled=true;input.title='Inactive — original playback rate and pitch';if(input.type==='number')input.value='';});
      document.querySelectorAll('.header-deck-value,#tempo-value,#pitch-value').forEach(output=>{output.value='OFF';});
      document.querySelectorAll('.slice-header-tuning .quiet-button').forEach(button=>{button.textContent='Audio';button.title='Audio diagnostics';});
      document.querySelectorAll('.effect-control select option').forEach(option=>{if(!option.textContent.endsWith(' · OFF'))option.textContent+=' · OFF';});
      document.querySelectorAll('.loop-length').forEach(node=>{node.textContent=node.textContent.replace('preview','OFF');});
      document.querySelectorAll('.performance-controls').forEach(node=>{node.setAttribute('aria-label','Main audio control; EQ, filter and effects inactive');});
      document.querySelectorAll('.song-select,.playlist-row,.column-load-button').forEach(node=>{const label=node.getAttribute('aria-label');if(label)node.setAttribute('aria-label',label.replace(' — example song','').replace(' — example playlist',' — session playlist').replace('selected example','selected real song'));});
      document.querySelectorAll('.overlay-caption').forEach(node=>{node.textContent='MAIN AUDIO · EQ/FX OFF';});
      document.querySelectorAll('.wave-note').forEach(node=>{node.textContent='ILLUSTRATIVE · NOT AUDIO DATA';});
      document.querySelectorAll('.waveform-gesture-hint').forEach(node=>{node.textContent='Illustrative · scrubbing inactive';});
      document.querySelectorAll('.phone-song-progress,.transition-progress').forEach(node=>{node.textContent=node.textContent.replace(' · simulated','');});
      document.querySelectorAll('.deck-load,.library-load,.column-load-button').forEach(button=>{button.disabled ||=busy.loadingId!==null || busy.pending;});
      document.querySelectorAll('.design-deck').forEach((card,index)=>{
        const id=index+1, loaded=!!state.decks[index].songId;
        card.setAttribute('aria-label','Audio deck '+id);
        card.querySelector('.deck-status').textContent=controller.status(id);
        if(controller.operation(id)){
          card.querySelector('.deck-subtitle').textContent=controller.message(id);
          const selection=card.querySelector('.column-selected');if(selection){selection.textContent=controller.message(id);selection.title=controller.message(id);}
        }
        if(!loaded)card.querySelector('.deck-title').textContent='Load a prepared song';
        card.querySelectorAll('.play-button,.phone-play,.performance-play').forEach(button=>{button.disabled=!loaded || !!controller.operation(id) || busy.pending;button.setAttribute('aria-label',(state.decks[index].playing?'Pause':'Play')+' audio deck '+id);});
        card.querySelectorAll('input[type="range"]').forEach(input=>{
          if(input.closest('.mix-control')){input.disabled=busy.pending;input.setAttribute('aria-label',input.getAttribute('aria-label').replace(' — simulated level',' audio'));
            input.title='Committed audio allocation; display rounded to 1%';}
        });
        if(document.body.dataset.fourDeck==='true'){
          card.querySelectorAll('.stem-controls input').forEach((input,stemIndex)=>{
            const allocated=state.decks[index].stems[stemIndex];
            const requested=appState.decks[index].stems.requestedLevels[prototypeStemNames[stemIndex]];
            // Exact automatic positions; controller still quantizes direct gestures
            // to the production 1% rule. Never display nonzero audio as plain 0%.
            input.step='any';input.value=allocated;
            const percent=Math.round(allocated*1000)/10;
            const text=allocated>0 && percent===0?'<0.1%':percent+'%';
            input.previousElementSibling.querySelector('output').value=text;
            input.setAttribute('aria-valuetext',text+' allocated; '+(requested*100).toFixed(1)+' percent requested');
            input.title='Actual allocation '+(allocated*100).toFixed(4)+'%; requested '+(requested*100).toFixed(2)+'%. '+
              (requested===0?'Zero request stays silent until a direct stem gesture.':'Eligible automatic reductions may restore.');
          });
        }
        card.querySelectorAll('[data-control="handoff"]').forEach(button=>{button.disabled=busy.pending;button.title='Real automatic stem handoff; preserves allocations on toggle';button.setAttribute('aria-label','Handoff on audio deck '+id);});
      });
      document.querySelectorAll('.transition-card input[type="range"]').forEach(input=>{input.disabled=busy.pending;});
      document.querySelectorAll('.transition-card .performance-play').forEach(button=>{const id=Number(button.closest('[data-deck]').dataset.deck);button.disabled=!state.decks[id-1].songId || busy.pending;button.setAttribute('aria-label','Play/pause audio deck '+id);});
    }
    function render(){
      const selected=model.findSong(state.songId);
      phone.render();layout.render();context.render();columns.render();sampler.render();
      decks.forEach((d,index)=>d.render(state.decks[index],selected));
      playlistList.render(model.visiblePlaylists(state),state.playlistId,id=>{model.selectPlaylist(state,id);render();},state.playlistQuery);
      const songs=model.visibleSongs(state);songList.render(songs,state.songId,id=>{model.selectSong(state,id);render();},state.playlistId+'/'+state.songQuery);
      document.getElementById('song-count').textContent=songs.length+' PREPARED';
      document.getElementById('selected-title').textContent=selected?.title || 'Select a song';
      loadTargets.forEach(button=>{button.disabled=!selected;});refreshControlAvailability();
    }
    controller.attach(render);render();
    if(store)design.localAudio={store,panel:await design.attachLocalAudioPanel(store,controller,render,announce)};
    if(document.body.dataset.liveLifecycle==='true')document.querySelector('#storage-content [role=status]').textContent='G2 lifecycle build; stored library unchanged. Paused edits prepare only that deck; Resume enters incrementally; Release preserves peers.';
    // Snapshot/diagnostics only. Audio commands still enter through the same UI actions.
    design.playable={controller,getSnapshot:()=>JSON.parse(JSON.stringify(state)),render};
    announce((document.body.dataset.liveLifecycle==='true'?'Phase 1G G2 · live handoff lifecycle':persistent?'Phase 1G G1 · encoded audio stored locally; import/load via Storage':document.body.dataset.fourDeck==='true'?(document.body.dataset.firstPlayIncremental==='true'?'Phase 1F F3 · incremental first Play':document.body.dataset.incremental==='true'?'Phase 1F F2 · incremental handoff':'Phase 1F F1 · four slots'):'Phase 1E P1')+' · Load prepared stems in Library. Main starts at zero. EQ/FX/loops/sampler inactive.');
    setInterval(()=>{if(document.visibilityState==='visible'){render();diagnostics();}},250);
    window.addEventListener('pagehide',()=>{void controller.close();});
  }catch(error){announce('BOOT ERROR: '+error.message);console.error(error);
    if(document.body.dataset.persistentAudio==='true'){const fallback=document.createElement('a');fallback.href='/performance-first-play?build=1f-f3';fallback.textContent='Open F3 fallback (no stored library)';status.append(' ',fallback);}
  }
})();

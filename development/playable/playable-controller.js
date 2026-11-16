// Audio adapter only. Production appState/actions own all musical values.
// UI state keeps navigation/preferences; getters project committed audio state.
(() => {
  const design = globalThis.TuneToxDesign;
  design.createPlayableController = function (catalog, notify, options = {}) {
    const mixer = createNativeStemMixer();
    const model = design.model, original = { ...model };
    let ui, refresh = () => {}, loadingId = null, pending = false, closed = false;
    const messages = {}, operations = {}, stopped = {};
    const names = prototypeStemNames;
    const maxLoadedDecks=options.fourDeck ? 4 : 2;
    const pool=options.fourDeck ? design.createSharedStemPool() : null;
    const build=options.liveLifecycle ? 'PHASE-1G-G2' : options.store ? 'PHASE-1G-G1-STORAGE' : options.firstPlayIncremental ? 'PHASE-1F-F3' : options.incremental ? 'PHASE-1F-F2' : options.fourDeck ? 'PHASE-1F-F1' : 'PHASE-1E-P1';
    const loads=[];
    const songs = options.store ? catalog.songs.map(design.localSongRecord) : Object.entries(catalog.decks).map(([id, metadata]) => ({
      id: id === '1' ? 'hypnotic' : 'cut-me-loose', title: metadata.song.replace(/^Tase T - /, '').replace(/^Michael Todd & Tase T - /, ''),
      artist: id === '1' ? 'Tase T' : 'Michael Todd & Tase T', bpm:'—', key:'—',
      duration: Math.floor(metadata.stems.flow.duration / 60) + ':' + String(Math.ceil(metadata.stems.flow.duration % 60)).padStart(2,'0'),
      color: id === '1' ? '#54e8df' : '#f68ab9', metadata
    }));
    design.data = { songs, playlists:[{id:'all',title:'All test songs',icon:'≡',songIds:songs.map(s=>s.id)},
      {id:'prepared',title:'Prepared WAV stems',icon:'♪',songIds:songs.map(s=>s.id)},
      {id:'favorites',title:'Session favorites',icon:'♡',songIds:[]}] };
    for (const id of [1,2,3,4]) createParticipationActions(appState).set(id,'stemHandoff',false);
    const actions = createNativeStemHandoffActions(appState, mixer, () => refresh(), {incremental:!!options.incremental,firstPlayIncremental:!!options.firstPlayIncremental,liveLifecycle:!!options.liveLifecycle});
    actions.synchronizeAudio(); // Lazy: this does not create or resume audio.
    const native = id => mixer.getDeck(id), domain = id => appState.decks[id-1];
    function update() { refresh(); }
    function feedback(id, message) { messages[id]=message;notify('Deck '+id+' · '+message);update(); }
    function command(id, action, success) {
      try { const result=action();feedback(id,success);return result; }
      catch(error){feedback(id,'ERROR: '+error.message);return false;}
    }
    async function load(id, songId) {
      const song=model.findSong(songId);
      if (!song) return false;
      if(options.store && !song.metadata.available){feedback(id,'Stored assets missing or evicted. Reimport this song in Storage.');return false;}
      if (closed || loadingId!==null || pending) { feedback(id,'Wait for the current audio operation');return false; }
      if(native(id).getState().loaded){feedback(id,domain(id).song?.id===songId?'Already loaded — transport preserved':'Release this deck in Audio before replacing its song');return false;}
      const count=[1,2,3,4].filter(d=>native(d).getState().loaded).length;
      if (!native(id).getState().loaded && count>=maxLoadedDecks) { feedback(id,'Initial build: '+maxLoadedDecks+' loaded decks maximum. Audio → Release a deck first.');return false; }
      loadingId=id;operations[id]='loading';messages[id]='Preparing '+song.title;
      let step=0;const metadata=song.metadata;const beganAt=performance.now();let reused=false;
      try {
        const stems=names.map(n=>metadata.stems[n]);
        if (!stems.every(s=>s.format==='IEEE float32' && [1,2].includes(s.channels) && Number.isInteger(s.frames) && s.frames>0 && s.frames===stems[0].frames && [44100,48000].includes(s.sampleRate) && s.sampleRate===stems[0].sampleRate && Number.isInteger(s.encodedBytes))) throw new Error('Invalid aligned WAV metadata');
        const files=Object.fromEntries(names.map(name=>[name,{name:name+'.wav',async arrayBuffer(){
          messages[id]=`${options.store?'Reading stored':'Downloading'} ${++step}/4: ${name}`;update();
          if(options.store){
            const blob=await options.store.asset(metadata.localId,name);
            if(blob.size!==metadata.stems[name].encodedBytes)throw new Error('Stored size mismatch; reimport '+name);
            const bytes=await blob.arrayBuffer();
            messages[id]=`Decoding ${step}/4: ${name}`;update();return bytes;
          }
          const response=await fetch(metadata.stems[name].url,{cache:'no-store'});
          if(!response.ok)throw new Error(name+': HTTP '+response.status);
          const bytes=await response.arrayBuffer();
          if(bytes.byteLength!==metadata.stems[name].encodedBytes)throw new Error(name+': size mismatch');
          messages[id]=`Decoding ${step}/4: ${name}`;update();return bytes;
        }}]));
        // Native load resumes synchronously from this explicit loading gesture,
        // before the first fetch/decode await. It owns sequential decoding.
        const cached=pool?.find(song.id);reused=!!cached;
        if(reused)messages[id]='Reusing decoded stems · independent deck timeline';
        const promise=cached ? native(id).loadDecodedBuffers(cached) : native(id).loadFiles(files);update();
        if(!await promise)throw new Error('Load cancelled');
        if(pool)pool.attach(id,song.id,native(id));
        domain(id).song=song;stopped[id]=false;
        saveAssignments();
        feedback(id,'Loaded '+song.title+' · adjust Main and stems; no autoplay');
        return true;
      }catch(error){feedback(id,'LOAD ERROR: '+error.message);return false;}
      finally{loads.push({deckId:id,songId,reused,durationMs:performance.now()-beganAt,loaded:native(id).getState().loaded});loadingId=null;operations[id]=null;update();}
    }
    async function play(id) {
      if(closed || pending || native(id).getState().loading)return false;
      if(!native(id).getState().loaded){feedback(id,'Select a real song in Library and load it first');return false;}
      if(native(id).getState().isPlaying)return command(id,()=>native(id).pause(),'Paused');
      pending=true;operations[id]='starting';
      try {
        // Call before render/await: the native adapter resumes in this user gesture.
        const promise=actions.play(id);update();const started=await promise;
        if(started){stopped[id]=false;feedback(id,'Playing');}
        else feedback(id,'Start cancelled');
        return started;
      }catch(error){feedback(id,'PLAY ERROR: '+error.message);return false;}
      finally{pending=false;operations[id]=null;update();}
    }
    function level(id,index,value) {
      return command(id,()=>index===null ? actions.setMainVolume(id,value,'ui-main-'+performance.now()) :
        actions.setStemLevel(id,names[index],Math.round(value*100)/100,'ui-stem-'+performance.now()),index===null?'Main updated':'Stem updated');
    }
    function handoff(id) {
      return command(id,()=>{
        const enabled=appState.stemSession.automaticHandoffEnabled && appState.participation.byDeck[id].stemHandoff;
        if(!enabled && !appState.stemSession.automaticHandoffEnabled){
          for(const d of [1,2,3,4])actions.setParticipation(d,d===id);
          actions.setEnabled(true);
        }else actions.setParticipation(id,!enabled);
      },'Handoff updated');
    }
    function saveAssignments(){
      if(options.store)void options.store.saveAssignments(Object.fromEntries([1,2,3,4].map(id=>[id,domain(id).song?.id]))).catch(error=>notify('Audio remains loaded; assignment save failed: '+error.message));
    }
    function release(id) {
      if(pending || loadingId!==null){feedback(id,'Wait for the current audio operation before Release');return false;}
      return command(id,()=>{native(id).eject();pool?.release(id);domain(id).song=null;saveAssignments();},'Released');
    }
    function createViewState() {
      ui=original.createState();ui.songId=songs[0]?.id || null;
      ui.columnLibraries.forEach(local=>{local.songId=songs[0]?.id || null;});
      ui.decks.forEach(deck=>Object.defineProperties(deck,{
        songId:{get:()=>native(deck.id).getState().loaded?domain(deck.id).song?.id || null:null,configurable:true},
        playing:{get:()=>native(deck.id).getState().isPlaying,configurable:true},
        position:{get:()=>native(deck.id).getState().position,configurable:true},
        volume:{get:()=>domain(deck.id).volume,configurable:true},
        stems:{get:()=>names.map(name=>domain(deck.id).stems.allocatedLevels[name]),configurable:true},
        handoff:{get:()=>appState.stemSession.automaticHandoffEnabled && appState.participation.byDeck[deck.id].stemHandoff,configurable:true}
      }));
      return ui;
    }
    // Column libraries call the common action directly. Do not let the simulation
    // write audio fields or announce completion before a decode actually finishes.
    model.loadSelected=(state,id)=>{void load(id,state.songId);return false;};
    model.togglePlay=(state,id)=>{void play(id);return false;};
    model.setLevel=(state,id,index,value)=>level(id,index,value);
    model.eject=(state,id)=>release(id);
    model.setDeckControl=(state,id,key,value)=>['columnMode','sliceView'].includes(key)?original.setDeckControl(state,id,key,value):false;
    model.adjustMatchedControl=()=>false;
    model.setPerformanceControl=()=>false;
    model.waveformGesture=()=>false;
    design.performanceProgress=deck=>{
      const duration=native(deck.id).getState().duration,position=Math.min(duration,deck.position);
      const time=v=>Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0');
      return {fraction:duration?position/duration:0,text:time(position)+' / −'+time(duration-position),remaining:duration-position};
    };
    function refreshLocalSongs(records){
      if(!options.store)return;
      songs.splice(0,songs.length,...records.map(design.localSongRecord));
      const ids=songs.map(song=>song.id);
      for(const playlist of ui.playlists)playlist.songIds=['all','prepared'].includes(playlist.id)?[...ids]:playlist.songIds.filter(id=>ids.includes(id));
      if(!ids.includes(ui.songId))ui.songId=ids[0]||null;
      if(ui.context?.songId&&!ids.includes(ui.context.songId))ui.context=null;
      for(const local of ui.columnLibraries){if(local.context?.songId&&!ids.includes(local.context.songId))local.context=null;if(!ids.includes(local.songId))local.songId=ids[0]||null;}
      update();
    }
    return {mixer,createViewState,load,play,level,handoff,release,refreshLocalSongs,
      touchLevel:(id,index)=>command(id,()=>actions.touchStem(id,names[index]),'Stem selected'),
      attach(render){refresh=render;},
      busy:()=>({loadingId,pending}), message:id=>messages[id] || '',
      operation:id=>operations[id],
      stop:id=>command(id,()=>{native(id).stop();stopped[id]=true;},'Stopped'),
      diagnostics:()=>({build,sharedPCM:pool?.diagnostics() || null,loads,messages,busy:{loadingId,pending},state:appState,
        audio:actions.getDiagnostics(),alignment:'Equal decoded lengths/rates checked; supplied common export origin assumed.'}),
      async close(){closed=true;actions.dispose();try{await mixer.close();}finally{pool?.clear();}},
      status:id=>operations[id] || (!native(id).getState().loaded?'EMPTY':native(id).getState().isPlaying?'PLAYING':stopped[id]?'STOPPED':'READY')
    };
  };
})();

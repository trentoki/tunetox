// Storage management only. The approved mixer remains shared and unchanged.
(() => {
 const design=globalThis.TuneToxDesign,names=['transients','flow','tune','voice'];
 design.attachLocalAudioPanel=async function(store,controller,render,announce){
  const dialog=document.getElementById('local-audio-panel'),root=document.getElementById('storage-content');
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const button=(text,action)=>{const b=el('button',text);b.type='button';b.addEventListener('click',action);return b;};
  const status=el('p','Storage checkpoint only: encoded stems are retained; songs decode only when you press Load. F3 paused/Release behavior remains; those fixes are pending.');status.setAttribute('role','status');
  const info=el('p'),list=el('div'),assignments=el('div');
  const title=el('input');title.id='storage-song-title';title.placeholder='Song name';title.maxLength=200;title.setAttribute('aria-label','Imported song name');
  const files=el('input');files.type='file';files.multiple=true;files.accept='.wav';files.id='storage-files';files.setAttribute('aria-label','Select four aligned WAV stems');
  let busy=false;
  function guardImport(){
   if(controller.busy().loadingId!==null||controller.busy().pending||[1,2,3,4].some(id=>controller.mixer.getDeck(id).getState().loaded))throw new Error('Release loaded decks in Audio before importing. This bounds import memory; stored songs remain available.');
  }
  async function run(action){
   if(busy)return;busy=true;root.setAttribute('aria-busy','true');
   try{await action();await refresh();}catch(error){status.textContent='ERROR: '+error.message;announce(status.textContent);}
   finally{busy=false;root.setAttribute('aria-busy','false');}
  }
  function preparedFiles(selected){
   const mapped={};for(const file of selected){const key=file.name.toLowerCase().replace(/\.wav$/,'');if(!names.includes(key))continue;if(mapped[key])throw new Error('Duplicate '+key+' file selected');mapped[key]=file;}
   if(names.some(name=>!mapped[name]))throw new Error('Select transients.wav, flow.wav, tune.wav and voice.wav together.');return mapped;
  }
  const importButton=button('Import selected stems once',()=>run(async()=>{
   guardImport();const song=await store.importSong(title.value,preparedFiles(files.files),message=>{status.textContent=message;});
   status.textContent=(song.duplicate?'Already stored — no duplicate: ':'Stored: ')+song.title;files.value='';
  }));
  const folder=el('input');folder.type='file';folder.multiple=true;folder.webkitdirectory=true;folder.id='storage-folder';folder.setAttribute('aria-label','Optional: select a folder containing songs and their four stems');
  const folderButton=button('Import song folders',()=>run(async()=>{
   guardImport();const groups=new Map();
   for(const file of folder.files){if(!/^(transients|flow|tune|voice)\.wav$/i.test(file.name))continue;
    const path=file.webkitRelativePath.split('/');path.pop();const key=path.join('/');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(file);}
   if(!groups.size)throw new Error('No prepared song folders found. Use the four-file picker if folder selection is unavailable.');
   for(const [path,group] of groups){const song=await store.importSong(path.split('/').pop(),preparedFiles(group),message=>{status.textContent=message;});status.textContent='Stored '+song.title;}
   folder.value='';status.textContent='Folder import complete. Duplicate sets were reused.';
  }));
  const lan=button('Import a prepared LAN test song',()=>run(async()=>{
   guardImport();const response=await fetch('/two-deck-manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('LAN catalog unavailable. Import local files instead.');
   const catalog=await response.json();serverChoices.replaceChildren();
   for(const metadata of Object.values(catalog.decks))serverChoices.append(button('Store '+metadata.song,()=>run(async()=>{
    guardImport();const selected={};
    for(const name of names){status.textContent='Transferring once: '+name;const response=await fetch(metadata.stems[name].url,{cache:'no-store'});if(!response.ok)throw new Error(name+': HTTP '+response.status);selected[name]=await response.blob();}
    const song=await store.importSong(metadata.song,selected,message=>{status.textContent=message;});status.textContent=song.duplicate?'Already stored; duplicate avoided.':'Stored '+song.title;
   })));
  }));
  const serverChoices=el('div');
  const persistence=button('Request retained storage',()=>run(async()=>{const granted=await store.requestPersistence();status.textContent=granted?'Browser granted persistent storage. User clearing still removes it.':'Persistence not granted/available. Safari may evict data; keep original files.';}));
  root.append(status,info,el('p','Select four float32 WAV stems, or choose song folders. Original AIFFs are not required or modified.'),title,files,importButton,el('p','Optional folder import:'),folder,folderButton,lan,serverChoices,persistence,el('h3','Stored songs'),list,el('h3','Previous assignments — load manually, never autoplay'),assignments);
  async function refresh(){
   const songs=await store.list();controller.refreshLocalSongs(songs);const details=await store.info();
   info.textContent=songs.length+' stored songs · '+(songs.reduce((sum,song)=>sum+song.bytes,0)/1048576).toFixed(1)+' MiB encoded · '+details.origin+' · '+(details.persisted?'persistence granted':'eviction possible')+(details.estimate?' · estimated free '+((details.estimate.quota-details.estimate.usage)/1048576).toFixed(0)+' MiB':' · quota estimate unavailable');
   list.replaceChildren();for(const song of songs){
    const row=el('div');row.className='stored-song';row.append(el('strong',song.title+(song.available?' — stored':' — ASSETS MISSING; remove this entry and reimport')));
    for(const id of [1,2,3,4])row.append(button('Load D'+id,()=>{if(busy)return;void controller.load(id,'local-'+song.id);}));
    row.append(button('Remove local copy',()=>run(async()=>{
     if([1,2,3,4].some(id=>controller.diagnostics().state.decks[id-1].song?.id==='local-'+song.id))throw new Error('Release decks using this song before removing its stored copy.');
     await store.remove(song.id);status.textContent='Removed stored copy. Original files unchanged.';
    })));list.append(row);
   }
   const previous=await store.assignments();assignments.replaceChildren();
   for(const [id,songId] of Object.entries(previous)){const song=songs.find(song=>'local-'+song.id===songId);assignments.append(button('Restore D'+id+': '+(song?.title||'missing — reimport'),()=>{if(!busy&&song)void controller.load(Number(id),songId);}));}
   if(!Object.keys(previous).length)assignments.textContent='No previous assignments saved. Main always starts at zero; transport never resumes automatically.';
   render();
  }
  document.getElementById('storage-open').addEventListener('click',()=>{dialog.showModal();void refresh().catch(error=>{status.textContent='ERROR: '+error.message;});});
  document.getElementById('storage-close').addEventListener('click',()=>dialog.close());
  window.addEventListener('pagehide',()=>store.close());
  window.addEventListener('beforeunload',event=>{
   if([1,2,3,4].some(id=>controller.mixer.getDeck(id).getState().isPlaying)){event.preventDefault();event.returnValue='';}
  });
  await refresh();
  return {refresh};
 };
})();

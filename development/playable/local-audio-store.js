// Encoded assets only. Listing/importing never creates AudioBuffers or audio nodes.
(() => {
 const design=globalThis.TuneToxDesign;
 const names=['transients','flow','tune','voice'];
 const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 function complete(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Storage transaction aborted'));tx.onerror=()=>{};});}
 function storageError(error){
  return new Error(error?.name==='QuotaExceededError'?'Not enough Safari storage. Nothing was imported; free space and retry.':error?.message||'Local audio storage is unavailable');
 }
 design.createLocalAudioStore=async function(dbName='tunetox-local-audio-v1'){
  if(!globalThis.indexedDB)throw new Error('IndexedDB unavailable. Use a normal Safari tab with website storage enabled.');
  const opening=indexedDB.open(dbName,1);
  opening.onupgradeneeded=()=>{const db=opening.result;db.createObjectStore('songs',{keyPath:'id',autoIncrement:true});db.createObjectStore('assets');db.createObjectStore('settings');};
  const db=await new Promise((resolve,reject)=>{let blocked=false;opening.onblocked=()=>{blocked=true;reject(new Error('Storage upgrade blocked. Close other TuneTox tabs and retry.'));};opening.onerror=()=>reject(storageError(opening.error));opening.onsuccess=()=>{if(blocked)opening.result.close();else resolve(opening.result);};});
  db.onversionchange=()=>db.close();let importing=false;
  async function get(store,key){const tx=db.transaction(store);const done=complete(tx);const [value]=await Promise.all([request(tx.objectStore(store).get(key)),done]);return value;}
  async function list(){
   const tx=db.transaction('songs');const done=complete(tx);
   const [songs]=await Promise.all([request(tx.objectStore('songs').getAll()),done]);
   if(!songs.length)return [];
   for(const song of songs)if(!Number.isInteger(song.id)||typeof song.title!=='string'||!song.stems||
     !names.every(name=>Number.isInteger(song.stems[name]?.encodedBytes)&&song.stems[name].encodedBytes>0))throw new Error('Stored catalog is invalid. Remove damaged website data and reimport originals.');
   // Use a fresh transaction after awaiting metadata: Safari may auto-commit an
   // idle transaction. Queue all key reads synchronously before the first await.
   const keysTx=db.transaction('assets'),keysDone=complete(keysTx);
   const reads=songs.map(song=>Promise.all(names.map(name=>request(keysTx.objectStore('assets').getKey(song.id+':'+name)))));
   const [keys]=await Promise.all([Promise.all(reads),keysDone]);
   return songs.map((song,index)=>({...song,available:keys[index].every(key=>key!==undefined)}));
  }
  async function asset(id,name){
   if(!Number.isInteger(id)||!names.includes(name))throw new Error('Invalid stored stem identity');
   const record=await get('assets',id+':'+name);
   if(!record || !(record.blob instanceof Blob))throw new Error('Stored '+name+' is missing or was evicted. Reimport this song.');
   return record.blob;
  }
  async function equalBlobs(a,b){
   if(a.size!==b.size)return false;
   for(let offset=0;offset<a.size;offset+=1024*1024){
    const [x,y]=await Promise.all([a.slice(offset,offset+1024*1024).arrayBuffer(),b.slice(offset,offset+1024*1024).arrayBuffer()]);
    const left=new Uint8Array(x),right=new Uint8Array(y);
    for(let i=0;i<left.length;i++)if(left[i]!==right[i])return false;
   }return true;
  }
  async function importSong(title,files,progress=()=>{}){
   if(importing)throw new Error('Another import is running. Wait for it to finish.');
   importing=true;
   try{
    if(typeof title!=='string'||!title.trim()||title.length>200)throw new Error('Enter a song name (1–200 characters).');
    const stems={};let bytes=0;
    for(const name of names){
     const file=files[name];if(!(file instanceof Blob)||file.size>512*1024*1024)throw new Error('Select '+name+'.wav (maximum 512 MiB per stem).');
     progress('Checking '+name);const wav=await inspectPcmWav(file);
     if(wav.encoding!==3||wav.bits!==32||![44100,48000].includes(wav.rate))throw new Error('Prepared stems must be float32 WAV at 44.1 or 48 kHz.');
     stems[name]={format:'IEEE float32',channels:wav.channels,sampleRate:wav.rate,frames:wav.frames,duration:wav.frames/wav.rate,encodedBytes:file.size};bytes+=file.size;
    }
    const first=stems.transients;
    if(!names.every(name=>stems[name].frames===first.frames&&stems[name].sampleRate===first.sampleRate))throw new Error('Stems must have equal frames and sample rate. Re-export them aligned.');
    // Exact bounded comparisons, independent of names/mtime. No hash collisions,
    // full-song hashing buffers, AudioBuffers or insecure-context crypto dependency.
    for(const song of await list()){
     if(!song.available||!names.every(name=>song.stems[name].encodedBytes===stems[name].encodedBytes))continue;
     progress('Checking existing song '+song.title);let equal=true;
     for(const name of names)if(!await equalBlobs(files[name],await asset(song.id,name))){equal=false;break;}
     if(equal)return {...song,duplicate:true};
    }
    const estimate=await navigator.storage?.estimate?.();
    if(estimate?.quota && estimate.usage+bytes>estimate.quota)throw new Error('Not enough estimated storage for this song. Free space and retry.');
    progress('Saving four stems atomically');
    const song={title:title.trim(),stems,bytes,createdAt:new Date().toISOString()};
    const tx=db.transaction(['songs','assets'],'readwrite');const done=complete(tx);
    const add=tx.objectStore('songs').add(song);
    let writeError=null;
    add.onsuccess=()=>{try{song.id=add.result;for(const name of names)tx.objectStore('assets').put({blob:files[name]},song.id+':'+name);}catch(error){writeError=error;tx.abort();}};
    try{await done;}catch(error){throw writeError||error;}return {...song,available:true,duplicate:false};
   }catch(error){throw storageError(error);}finally{importing=false;}
  }
  async function remove(id){
   if(importing)throw new Error('Wait for import before removing a song.');
   const tx=db.transaction(['songs','assets'],'readwrite'),done=complete(tx);
   tx.objectStore('songs').delete(id);for(const name of names)tx.objectStore('assets').delete(id+':'+name);await done;
  }
  async function saveAssignments(assignments){
   const safe={};for(const id of [1,2,3,4])if(typeof assignments[id]==='string'&&/^local-\d+$/.test(assignments[id]))safe[id]=assignments[id];
   const tx=db.transaction('settings','readwrite'),done=complete(tx);tx.objectStore('settings').put(safe,'assignments');await done;
  }
  return {list,asset,importSong,remove,saveAssignments,assignments:async()=>await get('settings','assignments')||{},
   async info(){return {estimate:await navigator.storage?.estimate?.()||null,persisted:await navigator.storage?.persisted?.()||false,origin:location.origin};},
   async requestPersistence(){return await navigator.storage?.persist?.()||false;},close(){db.close();}};
 };
 design.localSongRecord=song=>({id:'local-'+song.id,title:song.title,artist:'Stored locally',bpm:'—',key:'—',color:'#54e8df',
  duration:Math.floor(song.stems.flow.duration/60)+':'+String(Math.floor(song.stems.flow.duration%60)).padStart(2,'0'),
  metadata:{song:song.title,stems:song.stems,localId:song.id,available:song.available}});
})();

// Deterministic calculations and transactions, exercised in real browser IndexedDB.
async function runLocalAudioStoreTests(){
 let checks=0;const check=(x,label)=>{checks++;if(!x)throw new Error(label);};
 const names=['transients','flow','tune','voice'];
 function wav(value,frames=128){
  const bytes=new ArrayBuffer(44+frames*4),v=new DataView(bytes),text=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,3,true);v.setUint16(22,1,true);v.setUint32(24,44100,true);v.setUint32(28,176400,true);v.setUint16(32,4,true);v.setUint16(34,32,true);text(36,'data');v.setUint32(40,frames*4,true);for(let i=0;i<frames;i++)v.setFloat32(44+i*4,value,true);
  return new File([bytes],'test.wav',{type:'audio/wav'});
 }
 const files=seed=>Object.fromEntries(names.map((name,i)=>[name,wav(seed+i*.01)]));
 const dbName='tunetox-store-test-'+Date.now();let store=await TuneToxDesign.createLocalAudioStore(dbName);
 const originalDecode=AudioContext.prototype.decodeAudioData;let decodes=0;
 AudioContext.prototype.decodeAudioData=function(){decodes++;throw new Error('Storage must not decode');};
 async function reject(action,label){let error;try{await action();}catch(e){error=e;}check(!!error,label);return error;}
 try{
  check((await store.list()).length===0,'Empty metadata list');
  const songs=[];
  for(let i=1;i<=4;i++)songs.push(await store.importSong('Song '+i,files(i*.1)));
  check((await store.list()).length===4,'Four independent songs stored');
  const repeat=await store.importSong('Renamed duplicate',files(.1));
  check(repeat.duplicate&&repeat.id===songs[0].id&&(await store.list()).length===4,'Exact duplicate reused despite renamed input');
  await store.importSong('Same filename different contents',files(.15));
  check((await store.list()).length===5,'Same filenames/lengths with different samples stay distinct');
  await reject(()=>store.importSong('Missing',{transients:wav(.1)}),'Missing stem rejected');
  await reject(()=>store.importSong('Invalid',{...files(.1),voice:new Blob(['bad'])}),'Malformed WAV rejected');
  await reject(()=>store.importSong('Misaligned',{...files(.1),voice:wav(.4,129)}),'Alignment rejected');
  check((await store.list()).length===5,'Validation failures create no partial metadata');
  const priorPut=IDBObjectStore.prototype.put;let writes=0;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='assets'&&++writes===2)throw new DOMException('Injected storage exhaustion','QuotaExceededError');return priorPut.apply(this,args);};
  let failure;
  try{failure=await reject(()=>store.importSong('Must roll back',files(.71)),'Failed write rejects import');}
  finally{IDBObjectStore.prototype.put=priorPut;}
  check(failure.message.includes('Not enough Safari storage'),'Quota failure has clear recovery message');
  check((await store.list()).length===5,'Atomic rollback removes song and all partial assets');
  await store.saveAssignments({1:'local-'+songs[0].id,2:'local-'+songs[1].id,3:'untrusted',9:'local-1'});
  check(Object.keys(await store.assignments()).length===2,'Assignment validation excludes invalid deck/song identifiers');
  store.close();store=await TuneToxDesign.createLocalAudioStore(dbName);
  check((await store.list()).length===5&&(await store.assignments())[1]==='local-'+songs[0].id,'Reopen retains metadata and assignments');
  const blob=await store.asset(songs[0].id,'tune');check(blob.size===556,'Stored asset retrieved without a network path');
  const db=await new Promise(resolve=>{const r=indexedDB.open(dbName);r.onsuccess=()=>resolve(r.result);});
  const tx=db.transaction('assets','readwrite');tx.objectStore('assets').delete(songs[0].id+':voice');await new Promise(resolve=>tx.oncomplete=resolve);db.close();
  check(!(await store.list()).find(s=>s.id===songs[0].id).available,'Evicted/missing stem marked unavailable');
  await reject(()=>store.asset(songs[0].id,'voice'),'Missing asset reports reimport instead of silently fetching');
  await store.remove(songs[0].id);check((await store.list()).length===4,'Removal updates catalog');
  await reject(()=>store.asset(songs[0].id,'flow'),'Removal deletes associated blobs');
  check(decodes===0,'All import/list/duplicate checks performed without audio decoding');
  return {checks,decodes};
 }finally{AudioContext.prototype.decodeAudioData=originalDecode;store.close();indexedDB.deleteDatabase(dbName);}
}

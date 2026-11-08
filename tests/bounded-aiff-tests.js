function makeBoundedAiffFixture({form='AIFC',compression='NONE',bits=16,channels=2,frames=480,rate=48000,skip=5,soundFirst=false,sample=(f,c)=>c?-.25:.5}={}) {
  const width=Math.ceil(bits/8),align=width*channels,chunks=[];
  const id=(view,at,text)=>{for(let i=0;i<text.length;i++)view.setUint8(at+i,text.charCodeAt(i));};
  function chunk(name,size){const raw=new ArrayBuffer(8+size+size%2),view=new DataView(raw);id(view,0,name);view.setUint32(4,size,false);return{raw,view,name};}
  const comm=chunk('COMM',form==='AIFC'?24:18);comm.view.setUint16(8,channels,false);comm.view.setUint32(10,frames,false);comm.view.setUint16(14,bits,false);
  const power=Math.floor(Math.log2(rate)),mantissa=rate/2**power*2**31,high=Math.floor(mantissa),low=Math.round((mantissa-high)*2**32);
  comm.view.setUint16(16,power+16383,false);comm.view.setUint32(18,high,false);comm.view.setUint32(22,low,false);
  if(form==='AIFC'){id(comm.view,26,compression);comm.view.setUint8(30,0);}
  const sound=chunk('SSND',8+skip+frames*align+3);sound.view.setUint32(8,skip,false);sound.view.setUint32(12,0,false);
  for(let f=0;f<frames;f++)for(let c=0;c<channels;c++){
    const at=16+skip+(f*channels+c)*width,value=sample(f,c),little=compression==='sowt';
    if(['fl32','FL32'].includes(compression))sound.view.setFloat32(at,value,false);
    else {const integer=Math.round(value*(2**(bits-1)-1))*2**(width*8-bits);
      if(width===1)sound.view.setInt8(at,integer);
      else if(width===2)sound.view.setInt16(at,integer,little);
      else if(width===3){for(let b=0;b<3;b++)sound.view.setUint8(at+b,(integer>>(8*(little?b:2-b)))&255);}
      else sound.view.setInt32(at,integer,little);
    }
  }
  if(form==='AIFC'){const version=chunk('FVER',4);version.view.setUint32(8,0xa2805140,false);chunks.push(version);}
  chunks.push(chunk('ANNO',3),...(soundFirst?[sound,comm]:[comm,sound]));
  const size=12+chunks.reduce((sum,c)=>sum+c.raw.byteLength,0),raw=new ArrayBuffer(size),view=new DataView(raw),positions={};
  id(view,0,'FORM');view.setUint32(4,size-8,false);id(view,8,form);let at=12;
  for(const part of chunks){positions[part.name]=at+8;new Uint8Array(raw,at,part.raw.byteLength).set(new Uint8Array(part.raw));at+=part.raw.byteLength;}
  const reads=[];
  return{name:'misleading.wav',type:'',size,raw,positions,reads,slice(start,end){reads.push([start,end]);return{arrayBuffer:async()=>raw.slice(start,end)};}};
}
async function runBoundedAiffTests(){
  const check=(v,m)=>{if(!v)throw new Error(m);};
  async function rejects(file,code){let message='';try{await inspectBoundedAudioFile(file);}catch(error){message=error.message;}check(message.includes(code),'Expected '+code+', received '+message);}
  for(const [form,compression] of [['AIFF','NONE'],['AIFC','NONE'],['AIFC','sowt']])for(const bits of [8,16,20,24,32]){
    const file=makeBoundedAiffFixture({form,compression,bits,frames:481,soundFirst:true}),meta=await inspectBoundedAudioFile(file);
    check(meta.frames===481&&meta.rate===48000&&meta.container===(form==='AIFF'?'AIFF':'AIFF-C'),'Header dispatch and COMM rate/count');
    check(file.reads.every(([a,b])=>b-a<=23),'AIFF header reads stay small and skip SSND payload');
    const pcm=await readPcmWavFrames(meta,100,20);
    check(Math.abs(pcm[0][0]-.5)<.01&&Math.abs(pcm[1][0]+.25)<.01,'Byte order, signed 8-bit, reduced-width and SSND offset handling');
    check(file.reads.at(-1)[0]===file.positions.SSND+8+5+100*meta.align,'Seek addresses correct SSND frame');
  }
  for(const rate of [22050,44100,48000,96000,192000])check((await inspectBoundedAudioFile(makeBoundedAiffFixture({rate}))).rate===rate,'80-bit sample-rate representation');
  for(const compression of ['fl32','FL32']){
    const meta=await inspectBoundedAudioFile(makeBoundedAiffFixture({compression,bits:32,sample:()=>1.25}));
    check((await readPcmWavFrames(meta,0,1))[0][0]===1.25,'AIFF-C float32 preserves headroom and byte ordering');
  }
  for(const compression of ['ulaw','ima4','fl64'])await rejects(makeBoundedAiffFixture({compression}),'AIFF_COMPRESSION_UNSUPPORTED');
  const malformed=makeBoundedAiffFixture();new DataView(malformed.raw).setUint32(malformed.positions.SSND,0xffffffff,false);await rejects(malformed,'AIFF_SSND_OFFSET');
  const shortData=makeBoundedAiffFixture();new DataView(shortData.raw).setUint32(shortData.positions.COMM+2,100000,false);await rejects(shortData,'AIFF_FRAME_DATA');
  const rate=makeBoundedAiffFixture();new DataView(rate.raw).setUint16(rate.positions.COMM+8,0x7fff,false);await rejects(rate,'AIFF_SAMPLE_RATE');
  const negative=makeBoundedAiffFixture();new DataView(negative.raw).setUint16(negative.positions.COMM+8,0xc00e,false);await rejects(negative,'AIFF_SAMPLE_RATE');
  const version=makeBoundedAiffFixture();new DataView(version.raw).setUint32(version.positions.FVER,0,false);await rejects(version,'AIFF_VERSION_UNSUPPORTED');
  const missing=makeBoundedAiffFixture();new DataView(missing.raw).setUint32(missing.positions.COMM-8,0,false);await rejects(missing,'AIFF_MISSING_COMM');
  const chunk=makeBoundedAiffFixture();new DataView(chunk.raw).setUint32(chunk.positions.SSND-4,0xffffffff,false);await rejects(chunk,'AIFF_CHUNK_SIZE');
  const missingSound=makeBoundedAiffFixture();new DataView(missingSound.raw).setUint32(missingSound.positions.SSND-8,0,false);await rejects(missingSound,'AIFF_MISSING_SSND');
  const missingVersion=makeBoundedAiffFixture();new DataView(missingVersion.raw).setUint32(missingVersion.positions.FVER-8,0,false);await rejects(missingVersion,'AIFF_MISSING_FVER');
  const name=makeBoundedAiffFixture();new DataView(name.raw).setUint8(name.positions.COMM+22,255);await rejects(name,'AIFF_COMPRESSION_NAME');
  const formSize=makeBoundedAiffFixture();new DataView(formSize.raw).setUint32(4,formSize.size+100,false);await rejects(formSize,'AIFF_FORM_SIZE');
  const unsupportedForm=makeBoundedAiffFixture({form:'ABCD'});await rejects(unsupportedForm,'AIFF_FORM_UNSUPPORTED');
  const nonfinite=await inspectBoundedAudioFile(makeBoundedAiffFixture({compression:'fl32',bits:32,sample:()=>NaN}));
  let failed=false;try{await readPcmWavFrames(nonfinite,0,1);}catch(error){failed=error.message.includes('AIFF_NONFINITE_FLOAT');}check(failed,'AIFF float nonfinite data rejects during bounded read');
  const wav=makeBoundedWavFixture({frames:480});check((await inspectBoundedAudioFile(wav)).container==='RIFF/WAVE','Existing WAV dispatch remains supported');
  console.log('Bounded AIFF/AIFF-C tests passed: detection, NONE/sowt/float32, extended rates, offsets, padding, chunk order and rejected variants');
}

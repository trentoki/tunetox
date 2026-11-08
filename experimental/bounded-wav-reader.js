const streamingStemNames = Object.freeze(['transients','flow','tune','voice']);
async function inspectPcmWav(file) {
  const fail = (code, message) => { throw new Error((file.name || 'Selected file') + ' [' + code + ']: ' + message); };
  async function bytes(start, count) {
    if (start + count > file.size) fail('WAV_TRUNCATED', 'Read extends past file at byte ' + start + '.');
    const data = await file.slice(start, start + count).arrayBuffer();
    if (data.byteLength !== count) fail('WAV_SHORT_READ', 'Expected ' + count + ' bytes at offset ' + start + ', received ' + data.byteLength + '.');
    return new DataView(data);
  }
  const text = (view, at) => String.fromCharCode(...[0,1,2,3].map(i => view.getUint8(at + i)));
  const hex = view => Array.from({length:view.byteLength}, (_,i) => view.getUint8(i).toString(16).padStart(2,'0')).join(' ');
  if (file.size < 12) {
    const short = await bytes(0, file.size);
    fail('WAV_TRUNCATED', 'Header needs 12 bytes; file has ' + file.size + '. First bytes: ' + hex(short));
  }
  const header = await bytes(0,12), container = text(header,0), form = text(header,8);
  const signature = 'container=' + JSON.stringify(container) + ', form=' + JSON.stringify(form) + '; first 12 bytes: ' + hex(header);
  if (container === 'RF64' || container === 'BW64') fail('WAV_RF64_UNSUPPORTED', container + ' large-file container is not supported. ' + signature);
  if (container === 'RIFX') fail('WAV_ENDIAN_UNSUPPORTED', 'Big-endian RIFX WAV is not supported. ' + signature);
  if (container === 'FORM') fail('WAV_NOT_RIFF', 'FORM container (for example AIFF) is not RIFF/WAVE. ' + signature);
  if (container !== 'RIFF') fail('WAV_NOT_RIFF', 'Expected RIFF container. ' + signature);
  if (form !== 'WAVE') fail('WAV_NOT_WAVE', 'RIFF container does not identify WAVE audio. ' + signature);
  const end = header.getUint32(4,true) + 8;
  if (end < 12 || end > file.size) fail('WAV_RIFF_SIZE', 'Declared RIFF end ' + end + ' is invalid for ' + file.size + '-byte file.');
  let format = null, data = null, offset = 12;
  while (offset < end) {
    if (end - offset < 8) fail('WAV_CHUNK_HEADER', 'Incomplete chunk header at byte ' + offset + '.');
    const chunk = await bytes(offset,8), size = chunk.getUint32(4,true), name = text(chunk,0), start = offset + 8;
    if (start + size > end) fail('WAV_CHUNK_SIZE', 'Chunk ' + JSON.stringify(name) + ' at ' + offset + ' extends past RIFF end.');
    if (start + size + size%2 > end) fail('WAV_CHUNK_PADDING', 'Missing padding after odd-sized chunk at ' + offset + '.');
    if (name === 'fmt ') {
      if (format) fail('WAV_DUPLICATE_FMT', 'Multiple fmt chunks are not supported.');
      if (size < 16 || size === 17) fail('WAV_FMT_SIZE', 'Malformed fmt chunk: ' + size + ' bytes.');
      // Even unusually large format chunks cause at most a 40-byte read.
      const fmt = await bytes(start,Math.min(size,40));
      format = {tag:fmt.getUint16(0,true),channels:fmt.getUint16(2,true),rate:fmt.getUint32(4,true),
        byteRate:fmt.getUint32(8,true),align:fmt.getUint16(12,true),bits:fmt.getUint16(14,true)};
      format.encoding = format.tag;
      format.validBits = format.bits;
      if (size >= 18 && 18 + fmt.getUint16(16,true) > size) fail('WAV_FMT_EXTENSION', 'Declared fmt extension exceeds its chunk.');
      if (format.tag === 0xfffe) {
        if (size < 40 || fmt.getUint16(16,true) < 22) fail('WAV_EXTENSIBLE_SIZE', 'WAVE_FORMAT_EXTENSIBLE needs a 22-byte extension (40-byte fmt chunk).');
        format.validBits = fmt.getUint16(18,true);
        format.channelMask = fmt.getUint32(20,true);
        const guid = new DataView(fmt.buffer,fmt.byteOffset+24,16);
        const tail = [0,0,0x10,0,0x80,0,0,0xaa,0,0x38,0x9b,0x71];
        const code = guid.getUint32(0,true);
        if (!tail.every((value,i) => guid.getUint8(i+4) === value)) {
          fail('WAV_EXTENSIBLE_SUBFORMAT', 'Unsupported extensible SubFormat GUID bytes: ' + hex(guid) + '. Expected standard PCM or IEEE float.');
        }
        format.encoding = code;
      }
    }
    if (name === 'data') {
      if (data) fail('WAV_DUPLICATE_DATA', 'Multiple data chunks are not supported.');
      data = {offset:start,bytes:size};
    }
    offset = start + size + size%2;
  }
  if (!format) fail('WAV_MISSING_FMT', 'No fmt chunk found.');
  if (!data) fail('WAV_MISSING_DATA', 'No data chunk found.');
  if (![1,3].includes(format.encoding)) fail('WAV_COMPRESSION_UNSUPPORTED', 'Unsupported compression/encoding 0x' + format.encoding.toString(16) + ' (format tag 0x' + format.tag.toString(16) + '); only PCM and IEEE float are supported.');
  if (![1,2].includes(format.channels)) fail('WAV_CHANNELS_UNSUPPORTED', 'Expected mono/stereo; found ' + format.channels + ' channels.');
  if (format.encoding === 1 && ![8,16,24,32].includes(format.bits)) fail('WAV_PCM_WIDTH_UNSUPPORTED', 'Unsupported integer PCM container width: ' + format.bits + ' bits.');
  if (format.encoding === 3 && format.bits !== 32) fail('WAV_FLOAT_WIDTH_UNSUPPORTED', 'IEEE float WAV requires 32-bit samples; found ' + format.bits + ' bits.');
  if (format.validBits < 1 || format.validBits > format.bits || (format.encoding === 3 && format.validBits !== 32)) fail('WAV_VALID_BITS', 'Invalid valid-bits value ' + format.validBits + ' for ' + format.bits + '-bit container.');
  if (format.channelMask && !(format.channels === 1 ? [1,2,4] : [3]).includes(format.channelMask)) fail('WAV_CHANNEL_MASK_UNSUPPORTED', 'Unsupported mono/stereo speaker mask: 0x' + format.channelMask.toString(16) + '.');
  if (!format.rate || format.align !== format.channels*format.bits/8 || format.byteRate !== format.rate*format.align) fail('WAV_FRAME_LAYOUT', 'Invalid sample rate, block alignment or byte rate.');
  if (!data.bytes || data.bytes%format.align) fail('WAV_DATA_SIZE', 'Data must contain nonempty, complete sample frames.');
  return Object.freeze({...format,...data,container:'RIFF/WAVE',littleEndian:true,unsigned8:true,frames:data.bytes/format.align,file});
}
async function readPcmWavFrames(wav,start,count,timing=null,clock=()=>performance.now()) {
  if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<1||start+count>wav.frames)throw new Error('Invalid PCM frame range.');
  const readStarted=timing?clock():0;
  const raw=await wav.file.slice(wav.offset+start*wav.align,wav.offset+(start+count)*wav.align).arrayBuffer();
  const conversionStarted=timing?clock():0;
  if(timing)timing.readMs=conversionStarted-readStarted;
  if(raw.byteLength!==count*wav.align)throw new Error('Short PCM read.');
  const view=new DataView(raw),channels=Array.from({length:wav.channels},()=>new Float32Array(count)),width=wav.bits/8;
  for(let i=0;i<count;i++)for(let c=0;c<wav.channels;c++){
    const at=(i*wav.channels+c)*width,little=wav.littleEndian!==false;let sample;
    if(wav.encoding===3) {
      sample=view.getFloat32(at,little);
      if(!Number.isFinite(sample))throw new Error((wav.file.name||'Selected file')+(wav.container?.startsWith('AIFF')?' [AIFF_NONFINITE_FLOAT]':' [WAV_NONFINITE_FLOAT]')+': NaN/Infinity at source frame '+(start+i)+', channel '+c+'.');
    } else {
      let integer;
      if(width===1)integer=wav.unsigned8===false?view.getInt8(at):view.getUint8(at)-128;
      else if(width===2)integer=view.getInt16(at,little);
      else if(width===3){integer=little?view.getUint8(at)|(view.getUint8(at+1)<<8)|(view.getUint8(at+2)<<16):(view.getUint8(at)<<16)|(view.getUint8(at+1)<<8)|view.getUint8(at+2);if(integer&0x800000)integer-=0x1000000;}
      else integer=view.getInt32(at,little);
      // Extensible PCM valid bits are left-aligned in their integer container.
      const padding=wav.bits-wav.validBits;
      sample=Math.floor(integer/2**padding)/2**(wav.validBits-1);
    }
    channels[c][i]=sample; // Float headroom is preserved; no clipping/normalization of source samples.
  }
  if(timing)timing.conversionMs=clock()-conversionStarted;
  return channels;
}

// Dispatch by actual header bytes; legacy WAV-specific entry point remains testable unchanged.
async function inspectBoundedAudioFile(file) {
  const raw=await file.slice(0,Math.min(12,file.size)).arrayBuffer();
  const signature=String.fromCharCode(...new Uint8Array(raw));
  return signature.startsWith('FORM') ? inspectPcmAiff(file) : inspectPcmWav(file);
}
function readAiffSampleRate(view,offset) {
  const word=view.getUint16(offset,false),exponent=word&0x7fff;
  const high=view.getUint32(offset+2,false),low=view.getUint32(offset+6,false);
  if((word&0x8000)||exponent===0||exponent===0x7fff||!(high&0x80000000))throw new Error('Invalid/unsupported AIFF 80-bit sample rate.');
  const rate=(high+low/4294967296)*2**(exponent-16383-31);
  if(!Number.isFinite(rate)||!Number.isInteger(rate)||rate<=0)throw new Error('AIFF sample rate must be a positive whole number; received '+rate+'.');
  return rate;
}
async function inspectPcmAiff(file) {
  const fail=(code,message)=>{throw new Error((file.name||'Selected file')+' ['+code+']: '+message);};
  async function bytes(start,count){
    if(start+count>file.size)fail('AIFF_TRUNCATED','Read exceeds file at byte '+start+'.');
    const raw=await file.slice(start,start+count).arrayBuffer();
    if(raw.byteLength!==count)fail('AIFF_SHORT_READ','Short read at byte '+start+'.');return new DataView(raw);
  }
  const text=(view,at)=>String.fromCharCode(...[0,1,2,3].map(i=>view.getUint8(at+i)));
  if(file.size<12)fail('AIFF_TRUNCATED','FORM header requires 12 bytes.');
  const header=await bytes(0,12),form=text(header,8);
  if(text(header,0)!=='FORM'||!['AIFF','AIFC'].includes(form))fail('AIFF_FORM_UNSUPPORTED','Expected FORM/AIFF or FORM/AIFC; found '+JSON.stringify(text(header,0))+'/'+JSON.stringify(form)+'.');
  const end=header.getUint32(4,false)+8;
  if(end<12||end>file.size)fail('AIFF_FORM_SIZE','Invalid FORM extent '+end+' for '+file.size+'-byte file.');
  let common=null,sound=null,version=null,offset=12;
  while(offset<end){
    if(end-offset<8)fail('AIFF_CHUNK_HEADER','Incomplete chunk header at '+offset+'.');
    const chunk=await bytes(offset,8),name=text(chunk,0),size=chunk.getUint32(4,false),start=offset+8;
    if(start+size+size%2>end)fail('AIFF_CHUNK_SIZE','Chunk '+JSON.stringify(name)+' at '+offset+' exceeds FORM extent or lacks padding.');
    if(name==='COMM'){
      if(common)fail('AIFF_DUPLICATE_COMM','Duplicate COMM chunk.');
      if(size<(form==='AIFC'?23:18))fail('AIFF_COMM_SIZE','COMM chunk is too short for '+form+'.');
      const comm=await bytes(start,form==='AIFC'?23:18);
      let rate;try{rate=readAiffSampleRate(comm,8);}catch(error){fail('AIFF_SAMPLE_RATE',error.message);}
      common={channels:comm.getUint16(0,false),frames:comm.getUint32(2,false),validBits:comm.getUint16(6,false),rate,
        compression:form==='AIFC'?text(comm,18):'NONE'};
      if(form==='AIFC'&&23+comm.getUint8(22)>size)fail('AIFF_COMPRESSION_NAME','Pascal compression name extends beyond COMM.');
    }
    if(name==='SSND'){
      if(sound)fail('AIFF_DUPLICATE_SSND','Multiple SSND chunks are unsupported.');
      if(size<8)fail('AIFF_SSND_SIZE','SSND requires offset and block-size fields.');
      const ssnd=await bytes(start,8),skip=ssnd.getUint32(0,false);
      if(skip>size-8)fail('AIFF_SSND_OFFSET','SSND sample offset exceeds its payload.');
      sound={offset:start+8+skip,available:size-8-skip,blockSize:ssnd.getUint32(4,false)};
    }
    if(name==='FVER'){
      if(version!==null||size!==4)fail('AIFF_FVER_SIZE','Invalid/duplicate FVER chunk.');
      version=(await bytes(start,4)).getUint32(0,false);
      if(form==='AIFC'&&version!==0xa2805140)fail('AIFF_VERSION_UNSUPPORTED','Unsupported AIFF-C FVER 0x'+version.toString(16)+'.');
    }
    offset=start+size+size%2;
  }
  if(!common)fail('AIFF_MISSING_COMM','No COMM chunk.');
  if(!sound)fail('AIFF_MISSING_SSND','No SSND chunk.');
  if(form==='AIFC'&&version===null)fail('AIFF_MISSING_FVER','Standard AIFF-C requires an FVER chunk.');
  if(!['NONE','sowt','fl32','FL32'].includes(common.compression))fail('AIFF_COMPRESSION_UNSUPPORTED','Unsupported AIFF-C encoding '+JSON.stringify(common.compression)+'. Supported: NONE, sowt, fl32/FL32.');
  if(![1,2].includes(common.channels))fail('AIFF_CHANNELS_UNSUPPORTED','Expected mono/stereo; found '+common.channels+'.');
  const encoding=['fl32','FL32'].includes(common.compression)?3:1;
  if(common.validBits<1||common.validBits>32||(encoding===3&&common.validBits!==32))fail('AIFF_WIDTH_UNSUPPORTED','Unsupported sample width '+common.validBits+' for '+common.compression+'.');
  const bits=Math.ceil(common.validBits/8)*8,align=common.channels*bits/8,required=common.frames*align;
  if(!common.frames||required>sound.available)fail('AIFF_FRAME_DATA','COMM frame count requires '+required+' bytes; SSND has '+sound.available+'.');
  return Object.freeze({...common,...sound,container:form==='AIFC'?'AIFF-C':'AIFF',tag:common.compression,encoding,bits,align,bytes:required,
    littleEndian:common.compression==='sowt',unsigned8:false,file});
}

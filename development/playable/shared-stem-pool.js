// Page-local loading optimization only. AudioBuffers are read-only by contract;
// gain/transport/authorization state never enters the pool. Drop unused entries.
(() => {
  globalThis.TuneToxDesign.createSharedStemPool = function () {
    const entries = new Map(), songsByDeck = new Map();
    function release(id) {
      const songId=songsByDeck.get(id);if(!songId)return;
      const entry=entries.get(songId);entry.owners.delete(id);songsByDeck.delete(id);
      if(!entry.owners.size)entries.delete(songId);
    }
    return {
      find:songId=>entries.get(songId)?.buffers || null,
      attach(id,songId,player) {
        const buffers=player.getDecodedBuffers();
        if(!buffers)throw new Error('Cannot pool an incomplete native load');
        release(id);
        let entry=entries.get(songId);
        if(!entry){entry={buffers,owners:new Set()};entries.set(songId,entry);}
        for(const name of prototypeStemNames)if(entry.buffers[name]!==buffers[name])throw new Error('Shared stem identity mismatch');
        entry.owners.add(id);songsByDeck.set(id,songId);
      },
      release, clear(){entries.clear();songsByDeck.clear();},
      diagnostics(){
        let uniqueDecodedBytes=0;
        const songs=[...entries].map(([songId,entry])=>{
          const bytes=prototypeStemNames.reduce((sum,name)=>{const b=entry.buffers[name];return sum+b.length*b.numberOfChannels*4;},0);
          uniqueDecodedBytes+=bytes;return {songId,owners:[...entry.owners],decodedBytes:bytes};
        });
        return {songs,uniqueDecodedBytes,note:'Unique application AudioBuffer PCM only; native voice/decoder/network copies and browser overhead excluded.'};
      }
    };
  };
})();

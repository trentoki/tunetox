ObjC.import('Foundation');
function read(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
eval(['development/playable/playable-namespace.js','development/playable/stem-touch-priority.js','stem-state.js','four-deck-stem-allocation.js','tests/incremental-stem-tests.js'].map(read).join('\n')+'\nrunIncrementalStemTests();');

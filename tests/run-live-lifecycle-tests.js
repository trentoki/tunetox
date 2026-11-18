// macOS JXA runner, no dependencies.
ObjC.import('Foundation');
function read(path){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path,$.NSUTF8StringEncoding,null));}
const files=['development/playable/playable-namespace.js','development/design-mode/sampler-state.js','development/design-mode/state.js','participation.js','development/audio/handoff/stem-state.js','development/audio/handoff/two-deck-stem-handoff.js','development/audio/handoff/four-deck-stem-allocation.js','app.js','experimental/four-stem-player.js','development/audio/handoff/stem-handoff-audio-bridge.js','development/audio/handoff/native-stem-handoff.js','tests/coordinated-stem-start-tests.js','development/playable/shared-stem-pool.js','development/playable/playable-controller.js','tests/live-lifecycle-tests.js'];
eval(files.map(read).join('\n')+'\nrunLiveLifecycleTests({fixed:true}).catch(e=>{console.log("LIFECYCLE FAILED: "+e.message+" "+e.stack);throw e;});');

// Independent macOS runner; no dependency installation.
ObjC.import('Foundation');
function read(path){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path,$.NSUTF8StringEncoding,null));}
const files=['development/playable/playable-namespace.js','development/design-mode/sampler-state.js','development/design-mode/state.js','participation.js','stem-state.js','two-deck-stem-handoff.js','four-deck-stem-allocation.js','app.js','experimental/four-stem-player.js','experimental/stem-handoff-audio-bridge.js','native-stem-handoff.js','tests/coordinated-stem-start-tests.js','development/playable/playable-controller.js','tests/playable-ui-controller-tests.js'];
eval(files.map(read).join('\n')+'\nrunPlayableControllerTests().catch(e=>{console.log("PLAYABLE UI FAILED: "+e.message+" "+e.stack);throw e;});');

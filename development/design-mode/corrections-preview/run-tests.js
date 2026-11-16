ObjC.import('Foundation');
function read(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
globalThis.matchMedia=()=>({matches:true});
const root='development/design-mode/';
eval(['example-data.js','sampler-state.js','state.js','compact/state.js','fixed/state.js','responsive/state.js','responsive/queue-state.js','performance-preview/state.js','performance-preview/touch-fader.js','corrections-preview/state.js','corrections-preview/touch-fader.js','responsive/library.js','responsive/state-checks.js','performance-preview/state-checks.js','corrections-preview/state-checks.js'].map(p=>read(root+p)).join('\n')+'\n"PASS: "+runH51StateChecks()+" H5.1 state checks";');

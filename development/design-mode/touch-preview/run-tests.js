ObjC.import('Foundation');
function read(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
globalThis.matchMedia=()=>({matches:true});const root='development/design-mode/';
eval(['example-data.js','sampler-state.js','state.js','compact/state.js','fixed/state.js','responsive/state.js','responsive/queue-state.js','performance-preview/state.js','performance-preview/touch-fader.js','corrections-preview/state.js','corrections-preview/touch-fader.js','final-preview/state.js','final-preview/state-checks.js','portrait-preview/state-checks.js','touch-preview/ownership.js','touch-preview/state-checks.js'].map(p=>read(root+p)).join('\n')+'\n"PASS: "+runH531StateChecks()+" H5.3.1 state checks";');

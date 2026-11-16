ObjC.import('Foundation');
function read(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
const root='development/design-mode/';
eval(['example-data.js','sampler-state.js','state.js','compact/state.js','fixed/state.js','responsive/state.js','responsive/queue-state.js','responsive/library.js','responsive/state-checks.js'].map(p=>read(root+p)).join('\n')+'\n"PASS: "+runH4StateChecks()+" H4 state checks";');

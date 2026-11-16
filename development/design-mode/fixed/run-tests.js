ObjC.import('Foundation');
function read(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
const root='development/design-mode/';
eval(['example-data.js','sampler-state.js','state.js','compact/state.js','fixed/state.js','fixed/state-checks.js'].map(p=>read(root+p)).join('\n')+'\n"PASS: "+runFixedStateChecks()+" H3 state checks";');

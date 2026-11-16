ObjC.import('Foundation');
function read(p){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null));}
const base='development/design-mode/';
eval(['example-data.js','sampler-state.js','state.js','compact/state.js','compact/state-checks.js'].map(p=>read(base+p)).join('\n')+'\n"PASS: "+runCompactStateChecks()+" H1 state checks";');

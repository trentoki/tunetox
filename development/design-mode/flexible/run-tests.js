ObjC.import('Foundation');
function read(path){return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path,$.NSUTF8StringEncoding,null));}
const root='development/design-mode/';
eval(['example-data.js','sampler-state.js','state.js','compact/state.js','flexible/flexible.js','compact/state-checks.js','flexible/state-checks.js'].map(p=>read(root+p)).join('\n')+'\n"PASS: "+runCompactStateChecks()+" inherited H1 + "+runFlexibleStateChecks()+" H2 state checks";');

// macOS JavaScriptCore runner; no package installation required.
ObjC.import('Foundation');
function read(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
const base = 'development/design-mode/';
eval(read(base + 'example-data.js') + '\n' + read(base + 'sampler-state.js') + '\n' + read(base + 'state.js') + '\n' + read(base + 'tests/checks.js') + '\n"PASS: " + runStateChecks(TuneToxDesign.model) + " state checks";');

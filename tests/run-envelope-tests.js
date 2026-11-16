// Run from repository root: osascript -l JavaScript tests/run-envelope-tests.js
ObjC.import('Foundation');
function read(path) { return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null)); }
const source = read('experimental/envelope-lab/analysis.js') + '\n' + read('tests/envelope-analysis-tests.js');
console.log(new Function(source + '\nreturn runEnvelopeAnalysisTests();')());
for (const path of ['experimental/envelope-lab/lab.js', 'experimental/envelope-lab/worker.js', 'tests/envelope-analysis-browser-tests.js']) {
  new Function(read(path));
  console.log('Syntax passed: ' + path);
}

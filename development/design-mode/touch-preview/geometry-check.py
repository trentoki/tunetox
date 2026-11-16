"""Compare H5.3 and H5.3.1 visible layout rectangles, not screenshots alone."""
import pathlib
exec(pathlib.Path('development/design-mode/touch-preview/browser-check.py').read_text().split('\ntry:\n')[0])
def measure():
 return ev("""(()=>{const deck=document.querySelector('.h3-deck[data-deck="1"]');return [...deck.querySelectorAll('.h3-top,.h3-song-row,.h1-transport,.h3-overview,.h3-center,.h3-stems,.knob-dial,.h51-fader')].filter(n=>n.getClientRects().length).map(n=>({key:n.className,...n.getBoundingClientRect().toJSON()}))})()""")
try:
 c.call('Page.enable');c.call('Page.addScriptToEvaluateOnNewDocument',{'source':'window.H5_TEST_CLOCK=true;'})
 for w,h in [(1194,834),(834,1194),(390,844),(375,667),(320,568),(320,480)]:
  size(w,h);baseline={}
  for variant,build in [('portrait-preview','h53'),('touch-preview','h531')]:
   c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/'+variant+'/?build='+build});time.sleep(.5)
   for view in (['wave','controls','transition'] if w<700 else ['wave','controls']):
    mode(1,view);actual=measure()
    if variant=='portrait-preview':baseline[view]=actual
    else:
     expected=baseline[view];check(len(actual)==len(expected) and all(a['key']==b['key'] and all(abs(a[k]-b[k])<.1 for k in ['x','y','width','height']) for a,b in zip(actual,expected)),'H5.3 visible geometry preserved '+str((w,h))+' '+view)
 print('TOTAL',checks);root.joinpath('geometry-verification.json').write_text(json.dumps({'checks':checks,'tolerancePixels':.1},indent=2)+'\n')
finally:
 try:browser.call('Browser.close')
 except:pass

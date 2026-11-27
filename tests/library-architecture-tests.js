// These focused boundary checks supplement a separate manual responsibility review.
// They cannot prove good design, but prevent the specific regression reported by
// the user: importing, selection, scheduling or deck coordination inside Visual.
export async function checkLibraryArchitecture() {
  const source = async path => (await (await fetch('../' + path)).text());
  for (const name of ['library-view', 'song-management-view', 'library-analysis-view']) {
    const text = await source('app/visual/library/' + name + '.js');
    if (/addEventListener\(|\.on(click|input|submit|change)\s*=|indexedDB|new Worker|new AudioContext|sendToDeck\(|queueSong\(/.test(text))
      throw Error('Behavior or Audio leaked into Visual: ' + name);
  }
  const host = await source('app/visual/mixer/application.js');
  if (/async function sendLibrarySong|musicLibrary\.getSource\(|musicLibrary\.getSong\(/.test(host)) throw Error('Library deck coordination leaked into Visual host');
  for (const name of ['v40-bpm', 'library-audio-analysis', 'library-analysis-worker']) {
    const text = await source('app/audio/analysis/' + name + '.js');
    if (/from ['"].*(behavior|visual)/.test(text)) throw Error('Audio analysis imports UI/Behavior: ' + name);
  }
  const original = await source('tests/reference/v40-bpm.js');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(original)))].map(v => v.toString(16).padStart(2, '0')).join('');
  if (hash !== 'ac9a1a5a719565783581ac37ad40fd545699c64203ea4001ab4e542da9c611a1') throw Error('Original V40 baseline changed');
  const body = original.slice(original.indexOf(' const sr='), original.indexOf('\nfunction adjustBpmOctave'));
  const runtime = await source('app/audio/analysis/v40-bpm.js');
  if (!runtime.includes(body.trimEnd())) throw Error('V40 mathematical body changed');
}

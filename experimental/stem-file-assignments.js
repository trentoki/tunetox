// Filename-only preparation. No decoding, transport or musical-state changes.
function recognizeStemFilename(filename) {
  const text = String(filename).toLowerCase();
  return Object.entries({ transients: 'drum', flow: 'bass', tune: 'other', voice: 'vocal' })
    .filter(([, word]) => text.includes(word)).map(([category]) => category);
}
function stemFileIdentity(file) {
  // Conservative picker identity: also catches selecting the same file again in a new dialog.
  return JSON.stringify([file.name, file.size, file.lastModified, file.type]);
}
function createStemFileAssignments() {
  const candidates = new Map(), assignments = {};
  function addFiles(input) {
    const selected = Array.from(input || []);
    if (!selected.length) return []; // Cancel must preserve every prior selection.
    const groups = {}, messages = [];
    for (const file of selected) {
      const key = stemFileIdentity(file);
      if (!candidates.has(key)) candidates.set(key, file);
      const matches = recognizeStemFilename(file.name);
      if (matches.length !== 1) {
        messages.push(file.name + (matches.length ? ': ambiguous filename; assign manually.' : ': no recognized category; assign manually.'));
      } else {
        const category = matches[0];
        if (!groups[category]) groups[category] = new Set();
        groups[category].add(key);
      }
    }
    for (const category of Object.keys(groups)) {
      const keys = [...groups[category]];
      if (keys.length !== 1) { messages.push(category + ': multiple matching files; assign manually.'); continue; }
      const key = keys[0];
      if (assignments[category] && assignments[category] !== key) {
        messages.push(category + ': existing assignment retained; select a replacement manually.'); continue;
      }
      if (Object.entries(assignments).some(([name, value]) => name !== category && value === key)) {
        messages.push(category + ': file is already assigned elsewhere.'); continue;
      }
      assignments[category] = key;
    }
    return messages;
  }
  function assign(category, file) {
    if (!prototypeStemNames.includes(category)) throw new Error('Unknown stem category.');
    if (!file) { delete assignments[category]; return; }
    const key = stemFileIdentity(file);
    if (Object.entries(assignments).some(([name, value]) => name !== category && value === key)) {
      throw new Error('File already assigned to another category. Unassign it there first.');
    }
    candidates.set(key, file); assignments[category] = key; // Explicit user replacement only.
  }
  function getFiles() {
    if (!prototypeStemNames.every(name => assignments[name])) throw new Error('Assign exactly one file to each of the four categories.');
    return Object.fromEntries(prototypeStemNames.map(name => [name, candidates.get(assignments[name])]));
  }
  return Object.freeze({ addFiles, assign, getFiles,
    clear() { candidates.clear(); for (const name of prototypeStemNames) delete assignments[name]; },
    getState: () => ({ candidates: [...candidates].map(([key,file]) => ({key,file})),
      assignments: { ...assignments }, ready: prototypeStemNames.every(name => !!assignments[name]) }) });
}

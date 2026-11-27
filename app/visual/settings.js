// Presentation only. Behavior binds settings actions and supplies saved values.
export function createSettingsPresentation(header) {
  const button = document.createElement('button'); button.className = 'settings-button'; button.textContent = 'Settings'; button.type = 'button';
  const panel = document.createElement('section'); panel.className = 'application-settings'; panel.hidden = true; panel.id = 'application-settings'; panel.setAttribute('aria-label', 'Settings');
  button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded', 'false');
  const label = document.createElement('label'); label.textContent = 'Scrolling waveform ';
  const orientation = document.createElement('select'); orientation.setAttribute('aria-label', 'Scrolling waveform orientation');
  for (const value of ['horizontal','vertical']) orientation.add(new Option(value[0].toUpperCase()+value.slice(1),value));
  label.append(orientation); panel.append(label); header.querySelector('h1').after(button); header.append(panel);
  return { button, panel, orientation, show(open) { panel.hidden = !open; button.setAttribute('aria-expanded',String(open)); } };
}

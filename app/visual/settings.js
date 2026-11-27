// Presentation only. Behavior binds actions and supplies saved preference values.
export function createSettingsPresentation(header) {
  const button = document.createElement('button');
  button.className = 'settings-button';
  button.textContent = 'Settings';
  button.type = 'button';
  const panel = document.createElement('section');
  panel.className = 'application-settings';
  panel.hidden = true;
  panel.id = 'application-settings';
  panel.setAttribute('aria-label', 'Settings');
  button.setAttribute('aria-controls', panel.id);
  button.setAttribute('aria-expanded', 'false');

  const label = document.createElement('label');
  label.textContent = 'Landscape scrolling waveform ';
  const orientation = document.createElement('select');
  orientation.setAttribute('aria-label', 'Scrolling waveform orientation');
  for (const value of ['horizontal', 'vertical']) {
    orientation.add(new Option(value[0].toUpperCase() + value.slice(1), value));
  }
  label.append(orientation);
  const note = document.createElement('small');
  note.textContent = 'Tablet portrait always uses Horizontal. Landscape restores this preference.';
  panel.append(label, note);

  const identity = document.createElement('div');
  identity.className = 'application-identity';
  const name = header.querySelector('h1');
  name.before(identity);
  identity.append(name, button);

  // Compact performance setting stays outside the nonmodal Settings panel.
  const zoom = document.createElement('div');
  zoom.className = 'waveform-zoom';
  zoom.title = 'Waveform Zoom — visible source seconds';
  zoom.setAttribute('role', 'group');
  zoom.setAttribute('aria-label', 'Waveform Zoom');
  const zoomLabel = document.createElement('span');
  zoomLabel.textContent = 'Waveform Zoom';
  const zoomOut = document.createElement('button');
  zoomOut.type = 'button';
  zoomOut.textContent = '−';
  zoomOut.setAttribute('aria-label', 'Zoom out waveform');
  const duration = document.createElement('output');
  duration.setAttribute('aria-label', 'Visible waveform duration');
  duration.setAttribute('aria-live', 'polite');
  const zoomIn = document.createElement('button');
  zoomIn.type = 'button';
  zoomIn.textContent = '+';
  zoomIn.setAttribute('aria-label', 'Zoom in waveform');
  zoom.append(zoomLabel, zoomOut, duration, zoomIn);
  header.append(zoom, panel);

  return {
    button, panel, orientation, zoomIn, zoomOut,
    renderZoom(seconds) {
      duration.textContent = seconds.toFixed(1) + ' s';
      zoomIn.disabled = seconds === 1;
      zoomOut.disabled = seconds === 8;
    },
    show(open) {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }
  };
}

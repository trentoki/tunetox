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
  label.textContent = 'Scrolling waveform ';
  const orientation = document.createElement('select');
  orientation.setAttribute('aria-label', 'Scrolling waveform orientation');
  for (const value of ['horizontal', 'vertical']) {
    orientation.add(new Option(value[0].toUpperCase() + value.slice(1), value));
  }
  label.append(orientation);
  const note = document.createElement('small');
  note.textContent = 'Waveform uses this preference in both orientations. Other themes use Horizontal in tablet portrait.';
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Waveform coloring ';
  const waveformColors = document.createElement('select');
  waveformColors.setAttribute('aria-label', 'Waveform coloring');
  waveformColors.add(new Option('Deck shades (experiment)', 'shades'));
  waveformColors.add(new Option('Complementary hues', 'hues'));
  colorLabel.append(waveformColors);
  panel.append(label, note, colorLabel);

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
    button, panel, orientation, waveformColors, zoomIn, zoomOut,
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

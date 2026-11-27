// Visual placement and feedback only. Behavior binds hold/drag/key interactions.
export function createNudgePresentation(surface, number) {
  const group = document.createElement('div'); group.className = 'nudge-controls';
  group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Nudge Deck ' + number);
  const make = (label, text) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
    button.dataset.waveformControl = 'nudge'; button.setAttribute('aria-label', label + ' Deck ' + number);
    group.append(button); return button;
  };
  const backward = make('Hold nudge backward', '◀'), forward = make('Hold nudge forward', '▶');
  surface.append(group);
  return {
    group, backward, forward,
    render({ direction, enabled }) {
      backward.disabled = forward.disabled = !enabled;
      backward.setAttribute('aria-pressed', String(direction === -1)); forward.setAttribute('aria-pressed', String(direction === 1));
    }
  };
}

// One shared presentation beside global Waveform Zoom, never a deck percentage.
export function createGlobalNudgePresentation(header) {
  const group = document.createElement('label'); group.className = 'global-nudge';
  group.append('Nudge ');
  const percent = document.createElement('button'); percent.type = 'button';
  percent.dataset.waveformControl = 'nudge-percentage';
  percent.setAttribute('aria-label', 'Nudge percentage');
  percent.setAttribute('role', 'spinbutton');
  percent.setAttribute('aria-valuemin', '2'); percent.setAttribute('aria-valuemax', '50');
  group.append(percent); header.querySelector('.waveform-zoom').append(group);
  return { percent, render(value) {
    percent.textContent = value + '%'; percent.setAttribute('aria-valuenow', String(value));
  } };
}

// Visual placement and feedback only. Behavior binds hold/drag/key interactions.
export function createNudgePresentation(surface, number) {
  const group = document.createElement('div'); group.className = 'nudge-controls';
  group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Nudge Deck ' + number);
  const make = (label, text) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
    button.dataset.waveformControl = 'nudge'; button.setAttribute('aria-label', label + ' Deck ' + number);
    group.append(button); return button;
  };
  const backward = make('Hold nudge backward', '◀'), percent = make('Nudge percentage', '2%'), forward = make('Hold nudge forward', '▶');
  percent.setAttribute('role', 'spinbutton'); percent.setAttribute('aria-valuemin', '2'); percent.setAttribute('aria-valuemax', '50');
  surface.append(group);
  return {
    group, backward, percent, forward,
    render({ value, direction, enabled }) {
      if (percent.textContent !== value + '%') percent.textContent = value + '%'; percent.setAttribute('aria-valuenow', String(value));
      backward.disabled = forward.disabled = !enabled;
      backward.setAttribute('aria-pressed', String(direction === -1)); forward.setAttribute('aria-pressed', String(direction === 1));
    }
  };
}

// Cue and Shift presentation only; Behavior supplies availability/modifier state.
export function createCuePresentation(cues, deck) {
  const pads=[...cues.querySelectorAll('.cue-pad')],shift=cues.querySelector('.loop-controls button:last-child');
  return {pads,shift,
    render({ready, canSeek, shifted}) {
    pads.forEach((pad, index) => {
      const position = deck.cuePositions[index], assigned = position !== null;
      pad.disabled = !ready || !canSeek;
      pad.textContent = document.documentElement.dataset.theme === 'default'
        ? (index + 1) + (assigned ? ' · Cue' : ' · Set') : String(index + 1);
      pad.title = assigned ? 'Recall cue at ' + position.toFixed(2) + ' seconds; Shift + press deletes' : 'Save current song position';
      pad.setAttribute('aria-label', 'Cue ' + (index + 1) + (assigned ? ' at ' + position.toFixed(2) + ' seconds' : ' empty'));
      pad.setAttribute('aria-pressed', String(assigned));
    });
    shift.disabled = !ready;
    if (shift.textContent !== 'Shift') shift.textContent = 'Shift';
    shift.title = 'Hold to clear cues, or click to lock/unlock clearing mode';
    shift.setAttribute('aria-label', 'Shift cue clearing mode');
    shift.setAttribute('aria-pressed', String(shifted));
    // Preserve the existing theme's Shift illumination hook.
    shift.classList.add('glass-preview-shift');
  }
  };
}

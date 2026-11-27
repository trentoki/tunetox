// Theme presentation uses existing elements, never builds a second control/deck.
// Behavior supplies configuration visibility; original selector labels are rendered
// by the shared deck before this optional presentation override.
export function createWaveformDeckLayout({ upperToggle, lowerToggle, wave, stems, cues, controls }) {
  return function render({ waveformTheme, configuration, sections }) {
    wave.hidden = !sections.wave;
    stems.hidden = !sections.stems;
    cues.hidden = !sections.cues;
    controls.hidden = !sections.controls;
    lowerToggle.hidden = waveformTheme;
    if (waveformTheme) {
      upperToggle.textContent = configuration[0].toUpperCase() + configuration.slice(1);
      upperToggle.title = 'Tap to cycle Cues, Stems, Controls; slide upward/downward to choose';
      upperToggle.setAttribute('aria-label', 'Performance configuration: ' + upperToggle.textContent);
      upperToggle.removeAttribute('aria-pressed');
    }
  };
}

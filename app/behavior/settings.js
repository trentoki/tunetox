import { createSettingsPresentation } from '../visual/settings.js';
import { createThemePresentation } from '../visual/themes/theme-manager.js';

// Device-local presentation preferences. No deck/audio state is saved here.
const key = 'tunetox-settings-v1';
let orientation = 'horizontal';
let waveformColorMode = 'shades';
let waveformWindowSeconds = 4;
// Same responsive tablet portrait layout as the existing stem presentation.
// Phone widths retain the saved orientation; no user-agent or second deck is used.
const tabletPortrait = window.matchMedia('(min-width:601px) and (max-width:1100px) and (orientation:portrait)');
export const getWaveformOrientation = () => tabletPortrait.matches ? 'horizontal' : orientation;
export const getWaveformColorMode = () => waveformColorMode;
export const getWaveformWindowSeconds = () => waveformWindowSeconds;

export function connectSettings(header, decks) {
  const view = createSettingsPresentation(header);
  const themes = createThemePresentation(view.panel, decks);
  let customized = false;
  let open = false;

  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.version === 1) {
      if (['shades', 'hues'].includes(saved.waveformColorMode)) waveformColorMode = saved.waveformColorMode;
      if (['horizontal', 'vertical'].includes(saved.orientation)) orientation = saved.orientation;
      if (Number.isFinite(saved.waveformWindowSeconds) && saved.waveformWindowSeconds >= 1 &&
          saved.waveformWindowSeconds <= 8 && Number.isInteger(saved.waveformWindowSeconds * 2)) {
        waveformWindowSeconds = saved.waveformWindowSeconds;
      }
      if (['default', 'glass-hardware', 'futuristic'].includes(saved.theme)) themes.themeSelect.value = saved.theme;
      if (['decks', 'uniform', 'controls'].includes(saved.colorMode)) themes.modeSelect.value = saved.colorMode;
      if (Array.isArray(saved.colors) && saved.colors.length === 4 && saved.colors.every(color => /^#[a-f0-9]{6}$/i.test(color))) {
        themes.colorInputs.forEach((input, index) => input.value = saved.colors[index]);
        customized = saved.customized === true;
      }
    }
  } catch { /* Invalid/unavailable preferences retain safe defaults. */ }
  view.orientation.value = orientation;
  view.waveformColors.value = waveformColorMode;

  function save() {
    try {
      localStorage.setItem(key, JSON.stringify({
        version: 1, orientation, waveformWindowSeconds, waveformColorMode,
        theme: themes.themeSelect.value, colorMode: themes.modeSelect.value,
        colors: themes.colorInputs.map(input => input.value), customized
      }));
    } catch { /* Playback remains usable when local preference storage is denied. */ }
  }

  function applyOrientation() {
    document.documentElement.dataset.waveformOrientation = getWaveformOrientation();
    document.dispatchEvent(new Event('tunetox-waveform-orientation-change'));
  }

  function changeZoom(delta) {
    const next = Math.max(1, Math.min(8, waveformWindowSeconds + delta));
    if (next === waveformWindowSeconds) return;
    waveformWindowSeconds = next;
    view.renderZoom(waveformWindowSeconds);
    // Cancel any uncommitted drag rather than interpreting it at a new scale.
    document.dispatchEvent(new Event('tunetox-waveform-zoom-change'));
    save();
  }

  view.zoomIn.onclick = () => changeZoom(-0.5);
  view.zoomOut.onclick = () => changeZoom(0.5);
  view.renderZoom(waveformWindowSeconds);
  view.button.onclick = () => view.show(open = !open);
  view.panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      view.show(open = false);
      view.button.focus();
    }
  });
  view.orientation.onchange = () => {
    orientation = view.orientation.value;
    applyOrientation();
    save();
  };
  view.waveformColors.onchange = () => {
    waveformColorMode = view.waveformColors.value;
    document.dispatchEvent(new Event('tunetox-waveform-colors-change'));
    save();
  };
  tabletPortrait.addEventListener('change', applyOrientation);

  function applyAppearance() {
    themes.apply(customized);
    save();
  }
  themes.themeSelect.onchange = themes.modeSelect.onchange = applyAppearance;
  themes.colorInputs.forEach(input => input.oninput = () => {
    customized = true;
    applyAppearance();
  });
  themes.apply(customized);
  applyOrientation();
}

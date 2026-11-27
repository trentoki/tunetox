import { createSettingsPresentation } from '../visual/settings.js';
import { createThemePresentation } from '../visual/themes/theme-manager.js';

// Device-local, versioned presentation preferences. No deck/audio state is stored.
const key = 'tunetox-settings-v1';
let orientation = 'horizontal';
export const getWaveformOrientation = () => orientation;
export function connectSettings(header, decks) {
  const view = createSettingsPresentation(header), themes = createThemePresentation(view.panel, decks);
  let customized = false, open = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.version === 1) {
      if (['horizontal','vertical'].includes(saved.orientation)) orientation = saved.orientation;
      if (['default','glass-hardware','futuristic'].includes(saved.theme)) themes.themeSelect.value = saved.theme;
      if (['decks','uniform','controls'].includes(saved.colorMode)) themes.modeSelect.value = saved.colorMode;
      if (Array.isArray(saved.colors) && saved.colors.length === 4 && saved.colors.every(c => /^#[a-f0-9]{6}$/i.test(c))) {
        themes.colorInputs.forEach((input,i)=>input.value=saved.colors[i]); customized = saved.customized === true;
      }
    }
  } catch { /* Invalid/unavailable preferences retain safe defaults. */ }
  view.orientation.value = orientation;
  function apply(save = true) {
    orientation = view.orientation.value;
    document.documentElement.dataset.waveformOrientation = orientation;
    themes.apply(customized);
    document.dispatchEvent(new Event('tunetox-waveform-orientation-change'));
    if (save) try { localStorage.setItem(key,JSON.stringify({version:1,orientation,theme:themes.themeSelect.value,colorMode:themes.modeSelect.value,colors:themes.colorInputs.map(i=>i.value),customized})); }
    catch { /* Playback remains usable when local preference storage is denied. */ }
  }
  view.button.onclick = () => view.show(open = !open);
  view.panel.addEventListener('keydown',event=>{if(event.key==='Escape'){view.show(open=false);view.button.focus();}});
  view.orientation.onchange = () => apply();
  themes.themeSelect.onchange = themes.modeSelect.onchange = () => apply();
  themes.colorInputs.forEach(input=>input.oninput=()=>{customized=true;apply();});
  apply(false);
}

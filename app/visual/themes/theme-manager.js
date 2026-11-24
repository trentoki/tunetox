// Presentation-only theme switching. No deck or audio state is changed.
const themes = Object.freeze({
  default: { label: "Default", stylesheet: null },
  "glass-hardware": { label: "Glass Hardware", stylesheet: "app/visual/themes/glass-hardware/theme.css" },
  futuristic: { label: "Futuristic", stylesheet: "app/visual/themes/futuristic/theme.css" }
});
const defaultColors = ["#bb6bff", "#ed65d7", "#4dcdf1", "#69e5aa"];
let stylesheet;
export function installThemeControls(container, deckContainer) {
  const group = document.createElement("div");
  group.className = "theme-controls";
  const themeSelect = document.createElement("select");
  themeSelect.setAttribute("aria-label", "Visual theme");
  for (const [key, theme] of Object.entries(themes)) themeSelect.add(new Option(theme.label, key));
  const modeSelect = document.createElement("select");
  modeSelect.setAttribute("aria-label", "Color arrangement");
  for (const [key, label] of [["decks","Per-deck colors"],["uniform","One color"],["controls","Control colors (future)"]]) modeSelect.add(new Option(label, key));
  const colorInputs = defaultColors.map((color, index) => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = color;
    input.setAttribute("aria-label", "Deck " + (index + 1) + " color");
    return input;
  });
  let colorsCustomized = false;
  function apply() {
    const theme = themes[themeSelect.value] || themes.default;
    document.documentElement.dataset.theme = themeSelect.value;
    document.documentElement.dataset.colorMode = modeSelect.value;
    if (stylesheet) { stylesheet.remove(); stylesheet = null; }
    if (theme.stylesheet) {
      stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = theme.stylesheet;
      document.head.append(stylesheet);
    }
    const mode = modeSelect.value;
    const deckColors = mode === "uniform" ? Array(4).fill(colorInputs[0].value) : colorInputs.map(input => input.value);
    deckContainer.querySelectorAll(".deck").forEach((deck, index) => {
      if (themeSelect.value === "default" && !colorsCustomized) deck.style.removeProperty("--accent");
      else deck.style.setProperty("--accent", deckColors[index] || deckColors[0]);
    });
    colorInputs.forEach((input, index) => { input.hidden = mode === "uniform" && index > 0; });
    document.dispatchEvent(new Event('tunetox-theme-change'));
  }
  themeSelect.addEventListener("change", apply);
  modeSelect.addEventListener("change", apply);
  colorInputs.forEach(input => input.addEventListener("input", () => {
    colorsCustomized = true;
    apply();
  }));
  group.append(themeSelect, modeSelect, ...colorInputs);
  container.append(group);
  apply();
}

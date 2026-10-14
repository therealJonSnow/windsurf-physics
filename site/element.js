// <ws-figure name="f2-uphaul" theme="auto|light|dark" challenge="2" caption="…">
// Each figure's module registers itself here; the element renders into shadow DOM, carries its own CSS
// tokens for light and dark, follows the system theme unless told otherwise, stores progress in
// localStorage when it can, and pauses when offscreen (the figure's own IntersectionObserver).
const REGISTRY = (globalThis.__wsFigures ||= new Map());

export function register(name, figure) {
  REGISTRY.set(name, figure);
  document.querySelectorAll(`ws-figure[name="${name}"]`).forEach((el) => el.render?.());
}

class WsFigure extends HTMLElement {
  static get observedAttributes() { return ["theme"]; }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.applyTheme(); }
  applyTheme() {
    const root = this.shadowRoot?.querySelector(".ws-root");
    if (!root) return;
    const asked = this.getAttribute("theme") || "auto";
    root.dataset.theme = asked === "dark" || asked === "light" ? asked : this.media?.matches ? "dark" : "light";
  }
  render() {
    const figure = REGISTRY.get(this.getAttribute("name"));
    if (!figure || this.mounted) return;
    this.mounted = true;
    const shadow = this.shadowRoot || this.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>:host{display:block;contain:content}${figure.css}</style>${figure.markup}`;
    const captions = structuredClone(figure.captions);
    const override = this.getAttribute("caption");
    if (override) { const c = shadow.querySelector(".iso-caption"); if (c) c.textContent = override; }
    this.media = matchMedia("(prefers-color-scheme: dark)");
    this.media.addEventListener?.("change", () => this.applyTheme());
    this.applyTheme();
    const fig = figure.mount(shadow, { captions, store: this.getAttribute("store") !== "off" });
    const first = Number(this.getAttribute("challenge"));
    if (first >= 1 && first <= captions.tasks.length) fig.startTask(first - 1);
  }
}
if (!customElements.get("ws-figure")) customElements.define("ws-figure", WsFigure);

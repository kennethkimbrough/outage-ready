/** Small rendering helpers: an HTML tagged template with escaping, toasts, ids. */
export function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** A string that must not be escaped again (already-rendered HTML). */
export class Raw {
    value;
    constructor(value) {
        this.value = value;
    }
    toString() { return this.value; }
}
export const raw = (s) => new Raw(s);
/** html`...` escapes interpolated values unless they are Raw or arrays of Raw. */
export function html(strings, ...values) {
    let out = "";
    strings.forEach((s, i) => {
        out += s;
        if (i < values.length)
            out += render(values[i]);
    });
    return new Raw(out);
}
function render(v) {
    if (v instanceof Raw)
        return v.value;
    if (Array.isArray(v))
        return v.map(render).join("");
    if (v === null || v === undefined || v === false)
        return "";
    return esc(v);
}
export function mount(el, content) {
    el.innerHTML = content.value;
}
let toastTimer;
export function toast(message) {
    const el = document.getElementById("toast");
    if (!el)
        return;
    el.textContent = message;
    el.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove("show"), 2200);
}
export function uid(prefix = "id") {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
export function num(value, fallback = 0) {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : fallback;
}
/** Delegate click/input events inside a root by `data-action` attribute. */
export function delegate(root, event, handler) {
    root.addEventListener(event, (ev) => {
        const target = ev.target.closest("[data-action]");
        if (!target || !root.contains(target))
            return;
        handler(target.dataset.action, target, ev);
    });
}

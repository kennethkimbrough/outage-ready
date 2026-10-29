/** Small rendering helpers: an HTML tagged template with escaping, toasts, ids. */

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** A string that must not be escaped again (already-rendered HTML). */
export class Raw {
  constructor(public readonly value: string) {}
  toString(): string { return this.value; }
}
export const raw = (s: string): Raw => new Raw(s);

/** html`...` escapes interpolated values unless they are Raw or arrays of Raw. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += render(values[i]);
  });
  return new Raw(out);
}

function render(v: unknown): string {
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(render).join("");
  if (v === null || v === undefined || v === false) return "";
  return esc(v);
}

export function mount(el: Element, content: Raw): void {
  el.innerHTML = content.value;
}

let toastTimer: number | undefined;
export function toast(message: string): void {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2200);
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

/** Delegate click/input events inside a root by `data-action` attribute. */
export function delegate(
  root: Element,
  event: string,
  handler: (action: string, target: HTMLElement, ev: Event) => void,
): void {
  root.addEventListener(event, (ev) => {
    const target = (ev.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target || !root.contains(target)) return;
    handler(target.dataset.action!, target, ev);
  });
}

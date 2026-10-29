/**
 * The depletion timeline: one horizontal track per resource or need, drawn as
 * plain SVG. A bar runs from hour 0 to the hour the item fails; items that
 * last the whole window run to the end in green. A vertical line marks the
 * point where the first critical need fails.
 */
import { formatHours, type SimulationResult } from "../engine/index.js";
import { esc, raw, type Raw } from "./ui.js";

interface Row {
  label: string;
  failsAt: number | null;
  severity: number;
}

export function timelineSvg(result: SimulationResult, width = 640): Raw {
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const n of result.failsFirst) {
    if (n.kind !== "need") continue;
    rows.push({ label: n.label, failsAt: n.failsAt, severity: n.severity });
    seen.add(n.id);
  }
  for (const n of result.nodes) {
    if (n.kind !== "need" || seen.has(n.id) || n.failsAt !== null) continue;
    if (!isShown(n.id, result)) continue;
    rows.push({ label: n.label, failsAt: null, severity: n.severity });
  }
  const held = rows.filter((r) => r.failsAt === null).slice(0, 5);
  const shown = [...rows.filter((r) => r.failsAt !== null), ...held];

  const narrow = width < 480;
  const labelW = narrow ? 128 : 150;
  const rowH = 30;
  const top = 24;
  const bottom = 26;
  const chartW = width - labelW - 16;
  const height = top + shown.length * rowH + bottom;
  const D = result.durationHours;
  const x = (h: number) => labelW + (Math.min(h, D) / D) * chartW;

  const ticks: number[] = [];
  const step = D <= 24 ? 6 : D <= 96 ? 24 : 48;
  for (let h = 0; h <= D; h += step) ticks.push(h);

  const parts: string[] = [];
  parts.push(`<svg class="timeline${narrow ? " narrow" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Timeline of what fails when during a ${esc(result.scenarioName)}">`);
  for (const t of ticks) {
    parts.push(`<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${height - bottom + 4}"/>`);
    parts.push(`<text x="${x(t)}" y="${height - 8}" text-anchor="middle">${t === 0 ? "now" : formatHours(t)}</text>`);
  }
  shown.forEach((r, i) => {
    const y = top + i * rowH;
    const end = r.failsAt === null ? D : r.failsAt;
    const cls = r.failsAt === null ? "" : r.severity >= 4 ? " danger" : " fail";
    parts.push(`<text class="label" x="${labelW - 10}" y="${y + 19}" text-anchor="end">${esc(trim(r.label, narrow ? 16 : 22))}</text>`);
    parts.push(`<rect class="track" x="${labelW}" y="${y + 6}" width="${chartW}" height="18" rx="9"/>`);
    const w = Math.max(x(end) - labelW, end === 0 ? 0 : 4);
    if (w > 0) parts.push(`<rect class="bar${cls}" x="${labelW}" y="${y + 6}" width="${w}" height="18" rx="9"/>`);
    if (r.failsAt !== null) {
      const text = r.failsAt === 0 ? "from the start" : "fails at " + formatHours(r.failsAt);
      const fits = x(end) + 6 + text.length * 6.6 < width - 8;
      const tx = fits ? x(end) + 6 : x(end) - 6;
      parts.push(`<text x="${tx}" y="${y + 19}" text-anchor="${fits ? "start" : "end"}"${fits ? "" : ' style="fill:#fff"'}>${text}</text>`);
    }
  });
  if (!result.holdsFullDuration) {
    const sx = x(result.sustainableHours);
    parts.push(`<line class="sustain" x1="${sx}" x2="${sx}" y1="${top - 8}" y2="${height - bottom + 6}"/>`);
    parts.push(`<text x="${sx}" y="${top - 10}" text-anchor="${result.sustainableHours / D > 0.8 ? "end" : "middle"}" style="fill:var(--amber);font-weight:600">first critical gap</text>`);
  }
  parts.push("</svg>");
  return raw(parts.join(""));
}

/** Sparkline-style strip chart for one stock, used on the stock detail list. */
export function stockSpark(series: number[], width = 120, height = 24): Raw {
  const max = Math.max(...series, 1e-9);
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * width},${height - (v / max) * (height - 2) - 1}`);
  return raw(`<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.join(" ")}"/></svg>`);
}

function isShown(id: string, result: SimulationResult): boolean {
  if (id === "need:cooling") return result.scenarioId === "heat-power";
  if (id === "need:mobility") return result.scenarioId === "evacuation";
  return true;
}

function trim(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

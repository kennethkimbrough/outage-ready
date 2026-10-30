/**
 * The depletion timeline: one horizontal track per resource or need, drawn as
 * plain SVG. A bar runs from hour 0 to the hour the item fails; items that
 * last the whole window run to the end in green. A vertical line marks the
 * point where the first critical need fails.
 */
import { formatHours } from "../engine/index.js";
import { esc, raw } from "./ui.js";
export function timelineSvg(result, width = 640) {
    const rows = [];
    const seen = new Set();
    for (const n of result.failsFirst) {
        if (n.kind !== "need")
            continue;
        rows.push({ label: n.short ?? n.label, failsAt: n.failsAt, severity: n.severity });
        seen.add(n.id);
    }
    for (const n of result.nodes) {
        if (n.kind !== "need" || seen.has(n.id) || n.failsAt !== null)
            continue;
        if (!isShown(n.id, result))
            continue;
        rows.push({ label: n.short ?? n.label, failsAt: null, severity: n.severity });
    }
    const held = rows.filter((r) => r.failsAt === null).slice(0, 5);
    const shown = [...rows.filter((r) => r.failsAt !== null), ...held];
    // On narrow screens the label sits above its bar instead of beside it, so
    // nothing is cut short and the bar gets the full width.
    const narrow = width < 480;
    const left = narrow ? 8 : 150;
    const right = width - 8;
    const chartW = right - left;
    const rowH = narrow ? 46 : 30;
    const barTop = narrow ? 20 : 6;
    const top = 24;
    const bottom = 26;
    const height = top + shown.length * rowH + bottom;
    const D = result.durationHours;
    const x = (h) => left + (Math.min(h, D) / D) * chartW;
    const ticks = [];
    const step = D <= 24 ? 6 : D <= 96 ? 24 : 48;
    for (let h = 0; h <= D; h += step)
        ticks.push(h);
    const parts = [];
    const labels = []; // drawn last on narrow screens so the marker lines pass behind them
    parts.push(`<svg class="timeline${narrow ? " narrow" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Timeline of what fails when during a ${esc(result.scenarioName)}">`);
    for (const t of ticks) {
        const anchor = t === 0 ? "start" : t === ticks[ticks.length - 1] && t >= D ? "end" : "middle";
        parts.push(`<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${height - bottom + 4}"/>`);
        parts.push(`<text x="${x(t)}" y="${height - 8}" text-anchor="${anchor}">${t === 0 ? "now" : formatHours(t)}</text>`);
    }
    shown.forEach((r, i) => {
        const y = top + i * rowH;
        const end = r.failsAt === null ? D : r.failsAt;
        const cls = r.failsAt === null ? "" : r.severity >= 4 ? " danger" : " fail";
        if (narrow)
            labels.push(`<text class="label" x="${left}" y="${y + 13}">${esc(r.label)}</text>`);
        else
            parts.push(`<text class="label" x="${left - 10}" y="${y + 19}" text-anchor="end">${esc(trim(r.label, 22))}</text>`);
        parts.push(`<rect class="track" x="${left}" y="${y + barTop}" width="${chartW}" height="18" rx="9"/>`);
        const w = Math.max(x(end) - left, end === 0 ? 0 : 4);
        if (w > 0)
            parts.push(`<rect class="bar${cls}" x="${left}" y="${y + barTop}" width="${w}" height="18" rx="9"/>`);
        if (r.failsAt !== null) {
            const text = r.failsAt === 0 ? "from the start" : "fails at " + formatHours(r.failsAt);
            const fits = x(end) + 6 + text.length * 6.6 < width - 8;
            const tx = fits ? x(end) + 6 : x(end) - 6;
            parts.push(`<text x="${tx}" y="${y + barTop + 13}" text-anchor="${fits ? "start" : "end"}"${fits ? "" : ' style="fill:#fff"'}>${text}</text>`);
        }
    });
    if (!result.holdsFullDuration) {
        const sx = x(result.sustainableHours);
        parts.push(`<line class="sustain" x1="${sx}" x2="${sx}" y1="${top - 8}" y2="${height - bottom + 6}"/>`);
        const anchor = result.sustainableHours / D > 0.8 ? "end" : result.sustainableHours / D < 0.15 ? "start" : "middle";
        parts.push(`<text x="${sx}" y="${top - 10}" text-anchor="${anchor}" style="fill:var(--amber);font-weight:600">first critical gap</text>`);
    }
    parts.push(...labels, "</svg>");
    return raw(parts.join(""));
}
/** Sparkline-style strip chart for one stock, used on the stock detail list. */
export function stockSpark(series, width = 120, height = 24) {
    const max = Math.max(...series, 1e-9);
    const pts = series.map((v, i) => `${(i / (series.length - 1)) * width},${height - (v / max) * (height - 2) - 1}`);
    return raw(`<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.join(" ")}"/></svg>`);
}
function isShown(id, result) {
    if (id === "need:cooling")
        return result.scenarioId === "heat-power";
    if (id === "need:mobility")
        return result.scenarioId === "evacuation";
    return true;
}
function trim(s, n) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Hours as a short human string: 0.5 → "30 min", 36 → "1 day 12 h". */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  if (d === 0) return `${h} h`;
  if (h === 0) return `${d} day${d === 1 ? "" : "s"}`;
  return `${d} day${d === 1 ? "" : "s"} ${h} h`;
}

/** A quantity for display: whole numbers above 100, one decimal below. */
export function formatAmount(n: number): string {
  return n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
}

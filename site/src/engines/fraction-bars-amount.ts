// Pure helpers for <kg-fraction-bars> re-partitioning (no DOM, so they can be unit-tested).

/**
 * How many of `parts` cells show the amount n/d exactly, or null when that
 * partition cannot show it (e.g. 1/3 on a bar of 4 parts).
 */
export function cellsFor(n: number, d: number, parts: number): number | null {
  if (d <= 0 || parts <= 0) return null;
  const cells = (n * parts) / d;
  return Number.isInteger(cells) ? cells : null;
}

/**
 * The next number of parts after pressing + (delta = 1) or − (delta = −1),
 * moving in steps of `step` (e.g. 3 → 6 → 9 → 12), or null when it would leave [min, max].
 */
export function nextParts(parts: number, delta: 1 | -1, step = 1, min = 1, max = 12): number | null {
  const s = Math.max(1, Math.floor(step));
  const next = parts + delta * s;
  return next < min || next > max ? null : next;
}

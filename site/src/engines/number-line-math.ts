// Pure geometry and snapping for <kg-number-line>. No DOM, so it is unit-tested (number-line-math.test.ts).
// Positions are tick indices: tick i is the number i / den (den = ticks per unit), counted from 0.

export type FracSpec = [number, number];

/** The visible range in tick indices [lo, hi]. `zoom` narrows the line to a window inside min..max. */
export function windowOf(min: number, max: number, den: number, zoom?: { from: FracSpec; to: FracSpec }): [number, number] {
  let lo = min * den, hi = max * den;
  if (zoom) {
    lo = Math.max(lo, toTick(zoom.from, den));
    hi = Math.min(hi, toTick(zoom.to, den));
  }
  return [lo, Math.max(hi, lo + 1)];
}

/** The tick nearest to the number n/d (exact when d divides into den, e.g. 3/4 on a line in eighths → 6). */
export function toTick([n, d]: FracSpec, den: number): number {
  return Math.round((n * den) / d);
}

export const clamp = (i: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, i));

/** x position of tick i, with the line drawn from x0 (tick lo) to x1 (tick hi). Always left → right. */
export function tickX(i: number, lo: number, hi: number, x0: number, x1: number): number {
  return x0 + ((i - lo) / (hi - lo)) * (x1 - x0);
}

/** Snap a pointer x to the nearest tick inside the window. */
export function snap(x: number, lo: number, hi: number, x0: number, x1: number): number {
  return clamp(Math.round(lo + ((x - x0) / (x1 - x0)) * (hi - lo)), lo, hi);
}

/**
 * Exact decimal text (with ".") for n/d, e.g. (125, 100) → "1.25", (3, 10) → "0.3", (4, 2) → "2".
 * Returns null when n/d has no finite decimal (e.g. 1/3).
 */
export function decimalString(n: number, d: number): string | null {
  const neg = n * d < 0;
  n = Math.abs(n);
  d = Math.abs(d);
  let places = 0, scale = 1;
  while ((n * scale) % d !== 0) {
    if (++places > 9) return null;
    scale *= 10;
  }
  const digits = String((n * scale) / d).padStart(places + 1, '0');
  const int = digits.slice(0, digits.length - places);
  const frac = digits.slice(digits.length - places);
  return (neg ? '-' : '') + int + (places ? '.' + frac : '');
}

/** Tick height class: whole numbers are tallest, halves and tenths (of hundredths) medium, the rest short. */
export function tickKind(i: number, den: number): 'whole' | 'mid' | 'minor' {
  if (i % den === 0) return 'whole';
  if ((den % 2 === 0 && i % (den / 2) === 0) || (den % 10 === 0 && den > 10 && i % (den / 10) === 0)) return 'mid';
  return 'minor';
}

/**
 * Label every k-th tick so labels don't collide: the smallest "nice" k (dividing den when possible)
 * whose spacing k × `spacing` is at least `minGap` pixels.
 */
export function labelStep(spacing: number, minGap: number, den: number): number {
  // Decimal lines step in 1, 2, 5, 10… so labels land on round decimals (0.40, 0.45, 0.50).
  const nice = den % 10 === 0 ? [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000] : [1, 2, 3, 4, 6, 12, 24, 5, 10, 20, 50, 100];
  const fits = (k: number) => k * spacing >= minGap;
  return nice.find((k) => den % k === 0 && fits(k)) ?? nice.find(fits) ?? den;
}

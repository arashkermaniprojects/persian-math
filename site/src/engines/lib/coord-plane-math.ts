// Pure geometry for <kg-coord-plane>: snapping, axis labels, exact gradients, lines, equations, typed numbers and
// graph sampling. No DOM, so it is unit-tested (coord-plane-math.test.ts). Plane units, x to the right, y up.
import { evaluate, tokenize, type Tok } from './pattern-machine-expr';

export type P = [number, number];
/** A straight line: y = m x + c, or the vertical line x = `x` (m and c null). */
export interface Line { m: number | null; c: number | null; x?: number }

/** Kill floating-point dust so values compare exactly (0.1 + 0.2 → 0.3). */
export const tidy = (v: number) => Math.round(v * 1e9) / 1e9;
export const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;
export const samePt = (a: P, b: P, tol = 1e-6) => near(a[0], b[0], tol) && near(a[1], b[1], tol);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Nearest multiple of `step` inside [lo, hi]. */
export function snapTo(v: number, step: number, lo: number, hi: number): number {
  return tidy(clamp(Math.round(v / step) * step, Math.ceil(tidy(lo / step)) * step, Math.floor(tidy(hi / step)) * step));
}

/** Label every k-th grid line: the smallest k in 1, 2, 5, 10… whose spacing is at least `gap` pixels. */
export function labelEvery(square: number, gap: number): number {
  return [1, 2, 5, 10, 20, 50].find((k) => k * square >= gap) ?? 100;
}

/** Grid-line values from lo to hi in steps of `scale` units (lo, hi need not be multiples). */
export function gridValues(lo: number, hi: number, scale: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(tidy(lo / scale)) * scale; v <= hi + 1e-9; v = tidy(v + scale)) out.push(tidy(v));
  return out;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** v as a fraction [n, d] in lowest terms, d > 0 (exact for the rationals a grid produces; d up to 1000). */
export function toFrac(v: number): [number, number] {
  for (let d = 1; d <= 1000; d++) {
    const n = Math.round(v * d);
    if (near(n / d, v, 1e-9)) {
      const g = gcd(n, d) || 1;
      return [n / g, d / g];
    }
  }
  return [Math.round(v * 1000), 1000];
}

/** A number from YAML: 2, -0.5 or a fraction [2, 3]. */
export const num = (v: number | [number, number]) => (Array.isArray(v) ? v[0] / v[1] : v);

/** The line through a and b (null if they are the same point). */
export function lineThrough(a: P, b: P): Line | null {
  if (samePt(a, b)) return null;
  if (near(a[0], b[0])) return { m: null, c: null, x: tidy(a[0]) };
  const m = tidy((b[1] - a[1]) / (b[0] - a[0]));
  return { m, c: tidy(a[1] - m * a[0]) };
}

export const yAt = (l: Line, x: number) => (l.m === null ? NaN : tidy(l.m * x + l.c!));
export const onLine = (l: Line, p: P, tol = 1e-6) => (l.m === null ? near(p[0], l.x!, tol) : near(yAt(l, p[0]), p[1], tol));

/** Where the line crosses the x-axis (null if it is horizontal and not the axis itself, or is the axis). */
export function xIntercept(l: Line): number | null {
  if (l.m === null) return l.x!;
  return near(l.m, 0) ? null : tidy(-l.c! / l.m);
}

/** The part of a line inside the box [x0, x1] × [y0, y1], or null if it misses it. */
export function clipLine(l: Line, x0: number, x1: number, y0: number, y1: number): [P, P] | null {
  if (l.m === null) return l.x! >= x0 - 1e-9 && l.x! <= x1 + 1e-9 ? [[l.x!, y0], [l.x!, y1]] : null;
  const m = l.m, c = l.c!;
  let a = x0, b = x1;
  if (!near(m, 0)) {
    const t0 = (y0 - c) / m, t1 = (y1 - c) / m;
    a = Math.max(a, Math.min(t0, t1));
    b = Math.min(b, Math.max(t0, t1));
  } else if (c < y0 - 1e-9 || c > y1 + 1e-9) return null;
  return a <= b + 1e-9 ? [[a, m * a + c], [b, m * b + c]] : null;
}

/** The rise and run of the step from a to b ([run, rise], signed). */
export const step = (a: P, b: P): P => [tidy(b[0] - a[0]), tidy(b[1] - a[1])];

/**
 * The parts of "y = m x + c" as plain text (ASCII digits, U+2212 minus): ["y = ", m-part, rest], with 1x → x,
 * −1x → −x, 0x dropped, + 0 dropped. A fractional m comes back as [n, d] for the caller to stack.
 * A vertical line gives ["x = ", "", k].
 */
export function equationParts(l: Line): { lhs: string; m: string | [number, number] | null; rest: string } {
  const sign = (v: number) => (v < 0 ? '−' : '');
  const show = (v: number) => {
    const [n, d] = toFrac(Math.abs(v));
    return d === 1 ? String(n) : String(tidy(Math.abs(v)));
  };
  if (l.m === null) return { lhs: 'x = ', m: null, rest: sign(l.x!) + show(l.x!) };
  const m = l.m, c = l.c!;
  if (near(m, 0)) return { lhs: 'y = ', m: null, rest: sign(c) + show(c) };
  const [n, d] = toFrac(Math.abs(m));
  const mPart: string | [number, number] = d === 1 ? sign(m) + (n === 1 ? '' : String(n)) : [m < 0 ? -n : n, d];
  const rest = 'x' + (near(c, 0) ? '' : (c < 0 ? ' − ' : ' + ') + show(c));
  return { lhs: 'y = ', m: mPart, rest };
}

/** A number typed by the learner: Persian or Latin digits, - or − for minus, the locale's decimal mark or ".". */
export function parseTyped(s: string, decimal = '.'): number | null {
  const t = s.trim().replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[−–]/g, '-').split(decimal).join('.').replace(/٫/g, '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null;
}

/** Compile y = f(x) (an expression in x and parameter letters, e.g. "a*x^2 + k"); throws on bad input. */
export function compile(f: string): Tok[] {
  return tokenize(f);
}

/** f at x with these parameters; NaN where undefined (e.g. 1/0). */
export function valueAt(toks: Tok[], x: number, params: Record<string, number> = {}): number {
  try {
    const v = evaluate(toks, { ...params, x });
    return Number.isFinite(v) ? tidy(v) : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Polyline pieces of y = f(x) across [x0, x1] in `n` steps, broken where f is undefined or jumps off the plane
 * (so 1/x is not joined across x = 0). y is kept within a margin of the plane so the SVG stays small.
 */
export function sample(toks: Tok[], x0: number, x1: number, y0: number, y1: number, n: number, params: Record<string, number> = {}): P[][] {
  const out: P[][] = [];
  let cur: P[] = [];
  const pad = (y1 - y0) * 2;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = valueAt(toks, x, params);
    const ok = Number.isFinite(y) && y > y0 - pad && y < y1 + pad;
    if (ok) cur.push([x, y]);
    if (!ok || i === n) {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
  }
  return out;
}

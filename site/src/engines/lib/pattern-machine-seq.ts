// Number sequences, growing figures and hundred-square sets for <kg-pattern-machine>. Pure, no DOM.
import { apply, opOf, round, runRule, type Rule } from './pattern-machine-expr';

export interface SeqConfig {
  /** Term-to-term: start, then op (+ − × ÷, default +) by `step` each time. */
  start?: number;
  step?: number;
  op?: string;
  /** Position-to-term rule, e.g. "3n + 1" or "n^2" (n = 1, 2, 3 …). */
  rule?: string;
  /** Or the terms written out. */
  terms?: number[];
}

/** Term n (1-based) of a sequence. */
export function term(c: SeqConfig, n: number): number {
  if (c.terms) return c.terms[n - 1];
  if (c.rule) return runRule(c.rule as Rule, n);
  let v = c.start ?? 0;
  const op = opOf(c.op ?? '+')!;
  for (let k = 1; k < n; k++) v = apply(op, v, c.step ?? 1);
  return round(v);
}

export const terms = (c: SeqConfig, count: number) => Array.from({ length: count }, (_, i) => term(c, i + 1));

/**
 * Growing figures. `sticks`: matchsticks making `shape` "squares" (n squares in a row: 3n + 1) or "triangles"
 * (2n + 1). `dots`/`squares`: a grid of rows × cols, each growing linearly (rows: [first, add]), or
 * shape "stairs" (1 + 2 + … + n).
 */
export interface FigureConfig {
  figure?: 'dots' | 'squares' | 'sticks';
  shape?: 'grid' | 'stairs' | 'squares' | 'triangles';
  rows?: [number, number];
  cols?: [number, number];
}

const lin = (p: [number, number] | undefined, n: number, d: [number, number]) => (p ?? d)[0] + (p ?? d)[1] * (n - 1);

/** Rows of a dot/square figure: how many in each row, bottom row first. */
export function figureRows(c: FigureConfig, n: number): number[] {
  if (c.shape === 'stairs') return Array.from({ length: n }, (_, i) => n - i);
  const r = lin(c.rows, n, [1, 0]), k = lin(c.cols, n, [1, 1]);
  return Array.from({ length: Math.max(0, r) }, () => Math.max(0, k));
}

/** Matchsticks of figure n as segments [x1, y1, x2, y2] on a unit grid (y up). */
export function sticks(c: FigureConfig, n: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  if (c.shape === 'triangles') {
    // Triangles in a row, alternately pointing up and down: n triangles need 2n + 1 sticks.
    const h = 0.866;
    for (let i = 0; i < n; i++) {
      const x = i / 2, up = i % 2 === 0;
      if (i === 0) out.push(up ? [x, 0, x + 0.5, h] : [x, h, x + 0.5, 0]);
      out.push(up ? [x + 0.5, h, x + 1, 0] : [x + 0.5, 0, x + 1, h]);
      out.push(up ? [x, 0, x + 1, 0] : [x, h, x + 1, h]);
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    if (i === 0) out.push([0, 0, 0, 1]);
    out.push([i, 0, i + 1, 0], [i, 1, i + 1, 1], [i + 1, 0, i + 1, 1]);
  }
  return out;
}

/** How many things figure n has. */
export function figureCount(c: FigureConfig, n: number): number {
  return c.figure === 'sticks' ? sticks(c, n).length : figureRows(c, n).reduce((s, r) => s + r, 0);
}

/** A set of numbers on the hundred square: multiples of k, factors of k, or a list (within from..to). */
export type NumSet = { multiples?: number; factors?: number; set?: number[]; and?: NumSet[] };

export function inSet(s: NumSet, v: number): boolean {
  if (s.and) return s.and.every((x) => inSet(x, v));
  if (s.multiples) return v % s.multiples === 0 && v !== 0;
  if (s.factors) return v > 0 && s.factors % v === 0;
  return (s.set ?? []).includes(v);
}

export function members(s: NumSet, from: number, to: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v++) if (inSet(s, v)) out.push(v);
  return out;
}

/** Compare shaded numbers with a set: missing (some not shaded) before extra (some shaded that should not be). */
export function setCode(shaded: number[], want: number[]): string | null {
  if (!shaded.length) return 'empty';
  if (want.some((v) => !shaded.includes(v))) return 'missing';
  if (shaded.some((v) => !want.includes(v))) return 'extra';
  return null;
}

/** Continue the jumps: from the last two shaded numbers (gap d), every further number up to `to`. */
export function continueJumps(shaded: number[], to: number): number[] {
  if (shaded.length < 2) return [];
  const [a, b] = shaded.slice(-2), d = b - a;
  if (d <= 0) return [];
  const out: number[] = [];
  for (let v = b + d; v <= to; v += d) out.push(v);
  return out;
}

// Pure logic for the number-line `intervals` module (engines/number-line/intervals.ts) and its `interval` check:
// intervals and unions of them, interval / inequality notation, linear inequalities and sign rows. No DOM.
// Numbers are plain JS numbers; null at an end means −∞ (from) or +∞ (to).
import { tokenize, evaluate } from './pattern-machine-expr';
import { decimalString } from './number-line-math';

export interface Piece {
  from: number | null;
  to: number | null;
  /** [left end open, right end open]. An infinite end is always open. */
  open: [boolean, boolean];
}
export type Sign = '+' | '-' | '';
export interface SignState {
  /** Rows of sign cells, one per factor, then the result row; '' = not filled yet. */
  cells: Sign[][];
  /** The true signs, same shape. */
  want: Sign[][];
}
export interface IntervalState {
  intervals?: Piece[];
  signs?: SignState;
}

const EPS = 1e-9;
const eq = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < EPS);

/** A number written in config or a check: 3, "-2", "3.5", "7/2", "inf", "-∞". */
function num(s: string): number | null {
  const t = s.trim().replace(/−/g, '-');
  if (/^[+-]?(inf|∞)$/i.test(t)) return null;
  const m = t.match(/^(-?[\d.]+)\/(\d+)$/);
  const v = m ? Number(m[1]) / Number(m[2]) : Number(t);
  if (!Number.isFinite(v)) throw new Error(`Bad interval end "${s}"`);
  return v;
}

/**
 * Intervals written as in the books, left to right: "[-2, 4)", "(3, inf)", "(-∞, 1]", a single point "[2, 2]" or "{2}",
 * a union "(-inf, -2) U [1, inf)" (U or ∪), "R" for every number and "" / "∅" for none.
 */
export function parseIntervals(src: string): Piece[] {
  const s = src.trim();
  if (!s || s === '∅') return [];
  if (/^(R|ℝ|IR)$/.test(s)) return [{ from: null, to: null, open: [true, true] }];
  return s.split(/\s*(?:∪|\bU\b)\s*/).map((part) => {
    const pt = part.match(/^\{(.+)\}$/);
    if (pt) { const v = num(pt[1]); return { from: v, to: v, open: [false, false] as [boolean, boolean] }; }
    const m = part.match(/^([[(])\s*([^,;،]+?)\s*[,;،]\s*([^\])]+?)\s*([\])])$/);
    if (!m) throw new Error(`Bad interval "${part}"`);
    const from = num(m[2]), to = num(m[3]);
    return { from, to, open: [m[1] === '(' || from === null, m[4] === ')' || to === null] as [boolean, boolean] };
  });
}

/** A piece from config: a string such as "[-2, 4)", or { from, to, open }. */
export function pieceOf(p: string | Partial<Piece> & { open?: boolean | [boolean, boolean] }): Piece[] {
  if (typeof p === 'string') return parseIntervals(p);
  const from = p.from ?? null, to = p.to ?? null;
  const o = Array.isArray(p.open) ? p.open : [!!p.open, !!p.open];
  return [{ from, to, open: [o[0] || from === null, o[1] || to === null] }];
}

const lt = (a: number | null, b: number | null, aIsFrom: boolean, bIsFrom: boolean) => {
  // compare ends, with null = −∞ for a "from" and +∞ for a "to"
  const va = a === null ? (aIsFrom ? -Infinity : Infinity) : a;
  const vb = b === null ? (bIsFrom ? -Infinity : Infinity) : b;
  return va < vb - EPS;
};

/** Is v in the piece? */
export function inPiece(p: Piece, v: number): boolean {
  const above = p.from === null || v > p.from + EPS || (!p.open[0] && Math.abs(v - p.from) < EPS);
  const below = p.to === null || v < p.to - EPS || (!p.open[1] && Math.abs(v - p.to) < EPS);
  return above && below;
}
export const inSet = (ps: Piece[], v: number) => ps.some((p) => inPiece(p, v));

/** Drop empty pieces, sort, and merge pieces that overlap or touch with no gap ([1, 2] ∪ (2, 3) = [1, 3)). */
export function normalize(ps: Piece[]): Piece[] {
  const live = ps
    .map((p): Piece => ({ from: p.from, to: p.to, open: [p.open[0] || p.from === null, p.open[1] || p.to === null] }))
    .filter((p) => p.from === null || p.to === null || p.from < p.to - EPS || (eq(p.from, p.to) && !p.open[0] && !p.open[1]))
    .sort((a, b) => (lt(a.from, b.from, true, true) ? -1 : lt(b.from, a.from, true, true) ? 1 : Number(a.open[0]) - Number(b.open[0])));
  const out: Piece[] = [];
  for (const p of live) {
    const last = out[out.length - 1];
    // p joins last when it starts before last ends, or at the same number with that number covered by one of them
    const joins = last && (lt(p.from, last.to, true, false) || (eq(p.from, last.to) && !(p.open[0] && last.open[1])));
    if (!joins) { out.push({ ...p, open: [...p.open] as [boolean, boolean] }); continue; }
    if (lt(last.to, p.to, false, false)) { last.to = p.to; last.open[1] = p.open[1]; }
    else if (eq(last.to, p.to)) last.open[1] = last.open[1] && p.open[1];
  }
  return out;
}

export function sameSet(a: Piece[], b: Piece[]): boolean {
  const x = normalize(a), y = normalize(b);
  return x.length === y.length && x.every((p, i) => eq(p.from, y[i].from) && eq(p.to, y[i].to) && p.open[0] === y[i].open[0] && p.open[1] === y[i].open[1]);
}

/** The numbers not in the set. */
export function complement(ps: Piece[]): Piece[] {
  const n = normalize(ps), out: Piece[] = [];
  let from: number | null = null, open = true;
  for (const p of n) {
    if (p.from !== null) out.push({ from, to: p.from, open: [open, !p.open[0]] });
    from = p.to;
    open = !p.open[1];
    if (p.to === null) return normalize(out);
  }
  out.push({ from, to: null, open: [open, true] });
  return normalize(out);
}

/** The picture "up to the dots": the pieces and their ends, ignoring whether each end is open. */
function shapeOf(ps: Piece[]) {
  return normalize(ps.map((p) => ({ ...p, open: [p.from === null, p.to === null] as [boolean, boolean] })))
    .map((p) => [p.from, p.to].map((v) => (v === null ? '∞' : Math.round(v * 1e6))).join('|')).join(' ');
}

// ---------------------------------------------------------------- notation

export interface Fmt { digits: string; decimal: string }
/** A number in locale digits with − and the locale decimal mark (3.5 → ۳/۵ fa-IR, ۳,۵ fa-AF). */
export function numText(v: number, f: Fmt): string {
  const r = Math.round(v * 1e6) / 1e6;
  const s = decimalString(Math.round(r * 1e6), 1e6) ?? String(r);
  return s.replace('-', '−').replace('.', f.decimal).replace(/[0-9]/g, (d) => f.digits[Number(d)]);
}
/** Interval ends are separated by ", ", or "، " where "," is the decimal mark (fa-AF, ps), as in set braces. */
const sep = (f: Fmt) => (f.decimal === ',' ? '، ' : ', ');

/** "[−۲, ۴)", "(۳, ∞)", "(−∞, ۱] ∪ [۲, ۵)", "∅". */
export function intervalText(ps: Piece[], f: Fmt): string {
  const n = normalize(ps);
  if (!n.length) return '∅';
  return n.map((p) => {
    if (p.from !== null && eq(p.from, p.to)) return `{${numText(p.from, f)}}`;
    return (p.open[0] ? '(' : '[') + (p.from === null ? '−∞' : numText(p.from, f)) + sep(f) +
      (p.to === null ? '∞' : numText(p.to, f)) + (p.open[1] ? ')' : ']');
  }).join(' ∪ ');
}

/** Each piece as an inequality in `x`: "x > ۳", "−۲ ≤ x < ۴", "x = ۲" (join them with the locale's "or"). */
export function inequalityTexts(ps: Piece[], f: Fmt, x = 'x'): string[] {
  return normalize(ps).map((p) => {
    const a = p.from === null ? null : numText(p.from, f), b = p.to === null ? null : numText(p.to, f);
    if (a !== null && b !== null && a === b) return `${x} = ${a}`;
    if (a === null && b === null) return `−∞ < ${x} < ∞`;
    if (b === null) return `${x} ${p.open[0] ? '>' : '≥'} ${a}`;
    if (a === null) return `${x} ${p.open[1] ? '<' : '≤'} ${b}`;
    return `${a} ${p.open[0] ? '<' : '≤'} ${x} ${p.open[1] ? '<' : '≤'} ${b}`;
  });
}

// ---------------------------------------------------------------- linear inequalities and factors

/** f(x) for an ASCII expression in one letter: "2x - 1", "-x + 3", "3(x - 1)". */
export function fn(src: string, x = 'x'): (v: number) => number {
  const toks = tokenize(src.replace(/−/g, '-').replace(/(^|[(*/+])\s*-\s*(?=[a-zA-Z(])/g, '$1-1*'));
  return (v) => evaluate(toks, { [x]: v });
}

const REL = /\s*(<=|>=|≤|≥|<|>)\s*/;
export interface Ineq { left: (v: number) => number; right: (v: number) => number; rel: '<' | '>' | '≤' | '≥' }
/** "2x - 1 < 7", "-3x >= 6", "3 < x". */
export function parseIneq(src: string, x = 'x'): Ineq {
  const parts = src.split(REL);
  if (parts.length !== 3) throw new Error(`Bad inequality "${src}"`);
  const rel = ({ '<=': '≤', '>=': '≥' } as Record<string, Ineq['rel']>)[parts[1]] ?? (parts[1] as Ineq['rel']);
  return { left: fn(parts[0], x), right: fn(parts[2], x), rel };
}
export function holds(q: Ineq, v: number): { l: number; r: number; ok: boolean } {
  const l = q.left(v), r = q.right(v), d = l - r;
  const ok = q.rel === '<' ? d < -EPS : q.rel === '>' ? d > EPS : q.rel === '≤' ? d <= EPS : d >= -EPS;
  return { l, r, ok };
}
/** The solution set of a linear inequality (both sides linear in x). */
export function solveLinear(q: Ineq): Piece[] {
  const d = (v: number) => q.left(v) - q.right(v);
  const b = d(0), a = d(1) - b;
  const strict = q.rel === '<' || q.rel === '>';
  if (Math.abs(a) < EPS) return holds(q, 0).ok ? [{ from: null, to: null, open: [true, true] }] : [];
  const root = -b / a, up = (q.rel === '>' || q.rel === '≥') === a > 0; // solutions above the root?
  return [up ? { from: root, to: null, open: [strict, true] } : { from: null, to: root, open: [true, strict] }];
}

/** The zero of a linear factor such as "x - 1", "2x + 3", "3 - x" (null if constant). */
export function zeroOf(factor: string, x = 'x'): number | null {
  const f = fn(factor, x), b = f(0), a = f(1) - b;
  return Math.abs(a) < EPS ? null : -b / a;
}

/** The sorted distinct critical points (zeros of all factors). */
export function criticalPoints(factors: string[], x = 'x'): number[] {
  const out: number[] = [];
  for (const z of factors.map((s) => zeroOf(s, x))) if (z !== null && !out.some((v) => eq(v, z))) out.push(z);
  return out.sort((a, b) => a - b);
}

/** A point inside each cell between the critical points (cells = critical points + 1). */
export function cellSamples(cps: number[]): number[] {
  if (!cps.length) return [0];
  return [cps[0] - 1, ...cps.slice(1).map((c, i) => (cps[i] + c) / 2), cps[cps.length - 1] + 1];
}

/** True signs: one row per factor, then the result row (product or quotient: same sign). */
export function signTable(factors: string[], x = 'x'): Sign[][] {
  const xs = cellSamples(criticalPoints(factors, x));
  const rows = factors.map((s) => { const f = fn(s, x); return xs.map((v): Sign => (f(v) > 0 ? '+' : '-')); });
  return [...rows, xs.map((_, i): Sign => (rows.filter((r) => r[i] === '-').length % 2 ? '-' : '+'))];
}

// ---------------------------------------------------------------- the `interval` check

export interface IntervalCheck {
  type: 'interval';
  /** The answer set: "(3, inf)", "[-2, 4)", "(-inf, -2) U [1, inf)". */
  value?: string;
  /** Or one interval by its ends (null = ∞) … */
  from?: number | null;
  to?: number | null;
  open?: boolean | [boolean, boolean];
  /** … or a union, each a string. */
  union?: string[];
  /** Every sign cell must be right. */
  signs?: boolean;
  /** The inequality was multiplied or divided by a negative: a ray the wrong way is `sign-not-flipped`. */
  flipped?: boolean;
  /** Numbers where the expression is undefined (a denominator's zero): taking one in is `pole-included`. */
  poles?: number[];
  /** Known wrong sets with their own feedback code, tried first. */
  traps?: { value: string; code: string }[];
}

export interface Res { ok: boolean; code?: string }
const fail = (code: string): Res => ({ ok: false, code });

/** The set a check asks for. */
export function wanted(c: IntervalCheck): Piece[] | null {
  if (c.value !== undefined) return parseIntervals(String(c.value));
  if (c.union) return c.union.flatMap((s) => parseIntervals(s));
  if (c.from !== undefined || c.to !== undefined) return pieceOf({ from: c.from ?? null, to: c.to ?? null, open: c.open });
  return null;
}

export function checkInterval(c: IntervalCheck, s: IntervalState | undefined): Res {
  if (c.signs) {
    const g = s?.signs;
    if (!g || g.cells.some((r) => r.some((v) => !v))) return fail('signs-empty');
    const bad = g.cells.findIndex((r, i) => r.some((v, j) => v !== g.want[i][j]));
    if (bad >= 0) {
      const res = g.cells[g.cells.length - 1], wantRes = g.want[g.want.length - 1];
      const alternates = res.every((v, j) => j === 0 || v !== res[j - 1]);
      const factorsRight = g.cells.slice(0, -1).every((r, i) => r.every((v, j) => v === g.want[i][j]));
      if (bad === g.cells.length - 1 && alternates && !wantRes.every((v, j) => j === 0 || v !== wantRes[j - 1])) return fail('signs-alternate');
      return fail(factorsRight ? 'signs-result' : 'signs-wrong');
    }
  }
  const want = wanted(c);
  if (!want) return { ok: true };
  const got = s?.intervals ?? [];
  if (!normalize(got).length) return fail('empty');
  if (sameSet(got, want)) return { ok: true };
  const trap = c.traps?.find((t) => sameSet(got, parseIntervals(String(t.value))));
  if (trap) return fail(trap.code);
  if (c.poles?.some((p) => inSet(got, p) && !inSet(want, p))) return fail('pole-included');
  if (shapeOf(got) === shapeOf(want)) return fail('open-closed');
  if (shapeOf(got) === shapeOf(complement(want))) return fail(c.flipped ? 'sign-not-flipped' : 'wrong-direction');
  const g = normalize(got), w = normalize(want);
  if (g.length !== w.length) return fail('pieces');
  // a segment drawn where the numbers go on for ever ("the numbers stop at 5")
  if (w.some((p) => p.from === null || p.to === null) && g.every((p) => p.from !== null && p.to !== null)) return fail('not-ray');
  return fail('wrong-end');
}

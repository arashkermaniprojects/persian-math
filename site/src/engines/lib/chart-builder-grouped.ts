// Grouped data for the chart-builder `grouped` module (engines/chart-builder/grouped.ts), and its check (type
// `grouped`, docs/STUDIOS.md). Pure, so lib/checks.ts and the tests can use it.
// Classes are closed on the left, as in the Iranian and Afghan books: 140 ≤ x < 145 (Iran G8 «دسته‌بندی داده‌ها»
// p.120); with `last` the last class is closed on both sides (Iran: 190 ≤ x ≤ 205).

/** Table columns, in the order they are drawn and checked: frequency, relative frequency, midpoint (or the row's
 *  value), midpoint × frequency, running total (cumulative frequency). */
export type Col = 'f' | 'rel' | 'mid' | 'fx' | 'cum';
export const COLS: Col[] = ['f', 'rel', 'mid', 'fx', 'cum'];

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** The class of v (-1 = outside every class). */
export function classOf(v: number, b: number[], last = false): number {
  for (let i = 0; i + 1 < b.length; i++) if (v >= b[i] && (v < b[i + 1] || (last && i + 2 === b.length && v === b[i + 1]))) return i;
  return -1;
}
/** Frequencies of the data in the classes; `side` = which values count: `left` (a ≤ v < b, the rule), `right`
 *  (a < v ≤ b) or `both` (a ≤ v ≤ b: a boundary value counted twice). */
export function counts(data: number[], b: number[], last = false, side: 'left' | 'right' | 'both' = 'left'): number[] {
  return b.slice(1).map((hi, i) => {
    const lo = b[i];
    return data.filter((v) =>
      side === 'left' ? classOf(v, b, last) === i : side === 'right' ? v > lo && v <= hi : v >= lo && v <= hi).length;
  });
}
export const mids = (b: number[]) => b.slice(1).map((hi, i) => (b[i] + hi) / 2);
export const running = (f: number[]) => f.map((_, i) => sum(f.slice(0, i + 1)));
export const groupedMean = (x: number[], f: number[]) => sum(x.map((v, i) => v * f[i])) / sum(f);
/** The median read off the cumulative frequency graph (straight lines between the class ends): where it reaches n/2. */
export function groupedMedian(b: number[], f: number[]): number {
  const cum = running(f), half = sum(f) / 2;
  const i = cum.findIndex((c) => c >= half);
  if (i < 0) return NaN;
  const below = i ? cum[i - 1] : 0;
  return b[i] + ((half - below) / f[i]) * (b[i + 1] - b[i]);
}

export interface GroupedState {
  /** The raw data (one card each), in the order dealt; empty when only frequencies are given. */
  data: number[];
  /** The class each card was put in (-1 = not yet). */
  cards: number[];
  /** Class boundaries [140, 145, …] (empty for named rows); `last`: the last class includes its upper end. */
  bounds: number[];
  last: boolean;
  /** Each row's frequency and value (class midpoint, or the row's given value). */
  freq: number[];
  x: number[];
  /** Typed cells `<col>-<row>`, totals `<col>-total`, and answers `mean`, `median`. null = blank or not a number. */
  typed: Record<string, number | null>;
  /** The learner's histogram bars, one per class (empty when not drawn). */
  bars: number[];
  /** The learner's polygon or cumulative graph: [x, y] points, left to right. */
  points: [number, number][];
  /** The graph chosen («کدام نمودار؟»): bars, histogram, polygon, cumulative. */
  chosen: string | null;
}

export interface GroupedCheck {
  type: 'grouped';
  /** Every card is in its class. */
  sorted?: boolean;
  /** Every typed table cell and total is right. */
  table?: boolean;
  /** The graph to choose. */
  chosen?: string;
  /** The histogram bars equal the frequencies. */
  histogram?: boolean;
  /** A point at each class midpoint at its frequency; `closed`: also 0 at the midpoints just outside. */
  polygon?: true | 'closed';
  /** A point at each class's upper end at its running total; `from-zero`: also 0 at the first class's lower end. */
  cumulative?: true | 'from-zero';
  /** Typed answers: a number, or `true` (what the data gives). */
  mean?: number | true;
  median?: number | true;
  /** Allowed difference for `mean`/`median` (default 0.01); relative frequencies may be rounded to 2 places. */
  tolerance?: number;
  /** Known wrong answers with their own feedback code (tried first): a cell (`mid-0`) or answer with its value, or a chosen graph. */
  traps?: { cell?: string; value?: number; chosen?: string; code: string }[];
}

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });

/** The right value of every cell, the totals included. */
export function expected(st: Pick<GroupedState, 'freq' | 'x'>): Record<string, number> {
  const { freq: f, x } = st, n = sum(f), cum = running(f);
  const e: Record<string, number> = { 'f-total': n, 'rel-total': 1, 'fx-total': sum(x.map((v, i) => v * f[i])) };
  f.forEach((fi, i) => Object.assign(e, { [`f-${i}`]: fi, [`rel-${i}`]: fi / n, [`mid-${i}`]: x[i], [`fx-${i}`]: fi * x[i], [`cum-${i}`]: cum[i] }));
  return e;
}

/** Why typed cell k (value v) is wrong. */
function cellCode(k: string, v: number, st: GroupedState): string {
  const [col, r] = k.split('-'), i = +r, b = st.bounds, f = st.freq;
  if (r === 'total') return col === 'rel' ? 'rel-not-one' : 'total-wrong';
  if (col === 'f' && st.data.length && b.length) {
    if (near(v, counts(st.data, b, st.last, 'both')[i])) return 'boundary-twice';
    if (near(v, counts(st.data, b, st.last, 'right')[i])) return 'boundary-left';
  }
  if (col === 'rel' && near(v, f[i])) return 'rel-is-f';
  if (col === 'mid' && b.length) {
    if (near(v, b[i + 1] - b[i])) return 'width-not-midpoint';
    if (near(v, b[i]) || near(v, b[i + 1])) return 'mid-is-end';
  }
  if (col === 'cum' && near(v, f[i])) return 'cum-not-running';
  return `${col}-wrong`;
}

/** Why a graph is wrong: the wanted points, the allowed extra ones, and the codes for points at the wrong x. */
function pointsCode(got: [number, number][], want: [number, number][], extra: [number, number][], need: boolean, wrongX: (x: number) => string): string {
  if (!got.length) return 'points-empty';
  const has = (p: [number, number]) => got.some((q) => near(q[0], p[0]) && near(q[1], p[1]));
  for (const p of got) {
    if (want.some((w) => near(w[0], p[0])) || extra.some((w) => near(w[0], p[0]))) continue;
    const c = wrongX(p[0]);
    if (c) return c;
  }
  for (const w of want) {
    const q = got.find((p) => near(p[0], w[0]));
    if (q && !near(q[1], w[1])) return 'point-wrong';
  }
  if (!want.every(has)) return 'points-missing';
  const same = (p: [number, number]) => (w: [number, number]) => near(w[0], p[0]) && near(w[1], p[1]);
  if (got.some((p) => !want.some(same(p)) && !extra.some(same(p)))) return 'points-extra';
  if (need && !extra.every(has)) return 'not-closed';
  return '';
}

/**
 * Order: sorted → table → chosen → histogram → polygon → cumulative → mean → median.
 * Codes: `cards-left`, `boundary-left` (a boundary value put in the class it ends), `card-wrong`; `table-empty`,
 * `boundary-twice` (a boundary value counted in both classes), `boundary-left` (counted a < x ≤ b), `f-wrong`,
 * `rel-is-f`, `rel-wrong`, `rel-not-one` (the relative frequencies' total is not 1), `width-not-midpoint`,
 * `mid-is-end`, `mid-wrong`, `fx-wrong`, `cum-not-running`, `cum-wrong`, `total-wrong`; `choose-empty`, `gap-bars`
 * (a bar chart with gaps for grouped data), `wrong-chart`; `bars-empty`, `bar-wrong`; `points-empty`,
 * `polygon-at-ends`, `cum-at-midpoints`, `cum-not-running`, `point-wrong`, `points-missing`, `points-extra`,
 * `not-closed` (polygon) / `cum-no-start` (cumulative); `empty`, `mean-of-classes` (Σf ÷ classes), `plain-mean`
 * (midpoints averaged without the frequencies), `fx-total-only`, `fx-over-classes`, `mean-uses-ends`, `read-y`
 * (n/2 given as the median), `too-big`/`too-small`.
 */
export function checkGrouped(c: GroupedCheck, st?: GroupedState): Result {
  if (!st) return fail('empty');
  const b = st.bounds, f = st.freq, x = st.x, k = f.length, n = sum(f);
  const trap = (cell: string, v: number, tol = 1e-6) => c.traps?.find((t) => t.cell === cell && t.value !== undefined && near(t.value, v, tol))?.code;
  if (c.sorted) {
    if (st.cards.some((r) => r < 0)) return fail('cards-left');
    for (let i = 0; i < st.data.length; i++) {
      const v = st.data[i], r = st.cards[i];
      if (r !== classOf(v, b, st.last)) return fail(near(v, b[r + 1]) ? 'boundary-left' : 'card-wrong');
    }
  }
  if (c.table) {
    const e = expected(st);
    const keys = Object.keys(st.typed).filter((t) => t.includes('-'));
    if (keys.some((t) => st.typed[t] == null)) return fail('table-empty');
    const order = (t: string) => { const [col, r] = t.split('-'); return COLS.indexOf(col as Col) * 1000 + (r === 'total' ? 999 : +r); };
    for (const t of keys.sort((p, q) => order(p) - order(q))) {
      const v = st.typed[t]!, tol = t.startsWith('rel') ? 0.0051 : 1e-6;
      if (e[t] === undefined || near(v, e[t], tol)) continue;
      return fail(trap(t, v) ?? cellCode(t, v, st));
    }
  }
  if (c.chosen !== undefined) {
    if (st.chosen == null) return fail('choose-empty');
    if (st.chosen !== c.chosen)
      return fail(c.traps?.find((t) => t.chosen === st.chosen)?.code ?? (st.chosen === 'bars' && c.chosen === 'histogram' ? 'gap-bars' : 'wrong-chart'));
  }
  if (c.histogram) {
    if (!st.bars.some((v) => v)) return fail('bars-empty');
    if (st.bars.some((v, i) => !near(v, f[i]))) return fail('bar-wrong');
  }
  const w = b.length > 1 ? b[1] - b[0] : 1;
  const onEnd = (px: number) => b.some((e) => near(e, px));
  if (c.polygon) {
    const m = mids(b);
    const code = pointsCode(st.points, m.map((v, i) => [v, f[i]]), [[b[0] - w / 2, 0], [b[k] + (b[k] - b[k - 1]) / 2, 0]], c.polygon === 'closed',
      (px) => (onEnd(px) ? 'polygon-at-ends' : ''));
    if (code) return fail(code);
  }
  if (c.cumulative) {
    const cum = running(f);
    // heights equal to the frequencies (not the running totals) at the class ends
    if (st.points.some((p) => { const i = b.indexOf(p[0]) - 1; return i >= 1 && near(p[1], f[i]) && !near(f[i], cum[i]); })) return fail('cum-not-running');
    const code = pointsCode(st.points, b.slice(1).map((e, i) => [e, cum[i]]), [[b[0], 0]], c.cumulative === 'from-zero',
      (px) => (mids(b).some((m) => near(m, px)) ? 'cum-at-midpoints' : ''));
    if (code) return fail(code === 'not-closed' ? 'cum-no-start' : code);
  }
  const tol = c.tolerance ?? 0.01;
  if (c.mean !== undefined) {
    const v = st.typed.mean;
    if (v == null) return fail('empty');
    const want = c.mean === true ? groupedMean(x, f) : c.mean;
    if (!near(v, want, tol)) {
      const fx = sum(x.map((xi, i) => xi * f[i]));
      const t = trap('mean', v, tol);
      if (t) return fail(t);
      if (near(v, n / k, tol)) return fail('mean-of-classes');
      if (near(v, sum(x) / k, tol)) return fail('plain-mean');
      if (near(v, fx, tol)) return fail('fx-total-only');
      if (near(v, fx / k, tol)) return fail('fx-over-classes');
      if (b.length && [b.slice(0, -1), b.slice(1)].some((e) => near(v, groupedMean(e, f), tol))) return fail('mean-uses-ends');
      return fail(v > want ? 'too-big' : 'too-small');
    }
  }
  if (c.median !== undefined) {
    const v = st.typed.median;
    if (v == null) return fail('empty');
    const want = c.median === true ? groupedMedian(b, f) : c.median;
    if (!near(v, want, tol)) return fail(trap('median', v, tol) ?? (near(v, n / 2, tol) && !near(want, n / 2, tol) ? 'read-y' : v > want ? 'too-big' : 'too-small'));
  }
  return { ok: true };
}

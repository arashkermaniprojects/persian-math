// Averages and spread for the chart-builder `summary` module (engines/chart-builder/summary.ts), and its check
// (type `summary`, docs/STUDIOS.md). Pure, so lib/checks.ts and the tests can use it.

export type Stat = 'mean' | 'median' | 'mode' | 'range' | 'mad';
export const STATS: Stat[] = ['median', 'mode', 'range', 'mean', 'mad'];

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
export const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
export const total = (a: number[]) => a.reduce((s, v) => s + v, 0);
export const mean = (a: number[]) => (a.length ? total(a) / a.length : NaN);
/** The middle value(s) of the data in order: one for an odd count, two for an even count. */
export function middles(a: number[]): number[] {
  const s = sorted(a), n = s.length;
  if (!n) return [];
  return n % 2 ? [s[(n - 1) / 2]] : [s[n / 2 - 1], s[n / 2]];
}
export const median = (a: number[]) => mean(middles(a));
export const freq = (a: number[], v: number) => a.filter((x) => near(x, v)).length;
/** The values that occur most often (none when every value occurs once, as the books say: «مد ندارد»). */
export function modes(a: number[]): number[] {
  const vs = [...new Set(sorted(a))];
  const top = Math.max(0, ...vs.map((v) => freq(a, v)));
  return top < 2 && a.length > 1 ? [] : vs.filter((v) => freq(a, v) === top);
}
export const range = (a: number[]) => (a.length ? Math.max(...a) - Math.min(...a) : NaN);
/** Mean absolute deviation: the average distance of the values from their mean. */
export function mad(a: number[]) {
  const m = mean(a);
  return mean(a.map((v) => Math.abs(v - m)));
}
export function statOf(k: Stat, a: number[]): number {
  return k === 'mean' ? mean(a) : k === 'median' ? median(a) : k === 'range' ? range(a) : k === 'mad' ? mad(a) : modes(a)[0] ?? NaN;
}
/** In order, smallest first or largest first (both give the same middle). */
export function isOrdered(a: number[]) {
  const up = a.every((v, i) => !i || a[i - 1] <= v);
  const down = a.every((v, i) => !i || a[i - 1] >= v);
  return up || down;
}

/** One data set as the module reports it. */
export interface SummarySet {
  key: string;
  /** The values as first given, in the given order. */
  given: number[];
  /** The values now (a dragged value has moved), in the given order. */
  data: number[];
  /** The line-up of cards, left to right, when the set is shown as cards (else absent). */
  line?: number[];
  /** Values of the cards or stacks the learner has marked. */
  marked: number[];
}

export interface SummaryState {
  sets: SummarySet[];
  /** Typed answers: `median`, or `median-<set>` when there are several sets. null = blank or not a number. */
  typed: Record<string, number | null>;
  /** The average chosen as the best («کدام میانگین؟»). */
  best: string | null;
  /** Sentence frames: the option chosen in each slot (null = not chosen). */
  compare: Record<string, (string | null)[]>;
}

type Want = number | true;
type Slot = string | string[] | null;

export interface SummaryCheck {
  type: 'summary';
  /** The line-up of cards is in order (either way). */
  ordered?: boolean;
  /** The marked cards/stacks: `middle` (the median's card or two cards), `mode` (the tallest stack(s)), `ends`
   *  (the smallest and the largest), or a list of values (e.g. an outlier). */
  marked?: 'middle' | 'mode' | 'ends' | number[];
  /** A value was dragged away from where it started. */
  moved?: boolean;
  /** Typed answers: a number, `true` (whatever the data now gives), or one per set ({ a: 6, b: true }). */
  median?: Want | Record<string, Want>;
  mode?: Want | Record<string, Want>;
  range?: Want | Record<string, Want>;
  mean?: Want | Record<string, Want>;
  mad?: Want | Record<string, Want>;
  /** Allowed difference for typed answers (default 0.01: a mean of 6⅔ may be typed 6.67). */
  tolerance?: number;
  /** The best average: a key or a list of keys. */
  best?: string | string[];
  /** Sentence frames: per frame, per slot the accepted option(s); null = anything. */
  compare?: Record<string, Slot[]>;
  /** Known wrong answers with their own feedback code (tried before the built-in ones). */
  traps?: { stat?: Stat; set?: string; value?: number; best?: string; frame?: string; slots?: Slot[]; code: string }[];
}

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });
const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const sameSet = (a: number[], b: number[]) => {
  const x = [...new Set(a)].sort(), y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => near(v, y[i]));
};

/** Why a marking is wrong, or '' when it is right. */
function markCode(want: SummaryCheck['marked'], s: SummarySet): string {
  const got = s.marked;
  if (!got.length) return 'mark-empty';
  if (want === 'middle') {
    if (s.line && !isOrdered(s.line)) return 'unordered-median';
    const mid = middles(s.data);
    if (sameSet(got, mid)) return '';
    if (mid.length === 2 && new Set(got).size === 1 && mid.some((m) => near(m, got[0]))) return 'even-middle';
    return 'not-middle';
  }
  if (want === 'mode') {
    const m = modes(s.data);
    return sameSet(got, m) ? '' : got.every((v) => m.some((x) => near(x, v))) ? 'mode-missing' : 'not-mode';
  }
  if (want === 'ends') {
    const lo = Math.min(...s.data), hi = Math.max(...s.data);
    if (sameSet(got, [lo, hi])) return '';
    const g = [...new Set(got)];
    return g.length === 1 && (near(g[0], lo) || near(g[0], hi)) ? 'one-end' : 'not-ends';
  }
  return sameSet(got, want!) ? '' : 'marked-wrong';
}

/** The built-in diagnosis of a wrong typed value for statistic k of data set s. */
function typedCode(k: Stat, v: number, s: SummarySet, tol: number): string {
  const d = s.data;
  if (k === 'median') {
    const g = s.given, n = g.length;
    const raw = n % 2 ? g[(n - 1) / 2] : (g[n / 2 - 1] + g[n / 2]) / 2; // the middle of the cards as given
    if (!isOrdered(g) && near(v, raw, tol)) return 'unordered-median';
    const mid = middles(d);
    if (mid.length === 2 && mid.some((m) => near(m, v, tol))) return 'even-middle';
  }
  if (k === 'mode' && modes(d).some((m) => near(freq(d, m), v, tol))) return 'mode-is-frequency';
  if (k === 'range' && near(v, Math.max(...d), tol)) return 'range-is-max';
  if (k === 'mean' && near(v, total(d), tol)) return 'total-only';
  if (k === 'mean' && near(v, median(d), tol) && !near(median(d), mean(d), tol)) return 'median-not-mean';
  if (k === 'mad' && near(v, 0, tol)) return 'signed-deviations';
  return v > statOf(k, d) ? 'too-big' : 'too-small';
}

/**
 * Order: ordered → marked → moved → typed (median, mode, range, mean, mad; per set in set order) → best → compare.
 * Codes: `not-ordered`; `mark-empty`, `unordered-median`, `even-middle`, `not-middle`, `not-mode`, `mode-missing`,
 * `one-end`, `not-ends`, `marked-wrong`; `not-moved`; `empty`, `unordered-median`, `even-middle`,
 * `mode-is-frequency`, `range-is-max`, `total-only`, `median-not-mean`, `signed-deviations`, `too-big`/`too-small`;
 * `best-empty`, `wrong-best`; `compare-empty` (a slot left blank), `frame-missing` (a whole frame left out: e.g.
 * averages compared, spread not), `compare-wrong`. Trap codes first wherever a trap matches.
 */
export function checkSummary(c: SummaryCheck, st?: SummaryState): Result {
  if (!st?.sets?.length) return fail('empty');
  const s0 = st.sets[0];
  const setOf = (k?: string) => st.sets.find((s) => s.key === k) ?? s0;
  const tol = c.tolerance ?? 0.01;
  if (c.ordered && s0.line && !isOrdered(s0.line))
    return fail(c.marked === 'middle' && s0.marked.length ? 'unordered-median' : 'not-ordered');
  if (c.marked !== undefined) {
    for (const s of st.sets) {
      const code = markCode(c.marked, s);
      if (code) return fail(code);
    }
  }
  if (c.moved && st.sets.every((s) => s.data.every((v, i) => near(v, s.given[i])))) return fail('not-moved');
  for (const k of STATS) {
    const w = c[k];
    if (w === undefined) continue;
    const per: [string | undefined, Want][] = typeof w === 'object' ? Object.entries(w) : [[undefined, w]];
    for (const [key, want] of per) {
      const s = setOf(key);
      const v = st.typed[st.sets.length > 1 ? `${k}-${s.key}` : k];
      if (v == null) return fail('empty');
      const ok = want === true ? (k === 'mode' ? modes(s.data) : [statOf(k, s.data)]) : [want];
      if (ok.some((x) => near(v, x, tol))) continue;
      const trap = c.traps?.find((t) => t.stat === k && (t.set === undefined || t.set === s.key) && t.value !== undefined && near(t.value, v, tol));
      return fail(trap?.code ?? typedCode(k, v, s, tol));
    }
  }
  if (c.best !== undefined) {
    if (st.best == null) return fail('best-empty');
    if (!list(c.best).includes(st.best)) return fail(c.traps?.find((t) => t.best === st.best)?.code ?? 'wrong-best');
  }
  if (c.compare) {
    const frames = Object.entries(c.compare);
    const got = (f: string) => st.compare[f] ?? [];
    const filled = (f: string, n: number) => Array.from({ length: n }, (_, i) => got(f)[i]).filter((x) => x != null).length;
    const some = frames.some(([f, sl]) => filled(f, sl.length) === sl.length);
    for (const [f, sl] of frames) {
      const n = filled(f, sl.length);
      if (n < sl.length) return fail(n === 0 && some ? 'frame-missing' : 'compare-empty');
    }
    const fits = (slots: Slot[], f: string) => slots.every((w, i) => w == null || list(w).includes(got(f)[i]!));
    for (const [f, sl] of frames) {
      if (fits(sl, f)) continue;
      const trap = c.traps?.find((t) => t.frame === f && t.slots && fits(t.slots, f));
      return fail(trap?.code ?? 'compare-wrong');
    }
  }
  return { ok: true };
}

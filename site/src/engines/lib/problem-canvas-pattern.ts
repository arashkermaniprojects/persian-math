// Number patterns in a <kg-problem-canvas> table column («الگویابی»): the hops between neighbours, and the rule
// a column follows, so the engine can draw "+۳ +۳ +۳" arrows and the check can accept any correct continuation.
import { tidy } from './problem-canvas-expr';

/**
 * add: the same number added each time (1, 4, 7 → +3); mul: the same factor (2, 6, 18 → ×3);
 * grow: the hop itself grows by the same amount each time (1, 3, 6, 10: hops +2 +3 +4, Iran G4 «الگوی مثلثی»).
 */
export type Pattern = { kind: 'add'; step: number } | { kind: 'mul'; factor: number } | { kind: 'grow'; step: number; hop: number };

/** Differences between neighbouring values; a gap (null) on either side gives null. */
export function hops(values: (number | null)[]): (number | null)[] {
  return values.slice(1).map((v, i) => (v === null || values[i] === null ? null : tidy(v - values[i]!)));
}

const same = (xs: number[]) => xs.every((x) => x === xs[0]);

/**
 * The simplest rule that fits every value (at least 3 values, no gaps), trying add, then mul, then grow;
 * null when none fits. Two values are not enough to tell +2 (2, 4, 6) from ×2 (2, 4, 8).
 */
export function findPattern(values: number[]): Pattern | null {
  if (values.length < 3) return null;
  const d = hops(values) as number[];
  if (same(d)) return { kind: 'add', step: d[0] };
  if (values.every((v) => v !== 0)) {
    const r = values.slice(1).map((v, i) => tidy(v / values[i]));
    if (same(r)) return { kind: 'mul', factor: r[0] };
  }
  if (values.length >= 4) {
    const dd = hops(d) as number[];
    if (same(dd) && dd[0] !== 0) return { kind: 'grow', step: dd[0], hop: d[d.length - 1] };
  }
  return null;
}

/** The next `n` values of a sequence that follows `p`. */
export function extend(values: number[], p: Pattern, n: number): number[] {
  const out: number[] = [];
  let last = values[values.length - 1];
  let hop = p.kind === 'grow' ? p.hop : 0;
  for (let k = 0; k < n; k++) {
    if (p.kind === 'add') last = tidy(last + p.step);
    else if (p.kind === 'mul') last = tidy(last * p.factor);
    else {
      hop = tidy(hop + p.step);
      last = tidy(last + hop);
    }
    out.push(last);
  }
  return out;
}

/**
 * Index of the first value in `values` that breaks the pattern of its first `given` values, or −1 if every
 * filled value follows it (gaps are skipped, so "fill the 5th" works without the 4th). With no detectable
 * pattern in the given values, nothing can be judged and −1 is returned.
 */
export function firstBreak(values: (number | null)[], given: number): number {
  const head = values.slice(0, given);
  if (head.some((v) => v === null)) return -1;
  const p = findPattern(head as number[]);
  if (!p) return -1;
  const want = extend(head as number[], p, values.length - given);
  for (let i = given; i < values.length; i++) if (values[i] !== null && values[i] !== want[i - given]) return i;
  return -1;
}

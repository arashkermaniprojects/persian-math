// Answer checking for <kg-probability-sim> (check type `chance`, docs/STUDIOS.md). Pure, so lib/checks.ts can use it.
import { rankOf, type Frac } from './probability-sim-math';

export interface ChanceCheck {
  type: 'chance';
  /** The probability that the outcome is one of `outcomes` (after the learner edits the bag/spinner): `value` [n, d] or a `level`. */
  prob?: { outcomes: string[]; value?: Frac; level?: string };
  /** The outcomes the learner tapped are exactly the sample space. */
  space?: boolean;
  /** The outcomes the learner tapped (tiles or grid cells) are exactly these: an event, e.g. the cells with total 7. */
  event?: string[];
  /** Every event is placed at its right level on the likelihood line. */
  scale?: boolean;
  /** The outcome the learner chose ("which is most likely?"): one key or a list of acceptable keys. */
  chosen?: string | string[];
  /** At least this many trials run (e.g. "spin 10 times to test your guess"). */
  trials?: number;
  /** The typed probability (`answer: fraction` or `decimal`) equals this fraction (equivalent fractions accepted). */
  answer?: Frac;
  /** The typed estimate is the relative frequency of `outcome` in the learner's own trials, ± `within` (default 0.005). */
  estimate?: { outcome: string; within?: number };
  /** Known wrong answers with their own feedback code: a chosen outcome, an event placed at a level, a tapped outcome, or a typed value. */
  traps?: { chosen?: string; event?: string; level?: string; listed?: string; value?: Frac; code: string }[];
}

export interface ChanceState {
  trials?: number;
  /** Results so far per outcome key. */
  tally?: Record<string, number>;
  last?: string | null;
  /** Theoretical probability of every outcome of the device(s) as they are now. */
  probs?: Record<string, Frac>;
  /** The likelihood line: each event's placed level (null = not yet) and its true level. */
  events?: { key: string; placed: string | null; truth: string }[];
  levels?: 3 | 5;
  /** Outcomes the learner tapped as possible, and the true sample space. */
  listed?: string[];
  space?: string[];
  chosen?: string | null;
  bag?: Record<string, number>;
}

const RANGE: Record<string, [number, number, boolean]> = {
  impossible: [0, 0, false], unlikely: [0, 0.5, true], even: [0.5, 0.5, false], likely: [0.5, 1, true], certain: [1, 1, false], possible: [0, 1, true],
};

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });

/** Conditions are tested in this order: prob → space → event → scale → chosen → trials → answer → estimate. `typed` is the typed number. */
export function checkChance(check: ChanceCheck, s: ChanceState = {}, typed: number | null = null): Result {
  const traps = check.traps ?? [];
  if (check.prob) {
    const probs = Object.entries(s.probs ?? {});
    if (!probs.length) return fail('empty-bag');
    let n = 0, d = 1;
    for (const [k, [a, b]] of probs) if (check.prob.outcomes.includes(k)) [n, d] = [n * b + a * d, d * b];
    const got = n / d, e = 1e-9;
    // The allowed range: a single value, or an open range for possible / likely / unlikely.
    const [lo, hi, open] = check.prob.value ? [check.prob.value[0] / check.prob.value[1], check.prob.value[0] / check.prob.value[1], false]
      : RANGE[check.prob.level ?? 'certain'] ?? [1, 1, false];
    if (open ? got <= lo + e : got < lo - e) return fail('too-unlikely');
    if (open ? got >= hi - e : got > hi + e) return fail('too-likely');
  }
  if (check.space) {
    const listed = s.listed ?? [], space = s.space ?? [];
    if (!listed.length) return fail('space-empty');
    const extra = listed.find((k) => !space.includes(k));
    if (extra !== undefined) return fail(traps.find((t) => t.listed === extra)?.code ?? 'space-extra');
    if (space.some((k) => !listed.includes(k))) return fail('space-missing');
  }
  if (check.event) {
    const listed = s.listed ?? [], want = check.event;
    if (!listed.length) return fail('event-empty');
    const extra = listed.find((k) => !want.includes(k));
    if (extra !== undefined) return fail(traps.find((t) => t.listed === extra)?.code ?? 'event-extra');
    if (want.some((k) => !listed.includes(k))) return fail('event-missing');
  }
  if (check.scale) {
    const evs = s.events ?? [];
    if (!evs.length || evs.some((e) => !e.placed)) return fail('scale-unplaced');
    const wrong = evs.find((e) => e.placed !== e.truth);
    if (wrong) {
      const trap = traps.find((t) => t.event === wrong.key && (!t.level || t.level === wrong.placed));
      if (trap) return fail(trap.code);
      const lv = s.levels ?? 5;
      return fail(rankOf(wrong.placed!, lv) > rankOf(wrong.truth, lv) ? 'scale-high' : 'scale-low');
    }
  }
  if (check.chosen !== undefined) {
    if (!s.chosen) return fail('choose-empty');
    const ok = ([] as string[]).concat(check.chosen).includes(s.chosen);
    if (!ok) return fail(traps.find((t) => t.chosen === s.chosen)?.code ?? 'choose-wrong');
  }
  if (check.trials && (s.trials ?? 0) < check.trials) return fail('few-trials');
  const e = 1e-9;
  if (check.answer) {
    if (typed === null || !Number.isFinite(typed)) return fail('answer-empty');
    const want = check.answer[0] / check.answer[1];
    if (Math.abs(typed - want) > e) {
      const trap = traps.find((t) => t.value && Math.abs(typed - t.value[0] / t.value[1]) < e);
      return fail(trap?.code ?? (typed > want ? 'too-big' : 'too-small'));
    }
  }
  if (check.estimate) {
    const n = s.trials ?? 0, hits = s.tally?.[check.estimate.outcome] ?? 0;
    if (!n) return fail('few-trials');
    if (typed === null || !Number.isFinite(typed)) return fail('estimate-empty');
    // The count itself typed (e.g. 61 rather than 61/100) is the classic slip.
    if (Math.abs(typed - hits) < e && Math.abs(typed - hits / n) > e) return fail('estimate-count');
    if (Math.abs(typed - hits / n) > (check.estimate.within ?? 0.005) + e) return fail('estimate-far');
  }
  return { ok: true };
}

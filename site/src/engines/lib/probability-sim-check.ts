// Answer checking for <kg-probability-sim> (check type `chance`, docs/STUDIOS.md). Pure, so lib/checks.ts can use it.
import { rankOf, type Frac } from './probability-sim-math';

export interface ChanceCheck {
  type: 'chance';
  /** The probability that the outcome is one of `outcomes` (after the learner edits the bag/spinner): `value` [n, d] or a `level`. */
  prob?: { outcomes: string[]; value?: Frac; level?: string };
  /** The outcomes the learner tapped are exactly the sample space. */
  space?: boolean;
  /** Every event is placed at its right level on the likelihood line. */
  scale?: boolean;
  /** The outcome the learner chose ("which is most likely?"): one key or a list of acceptable keys. */
  chosen?: string | string[];
  /** At least this many trials run (e.g. "spin 10 times to test your guess"). */
  trials?: number;
  /** Known wrong answers with their own feedback code: a chosen outcome, an event placed at a level, or a tapped outcome. */
  traps?: { chosen?: string; event?: string; level?: string; listed?: string; code: string }[];
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

/** Conditions are tested in this order: prob → space → scale → chosen → trials. */
export function checkChance(check: ChanceCheck, s: ChanceState = {}): Result {
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
  return { ok: true };
}

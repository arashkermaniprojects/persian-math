// Answer checking for <kg-place-value> (check type `place-value`, docs/STUDIOS.md). Pure, so lib/checks.ts can use it.
import { normalise } from './place-value-math';

export interface PlaceValueCheck {
  type: 'place-value';
  /** The number the learner must show, e.g. 27 or "3.45" (YAML uses "."). */
  value: number | string;
  /** Every place must hold one digit (0–9): fails with `needs-exchange` while ten or more sit in one place. */
  canonical?: boolean;
  /** Exact counts per place, lowest place first (e.g. [14, 2] for "2 tens and 14 ones"); else `wrong-counts`. */
  counts?: number[];
  /** Known wrong numbers with their own feedback code, e.g. { value: 74, code: reversed } for 47. */
  traps?: { value: number | string; code: string }[];
}

export interface PlaceValueState {
  value?: string;
  counts?: number[];
}

type Result = { ok: boolean; code?: string };

/** a < b → −1, a = b → 0, a > b → 1, for normalised non-negative decimal strings. */
function cmp(a: string, b: string): number {
  const [ai, af = ''] = a.split('.'), [bi, bf = ''] = b.split('.');
  if (ai.length !== bi.length) return ai.length < bi.length ? -1 : 1;
  const w = Math.max(af.length, bf.length);
  const x = ai + af.padEnd(w, '0'), y = bi + bf.padEnd(w, '0');
  return x === y ? 0 : x < y ? -1 : 1;
}

export function checkPlaceValue(check: PlaceValueCheck, state?: PlaceValueState): Result {
  if (state?.value === undefined) return { ok: false, code: 'empty' };
  const got = normalise(state.value), want = normalise(check.value);
  const counts = state.counts ?? [];
  if (got === want) {
    if (check.counts && check.counts.some((c, i) => (counts[i] ?? 0) !== c)) return { ok: false, code: 'wrong-counts' };
    if (check.canonical && counts.some((c) => c > 9)) return { ok: false, code: 'needs-exchange' };
    return { ok: true };
  }
  if (got === '0') return { ok: false, code: 'empty' };
  const trap = check.traps?.find((t) => normalise(t.value) === got);
  if (trap) return { ok: false, code: trap.code };
  return { ok: false, code: cmp(got, want) > 0 ? 'too-big' : 'too-small' };
}

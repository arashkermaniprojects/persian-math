// Answer checking for <kg-fact-fluency> (check type `facts-correct`, docs/STUDIOS.md). Pure, so lib/checks.ts can use it.

export interface FactsCheck {
  type: 'facts-correct';
  /** Facts that must be right on the first try in one round (the best round counts). Default: every fact in the round. */
  min?: number;
}

export interface FactsState {
  total?: number;
  answered?: number;
  correct?: number;
  done?: boolean;
}

type Result = { ok: boolean; code?: string };

/** Fails with `empty` (nothing answered yet), `not-finished` (keep going) or `too-few` (round over: play again). */
export function checkFacts(check: FactsCheck, s: FactsState | undefined): Result {
  if (!s || (!s.answered && !s.done)) return { ok: false, code: 'empty' };
  const want = check.min ?? s.total ?? 0;
  if ((s.correct ?? 0) >= want) return { ok: true };
  return { ok: false, code: s.done ? 'too-few' : 'not-finished' };
}

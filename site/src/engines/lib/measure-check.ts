// Answer checking for <kg-measure> (check type `measure`, docs/STUDIOS.md). Pure, so lib/checks.ts can use it.

export interface MeasureCheck {
  type: 'measure';
  /** The right measurement, in the unit the mission asks for (e.g. 7 cm, 64 mm, 600 g, 65°). */
  value: number;
  /** Accept anything within ± tolerance (estimates, or "to the nearest cm"). Default 0. */
  tolerance?: number;
  /** Also require the tool lined up from zero: ruler 0 at the object's start, protractor baseline on an arm. */
  aligned?: boolean;
  /** Known wrong values with their own feedback code, e.g. { value: 6, code: wrote-cm } for 64 mm. */
  traps?: { value: number; code: string }[];
}

export interface MeasureState {
  tool?: string;
  /** What the learner set with the tool (units laid, weights on the pan, level poured, needle, arm drawn). */
  measured?: number;
  aligned?: boolean;
  /** Values the engine knows a learner would get by a misreading right now, with its code (e.g. not-from-zero). */
  misreads?: [number, string][];
}

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });

/**
 * The value checked is the typed answer if there is one, else the engine's `measured` value.
 * Order: right (and lined up if required) → a misreading or trap → not lined up → too big / too small.
 */
export function checkMeasure(check: MeasureCheck, state: MeasureState | undefined, typed: number | null | undefined): Result {
  const got = typed ?? state?.measured;
  if (got == null || Number.isNaN(got)) return fail('empty');
  const near = (v: number, tol = 0) => Math.abs(got - v) <= tol + 1e-9;
  const lined = !check.aligned || !!state?.aligned;
  if (near(check.value, check.tolerance)) return lined ? { ok: true } : fail('not-aligned');
  const trap = [...(state?.misreads ?? []), ...(check.traps ?? []).map((t) => [t.value, t.code] as [number, string])].find(([v]) => near(v));
  if (trap) return fail(trap[1]);
  if (!lined) return fail('not-aligned');
  return fail(got > check.value ? 'too-big' : 'too-small');
}

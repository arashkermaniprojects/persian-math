// Pure answer checking, shared by the browser runtime and the tests.
import { Frac, isSimplest, writtenValue, type WrittenFrac } from './fraction';

type FracSpec = [number, number];

export type Check =
  | { type: 'shaded-equals'; value: FracSpec; exact?: boolean }
  | { type: 'point-equals'; values: FracSpec[] }
  | { type: 'answer-equals'; value: FracSpec; simplest?: boolean; denominator?: number }
  | { type: 'answer-integer'; value: number }
  | { type: 'choice'; options: string[]; correct: number }
  | { type: 'steps-correct' };

export interface Attempt {
  /** Engine state (shape depends on the engine). */
  state?: {
    bars?: { parts: number; shaded: number }[];
    points?: FracSpec[];
    stepsCorrect?: boolean;
  };
  fraction?: WrittenFrac | null;
  integer?: number | null;
  choice?: number | null;
}

export interface Result {
  ok: boolean;
  /** Reason code for targeted feedback when not ok. */
  code?: string;
}

const pass: Result = { ok: true };
const fail = (code: string): Result => ({ ok: false, code });

/** Compare a value with a target and say whether it is too big or too small. */
function sizeCode(got: Frac, want: Frac): string {
  return got.cmp(want) > 0 ? 'too-big' : 'too-small';
}

export function evaluate(check: Check, a: Attempt): Result {
  switch (check.type) {
    case 'shaded-equals': {
      const bars = a.state?.bars ?? [];
      if (!bars.length) return fail('empty');
      const want = Frac.of(check.value);
      // Several bars of the same size act as one quantity (e.g. 5/4 over two bars).
      const parts = bars[0].parts;
      const shaded = bars.reduce((s, b) => s + b.shaded, 0);
      if (shaded === 0) return fail('empty');
      const got = new Frac(shaded, parts);
      if (!got.equals(want)) return fail(sizeCode(got, want));
      if (check.exact && parts !== check.value[1]) return fail('wrong-denominator');
      return pass;
    }
    case 'point-equals': {
      const pts = a.state?.points ?? [];
      if (pts.length !== check.values.length) return fail('count');
      const wanted = check.values.map((v) => Frac.of(v));
      const got = pts.map((p) => Frac.of(p));
      const allFound = wanted.every((w) => got.some((g) => g.equals(w)));
      if (allFound) return pass;
      if (got.length === 1) return fail(sizeCode(got[0], wanted[0]));
      return fail('wrong');
    }
    case 'answer-equals': {
      const f = a.fraction;
      if (!f) return fail('empty');
      if (f.d === 0) return fail('zero-denominator');
      const got = writtenValue(f);
      const want = Frac.of(check.value);
      if (!got.equals(want)) return fail(sizeCode(got, want));
      if (check.denominator && f.d !== check.denominator) return fail('wrong-denominator');
      if (check.simplest && !isSimplest(f)) return fail('not-simplest');
      return pass;
    }
    case 'answer-integer': {
      if (a.integer == null) return fail('empty');
      if (a.integer === check.value) return pass;
      return fail(a.integer > check.value ? 'too-big' : 'too-small');
    }
    case 'choice': {
      if (a.choice == null) return fail('empty');
      return a.choice === check.correct ? pass : fail('wrong');
    }
    case 'steps-correct':
      return a.state?.stepsCorrect ? pass : fail('wrong');
  }
}

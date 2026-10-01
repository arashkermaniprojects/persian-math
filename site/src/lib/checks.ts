// Pure answer checking, shared by the browser runtime and the tests.
import { Frac, isSimplest, parseDecimal, writtenValue, type WrittenFrac } from './fraction';

type FracSpec = [number, number];

export type Check =
  /** `bar`: check only that bar (by index), e.g. when another bar is a reference to copy. */
  | { type: 'shaded-equals'; value: FracSpec; exact?: boolean; bar?: number }
  | { type: 'point-equals'; values: FracSpec[] }
  /**
   * `traps`: known wrong answers (compared by value) with their own feedback code, e.g. 2/1 for ¾ − ⅓ from
   * subtracting tops and bottoms. `mixed`: the answer must be written as a mixed number (whole part, proper fraction).
   */
  | { type: 'answer-equals'; value: FracSpec; simplest?: boolean; denominator?: number; traps?: { value: FracSpec; code: string }[]; mixed?: boolean }
  | { type: 'answer-integer'; value: number }
  /** value is written with "." in the YAML, e.g. "2.5"; compared exactly. */
  | { type: 'answer-decimal'; value: string }
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
  /** Typed decimal, already parsed exactly (null if unparseable). */
  decimal?: Frac | null;
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
      const all = a.state?.bars ?? [];
      const bars = check.bar === undefined ? all : all.slice(check.bar, check.bar + 1);
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
      const trap = got.equals(want) ? undefined : check.traps?.find((t) => got.equals(Frac.of(t.value)));
      if (trap) return fail(trap.code);
      if (!got.equals(want)) return fail(sizeCode(got, want));
      if (check.mixed && want.n >= want.d && (!f.whole || f.n >= f.d)) return fail('not-mixed');
      if (check.denominator && f.d !== check.denominator) return fail('wrong-denominator');
      if (check.simplest && !isSimplest(f)) return fail('not-simplest');
      return pass;
    }
    case 'answer-integer': {
      if (a.integer == null) return fail('empty');
      if (a.integer === check.value) return pass;
      return fail(a.integer > check.value ? 'too-big' : 'too-small');
    }
    case 'answer-decimal': {
      if (a.decimal == null) return fail('empty');
      const want = parseDecimal(check.value)!;
      return a.decimal.equals(want) ? pass : fail(sizeCode(a.decimal, want));
    }
    case 'choice': {
      if (a.choice == null) return fail('empty');
      return a.choice === check.correct ? pass : fail('wrong');
    }
    case 'steps-correct':
      return a.state?.stepsCorrect ? pass : fail('wrong');
  }
}

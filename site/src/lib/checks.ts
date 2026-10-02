// Pure answer checking, shared by the browser runtime and the tests.
import { Frac, isSimplest, parseDecimal, writtenValue, type WrittenFrac } from './fraction';
import { checkCounters, type CountersCheck } from '../engines/lib/counters-check';
import type { ZoneState } from '../engines/lib/counters-model';
import { checkPlaceValue, type PlaceValueCheck } from '../engines/lib/place-value-check';
import { checkFacts, type FactsCheck } from '../engines/lib/fact-fluency-check';
import { checkCcm, type CcmCheck, type CcmState } from '../engines/lib/clock-calendar-money-check';
import { checkMeasure, type MeasureCheck, type MeasureState } from '../engines/lib/measure-check';
import { checkPattern, type PatternCheck, type PatternState } from '../engines/lib/pattern-machine-check';
import { checkChart, type ChartCheck, type ChartState } from '../engines/lib/chart-builder-check';
import { checkChance, type ChanceCheck, type ChanceState } from '../engines/lib/probability-sim-check';
import { checkShapeBoard, type ShapeBoardCheck, type ShapeBoardState } from '../engines/lib/shape-board-check';
import { checkCanvas, type CanvasCheck } from '../engines/lib/problem-canvas-check';
import type { CanvasState } from '../engines/lib/problem-canvas-model';
import { checkSolid, type SolidCheck, type SolidState } from '../engines/lib/solid-viewer-check';

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
  /** `traps`: known wrong numbers with their own feedback code, e.g. 74 (digits reversed) for 47. */
  | { type: 'answer-integer'; value: number; traps?: { value: number; code: string }[] }
  /** value is written with "." in the YAML, e.g. "2.5"; compared exactly. */
  | { type: 'answer-decimal'; value: string }
  | { type: 'choice'; options: string[]; correct: number }
  | { type: 'steps-correct' }
  /** <kg-counters>: counts, marks, colours, equal groups, arrays, factor trees, picked number (engines/lib/counters-check.ts). */
  | CountersCheck
  /** <kg-place-value>: the number shown equals `value` (engines/lib/place-value-check.ts). */
  | PlaceValueCheck
  /** <kg-fact-fluency>: enough facts right first time in a round (engines/lib/fact-fluency-check.ts). */
  | FactsCheck
  /** <kg-clock-calendar-money>: time-equals, date-equals, money-equals, money-compare (engines/lib/clock-calendar-money-check.ts). */
  | CcmCheck
  /** <kg-measure>: the typed or measured value equals `value` (± tolerance), optionally lined up from zero (engines/lib/measure-check.ts). */
  | MeasureCheck
  /** <kg-pattern-machine>: repeating patterns, typed terms, machine rules, hundred-square shading, order of operations (engines/lib/pattern-machine-check.ts). */
  | PatternCheck
  /** <kg-chart-builder>: tally marks, typed counts, chart values, levelling, tapped category, chosen chart type (engines/lib/chart-builder-check.ts). */
  | ChartCheck
  /** <kg-probability-sim>: bag/spinner edited to a probability, sample space, likelihood line, chosen outcome, trials run (engines/lib/probability-sim-check.ts). */
  | ChanceCheck
  /** <kg-shape-board>: shapes drawn, images, fold/parallel lines, angles, points, taps, cells, pieces, cubes (engines/lib/shape-board-check.ts). */
  | ShapeBoardCheck
  /** <kg-problem-canvas>: known/asked facts, strategy, each tool, then the answer (engines/lib/problem-canvas-check.ts). */
  | CanvasCheck
  /** <kg-solid-viewer>: faces picked, turned, net opened, layers filled, typed volume/area with its unit (engines/lib/solid-viewer-check.ts). */
  | SolidCheck;

export interface Attempt {
  /** Engine state (shape depends on the engine). */
  state?: {
    bars?: { parts: number; shaded: number }[];
    points?: FracSpec[];
    stepsCorrect?: boolean;
    zones?: ZoneState[];
    picked?: number | null;
    /** <kg-place-value>: the number shown (decimal string) and the counts per place, lowest first. */
    value?: string;
    counts?: number[];
    /** <kg-fact-fluency>: facts in the round, answered, right first time (best round), round over. */
    total?: number;
    answered?: number;
    correct?: number;
    done?: boolean;
  } & CcmState & MeasureState & { pattern?: PatternState } & ChartState & { chance?: ChanceState } & { board?: ShapeBoardState } & { solid?: SolidState };
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
      const trap = check.traps?.find((t) => t.value === a.integer);
      if (trap) return fail(trap.code);
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
    case 'counters':
      return checkCounters(check, a.state);
    case 'place-value':
      return checkPlaceValue(check, a.state);
    case 'facts-correct':
      return checkFacts(check, a.state);
    case 'time-equals':
    case 'date-equals':
    case 'money-equals':
    case 'money-compare':
      return checkCcm(check, a.state);
    case 'measure':
      return checkMeasure(check, a.state, a.integer ?? (a.decimal ? a.decimal.valueOf() : null));
    case 'pattern':
      return checkPattern(check, a.state);
    case 'chart':
      return checkChart(check, a.state);
    case 'chance':
      return checkChance(check, a.state?.chance);
    case 'shape-board':
      return checkShapeBoard(check, a.state?.board);
    case 'problem-canvas':
      return checkCanvas(check, a.state as Partial<CanvasState> | undefined, a.integer);
    case 'solid':
      return checkSolid(check, a.state?.solid);
  }
}

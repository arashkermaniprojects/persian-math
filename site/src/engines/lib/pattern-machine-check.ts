// The `pattern` check: compares a <kg-pattern-machine> state with what a mission asks for (docs/STUDIOS.md).
import { apply, opOf, round } from './pattern-machine-expr';
import { compareCode, madeCode, unitCode } from './pattern-machine-repeat';
import { members, setCode, type NumSet } from './pattern-machine-seq';

/** What <kg-pattern-machine> reports, under `state.pattern`. */
export interface PatternState {
  mode: string;
  /** repeat: the item in every slot (null = empty) and the pattern it should be. */
  seq?: (string | null)[];
  target?: string[];
  /** repeat, task unit: how many items the learner marked as the repeating unit. */
  unit?: number | null;
  /** Typed numbers by key (t4 = term 4, step = the jump, r2 = machine row 2) and their right values. */
  answers?: Record<string, number | null>;
  expect?: Record<string, number>;
  /** machine with a hidden rule: the rule the learner set, and the machine's real [input, output] pairs. */
  rule?: [string, number] | null;
  pairs?: [number, number][];
  /** hundred: numbers shaded in each layer, and the square's range. */
  layers?: number[][];
  range?: [number, number];
  /** expr: the expression is worked down to one number, every step in the right order, and its value. */
  finished?: boolean;
  ordered?: boolean;
  result?: number;
}

/**
 * Every field is optional; the check passes when all the given ones hold, tested in this order:
 * complete → make → unit → answers → rule → layers → expr. The first failure gives the reason code.
 */
export interface PatternCheck {
  type: 'pattern';
  /** repeat: every slot holds the pattern's item. Codes: not-finished, wrong-color, wrong-shape, wrong-item. */
  complete?: boolean;
  /** repeat, task make: the learner's row is a repeating pattern whose unit shows at least n times (true = 2). Codes: not-finished, one-kind, no-repeat. */
  make?: boolean | number;
  /** repeat, task unit: the marked unit is the shortest one that repeats. Codes: empty, unit-short, unit-long, unit-repeats. */
  unit?: boolean;
  /** Every typed number is right (true), or only these keys. Codes: empty, a trap's code, wrong-step (key step), too-big, too-small. */
  answers?: boolean | string[];
  /** machine, hide: the rule set by the learner gives every output. Codes: empty, fits-some, wrong-rule. */
  rule?: boolean;
  /** hundred: exactly these numbers shaded in each layer (multiples, factors, set, and). Codes: empty, missing, extra. */
  layers?: NumSet[];
  /** expr: worked to the end in the right order. Codes: not-finished, wrong-order. */
  expr?: boolean;
  /** Known wrong answers with their own code: a typed number (any key, or `key`), or a machine rule. */
  traps?: { key?: string; value?: number; rule?: [string, number]; code: string }[];
}

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });

export function checkPattern(c: PatternCheck, state?: { pattern?: PatternState }): Result {
  const s = state?.pattern;
  if (!s) return fail('empty');
  let code: string | null = null;
  if (c.complete && (code = compareCode(s.seq ?? [], s.target ?? []))) return fail(code);
  if (c.make && (code = madeCode(s.seq ?? [], typeof c.make === 'number' ? c.make : 2))) return fail(code);
  if (c.unit && (code = unitCode(s.unit, s.target ?? []))) return fail(code);
  if (c.answers) {
    const keys = c.answers === true ? Object.keys(s.expect ?? {}) : c.answers;
    const got = s.answers ?? {};
    if (keys.some((k) => got[k] === null || got[k] === undefined)) return fail('empty');
    for (const k of keys) {
      const g = got[k]!, w = s.expect?.[k];
      if (w === undefined || g === w) continue;
      const trap = c.traps?.find((t) => t.value === g && (!t.key || t.key === k));
      if (trap) return fail(trap.code);
      return fail(k === 'step' ? 'wrong-step' : g > w ? 'too-big' : 'too-small');
    }
  }
  if (c.rule) {
    const r = s.rule;
    if (!r) return fail('empty');
    const op = opOf(r[0]);
    const fits = (s.pairs ?? []).filter(([x, y]) => op && round(apply(op, x, r[1])) === y).length;
    if (fits < (s.pairs ?? []).length) {
      const trap = c.traps?.find((t) => t.rule && opOf(t.rule[0]) === op && t.rule[1] === r[1]);
      return fail(trap?.code ?? (fits ? 'fits-some' : 'wrong-rule'));
    }
  }
  if (c.layers) {
    const [from, to] = s.range ?? [1, 100];
    for (let i = 0; i < c.layers.length; i++)
      if ((code = setCode(s.layers?.[i] ?? [], members(c.layers[i], from, to)))) return fail(code);
  }
  if (c.expr) {
    if (!s.finished) return fail('not-finished');
    if (!s.ordered) return fail('wrong-order');
  }
  return { ok: true };
}

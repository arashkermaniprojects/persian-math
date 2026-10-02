// The `problem-canvas` check: compares a <kg-problem-canvas> state with what a mission asks for (docs/STUDIOS.md).
import { firstBreak } from './problem-canvas-pattern';
import { sentenceHolds, type BarState, type CanvasState, type GuessState, type ListState, type SentenceState, type TableState, type ToolState, type Val } from './problem-canvas-model';

type V = number | '?';

/** Bar model. part-whole/groups: `whole`, `parts` (any order unless `anyOrder: false`); compare: `parts` = [row 1, row 2], `d`, `more`. */
export interface BarCheck { whole?: V; parts?: V[]; anyOrder?: boolean; d?: V; more?: 0 | 1 }
/**
 * Table. `cells`: [row, col, value] that must hold; `follow`: column whose filled cells must continue the pattern of
 * its first `given` rows (default 3); `list`: every possibility as a row of `cols` (systematic listing, any row order;
 * `anyOrder` also accepts the numbers inside a row swapped).
 */
export interface TableCheck {
  cells?: [number, number, number][];
  follow?: number;
  given?: number;
  list?: number[][];
  cols?: number[];
  anyOrder?: boolean;
}
/** Guess and check: a guess hit the target (`found`, default true). */
export interface GuessCheck { found?: boolean }
/** Eliminate: exactly the `keep` items are left (by value or label key). */
export interface ListCheck { keep: (number | string)[] }
/** Number sentence: true with □ = `box`, the box used once, every number in `uses` in it; `solve`: the box was also solved. */
export interface SentenceCheck { box: number; uses?: number[]; solve?: boolean }

type Many<T> = T | (T | null)[];

/**
 * Every field is optional; the check passes when all the given ones hold, tested in this order (first failure gives
 * the reason code): known → asked → strategy → bar → table → guess → list → sentence → answer.
 */
export interface CanvasCheck {
  type: 'problem-canvas';
  /** Exactly these facts marked as known (distractors left out). */
  known?: string[];
  /** The question picked. */
  asked?: string;
  /** Accepted strategies (when the mission lets the learner choose). */
  strategy?: string | string[];
  /** One check per tool of that kind, in order (a single object = the first one; null = skip that tool). */
  bar?: Many<BarCheck>;
  table?: Many<TableCheck>;
  guess?: Many<GuessCheck>;
  list?: Many<ListCheck>;
  sentence?: Many<SentenceCheck>;
  /** The final answer, and known wrong answers with their own feedback code (e.g. added instead of subtracted). */
  answer?: number;
  traps?: { value: number; code: string }[];
}

type Result = { ok: true } | { ok: false; code: string };
const pass: Result = { ok: true };
const fail = (code: string): Result => ({ ok: false, code });

const key = (v: Val | undefined) => (v === undefined || v === null ? '' : String(v));
const sameBag = (a: Val[], b: V[]) => a.map(key).sort().join() === b.map(key).sort().join();

export function checkBar(c: BarCheck, s: BarState): Result {
  const slots = [s.whole, s.d, ...s.parts];
  if (slots.every((v) => v === null || v === undefined)) return fail('bar-empty');
  if (c.parts && c.parts.length !== s.parts.length) return fail('bar-count');
  if (s.model === 'compare') {
    if (c.more !== undefined && s.more !== c.more) return fail('bar-more');
    if (c.parts && c.parts.some((v, i) => key(v) !== key(s.parts[i]))) return fail('bar-parts');
    if (c.d !== undefined && key(c.d) !== key(s.d)) return fail('bar-diff');
    return pass;
  }
  if (c.whole !== undefined && key(c.whole) !== key(s.whole)) return fail('bar-whole');
  if (c.parts) {
    const ok = c.anyOrder === false ? c.parts.every((v, i) => key(v) === key(s.parts[i])) : sameBag(s.parts, c.parts);
    if (!ok) return fail('bar-parts');
  }
  return pass;
}

export function checkTable(c: TableCheck, s: TableState): Result {
  const filled = s.rows.filter((r) => r.some((v) => v !== null));
  if (!filled.length) return fail('table-empty');
  for (const [r, col, v] of c.cells ?? []) {
    const got = s.rows[r]?.[col];
    if (got === null || got === undefined) return fail('table-empty');
    if (got !== v) return fail('table-wrong');
  }
  if (c.follow !== undefined && firstBreak(s.rows.map((r) => r[c.follow!] ?? null), c.given ?? 3) >= 0) return fail('table-pattern');
  if (c.list) {
    const cols = c.cols ?? s.cols.map((_, i) => i);
    const norm = (t: number[]) => (c.anyOrder ? [...t].sort((a, b) => a - b) : t).join(',');
    const want = new Set(c.list.map(norm));
    const seen = new Set<string>();
    for (const r of s.rows) {
      const t = cols.map((i) => r[i]);
      if (t.some((v) => v === null || v === undefined)) continue;
      const k = norm(t as number[]);
      if (!want.has(k)) return fail('list-wrong');
      if (seen.has(k)) return fail('list-repeat');
      seen.add(k);
    }
    if (seen.size < want.size) return fail('list-missing');
  }
  return pass;
}

export function checkGuess(c: GuessCheck, s: GuessState): Result {
  if (!s.guesses.length) return fail('no-guess');
  return c.found === false || s.found ? pass : fail('not-found');
}

export function checkList(c: ListCheck, s: ListState): Result {
  const keep = new Set(c.keep.map(String));
  if (s.crossed.some((i) => keep.has(String(s.items[i])))) return fail('crossed-answer');
  const left = s.items.filter((_, i) => !s.crossed.includes(i));
  return left.length > keep.size ? fail('too-many-left') : pass;
}

export function checkSentence(c: SentenceCheck, s: SentenceState): Result {
  if (s.tokens.some((t) => t === null)) return fail('sentence-empty');
  if (s.tokens.filter((t) => t === '?').length !== 1) return fail('sentence-box');
  const nums = s.tokens.filter((t) => t !== null && /\d/.test(t)).map(Number);
  for (const n of c.uses ?? []) {
    const i = nums.indexOf(n);
    if (i < 0) return fail('sentence-numbers');
    nums.splice(i, 1);
  }
  if (!sentenceHolds(s.tokens, c.box)) return fail('sentence-false');
  if (c.solve) {
    if (s.solved === null) return fail('solve-empty');
    if (s.solved !== c.box) return fail('solve-wrong');
  }
  return pass;
}

const many = <T>(m: Many<T> | undefined): (T | null)[] => (m === undefined ? [] : Array.isArray(m) ? m : [m]);

export function checkCanvas(c: CanvasCheck, s: Partial<CanvasState> | undefined, typed?: number | null): Result {
  const known = s?.known ?? [];
  if (c.known) {
    if (c.known.some((k) => !known.includes(k))) return fail('known-missing');
    if (known.some((k) => !c.known!.includes(k))) return fail('known-extra');
  }
  if (c.asked !== undefined) {
    if (!s?.asked) return fail('asked-empty');
    if (s.asked !== c.asked) return fail('asked-wrong');
  }
  if (c.strategy !== undefined) {
    if (!s?.strategy) return fail('strategy-empty');
    if (![c.strategy].flat().includes(s.strategy)) return fail('strategy-wrong');
  }
  const tools = (s?.tools ?? []).filter((t) => t.shown !== false);
  const run = <C, S extends ToolState>(kind: S['kind'], checks: (C | null)[], f: (c: C, s: S) => Result): Result => {
    const of = tools.filter((t) => t.kind === kind) as S[];
    for (let i = 0; i < checks.length; i++) {
      const ci = checks[i];
      if (!ci) continue;
      if (!of[i]) return fail('strategy-wrong');
      const r = f(ci, of[i]);
      if (!r.ok) return r;
    }
    return pass;
  };
  for (const r of [
    () => run('bar', many(c.bar), checkBar),
    () => run('table', many(c.table), checkTable),
    () => run('guess', many(c.guess), checkGuess),
    () => run('list', many(c.list), checkList),
    () => run('sentence', many(c.sentence), checkSentence),
  ]) {
    const res = r();
    if (!res.ok) return res;
  }
  if (c.answer !== undefined) {
    const a = s?.answer ?? typed ?? null;
    if (a === null) return fail('empty');
    if (a === c.answer) return pass;
    const trap = c.traps?.find((t) => t.value === a);
    if (trap) return fail(trap.code);
    return fail(a > c.answer ? 'too-big' : 'too-small');
  }
  return pass;
}

// Pure logic for <kg-fact-fluency>: number facts, mistake diagnosis, spaced repetition and the round queue.
// No DOM, no storage: the engine passes in the learner's memory and today's day number.

export type Op = 'mul' | 'div' | 'add' | 'sub';

/** One fact. mul: a × b (drawn as a rows of b). div: a ÷ b. add: a + b. sub: a − b. */
export interface Fact { a: number; b: number; op: Op }

export const SIGN: Record<Op, string> = { mul: '×', div: '÷', add: '+', sub: '−' };

export function answerOf(f: Fact): number {
  return f.op === 'mul' ? f.a * f.b : f.op === 'div' ? f.a / f.b : f.op === 'add' ? f.a + f.b : f.a - f.b;
}

/** Memory key. Turned-around facts (3 × 4 and 4 × 3, 2 + 5 and 5 + 2) share one memory. */
export function factKey(f: Fact): string {
  const [x, y] = f.op === 'mul' || f.op === 'add' ? [Math.min(f.a, f.b), Math.max(f.a, f.b)] : [f.a, f.b];
  return `${f.op}:${x}:${y}`;
}

export interface PoolOptions {
  op?: Op;
  /** Times tables (or the fixed number in other ops). For × and ÷, tables above upTo are left out, so a list can hold 11 and 12 for en only. */
  tables?: number[];
  /** The other number runs from..upTo. */
  from?: number;
  upTo?: number;
  /** Also ask the turned-around fact (k × t as well as t × k). */
  swap?: boolean;
}

/** Every fact the options allow, without duplicates. */
export function buildPool(o: PoolOptions): Fact[] {
  const op = o.op ?? 'mul';
  const upTo = o.upTo ?? 10;
  const from = o.from ?? 1;
  const tables = (o.tables ?? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).filter((t) => t <= upTo || op === 'add' || op === 'sub');
  const out: Fact[] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number) => {
    const f = { a, b, op };
    const k = `${a}:${b}`;
    if (!seen.has(k)) { seen.add(k); out.push(f); }
  };
  for (const t of tables)
    for (let k = from; k <= upTo; k++) {
      if (op === 'mul' || op === 'add') {
        add(t, k);
        if (o.swap ?? true) add(k, t);
      } else if (op === 'div') {
        if (t !== 0) add(t * k, t);
      } else add(t + k, t);
    }
  return out;
}

/** The facts of one table in order, as said aloud: from × t, (from+1) × t, … upTo × t (k rows of t). */
export function tableFacts(t: number, from = 1, upTo = 10): Fact[] {
  const out: Fact[] = [];
  for (let k = from; k <= upTo; k++) out.push({ a: k, b: t, op: 'mul' });
  return out;
}

/**
 * Why a wrong answer might have been given, as a feedback code:
 * zero (× 0 gave the other number), one (× 1 changed the number), add (added instead of multiplied, or the reverse),
 * near (one group too many or too few), off-one (one too many or too few), or wrong.
 */
export function diagnose(f: Fact, given: number): string {
  const c = answerOf(f);
  if (given === c) return 'right';
  const { a, b } = f;
  if (f.op === 'mul') {
    if ((a === 0 && given === b) || (b === 0 && given === a)) return 'zero';
    if (a === 1 || b === 1) return 'one';
    if (given === a + b) return 'add';
    if (given === c + a || given === c - a || given === c + b || given === c - b) return 'near';
  } else if (f.op === 'div') {
    if (given === a - b) return 'add';
    if (Math.abs(given - c) === 1) return 'near';
  } else if (f.op === 'add' || f.op === 'sub') {
    if (f.op === 'sub' && given === a + b) return 'add';
    if (f.op === 'add' && given === Math.abs(a - b) && a !== b) return 'add';
    if (Math.abs(given - c) === 1) return 'off-one';
  }
  return 'wrong';
}

// ---- spaced repetition (Leitner boxes, measured in days) ----

export interface Memory { box: number; due: number; seen: number; missed: number }
export type Memories = Record<string, Memory>;

/** Days until a fact in each box is asked again. */
export const INTERVALS = [0, 1, 3, 7, 14, 30];

/**
 * Update one fact's memory after it was asked. A miss sends it back to box 0 (due today); a quick right answer moves
 * it up a box; a right but slow answer (the gentle timer ran out) keeps its box and comes back tomorrow.
 */
export function review(m: Memory | undefined, right: boolean, slow: boolean, today: number): Memory {
  const cur = m ?? { box: 0, due: today, seen: 0, missed: 0 };
  const seen = cur.seen + 1;
  if (!right) return { box: 0, due: today, seen, missed: cur.missed + 1 };
  if (slow) return { box: cur.box, due: today + 1, seen, missed: cur.missed };
  const box = Math.min(cur.box + 1, INTERVALS.length - 1);
  return { box, due: today + INTERVALS[box], seen, missed: cur.missed };
}

/** Sort rank: due facts first (lowest box first, most missed first), then new facts, then the rest by due day. */
function rank(m: Memory | undefined, today: number): number {
  if (!m) return 1000;
  if (m.due <= today) return m.box * 100 - Math.min(m.missed, 99);
  return 2000 + (m.due - today) * 10 + m.box;
}

/** Mulberry32: a small seeded random generator, so tests (and replays) are repeatable. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Choose `count` facts for a round: facts that are due (missed ones first) come before new ones, and facts learnt
 * well come last. Only one of a turned-around pair is chosen while others remain. The chosen facts are shuffled.
 */
export function pickRound(pool: Fact[], mem: Memories, count: number, today: number, rand: () => number): Fact[] {
  if (!pool.length) return [];
  const order = shuffle(pool, rand).sort((x, y) => rank(mem[factKey(x)], today) - rank(mem[factKey(y)], today));
  const chosen: Fact[] = [];
  const keys = new Set<string>();
  for (const f of order) if (chosen.length < count && !keys.has(factKey(f))) { keys.add(factKey(f)); chosen.push(f); }
  for (const f of order) if (chosen.length < count && !chosen.includes(f)) chosen.push(f);
  while (chosen.length < count) chosen.push(order[chosen.length % order.length]);
  return shuffle(chosen, rand);
}

/** Up to n different wrong answers that children often give, for multiple choice. */
export function distractors(f: Fact, n: number, rand: () => number): number[] {
  const c = answerOf(f);
  const { a, b } = f;
  const likely = f.op === 'mul' ? [c + b, c - b, c + a, c - a, a + b, c + 1, c - 1, c + 10] : [c + 1, c - 1, c + 2, c - 2, c + 10];
  const out: number[] = [];
  for (const x of shuffle(likely, rand)) if (x >= 0 && x !== c && !out.includes(x) && out.length < n) out.push(x);
  for (let d = 2; out.length < n; d++) if (!out.includes(c + d)) out.push(c + d);
  return out;
}

// ---- one round ----

export interface Slot { fact: Fact; retry: boolean }

/**
 * A round of `facts`. A fact missed on its first try is asked again `gap` questions later (once), so the learner
 * meets it again while it is fresh; gap 0 never asks again (saying a table in order). Only first tries count towards `correct`.
 */
export class Round {
  queue: Slot[];
  pos = 0;
  answered = 0;
  correct = 0;
  missed: Fact[] = [];
  /** The current slot was answered wrongly at least once. */
  wrongNow = false;
  constructor(public facts: Fact[], public gap = 3) {
    this.queue = facts.map((fact) => ({ fact, retry: false }));
  }
  get total() { return this.facts.length; }
  get current(): Slot | undefined { return this.queue[this.pos]; }
  get done() { return this.pos >= this.queue.length; }

  /** Record an answer for the current slot. Returns the diagnosis ('right' when correct). Moves on only when right. */
  answer(given: number): string {
    const s = this.current;
    if (!s) return 'done';
    const code = diagnose(s.fact, given);
    const first = !this.wrongNow;
    if (code === 'right') {
      if (!s.retry) {
        this.answered++;
        if (first) this.correct++;
      }
      if (!first && !s.retry && this.gap > 0) this.queue.splice(Math.min(this.pos + 1 + this.gap, this.queue.length), 0, { fact: s.fact, retry: true });
      this.pos++;
      this.wrongNow = false;
    } else {
      if (first && !s.retry && !this.missed.includes(s.fact)) this.missed.push(s.fact);
      this.wrongNow = true;
    }
    return code;
  }
}

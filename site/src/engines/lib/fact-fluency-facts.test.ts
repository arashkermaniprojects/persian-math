import { describe, expect, it } from 'vitest';
import {
  INTERVALS, Round, answerOf, buildPool, diagnose, distractors, factKey, pickRound, review, rng, shuffle, tableFacts,
  type Fact, type Memories,
} from './fact-fluency-facts';

const mul = (a: number, b: number): Fact => ({ a, b, op: 'mul' });

describe('answerOf and factKey', () => {
  it('answers all four operations', () => {
    expect(answerOf(mul(6, 7))).toBe(42);
    expect(answerOf({ a: 42, b: 7, op: 'div' })).toBe(6);
    expect(answerOf({ a: 8, b: 5, op: 'add' })).toBe(13);
    expect(answerOf({ a: 13, b: 5, op: 'sub' })).toBe(8);
  });
  it('shares one memory between turned-around facts, but not for ÷ and −', () => {
    expect(factKey(mul(3, 4))).toBe(factKey(mul(4, 3)));
    expect(factKey({ a: 2, b: 5, op: 'add' })).toBe(factKey({ a: 5, b: 2, op: 'add' }));
    expect(factKey({ a: 12, b: 3, op: 'div' })).not.toBe(factKey({ a: 12, b: 4, op: 'div' }));
    expect(factKey(mul(3, 4))).not.toBe(factKey({ a: 3, b: 4, op: 'add' }));
  });
});

describe('buildPool', () => {
  it('builds the 2, 5 and 10 tables to 10 with both orders, without duplicates', () => {
    const p = buildPool({ tables: [2, 5, 10] });
    const keys = p.map((f) => `${f.a}×${f.b}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('2×7');
    expect(keys).toContain('7×2');
    expect(keys).toContain('5×10');
    expect(keys).toContain('10×5');
    expect(p.every((f) => f.a <= 10 && f.b <= 10)).toBe(true);
  });
  it('leaves out tables above upTo, so one list serves 10×10 (Iran, Afghanistan) and 12×12 (UK)', () => {
    const ten = buildPool({ tables: [3, 11, 12], upTo: 10 });
    const twelve = buildPool({ tables: [3, 11, 12], upTo: 12 });
    expect(ten.some((f) => f.a > 10 || f.b > 10)).toBe(false);
    expect(twelve.some((f) => f.a === 12 && f.b === 12)).toBe(true);
    expect(twelve.some((f) => f.a === 3 && f.b === 12)).toBe(true);
  });
  it('makes the ×0 and ×1 facts', () => {
    const p = buildPool({ tables: [0, 1], from: 1, upTo: 10 });
    expect(p).toContainEqual(mul(0, 7));
    expect(p).toContainEqual(mul(7, 0));
    expect(p).toContainEqual(mul(1, 1));
    expect(p.length).toBe(39); // 0×k, k×0, 1×k, k×1 for k=1..10, minus the repeated 1×1 (0×1/1×0 appear once each)
  });
  it('can keep the table number first', () => {
    expect(buildPool({ tables: [5], swap: false }).every((f) => f.a === 5)).toBe(true);
  });
  it('builds division facts from the table and never divides by 0', () => {
    const p = buildPool({ op: 'div', tables: [0, 4] });
    expect(p.every((f) => f.b === 4 && f.a % 4 === 0)).toBe(true);
    expect(p).toContainEqual({ a: 28, b: 4, op: 'div' });
  });
  it('builds addition and subtraction facts (number bonds)', () => {
    expect(buildPool({ op: 'add', tables: [10], from: 0, upTo: 10 })).toContainEqual({ a: 10, b: 3, op: 'add' });
    expect(buildPool({ op: 'sub', tables: [7], from: 0, upTo: 3 })).toContainEqual({ a: 9, b: 7, op: 'sub' });
  });
});

describe('tableFacts', () => {
  it('lists a table in order, as in «جدول ضرب زبانی»: 1 × 6, 2 × 6, … 10 × 6', () => {
    const t = tableFacts(6);
    expect(t).toHaveLength(10);
    expect(t[0]).toEqual(mul(1, 6));
    expect(t[9]).toEqual(mul(10, 6));
    expect(tableFacts(5, 1, 12).map(answerOf).at(-1)).toBe(60);
  });
});

describe('diagnose', () => {
  it('spots the common times-table mistakes', () => {
    expect(diagnose(mul(6, 7), 42)).toBe('right');
    expect(diagnose(mul(7, 0), 7)).toBe('zero');
    expect(diagnose(mul(0, 9), 9)).toBe('zero');
    expect(diagnose(mul(1, 8), 9)).toBe('one');
    expect(diagnose(mul(8, 1), 1)).toBe('one');
    expect(diagnose(mul(6, 7), 13)).toBe('add');
    expect(diagnose(mul(6, 7), 48)).toBe('near'); // one 6 too many (6 × 8)
    expect(diagnose(mul(6, 7), 35)).toBe('near'); // one 7 too few (5 × 7)
    expect(diagnose(mul(6, 7), 40)).toBe('wrong');
  });
  it('spots slips in the other operations', () => {
    expect(diagnose({ a: 42, b: 7, op: 'div' }, 7)).toBe('near');
    expect(diagnose({ a: 20, b: 5, op: 'div' }, 15)).toBe('add');
    expect(diagnose({ a: 8, b: 5, op: 'add' }, 12)).toBe('off-one');
    expect(diagnose({ a: 8, b: 5, op: 'add' }, 3)).toBe('add');
    expect(diagnose({ a: 13, b: 5, op: 'sub' }, 18)).toBe('add');
    expect(diagnose({ a: 13, b: 5, op: 'sub' }, 2)).toBe('wrong');
  });
});

describe('review (Leitner boxes)', () => {
  it('moves a quick right answer up a box and spaces it out', () => {
    const m1 = review(undefined, true, false, 100);
    expect(m1).toEqual({ box: 1, due: 100 + INTERVALS[1], seen: 1, missed: 0 });
    const m2 = review(m1, true, false, 101);
    expect(m2.box).toBe(2);
    expect(m2.due).toBe(101 + INTERVALS[2]);
  });
  it('sends a missed fact back to box 0, due today', () => {
    const m = review({ box: 3, due: 90, seen: 5, missed: 0 }, false, false, 100);
    expect(m).toEqual({ box: 0, due: 100, seen: 6, missed: 1 });
  });
  it('keeps a slow right answer in its box and brings it back tomorrow', () => {
    expect(review({ box: 2, due: 100, seen: 2, missed: 0 }, true, true, 100)).toEqual({ box: 2, due: 101, seen: 3, missed: 0 });
  });
  it('stops at the last box', () => {
    let m = review(undefined, true, false, 0);
    for (let i = 0; i < 10; i++) m = review(m, true, false, 0);
    expect(m.box).toBe(INTERVALS.length - 1);
  });
});

describe('pickRound', () => {
  const pool = buildPool({ tables: [2, 5, 10] });
  it('is repeatable with the same seed and gives `count` facts', () => {
    const a = pickRound(pool, {}, 10, 0, rng(7));
    const b = pickRound(pool, {}, 10, 0, rng(7));
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
  });
  it('does not ask both 3 × 4 and 4 × 3 in one round while other facts remain', () => {
    const r = pickRound(pool, {}, 10, 0, rng(1));
    expect(new Set(r.map(factKey)).size).toBe(10);
  });
  it('asks missed (due) facts first, and leaves well-known facts out', () => {
    const mem: Memories = {};
    for (const f of pool) mem[factKey(f)] = { box: 5, due: 50, seen: 5, missed: 0 };
    mem[factKey(mul(5, 7))] = { box: 0, due: 10, seen: 3, missed: 2 };
    mem[factKey(mul(2, 9))] = { box: 0, due: 10, seen: 1, missed: 1 };
    const r = pickRound(pool, mem, 3, 10, rng(3)).map(factKey);
    expect(r).toContain(factKey(mul(5, 7)));
    expect(r).toContain(factKey(mul(2, 9)));
  });
  it('prefers new facts over facts not yet due', () => {
    const small = buildPool({ tables: [2], upTo: 3, swap: false }); // 2×1, 2×2, 2×3
    const mem: Memories = { [factKey(mul(2, 1))]: { box: 3, due: 20, seen: 3, missed: 0 } };
    const r = pickRound(small, mem, 2, 10, rng(5)).map(factKey);
    expect(r).not.toContain(factKey(mul(2, 1)));
  });
  it('repeats facts when the pool is smaller than the round', () => {
    const tiny = [mul(2, 2), mul(3, 3)];
    expect(pickRound(tiny, {}, 5, 0, rng(2))).toHaveLength(5);
    expect(pickRound([], {}, 5, 0, rng(2))).toEqual([]);
  });
});

describe('distractors', () => {
  it('gives n different wrong, non-negative answers', () => {
    for (const f of [mul(6, 7), mul(0, 3), mul(1, 1), { a: 9, b: 3, op: 'div' } as Fact]) {
      const d = distractors(f, 3, rng(4));
      expect(d).toHaveLength(3);
      expect(new Set(d).size).toBe(3);
      expect(d).not.toContain(answerOf(f));
      expect(d.every((x) => x >= 0)).toBe(true);
    }
  });
});

describe('Round', () => {
  it('counts first tries and asks a missed fact again a few questions later', () => {
    const facts = [mul(2, 3), mul(6, 7), mul(5, 5), mul(4, 4), mul(9, 9), mul(3, 3)];
    const r = new Round(facts, 3);
    expect(r.answer(6)).toBe('right');
    expect(r.answer(48)).toBe('near'); // 6 × 7 missed
    expect(r.current!.fact).toEqual(mul(6, 7)); // stays until answered right
    expect(r.answer(42)).toBe('right');
    expect(r.missed).toEqual([mul(6, 7)]);
    expect(r.queue[2 + 3]).toEqual({ fact: mul(6, 7), retry: true });
    for (const f of [mul(5, 5), mul(4, 4), mul(9, 9)]) {
      expect(r.current!.fact).toEqual(f);
      r.answer(answerOf(f));
    }
    expect(r.current).toEqual({ fact: mul(6, 7), retry: true });
    r.answer(42);
    r.answer(9);
    expect(r.done).toBe(true);
    expect(r.total).toBe(6);
    expect(r.answered).toBe(6);
    expect(r.correct).toBe(5);
  });
  it('puts a retry at the end when the round is nearly over', () => {
    const r = new Round([mul(2, 2), mul(3, 3)], 3);
    r.answer(4);
    r.answer(8);
    r.answer(9);
    expect(r.queue).toHaveLength(3);
    expect(r.current!.retry).toBe(true);
    expect(r.answer(12)).toBe('near');
    r.answer(9);
    expect(r.done).toBe(true);
    expect(r.correct).toBe(1);
    expect(r.answer(1)).toBe('done');
  });
});

describe('rng and shuffle', () => {
  it('keeps every item', () => {
    expect(shuffle([1, 2, 3, 4, 5], rng(9)).sort()).toEqual([1, 2, 3, 4, 5]);
    const r = rng(1);
    for (let i = 0; i < 100; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('Round without retries (saying a table in order)', () => {
  it('keeps the order and never repeats a fact', () => {
    const r = new Round(tableFacts(3, 1, 3), 0);
    r.answer(3);
    expect(r.answer(7)).toBe('wrong');
    r.answer(6);
    r.answer(9);
    expect(r.done).toBe(true);
    expect(r.queue).toHaveLength(3);
    expect(r.correct).toBe(2);
    expect(r.missed).toEqual([{ a: 2, b: 3, op: 'mul' }]);
  });
});

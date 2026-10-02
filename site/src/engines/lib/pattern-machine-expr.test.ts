import { describe, expect, it } from 'vitest';
import { applyAt, evaluate, letterOf, ready, rightNext, runRule, show, showRule, tokenize, undoRule, type Tok } from './pattern-machine-expr';

const ev = (s: string, vars?: Record<string, number>) => evaluate(tokenize(s), vars);

describe('tokenize', () => {
  it('reads numbers, operators in every spelling, brackets and letters', () => {
    expect(show(tokenize('3+4*2'))).toBe('3 + 4 × 2');
    expect(show(tokenize('12 / 3 - 1'))).toBe('12 ÷ 3 − 1');
    expect(show(tokenize('(6−2)×5'))).toBe('(6 − 2) × 5');
    expect(show(tokenize('2^3'))).toBe('2 ^ 3');
  });
  it('reads Persian digits', () => {
    expect(ev('۱۲ + ۳')).toBe(15);
  });
  it('treats a leading minus or a minus after an operator as part of the number', () => {
    expect(ev('-3 + 5')).toBe(2);
    expect(ev('4 × -2')).toBe(-8);
    expect(ev('(-2) × 3')).toBe(-6);
  });
  it('reads 2n and 3(n + 1) as multiplication', () => {
    expect(show(tokenize('2n+3'))).toBe('2 × n + 3');
    expect(ev('3(n+1)', { n: 4 })).toBe(15);
  });
  it('rejects junk', () => {
    expect(() => tokenize('3 $ 4')).toThrow();
  });
});

describe('evaluate', () => {
  it('uses priority: brackets, powers, × ÷, + −, left to right', () => {
    expect(ev('3 + 4 × 2')).toBe(11);
    expect(ev('(3 + 4) × 2')).toBe(14);
    expect(ev('20 − 6 − 4')).toBe(10);
    expect(ev('24 ÷ 4 ÷ 2')).toBe(3);
    expect(ev('2 + 3^2 × 2')).toBe(20);
    expect(ev('2^3^2')).toBe(512);
    expect(ev('10 − 2 × (1 + 3)')).toBe(2);
  });
  it('substitutes letters and complains about missing ones', () => {
    expect(ev('2 × n + 3', { n: 5 })).toBe(13);
    expect(() => ev('a + 1')).toThrow();
  });
  it('rejects a malformed expression', () => {
    expect(() => ev('3 +')).toThrow();
  });
});

describe('machine rules', () => {
  it('runs a string rule in its own letter, or stages in order', () => {
    expect(letterOf('4*s')).toBe('s');
    expect(letterOf('7')).toBe('n');
    expect(runRule('4*s', 3)).toBe(12);
    expect(runRule([['×', 2], ['+', 3]], 4)).toBe(11);
    expect(runRule([['+', 3], ['×', 2]], 4)).toBe(14);
    expect(runRule([['-', 4]], 9)).toBe(5);
  });
  it('avoids floating-point dust', () => {
    expect(runRule([['+', 0.1]], 0.2)).toBe(0.3);
  });
  it('undoes stages to find the input', () => {
    expect(undoRule([['+', 7]], 17)).toBe(10);
    expect(undoRule([['×', 2], ['+', 3]], 11)).toBe(4);
    expect(undoRule([['^', 2]], 49)).toBe(7);
    expect(undoRule('2n+1', 7)).toBeNull();
  });
  it('shows a rule', () => {
    expect(showRule([['+', 5]])).toBe('+5');
    expect(showRule([['*', 2], ['-', 1]])).toBe('×2 −1');
    expect(showRule('2*n+3')).toBe('2 × n + 3');
  });
});

describe('step by step', () => {
  const t = (s: string) => tokenize(s);
  const opAt = (toks: Tok[], i: number) => (toks[i] as { v: string }).v;
  it('says which operators can be done and which the rules say to do first', () => {
    const e = t('3 + 4 × 2');
    expect(ready(e)).toEqual([1, 3]);
    expect(rightNext(e).map((i) => opAt(e, i))).toEqual(['×']);
    const f = t('20 − 6 − 4');
    expect(rightNext(f)).toEqual([1]);
    const g = t('2 × (3 + 4)');
    expect(ready(g)).toEqual([4]);
    expect(rightNext(g)).toEqual([4]);
  });
  it('lets either of two separate brackets go first', () => {
    const e = t('(1 + 2) × (3 + 4)');
    expect(rightNext(e).sort()).toEqual([2, 8]);
  });
  it('does powers before × and, in a chain of powers, the right one first', () => {
    const e = t('2 × 3 ^ 2');
    expect(rightNext(e)).toEqual([3]);
    expect(rightNext(t('2 ^ 3 ^ 2'))).toEqual([3]);
  });
  it('applies one step and drops brackets around a single number', () => {
    let e = t('2 × (3 + 4)');
    e = applyAt(e, 4);
    expect(show(e)).toBe('2 × 7');
    e = applyAt(e, 1);
    expect(show(e)).toBe('14');
    expect(show(applyAt(t('((1 + 2))'), 3))).toBe('3');
  });
  it('lets a wrong order happen (the learner sees a different answer)', () => {
    const e = applyAt(t('3 + 4 × 2'), 1);
    expect(show(e)).toBe('7 × 2');
  });
  it('ignores an operator that cannot be done yet', () => {
    const e = t('2 × (3 + 4)');
    expect(applyAt(e, 1)).toBe(e);
  });
});

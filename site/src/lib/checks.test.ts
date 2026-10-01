import { describe, expect, it } from 'vitest';
import { evaluate } from './checks';
import { Frac } from './fraction';

describe('evaluate', () => {
  it('shaded-equals accepts equivalent shading unless exact', () => {
    const check = { type: 'shaded-equals', value: [3, 4] } as const;
    expect(evaluate(check, { state: { bars: [{ parts: 8, shaded: 6 }] } })).toEqual({ ok: true });
    expect(evaluate({ ...check, exact: true }, { state: { bars: [{ parts: 8, shaded: 6 }] } }).code).toBe('wrong-denominator');
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 2 }] } }).code).toBe('too-small');
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 0 }] } }).code).toBe('empty');
  });

  it('shaded-equals treats several bars as one quantity', () => {
    const check = { type: 'shaded-equals', value: [5, 4] } as const;
    const state = { bars: [{ parts: 4, shaded: 4 }, { parts: 4, shaded: 1 }] };
    expect(evaluate(check, { state }).ok).toBe(true);
  });

  it('shaded-equals can check a single bar and ignore a reference bar', () => {
    const check = { type: 'shaded-equals', value: [1, 2], bar: 1 } as const;
    const state = { bars: [{ parts: 4, shaded: 2 }, { parts: 8, shaded: 4 }] };
    expect(evaluate(check, { state }).ok).toBe(true);
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 2 }, { parts: 8, shaded: 2 }] } }).code).toBe('too-small');
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 2 }, { parts: 8, shaded: 0 }] } }).code).toBe('empty');
    expect(evaluate({ type: 'shaded-equals', value: [2, 6], exact: true, bar: 1 }, { state: { bars: [{ parts: 3, shaded: 1 }, { parts: 9, shaded: 3 }] } }).code).toBe('wrong-denominator');
    expect(evaluate({ ...check, bar: 5 }, { state }).code).toBe('empty');
  });

  it('answer-equals checks value, denominator and simplest form', () => {
    const check = { type: 'answer-equals', value: [1, 2], simplest: true } as const;
    expect(evaluate(check, { fraction: { n: 1, d: 2 } }).ok).toBe(true);
    expect(evaluate(check, { fraction: { n: 2, d: 4 } }).code).toBe('not-simplest');
    expect(evaluate(check, { fraction: { n: 2, d: 3 } }).code).toBe('too-big');
    expect(evaluate(check, { fraction: { n: 1, d: 0 } }).code).toBe('zero-denominator');
    expect(evaluate({ type: 'answer-equals', value: [3, 4], denominator: 8 }, { fraction: { n: 3, d: 4 } }).code).toBe('wrong-denominator');
  });

  it('point-equals needs every target point', () => {
    const check = { type: 'point-equals', values: [[1, 3], [2, 3]] } as const;
    expect(evaluate(check, { state: { points: [[2, 3], [1, 3]] } }).ok).toBe(true);
    expect(evaluate(check, { state: { points: [[1, 3]] } }).code).toBe('count');
    expect(evaluate({ type: 'point-equals', values: [[1, 2]] }, { state: { points: [[3, 4]] } }).code).toBe('too-big');
  });

  it('answer-decimal compares exactly', () => {
    const check = { type: 'answer-decimal', value: '0.3' } as const;
    expect(evaluate(check, { decimal: new Frac(3, 10) }).ok).toBe(true);
    expect(evaluate(check, { decimal: new Frac(1, 3) }).code).toBe('too-big');
    expect(evaluate(check, { decimal: null }).code).toBe('empty');
  });

  it('choice and integer answers', () => {
    expect(evaluate({ type: 'choice', options: ['a', 'b'], correct: 1 }, { choice: 1 }).ok).toBe(true);
    expect(evaluate({ type: 'answer-integer', value: 12 }, { integer: 9 }).code).toBe('too-small');
  });

  it('answer-equals gives a trap code for a known wrong answer and can require a mixed number', () => {
    const sub = { type: 'answer-equals', value: [5, 12], traps: [{ value: [2, 1], code: 'tops-and-bottoms' }] } as const;
    expect(evaluate(sub, { fraction: { n: 2, d: 1 } }).code).toBe('tops-and-bottoms');
    expect(evaluate(sub, { fraction: { n: 4, d: 2 } }).code).toBe('tops-and-bottoms');
    expect(evaluate(sub, { fraction: { n: 1, d: 2 } }).code).toBe('too-big');
    expect(evaluate(sub, { fraction: { n: 5, d: 12 } }).ok).toBe(true);
    const mixed = { type: 'answer-equals', value: [9, 4], mixed: true } as const;
    expect(evaluate(mixed, { fraction: { whole: 2, n: 1, d: 4 } }).ok).toBe(true);
    expect(evaluate(mixed, { fraction: { n: 9, d: 4 } }).code).toBe('not-mixed');
    expect(evaluate(mixed, { fraction: { whole: 1, n: 5, d: 4 } }).code).toBe('not-mixed');
    expect(evaluate(mixed, { fraction: { whole: 1, n: 1, d: 4 } }).code).toBe('too-small');
  });

  it('answer-integer gives a trap code for a known wrong number', () => {
    const c = { type: 'answer-integer', value: 47, traps: [{ value: 74, code: 'reversed' }] } as const;
    expect(evaluate(c, { integer: 74 }).code).toBe('reversed');
    expect(evaluate(c, { integer: 48 }).code).toBe('too-big');
    expect(evaluate(c, { integer: 47 }).ok).toBe(true);
  });

  it('place-value checks the number shown and whether it is exchanged', () => {
    const c = { type: 'place-value', value: 14, canonical: true } as const;
    expect(evaluate(c, { state: { value: '14', counts: [14, 0] } }).code).toBe('needs-exchange');
    expect(evaluate(c, { state: { value: '14', counts: [4, 1] } }).ok).toBe(true);
    expect(evaluate(c, { state: { value: '41', counts: [1, 4] } }).code).toBe('too-big');
  });
});

describe('facts-correct (<kg-fact-fluency>)', () => {
  it('passes when enough facts are right first time, else says keep going or play again', () => {
    const c = { type: 'facts-correct' as const, min: 8 };
    expect(evaluate(c, { state: {} }).code).toBe('empty');
    expect(evaluate(c, { state: { total: 10, answered: 4, correct: 4, done: false } }).code).toBe('not-finished');
    expect(evaluate(c, { state: { total: 10, answered: 10, correct: 6, done: true } }).code).toBe('too-few');
    expect(evaluate(c, { state: { total: 10, answered: 9, correct: 8, done: false } }).ok).toBe(true);
  });
});

describe('measure (<kg-measure>)', () => {
  it('checks the typed (integer or decimal) or measured value, and lining up from zero', () => {
    const c = { type: 'measure' as const, value: 7, aligned: true };
    expect(evaluate(c, { state: { tool: 'ruler', aligned: true }, integer: 7 }).ok).toBe(true);
    expect(evaluate(c, { state: { tool: 'ruler', aligned: false, misreads: [[5, 'not-from-zero']] }, integer: 5 }).code).toBe('not-from-zero');
    expect(evaluate({ type: 'measure', value: 6.4 }, { state: { tool: 'ruler' }, decimal: new Frac(32, 5) }).ok).toBe(true);
    expect(evaluate({ type: 'measure', value: 600 }, { state: { tool: 'balance', measured: 500 }, integer: null }).code).toBe('too-small');
  });
});

import { describe, expect, it } from 'vitest';
import { evaluate } from './checks';

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

  it('choice and integer answers', () => {
    expect(evaluate({ type: 'choice', options: ['a', 'b'], correct: 1 }, { choice: 1 }).ok).toBe(true);
    expect(evaluate({ type: 'answer-integer', value: 12 }, { integer: 9 }).code).toBe('too-small');
  });
});

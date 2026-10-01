import { describe, expect, it } from 'vitest';
import { checkFacts } from './fact-fluency-check';

describe('facts-correct', () => {
  it('is empty before the first answer', () => {
    expect(checkFacts({ type: 'facts-correct', min: 8 }, undefined)).toEqual({ ok: false, code: 'empty' });
    expect(checkFacts({ type: 'facts-correct', min: 8 }, { total: 10, answered: 0, correct: 0, done: false }).code).toBe('empty');
  });
  it('passes as soon as enough facts are right first time', () => {
    expect(checkFacts({ type: 'facts-correct', min: 8 }, { total: 10, answered: 8, correct: 8, done: false }).ok).toBe(true);
    expect(checkFacts({ type: 'facts-correct', min: 8 }, { total: 10, answered: 10, correct: 9, done: true }).ok).toBe(true);
  });
  it('says keep going during a round, and play again after one', () => {
    expect(checkFacts({ type: 'facts-correct', min: 8 }, { total: 10, answered: 5, correct: 5, done: false }).code).toBe('not-finished');
    expect(checkFacts({ type: 'facts-correct', min: 8 }, { total: 10, answered: 10, correct: 7, done: true }).code).toBe('too-few');
  });
  it('needs every fact when min is left out', () => {
    expect(checkFacts({ type: 'facts-correct' }, { total: 10, answered: 10, correct: 9, done: true }).code).toBe('too-few');
    expect(checkFacts({ type: 'facts-correct' }, { total: 10, answered: 10, correct: 10, done: true }).ok).toBe(true);
  });
});

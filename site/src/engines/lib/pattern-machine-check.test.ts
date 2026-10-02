import { describe, expect, it } from 'vitest';
import { checkPattern, type PatternCheck, type PatternState } from './pattern-machine-check';

const run = (c: Omit<PatternCheck, 'type'>, s: Partial<PatternState>) => checkPattern({ type: 'pattern', ...c }, { pattern: { mode: 'x', ...s } });
const code = (c: Omit<PatternCheck, 'type'>, s: Partial<PatternState>) => run(c, s).code ?? 'ok';

describe('pattern check', () => {
  it('fails with empty when there is no state', () => {
    expect(checkPattern({ type: 'pattern', complete: true }, undefined)).toEqual({ ok: false, code: 'empty' });
  });

  it('complete: compares the row with the pattern', () => {
    const target = ['red-circle', 'blue-square', 'red-circle', 'blue-square'];
    expect(code({ complete: true }, { seq: [...target], target })).toBe('ok');
    expect(code({ complete: true }, { seq: ['red-circle', 'blue-square', null, null], target })).toBe('not-finished');
    expect(code({ complete: true }, { seq: ['red-circle', 'blue-square', 'blue-circle', 'blue-square'], target })).toBe('wrong-color');
  });

  it('make: a repeating pattern of the learner’s own', () => {
    expect(code({ make: true }, { seq: ['a', 'b', 'a', 'b'] })).toBe('ok');
    expect(code({ make: 3 }, { seq: ['a', 'b', 'a', 'b'] })).toBe('no-repeat');
  });

  it('unit: the shortest unit', () => {
    const target = ['a', 'b', 'b', 'a', 'b', 'b', 'a'];
    expect(code({ unit: true }, { unit: 3, target })).toBe('ok');
    expect(code({ unit: true }, { unit: 6, target })).toBe('unit-repeats');
    expect(code({ unit: true }, { unit: null, target })).toBe('empty');
  });

  it('answers: empty, traps, wrong step, too big / too small', () => {
    const expect_ = { t4: 13, t10: 31, step: 3 };
    const ans = (a: Record<string, number | null>) => ({ answers: a, expect: expect_ });
    expect(code({ answers: true }, ans({ t4: 13, t10: 31, step: 3 }))).toBe('ok');
    expect(code({ answers: true }, ans({ t4: 13, t10: null, step: 3 }))).toBe('empty');
    expect(code({ answers: true, traps: [{ key: 't10', value: 40, code: 'four-each' }] }, ans({ t4: 13, t10: 40, step: 3 }))).toBe('four-each');
    expect(code({ answers: true, traps: [{ key: 't4', value: 40, code: 'four-each' }] }, ans({ t4: 13, t10: 40, step: 3 }))).toBe('too-big');
    expect(code({ answers: true }, ans({ t4: 13, t10: 31, step: 4 }))).toBe('wrong-step');
    expect(code({ answers: true }, ans({ t4: 12, t10: 31, step: 3 }))).toBe('too-small');
    // Only some keys
    expect(code({ answers: ['t4'] }, ans({ t4: 13, t10: null, step: null }))).toBe('ok');
  });

  it('rule: any rule that gives every output; fits-some for a rule that works only sometimes', () => {
    const pairs: [number, number][] = [[2, 4], [3, 6], [5, 10]];
    expect(code({ rule: true }, { rule: ['×', 2], pairs })).toBe('ok');
    expect(code({ rule: true }, { rule: ['*', 2], pairs })).toBe('ok');
    expect(code({ rule: true }, { rule: ['+', 2], pairs })).toBe('fits-some');
    expect(code({ rule: true }, { rule: ['−', 1], pairs })).toBe('wrong-rule');
    expect(code({ rule: true, traps: [{ rule: ['+', 2], code: 'added' }] }, { rule: ['+', 2], pairs })).toBe('added');
    expect(code({ rule: true }, { rule: null, pairs })).toBe('empty');
  });

  it('layers: shading on the hundred square', () => {
    const range: [number, number] = [1, 30];
    const m3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
    expect(code({ layers: [{ multiples: 3 }] }, { layers: [m3, []], range })).toBe('ok');
    expect(code({ layers: [{ multiples: 3 }] }, { layers: [m3.slice(0, 5), []], range })).toBe('missing');
    expect(code({ layers: [{ multiples: 3 }] }, { layers: [[...m3, 10], []], range })).toBe('extra');
    expect(code({ layers: [{ multiples: 4 }, { multiples: 6 }] }, { layers: [[4, 8, 12, 16, 20, 24, 28], [6, 12, 18, 24, 30]], range })).toBe('ok');
    expect(code({ layers: [{ multiples: 4 }, { multiples: 6 }] }, { layers: [[4, 8, 12, 16, 20, 24, 28], []], range })).toBe('empty');
  });

  it('expr: finished, then in the right order', () => {
    expect(code({ expr: true }, { finished: true, ordered: true, result: 11 })).toBe('ok');
    expect(code({ expr: true }, { finished: false, ordered: true })).toBe('not-finished');
    expect(code({ expr: true }, { finished: true, ordered: false, result: 14 })).toBe('wrong-order');
  });
});

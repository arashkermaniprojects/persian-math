import { describe, expect, it } from 'vitest';
import { checkMeasure } from './measure-check';
import { angleReading, rulerReading } from './measure-math';

describe('checkMeasure', () => {
  it('compares a typed answer with the value', () => {
    const check = { type: 'measure', value: 7 } as const;
    expect(checkMeasure(check, { tool: 'ruler' }, 7)).toEqual({ ok: true });
    expect(checkMeasure(check, { tool: 'ruler' }, 8).code).toBe('too-big');
    expect(checkMeasure(check, { tool: 'ruler' }, 6).code).toBe('too-small');
  });

  it('is empty when nothing is typed and the engine measured nothing', () => {
    expect(checkMeasure({ type: 'measure', value: 7 }, { tool: 'ruler' }, null).code).toBe('empty');
    expect(checkMeasure({ type: 'measure', value: 7 }, undefined, undefined).code).toBe('empty');
    expect(checkMeasure({ type: 'measure', value: 7 }, { tool: 'ruler' }, NaN).code).toBe('empty');
  });

  it('uses the engine value when nothing is typed (balance, jug, drawn angle)', () => {
    const check = { type: 'measure', value: 600 } as const;
    expect(checkMeasure(check, { tool: 'balance', measured: 600 }, null).ok).toBe(true);
    expect(checkMeasure(check, { tool: 'balance', measured: 700 }, null).code).toBe('too-big');
    expect(checkMeasure(check, { tool: 'jug', measured: 0 }, null).code).toBe('too-small');
  });

  it('accepts estimates within the tolerance', () => {
    const check = { type: 'measure', value: 7, tolerance: 2 } as const;
    expect(checkMeasure(check, {}, 5).ok).toBe(true);
    expect(checkMeasure(check, {}, 9).ok).toBe(true);
    expect(checkMeasure(check, {}, 10).code).toBe('too-big');
  });

  it('needs the ruler from zero when aligned is set, and names reading the end as not-from-zero', () => {
    const check = { type: 'measure', value: 7, aligned: true } as const;
    expect(checkMeasure(check, { tool: 'ruler', ...rulerReading(0, 7) }, 7).ok).toBe(true);
    const off = { tool: 'ruler', ...rulerReading(-2, 7) };
    expect(checkMeasure(check, off, 5).code).toBe('not-from-zero');
    expect(checkMeasure(check, off, 7).code).toBe('not-aligned'); // right number, but the ruler is not at zero
    expect(checkMeasure(check, off, 3).code).toBe('not-aligned');
    // without `aligned`, the right number passes wherever the ruler is
    expect(checkMeasure({ type: 'measure', value: 7 }, off, 7).ok).toBe(true);
  });

  it('gives traps their own code', () => {
    const check = { type: 'measure', value: 64, traps: [{ value: 6, code: 'wrote-cm' }, { value: 60, code: 'nearest-cm' }] } as const;
    expect(checkMeasure(check, {}, 6).code).toBe('wrote-cm');
    expect(checkMeasure(check, {}, 60).code).toBe('nearest-cm');
    expect(checkMeasure(check, {}, 63).code).toBe('too-small');
  });

  it('names the wrong protractor scale, and readings with the protractor not lined up', () => {
    const check = { type: 'measure', value: 65, aligned: true } as const;
    expect(checkMeasure(check, angleReading(20, [20, 85]), 65).ok).toBe(true);
    expect(checkMeasure(check, angleReading(20, [20, 85]), 115).code).toBe('other-scale');
    expect(checkMeasure(check, angleReading(0, [20, 85]), 85).code).toBe('not-from-zero');
    expect(checkMeasure(check, angleReading(0, [20, 85]), 65).code).toBe('not-aligned');
  });
});

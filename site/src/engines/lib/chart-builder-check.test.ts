import { describe, expect, it } from 'vitest';
import { checkChart } from './chart-builder-check';

const ok = { ok: true };

describe('checkChart: tally', () => {
  const check = { type: 'chart', tally: [6, 3, 4, 2] } as const;
  it('passes when every row has the right marks', () => {
    expect(checkChart(check, { tally: [6, 3, 4, 2], left: 0 })).toEqual(ok);
  });
  it('explains what went wrong', () => {
    expect(checkChart(check, { tally: [0, 0, 0, 0] }).code).toBe('empty');
    expect(checkChart(check, {}).code).toBe('empty');
    expect(checkChart(check, { tally: [5, 3, 4, 2], left: 1 }).code).toBe('cards-left');
    expect(checkChart(check, { tally: [5, 3, 4, 2], left: 0 }).code).toBe('tally-few');
    expect(checkChart(check, { tally: [7, 3, 4, 2] }).code).toBe('tally-many');
    expect(checkChart(check, { tally: [5, 4, 4, 2], left: 0 }).code).toBe('tally-wrong');
  });
});

describe('checkChart: typed counts', () => {
  const check = { type: 'chart', typed: [7, 5, 9, 4] } as const;
  it('passes with the right numbers', () => {
    expect(checkChart(check, { typed: [7, 5, 9, 4] })).toEqual(ok);
  });
  it('spots blanks and a group of five read as four', () => {
    expect(checkChart(check, { typed: [null, null, null, null] }).code).toBe('empty');
    expect(checkChart(check, { typed: [7, 5, null, 4] }).code).toBe('count-empty');
    expect(checkChart(check, { typed: [6, 5, 9, 4] }).code).toBe('gate-as-four');
    expect(checkChart(check, { typed: [7, 4, 9, 4] }).code).toBe('gate-as-four');
    expect(checkChart(check, { typed: [7, 5, 9, 3] }).code).toBe('count-wrong');
    expect(checkChart(check, { typed: [8, 5, 9, 4] }).code).toBe('count-wrong');
  });
});

describe('checkChart: chart values', () => {
  const check = { type: 'chart', values: [6, 3, 4, 2] } as const;
  it('passes when the chart shows the data', () => {
    expect(checkChart(check, { values: [6, 3, 4, 2], unit: 2 })).toEqual(ok);
  });
  it('knows one symbol per item ignores the key', () => {
    expect(checkChart(check, { values: [12, 6, 8, 4], unit: 2 }).code).toBe('key-ignored');
    // with a key of 1 that is simply right
    expect(checkChart(check, { values: [6, 3, 4, 2], unit: 1 })).toEqual(ok);
  });
  it('asks for a half symbol when an odd count was rounded', () => {
    expect(checkChart(check, { values: [6, 2, 4, 2], unit: 2 }).code).toBe('half-needed');
    expect(checkChart(check, { values: [6, 4, 4, 2], unit: 2 }).code).toBe('half-needed');
    // off by one on an even count is not about halves
    expect(checkChart(check, { values: [7, 3, 4, 2], unit: 2 }).code).toBe('too-high');
  });
  it('says too high or too low otherwise', () => {
    expect(checkChart(check, { values: [0, 0, 0, 0] }).code).toBe('empty');
    expect(checkChart(check, { values: [6, 3, 1, 2] }).code).toBe('too-low');
    expect(checkChart(check, { values: [6, 9, 4, 2] }).code).toBe('too-high');
  });
  it('accepts a line graph that starts above zero', () => {
    expect(checkChart({ type: 'chart', values: [102, 105, 107] }, { values: [102, 105, 107] })).toEqual(ok);
  });
});

describe('checkChart: levelling, pick, choose', () => {
  it('needs equal bars and an empty hand', () => {
    const check = { type: 'chart', level: true } as const;
    expect(checkChart(check, { values: [4, 4, 4], pool: 0 })).toEqual(ok);
    expect(checkChart(check, { values: [4, 4, 2], pool: 2 }).code).toBe('pool-left');
    expect(checkChart(check, { values: [3, 5, 4], pool: 0 }).code).toBe('not-level');
  });
  it('checks the tapped category, with traps', () => {
    const check = { type: 'chart', pick: 'apple', traps: [{ pick: 'grapes', code: 'least' }] } as const;
    expect(checkChart(check, { cat: 'apple' })).toEqual(ok);
    expect(checkChart(check, { cat: null }).code).toBe('empty');
    expect(checkChart(check, { cat: 'grapes' }).code).toBe('least');
    expect(checkChart(check, { cat: 'banana' }).code).toBe('wrong-pick');
    expect(checkChart({ type: 'chart', pick: ['a', 'b'] }, { cat: 'b' })).toEqual(ok);
  });
  it('checks the chosen chart type, with traps', () => {
    const check = { type: 'chart', chosen: 'line', traps: [{ chosen: 'pie', code: 'pie-not-time' }] } as const;
    expect(checkChart(check, { chart: 'line' })).toEqual(ok);
    expect(checkChart(check, { chart: null }).code).toBe('empty');
    expect(checkChart(check, { chart: 'pie' }).code).toBe('pie-not-time');
    expect(checkChart(check, { chart: 'bar' }).code).toBe('wrong-chart');
    expect(checkChart({ type: 'chart', chosen: ['bar', 'pictogram'] }, { chart: 'pictogram' })).toEqual(ok);
  });
  it('checks parts in order: tally before typed before values', () => {
    const check = { type: 'chart', tally: [2], typed: [2], values: [2] } as const;
    expect(checkChart(check, { tally: [1], typed: [9], values: [9] }).code).toBe('tally-few');
    expect(checkChart(check, { tally: [2], typed: [9], values: [9] }).code).toBe('count-wrong');
    expect(checkChart(check, { tally: [2], typed: [2], values: [9] }).code).toBe('too-high');
    expect(checkChart(check, { tally: [2], typed: [2], values: [2] })).toEqual(ok);
  });
});

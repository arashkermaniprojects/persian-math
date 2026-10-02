import { describe, expect, it } from 'vitest';
import { computeRow, partWidths, sentenceHolds, shortShare, tryGuess } from './problem-canvas-model';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('partWidths', () => {
  it('splits equally while nothing is known', () => {
    expect(partWidths(null, [null, null])).toEqual([0.5, 0.5]);
    expect(partWidths('?', ['?', null, null])).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(partWidths(null, [])).toEqual([]);
  });
  it('draws parts in proportion, the unknown taking what the whole leaves', () => {
    const w = partWidths(23, [12, '?']);
    expect(w[0]).toBeCloseTo(12 / 23);
    expect(w[1]).toBeCloseTo(11 / 23);
    expect(sum(partWidths(9, [5, 4]))).toBeCloseTo(1);
  });
  it('gives an unknown part the average when the whole is unknown or too small', () => {
    const w = partWidths('?', [6, '?']);
    expect(w[0]).toBeCloseTo(0.5);
    const v = partWidths(5, [12, '?']); // whole smaller than a part: still a sensible picture
    expect(v[1]).toBeCloseTo(0.5);
  });
  it('keeps a tiny part visible', () => {
    const w = partWidths(100, [99, 1]);
    expect(w[1]).toBeGreaterThan(0.05);
    expect(sum(w)).toBeCloseTo(1);
  });
});

describe('shortShare', () => {
  it('uses whatever two of the three numbers are known', () => {
    expect(shortShare(14, 8, null)).toBeCloseTo(8 / 14);
    expect(shortShare(14, '?', 6)).toBeCloseTo(8 / 14);
    expect(shortShare('?', 8, 6)).toBeCloseTo(8 / 14);
  });
  it('falls back to a default and stays inside sensible bounds', () => {
    expect(shortShare(null, null, null)).toBe(0.6);
    expect(shortShare(10, 10, null)).toBe(0.9);
    expect(shortShare(10, 0, null)).toBe(0.1);
  });
});

describe('tryGuess', () => {
  it('compares the guess with the target when there are no columns (Iran G2 p.80: □ + 17 = 51)', () => {
    expect(tryGuess(40, [{ key: 'sum', expr: 'x + 17' }], 51)).toEqual({ x: 40, v: [57], cmp: 1 });
    expect(tryGuess(30, [{ key: 'sum', expr: 'x + 17' }], 51).cmp).toBe(-1);
    expect(tryGuess(34, [{ key: 'sum', expr: 'x + 17' }], 51).cmp).toBe(0);
    expect(tryGuess(5, [], 5).cmp).toBe(0);
  });
  it('works out columns that use earlier columns, and compares the one named', () => {
    // 10 heads, 28 legs: x rabbits, the rest hens
    const cols = [{ key: 'hens', expr: '10 - x' }, { key: 'legs', expr: '4*x + 2*hens' }];
    expect(tryGuess(3, cols, 28)).toEqual({ x: 3, v: [7, 26], cmp: -1 });
    expect(tryGuess(4, cols, 28).cmp).toBe(0);
    expect(tryGuess(4, cols, 7, 'hens').cmp).toBe(-1);
  });
  it('gives no verdict without a target or a value', () => {
    expect(tryGuess(3, [{ key: 'a', expr: 'x * 2' }]).cmp).toBeNull();
    expect(tryGuess(0, [{ key: 'a', expr: '6 / x' }], 3)).toEqual({ x: 0, v: [null], cmp: null });
  });
});

describe('computeRow', () => {
  const cols = [{ key: 'a' }, { key: 'b' }, { key: 's', expr: 'a + b' }, { key: 'p', expr: 'a * b' }];
  it('fills computed columns from typed ones', () => {
    expect(computeRow([1, 24, null, null], cols)).toEqual([1, 24, 25, 24]);
    expect(computeRow([2, 12, 99, 99], cols)).toEqual([2, 12, 14, 24]);
  });
  it('leaves a computed cell empty until its inputs are typed', () => {
    expect(computeRow([3, null, null, null], cols)).toEqual([3, null, null, null]);
  });
});

describe('sentenceHolds', () => {
  it('accepts any true sentence for the story (G2 «روش نمادین»)', () => {
    expect(sentenceHolds(['23', '-', '12', '=', '?'], 11)).toBe(true);
    expect(sentenceHolds(['12', '+', '?', '=', '23'], 11)).toBe(true);
    expect(sentenceHolds(['?', '+', '12', '=', '23'], 11)).toBe(true);
    expect(sentenceHolds(['23', '+', '12', '=', '?'], 11)).toBe(false);
  });
  it('handles × and ÷, two operations and a box on the left', () => {
    expect(sentenceHolds(['?', '×', '4', '=', '20'], 5)).toBe(true);
    expect(sentenceHolds(['20', '÷', '4', '=', '?'], 5)).toBe(true);
    expect(sentenceHolds(['3', '×', '5', '+', '2', '=', '?'], 17)).toBe(true);
  });
  it('is false while a slot is empty or there is no "="', () => {
    expect(sentenceHolds(['23', '-', null, '=', '?'], 11)).toBe(false);
    expect(sentenceHolds(['23', '-', '12'], 11)).toBe(false);
  });
});

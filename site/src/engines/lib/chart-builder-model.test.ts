import { describe, expect, it } from 'vitest';
import {
  lerp, level, mean, modes, niceStep, paintedValues, paintFrom, pictoStep, polar, sectorPath, slices, snapTo, symbols, tallyGroups, ticks, twoLines,
} from './chart-builder-model';

describe('tallyGroups', () => {
  it('bundles marks in fives', () => {
    expect(tallyGroups(0)).toEqual({ fives: 0, rest: 0 });
    expect(tallyGroups(4)).toEqual({ fives: 0, rest: 4 });
    expect(tallyGroups(5)).toEqual({ fives: 1, rest: 0 });
    expect(tallyGroups(13)).toEqual({ fives: 2, rest: 3 });
    expect(tallyGroups(-2)).toEqual({ fives: 0, rest: 0 });
  });
});

describe('scales', () => {
  it('picks 1, 2, 5, 10, 20 … steps', () => {
    expect(niceStep(8)).toBe(1);
    expect(niceStep(10)).toBe(1);
    expect(niceStep(16)).toBe(2);
    expect(niceStep(40)).toBe(5);
    expect(niceStep(100)).toBe(10);
    expect(niceStep(180)).toBe(20);
    expect(niceStep(0)).toBe(1);
    expect(niceStep(30, 6)).toBe(5);
  });
  it('lists ticks and snaps values', () => {
    expect(ticks(0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(ticks(100, 112, 4)).toEqual([100, 104, 108, 112]);
    expect(ticks(0, 1, 0.1)).toHaveLength(11);
    expect(snapTo(4.4, 1, 0, 10)).toBe(4);
    expect(snapTo(4.6, 0.5, 0, 10)).toBe(4.5);
    expect(snapTo(13, 1, 0, 10)).toBe(10);
    expect(snapTo(-1, 1, 0, 10)).toBe(0);
    expect(lerp(5, 0, 10, 200, 0)).toBe(100);
    expect(lerp(3, 2, 2, 7, 9)).toBe(7);
  });
});

describe('pictogram symbols', () => {
  it('draws whole symbols and one part symbol', () => {
    expect(symbols(6, 2, 2)).toEqual([1, 1, 1]);
    expect(symbols(5, 2, 2)).toEqual([1, 1, 0.5]);
    expect(symbols(7, 4, 4)).toEqual([1, 0.75]);
    expect(symbols(3, 1)).toEqual([1, 1, 1]);
    expect(symbols(0, 2)).toEqual([]);
    expect(symbols(1, 2, 2)).toEqual([0.5]);
  });
  it('rounds to the nearest part when the value cannot be drawn exactly', () => {
    expect(symbols(31, 10, 1)).toEqual([1, 1, 1]); // Iranian G2: 31 ≈ 30, three faces
    expect(symbols(7, 4, 2)).toEqual([1, 1]); // 1.75 rounds to 2 halves
  });
  it('gives the smallest step', () => {
    expect(pictoStep(2, 2)).toBe(1);
    expect(pictoStep(10, 2)).toBe(5);
    expect(pictoStep(4, 0)).toBe(4);
  });
});

describe('pie', () => {
  it('starts at 12 o’clock and goes clockwise in category order', () => {
    expect(slices([20, 20, 30, 10])).toEqual([
      { i: 0, a0: 0, a1: 90 },
      { i: 1, a0: 90, a1: 180 },
      { i: 2, a0: 180, a1: 315 },
      { i: 3, a0: 315, a1: 360 },
    ]);
    expect(slices([0, 5])).toEqual([{ i: 1, a0: 0, a1: 360 }]);
    expect(slices([0, 0])).toEqual([]);
  });
  it('places points clockwise from the top', () => {
    const [x, y] = polar(100, 100, 50, 90);
    expect(x).toBeCloseTo(150);
    expect(y).toBeCloseTo(100);
    expect(polar(100, 100, 50, 0)[1]).toBeCloseTo(50);
  });
  it('draws sectors and full circles', () => {
    expect(sectorPath(50, 50, 40, 0, 90)).toBe('M50 50L50 10A40 40 0 0 1 90 50Z');
    expect(sectorPath(50, 50, 40, 0, 270)).toContain('0 1 1');
    expect(sectorPath(50, 50, 40, 0, 360)).toMatch(/^M50 10A40 40 0 1 1/);
  });
  it('turns painted sectors into values and back', () => {
    expect(paintedValues([0, 0, 1, -1, 2, 0], 3, 5)).toEqual([15, 5, 5]);
    expect(paintFrom([10, 20, 5], 8, 5)).toEqual([0, 0, 1, 1, 1, 1, 2, -1]);
    expect(paintFrom([30, 30], 4, 10)).toEqual([0, 0, 0, 1]);
  });
});

describe('levelling and averages', () => {
  it('moves units through the hand and never makes new ones', () => {
    let s = level([2, 6, 4], 0, 1, 4);
    expect(s).toEqual({ values: [2, 4, 4], pool: 2 });
    s = level(s.values, s.pool, 0, 9);
    expect(s).toEqual({ values: [4, 4, 4], pool: 0 });
    expect(level([4, 4], 0, 0, 7)).toEqual({ values: [4, 4], pool: 0 });
    expect(level([4, 4], 0, 0, -3)).toEqual({ values: [0, 4], pool: 4 });
  });
  it('computes the mean and the mode', () => {
    expect(mean([2, 6, 4])).toBe(4);
    expect(mean([])).toBe(0);
    expect(modes([3, 7, 2, 7])).toEqual([1, 3]);
    expect(modes([0, 0])).toEqual([]);
  });
});

describe('twoLines', () => {
  it('splits long labels near the middle', () => {
    expect(twoLines('شنبه')).toEqual(['شنبه']);
    expect(twoLines('پنج شنبه', 5)).toEqual(['پنج', 'شنبه']);
    expect(twoLines('Wednesday')).toEqual(['Wednesday']);
    expect(twoLines('ice cream van', 6)).toEqual(['ice cream', 'van']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  clipLine, compile, equationParts, gridValues, labelEvery, lineThrough, onLine, parseTyped, sample, snapTo, step, toFrac,
  valueAt, xIntercept, yAt,
} from './coord-plane-math';

describe('snapTo', () => {
  it('snaps to the nearest multiple of the step, inside the plane', () => {
    expect(snapTo(2.4, 1, -5, 5)).toBe(2);
    expect(snapTo(2.6, 1, -5, 5)).toBe(3);
    expect(snapTo(-2.6, 1, -5, 5)).toBe(-3);
    expect(snapTo(7, 1, -5, 5)).toBe(5);
    expect(snapTo(3.1, 2, -2, 10)).toBe(4);
    expect(snapTo(0.74, 0.5, 0, 3)).toBe(0.5);
  });
  it('stays on the step grid even when the plane edge is not a multiple', () => {
    expect(snapTo(-5, 2, -5, 5)).toBe(-4);
    expect(snapTo(5, 2, -5, 5)).toBe(4);
  });
});

describe('axis labels', () => {
  it('thins labels out when squares are small', () => {
    expect(labelEvery(30, 26)).toBe(1);
    expect(labelEvery(20, 26)).toBe(2);
    expect(labelEvery(4, 26)).toBe(10);
  });
  it('lists grid values with the scale', () => {
    expect(gridValues(-2, 2, 1)).toEqual([-2, -1, 0, 1, 2]);
    expect(gridValues(-2, 10, 2)).toEqual([-2, 0, 2, 4, 6, 8, 10]);
    expect(gridValues(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
});

describe('fractions and lines', () => {
  it('turns grid gradients into exact fractions', () => {
    expect(toFrac(2 / 3)).toEqual([2, 3]);
    expect(toFrac(-1.5)).toEqual([-3, 2]);
    expect(toFrac(4)).toEqual([4, 1]);
    expect(toFrac(0)).toEqual([0, 1]);
  });
  it('finds the line through two points', () => {
    const l = lineThrough([0, 1], [3, 3])!;
    expect(toFrac(l.m!)).toEqual([2, 3]);
    expect(l.c).toBe(1);
    expect(lineThrough([1, -2], [4, 4])).toEqual({ m: 2, c: -4 });
    expect(lineThrough([3, -1], [3, 4])).toEqual({ m: null, c: null, x: 3 });
    expect(lineThrough([1, 1], [1, 1])).toBeNull();
    expect(lineThrough([-2, 3], [4, 3])).toEqual({ m: 0, c: 3 });
  });
  it('evaluates, tests points and finds the x-intercept', () => {
    const l = { m: -2, c: 4 };
    expect(yAt(l, 1)).toBe(2);
    expect(onLine(l, [2, 0])).toBe(true);
    expect(onLine(l, [0, 2])).toBe(false);
    expect(xIntercept(l)).toBe(2);
    expect(xIntercept({ m: 0, c: 3 })).toBeNull();
    expect(onLine({ m: null, c: null, x: 3 }, [3, -7])).toBe(true);
  });
  it('gives the signed run and rise', () => {
    expect(step([0, 1], [3, 3])).toEqual([3, 2]);
    expect(step([1, 4], [3, 0])).toEqual([2, -4]);
  });
  it('clips a line to the plane', () => {
    expect(clipLine({ m: 1, c: 0 }, -5, 5, -5, 5)).toEqual([[-5, -5], [5, 5]]);
    const [a, b] = clipLine({ m: -2, c: 4 }, -5, 5, -6, 6)!;
    expect(a).toEqual([-1, 6]);
    expect(b).toEqual([5, -6]);
    expect(clipLine({ m: 0, c: 9 }, -5, 5, -5, 5)).toBeNull();
    expect(clipLine({ m: null, c: null, x: 2 }, -5, 5, -4, 4)).toEqual([[2, -4], [2, 4]]);
  });
});

describe('equationParts', () => {
  it('writes y = mx + c the way books do', () => {
    expect(equationParts({ m: 2, c: 1 })).toEqual({ lhs: 'y = ', m: '2', rest: 'x + 1' });
    expect(equationParts({ m: -2, c: 4 })).toEqual({ lhs: 'y = ', m: '−2', rest: 'x + 4' });
    expect(equationParts({ m: 1, c: -3 })).toEqual({ lhs: 'y = ', m: '', rest: 'x − 3' });
    expect(equationParts({ m: -1, c: 0 })).toEqual({ lhs: 'y = ', m: '−', rest: 'x' });
    expect(equationParts({ m: 2 / 3, c: 1 }).m).toEqual([2, 3]);
    expect(equationParts({ m: -0.5, c: 0 }).m).toEqual([-1, 2]);
  });
  it('writes horizontal and vertical lines', () => {
    expect(equationParts({ m: 0, c: 3 })).toEqual({ lhs: 'y = ', m: null, rest: '3' });
    expect(equationParts({ m: 0, c: -2 })).toEqual({ lhs: 'y = ', m: null, rest: '−2' });
    expect(equationParts({ m: null, c: null, x: 3 })).toEqual({ lhs: 'x = ', m: null, rest: '3' });
  });
});

describe('parseTyped', () => {
  it('reads Persian and Latin digits, both minus signs and the locale mark', () => {
    expect(parseTyped('۴')).toBe(4);
    expect(parseTyped('-۲')).toBe(-2);
    expect(parseTyped('−12')).toBe(-12);
    expect(parseTyped('۲/۵', '/')).toBe(2.5);
    expect(parseTyped('۲,۵', ',')).toBe(2.5);
    expect(parseTyped(' 3 ')).toBe(3);
    expect(parseTyped('')).toBeNull();
    expect(parseTyped('x')).toBeNull();
    expect(parseTyped('--2')).toBeNull();
  });
});

describe('graphs', () => {
  it('evaluates expressions in x with parameters (shared with pattern-machine)', () => {
    const t = compile('a*x^2 + k');
    expect(valueAt(t, 3, { a: 2, k: -1 })).toBe(17);
    expect(valueAt(compile('2x - 1'), -2)).toBe(-5);
    expect(valueAt(compile('1/x'), 0)).toBeNaN();
  });
  it('samples a curve and breaks it where it leaves the plane', () => {
    const parts = sample(compile('x'), -2, 2, -2, 2, 4);
    expect(parts).toEqual([[[-2, -2], [-1, -1], [0, 0], [1, 1], [2, 2]]]);
    const hyper = sample(compile('1/x'), -2, 2, -2, 2, 40);
    expect(hyper.length).toBe(2);
    expect(hyper[0].every(([x]) => x < 0)).toBe(true);
    expect(hyper[1].every(([x]) => x > 0)).toBe(true);
  });
});

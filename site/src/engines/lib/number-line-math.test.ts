import { describe, expect, it } from 'vitest';
import { clamp, decimalString, labelStep, snap, tickKind, tickX, toTick, windowOf } from './number-line-math';

describe('toTick', () => {
  it('places fractions on the tick grid', () => {
    expect(toTick([3, 4], 4)).toBe(3);
    expect(toTick([3, 4], 8)).toBe(6);
    expect(toTick([5, 4], 4)).toBe(5);
    expect(toTick([125, 100], 100)).toBe(125);
    expect(toTick([5, 4], 100)).toBe(125);
  });
  it('rounds numbers that fall between ticks to the nearest one', () => {
    expect(toTick([1, 3], 4)).toBe(1);
    expect(toTick([2, 3], 4)).toBe(3);
  });
});

describe('windowOf', () => {
  it('covers min..max without zoom', () => {
    expect(windowOf(0, 2, 4)).toEqual([0, 8]);
    expect(windowOf(-1, 1, 10)).toEqual([-10, 10]);
  });
  it('narrows to the zoom window, inside min..max', () => {
    expect(windowOf(0, 2, 100, { from: [12, 10], to: [13, 10] })).toEqual([120, 130]);
    expect(windowOf(0, 1, 100, { from: [-1, 1], to: [3, 1] })).toEqual([0, 100]);
  });
});

describe('snap', () => {
  // 0..1 in quarters drawn from x=20 to x=420: ticks every 100px.
  const s = (x: number) => snap(x, 0, 4, 20, 420);
  it('snaps to the nearest tick', () => {
    expect(s(20)).toBe(0);
    expect(s(69)).toBe(0);
    expect(s(71)).toBe(1);
    expect(s(330)).toBe(3);
  });
  it('clamps outside the line', () => {
    expect(s(-50)).toBe(0);
    expect(s(999)).toBe(4);
  });
  it('works on a zoomed window', () => {
    // 1.20..1.30 in hundredths from 0 to 100px: 10px per tick.
    expect(snap(52, 120, 130, 0, 100)).toBe(125);
  });
  it('is the inverse of tickX', () => {
    for (let i = 0; i <= 8; i++) expect(snap(tickX(i, 0, 8, 24, 300), 0, 8, 24, 300)).toBe(i);
  });
  it('increases left to right', () => {
    expect(tickX(1, 0, 4, 20, 420)).toBeLessThan(tickX(2, 0, 4, 20, 420));
  });
});

describe('decimalString', () => {
  it('writes exact decimals with "."', () => {
    expect(decimalString(3, 10)).toBe('0.3');
    expect(decimalString(125, 100)).toBe('1.25');
    expect(decimalString(120, 100)).toBe('1.2');
    expect(decimalString(45, 100)).toBe('0.45');
    expect(decimalString(4, 2)).toBe('2');
    expect(decimalString(1, 8)).toBe('0.125');
    expect(decimalString(-3, 10)).toBe('-0.3');
    expect(decimalString(0, 10)).toBe('0');
  });
  it('returns null when there is no finite decimal', () => {
    expect(decimalString(1, 3)).toBeNull();
  });
});

describe('tickKind and labelStep', () => {
  it('marks whole, half/tenth and other ticks', () => {
    expect(tickKind(0, 4)).toBe('whole');
    expect(tickKind(8, 4)).toBe('whole');
    expect(tickKind(2, 4)).toBe('mid');
    expect(tickKind(1, 4)).toBe('minor');
    expect(tickKind(130, 100)).toBe('mid');
    expect(tickKind(125, 100)).toBe('minor');
    expect(tickKind(123, 100)).toBe('minor');
  });
  it('labels every tick when there is room, fewer when crowded', () => {
    expect(labelStep(40, 30, 4)).toBe(1);
    expect(labelStep(20, 30, 4)).toBe(2);
    expect(labelStep(14, 36, 100)).toBe(5);
    expect(labelStep(14, 20, 100)).toBe(2);
    expect(labelStep(14, 60, 100)).toBe(5);
    expect(labelStep(14, 80, 100)).toBe(10);
    expect(labelStep(10, 40, 3)).toBe(4); // no divisor of 3 fits: next nice step
  });
  it('clamps', () => {
    expect(clamp(5, 0, 4)).toBe(4);
    expect(clamp(-1, 0, 4)).toBe(0);
  });
});

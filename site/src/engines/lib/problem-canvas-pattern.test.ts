import { describe, expect, it } from 'vitest';
import { extend, findPattern, firstBreak, hops } from './problem-canvas-pattern';

describe('hops', () => {
  it('gives the difference between neighbours, null across gaps', () => {
    expect(hops([1, 4, 7, 10])).toEqual([3, 3, 3]);
    expect(hops([120, 240, null, 480])).toEqual([120, null, null]);
    expect(hops([5, 3])).toEqual([-2]);
    expect(hops([5])).toEqual([]);
  });
});

describe('findPattern', () => {
  it('finds adding the same number (Iran G4 p.3: 120, 240, 360)', () => {
    expect(findPattern([120, 240, 360])).toEqual({ kind: 'add', step: 120 });
    expect(findPattern([10, 7, 4])).toEqual({ kind: 'add', step: -3 });
  });
  it('finds multiplying by the same number (G7: 1, 2, 4, 8)', () => {
    expect(findPattern([1, 2, 4, 8])).toEqual({ kind: 'mul', factor: 2 });
  });
  it('finds hops that grow by the same amount (G4 p.2 triangle dots 1, 3, 6, 10)', () => {
    expect(findPattern([1, 3, 6, 10])).toEqual({ kind: 'grow', step: 1, hop: 4 });
    expect(findPattern([1, 4, 9, 16])).toEqual({ kind: 'grow', step: 2, hop: 7 });
  });
  it('prefers add over the others and needs three values', () => {
    expect(findPattern([2, 2, 2])).toEqual({ kind: 'add', step: 0 });
    expect(findPattern([2, 4])).toBeNull();
    expect(findPattern([1, 3, 6])).toBeNull(); // a growing hop needs 4 values to be sure
    expect(findPattern([1, 5, 2, 9])).toBeNull();
  });
  it('handles zeros without dividing by them', () => {
    expect(findPattern([0, 0, 1, 5])).toBeNull();
    expect(findPattern([0, 3, 6])).toEqual({ kind: 'add', step: 3 });
  });
});

describe('extend', () => {
  it('continues each kind of pattern', () => {
    expect(extend([120, 240, 360], { kind: 'add', step: 120 }, 2)).toEqual([480, 600]);
    expect(extend([1, 2, 4], { kind: 'mul', factor: 2 }, 3)).toEqual([8, 16, 32]);
    expect(extend([1, 3, 6, 10], { kind: 'grow', step: 1, hop: 4 }, 3)).toEqual([15, 21, 28]);
    expect(extend([0.1, 0.2, 0.3], { kind: 'add', step: 0.1 }, 1)).toEqual([0.4]);
  });
});

describe('firstBreak', () => {
  it('accepts filled cells that continue the given values, even with gaps', () => {
    expect(firstBreak([1, 3, 6, 10, 15, 21, 28], 4)).toBe(-1);
    expect(firstBreak([1, 3, 6, 10, null, 21, null], 4)).toBe(-1);
  });
  it('points at the first cell that breaks the pattern', () => {
    expect(firstBreak([1, 3, 6, 10, 14, 18], 4)).toBe(4); // kept adding 4
    expect(firstBreak([120, 240, 360, 480, 500], 3)).toBe(4);
  });
  it('cannot judge without a pattern in the given values', () => {
    expect(firstBreak([1, 5, 2, 9, 4], 3)).toBe(-1);
    expect(firstBreak([1, null, 3, 4], 3)).toBe(-1);
  });
});

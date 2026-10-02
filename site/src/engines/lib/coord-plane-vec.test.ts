import { describe, expect, it } from 'vitest';
import { checkCoord, type CoordCheck, type CoordState } from './coord-plane-check';
import { checkArrows, checkPick, checkShift, slip, vecOf, wanted, type Arrow } from './coord-plane-vec';
import type { P } from './coord-plane-math';

const A = (from: P, to: P): Arrow => ({ from, to });
const run = (check: Omit<CoordCheck, 'type'>, plane: CoordState) => checkCoord({ type: 'coord', ...check }, { plane });
const code = (check: Omit<CoordCheck, 'type'>, plane: CoordState) => run(check, plane).code;

describe('vectors: arithmetic', () => {
  it('reads an arrow as head − tail', () => {
    expect(vecOf(A([-3, -2], [2, 1]))).toEqual([5, 3]);
    expect(vecOf(A([1, 1], [1, -3]))).toEqual([0, -4]);
  });
  it('works out equal, opposite, sum, multiple and fixed ends', () => {
    expect(wanted({ v: [4, -3] })).toEqual([4, -3]);
    expect(wanted({ equal: [3, 2] })).toEqual([3, 2]);
    expect(wanted({ opposite: [3, 2] })).toEqual([-3, -2]);
    expect(wanted({ sum: [[3, 1], [1, 2]] })).toEqual([4, 3]);
    expect(wanted({ multiple: { of: [2, -4], k: [-1, 2] } })).toEqual([-1, 2]);
    expect(wanted({ from: [1, 1], to: [3, 0] })).toEqual([2, -1]);
    expect(wanted({ from: [1, 1] })).toBeNull();
  });
});

describe('vectors: slips', () => {
  it('names the classic slips', () => {
    expect(slip([4, -3], [-4, 3])).toBe('tail-head');
    expect(slip([4, -3], [-3, 4])).toBe('components-swapped');
    expect(slip([4, -3], [4, 3])).toBe('sign');
    expect(slip([4, -3], [-4, -3])).toBe('sign');
    expect(slip([4, -3], [4, 1])).toBe('one-component');
    expect(slip([4, -3], [1, 1])).toBeNull();
    expect(slip([4, -3], [4, -3])).toBeNull();
  });
  it('does not call [y, x] swapped when x = y, nor flip a zero component', () => {
    expect(slip([2, 2], [2, 2])).toBeNull();
    expect(slip([0, 3], [0, -3])).toBe('tail-head');
    expect(slip([0, 3], [3, 0])).toBe('components-swapped');
  });
  it('knows the opposite drawn the same way, tails joined in a sum, and 2a doubling only x', () => {
    expect(slip([-3, -2], [3, 2], { opposite: [3, 2] })).toBe('same-direction');
    expect(slip([4, 3], [-2, 1], { sum: [[3, 1], [1, 2]] })).toBe('tails-joined');
    expect(slip([4, 3], [2, -1], { sum: [[3, 1], [1, 2]] })).toBe('tails-joined');
    expect(slip([4, 2], [4, 1], { multiple: { of: [2, 1], k: 2 } })).toBe('one-component');
    expect(slip([-1, 2], [1, -2], { multiple: { of: [2, -4], k: -0.5 } })).toBe('sign');
  });
});

describe('vectors: arrows', () => {
  it('passes the right arrows in any order and position when only the vector is fixed', () => {
    expect(checkArrows([{ v: [4, -3] }], [A([-4, 2], [0, -1])])).toBeNull();
    expect(checkArrows([{ v: [1, 0] }, { v: [0, 1] }], [A([0, 0], [0, 1]), A([3, 3], [4, 3])])).toBeNull();
  });
  it('says empty, too few and too many', () => {
    expect(checkArrows([{ v: [1, 0] }], [])?.code).toBe('empty');
    expect(checkArrows([{ v: [1, 0] }, { v: [0, 1] }], [A([0, 0], [1, 0])])?.code).toBe('too-few');
    expect(checkArrows([{ v: [1, 0] }], [A([0, 0], [1, 0]), A([0, 0], [0, 1])])?.code).toBe('too-many');
  });
  it('catches the arrow drawn head to tail, from fixed ends or as a vector', () => {
    expect(checkArrows([{ from: [-3, -2], to: [2, 1] }], [A([2, 1], [-3, -2])])?.code).toBe('tail-head');
    expect(checkArrows([{ v: [4, -3] }], [A([0, 0], [-4, 3])])?.code).toBe('tail-head');
  });
  it('catches the right vector at the wrong tail or head', () => {
    expect(checkArrows([{ v: [3, 2], from: [1, -2] }], [A([0, 0], [3, 2])])?.code).toBe('wrong-tail');
    expect(checkArrows([{ v: [3, 2], to: [4, 0] }], [A([0, 0], [3, 2])])?.code).toBe('wrong-head');
    expect(checkArrows([{ v: [3, 2], from: [1, -2] }], [A([1, -2], [4, 0])])).toBeNull();
  });
  it('falls back to wrong-vector', () => {
    expect(checkArrows([{ v: [4, -3] }], [A([0, 0], [1, 1])])?.code).toBe('wrong-vector');
  });
});

describe('vectors: pick', () => {
  const choices = [A([-4, 1], [-1, 3]), A([1, -2], [4, 0]), A([2, 3], [-1, 1]), A([0, -4], [2, -1]), A([-4, -3], [2, 1]), A([-3, -1], [0, -3])];
  // [3, 2], [3, 2], [−3, −2], [2, 3], [6, 4], [3, −2]
  it('passes exactly the equal ones, wherever they are', () => {
    expect(checkPick({ equal: [3, 2] }, choices, [0, 1])).toBeNull();
    expect(checkPick({ opposite: [3, 2] }, choices, [2])).toBeNull();
  });
  it('names the wrong pick and the missed one', () => {
    expect(checkPick({ equal: [3, 2] }, choices, [])?.code).toBe('pick-empty');
    expect(checkPick({ equal: [3, 2] }, choices, [0, 2])?.code).toBe('tail-head');
    expect(checkPick({ equal: [3, 2] }, choices, [3])?.code).toBe('components-swapped');
    expect(checkPick({ equal: [3, 2] }, choices, [4])?.code).toBe('length');
    expect(checkPick({ equal: [3, 2] }, choices, [5])?.code).toBe('direction');
    expect(checkPick({ equal: [3, 2] }, choices, [0])?.code).toBe('missed');
    expect(checkPick({ opposite: [3, 2] }, choices, [0])?.code).toBe('same-direction');
  });
});

describe('vectors: shift', () => {
  it('passes the shift and names the slips', () => {
    expect(checkShift([4, -3], [4, -3])).toBeNull();
    expect(checkShift([4, -3], null)?.code).toBe('not-moved');
    expect(checkShift([4, -3], [0, 0])?.code).toBe('not-moved');
    expect(checkShift([4, -3], [-3, 4])?.code).toBe('components-swapped');
    expect(checkShift([4, -3], [-4, 3])?.code).toBe('tail-head');
    expect(checkShift([4, -3], [4, 3])?.code).toBe('sign');
    expect(checkShift([4, -3], [1, 1])?.code).toBe('wrong-shift');
  });
});

describe('coord check with the vector parts', () => {
  it('routes vectors, pick and shift through checkCoord, after the core parts', () => {
    expect(run({ vectors: [{ v: [4, -3] }] }, { vectors: [A([0, 0], [4, -3])] }).ok).toBe(true);
    expect(code({ vectors: [{ v: [4, -3] }] }, {})).toBe('empty');
    expect(code({ pick: { equal: [1, 0] } }, { choices: [A([0, 0], [1, 0])], picked: [] })).toBe('pick-empty');
    expect(code({ shift: [2, 0] }, { shift: [0, 2] })).toBe('components-swapped');
    expect(code({ points: [[1, 1]], vectors: [{ v: [1, 0] }] }, { vectors: [A([0, 0], [1, 0])] })).toBe('empty');
  });
  it('tries arrow and shift traps first', () => {
    const t = { vectors: [{ v: [1, 2], from: [3, 1] as P }], traps: [{ arrow: { from: [0, 0] as P }, code: 'tails-joined' }] };
    expect(code(t, { vectors: [A([0, 0], [1, 2])] })).toBe('tails-joined');
    expect(code(t, { vectors: [A([1, 1], [2, 3])] })).toBe('wrong-tail');
    expect(code({ shift: [4, -3], traps: [{ shift: [3, -4], code: 'counted-corners' }] }, { shift: [3, -4] })).toBe('counted-corners');
  });
});

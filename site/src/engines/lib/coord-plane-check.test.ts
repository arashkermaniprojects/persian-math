import { describe, expect, it } from 'vitest';
import { checkCoord, type CoordCheck, type CoordState } from './coord-plane-check';

const run = (check: Omit<CoordCheck, 'type'>, plane: CoordState) => checkCoord({ type: 'coord', ...check }, { plane });
const code = (check: Omit<CoordCheck, 'type'>, plane: CoordState) => run(check, plane).code;

describe('coord: points', () => {
  const want = { points: [[-1, 0], [0, 2], [1, 4], [2, 6]] as [number, number][] };
  it('passes the set in any order', () => {
    expect(run(want, { points: [[2, 6], [0, 2], [-1, 0], [1, 4]] }).ok).toBe(true);
  });
  it('says empty, too few and too many', () => {
    expect(code(want, {})).toBe('empty');
    expect(code(want, { points: [[0, 2], [1, 4]] })).toBe('too-few');
    expect(code(want, { points: [[-1, 0], [0, 2], [1, 4], [2, 6], [3, 8]] })).toBe('too-many');
  });
  it('catches x and y swapped', () => {
    expect(code({ points: [[4, 2]] }, { points: [[2, 4]] })).toBe('swapped');
  });
  it('catches squares counted as units on a scaled axis', () => {
    expect(code(want, { points: [[-1, 0], [0, 4], [1, 8], [2, 6]], scale: [1, 2] })).toBe('scale');
    // the same points on an unscaled plane are just wrong
    expect(code(want, { points: [[-1, 0], [0, 4], [1, 8], [2, 6]] })).toBe('wrong-point');
  });
  it('says one coordinate is right when a single point is off along one axis', () => {
    expect(code({ points: [[3, 2]] }, { points: [[3, 5]] })).toBe('one-coordinate');
    expect(code({ points: [[3, 2]] }, { points: [[1, 5]] })).toBe('wrong-point');
  });
  it('accepts a tolerance (for read-off estimates)', () => {
    expect(run({ points: [[1.5, 2]], tolerance: 0.25 }, { points: [[1.5, 2.2]] }).ok).toBe(true);
  });
});

describe('coord: line', () => {
  it('passes the right gradient and intercept', () => {
    expect(run({ line: { m: [2, 3] } }, { lines: [{ m: 2 / 3, c: 1 }] }).ok).toBe(true);
    expect(run({ line: { m: -2, c: 4 } }, { lines: [{ m: -2, c: 4 }] }).ok).toBe(true);
  });
  it('says empty when there is no line', () => {
    expect(code({ line: { m: 2 } }, {})).toBe('empty');
    expect(code({ line: { m: 2 } }, { lines: [] })).toBe('empty');
  });
  it('catches run over rise, the sign, and other gradients', () => {
    expect(code({ line: { m: [2, 3] } }, { lines: [{ m: 1.5, c: 0 }] })).toBe('run-over-rise');
    expect(code({ line: { m: [2, 3] } }, { lines: [{ m: -2 / 3, c: 0 }] })).toBe('sign');
    expect(code({ line: { m: -2, c: 4 } }, { lines: [{ m: 2, c: 4 }] })).toBe('sign');
    expect(code({ line: { m: -2, c: 4 } }, { lines: [{ m: -0.5, c: 4 }] })).toBe('run-over-rise');
    expect(code({ line: { m: 2 } }, { lines: [{ m: 3, c: 0 }] })).toBe('wrong-gradient');
  });
  it('catches gradients from counted squares on unequal scales', () => {
    expect(code({ line: { m: 4 } }, { lines: [{ m: 2, c: 0 }], scale: [1, 2] })).toBe('scale');
  });
  it('catches c read from the x-axis', () => {
    expect(code({ line: { m: -2, c: 4 } }, { lines: [{ m: -2, c: 2 }] })).toBe('intercept-x');
    expect(code({ line: { m: 2, c: -4 } }, { lines: [{ m: 2, c: 2 }] })).toBe('intercept-x');
    expect(code({ line: { m: 2, c: -4 } }, { lines: [{ m: 2, c: 1 }] })).toBe('wrong-intercept');
  });
  it('catches y = 3 and x = 3 swapped', () => {
    expect(code({ line: { m: 0, c: 3 } }, { lines: [{ m: null, c: null, x: 3 }] })).toBe('swapped');
    expect(code({ line: { x: 3 } }, { lines: [{ m: 0, c: 3 }] })).toBe('swapped');
    expect(run({ line: { x: 3 } }, { lines: [{ m: null, c: null, x: 3 }] }).ok).toBe(true);
    expect(code({ line: { x: 3 } }, { lines: [{ m: null, c: null, x: 2 }] })).toBe('wrong-line');
    expect(code({ line: { m: 0, c: 3 } }, { lines: [{ m: 1, c: 3 }] })).toBe('not-horizontal');
    expect(code({ line: { m: 2 } }, { lines: [{ m: null, c: null, x: 1 }] })).toBe('vertical');
  });
  it('checks through, parallel and perpendicular', () => {
    expect(run({ line: { through: [[1, -2], [4, 4]] } }, { lines: [{ m: 2, c: -4 }] }).ok).toBe(true);
    expect(code({ line: { through: [[1, -2], [4, 4]] } }, { lines: [{ m: 2, c: -3 }] })).toBe('not-through');
    expect(run({ line: { parallelTo: 2 } }, { lines: [{ m: 2, c: 7 }] }).ok).toBe(true);
    expect(code({ line: { parallelTo: 2 } }, { lines: [{ m: 3, c: 7 }] })).toBe('not-parallel');
    expect(run({ line: { perpendicularTo: 2 } }, { lines: [{ m: -0.5, c: 1 }] }).ok).toBe(true);
    expect(code({ line: { perpendicularTo: 2 } }, { lines: [{ m: -2, c: 1 }] })).toBe('negative-only');
    expect(run({ line: { perpendicularTo: 0 } }, { lines: [{ m: null, c: null, x: 1 }] }).ok).toBe(true);
  });
});

describe('coord: table of values', () => {
  const t = { table: '2x + 2' };
  it('passes when every typed y is f(x)', () => {
    expect(run(t, { table: [{ x: -1, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 4 }] }).ok).toBe(true);
  });
  it('says empty, missing and wrong', () => {
    expect(code(t, { table: [{ x: -1, y: null }, { x: 0, y: null }] })).toBe('table-empty');
    expect(code(t, { table: [{ x: -1, y: 0 }, { x: 0, y: null }] })).toBe('table-missing');
    expect(code(t, { table: [{ x: -1, y: 1 }, { x: 0, y: 2 }] })).toBe('table-wrong');
  });
  it('checks the table before the points', () => {
    expect(code({ ...t, points: [[0, 2]] }, { table: [{ x: 0, y: 3 }], points: [[0, 2]] })).toBe('table-wrong');
    expect(code({ table: '2x + 2', points: [[0, 2]] }, { table: [{ x: 0, y: 2 }], points: [[2, 0]] })).toBe('swapped');
  });
});

describe('coord: graph', () => {
  it('compares the learner graph with f at sample xs', () => {
    expect(run({ graph: { f: '2x^2' } }, { graphs: [{ f: 'a*x^2', params: { a: 2 } }] }).ok).toBe(true);
    expect(code({ graph: { f: '2x^2' } }, { graphs: [{ f: 'a*x^2', params: { a: -2 } }] })).toBe('wrong-graph');
    expect(code({ graph: { f: '2x^2' } }, {})).toBe('empty');
    expect(run({ graph: { f: '1/x', at: [-1, 0, 1] } }, { graphs: [{ f: 'k/x', params: { k: 1 } }] }).ok).toBe(true);
  });
});

describe('coord: traps', () => {
  it('gives a known wrong answer its own code first', () => {
    expect(code({ points: [[4, 2]], traps: [{ point: [2, 4], code: 'my-swap' }] }, { points: [[2, 4]] })).toBe('my-swap');
    expect(code({ line: { m: 2, c: -4 }, traps: [{ m: 1, c: -3, code: 'through-a' }] }, { lines: [{ m: 1, c: -3 }] })).toBe('through-a');
    expect(code({ line: { x: 3 }, traps: [{ x: 3, code: 'never' }] }, { lines: [{ m: null, c: null, x: 2 }] })).toBe('wrong-line');
    expect(code({ table: '2x + 2', traps: [{ cell: [-1, -4], code: 'sign-slip' }] }, { table: [{ x: -1, y: -4 }] })).toBe('sign-slip');
  });
  it('a trap with no condition never fires', () => {
    expect(run({ points: [[1, 1]], traps: [{ code: 'x' }] }, { points: [[1, 1]] }).ok).toBe(true);
  });
});

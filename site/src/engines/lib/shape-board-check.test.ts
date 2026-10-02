import { describe, expect, it } from 'vitest';
import { checkShapeBoard as check, type Drawn, type ShapeBoardCheck, type ShapeBoardState } from './shape-board-check';
import type { P } from './shape-board-geom';

const poly = (pts: P[], closed = true): Drawn => ({ kind: 'polygon', pts, closed });
const C = (c: Omit<ShapeBoardCheck, 'type'>): ShapeBoardCheck => ({ type: 'shape-board', ...c });
const code = (c: Omit<ShapeBoardCheck, 'type'>, s: ShapeBoardState) => {
  const r = check(C(c), s);
  return r.ok ? 'ok' : r.code;
};

describe('drawn shapes', () => {
  const tri: P[] = [[0, 0], [3, 0], [1, 2]];
  it('empty, open and crossed', () => {
    expect(code({ shape: 'triangle' }, {})).toBe('empty');
    expect(code({ shape: 'triangle' }, { drawn: [poly(tri, false)] })).toBe('open');
    expect(code({ shape: 'quadrilateral' }, { drawn: [poly([[0, 0], [2, 2], [2, 0], [0, 2]])] })).toBe('crossed');
  });
  it('a triangle, and the side-count slips', () => {
    expect(code({ shape: 'triangle' }, { drawn: [poly(tri)] })).toBe('ok');
    expect(code({ shape: 'triangle' }, { drawn: [poly([[0, 0], [2, 0], [2, 2], [0, 2]])] })).toBe('too-many-sides');
    expect(code({ sides: 4 }, { drawn: [poly(tri)] })).toBe('too-few-sides');
  });
  it('a square: a rectangle gets its own code, a tilted square passes', () => {
    const c = { shape: 'square', traps: [{ shape: 'rectangle', code: 'sides-not-equal' }] };
    expect(code(c, { drawn: [poly([[0, 0], [3, 0], [3, 2], [0, 2]])] })).toBe('sides-not-equal');
    expect(code(c, { drawn: [poly([[1, 0], [3, 1], [2, 3], [0, 2]])] })).toBe('ok');
    expect(code(c, { drawn: [poly([[0, 0], [3, 0], [4, 2], [1, 2]])] })).toBe('not-square');
  });
  it('a rectangle that is not a square', () => {
    expect(code({ shape: 'rectangle', not: ['square'] }, { drawn: [poly([[0, 0], [2, 0], [2, 2], [0, 2]])] })).toBe('is-square');
    expect(code({ shape: 'rectangle', not: ['square'] }, { drawn: [poly([[0, 0], [3, 0], [3, 2], [0, 2]])] })).toBe('ok');
  });
  it('area and perimeter', () => {
    const r = { drawn: [poly([[0, 0], [3, 0], [3, 2], [0, 2]])] };
    expect(code({ area: 6, perimeter: 10 }, r)).toBe('ok');
    expect(code({ area: 8 }, r)).toBe('area-too-small');
    expect(code({ perimeter: 8 }, r)).toBe('perimeter-too-big');
  });
  it('side lengths for a construction', () => {
    expect(code({ lengths: [5, 3, 4] }, { drawn: [poly([[0, 0], [4, 0], [4, 3]])] })).toBe('ok');
    expect(code({ lengths: [5, 5, 4] }, { drawn: [poly([[0, 0], [4, 0], [4, 3]])] })).toBe('wrong-lengths');
  });
  it('count of shapes', () => {
    expect(code({ count: 2 }, { drawn: [poly([[0, 0], [1, 0], [0, 1]])] })).toBe('too-few');
  });
});

describe('images, similarity and lines', () => {
  const L: Drawn = { kind: 'path', pts: [[1, 3], [1, 1], [2, 1]] };
  const tri: Drawn = poly([[1, 1], [2, 1], [1, 3]]);
  it('reflection in a mirror line, and the slid copy', () => {
    const c = { image: { reflect: [[3, 0], [3, 5]] as [P, P] } };
    expect(code(c, { given: [L], drawn: [{ kind: 'path', pts: [[5, 3], [5, 1], [4, 1]] }] })).toBe('ok');
    // drawn the other way round, in two pieces
    expect(code(c, { given: [L], drawn: [{ kind: 'segment', pts: [[4, 1], [5, 1]] }, { kind: 'segment', pts: [[5, 1], [5, 3]] }] })).toBe('ok');
    expect(code(c, { given: [L], drawn: [{ kind: 'path', pts: [[4, 3], [4, 1], [5, 1]] }] })).toBe('slid');
    expect(code(c, { given: [L], drawn: [{ kind: 'path', pts: [[5, 3], [5, 1]] }] })).toBe('not-image');
    expect(code(c, { given: [L] })).toBe('empty');
  });
  it('translation, with x and y swapped', () => {
    const c = { image: { translate: [3, 1] as P } };
    expect(code(c, { given: [tri], drawn: [poly([[4, 2], [5, 2], [4, 4]])] })).toBe('ok');
    expect(code(c, { given: [tri], drawn: [poly([[2, 4], [3, 4], [2, 6]])] })).toBe('swapped');
  });
  it('rotation, and the wrong way round', () => {
    const c = { image: { rotate: { about: [1, 1] as P, angle: -90 } } };
    expect(code(c, { given: [tri], drawn: [poly([[1, 1], [1, 0], [3, 1]])] })).toBe('ok');
    expect(code(c, { given: [tri], drawn: [poly([[1, 1], [1, 2], [-1, 1]])] })).toBe('wrong-way');
  });
  it('enlargement', () => {
    const c = { similar: { factor: 2 } };
    expect(code(c, { given: [tri], drawn: [poly([[0, 0], [2, 0], [0, 4]])] })).toBe('ok');
    expect(code(c, { given: [tri], drawn: [poly([[0, 0], [3, 0], [0, 6]])] })).toBe('wrong-factor');
    expect(code(c, { given: [tri], drawn: [poly([[0, 0], [3, 0], [0, 4]])] })).toBe('not-similar');
    expect(code({ image: { scale: { about: [0, 0], factor: 2 } } }, { given: [tri], drawn: [poly([[2, 2], [4, 2], [2, 6]])] })).toBe('ok');
  });
  it('fold lines: the diagonal of a rectangle is not one', () => {
    const rect = poly([[1, 1], [5, 1], [5, 3], [1, 3]]);
    const line = (a: P, b: P): Drawn => ({ kind: 'line', pts: [a, b] });
    expect(code({ line: { symmetryOf: 0 } }, { given: [rect], drawn: [line([3, 0], [3, 4])] })).toBe('ok');
    expect(code({ line: { symmetryOf: 0 } }, { given: [rect], drawn: [line([0, 2], [6, 2])] })).toBe('ok');
    expect(code({ line: { symmetryOf: 0 } }, { given: [rect], drawn: [line([1, 1], [5, 3])] })).toBe('diagonal');
    expect(code({ line: { symmetryOf: 0 } }, { given: [rect], drawn: [line([2, 0], [2, 4])] })).toBe('not-symmetry');
    expect(code({ line: { symmetryOf: 0 } }, { given: [rect] })).toBe('empty');
  });
  it('parallel, perpendicular and through', () => {
    const g: Drawn = { kind: 'segment', pts: [[0, 0], [2, 1]] };
    const seg = (a: P, b: P): Drawn => ({ kind: 'segment', pts: [a, b] });
    expect(code({ line: { parallel: 0 } }, { given: [g], drawn: [seg([1, 3], [5, 5])] })).toBe('ok');
    expect(code({ line: { parallel: 0 } }, { given: [g], drawn: [seg([1, 3], [5, 6])] })).toBe('not-parallel');
    expect(code({ line: { perpendicular: [[0, 0], [2, 1]] } }, { drawn: [seg([3, 3], [2, 5])] })).toBe('ok');
    expect(code({ line: { perpendicular: 0, through: [[3, 3]] } }, { given: [g], drawn: [seg([4, 3], [3, 5])] })).toBe('not-through');
  });
  it('angles drawn as arm–corner–arm', () => {
    const ang = (pts: P[]): ShapeBoardState => ({ drawn: [{ kind: 'path', pts }] });
    expect(code({ angle: 'acute' }, ang([[3, 1], [0, 0], [2, 2]]))).toBe('ok');
    expect(code({ angle: 'acute' }, ang([[3, 0], [0, 0], [0, 2]]))).toBe('is-right');
    expect(code({ angle: 'obtuse' }, ang([[3, 0], [0, 0], [-1, 2]]))).toBe('ok');
    expect(code({ angle: 45 }, ang([[3, 0], [0, 0], [2, 2]]))).toBe('ok');
    expect(code({ angle: 45 }, ang([[3, 0], [0, 0], [0, 2]]))).toBe('angle-too-big');
    expect(code({ angle: 'right' }, {})).toBe('empty');
  });
});

describe('points, selections, cells and pieces', () => {
  it('points, with x and y swapped', () => {
    expect(code({ points: [[2, 3], [4, 1]] }, { points: [[4, 1], [2, 3]] })).toBe('ok');
    expect(code({ points: [[2, 3]] }, { points: [[3, 2]] })).toBe('swapped');
    expect(code({ points: [[2, 3]] }, { points: [[2, 3], [1, 1]] })).toBe('too-many');
    expect(code({ points: [[2, 3]] }, { points: [[1, 1]] })).toBe('wrong-point');
    expect(code({ points: [[2, 3]], traps: [{ point: [2, 4], code: 'counted-lines' }] }, { points: [[2, 4]] })).toBe('counted-lines');
    expect(code({ points: [[2, 3]] }, { points: [] })).toBe('empty');
  });
  it('selections, with a trap', () => {
    const c = { selected: [0, 2, 3], traps: [{ select: 4, code: 'curved' }] };
    expect(code(c, { selected: [3, 0, 2] })).toBe('ok');
    expect(code(c, { selected: [0, 2] })).toBe('missed');
    expect(code(c, { selected: [0, 2, 3, 1] })).toBe('extra');
    expect(code(c, { selected: [0, 4] })).toBe('curved');
    expect(code(c, { selected: [] })).toBe('empty');
  });
  it('cells: count, inside a shape, cube nets', () => {
    const given = [poly([[0, 0], [3, 0], [3, 2], [0, 2]])];
    expect(code({ cells: 2, within: 0 }, { given, cells: [[0, 0], [1, 1]] })).toBe('ok');
    expect(code({ cells: 2, within: 0 }, { given, cells: [[0, 0], [3, 1]] })).toBe('outside');
    expect(code({ cells: 3 }, { cells: [[0, 0]] })).toBe('too-few');
    expect(code({ net: 'cube' }, { cells: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]] })).toBe('ok');
    expect(code({ net: 'cube' }, { cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] })).toBe('not-net');
    expect(code({ net: 'cube' }, { cells: [[0, 0], [1, 0]] })).toBe('too-few');
  });
  it('pieces cover a shape; a piece moved and turned', () => {
    const given = [poly([[1, 0], [4, 0], [4, 2], [1, 2]])];
    const pieces = [{ at: [0, 0] as P, turn: 0, pts: [[1, 0], [3, 0], [4, 2], [1, 2]] as P[] }, { at: [3, 0] as P, turn: 0, pts: [[3, 0], [4, 0], [4, 2]] as P[] }];
    expect(code({ fits: 0 }, { given, pieces })).toBe('ok');
    expect(code({ fits: 0 }, { given, pieces: pieces.slice(0, 1) })).toBe('not-fit');
    const p = (at: P, turn: number) => ({ pieces: [{ at, turn, pts: [] }] });
    expect(code({ piece: { at: [2, 0], turn: -90 } }, p([2, 0], -90))).toBe('ok');
    expect(code({ piece: { turn: -90 } }, p([0, 0], 90))).toBe('wrong-way');
    expect(code({ piece: { turn: -90 } }, p([0, 0], 270))).toBe('long-way');
    expect(code({ piece: { turn: -90 } }, p([0, 0], 180))).toBe('wrong-turn');
    expect(code({ piece: { at: [2, 1] } }, p([1, 2], 0))).toBe('swapped');
    expect(code({ piece: { at: [2, 1] } }, p([1, 1], 0))).toBe('wrong-place');
  });
});

describe('cubes and number tiles', () => {
  const cubes = (count: number, box: [number, number, number] | null) => ({ cubes: { count, heights: [], box } });
  it('cube count and cuboid', () => {
    expect(code({ cubes: 12, box: [2, 3, 2] }, cubes(12, [3, 2, 2]))).toBe('ok');
    expect(code({ cubes: 12 }, cubes(10, null))).toBe('too-few');
    expect(code({ box: [2, 3, 2] }, cubes(12, null))).toBe('not-box');
    expect(code({ box: [2, 3, 2] }, cubes(12, [1, 3, 4]))).toBe('wrong-box');
    expect(code({ cubes: 1 }, {})).toBe('empty');
  });
  it('pick with traps', () => {
    const c = { pick: 4, traps: [{ pick: 3, code: 'counted-corners-twice' }] };
    expect(code(c, { picked: 4 })).toBe('ok');
    expect(code(c, { picked: 3 })).toBe('counted-corners-twice');
    expect(code(c, { picked: 6 })).toBe('too-big');
    expect(code(c, { picked: null })).toBe('empty');
  });
  it('several conditions together, in order', () => {
    const s: ShapeBoardState = { drawn: [poly([[0, 0], [3, 0], [0, 4]])], picked: 3 };
    expect(code({ shape: 'triangle', pick: 3 }, s)).toBe('ok');
    expect(code({ shape: 'triangle', pick: 4 }, s)).toBe('too-small');
  });
});

describe('sides implied by the class asked for', () => {
  it('a triangle when a square was asked for has too few sides', () => {
    expect(code({ shape: 'square' }, { drawn: [poly([[0, 0], [2, 0], [0, 2]])] })).toBe('too-few-sides');
    expect(code({ shape: 'isosceles' }, { drawn: [poly([[0, 0], [2, 0], [2, 2], [0, 2]])] })).toBe('too-many-sides');
  });
});

describe('chords of a compass circle', () => {
  const seg = (a: P, b: P): Drawn => ({ kind: 'segment', pts: [a, b] });
  const circles: [number, number, number][] = [[3, 3, Math.sqrt(5)]];
  it('needs a circle, then a segment with both ends on it', () => {
    expect(code({ chord: true }, { drawn: [seg([4, 5], [5, 4])] })).toBe('no-circle');
    expect(code({ chord: true }, { circles })).toBe('empty');
    expect(code({ chord: true }, { circles, drawn: [seg([4, 5], [5, 5])] })).toBe('not-chord');
    expect(code({ chord: true }, { circles, drawn: [seg([4, 5], [5, 4])] })).toBe('ok');
  });
  it('a diameter is a chord through the centre', () => {
    const d = { circles, drawn: [seg([4, 5], [2, 1])] };
    expect(code({ chord: true }, d)).toBe('ok');
    expect(code({ chord: { diameter: false } }, d)).toBe('is-diameter');
    expect(code({ chord: { diameter: true } }, d)).toBe('ok');
    expect(code({ chord: { diameter: true } }, { circles, drawn: [seg([4, 5], [5, 4])] })).toBe('not-diameter');
  });
  it('ends at a crossing of two circles count (floating point)', () => {
    const two: [number, number, number][] = [[1, 1, 3], [4, 1, 3]];
    const top: P = [2.5, 1 + (3 * Math.sqrt(3)) / 2];
    expect(code({ chord: { diameter: false } }, { circles: two, drawn: [seg([4, 1], top)] })).toBe('ok');
  });
});

describe('dynamic figures: dragged, invariant, watch', () => {
  const dyn = (values: Record<string, number | null>, more: Partial<NonNullable<ShapeBoardState['dyn']>> = {}): ShapeBoardState => ({
    dyn: { pts: {}, values, dragged: 0, chosen: null, locked: true, ...more },
  });
  const typed = (c: Omit<ShapeBoardCheck, 'type'>, s: ShapeBoardState, n: number | null) => {
    const r = check(C(c), s, n);
    return r.ok ? 'ok' : r.code;
  };
  it('dragged: explored enough positions first', () => {
    expect(code({ dragged: 3 }, dyn({}, { dragged: 2 }))).toBe('not-dragged');
    expect(code({ dragged: 3 }, dyn({}, { dragged: 3 }))).toBe('ok');
    expect(code({ dragged: 1 }, {})).toBe('empty');
  });
  it('invariant: the choice, with traps', () => {
    const c = { dragged: 2, invariant: 'equal', traps: [{ chosen: 'sum180', code: 'co-interior-equal' }] };
    expect(code(c, dyn({}, { dragged: 0, chosen: 'equal' }))).toBe('not-dragged');
    expect(code(c, dyn({}, { dragged: 2 }))).toBe('empty');
    expect(code(c, dyn({}, { dragged: 2, chosen: 'sum180' }))).toBe('co-interior-equal');
    expect(code(c, dyn({}, { dragged: 2, chosen: 'fixed' }))).toBe('wrong-invariant');
    expect(code(c, dyn({}, { dragged: 2, chosen: 'equal' }))).toBe('ok');
  });
  it('watch equals: drag until a readout reaches a value', () => {
    const c = { watch: { key: 'diff', equals: 0 } };
    expect(code(c, dyn({ diff: 4 }))).toBe('watch-too-big');
    expect(code(c, dyn({ diff: -3 }))).toBe('watch-too-small');
    expect(code(c, dyn({ diff: null }))).toBe('no-reading');
    expect(code(c, dyn({}))).toBe('no-reading');
    expect(code(c, dyn({ diff: 0 }))).toBe('ok');
    expect(code({ watch: { key: 'r', equals: 0.5, tolerance: 0.02 } }, dyn({ r: 0.51 }))).toBe('ok');
  });
  it('watch typed: the typed answer is the (possibly hidden) readout; another readout or a number is a trap', () => {
    const c = {
      watch: { key: 'a3', typed: true },
      traps: [{ watch: 'a5', code: 'co-interior-equal' }, { typed: 360, code: 'full-turn' }, { watch: 'pw', code: 'part-whole' }],
    };
    const s = dyn({ a3: 115, a5: 65, pw: 0.4 });
    expect(typed(c, s, null)).toBe('empty');
    expect(typed(c, s, 65)).toBe('co-interior-equal');
    expect(typed(c, s, 360)).toBe('full-turn');
    expect(typed(c, s, 0.4)).toBe('part-whole');
    expect(typed(c, s, 120)).toBe('too-big');
    expect(typed(c, s, 100)).toBe('too-small');
    expect(typed(c, s, 115)).toBe('ok');
    // a trap whose readout is missing never fires
    expect(typed({ watch: { key: 'a3', typed: true }, traps: [{ watch: 'nope', code: 'x' }] }, s, 1)).toBe('too-small');
  });
  it('dynamic parts come after the board parts, and missions without them are unchanged', () => {
    expect(code({ pick: 3, dragged: 1 }, { picked: 2, dyn: { pts: {}, values: {}, dragged: 0, chosen: null, locked: true } })).toBe('too-small');
    expect(code({ pick: 3 }, { picked: 3 })).toBe('ok');
  });
});

import { describe, expect, it } from 'vitest';
import {
  angleAt, angleKind, angles, area, circleCircle, classify, clean, covers, cubeNet, inside, lineCircle, lineLine, mergeSegments,
  parallel, perimeter, perpendicular, reflect, rotate, rotationOrder, sameDrawing, scale, selfIntersecting, sides, similarity,
  symmetricIn, symmetryLines, type P, type Seg,
} from './shape-board-geom';

const sq: P[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
const rect: P[] = [[0, 0], [3, 0], [3, 2], [0, 2]];
const has = (pts: P[], ...k: string[]) => k.forEach((c) => expect(classify(pts)).toContain(c));
const hasNot = (pts: P[], ...k: string[]) => k.forEach((c) => expect(classify(pts)).not.toContain(c));

describe('measures', () => {
  it('shoelace area either way round', () => {
    expect(area(rect)).toBe(6);
    expect(area([...rect].reverse())).toBe(6);
    expect(area([[0, 0], [4, 0], [0, 3]])).toBe(6);
    // L-shape (rectilinear): 3×3 minus 2×2
    expect(area([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]])).toBe(5);
  });
  it('perimeter and side lengths', () => {
    expect(perimeter(rect)).toBe(10);
    expect(sides([[0, 0], [4, 0], [0, 3]])).toEqual([4, 5, 3]);
    expect(perimeter([[0, 0], [4, 0], [4, 3]], false)).toBe(7);
  });
  it('angles, including a dent', () => {
    expect(angleAt([1, 0], [0, 0], [0, 1])).toBeCloseTo(90);
    expect(angleAt([1, 0], [0, 0], [1, 1])).toBeCloseTo(45);
    expect(angleAt([1, 0], [0, 0], [-1, 1])).toBeCloseTo(135);
    const L: P[] = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]];
    const a = angles(L);
    expect(a.reduce((s, x) => s + x, 0)).toBeCloseTo(720);
    expect(a[3]).toBeCloseTo(270);
    expect(angles([...L].reverse())[2]).toBeCloseTo(270);
  });
  it('classifies angles', () => {
    expect(angleKind(30)).toBe('acute');
    expect(angleKind(90)).toBe('right');
    expect(angleKind(120)).toBe('obtuse');
    expect(angleKind(180)).toBe('straight');
    expect(angleKind(200)).toBe('reflex');
    expect(angleKind(0)).toBe('zero');
  });
  it('parallel and perpendicular', () => {
    expect(parallel([[0, 0], [2, 1]], [[1, 3], [5, 5]])).toBe(true);
    expect(parallel([[0, 0], [2, 1]], [[1, 3], [5, 6]])).toBe(false);
    expect(perpendicular([[0, 0], [2, 1]], [[3, 3], [2, 5]])).toBe(true);
    expect(perpendicular([[0, 0], [2, 1]], [[3, 3], [2, 4]])).toBe(false);
  });
});

describe('clean', () => {
  it('drops repeats, a closing repeat and points on a side', () => {
    expect(clean([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2], [0, 0]])).toEqual([[0, 0], [2, 0], [2, 2], [0, 2]]);
    expect(clean([[0, 0], [0, 0], [2, 0], [0, 2]])).toHaveLength(3);
  });
  it('keeps the ends of an open path', () => {
    expect(clean([[0, 0], [1, 1], [2, 2], [3, 0]], false)).toEqual([[0, 0], [2, 2], [3, 0]]);
  });
});

describe('classify', () => {
  it('triangles by sides and angles', () => {
    has([[0, 0], [4, 0], [0, 3]], 'triangle', 'scalene', 'right-angled', 'convex');
    has([[0, 0], [2, 0], [1, 3]], 'isosceles', 'acute-angled');
    has([[0, 0], [4, 0], [5, 1]], 'scalene', 'obtuse-angled');
    has([[0, 0], [2, 0], [0, 2]], 'isosceles', 'right-angled');
    has([[0, 0], [2, 0], [1, Math.sqrt(3)]], 'equilateral', 'isosceles', 'regular');
    hasNot([[0, 0], [4, 0], [0, 3]], 'isosceles', 'quadrilateral');
  });
  it('a triangle tapped with an extra point on a side is still a triangle', () => {
    has([[0, 0], [2, 0], [4, 0], [0, 3]], 'triangle');
  });
  it('the quadrilateral family is inclusive', () => {
    has(sq, 'square', 'rectangle', 'rhombus', 'parallelogram', 'trapezium', 'kite', 'regular', 'rectilinear');
    has(rect, 'rectangle', 'parallelogram', 'trapezium');
    hasNot(rect, 'square', 'rhombus', 'kite', 'regular');
    // a tilted square
    has([[1, 0], [3, 1], [2, 3], [0, 2]], 'square');
    hasNot([[1, 0], [3, 1], [2, 3], [0, 2]], 'rectilinear');
    has([[0, 0], [3, 0], [4, 2], [1, 2]], 'parallelogram');
    hasNot([[0, 0], [3, 0], [4, 2], [1, 2]], 'rectangle', 'rhombus');
    has([[1, 0], [2, 2], [1, 4], [0, 2]], 'rhombus', 'kite');
    hasNot([[1, 0], [2, 2], [1, 4], [0, 2]], 'square', 'rectangle');
    has([[0, 0], [4, 0], [3, 2], [1, 2]], 'trapezium');
    hasNot([[0, 0], [4, 0], [3, 2], [1, 2]], 'parallelogram');
    has([[1, 0], [2, 1], [1, 3], [0, 1]], 'kite');
    hasNot([[1, 0], [2, 1], [1, 3], [0, 1]], 'rhombus', 'trapezium');
    has([[0, 0], [3, 1], [2, 3], [0, 2]], 'quadrilateral');
    hasNot([[0, 0], [3, 1], [2, 3], [0, 2]], 'trapezium', 'kite');
  });
  it('a dart is a concave kite, not a trapezium', () => {
    has([[0, 0], [2, 3], [0, 1], [-2, 3]], 'kite', 'concave');
  });
  it('polygons by number of sides, regular or not', () => {
    has([[0, 0], [2, 0], [3, 2], [1, 3], [-1, 2]], 'pentagon', 'polygon');
    const hex = [0, 1, 2, 3, 4, 5].map((k): P => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]);
    has(hex, 'hexagon', 'regular');
    has([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]], 'hexagon', 'concave', 'rectilinear');
    hasNot([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]], 'regular');
  });
  it('open and crossed shapes', () => {
    expect(classify([[0, 0], [2, 0]])).toEqual(['open']);
    expect(classify([[0, 0], [1, 1], [2, 2]])).toEqual(['open']);
    expect(classify([[0, 0], [2, 2], [2, 0], [0, 2]])).toEqual(['crossed']);
    expect(selfIntersecting([[0, 0], [2, 0], [2, 2], [0, 2]])).toBe(false);
    expect(selfIntersecting([[0, 0], [2, 2], [2, 0], [0, 2]])).toBe(true);
    // a spike doubling back on itself
    expect(selfIntersecting([[0, 0], [3, 0], [1, 0], [1, 2]])).toBe(true);
  });
});

describe('transformations', () => {
  it('reflect in vertical, horizontal and diagonal lines', () => {
    expect(reflect([1, 2], [[3, 0], [3, 5]])).toEqual([5, 2]);
    expect(reflect([1, 2], [[0, 0], [4, 0]])).toEqual([1, -2]);
    expect(reflect([1, 3], [[0, 0], [1, 1]])).toEqual([3, 1]);
  });
  it('rotate exactly by quarter turns', () => {
    expect(rotate([2, 1], [0, 0], 90)).toEqual([-1, 2]);
    expect(rotate([2, 1], [1, 1], 180)).toEqual([0, 1]);
    expect(rotate([2, 1], [0, 0], -90)).toEqual([1, -2]);
    const r = rotate([1, 0], [0, 0], 60);
    expect(r[0]).toBeCloseTo(0.5);
  });
  it('scale from a centre', () => {
    expect(scale([2, 1], [1, 1], 3)).toEqual([4, 1]);
  });
});

describe('drawings as sets of lines', () => {
  it('merges collinear pieces however they were tapped', () => {
    expect(mergeSegments([[[0, 0], [1, 0]], [[1, 0], [3, 0]], [[2, 0], [0, 0]]])).toHaveLength(1);
    expect(mergeSegments([[[0, 0], [1, 0]], [[2, 0], [3, 0]]])).toHaveLength(2);
  });
  it('compares drawings regardless of order, direction and start', () => {
    const a: Seg[] = [[[0, 0], [2, 0]], [[2, 0], [2, 2]], [[2, 2], [0, 0]]];
    const b: Seg[] = [[[2, 2], [2, 1]], [[2, 1], [2, 0]], [[0, 0], [2, 2]], [[2, 0], [0, 0]]];
    expect(sameDrawing(a, b)).toBe(true);
    expect(sameDrawing(a, b.slice(1))).toBe(false);
  });
  it('symmetry in a line', () => {
    const e = (p: P[]): Seg[] => p.map((q, i) => [q, p[(i + 1) % p.length]]);
    expect(symmetricIn(e(rect), [[1.5, 0], [1.5, 2]])).toBe(true);
    expect(symmetricIn(e(rect), [[0, 1], [3, 1]])).toBe(true);
    expect(symmetricIn(e(rect), [[0, 0], [3, 2]])).toBe(false); // the diagonal of a rectangle is not a fold line
    expect(symmetricIn(e(sq), [[0, 0], [2, 2]])).toBe(true);
  });
  it('counts lines of symmetry', () => {
    expect(symmetryLines(sq)).toHaveLength(4);
    expect(symmetryLines(rect)).toHaveLength(2);
    expect(symmetryLines([[0, 0], [3, 0], [4, 2], [1, 2]])).toHaveLength(0);
    expect(symmetryLines([[0, 0], [2, 0], [1, 3]])).toHaveLength(1);
    expect(symmetryLines([[1, 0], [2, 1], [1, 3], [0, 1]])).toHaveLength(1);
    const hex = [0, 1, 2, 3, 4, 5].map((k): P => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]);
    expect(symmetryLines(hex)).toHaveLength(6);
  });
  it('order of rotational symmetry', () => {
    expect(rotationOrder(sq)).toBe(4);
    expect(rotationOrder(rect)).toBe(2);
    expect(rotationOrder([[0, 0], [3, 0], [4, 2], [1, 2]])).toBe(2);
    expect(rotationOrder([[0, 0], [2, 0], [1, 3]])).toBe(1);
  });
});

describe('similarity', () => {
  it('finds the scale factor, turned or flipped', () => {
    expect(similarity([[0, 0], [2, 0], [0, 1]], [[1, 1], [1, 5], [3, 1]])).toBe(2);
    expect(similarity(rect, [[0, 0], [6, 0], [6, 4], [0, 4]])).toBe(2);
    expect(similarity(rect, [[0, 0], [0, 6], [-4, 6], [-4, 0]])).toBe(2);
    expect(similarity(rect, rect)).toBe(1);
  });
  it('rejects shapes that are not similar', () => {
    expect(similarity(rect, [[0, 0], [6, 0], [6, 3], [0, 3]])).toBeNull();
    expect(similarity(rect, sq)).toBeNull();
    expect(similarity(rect, [[0, 0], [4, 0], [0, 3]])).toBeNull();
  });
});

describe('inside and covering', () => {
  it('point in polygon', () => {
    expect(inside([1, 1], sq)).toBe(true);
    expect(inside([3, 1], sq)).toBe(false);
  });
  it('a parallelogram cut and moved into a rectangle', () => {
    const target: P[] = [[1, 0], [4, 0], [4, 2], [1, 2]];
    const body: P[] = [[1, 0], [3, 0], [4, 2], [1, 2]];
    const cut: P[] = [[3, 0], [4, 0], [4, 2]];
    expect(covers([body, cut], target)).toBe(true);
    expect(covers([body], target)).toBe(false);
    expect(covers([body, cut.map((p): P => [p[0] - 1, p[1]])], target)).toBe(false);
  });
});

describe('cube nets', () => {
  it('accepts the 11 nets (a few shown) and rejects others', () => {
    expect(cubeNet([[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]])).toBe(true); // cross
    expect(cubeNet([[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]])).toBe(true);
    expect(cubeNet([[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]])).toBe(true); // staircase
    expect(cubeNet([[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]])).toBe(true); // 3-3
    expect(cubeNet([[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 0]])).toBe(false); // five in a row
    expect(cubeNet([[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [3, 1]])).toBe(false); // a 2×2 block
    expect(cubeNet([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]])).toBe(false);
    expect(cubeNet([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]])).toBe(false); // only five
    expect(cubeNet([[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [5, 5]])).toBe(false); // not joined
  });
});

describe('intersections', () => {
  it('two lines', () => {
    expect(lineLine([[0, 0], [2, 2]], [[0, 2], [2, 0]])).toEqual([1, 1]);
    expect(lineLine([[0, 0], [1, 0]], [[0, 1], [1, 1]])).toBeNull();
  });
  it('two circles (the equilateral-triangle construction)', () => {
    const pts = circleCircle([0, 0, 4], [4, 0, 4]);
    expect(pts).toHaveLength(2);
    pts.forEach((p) => { expect(p[0]).toBeCloseTo(2); expect(Math.abs(p[1])).toBeCloseTo(Math.sqrt(12)); });
    expect(circleCircle([0, 0, 1], [5, 0, 1])).toEqual([]);
    expect(circleCircle([0, 0, 1], [2, 0, 1])).toHaveLength(1);
  });
  it('a line and a circle', () => {
    const pts = lineCircle([[-5, 0], [5, 0]], [0, 0, 3]);
    expect(pts.map((p) => p[0]).sort((a, b) => a - b)).toEqual([-3, 3]);
    expect(lineCircle([[-5, 4], [5, 4]], [0, 0, 3])).toEqual([]);
  });
});

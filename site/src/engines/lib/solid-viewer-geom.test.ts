import { describe, expect, it } from 'vitest';
import { anchorNormal, baseOf, dimsOf, hardEdge, layer, layerCount, meshOf, meshVolume, measuresOf, polyArea, shapeOf, shoelace, unfold, type SolidSpec } from './solid-viewer-geom';
import type { V3 } from './iso-projection';

const tri: SolidSpec = { kind: 'prism', base: [[0, 0], [4, 0], [0, 3]], h: 5 };
const box: SolidSpec = { kind: 'cuboid', size: [5, 3, 4] };
const can: SolidSpec = { kind: 'cylinder', r: 5, h: 10 };
const near = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d);
const flat = (polys: { pts: V3[] }[], n: V3) => {
  // every corner lies in one plane with normal n
  const d0 = polys[0].pts[0].reduce((s, x, i) => s + x * n[i], 0);
  return polys.every((p) => p.pts.every((q) => Math.abs(q.reduce((s, x, i) => s + x * n[i], 0) - d0) < 1e-6));
};

describe('faces and shapes', () => {
  it('names polygons', () => {
    expect(shapeOf([[0, 0, 0], [1, 0, 0], [0, 1, 0]])).toBe('triangle');
    expect(shapeOf([[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]])).toBe('square');
    expect(shapeOf([[0, 0, 0], [3, 0, 0], [3, 2, 0], [0, 2, 0]])).toBe('rectangle');
    expect(shapeOf([[0, 0, 0], [3, 0, 0], [2, 2, 0], [0, 2, 0]])).toBe('quadrilateral');
  });
  it('bases turn anticlockwise whatever order they are given in', () => {
    expect(shoelace(baseOf({ kind: 'prism', base: [[0, 0], [0, 3], [4, 0]] }))).toBeCloseTo(6);
    expect(baseOf(can)).toHaveLength(32);
  });
  it('a triangular prism has 2 triangle bases and 3 rectangle sides (5 × 5 is a square), 9 edges', () => {
    const m = meshOf(tri);
    expect(m.groups.map((g) => `${g.role}:${g.shape}`)).toEqual(['base:triangle', 'base:triangle', 'lateral:rectangle', 'lateral:square', 'lateral:rectangle']);
    expect(m.groups.map((g) => g.area)).toEqual([6, 6, 20, 25, 15]);
    expect(m.edges.filter((e) => hardEdge(m, e))).toHaveLength(9);
  });
  it('lying on its side, the triangles are the ends and it rests on a rectangle', () => {
    const m = meshOf({ ...tri, lie: true });
    const bottom = m.polys.find((p) => p.n[2] < -0.99)!;
    expect(m.groups[bottom.g].shape).toBe('rectangle');
    for (const p of m.polys.filter((p) => m.groups[p.g].role === 'base')) expect(Math.abs(p.n[0])).toBeCloseTo(1);
  });
  it('normals point outwards and the mesh is centred', () => {
    for (const s of [tri, box, can, { kind: 'pyramid', base: [[0, 0], [4, 0], [4, 4], [0, 4]], h: 3 } as SolidSpec, { kind: 'sphere', r: 2 } as SolidSpec]) {
      const m = meshOf(s), all = m.polys.flatMap((p) => p.pts);
      const mid = all.reduce((a, q) => a.map((x, i) => x + q[i] / all.length), [0, 0, 0]);
      for (const p of m.polys) {
        const c = p.pts.reduce((a, q) => a.map((x, i) => x + q[i] / p.pts.length), [0, 0, 0]);
        expect(c.reduce((t, x, i) => t + (x - mid[i]) * p.n[i], 0), s.kind).toBeGreaterThan(0);
      }
      for (const k of [0, 1, 2]) near(Math.min(...all.map((p) => p[k])) + Math.max(...all.map((p) => p[k])), 0);
    }
  });
  it('a cylinder is 2 circles and one curved side; its strips meet at soft edges', () => {
    const m = meshOf(can);
    expect(m.groups.map((g) => g.shape)).toEqual(['circle', 'circle', 'curved']);
    expect(m.edges.filter((e) => hardEdge(m, e))).toHaveLength(64);
  });
  it('cube towers keep only the outside faces', () => {
    const m = meshOf({ kind: 'cubes', heights: [[2, 1]] });
    expect(m.polys).toHaveLength(14); // 3 cubes: 18 faces − 2 × 2 shared
    near(meshVolume(m.polys), 3);
  });
});

describe('measures', () => {
  it('triangular prism: volume = base × height', () => {
    const m = measuresOf(tri);
    expect(m).toMatchObject({ volume: 30, base: 6, lateral: 60, total: 72 });
    near(m.edges, 2 * 12 + 3 * 5);
  });
  it('cuboid 5 × 3 × 4', () => {
    expect(measuresOf(box)).toMatchObject({ volume: 60, base: 15, lateral: 64, total: 94, edges: 48 });
    expect(measuresOf({ kind: 'cube', a: 2 })).toMatchObject({ volume: 8, total: 24, edges: 24 });
  });
  it('cylinder with π = 3.14: side 314, volume 785, total 471', () => {
    const m = measuresOf(can, 3.14);
    near(m.lateral, 314); near(m.volume, 785); near(m.total, 471); near(m.base, 78.5);
  });
  it('pyramids and cones are a third of their prism', () => {
    near(measuresOf({ kind: 'pyramid', base: [[0, 0], [6, 0], [6, 6], [0, 6]], h: 4 }).volume, 48);
    near(measuresOf({ kind: 'pyramid', base: [[0, 0], [6, 0], [6, 6], [0, 6]], h: 4 }).lateral, 60);
    near(measuresOf({ kind: 'cone', r: 3, h: 4 }, 3).volume, 36);
    near(measuresOf({ kind: 'cone', r: 3, h: 4 }, 3).lateral, 45);
    near(measuresOf({ kind: 'sphere', r: 3 }, 3).volume, 108);
    near(measuresOf({ kind: 'hemisphere', r: 3 }, 3).total, 81);
  });
  it('a mesh (regular tetrahedron) by the divergence theorem', () => {
    const t: SolidSpec = { kind: 'mesh', vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], faces: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]] };
    near(measuresOf(t).volume, 8 / 3);
    near(measuresOf(t).total, 4 * (Math.sqrt(3) / 4) * 8);
    expect(meshOf(t).edges).toHaveLength(6);
  });
});

describe('unfold', () => {
  it('closed (t = 0) the faces are the solid itself', () => {
    const net = unfold(box, 0)!, m = meshOf(box);
    expect(net).toHaveLength(6);
    const areas = (ps: { pts: V3[] }[]) => ps.map((p) => polyArea(p.pts)).sort((a, b) => a - b);
    expect(areas(net).map((a) => +a.toFixed(6))).toEqual(areas(m.polys).map((a) => +a.toFixed(6)));
    const corners = new Set(m.polys.flatMap((p) => p.pts.map((q) => q.map((x) => x.toFixed(4)).join())));
    for (const p of net) for (const q of p.pts) expect(corners.has(q.map((x) => x.toFixed(4)).join())).toBe(true);
  });
  it('open (t = 1) a cuboid is a flat cross-shaped net of 6 faces', () => {
    const net = unfold(box, 1)!;
    expect(flat(net, anchorNormal(box))).toBe(true);
    near(net.reduce((t, p) => t + polyArea(p.pts), 0), 94);
    // the side strip is 2 × (5 + 3) = 16 long
    const n = anchorNormal(box), along: V3 = [-n[1], n[0], 0];
    const xs = net.filter((p) => p.g >= 2).flatMap((p) => p.pts.map((q) => q[0] * along[0] + q[1] * along[1]));
    near(Math.max(...xs) - Math.min(...xs), 16);
    // every face faces the same way
    for (const p of net) expect(p.n.reduce((t, x, i) => t + x * n[i], 0)).toBeCloseTo(1);
  });
  it('a cylinder opens into a 2πr × h rectangle with two circles', () => {
    const net = unfold(can, 1)!, n = anchorNormal(can), along: V3 = [-n[1], n[0], 0];
    expect(flat(net, n)).toBe(true);
    const side = net.filter((p) => p.g === 2);
    const xs = side.flatMap((p) => p.pts.map((q) => q[0] * along[0] + q[1] * along[1]));
    const per = baseOf(can).reduce((t, p, i, B) => t + Math.hypot(p[0] - B[(i + 1) % 32][0], p[1] - B[(i + 1) % 32][1]), 0);
    near(Math.max(...xs) - Math.min(...xs), per, 4);
    const zs = side.flatMap((p) => p.pts.map((q) => q[2]));
    near(Math.max(...zs) - Math.min(...zs), 10);
    expect(net.filter((p) => p.g < 2)).toHaveLength(2);
  });
  it('half open, the faces have their sizes and are no longer flat', () => {
    const net = unfold(tri, 0.5)!;
    expect(net.map((p) => +polyArea(p.pts).toFixed(6)).sort((a, b) => a - b)).toEqual([6, 6, 15, 20, 25]);
    expect(flat(net, anchorNormal(tri))).toBe(false);
  });
  it('only prisms and cylinders unfold', () => {
    expect(unfold({ kind: 'sphere' }, 1)).toBeNull();
  });
});

describe('layers and labels', () => {
  it('a 5-long prism fills with 5 layers of 1, each the base', () => {
    expect(layerCount(tri)).toBe(5);
    expect(layerCount(tri, 0.5)).toBe(10);
    const l = layer(tri, 0);
    near(meshVolume(l.polys), 6);
    const l4 = layer({ ...tri, lie: true }, 4);
    near(meshVolume(l4.polys), 6);
    // the last layer of a lying prism is at its +x end
    expect(Math.min(...l4.polys.flatMap((p) => p.pts.map((q) => q[0])))).toBeCloseTo(1.5);
  });
  it('dimensions: base edges and the height; a cuboid gives l, w, h once', () => {
    expect(dimsOf(tri).map((d) => d.value)).toEqual([4, 5, 3, 5]);
    expect(dimsOf(box).map((d) => d.value)).toEqual([5, 3, 4]);
    expect(dimsOf(can).map((d) => [d.value, !!d.line])).toEqual([[5, true], [10, false]]);
    expect(dimsOf({ kind: 'sphere' })).toEqual([]);
  });
});

// Geometry for <kg-solid-viewer>: solids as face meshes, their measures (volume, base, lateral and total area,
// edge sum), the net unfolding of prisms and cylinders, and the base layers of the fill mode. Pure (no DOM).
// Coordinates: a solid is built upright in local (u, v, w) with its base in the uv plane and w up; `lie` turns a
// prism or cylinder onto its side (axis along x). The mesh is centred on the origin so it turns about its middle.
import type { V2, V3 } from './iso-projection';

export type Kind = 'prism' | 'cuboid' | 'cube' | 'cylinder' | 'pyramid' | 'cone' | 'sphere' | 'hemisphere' | 'cubes' | 'mesh';
export interface SolidSpec {
  kind: Kind;
  /** prism / pyramid: base polygon corners [u, v] (any turning order). */
  base?: V2[];
  /** cuboid [length, width, height]; cube: edge `a`. */
  size?: [number, number, number];
  a?: number;
  r?: number;
  h?: number;
  /** pyramid apex above [u, v] (default: the base's centre). */
  apex?: V2;
  /** cubes: stacks per plan square, rows of columns (row 0 at the back). */
  heights?: number[][];
  /** mesh: corners and faces (corner indices), e.g. a regular polyhedron. Assumed convex. */
  vertices?: V3[];
  faces?: number[][];
  /** Prism or cylinder lying on its side: the axis runs along x. */
  lie?: boolean;
  /** Round solids: segments round the circle (default 32). */
  segments?: number;
}
export type Shape = 'triangle' | 'square' | 'rectangle' | 'quadrilateral' | 'pentagon' | 'hexagon' | 'polygon' | 'circle' | 'curved';
/** A face as the learner sees it (a curved surface is one face drawn as many strips). */
export interface Group { role: 'base' | 'lateral' | 'face'; shape: Shape; area: number }
export interface Poly { pts: V3[]; g: number; n: V3 }
export interface Edge { a: V3; b: V3; f: number[] }
export interface Mesh { polys: Poly[]; groups: Group[]; edges: Edge[] }

// ---------- small vector helpers ----------
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(...a);
const unit = (a: V3) => mul(a, 1 / (len(a) || 1));
const mean = (ps: V3[]): V3 => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
const dist2 = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Signed area of a polygon in the plane (> 0 when it turns anticlockwise). */
export const shoelace = (p: V2[]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
/** Area of a planar polygon in space. */
export const polyArea = (p: V3[]) => len(p.reduce((s, a, i) => add(s, cross(a, p[(i + 1) % p.length])), [0, 0, 0] as V3)) / 2;
/** Newell normal of a planar polygon (its length is twice the area). */
const newell = (p: V3[]) => unit(p.reduce((s, a, i) => add(s, cross(a, p[(i + 1) % p.length])), [0, 0, 0] as V3));

/** Name of a flat polygonal face. */
export function shapeOf(p: V3[]): Shape {
  if (p.length === 3) return 'triangle';
  if (p.length === 4) {
    const s = p.map((a, i) => sub(p[(i + 1) % 4], a));
    const right = s.every((a, i) => Math.abs(dot(a, s[(i + 1) % 4])) < 1e-6 * dot(a, a) + 1e-9);
    return !right ? 'quadrilateral' : Math.abs(len(s[0]) - len(s[1])) < 1e-6 ? 'square' : 'rectangle';
  }
  return p.length === 5 ? 'pentagon' : p.length === 6 ? 'hexagon' : 'polygon';
}

/** The base polygon of a prism, pyramid, cylinder or cone, anticlockwise from above. */
export function baseOf(s: SolidSpec): V2[] {
  if (s.kind === 'cylinder' || s.kind === 'cone') {
    const n = s.segments ?? 32, r = s.r ?? 1;
    return Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)] as V2);
  }
  if (s.kind === 'cuboid' || s.kind === 'cube') {
    const [l, w] = s.kind === 'cube' ? [s.a ?? 1, s.a ?? 1] : s.size ?? [1, 1, 1];
    return [[0, 0], [l, 0], [l, w], [0, w]];
  }
  const b = s.base ?? [[0, 0], [1, 0], [0, 1]];
  return shoelace(b) < 0 ? [...b].reverse() : b;
}
/** Height (length along the axis). */
export const heightOf = (s: SolidSpec) => (s.kind === 'cube' ? s.a ?? 1 : s.kind === 'cuboid' ? (s.size ?? [1, 1, 1])[2] : s.h ?? 1);
const round = (s: SolidSpec) => s.kind === 'cylinder' || s.kind === 'cone';
const prismLike = (s: SolidSpec) => ['prism', 'cuboid', 'cube', 'cylinder'].includes(s.kind);

// ---------- meshes ----------
interface Raw { polys: Poly[]; groups: Group[] }

/** Polygon faces with outward normals (pointing away from `c`, or as built when `c` is null). */
function face(r: Raw, pts: V3[], g: number, c: V3 | null) {
  let n = newell(pts);
  if (c && dot(n, sub(mean(pts), c)) < 0) { pts = [...pts].reverse(); n = mul(n, -1); }
  r.polys.push({ pts, g, n });
}

/** Prism-like solids and pyramids in local coordinates (base in uv, w up). */
function local(s: SolidSpec): Raw {
  const r: Raw = { polys: [], groups: [] };
  const B = baseOf(s), n = B.length, H = heightOf(s), bArea = shoelace(B);
  const lo = B.map(([u, v]) => [u, v, 0] as V3);
  if (prismLike(s)) {
    const hi = B.map(([u, v]) => [u, v, H] as V3), c = mean([...lo, ...hi]);
    const bshape: Shape = round(s) ? 'circle' : shapeOf(lo);
    r.groups.push({ role: 'base', shape: bshape, area: bArea }, { role: 'base', shape: bshape, area: bArea });
    face(r, lo, 0, c);
    face(r, hi, 1, c);
    if (round(s)) r.groups.push({ role: 'lateral', shape: 'curved', area: perimeterOf(B, s) * H });
    for (let i = 0; i < n; i++) {
      const q = [lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]];
      if (!round(s)) r.groups.push({ role: 'lateral', shape: shapeOf(q), area: polyArea(q) });
      face(r, q, round(s) ? 2 : 2 + i, c);
    }
    return r;
  }
  // pyramid / cone
  const a0 = s.apex ?? (round(s) ? [0, 0] : centroid(B));
  const A: V3 = [a0[0], a0[1], H], c = mean([...lo, A]);
  r.groups.push({ role: 'base', shape: round(s) ? 'circle' : shapeOf(lo), area: bArea });
  face(r, lo, 0, c);
  if (round(s)) r.groups.push({ role: 'lateral', shape: 'curved', area: Math.PI * (s.r ?? 1) * Math.hypot(s.r ?? 1, H) });
  for (let i = 0; i < n; i++) {
    const q = [lo[i], lo[(i + 1) % n], A];
    if (!round(s)) r.groups.push({ role: 'lateral', shape: 'triangle', area: polyArea(q) });
    face(r, q, round(s) ? 1 : 1 + i, c);
  }
  return r;
}
const centroid = (B: V2[]): V2 => {
  const a = shoelace(B);
  let x = 0, y = 0;
  B.forEach((p, i) => { const q = B[(i + 1) % B.length], k = p[0] * q[1] - q[0] * p[1]; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k; });
  return [x / (6 * a), y / (6 * a)];
};
const perimeterOf = (B: V2[], s: SolidSpec) => (round(s) ? 2 * Math.PI * (s.r ?? 1) : B.reduce((t, p, i) => t + dist2(p, B[(i + 1) % B.length]), 0));

function sphere(s: SolidSpec): Raw {
  const R = s.r ?? 1, n = s.segments ?? 16, m = n / 2, half = s.kind === 'hemisphere';
  const r: Raw = { polys: [], groups: [{ role: 'lateral', shape: 'curved', area: (half ? 2 : 4) * Math.PI * R * R }] };
  const P = (i: number, j: number): V3 => {
    const th = (2 * Math.PI * i) / n, ph = Math.PI / 2 - (Math.PI * j) / m;
    return [R * Math.cos(ph) * Math.cos(th), R * Math.cos(ph) * Math.sin(th), R * Math.sin(ph)];
  };
  for (let j = 0; j < (half ? m / 2 : m); j++)
    for (let i = 0; i < n; i++) {
      const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)].filter((p, k, a) => a.findIndex((x) => len(sub(x, p)) < 1e-9) === k);
      face(r, q, 0, [0, 0, 0]);
    }
  if (half) {
    r.groups.push({ role: 'base', shape: 'circle', area: Math.PI * R * R });
    face(r, Array.from({ length: n }, (_, i) => P(i, m / 2)), 1, [0, 0, R]);
  }
  return r;
}

/** Unit cubes: only the faces between a cube and empty space. */
function cubes(s: SolidSpec): Raw {
  const h = s.heights ?? [[1]], r: Raw = { polys: [], groups: [] };
  const at = (i: number, j: number, k: number) => k >= 0 && k < (h[j]?.[i] ?? 0);
  h.forEach((row, j) => row.forEach((v, i) => {
    for (let k = 0; k < v; k++) {
      const y = h.length - 1 - j; // row 0 at the back (+y)
      const C: V3 = [i + 0.5, y + 0.5, k + 0.5];
      for (const [d, [di, dj, dk]] of [[0, [1, 0, 0]], [0, [-1, 0, 0]], [1, [0, -1, 0]], [1, [0, 1, 0]], [2, [0, 0, 1]], [2, [0, 0, -1]]] as [number, V3][]) {
        if (at(i + di, j - dj, k + dk)) continue;
        const n: V3 = [di, dj, dk], e1: V3 = d === 0 ? [0, 1, 0] : [1, 0, 0], e2: V3 = d === 2 ? [0, 1, 0] : [0, 0, 1];
        const f = add(C, mul(n, 0.5));
        const q = [add(f, mul(add(e1, e2), -0.5)), add(f, mul(sub(e1, e2), 0.5)), add(f, mul(add(e1, e2), 0.5)), add(f, mul(sub(e2, e1), 0.5))];
        r.groups.push({ role: 'face', shape: 'square', area: 1 });
        face(r, q, r.groups.length - 1, C);
      }
    }
  }));
  return r;
}

function custom(s: SolidSpec): Raw {
  const V = s.vertices ?? [], r: Raw = { polys: [], groups: [] }, c = mean(V);
  (s.faces ?? []).forEach((f, i) => {
    const q = f.map((k) => V[k]);
    r.groups.push({ role: 'face', shape: shapeOf(q), area: polyArea(q) });
    face(r, q, i, c);
  });
  return r;
}

/** Local (u, v, w) → world (x, y, z): upright, or on its side with the axis along x. */
export const orient = (s: SolidSpec) => (p: V3): V3 => (s.lie ? [p[2], p[0], p[1]] : p);

/** Centre of the solid's bounding box in world coordinates, before centring. */
function boxCentre(ps: V3[]): V3 {
  const lo = [0, 1, 2].map((k) => Math.min(...ps.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...ps.map((p) => p[k])));
  return [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as V3;
}

/** World transform of a solid: orient, then centre on the origin. */
export function placer(s: SolidSpec, raw = build(s)): (p: V3) => V3 {
  const o = orient(s), c = boxCentre(raw.polys.flatMap((f) => f.pts).map(o));
  return (p) => sub(o(p), c);
}

function build(s: SolidSpec): Raw {
  return s.kind === 'sphere' || s.kind === 'hemisphere' ? sphere(s) : s.kind === 'cubes' ? cubes(s) : s.kind === 'mesh' ? custom(s) : local(s);
}

const key = (p: V3) => p.map((x) => x.toFixed(4)).join(',');

/** Edges shared by faces (or a face's border), with the faces on each side. */
export function edgesOf(polys: Poly[]): Edge[] {
  const m = new Map<string, Edge>();
  polys.forEach((f, i) => f.pts.forEach((a, k) => {
    const b = f.pts[(k + 1) % f.pts.length], ka = key(a), kb = key(b), id = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    const e = m.get(id);
    if (e) e.f.push(i);
    else m.set(id, { a, b, f: [i] });
  }));
  return [...m.values()];
}

/** The solid as faces in world coordinates, centred on the origin. */
export function meshOf(s: SolidSpec): Mesh {
  const raw = build(s), T = placer(s, raw), o = orient(s);
  const polys = raw.polys.map((f) => ({ pts: f.pts.map(T), g: f.g, n: o(f.n) }));
  return { polys, groups: raw.groups, edges: edgesOf(polys) };
}

/** True when an edge is drawn as a line: it joins two different faces (not two strips of one curved surface). */
export const hardEdge = (m: Mesh, e: Edge) => e.f.length < 2 || m.polys[e.f[0]].g !== m.polys[e.f[1]].g;

// ---------- measures ----------
export interface Measures {
  volume: number;
  /** Area of one base (prisms, cylinders, pyramids, cones, hemispheres). */
  base: number;
  lateral: number;
  total: number;
  /** Sum of the lengths of all the edges (the classic "volume = add the edges" slip). */
  edges: number;
}

/** Exact measures. `pi` replaces π in round solids (e.g. 3.14 as in the books). */
export function measuresOf(s: SolidSpec, pi = Math.PI): Measures {
  const r = s.r ?? 1, H = heightOf(s), k = s.kind;
  if (k === 'cylinder') return { volume: pi * r * r * H, base: pi * r * r, lateral: 2 * pi * r * H, total: 2 * pi * r * (r + H), edges: 4 * pi * r };
  if (k === 'cone') {
    const l = Math.hypot(r, H);
    return { volume: (pi * r * r * H) / 3, base: pi * r * r, lateral: pi * r * l, total: pi * r * (r + l), edges: 2 * pi * r };
  }
  if (k === 'sphere') return { volume: (4 / 3) * pi * r ** 3, base: 0, lateral: 4 * pi * r * r, total: 4 * pi * r * r, edges: 0 };
  if (k === 'hemisphere') return { volume: (2 / 3) * pi * r ** 3, base: pi * r * r, lateral: 2 * pi * r * r, total: 3 * pi * r * r, edges: 2 * pi * r };
  const m = meshOf(s), base = prismLike(s) || k === 'pyramid' ? shoelace(baseOf(s)) : 0;
  const total = m.groups.reduce((t, g) => t + g.area, 0);
  const lateral = m.groups.filter((g) => g.role === 'lateral').reduce((t, g) => t + g.area, 0);
  const edges = m.edges.filter((e) => hardEdge(m, e)).reduce((t, e) => t + len(sub(e.a, e.b)), 0);
  const volume = prismLike(s) ? base * H : k === 'pyramid' ? (base * H) / 3 : k === 'cubes' ? (s.heights ?? []).flat().reduce((t, v) => t + v, 0) : meshVolume(m.polys);
  return { volume, base, lateral: k === 'cubes' || k === 'mesh' ? total : lateral, total, edges };
}

/** Volume of a closed mesh with outward faces (divergence theorem). */
export function meshVolume(polys: Poly[]): number {
  let v = 0;
  for (const { pts } of polys) for (let i = 1; i + 1 < pts.length; i++) v += dot(pts[0], cross(pts[i], pts[i + 1])) / 6;
  return Math.abs(v);
}

// ---------- unfolding (prisms and cylinders) ----------
const rot2 = ([x, y]: V2, a: number): V2 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const turnAt = (B: V2[], i: number) => {
  const n = B.length, p = B[(i - 1 + n) % n], q = B[i], r = B[(i + 1) % n];
  return Math.atan2(r[1] - q[1], r[0] - q[0]) - Math.atan2(q[1] - p[1], q[0] - p[0]);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The faces of a prism or cylinder unfolded by t (0 = closed, 1 = a flat net), in world coordinates. The side
 * faces unroll left and right from the `anchor` side face, which stays still; the two bases swing out on its
 * bottom and top edges. The flat net lies in the anchor face's plane (a cuboid gives the cross-shaped net, a
 * cylinder a 2πr × h rectangle with a circle above and below). Returns null for other solids.
 */
export function unfold(s: SolidSpec, t: number, anchor = 0): Poly[] | null {
  if (!prismLike(s)) return null;
  const B = baseOf(s), n = B.length, H = heightOf(s), T = placer(s), g0 = round(s) ? 2 : -1;
  const idx = (k: number) => (((anchor + k) % n) + n) % n;
  const edge = (i: number) => { const p = B[i], q = B[(i + 1) % n]; return { L: dist2(p, q), ang: Math.atan2(q[1] - p[1], q[0] - p[0]) }; };
  // side faces anchor+1 … anchor+f unroll forward, anchor−1 … anchor−b backward; the turn at each corner shrinks to 0
  const f = Math.ceil((n - 1) / 2), b = n - 1 - f;
  const P: Record<number, V2> = { 0: B[idx(0)] }, ang: Record<number, number> = { 0: edge(idx(0)).ang };
  for (let k = 0; k <= f; k++) {
    if (k) ang[k] = ang[k - 1] + wrap(turnAt(B, idx(k))) * (1 - t);
    const L = edge(idx(k)).L;
    P[k + 1] = [P[k][0] + L * Math.cos(ang[k]), P[k][1] + L * Math.sin(ang[k])];
  }
  for (let k = -1; k >= -b; k--) {
    ang[k] = ang[k + 1] - wrap(turnAt(B, idx(k + 1))) * (1 - t);
    const L = edge(idx(k)).L;
    P[k] = [P[k + 1][0] - L * Math.cos(ang[k]), P[k + 1][1] - L * Math.sin(ang[k])];
  }
  const out: Poly[] = [];
  const put = (pts: V3[], g: number) => { const w = pts.map(T); out.push({ pts: w, g, n: newell(w) }); };
  for (let k = -b; k <= f; k++) {
    const p = P[k], q = P[k + 1];
    put([[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], H], [p[0], p[1], H]], g0 >= 0 ? g0 : 2 + idx(k));
  }
  // the bases swing out about the anchor's bottom and top edges (bottom listed clockwise so it faces outwards)
  const a = B[idx(0)], e: V3 = [Math.cos(ang[0]), Math.sin(ang[0]), 0], inward: V3 = [-e[1], e[0], 0], th = (Math.PI / 2) * t;
  for (const [g, w, up] of [[0, 0, -1], [1, H, 1]] as [number, number, number][]) {
    const pts = B.map(([u, v]): V3 => {
      const d: V3 = [u - a[0], v - a[1], 0], along = dot(d, e), across = dot(d, inward);
      return add([a[0], a[1], w], add(mul(e, along), mul(add(mul(inward, Math.cos(th)), [0, 0, up * Math.sin(th)]), across)));
    });
    put(up < 0 ? pts.reverse() : pts, g);
  }
  return out;
}

/** Outward normal (world) of the side face an unfolding is anchored on: the flat net faces this way. */
export function anchorNormal(s: SolidSpec, anchor = 0): V3 {
  const B = baseOf(s), p = B[anchor % B.length], q = B[(anchor + 1) % B.length], e = unit([q[0] - p[0], q[1] - p[1], 0]);
  return orient(s)([e[1], -e[0], 0]);
}

// ---------- fill: layers of the base ----------
/** Number of layers of thickness `step` that fill the solid along its axis. */
export const layerCount = (s: SolidSpec, step = 1) => Math.round(heightOf(s) / step);

/** Layer k (0 = the bottom base) of a prism or cylinder: a thin prism of the base, as faces in world coordinates. */
export function layer(s: SolidSpec, k: number, step = 1): Mesh {
  const B = baseOf(s), T = placer(s), o = orient(s), H = heightOf(s), z0 = k * step, z1 = Math.min(H, z0 + step);
  const lo = B.map(([u, v]) => [u, v, z0] as V3), hi = B.map(([u, v]) => [u, v, z1] as V3), c = mean([...lo, ...hi]);
  const r: Raw = { polys: [], groups: [] };
  face(r, lo, 0, c);
  face(r, hi, 1, c);
  B.forEach((_, i) => face(r, [lo[i], lo[(i + 1) % B.length], hi[(i + 1) % B.length], hi[i]], round(s) ? 2 : 2 + i, c));
  const polys = r.polys.map((f) => ({ pts: f.pts.map(T), g: f.g, n: o(f.n) }));
  return { polys, groups: [], edges: edgesOf(polys) };
}

// ---------- dimension labels ----------
export interface Dim {
  /** Where the label can go: equal segments [a, b, c] in world coordinates, with c the point the label moves away from. */
  segs: [V3, V3, V3][];
  value: number;
  /** Draw the segment itself (a radius). */
  line?: boolean;
  /** near: the candidate closest to the viewer; out: the one furthest from the middle of the picture. */
  pick: 'near' | 'out';
}

/** Lengths worth writing on the picture: base edges (prisms), radius (round solids) and height. */
export function dimsOf(s: SolidSpec): Dim[] {
  if (!prismLike(s) && s.kind !== 'pyramid' && s.kind !== 'cone') return [];
  const B = baseOf(s), H = heightOf(s), T = placer(s), n = B.length, top = prismLike(s), c = centroid(B);
  const at = ([u, v]: V2, w: number) => T([u, v, w]), mid = at(c, H / 2);
  const d: Dim[] = [];
  if (round(s)) d.push({ segs: (top ? [H, 0] : [0]).map((w) => [T([0, 0, w]), at(B[0], w), mid] as [V3, V3, V3]), value: s.r ?? 1, line: true, pick: 'near' });
  else {
    const seen = new Set<string>();
    B.forEach((p, i) => {
      const q = B[(i + 1) % n], L = dist2(p, q), k = L.toFixed(6);
      // a regular base needs its length only once; a cuboid's length and width once each
      if (seen.has(k) && (s.kind === 'cube' || s.kind === 'cuboid' || isRegular(B))) return;
      seen.add(k);
      d.push({ segs: (top ? [0, H] : [0]).map((w) => [at(p, w), at(q, w), at(c, w)] as [V3, V3, V3]), value: L, pick: 'near' });
    });
  }
  if (top) d.push({ segs: B.filter((_, i) => !round(s) || i % 4 === 0).map((p) => [at(p, 0), at(p, H), mid] as [V3, V3, V3]), value: H, pick: 'out' });
  return d;
}
const isRegular = (B: V2[]) => B.every((p, i) => Math.abs(dist2(p, B[(i + 1) % B.length]) - dist2(B[0], B[1])) < 1e-6);

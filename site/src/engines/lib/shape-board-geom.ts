// Pure plane geometry for <kg-shape-board> and its check (docs/STUDIOS.md). Points are [x, y] in board units,
// y up (as on a coordinate grid). Exact on grid points; a small tolerance covers circles and regular polygons.

export type P = [number, number];
export type Seg = [P, P];

export const EPS = 1e-6;
export const near = (a: number, b: number, tol = EPS) => Math.abs(a - b) <= tol;
export const samePt = (a: P, b: P) => near(a[0], b[0]) && near(a[1], b[1]);
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
/** z of (a − o) × (b − o): > 0 when o → a → b turns anticlockwise. */
export const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const dot = (u: P, v: P) => u[0] * v[0] + u[1] * v[1];
export const dist2 = (a: P, b: P) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
export const dist = (a: P, b: P) => Math.sqrt(dist2(a, b));
const rel = (a: number, b: number) => near(a, b, EPS * Math.max(1, Math.abs(a), Math.abs(b)));

/** Drop repeated points and vertices that sit on a straight side (a tap in the middle of a side is not a corner). */
export function clean(pts: P[], closed = true): P[] {
  let p = pts.filter((q, i) => i === 0 || !samePt(q, pts[i - 1]));
  if (closed && p.length > 1 && samePt(p[0], p[p.length - 1])) p.pop();
  for (let changed = true; changed && p.length > 2; ) {
    changed = false;
    const n = p.length;
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n];
      // collinear and b between a and c (a spike that doubles back is kept: it is not a straight side)
      if (near(cross(a, b, c), 0) && dot(sub(a, b), sub(c, b)) < 0) {
        p = p.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return p;
}

export const signedArea = (p: P[]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
/** Shoelace area. */
export const area = (p: P[]) => Math.abs(signedArea(p));
export const sides = (p: P[], closed = true) => (closed ? p : p.slice(0, -1)).map((a, i) => dist(a, p[(i + 1) % p.length]));
export const perimeter = (p: P[], closed = true) => sides(p, closed).reduce((s, x) => s + x, 0);
export const edges = (p: P[], closed = true): Seg[] => (closed ? p : p.slice(0, -1)).map((a, i) => [a, p[(i + 1) % p.length]]);

/** The angle a–v–b between two arms, 0..180 degrees. */
export function angleAt(a: P, v: P, b: P): number {
  const u = sub(a, v), w = sub(b, v);
  return (Math.atan2(Math.abs(u[0] * w[1] - u[1] * w[0]), dot(u, w)) * 180) / Math.PI;
}

/** Interior angle at every vertex of a simple polygon (over 180 at a dent). */
export function angles(p: P[]): number[] {
  const s = Math.sign(signedArea(p)) || 1;
  return p.map((v, i) => {
    const a = p[(i + p.length - 1) % p.length], b = p[(i + 1) % p.length];
    const t = angleAt(a, v, b);
    return s * cross(a, v, b) < -EPS ? 360 - t : t;
  });
}

export type AngleKind = 'zero' | 'acute' | 'right' | 'obtuse' | 'straight' | 'reflex';
export function angleKind(deg: number): AngleKind {
  if (near(deg, 0, 1e-4)) return 'zero';
  if (near(deg, 90, 1e-4)) return 'right';
  if (near(deg, 180, 1e-4)) return 'straight';
  return deg < 90 ? 'acute' : deg < 180 ? 'obtuse' : 'reflex';
}

export const parallel = (a: Seg, b: Seg) => near(cross([0, 0], sub(a[1], a[0]), sub(b[1], b[0])), 0, 1e-6 * dist(...a) * dist(...b));
export const perpendicular = (a: Seg, b: Seg) => near(dot(sub(a[1], a[0]), sub(b[1], b[0])), 0, 1e-6 * dist(...a) * dist(...b));
/** p lies on the infinite line through l. */
export const onLine = (p: P, l: Seg) => near(cross(l[0], l[1], p), 0, 1e-6 * dist(...l));
/** Two segments cross or touch, other than at a shared end. */
function segsMeet(a: Seg, b: Seg) {
  const d1 = cross(b[0], b[1], a[0]), d2 = cross(b[0], b[1], a[1]), d3 = cross(a[0], a[1], b[0]), d4 = cross(a[0], a[1], b[1]);
  if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true;
  const on = (p: P, s: Seg) => near(cross(s[0], s[1], p), 0) && dot(sub(s[0], p), sub(s[1], p)) < -EPS;
  return on(a[0], b) || on(a[1], b) || on(b[0], a) || on(b[1], a);
}
export function selfIntersecting(p: P[]): boolean {
  const e = edges(p);
  for (let i = 0; i < e.length; i++)
    for (let j = i + 1; j < e.length; j++) {
      const first = i === 0 && j === e.length - 1;
      if (j === i + 1 || first) {
        // neighbours share a corner v: they overlap only if the second doubles back along the first
        const [a, v, b] = first ? [e[0][1], e[0][0], e[j][0]] : [e[i][0], e[i][1], e[j][1]];
        if (near(cross(v, a, b), 0) && dot(sub(a, v), sub(b, v)) > EPS) return true;
      } else if (segsMeet(e[i], e[j])) return true;
    }
  return false;
}
export function convex(p: P[]): boolean {
  const s = p.map((v, i) => Math.sign(Math.round(cross(p[(i + p.length - 1) % p.length], v, p[(i + 1) % p.length]) * 1e6)));
  return s.every((x) => x >= 0) || s.every((x) => x <= 0);
}

export const NAMES = ['', '', '', 'triangle', 'quadrilateral', 'pentagon', 'hexagon', 'heptagon', 'octagon'];

/**
 * Every class a closed shape belongs to, inclusive (a square is also a rectangle, rhombus, parallelogram,
 * trapezium and kite). Triangles: equilateral/isosceles/scalene and right-/acute-/obtuse-angled.
 * Also: polygon, the n-gon name, regular, convex/concave, rectilinear. Crossed shapes give ['crossed'];
 * fewer than 3 corners give ['open'].
 */
export function classify(raw: P[]): string[] {
  const p = clean(raw);
  if (p.length < 3) return ['open'];
  if (selfIntersecting(p)) return ['crossed'];
  const n = p.length, s = sides(p), a = angles(p), out = ['polygon', convex(p) ? 'convex' : 'concave'];
  if (NAMES[n]) out.push(NAMES[n]);
  const allEq = (v: number[]) => v.every((x) => rel(x, v[0]));
  if (allEq(s) && allEq(a)) out.push('regular');
  if (edges(p).every(([u, v]) => near(u[0], v[0]) || near(u[1], v[1]))) out.push('rectilinear');
  if (n === 3) {
    const [x, y, z] = [...s].sort((m, k) => m - k);
    out.push(rel(x, z) ? 'equilateral' : '', rel(x, y) || rel(y, z) ? 'isosceles' : 'scalene');
    const d = x * x + y * y - z * z;
    out.push(near(d, 0, 1e-6 * z * z) ? 'right-angled' : d > 0 ? 'acute-angled' : 'obtuse-angled');
  }
  if (n === 4) {
    const e = edges(p), p1 = parallel(e[0], e[2]), p2 = parallel(e[1], e[3]);
    const right = a.every((x) => near(x, 90, 1e-4)), rhombus = allEq(s);
    if (convex(p)) {
      if (p1 || p2) out.push('trapezium');
      if (p1 && p2) out.push('parallelogram');
      if (right) out.push('rectangle');
      if (rhombus) out.push('rhombus');
      if (right && rhombus) out.push('square');
    }
    if ((rel(s[0], s[1]) && rel(s[2], s[3])) || (rel(s[1], s[2]) && rel(s[3], s[0]))) out.push('kite');
  }
  return out.filter(Boolean);
}

// ---------- transformations ----------
export const translate = (p: P, d: P): P => [p[0] + d[0], p[1] + d[1]];
export function reflect(p: P, l: Seg): P {
  const [a, b] = l, d = sub(b, a), t = dot(sub(p, a), d) / dot(d, d);
  const f: P = [a[0] + t * d[0], a[1] + t * d[1]];
  return [2 * f[0] - p[0], 2 * f[1] - p[1]];
}
/** Rotate anticlockwise by deg about c (exact for multiples of 90). */
export function rotate(p: P, c: P, deg: number): P {
  const q = ((deg % 360) + 360) % 360, [x, y] = sub(p, c);
  const [cs, sn] = q % 90 === 0 ? [[1, 0], [0, 1], [-1, 0], [0, -1]][q / 90] : [Math.cos((q * Math.PI) / 180), Math.sin((q * Math.PI) / 180)];
  return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
}
export const scale = (p: P, c: P, k: number): P => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k];

// ---------- comparing drawings as sets of lines ----------
const r6 = (x: number) => (Math.round(x * 1e5) / 1e5 || 0).toFixed(5);

/** Join collinear overlapping or touching pieces, so a drawing compares equal however it was tapped. */
export function mergeSegments(segs: Seg[]): Seg[] {
  const groups = new Map<string, { d: P; o: number; iv: [number, number][] }>();
  for (const [a, b] of segs) {
    if (samePt(a, b)) continue;
    let d = sub(b, a);
    const len = Math.hypot(...d);
    d = [d[0] / len, d[1] / len];
    if (d[0] < -EPS || (near(d[0], 0) && d[1] < 0)) d = [-d[0], -d[1]];
    const o = d[0] * a[1] - d[1] * a[0]; // signed distance from the origin
    const k = r6(d[0]) + ',' + r6(d[1]) + ',' + r6(o);
    const g = groups.get(k) ?? { d, o, iv: [] };
    const t1 = dot(a, d), t2 = dot(b, d);
    g.iv.push([Math.min(t1, t2), Math.max(t1, t2)]);
    groups.set(k, g);
  }
  const out: Seg[] = [];
  for (const { d, o, iv } of groups.values()) {
    iv.sort((x, y) => x[0] - y[0]);
    const at = (t: number): P => [t * d[0] - o * d[1], t * d[1] + o * d[0]];
    let [s, e] = iv[0];
    for (const [s2, e2] of iv.slice(1)) {
      if (s2 <= e + EPS) e = Math.max(e, e2);
      else { out.push([at(s), at(e)]); [s, e] = [s2, e2]; }
    }
    out.push([at(s), at(e)]);
  }
  return out;
}
const segKeys = (segs: Seg[]) =>
  mergeSegments(segs).map((s) => s.map((p) => r6(p[0]) + ' ' + r6(p[1])).sort().join('|')).sort();
/** The two drawings cover exactly the same lines. */
export function sameDrawing(a: Seg[], b: Seg[]): boolean {
  const x = segKeys(a), y = segKeys(b);
  return x.length === y.length && x.every((k, i) => k === y[i]);
}
export const mapSegs = (segs: Seg[], f: (p: P) => P): Seg[] => segs.map(([a, b]) => [f(a), f(b)]);
/** The drawing is its own mirror image in the line l. */
export const symmetricIn = (segs: Seg[], l: Seg) => sameDrawing(segs, mapSegs(segs, (p) => reflect(p, l)));

/** Every line of symmetry of a polygon (as two points on it). */
export function symmetryLines(raw: P[]): Seg[] {
  const p = clean(raw), n = p.length, e = edges(p), out: Seg[] = [];
  const marks = [...p, ...e.map(([a, b]): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])];
  for (let i = 0; i < marks.length; i++)
    for (let j = i + 1; j < marks.length; j++) {
      const l: Seg = [marks[i], marks[j]];
      if (samePt(...l) || out.some((m) => onLine(l[0], m) && onLine(l[1], m))) continue;
      if (symmetricIn(e, l)) out.push(l);
    }
  return n ? out : [];
}

/** Order of rotational symmetry about the centroid of the vertices (1 = none). */
export function rotationOrder(raw: P[]): number {
  const p = clean(raw), e = edges(p), c: P = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  let k = 0;
  for (let m = 1; m <= p.length; m++) if (sameDrawing(e, mapSegs(e, (q) => rotate(q, c, (360 * m) / p.length)))) k++;
  return Math.max(1, k);
}

/** Scale factor k when b is a scaled copy of a (turned or flipped allowed), else null. */
export function similarity(a: P[], b: P[]): number | null {
  const x = clean(a), y = clean(b), n = x.length;
  if (n < 3 || y.length !== n) return null;
  const sx = sides(x), ax = angles(x);
  for (const rev of [false, true]) {
    const z = rev ? [...y].reverse() : y;
    const sz = sides(z), az = angles(z);
    for (let s = 0; s < n; s++) {
      const k = sz[s] / sx[0];
      let ok = true;
      for (let i = 0; i < n && ok; i++) ok = rel(sz[(s + i) % n], sx[i] * k) && near(az[(s + i) % n], ax[i], 1e-4);
      if (ok) return k;
    }
  }
  return null;
}

// ---------- inside, covering ----------
export function inside(q: P, p: P[]): boolean {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (p[i][1] > q[1] !== p[j][1] > q[1] && q[0] < ((p[j][0] - p[i][0]) * (q[1] - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}
/**
 * The pieces exactly cover the target, with no overlap and nothing sticking out. Tested at sample points
 * (offset so they never fall on grid lines or the usual diagonals).
 */
export function covers(pieces: P[][], target: P[]): boolean {
  const all = [target, ...pieces].flat(), xs = all.map((q) => q[0]), ys = all.map((q) => q[1]);
  for (let x = Math.min(...xs) + 0.0917; x < Math.max(...xs); x += 0.2113)
    for (let y = Math.min(...ys) + 0.0731; y < Math.max(...ys); y += 0.1877) {
      const hits = pieces.filter((pc) => inside([x, y], pc)).length;
      if (hits !== (inside([x, y], target) ? 1 : 0)) return false;
    }
  return true;
}

/** Unit cells [x, y] (lower-left corners) fold into a cube: six squares, joined edge to edge, every face once. */
export function cubeNet(cells: P[]): boolean {
  const key = (c: P) => c.join(',');
  const set = new Map(cells.map((c) => [key(c), c]));
  if (cells.length !== 6 || set.size !== 6) return false;
  // die faces [top, bottom, north, south, east, west]; rolling onto a neighbour swaps four of them
  const roll: Record<string, [number[], P]> = { e: [[5, 4, 2, 3, 0, 1], [1, 0]], w: [[4, 5, 2, 3, 1, 0], [-1, 0]], n: [[3, 2, 0, 1, 4, 5], [0, 1]], s: [[2, 3, 1, 0, 4, 5], [0, -1]] };
  const seen = new Map<string, number[]>([[key(cells[0]), [0, 1, 2, 3, 4, 5]]]);
  const queue = [cells[0]];
  while (queue.length) {
    const c = queue.shift()!, o = seen.get(key(c))!;
    for (const [perm, d] of Object.values(roll)) {
      const nb: P = [c[0] + d[0], c[1] + d[1]];
      if (!set.has(key(nb)) || seen.has(key(nb))) continue;
      seen.set(key(nb), perm.map((i) => o[i]));
      queue.push(nb);
    }
  }
  return seen.size === 6 && new Set([...seen.values()].map((o) => o[1])).size === 6;
}

// ---------- intersections (compass constructions) ----------
export type Circle = [number, number, number];
export function lineLine(a: Seg, b: Seg): P | null {
  const d = cross([0, 0], sub(a[1], a[0]), sub(b[1], b[0]));
  if (near(d, 0)) return null;
  const t = cross([0, 0], sub(b[0], a[0]), sub(b[1], b[0])) / d;
  return [a[0][0] + t * (a[1][0] - a[0][0]), a[0][1] + t * (a[1][1] - a[0][1])];
}
export function circleCircle([x1, y1, r1]: Circle, [x2, y2, r2]: Circle): P[] {
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d < EPS || d > r1 + r2 + EPS || d < Math.abs(r1 - r2) - EPS) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = x1 + (a * (x2 - x1)) / d, my = y1 + (a * (y2 - y1)) / d;
  const pts: P[] = [[mx + (h * (y2 - y1)) / d, my - (h * (x2 - x1)) / d], [mx - (h * (y2 - y1)) / d, my + (h * (x2 - x1)) / d]];
  return h < EPS ? [pts[0]] : pts;
}
export function lineCircle([a, b]: Seg, [cx, cy, r]: Circle): P[] {
  const d = sub(b, a), f = sub(a, [cx, cy]), A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - r * r, D = B * B - 4 * A * C;
  if (D < -EPS) return [];
  const s = Math.sqrt(Math.max(0, D));
  return (s < EPS ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)]).map((t): P => [a[0] + t * d[0], a[1] + t * d[1]]);
}

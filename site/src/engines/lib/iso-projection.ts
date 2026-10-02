// Projection helpers shared by the 3D views: shape-board/iso.ts (unit cubes on isometric dot paper) and
// <kg-solid-viewer> (solids the learner turns). Pure, so they are unit-tested (iso-projection.test.ts).
//   isometric  the fixed view of isometric dot paper: x runs down-right, y down-left, z straight up (unscaled).
//   orbit      an orthographic view from any direction: turn `yaw` about the vertical axis, then tilt `pitch`
//              (degrees; pitch > 0 looks down from above). z is up; the viewer starts in front, at −y.

export type V3 = [number, number, number];
export type V2 = [number, number];

/** Isometric dot-paper scale: one unit is S long; its x and y steps go CX across and CY down. */
export const ISO_S = 30;
export const ISO_CX = 0.866 * ISO_S;
export const ISO_CY = 0.5 * ISO_S;

/** Screen point of lattice point (i, j, k) on isometric paper (i along x, j along y, k up). */
export function isoPoint(i: number, j: number, k: number): V2 {
  return [(i - j) * ISO_CX, (i + j) * ISO_CY - k * ISO_S];
}
/** The same, as an SVG "x,y" pair with one decimal. */
export const isoXY = (i: number, j: number, k: number) => isoPoint(i, j, k).map((v) => v.toFixed(1)).join(',');

/** Unit cubes of a plan of stacks (rows of columns, row 0 at the back), in drawing order: back to front, bottom up. */
export function isoCubes(h: number[][]): V3[] {
  const cubes: V3[] = [];
  h.forEach((row, j) => row.forEach((v, i) => { for (let k = 0; k < v; k++) cubes.push([i, j, k]); }));
  return cubes.sort((a, b) => a[0] + a[1] - b[0] - b[1] || a[2] - b[2]);
}

/** The three faces of cube (i, j, k) that isometric paper shows: top, right (+x side), left (+y side). */
export function isoCubeFaces([i, j, k]: V3): Record<'top' | 'right' | 'left', V3[]> {
  return {
    top: [[i, j, k + 1], [i + 1, j, k + 1], [i + 1, j + 1, k + 1], [i, j + 1, k + 1]],
    right: [[i + 1, j, k], [i + 1, j + 1, k], [i + 1, j + 1, k + 1], [i + 1, j, k + 1]],
    left: [[i, j + 1, k], [i + 1, j + 1, k], [i + 1, j + 1, k + 1], [i, j + 1, k + 1]],
  };
}

/** Box shape [length, width, height] when the stacks make one full cuboid, else null. */
export function boxOf(h: number[][]): [number, number, number] | null {
  const cells = h.flatMap((row, r) => row.map((v, c) => [r, c, v])).filter((x) => x[2] > 0);
  if (!cells.length) return null;
  const rs = cells.map((x) => x[0]), cs = cells.map((x) => x[1]), w = Math.max(...rs) - Math.min(...rs) + 1, l = Math.max(...cs) - Math.min(...cs) + 1;
  return cells.length === w * l && cells.every((x) => x[2] === cells[0][2]) ? [l, w, cells[0][2]] : null;
}

export interface Orbit {
  /** Screen x (right), screen y (down) and depth (larger = further away) of a point. */
  (p: V3): V3;
  /** How much a face with outward normal n faces the viewer (> 0: seen). */
  facing(n: V3): number;
}

const RAD = Math.PI / 180;

/** Orthographic view turned `yaw`° about z (the solid turns anticlockwise seen from above), tilted `pitch`° down. */
export function orbit(yaw: number, pitch: number): Orbit {
  const cy = Math.cos(yaw * RAD), sy = Math.sin(yaw * RAD), cp = Math.cos(pitch * RAD), sp = Math.sin(pitch * RAD);
  const turn = ([x, y, z]: V3): V3 => [x * cy - y * sy, x * sy + y * cy, z];
  const f = ((p: V3): V3 => {
    const [x, y, z] = turn(p);
    return [x, -(y * sp + z * cp), y * cp - z * sp];
  }) as Orbit;
  f.facing = (n) => {
    const [, y, z] = turn(n);
    return -(y * cp - z * sp);
  };
  return f;
}

/**
 * Isometric dot paper is this orbit seen at yaw −45°, pitch atan(1/√2) ≈ 35.26°, with the paper's j axis
 * pointing along −y and everything scaled by ISO_S·√1.5 (tested in iso-projection.test.ts).
 */
export const ISO_YAW = -45;
export const ISO_PITCH = Math.atan(Math.SQRT1_2) / RAD;

import { describe, expect, it } from 'vitest';
import { boxOf, ISO_CX, ISO_CY, ISO_PITCH, ISO_S, ISO_YAW, isoCubeFaces, isoCubes, isoPoint, isoXY, orbit, type V3 } from './iso-projection';

describe('isometric dot paper', () => {
  it('x runs down-right, y down-left, z straight up', () => {
    expect(isoPoint(0, 0, 0)).toEqual([0, 0]);
    expect(isoPoint(1, 0, 0)).toEqual([ISO_CX, ISO_CY]);
    expect(isoPoint(0, 1, 0)).toEqual([-ISO_CX, ISO_CY]);
    expect(isoPoint(0, 0, 1)).toEqual([0, -ISO_S]);
    expect(isoXY(1, 2, 3)).toBe('-26.0,-45.0');
  });
  it('cubes are listed back to front, bottom up', () => {
    expect(isoCubes([[2, 0], [0, 1]])).toEqual([[0, 0, 0], [0, 0, 1], [1, 1, 0]]);
    expect(isoCubes([[0]])).toEqual([]);
  });
  it('three faces of a cube: top, +x side, +y side', () => {
    const f = isoCubeFaces([0, 0, 0]);
    expect(Object.keys(f)).toEqual(['top', 'right', 'left']);
    expect(f.top.every((p) => p[2] === 1)).toBe(true);
    expect(f.right.every((p) => p[0] === 1)).toBe(true);
    expect(f.left.every((p) => p[1] === 1)).toBe(true);
  });
  it('boxOf finds a full cuboid, else null', () => {
    expect(boxOf([[2, 2, 2], [2, 2, 2]])).toEqual([3, 2, 2]);
    expect(boxOf([[0, 0], [0, 1]])).toEqual([1, 1, 1]);
    expect(boxOf([[2, 1]])).toBeNull();
    expect(boxOf([[1, 0], [1, 1]])).toBeNull();
    expect(boxOf([[0]])).toBeNull();
  });
});

describe('orbit', () => {
  const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
  it('unturned: x right, z up, y away from the viewer', () => {
    const o = orbit(0, 0);
    close(o([1, 0, 0]), [1, 0, 0]);
    close(o([0, 0, 1]), [0, -1, 0]);
    close(o([0, 1, 0]), [0, 0, 1]);
    expect(o.facing([0, -1, 0])).toBeCloseTo(1);
    expect(o.facing([0, 1, 0])).toBeCloseTo(-1);
    expect(o.facing([0, 0, 1])).toBeCloseTo(0);
  });
  it('a 90° turn (anticlockwise from above) brings the left side (−x) to the front', () => {
    const o = orbit(90, 0);
    expect(o.facing([-1, 0, 0])).toBeCloseTo(1);
    close(o([0, 1, 0]), [-1, 0, 0]);
  });
  it('tilting down shows the top and hides the bottom', () => {
    const o = orbit(0, 30);
    expect(o.facing([0, 0, 1])).toBeCloseTo(0.5);
    expect(o.facing([0, 0, -1])).toBeCloseTo(-0.5);
    // the top is foreshortened, nearer points lower on screen
    expect(o([0, -1, 0])[1]).toBeGreaterThan(o([0, 1, 0])[1]);
    expect(o([0, -1, 0])[2]).toBeLessThan(o([0, 1, 0])[2]);
  });
  it('isometric paper is the orbit at yaw −45°, pitch 35.26° with j → −y, scaled by S·√1.5', () => {
    const o = orbit(ISO_YAW, ISO_PITCH), k = ISO_S * Math.sqrt(1.5);
    for (const [i, j, z] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [2, 3, 1]] as V3[]) {
      const [x, y] = o([i, -j, z]);
      const [ix, iy] = isoPoint(i, j, z);
      expect(x * k).toBeCloseTo(ix, 1);
      expect(y * k).toBeCloseTo(iy, 1);
    }
  });
});

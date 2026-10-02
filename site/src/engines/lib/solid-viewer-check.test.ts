import { describe, expect, it } from 'vitest';
import { checkSolid, misreadsFor, type SolidCheck, type SolidState } from './solid-viewer-check';
import type { SolidSpec } from './solid-viewer-geom';

const tri: SolidSpec = { kind: 'prism', base: [[0, 0], [4, 0], [0, 3]], h: 5 };
const box: SolidSpec = { kind: 'cuboid', size: [5, 3, 4] };
const can: SolidSpec = { kind: 'cylinder', r: 5, h: 10 };
const code = (c: Omit<SolidCheck, 'type'>, s: SolidState) => checkSolid({ type: 'solid', ...c }, s).code ?? 'ok';
const ans = (value: number | null, unit: string | null, misreads: [number, string][] = []): SolidState => ({ answer: { value, unit }, misreads });

describe('pick', () => {
  it('bases: a side face is the wrong base; one triangle is not both', () => {
    expect(code({ pick: 'bases' }, {})).toBe('pick-empty');
    expect(code({ pick: 'bases' }, { picked: [2], roles: ['lateral'], bases: 2 })).toBe('wrong-base');
    expect(code({ pick: 'bases' }, { picked: [0, 3], roles: ['base', 'lateral'], bases: 2 })).toBe('wrong-base');
    expect(code({ pick: 'bases' }, { picked: [0], roles: ['base'], bases: 2 })).toBe('one-base');
    expect(code({ pick: 'base' }, { picked: [0], roles: ['base'], bases: 2 })).toBe('ok');
    expect(code({ pick: 'bases' }, { picked: [0, 1], roles: ['base', 'base'], bases: 2 })).toBe('ok');
  });
  it('exact faces', () => {
    expect(code({ pick: [1, 2] }, { picked: [2, 1] })).toBe('ok');
    expect(code({ pick: [1, 2] }, { picked: [1] })).toBe('pick-few');
    expect(code({ pick: [1, 2] }, { picked: [1, 3] })).toBe('pick-wrong');
  });
});

describe('turned, unfolded, layers', () => {
  it('in order', () => {
    expect(code({ turned: true }, { turns: 0 })).toBe('not-turned');
    expect(code({ turned: true }, { turns: 2 })).toBe('ok');
    expect(code({ unfolded: true }, { unfolded: 0.5 })).toBe('not-unfolded');
    expect(code({ unfolded: true }, { unfolded: 1 })).toBe('ok');
    expect(code({ layers: 'full' }, { layers: 0, full: 5 })).toBe('layers-empty');
    expect(code({ layers: 'full' }, { layers: 3, full: 5 })).toBe('layers-few');
    expect(code({ layers: 2 }, { layers: 3, full: 5 })).toBe('layers-many');
    expect(code({ layers: 'full', volume: 30 }, { layers: 5, full: 5, answer: { value: 30, unit: null } })).toBe('ok');
    expect(code({ layers: 'full', volume: 30 }, { layers: 4, full: 5, answer: { value: 30, unit: null } })).toBe('layers-few');
  });
});

describe('typed answer with a unit', () => {
  const v: Omit<SolidCheck, 'type'> = { volume: 30, unit: 'cm3' };
  it('right value, right unit', () => {
    expect(code(v, ans(30, 'cm3'))).toBe('ok');
    expect(code({ ...v, tolerance: 0.5 }, ans(30.4, 'cm3'))).toBe('ok');
  });
  it('right value, wrong unit: squared for a volume, cubed for an area, no unit', () => {
    expect(code(v, ans(30, 'cm2'))).toBe('area-for-volume');
    expect(code({ area: 94, unit: 'cm2' }, ans(94, 'cm3'))).toBe('volume-for-area');
    expect(code(v, ans(30, 'cm'))).toBe('length-unit');
    expect(code(v, ans(30, null))).toBe('no-unit');
    expect(code(v, ans(30, 'm3'))).toBe('wrong-unit');
  });
  it('a slip beats the unit; a wrong unit beats too big / small', () => {
    expect(code(v, ans(60, 'cm3', [[60, 'no-half']]))).toBe('no-half');
    expect(code(v, ans(60, 'cm2', [[60, 'no-half']]))).toBe('no-half');
    expect(code({ ...v, traps: [{ value: 12, code: 'added' }] }, ans(12, 'cm3'))).toBe('added');
    expect(code(v, ans(31, 'cm2'))).toBe('area-for-volume');
    expect(code(v, ans(31, null))).toBe('too-big');
    expect(code(v, ans(29, 'cm3'))).toBe('too-small');
    expect(code(v, ans(null, 'cm3'))).toBe('empty');
  });
});

describe('misreads', () => {
  const codes = (m: [number, string][]) => Object.fromEntries(m.map(([v, c]) => [c, v]));
  it('volume of a triangular prism: one layer, no ½, surface, edges', () => {
    expect(codes(misreadsFor(tri, 'volume', Math.PI))).toEqual({ 'one-layer': 6, 'no-half': 60, 'surface-for-volume': 72, 'edges-sum': 39 });
    expect(codes(misreadsFor({ ...tri, lie: true }, 'volume', Math.PI))['wrong-base']).toBe(60);
  });
  it('surface area of a cuboid: the faces seen, sides only, volume', () => {
    const m = codes(misreadsFor(box, 'area', Math.PI, [47]));
    expect(m).toMatchObject({ 'visible-only': 47, 'lateral-only': 64, 'one-base': 79, 'volume-for-surface': 60, 'edges-sum': 48 });
  });
  it("a cylinder's side: πr²h, total, πrh, diameter for radius, π = 3", () => {
    const m = codes(misreadsFor(can, 'lateral', 3.14));
    expect(m['volume-for-surface']).toBeCloseTo(785);
    expect(m['total-for-lateral']).toBeCloseTo(471);
    expect(m['half-around']).toBeCloseTo(157);
    expect(m['diameter-for-radius']).toBeCloseTo(628);
    expect(m['pi-value']).toBeCloseTo(300);
  });
  it('cylinder volume: the area slips', () => {
    const m = codes(misreadsFor(can, 'volume', 3.14));
    expect(m['one-layer']).toBeCloseTo(78.5);
    expect(m['surface-for-volume']).toBeCloseTo(471);
    expect(m['diameter-for-radius']).toBeCloseTo(3140);
    expect(m['pi-value']).toBeCloseTo(750);
  });
  it('never lists the right answer', () => {
    const cube: SolidSpec = { kind: 'cube', a: 6 }; // volume 216 = total area 216
    expect(misreadsFor(cube, 'volume', Math.PI).some(([v]) => v === 216)).toBe(false);
  });
});

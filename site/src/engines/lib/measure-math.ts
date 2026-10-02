// Pure maths for <kg-measure>: units and conversion, scale ticks, snapping, ruler and protractor readings,
// balance tilt and dial angles. No DOM, so it is unit-tested (measure-math.test.ts).

/** Kind of quantity a unit measures; conversion only happens within one kind. */
export type Dim = 'len' | 'mass' | 'cap' | 'area' | 'temp';

/**
 * Units by id, as a size in the kind's base unit (mm, g, ml, mm²). Metric for every locale; the UK imperial units
 * (in, ft, yd, mile, oz, lb, st, pint, gal) are for the en-only extra studio (meas-extra-uk-units).
 */
export const UNITS: Record<string, [Dim, number]> = {
  mm: ['len', 1], cm: ['len', 10], dm: ['len', 100], m: ['len', 1000], km: ['len', 1e6],
  g: ['mass', 1], kg: ['mass', 1000], t: ['mass', 1e6],
  ml: ['cap', 1], l: ['cap', 1000],
  mm2: ['area', 1], cm2: ['area', 100], m2: ['area', 1e6], km2: ['area', 1e12],
  in: ['len', 25.4], ft: ['len', 304.8], yd: ['len', 914.4], mile: ['len', 1609344],
  oz: ['mass', 28.349523125], lb: ['mass', 453.59237], st: ['mass', 6350.29318],
  pint: ['cap', 568.26125], gal: ['cap', 4546.09],
  C: ['temp', 1],
};

/** Round away floating-point noise (0.1 + 0.2 → 0.3) without losing real decimals. */
export const tidy = (v: number) => Math.round(v * 1e9) / 1e9;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Convert v from one unit to another of the same kind, e.g. (3, 'm', 'cm') → 300. Throws across kinds. */
export function convert(v: number, from: string, to: string): number {
  const a = UNITS[from], b = UNITS[to];
  if (!a || !b || a[0] !== b[0]) throw new Error(`Cannot convert ${from} to ${to}`);
  return tidy((v * a[1]) / b[1]);
}

/**
 * Factors between neighbours on a conversion strip, e.g. ['km', 'm', 'cm', 'mm'] → [1000, 100, 10]:
 * one of the left unit is that many of the right one.
 */
export function stripFactors(units: string[]): number[] {
  return units.slice(1).map((u, i) => convert(1, units[i], u));
}

/** Snap v to the nearest multiple of step (counted from `from`), clamped to lo..hi. */
export function snapTo(v: number, step: number, lo: number, hi: number, from = 0): number {
  return clamp(tidy(from + Math.round((v - from) / step) * step), lo, hi);
}

export type TickKind = 'major' | 'mid' | 'minor';
export interface Tick { v: number; kind: TickKind }

/**
 * Ticks of a scale from min to max: a minor tick every `minor`, a labelled major tick every `major`, and a
 * mid tick halfway between majors when that falls on a minor tick (the 5 mm mark on a ruler).
 */
export function ticks(min: number, max: number, major: number, minor = major): Tick[] {
  const out: Tick[] = [];
  const n = Math.round((max - min) / minor);
  const on = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6;
  for (let i = 0; i <= n; i++) {
    const v = tidy(min + i * minor);
    out.push({ v, kind: on(v, major) ? 'major' : on(v, major / 2) && on(major / 2, minor) ? 'mid' : 'minor' });
  }
  return out;
}

/**
 * Ruler state from its position. `offset` is the ruler reading at the object's start (0 = lined up from zero,
 * 2 = the object starts at the 2 mark, -1 = the object starts before the 0 mark).
 * A learner who reads only the object's end gets offset + length: that is the "not from zero" misreading.
 */
export function rulerReading(offset: number, length: number) {
  const end = tidy(offset + length);
  return { aligned: Math.abs(offset) < 1e-9, end, misreads: offset ? [[end, 'not-from-zero'] as [number, string]] : [] };
}

/** Angle in degrees normalised to [0, 360). */
export const norm = (a: number) => tidy(((a % 360) + 360) % 360);

/** Direction from (cx, cy) to (x, y) in screen coordinates, in degrees counter-clockwise from the right (+x). */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  return norm((Math.atan2(cy - y, x - cx) * 180) / Math.PI);
}

/** The angle between two rays given by their directions, in 0..180. */
export function between(a: number, b: number): number {
  const d = norm(b - a);
  return d > 180 ? tidy(360 - d) : d;
}

/**
 * Protractor reading. The protractor's baseline points along `rot`; it covers rot..rot+180.
 * Returns the outer-scale number (0 at the rot end) and inner-scale number (180 − outer) at direction `dir`,
 * or null if that direction is behind the protractor.
 */
export function protractorReading(rot: number, dir: number): { outer: number; inner: number } | null {
  const outer = norm(dir - rot);
  return outer <= 180 ? { outer, inner: tidy(180 - outer) } : null;
}

/**
 * Reading an angle between two arms with a protractor rotated to `rot`. It is aligned when the baseline lies along
 * an arm (either way round). Aligned: reading the wrong one of the two scales gives 180 − angle ("other-scale").
 * Not aligned: whatever number the learner reads at an arm is wrong ("not-from-zero").
 */
export function angleReading(rot: number, arms: [number, number]) {
  const value = between(arms[0], arms[1]);
  const on = (a: number) => norm(rot - a) % 180 < 1e-6 || 180 - (norm(rot - a) % 180) < 1e-6;
  const aligned = on(arms[0]) || on(arms[1]);
  const misreads: [number, string][] = [];
  if (aligned) {
    if (value !== 90) misreads.push([tidy(180 - value), 'other-scale']);
  } else {
    for (const a of arms) {
      const r = protractorReading(rot, a);
      if (r) for (const v of [r.outer, r.inner]) if (Math.abs(v - value) > 1e-6) misreads.push([v, 'not-from-zero']);
    }
  }
  return { value, aligned, misreads };
}

/**
 * Snap a protractor rotation: within `magnet` degrees of an arm (or its opposite direction) it jumps onto it,
 * so lining up by touch is easy; otherwise it rounds to whole degrees.
 */
export function snapRotation(rot: number, arms: number[], magnet = 4): number {
  for (const a of arms) for (const t of [a, a + 180]) {
    const d = norm(rot - t);
    if (d <= magnet || 360 - d <= magnet) return norm(t);
  }
  return norm(Math.round(rot));
}

/** The furthest end of objects laid along a length tool, each starting at `at` (default 0). */
export function furthestEnd(objs: { length: number; at?: number }[]): number {
  return Math.max(...objs.map((o) => (o.at ?? 0) + o.length));
}

/** Height in px of one object's row on a length tool: 36, or a circle's diameter plus a margin. */
export function objectRow(kind: string | undefined, lengthPx: number): number {
  return kind === 'circle' ? Math.max(36, Math.ceil(lengthPx) + 12) : 36;
}

/** Balance beam tilt in degrees: positive when the right pan is heavier (goes down). Any difference shows. */
export function tilt(left: number, right: number, maxDeg = 14): number {
  const d = right - left;
  if (Math.abs(d) < 1e-9) return 0;
  const big = Math.max(Math.abs(left), Math.abs(right)) || 1;
  return Math.sign(d) * Math.min(maxDeg, 5 + (maxDeg - 5) * Math.min(1, Math.abs(d) / big));
}

/** Dial scale: clockwise angle from 12 o'clock for value v on a dial from 0 to max sweeping `sweep` degrees. */
export function dialAngle(v: number, max: number, sweep = 300): number {
  return -sweep / 2 + (sweep * clamp(v, 0, max)) / max;
}

/** Inverse of dialAngle for a pointer at clockwise angle `deg` from 12 o'clock (−180..180). */
export function dialValue(deg: number, max: number, sweep = 300): number {
  return clamp(((deg + sweep / 2) / sweep) * max, 0, max);
}

/** Text of a number with the locale's digits, decimal mark and a true minus sign (labels on scales; drawn LTR). */
export function numText(v: number, digits = '0123456789', mark = '.'): string {
  return String(tidy(v)).replace('-', '\u2212').replace('.', mark).replace(/[0-9]/g, (d) => digits[+d]);
}

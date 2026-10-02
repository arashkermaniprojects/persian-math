// Answer checking for <kg-solid-viewer> (check type `solid`, docs/STUDIOS.md), and the known slips the engine
// reports for the quantity asked (its `misreads`). Pure, so lib/checks.ts and the tests can use it.
import { measuresOf, type Measures, type SolidSpec } from './solid-viewer-geom';

export type Quantity = 'volume' | 'area' | 'lateral' | 'length';

export interface SolidCheck {
  type: 'solid';
  /** Faces to have picked: `base` = one or both bases, `bases` = both (prisms, cylinders), or face numbers. */
  pick?: 'base' | 'bases' | number[];
  /** The learner turned the solid at least once. */
  turned?: boolean;
  /** The net is fully open. */
  unfolded?: boolean;
  /** Layers in the fill mode: a number, or `full`. */
  layers?: number | 'full';
  /** The typed answer, in the unit the mission asks for (`unit`, e.g. cm3). Give one of these. */
  volume?: number;
  area?: number;
  lateral?: number;
  length?: number;
  unit?: string;
  /** ± accepted (default 0.01), e.g. 0.5 when π may be taken as 3.14 or 3.1416. */
  tolerance?: number;
  /** Known wrong numbers with their own feedback code (checked after the engine's own misreads). */
  traps?: { value: number; code: string }[];
}

export interface SolidState {
  kind?: string;
  turned?: [number, number];
  /** Times the learner turned it. */
  turns?: number;
  picked?: number[];
  /** Role of each picked face (base, lateral, face). */
  roles?: string[];
  /** Bases the solid has (2 for prisms and cylinders). */
  bases?: number;
  unfolded?: number;
  layers?: number;
  full?: number;
  answer?: { value: number | null; unit: string | null };
  misreads?: [number, string][];
  views?: unknown;
  section?: unknown;
}

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });
const dim = (u: string | null | undefined) => (u ? (/3$|³$/.test(u) ? 3 : /2$|²$/.test(u) ? 2 : 1) : 0);

/** Order: pick → turned → unfolded → layers → the typed answer (right value, right unit). */
export function checkSolid(c: SolidCheck, s: SolidState | undefined): Result {
  s = s ?? {};
  if (c.pick !== undefined) {
    const picked = s.picked ?? [], roles = s.roles ?? [];
    if (!picked.length) return fail('pick-empty');
    if (Array.isArray(c.pick)) {
      const want = [...c.pick].sort((a, b) => a - b).join();
      if ([...picked].sort((a, b) => a - b).join() !== want) return fail(picked.some((p) => !c.pick!.includes(p as never)) ? 'pick-wrong' : 'pick-few');
    } else {
      if (roles.some((r) => r !== 'base')) return fail('wrong-base');
      if (c.pick === 'bases' && picked.length < (s.bases ?? 2)) return fail('one-base');
    }
  }
  if (c.turned && !(s.turns ?? 0)) return fail('not-turned');
  if (c.unfolded && (s.unfolded ?? 0) < 0.999) return fail('not-unfolded');
  if (c.layers !== undefined) {
    const want = c.layers === 'full' ? s.full ?? 0 : c.layers, got = s.layers ?? 0;
    if (!got) return fail('layers-empty');
    if (got !== want) return fail(got < want ? 'layers-few' : 'layers-many');
  }
  const q = (['volume', 'area', 'lateral', 'length'] as const).find((k) => c[k] !== undefined);
  if (!q) return { ok: true };
  const want = c[q]!, a = s.answer, got = a?.value;
  if (got == null || Number.isNaN(got)) return fail('empty');
  const near = (v: number) => Math.abs(got - v) <= (c.tolerance ?? 0.01) + 1e-9;
  const unitCode = (): string | null => {
    if (!c.unit || a?.unit === c.unit) return null;
    if (!a?.unit) return 'no-unit';
    const w = dim(c.unit), g = dim(a.unit);
    return w === 3 && g === 2 ? 'area-for-volume' : w === 2 && g === 3 ? 'volume-for-area' : g === 1 && w > 1 ? 'length-unit' : 'wrong-unit';
  };
  if (near(want)) { const u = unitCode(); return u ? fail(u) : { ok: true }; }
  const trap = [...(s.misreads ?? []), ...(c.traps ?? []).map((t) => [t.value, t.code] as [number, string])].find(([v]) => near(v));
  if (trap) return fail(trap[1]);
  const u = unitCode();
  if (u && u !== 'no-unit') return fail(u);
  return fail(got > want ? 'too-big' : 'too-small');
}

/**
 * Numbers a learner gets by a known slip, for the quantity asked about this solid:
 *   volume   one-layer (base area only), no-half (a triangle base without ½), surface-for-volume (the total area),
 *            edges-sum, diameter-for-radius, pi-value (π taken as 3 when the mission says 3.14)
 *   area     visible-only (faces seen now, or at the start), lateral-only, one-base, volume-for-surface, edges-sum,
 *            diameter-for-radius, pi-value
 *   lateral  volume-for-surface (πr²h for a cylinder's side), total-for-lateral, half-around (πrh), diameter-for-radius,
 *            pi-value
 * `seen` = areas of the faces in view (the visible-only slip). Values equal to the right answer are left out.
 */
export function misreadsFor(spec: SolidSpec, q: Quantity, pi: number, seen: number[] = []): [number, string][] {
  const m = measuresOf(spec, pi), round = spec.kind === 'cylinder' || spec.kind === 'cone';
  const want = pick(m, q), out: [number, string][] = [];
  const add = (v: number, code: string) => { if (Number.isFinite(v) && Math.abs(v - want) > 1e-6 && !out.some((x) => Math.abs(x[0] - v) < 1e-6)) out.push([+v.toFixed(6), code]); };
  const wide = round ? measuresOf({ ...spec, r: 2 * (spec.r ?? 1) }, pi) : null;
  const pi3 = round && Math.abs(pi - 3) > 1e-9 ? measuresOf(spec, 3) : null;
  const triangle = (spec.kind === 'prism' || spec.kind === 'pyramid') && spec.base?.length === 3;
  if (q === 'volume') {
    add(m.base, 'one-layer');
    if (triangle) add(2 * m.volume, spec.lie ? 'wrong-base' : 'no-half');
    add(m.total, 'surface-for-volume');
    add(m.edges, 'edges-sum');
  } else if (q === 'area') {
    for (const v of seen) add(v, 'visible-only');
    add(m.lateral, 'lateral-only');
    if (m.base) add(m.lateral + m.base, 'one-base');
    add(m.volume, 'volume-for-surface');
    add(m.edges, 'edges-sum');
  } else if (q === 'lateral') {
    add(m.volume, 'volume-for-surface');
    add(m.total, 'total-for-lateral');
    if (round) add(m.lateral / 2, 'half-around');
  }
  if (wide && q !== 'length') add(pick(wide, q), 'diameter-for-radius');
  if (pi3 && q !== 'length') add(pick(pi3, q), 'pi-value');
  return out;
}
const pick = (m: Measures, q: Quantity) => (q === 'volume' ? m.volume : q === 'area' ? m.total : q === 'lateral' ? m.lateral : NaN);

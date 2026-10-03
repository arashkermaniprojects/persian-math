// Pure probability maths for <kg-probability-sim>: devices and their outcomes, exact theoretical probabilities,
// a seeded random generator (deterministic tests), trials, sample spaces, the likelihood scale and spinner geometry.

/** One random device. Outcome keys: coin heads/tails; dice "1".."n"; spinner and bag colour names. */
export interface DeviceConfig {
  kind: 'coin' | 'dice' | 'spinner' | 'bag';
  /** Dice: number of faces (default 6). */
  sides?: number;
  /** Spinner: one colour per equal sector, or { color, size } with a whole-number size (default 1). */
  sectors?: (string | { color: string; size?: number })[];
  /** Bag: counters per colour, e.g. { red: 5, white: 1 }. */
  bag?: Record<string, number>;
  /** Coin or dice: a whole-number weight per side/face (a bent coin, a biased die); default 1 each. */
  weights?: number[];
}

export type Frac = [number, number];
export interface Outcome { key: string; w: number }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** n/d in lowest terms; 0 is [0, 1]. */
export function reduce(n: number, d: number): Frac {
  if (!d) return [0, 1];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

/** Distinct outcomes with whole-number weights, in a stable order (sector/bag order, faces ascending). */
export function outcomesOf(d: DeviceConfig): Outcome[] {
  switch (d.kind) {
    case 'coin':
      return [{ key: 'heads', w: d.weights?.[0] ?? 1 }, { key: 'tails', w: d.weights?.[1] ?? 1 }];
    case 'dice':
      return Array.from({ length: d.sides ?? 6 }, (_, i) => ({ key: String(i + 1), w: d.weights?.[i] ?? 1 }));
    case 'spinner': {
      const out: Outcome[] = [];
      for (const s of d.sectors ?? []) {
        const c = typeof s === 'string' ? s : s.color, w = typeof s === 'string' ? 1 : s.size ?? 1;
        const o = out.find((x) => x.key === c);
        if (o) o.w += w; else out.push({ key: c, w });
      }
      return out;
    }
    case 'bag':
      return Object.entries(d.bag ?? {}).filter(([, n]) => n > 0).map(([key, w]) => ({ key, w }));
  }
}

/** Joint outcomes of several devices used together, keys joined with "-" (e.g. "heads-3"). */
export function jointOutcomes(devices: DeviceConfig[]): Outcome[] {
  return devices.reduce<Outcome[]>(
    (acc, d) => acc.flatMap((a) => outcomesOf(d).map((o) => ({ key: a.key ? `${a.key}-${o.key}` : o.key, w: a.w * o.w }))),
    [{ key: '', w: 1 }],
  );
}

/** The sample space: every outcome that can happen. */
export const sampleSpace = (devices: DeviceConfig[]) => jointOutcomes(devices).map((o) => o.key);

/** Exact probability that the outcome is one of `keys` (unknown keys count as impossible). */
export function probOf(outcomes: Outcome[], keys: string[]): Frac {
  const total = outcomes.reduce((s, o) => s + o.w, 0);
  const hit = outcomes.filter((o) => keys.includes(o.key)).reduce((s, o) => s + o.w, 0);
  return total ? reduce(hit, total) : [0, 1];
}

/** Theoretical probability of every outcome. */
export const probTable = (outcomes: Outcome[]): Record<string, Frac> =>
  Object.fromEntries(outcomes.map((o) => [o.key, probOf(outcomes, [o.key])]));

/** Mulberry32: a small seeded generator in [0, 1). Same seed, same sequence. */
export function rng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The outcome at position u ∈ [0, 1) along the weights (also where a spinner's pointer stops). */
export function pickAt(outcomes: Outcome[], u: number): string {
  const total = outcomes.reduce((s, o) => s + o.w, 0);
  let x = u * total;
  for (const o of outcomes) {
    if (x < o.w) return o.key;
    x -= o.w;
  }
  return outcomes[outcomes.length - 1]?.key ?? '';
}

/** Run one trial of every device together: the joint key and each device's u (for drawing). */
export function trial(devices: DeviceConfig[], rand: () => number): { key: string; us: number[] } {
  const us = devices.map(() => rand());
  return { key: devices.map((d, i) => outcomeAt(d, us[i])).join('-'), us };
}

/** One device's outcome at u ∈ [0, 1). A spinner stops at angle u × 360°, so the sector under the pointer decides. */
export function outcomeAt(d: DeviceConfig, u: number): string {
  if (d.kind === 'spinner') {
    const s = (d.sectors ?? [])[sectorAt(d.sectors, u * 360)];
    return s === undefined ? '' : typeof s === 'string' ? s : s.color;
  }
  return pickAt(outcomesOf(d), u);
}

/** Add n trials to a tally. Returns the new tally and the last trial. */
export function runTrials(devices: DeviceConfig[], rand: () => number, n: number, tally: Record<string, number> = {}) {
  const t = { ...tally };
  let last: { key: string; us: number[] } | null = null;
  for (let i = 0; i < n; i++) {
    last = trial(devices, rand);
    t[last.key] = (t[last.key] ?? 0) + 1;
  }
  return { tally: t, last };
}

/**
 * Likelihood scale. 3 levels (Iran G2–G3: «حتمی، ممکن، غیرممکن»): impossible / possible / certain.
 * 5 levels: impossible / unlikely / even (½) / likely / certain.
 */
export type Level = 'impossible' | 'unlikely' | 'even' | 'likely' | 'certain' | 'possible';
export const SCALE: Record<3 | 5, Level[]> = {
  3: ['impossible', 'possible', 'certain'],
  5: ['impossible', 'unlikely', 'even', 'likely', 'certain'],
};

export function levelOf([n, d]: Frac, levels: 3 | 5 = 5): Level {
  if (n <= 0) return 'impossible';
  if (n >= d) return 'certain';
  if (levels === 3) return 'possible';
  return 2 * n === d ? 'even' : 2 * n < d ? 'unlikely' : 'likely';
}

/** Position of a level on its scale, 0 = impossible. Unknown levels are -1. */
export const rankOf = (level: string, levels: 3 | 5) => SCALE[levels].indexOf(level as Level);

/** Spinner geometry: start and end angle of each sector in degrees, clockwise from 12 o'clock. */
export function sectorAngles(sectors: DeviceConfig['sectors'] = []): { color: string; a0: number; a1: number }[] {
  const list = sectors.map((s) => (typeof s === 'string' ? { color: s, size: 1 } : { color: s.color, size: s.size ?? 1 }));
  const total = list.reduce((s, x) => s + x.size, 0) || 1;
  let a = 0;
  return list.map((x) => {
    const a0 = a;
    a += (360 * x.size) / total;
    return { color: x.color, a0, a1: a };
  });
}

/** SVG path of a sector of a circle of radius r centred at (r, r). */
export function sectorPath(a0: number, a1: number, r: number): string {
  if (a1 - a0 >= 359.999) return `M${r} 0A${r} ${r} 0 1 1 ${r - 0.001} 0Z`;
  const pt = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${+(r + r * Math.cos(t)).toFixed(2)} ${+(r + r * Math.sin(t)).toFixed(2)}`;
  };
  return `M${r} ${r}L${pt(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(a1)}Z`;
}

/** Spinner sector under a pointer angle (degrees clockwise from 12 o'clock). */
export function sectorAt(sectors: DeviceConfig['sectors'], angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  const arcs = sectorAngles(sectors);
  const i = arcs.findIndex((s) => a >= s.a0 && a < s.a1);
  return i < 0 ? arcs.length - 1 : i;
}

/** Tally marks: groups of five, then the rest, e.g. 12 → [5, 5, 2]. */
export function tallyGroups(n: number): number[] {
  const g = Array(Math.floor(n / 5)).fill(5);
  if (n % 5) g.push(n % 5);
  return g;
}

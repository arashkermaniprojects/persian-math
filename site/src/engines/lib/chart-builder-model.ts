// Pure helpers for <kg-chart-builder>: tallies, scales, pictogram symbols, pie sectors, levelling, mean and mode.
// Every chart is drawn left to right with values going up (or right), in every locale (docs/NOTATION.md "Charts").

/** Tally marks in groups of five (four strokes and a fifth across them), as in Iranian G2–G3 «چوب‌خط». */
export function tallyGroups(n: number): { fives: number; rest: number } {
  const v = Math.max(0, Math.floor(n));
  return { fives: Math.floor(v / 5), rest: v % 5 };
}

/** A tick step that gives at most `maxTicks` steps from 0 to max: 1, 2, 5, 10, 20, 50, … */
export function niceStep(span: number, maxTicks = 10): number {
  if (!(span > 0)) return 1;
  let p = 1;
  for (;;) {
    for (const m of [1, 2, 5]) if (span / (m * p) <= maxTicks) return m * p;
    p *= 10;
  }
}

/** Tick values from min to max (inclusive) every step. */
export function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Round v to the nearest multiple of snap and keep it in [lo, hi]. */
export function snapTo(v: number, snap: number, lo: number, hi: number): number {
  const s = snap > 0 ? Math.round(v / snap) * snap : v;
  return Math.min(hi, Math.max(lo, Math.round(s * 1e6) / 1e6));
}

/** Linear map of v from [a0, a1] to [b0, b1]. */
export function lerp(v: number, a0: number, a1: number, b0: number, b1: number): number {
  return a1 === a0 ? b0 : b0 + ((v - a0) * (b1 - b0)) / (a1 - a0);
}

/**
 * Pictogram symbols for a value: whole symbols, then one partial symbol (a fraction of `key`), cut to `part`ths.
 * symbols(5, 2) = [1, 1, 0.5]; symbols(7, 4, 4) = [1, 0.75].
 */
export function symbols(value: number, key: number, part = 1): number[] {
  const n = Math.max(0, value) / (key || 1);
  const out: number[] = Array(Math.floor(n + 1e-9)).fill(1);
  const frac = Math.round((n - out.length) * part) / part;
  if (frac > 1e-9) out.push(frac);
  return out;
}

/** The finest pictogram step: one `part` of a symbol, e.g. key 2 in halves → 1. */
export function pictoStep(key: number, part: number): number {
  return key / Math.max(1, part);
}

/** Pie slices, clockwise from 12 o'clock (Iranian G3 p.127 and UK practice), in category order. Angles in degrees. */
export function slices(values: number[]): { i: number; a0: number; a1: number }[] {
  const sum = values.reduce((s, v) => s + Math.max(0, v), 0);
  const out: { i: number; a0: number; a1: number }[] = [];
  let a = 0;
  values.forEach((v, i) => {
    if (v <= 0 || !sum) return;
    const b = a + (360 * v) / sum;
    out.push({ i, a0: a, a1: b });
    a = b;
  });
  return out;
}

/** A point on a circle; angle in degrees clockwise from 12 o'clock (SVG y grows downward). */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(t), cy - r * Math.cos(t)];
}

/** SVG path of a pie sector from a0 to a1 degrees (clockwise from 12 o'clock). A full turn is a circle. */
export function sectorPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const f = (n: number) => +n.toFixed(2);
  if (a1 - a0 >= 359.999) return `M${f(cx)} ${f(cy - r)}A${r} ${r} 0 1 1 ${f(cx - 0.01)} ${f(cy - r)}Z`;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${f(cx)} ${f(cy)}L${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}Z`;
}

/** Category values from painted pie sectors: sector s holds category paint[s] (-1 = unpainted), each worth `key`. */
export function paintedValues(paint: number[], cats: number, key = 1): number[] {
  const v = Array(cats).fill(0);
  for (const c of paint) if (c >= 0 && c < cats) v[c] += key;
  return v;
}

/** Fill sectors in order from given values (each sector worth key), e.g. a read-only pie drawn as equal parts. */
export function paintFrom(values: number[], sectors: number, key = 1): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    for (let k = 0; k < Math.round(v / key); k++) out.push(i);
  });
  while (out.length < sectors) out.push(-1);
  return out.slice(0, sectors);
}

/**
 * Levelling (the mean as "evening out"): moving bar i to v. Units taken off a bar go into the pool;
 * a bar can only grow by what is in the pool. Returns the new values and pool.
 */
export function level(values: number[], pool: number, i: number, v: number): { values: number[]; pool: number } {
  const cur = values[i];
  const want = Math.max(0, v);
  const nv = want > cur ? Math.min(want, cur + pool) : want;
  const out = values.slice();
  out[i] = nv;
  return { values: out, pool: pool - (nv - cur) };
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

/** Indices of the most common value(s) (largest frequency). Empty if all are 0. */
export function modes(freq: number[]): number[] {
  const m = Math.max(0, ...freq);
  return m > 0 ? freq.flatMap((f, i) => (f === m ? [i] : [])) : [];
}

/** Split a category label in two lines at the space (or Persian half-space) nearest the middle (for narrow columns). */
export function twoLines(s: string, max = 7): string[] {
  if (s.length <= max || !/[ \u200c]/.test(s)) return [s];
  let best = -1;
  for (let i = 0; i < s.length; i++) if ((s[i] === ' ' || s[i] === '\u200c') && (best < 0 || Math.abs(i - s.length / 2) < Math.abs(best - s.length / 2))) best = i;
  return [s.slice(0, best), s.slice(best + 1)];
}

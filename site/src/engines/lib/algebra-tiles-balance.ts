// The equation balance of <kg-algebra-tiles> (module `balance`): two pans of tiles, an equation or inequality between
// them, and moves done to one pan or to both. A move keeps the scale level only when the new equation has the same
// solutions as the first one; the scale knows that by comparing the two equations, not by trusting the moves.
// Pure logic (no DOM): ../algebra-tiles/balance.ts draws it; algebra-tiles-check.ts checks it.
import { add, evaluate, keyOf, kindsOf, mul, mulKey, normalize, parse, powsOf, type Poly } from './algebra-tiles-poly';

/** A relation between the pans; '=' for an equation. */
export type Rel = '=' | '<' | '>' | '<=' | '>=';
/** One pan: n equal groups of p, all over den (a monomial key, '1' = no fraction bar). Its value is n·p / den. */
export interface Pan { p: Poly; n: number; den: string }
/** pans[0] is the left pan (the left side of the equation in every locale). */
export interface Scale { pans: [Pan, Pan]; rel: Rel }
/** A move: add a polynomial (one tile: { x: -1 }), multiply or divide by a number or a letter, open the brackets. */
export type Op = { op: 'add'; q: Poly } | { op: 'mul' | 'div'; k: number | string } | { op: 'expand' };

const EPS = 1e-9;
const RELS = /(<=|>=|≤|≥|=|<|>)/;
const FLIP: Record<Rel, Rel> = { '=': '=', '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
export const flipRel = (r: Rel) => FLIP[r];

function need(src: string): Poly {
  const p = parse(src);
  if (!p) throw new Error(`algebra-tiles balance: cannot read "${src}"`);
  return p;
}

/** "2(x + 3)" → 2 groups of x + 3; anything else is one group: "x/3 + 1", "5x - 3". */
export function parseSide(src: string): Pan {
  const g = normalize(src).match(/^(\d+)\((.+)\)$/);
  if (g && +g[1] > 1 && parse(g[2])) return { p: need(g[2]), n: +g[1], den: '1' };
  return { p: need(src), n: 1, den: '1' };
}

/** "5x - 3 = 2x + 12", "2x + 1 > 7", "v = u + at". */
export function parseScale(src: string): Scale {
  const m = String(src).split(RELS);
  if (m.length !== 3) throw new Error(`algebra-tiles balance: "${src}" needs one relation sign`);
  const rel = (m[1] === '≤' ? '<=' : m[1] === '≥' ? '>=' : m[1]) as Rel;
  return { pans: [parseSide(m[0]), parseSide(m[2])], rel };
}

const numer = (pan: Pan) => mul(pan.p, { '1': pan.n });
const has = (key: string, s: string) => !!powsOf(key)[s];
/** key ÷ letter s, or null when s is not in it. */
function divKey(key: string, s: string): string | null {
  const p = powsOf(key);
  if (!p[s]) return null;
  p[s]--;
  return keyOf(p);
}
const divPoly = (p: Poly, s: string): Poly => Object.fromEntries(Object.entries(p).map(([k, c]) => [divKey(k, s)!, c]));

/** Cancel a letter that is in the fraction bar's bottom and in every term on top: (at)/a → t. */
function simplify(pan: Pan): Pan {
  let { p, den } = pan;
  for (const s of Object.keys(powsOf(den))) {
    while (has(den, s) && kindsOf(p).length && kindsOf(p).every((k) => has(k, s))) {
      p = divPoly(p, s);
      den = divKey(den, s)!;
    }
  }
  return { p, n: pan.n, den };
}

/** The pan with its brackets opened: 2(x + 3) → 2x + 6. */
export const expand = (pan: Pan): Pan => ({ p: numer(pan), n: 1, den: pan.den });

/** A move on one pan. Zero pairs cancel at once (p is a polynomial). */
export function applyOp(pan: Pan, o: Op): Pan {
  if (o.op === 'expand') return expand(pan);
  if (o.op === 'add') {
    const e = expand(pan);
    return simplify({ ...e, p: add(e.p, mul(o.q, { [e.den]: 1 })) });
  }
  const k = o.k;
  if (typeof k === 'string') {
    if (o.op === 'mul') return simplify(has(pan.den, k) ? { ...pan, den: divKey(pan.den, k)! } : { ...pan, p: mul(pan.p, { [k]: 1 }) });
    const e = expand(pan);
    return simplify({ ...e, den: mulKey(e.den, k) });
  }
  if (!k) throw new Error('algebra-tiles balance: × or ÷ by 0');
  // groups stay groups while the count allows: 2(x + 3) ÷ 2 = x + 3, 2(x + 3) × 3 = 6(x + 3)
  if (pan.n > 1 && o.op === 'mul' && k > 0 && Number.isInteger(k)) return { ...pan, n: pan.n * k };
  if (pan.n > 1 && o.op === 'div' && k > 0 && pan.n % k === 0) return { ...pan, n: pan.n / k };
  const e = pan.n > 1 ? expand(pan) : pan;
  return { ...e, p: mul(e.p, { '1': o.op === 'mul' ? k : 1 / k }) };
}

/** A move on the left pan (0), the right pan (1) or both. */
export function move(s: Scale, o: Op, where: 0 | 1 | 'both'): Scale {
  const pans = s.pans.map((p, i) => (where === 'both' || where === i ? applyOp(p, o) : p)) as [Pan, Pan];
  return { pans, rel: s.rel };
}

/** left − right with both fraction bars cleared: the polynomial that is =, < … 0. */
export const difference = (s: Scale): Poly => {
  const [L, R] = s.pans;
  return add(mul(numer(L), { [R.den]: 1 }), mul(numer(R), { [L.den]: 1 }), -1);
};

/** c when a = c·m·b for a number c and a monomial m (multiplying both pans by x, a …), else null. */
export function ratio(a: Poly, b: Poly): number | null {
  const ka = kindsOf(a), kb = kindsOf(b);
  if (!ka.length || ka.length !== kb.length) return null;
  const pa = powsOf(ka[0]), pb = powsOf(kb[0]), m: Record<string, number> = {};
  for (const s of new Set([...Object.keys(pa), ...Object.keys(pb)])) m[s] = (pa[s] ?? 0) - (pb[s] ?? 0);
  if (Object.values(m).some((e) => e < 0)) {
    const r = ratio(b, a);
    return r === null ? null : 1 / r;
  }
  const c = a[ka[0]] / b[kb[0]];
  for (const k of kb) {
    const p = powsOf(k);
    for (const s in m) p[s] = (p[s] ?? 0) + m[s];
    if (Math.abs((a[keyOf(p)] ?? 0) - c * b[k]) > EPS * Math.max(1, Math.abs(c * b[k]))) return null;
  }
  return c;
}

/**
 * Is the scale still telling the truth? `same` when the equation has the same solutions as the first one (the
 * difference is a non-zero multiple of the first); `rel` is the relation it must then show (an inequality turns
 * round when both pans are multiplied or divided by a negative number). `ok` = same and showing that relation.
 */
export function judge(s: Scale, first: Scale): { same: boolean; rel: Rel; ok: boolean } {
  const c = ratio(difference(s), difference(first));
  if (c === null) return { same: false, rel: s.rel, ok: false };
  const rel = c > 0 ? first.rel : flipRel(first.rel);
  return { same: true, rel, ok: rel === s.rel };
}

/** The letters in the scale, in alphabetical order. */
export const lettersOf = (s: Scale) =>
  [...new Set(s.pans.flatMap((p) => [...Object.keys(p.p), p.den]).flatMap((k) => Object.keys(powsOf(k))))].sort();

/** The weight of each letter that makes the first equation true, when it has one letter and is linear; else null. */
export function weightsOf(s: Scale): Record<string, number> | null {
  const ls = lettersOf(s), d = difference(s);
  if (ls.length !== 1 || kindsOf(d).some((k) => k !== '1' && k !== ls[0]) || !d[ls[0]]) return null;
  return { [ls[0]]: -(d['1'] ?? 0) / d[ls[0]] };
}

/** What a pan weighs when every letter has a value. */
export const valueOf = (pan: Pan, w: Record<string, number>) => evaluate(numer(pan), w) / evaluate({ [pan.den]: 1 }, w);

/**
 * How the beam leans: 1 = the left pan is down, −1 = the right pan is down, 0 = level. A true equation is level; a
 * true inequality leans to its bigger side; a broken one leans by the weights (`w`, the solution), else to the left.
 */
export function tiltOf(s: Scale, ok: boolean, w: Record<string, number> | null): -1 | 0 | 1 {
  if (ok) return s.rel === '=' ? 0 : s.rel.startsWith('>') ? 1 : -1;
  const d = w ? valueOf(s.pans[0], w) - valueOf(s.pans[1], w) : NaN;
  return Math.abs(d) > EPS && d < 0 ? -1 : 1;
}

// ---------- writing ----------

/** The smallest whole d (≤ 1000) with c·d whole: 1/3 → 3. */
export function denOf(c: number): number {
  for (let d = 1; d <= 1000; d++) if (Math.abs(c * d - Math.round(c * d)) < 1e-7) return d;
  return 1;
}

/** One term, ASCII: (1/3, x) → "x/3", (−2/3, x) → "-2x/3", (4/3, 1) → "4/3", (2, a*t) → "2at". */
export function termText(k: string, c: number): string {
  const d = denOf(c), n = Math.round(c * d), body = k === '1' ? '' : k.replace(/\*/g, '');
  const top = !body ? String(n) : n === 1 ? body : n === -1 ? `-${body}` : `${n}${body}`;
  return d === 1 ? top : `${top}/${d}`;
}

/** A polynomial with fractions written as a/b (algHTML stacks them): "x/3 + 1". */
export function polyText(p: Poly): string {
  const ks = kindsOf(p);
  if (!ks.length) return '0';
  return ks.map((k, i) => {
    const t = termText(k, p[k]);
    return i === 0 ? t : t.startsWith('-') ? `- ${t.slice(1)}` : `+ ${t}`;
  }).join(' ');
}

/** A pan as written: "2(x + 3)", "(v - u)/a", "t". */
export function panText(pan: Pan): string {
  let t = polyText(pan.p);
  const one = kindsOf(pan.p).length === 1;
  if (pan.n > 1) t = `${pan.n}(${t})`;
  if (pan.den !== '1') t = `${one || pan.n > 1 ? t : `(${t})`}/${pan.den.replace(/\*/g, '')}`;
  return t;
}

export const relText = (r: Rel) => (r === '<=' ? '≤' : r === '>=' ? '≥' : r);
export const scaleText = (s: Scale) => `${panText(s.pans[0])} ${relText(s.rel)} ${panText(s.pans[1])}`;

/** The text of a move, ASCII: "-2", "+x", "÷3", "×(-1)", "÷a". */
export function opText(o: Op): string {
  if (o.op === 'expand') return '';
  if (o.op === 'add') {
    const t = polyText(o.q);
    return t.startsWith('-') ? t : `+${t}`;
  }
  const k = typeof o.k === 'number' && o.k < 0 ? `(${o.k})` : String(o.k);
  return (o.op === 'mul' ? '×' : '÷') + k;
}

// ---------- the goal ----------

/**
 * Why the letter is not alone yet, or null when one pan is exactly the letter and the other pan is free of it.
 * Codes: unknown-both-sides, constant-left (x + 2 = 9), coefficient-left (3x = 12, at = v − u), fraction-left
 * (x/3 = 4, or a letter under a bar), negative-unknown (−x = −4), bracket-left (2(x + 3) = 16), no-unknown, not-solved.
 */
export function aloneCode(s: Scale, letter: string): string | null {
  const holds = (p: Pan) => kindsOf(p.p).some((k) => has(k, letter)) || has(p.den, letter);
  const sides = s.pans.filter(holds);
  if (sides.length === 2) return 'unknown-both-sides';
  if (!sides.length) return 'no-unknown';
  const pan = sides[0];
  if (pan.n > 1) return 'bracket-left';
  if (pan.den !== '1') return 'fraction-left';
  const ks = kindsOf(pan.p), mine = ks.filter((k) => has(k, letter));
  if (mine.length !== 1) return 'not-solved';
  if (ks.length > 1) return 'constant-left';
  const [k] = mine, c = pan.p[k];
  if (k !== letter) return 'coefficient-left';
  if (Math.abs(c - 1) < EPS) return null;
  if (Math.abs(c + 1) < EPS) return 'negative-unknown';
  return Math.abs(c) < 1 ? 'fraction-left' : 'coefficient-left';
}

/** Read with the letter on the left: [letter's pan, other pan, relation as seen from the letter]. */
export function readAlone(s: Scale, letter: string): { other: Pan; rel: Rel } {
  const left = kindsOf(s.pans[0].p).some((k) => has(k, letter));
  return left ? { other: s.pans[1], rel: s.rel } : { other: s.pans[0], rel: flipRel(s.rel) };
}

/** Same pans (as written, groups and bars included) in either order. */
export function sameScale(a: Scale, b: Scale): boolean {
  const eq = (p: Pan, q: Pan) => p.n === q.n && p.den === q.den && !kindsOf(add(p.p, q.p, -1)).length;
  return (eq(a.pans[0], b.pans[0]) && eq(a.pans[1], b.pans[1])) || (eq(a.pans[0], b.pans[1]) && eq(a.pans[1], b.pans[0]));
}

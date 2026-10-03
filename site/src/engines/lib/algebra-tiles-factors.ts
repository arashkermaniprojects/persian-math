// The factor board of <kg-algebra-tiles> (module `factors`): a fraction bar with factor chips above and below it.
// A chip is a number, a letter, a power (2^3, (a^2)^3), a bracket factor (x + 3, x^2 - 9) or a root (√12). The
// learner splits a chip into its factors (2^3 → 2 2 2, 12 → 2 2 3, x^2 - 9 → (x - 3)(x + 3), √12 → √(2 2 3)),
// cancels an equal chip above with one below, takes a pair out from under a root as one chip, and joins two roots
// (√2 √3 → √(2 3)). The answer typed on the keypad is read as factors with indices (readFactors), so 2^7 and 128
// have the same value but not the same form. Pure logic (no DOM): ../algebra-tiles/factors.ts draws it.
import { content, equal, format, kindsOf, mul, normalize, parse, parseTerms, powsOf, type Poly } from './algebra-tiles-poly';

const EPS = 1e-9;
const tidy = (c: number) => (Math.abs(c - Math.round(c)) < EPS ? Math.round(c) : +c.toFixed(9));

/** One chip on the board. `root` = a root over these chips (√ of their product); `out` = cancelled (kept, struck). */
export interface Chip { id: number; f: string; out?: boolean; root?: Chip[] }
/** One fraction: chips above and below its bar (no chips below = no bar). */
export interface Frac { top: Chip[]; bottom: Chip[] }
export type Side = 'top' | 'bottom';

/** 12 → [2, 2, 3]; 1 and 0 → []. */
export function primes(n: number): number[] {
  const out: number[] = [];
  n = Math.abs(Math.round(n));
  for (let p = 2; p * p <= n; p++) while (n % p === 0) out.push(p), (n /= p);
  if (n > 1) out.push(n);
  return out;
}

/** Strip one pair of brackets that wraps the whole text: "(x + 3)" → "x + 3", "(a)(b)" stays. */
export function unwrap(s: string): string {
  s = s.trim();
  if (!s.startsWith('(') || !s.endsWith(')')) return s;
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    d += s[i] === '(' ? 1 : s[i] === ')' ? -1 : 0;
    if (d === 0 && i < s.length - 1) return s;
  }
  return s.slice(1, -1).trim();
}

/** "√12" → "12", "√(2*3)" → "2*3"; null when the chip is not a root. */
export const radicand = (f: string): string | null => (/^√/.test(f.trim()) ? unwrap(f.trim().slice(1)) : null);
/** A top-level sum (needs brackets beside other chips): "x + 3", "x^2 - 9"; not "-3", not "(x+3)^2". */
export const isSum = (f: string) => (parseTerms(f)?.length ?? 0) > 1 && unwrap(f) === f.trim();

/** "b^k" with a whole base (a number, a letter or one bracket) → [b, k]. */
function powerOf(f: string): [string, number] | null {
  const m = f.trim().match(/^(.+)\^(\d+)$/);
  if (!m) return null;
  const b = m[1].trim();
  if (!/^(\d+|[a-zA-Z]|√\d+)$/.test(b) && unwrap(b) === b) return null;
  return [unwrap(b), Number(m[2])];
}

/** The value of a chip as a polynomial (√n is a symbol), for equality; null if unreadable. */
export function chipPoly(c: Chip | string): Poly | null {
  if (typeof c !== 'string' && c.root) {
    const inner = c.root.filter((x) => !x.out).map((x) => chipPoly(x));
    if (inner.some((p) => !p)) return null;
    const v = inner.reduce<Poly>((a, b) => mul(a, b!), { '1': 1 });
    const ks = kindsOf(v);
    return ks.length === 1 && ks[0] === '1' ? (v['1'] === 1 ? { '1': 1 } : { [`√${v['1']}`]: 1 }) : { [`√(${format(v)})`]: 1 };
  }
  const f = typeof c === 'string' ? c : c.f;
  const r = radicand(f);
  if (r !== null) {
    const p = parse(r);
    if (!p) return null;
    const ks = kindsOf(p);
    return ks.length === 1 && ks[0] === '1' ? { [`√${p['1']}`]: 1 } : { [`√(${format(p)})`]: 1 };
  }
  return parse(f);
}
/** Same value (2^3 and 8; x + 3 and 3 + x). */
export function sameChip(a: Chip | string, b: Chip | string): boolean {
  const p = chipPoly(a), q = chipPoly(b);
  return !!p && !!q && equal(p, q);
}

/**
 * The factors a chip splits into, or null when it cannot be split. `root: true` = a root whose radicand is split
 * under it. Order: the mission's own `split` (by value), a root (its radicand), a power (k copies of the base), a
 * monomial (prime factors of the number, each letter once per power), a sum (its common number factor, or two
 * brackets when it is x² + bx + c with whole roots).
 */
export function splitOf(f: string, own: Record<string, string[]> = {}): { chips: string[]; root?: boolean } | null {
  for (const [k, v] of Object.entries(own)) if (sameChip(k, f) && (radicand(k) === null) === (radicand(f) === null)) return { chips: v.map(String) };
  const r = radicand(f);
  if (r !== null) {
    const s = splitOf(r, own);
    return s && !s.root ? { chips: s.chips, root: true } : null;
  }
  const pw = powerOf(f);
  if (pw) return pw[1] >= 2 ? { chips: Array(pw[1]).fill(pw[0]) } : null;
  const p = parse(f);
  if (!p) return null;
  const ks = kindsOf(p);
  if (ks.length === 1) {
    const k = ks[0], c = p[k];
    if (!Number.isInteger(c) || c <= 0) return null;
    const lets = k === '1' ? [] : Object.entries(powsOf(k)).flatMap(([s, e]) => Array(e).fill(s) as string[]);
    const out = [...primes(c).map(String), ...lets];
    return out.length >= 2 ? { chips: out } : null;
  }
  const g = content(p);
  if (g > 1) return { chips: [String(g), format(mul(p, { '1': 1 / g }))] };
  // x² + bx + c with whole roots: (x − r)(x − s)
  const lets = [...new Set(ks.flatMap((k) => Object.keys(powsOf(k))))];
  if (lets.length !== 1) return null;
  const x = lets[0], a = p[`${x}^2`] ?? 0, b = p[x] ?? 0, c = p['1'] ?? 0;
  if (a !== 1 || ks.some((k) => ![`${x}^2`, x, '1'].includes(k))) return null;
  const d = b * b - 4 * c, q = Math.round(Math.sqrt(Math.max(0, d)));
  if (d < 0 || q * q !== d || (b + q) % 2) return null;
  const r1 = (-b - q) / 2, r2 = (-b + q) / 2;
  return { chips: [r1, r2].map((rt) => format({ [x]: 1, '1': -rt })) };
}

// ---------- the board ----------

let nextId = 1;
const chip = (f: string): Chip => ({ id: nextId++, f });

/** Fractions from the config: `top`/`bottom` lists or `fractions: [{ top, bottom }]`. */
export function makeBoard(fracs: { top?: (string | number)[]; bottom?: (string | number)[] }[]): Frac[] {
  return fracs.map((fr) => ({ top: (fr.top ?? []).map((f) => chip(String(f))), bottom: (fr.bottom ?? []).map((f) => chip(String(f))) }));
}

export const cloneBoard = (b: Frac[]): Frac[] => JSON.parse(JSON.stringify(b));

/** Where a chip is: its fraction, side, list and index (inside a root, `parent` is the root chip). */
export interface Spot { fi: number; side: Side; list: Chip[]; at: number; parent?: Chip }
export function find(b: Frac[], id: number): Spot | null {
  for (let fi = 0; fi < b.length; fi++) for (const side of ['top', 'bottom'] as Side[]) {
    const list = b[fi][side];
    for (let at = 0; at < list.length; at++) {
      if (list[at].id === id) return { fi, side, list, at };
      const inner = list[at].root;
      const k = inner?.findIndex((c) => c.id === id) ?? -1;
      if (k >= 0) return { fi, side, list: inner!, at: k, parent: list[at] };
    }
  }
  return null;
}

/** Split chip `id` in place; false when it cannot be split. */
export function splitChip(b: Frac[], id: number, own: Record<string, string[]> = {}): boolean {
  const s = find(b, id);
  if (!s || s.list[s.at].out || s.list[s.at].root) return false;
  const sp = splitOf(s.list[s.at].f, own);
  if (!sp) return false;
  const parts = sp.chips.map(chip);
  if (sp.root) s.list.splice(s.at, 1, { id: nextId++, f: '√', root: parts });
  else s.list.splice(s.at, 1, ...parts);
  return true;
}

/** Why two chips cannot be cancelled: `cancel-terms` (one is a term of the other: (x + 3) and 3), `split-first`
 * (they share a factor that is not yet a chip: a^5 and a^2), `not-equal`. */
export function whyNot(a: Chip, b: Chip): 'cancel-terms' | 'split-first' | 'not-equal' {
  const [s, t] = isSum(a.f) ? [a, b] : [b, a];
  if (!s.root && !t.root && isSum(s.f) && parseTerms(s.f)!.some((term) => { const q = chipPoly(t); return !!q && equal(term, q); })) return 'cancel-terms';
  const at = (c: Chip) => (c.root ? [] : atoms(c.f));
  const x = at(a), y = at(b);
  if ((x.length > 1 || y.length > 1) && x.some((k) => y.includes(k))) return 'split-first';
  return 'not-equal';
}

export type TapResult =
  | { did: 'cancel' | 'pair' | 'roots'; a: Chip; b: Chip }
  | { did: 'refuse'; why: 'cancel-terms' | 'split-first' | 'not-equal' | 'other-fraction'; a: Chip; b: Chip }
  | { did: 'select' };

/**
 * The learner tapped chip `a`, then chip `b`. Above and below the same bar, equal chips cancel (both struck);
 * under one root, two equal chips come out as one chip in front of the root; two roots on the same side join into
 * one root (√2 √3 → √(2 3)). Anything else on the same side just selects `b`.
 */
export function tap(b: Frac[], ida: number, idb: number): TapResult {
  const A = find(b, ida), B = find(b, idb);
  if (!A || !B) return { did: 'select' };
  const a = A.list[A.at], c = B.list[B.at];
  if (A.fi !== B.fi) return A.side === B.side ? { did: 'select' } : { did: 'refuse', why: 'other-fraction', a, b: c };
  if (A.side !== B.side) {
    if (A.parent || B.parent) return { did: 'refuse', why: 'not-equal', a, b: c };
    if (!sameChip(a, c)) return { did: 'refuse', why: whyNot(a, c), a, b: c };
    a.out = c.out = true;
    return { did: 'cancel', a, b: c };
  }
  if (A.parent && A.parent === B.parent) {
    if (!sameChip(a, c)) return { did: 'select' };
    const root = A.parent, list = b[A.fi][A.side];
    root.root = root.root!.filter((x) => x !== a && x !== c);
    const at = list.indexOf(root);
    list.splice(at, root.root.length ? 0 : 1, chip(a.f));
    return { did: 'pair', a, b: c };
  }
  const isRoot = (x: Chip) => !!x.root || radicand(x.f) !== null;
  if (!A.parent && !B.parent && isRoot(a) && isRoot(c)) {
    const inner = (x: Chip) => (x.root ? x.root.filter((y) => !y.out) : [chip(radicand(x.f)!)]);
    const list = b[A.fi][A.side], joined: Chip = { id: nextId++, f: '√', root: [...inner(a), ...inner(c)] };
    list.splice(list.indexOf(a), 1, joined);
    list.splice(list.indexOf(c), 1);
    return { did: 'roots', a, b: c };
  }
  return { did: 'select' };
}

/** Multiply a fraction top and bottom by a chip (rationalising, a common bottom). */
export function byBoth(b: Frac[], fi: number, f: string): void {
  b[fi].top.push(chip(f));
  b[fi].bottom.push(chip(f));
}

// ---------- reading the board ----------

/** A chip fully split, as value keys: 12 → [2, 2, 3], x^2 - 9 → [x - 3, x + 3], √12 stays √12. */
export function atoms(f: string, own: Record<string, string[]> = {}, depth = 0): string[] {
  const s = radicand(f) === null && depth < 12 ? splitOf(f, own) : null;
  if (!s) {
    const p = chipPoly(f);
    return p ? (equal(p, { '1': 1 }) ? [] : [format(p)]) : [f];
  }
  return s.chips.flatMap((c) => atoms(c, own, depth + 1));
}

const live = (l: Chip[]) => l.filter((c) => !c.out);
const chipText = (c: Chip, many: boolean): string => {
  if (c.root) {
    const inner = live(c.root);
    return inner.length === 1 && !isSum(inner[0].f) ? `√${inner[0].f}` : `√(${inner.map((x) => chipText(x, true)).join('*')})`;
  }
  return many && isSum(c.f) ? `(${c.f})` : c.f;
};
/** One side as ASCII: "2*2*2", "(x - 3)", "1" when every chip is cancelled. */
export function sideText(l: Chip[]): string {
  const xs = live(l);
  return xs.length ? xs.map((c) => chipText(c, xs.length > 1)).join('*') : '1';
}
/** The board as it stands, ASCII: "a*a*a", "1/(2*2*2)", "(x - 3)/(x + 2)"; fractions joined by `join`. */
export function boardText(b: Frac[], join = '+'): string {
  return b.map((fr) => {
    const t = sideText(fr.top), d = sideText(fr.bottom);
    if (d === '1') return t;
    const w = (s: string) => (s.includes('*') || isSum(s) ? `(${s})` : s);
    return `${w(t)}/${w(d)}`;
  }).join(` ${join} `);
}

/** The product of one side's chips not cancelled (roots as symbols), or null when unreadable. */
export function sidePoly(l: Chip[]): Poly | null {
  let v: Poly = { '1': 1 };
  for (const c of live(l)) {
    const p = chipPoly(c);
    if (!p) return null;
    v = mul(v, p);
  }
  return v;
}

/** Board checks, in order; the first that fails gives the code (docs/STUDIOS.md, `factors`). */
export function boardCode(b: Frac[], want: { expanded?: boolean; fullyCancelled?: boolean; rational?: boolean; sameBottom?: boolean }, own: Record<string, string[]> = {}): string | null {
  const all = (fr: Frac) => [...fr.top, ...fr.bottom];
  if (want.expanded) {
    for (const fr of b) for (const c of live(all(fr))) {
      if (c.root ? live(c.root).some((x) => splitOf(x.f, own)) : splitOf(c.f, own)) return 'not-expanded';
    }
  }
  if (want.fullyCancelled) {
    for (const fr of b) {
      const t = live(fr.top), d = live(fr.bottom);
      if (t.some((x) => d.some((y) => sameChip(x, y)))) return 'not-cancelled';
      const ta = t.flatMap((x) => (x.root ? [] : atoms(x.f, own))), da = d.flatMap((x) => (x.root ? [] : atoms(x.f, own)));
      if (ta.some((k) => da.includes(k))) return 'not-split';
    }
    for (const fr of b) for (const c of live(all(fr))) {
      const inner = c.root ? live(c.root).flatMap((x) => atoms(x.f, own)) : radicand(c.f) !== null ? atoms(radicand(c.f)!, own) : [];
      if (inner.some((k, i) => inner.indexOf(k) !== i)) return c.root ? 'pair-in-root' : 'not-split';
    }
  }
  if (want.rational && b.some((fr) => live(fr.bottom).some((c) => c.root || radicand(c.f) !== null))) return 'root-below';
  if (want.sameBottom) {
    const ds = b.map((fr) => sidePoly(fr.bottom));
    if (ds.some((d) => !d || !equal(d, ds[0]!))) return 'bottoms-differ';
  }
  return null;
}

// ---------- reading a typed answer ----------

/** A product of factors base^index: bases are numbers ("2", "0.5"), letters ("a") or brackets (the polynomial, "x - 3"). */
export interface Factors { sign: number; f: { base: string; exp: number }[] }

/**
 * Read a typed answer as factors: "2^7", "2^-3", "1/2^3", "a^3", "2√3", "9^(1/2)", "(x - 3)/(x + 2)", "x - 3"
 * (a sum alone is one bracket factor). Persian digits, −, ×, ² are accepted. Null when it is not a product.
 */
export function readFactors(src: string | number): Factors | null {
  const s = normalize(src);
  if (!s) return null;
  let i = 0;
  const out: Factors = { sign: 1, f: [] };
  const num = () => { const m = s.slice(i).match(/^\d+(\.\d+)?/); if (!m) return null; i += m[0].length; return m[0]; };
  const group = (): string | null => {
    // from "(" to its matching ")"
    let d = 0;
    for (let j = i; j < s.length; j++) {
      d += s[j] === '(' ? 1 : s[j] === ')' ? -1 : 0;
      if (d === 0) { const g = s.slice(i + 1, j); i = j + 1; return g; }
    }
    return null;
  };
  const index = (): number | null => {
    if (s[i] === '(') {
      const g = group();
      const m = g?.match(/^(-?)(\d+)(?:\/(\d+))?$/);
      return m ? (m[1] ? -1 : 1) * Number(m[2]) / Number(m[3] ?? 1) : null;
    }
    const neg = s[i] === '-' ? (i++, -1) : 1;
    const n = num();
    return n === null ? null : neg * Number(n);
  };
  /** One factor, with its index, pushed into `into` (a bracket may push several: (a^2)^3 → a^6). */
  const unit = (into: Factors['f'], k: number): boolean => {
    let root = 1;
    if (s[i] === '√') i++, (root = 0.5);
    let parts: Factors['f'] = [];
    if (s[i] === '(') {
      const g = group();
      if (g === null) return false;
      const inner = readFactors(g);
      if (inner && (inner.f.length !== 1 || !isSum(inner.f[0].base) || inner.f[0].exp !== 1 || inner.sign < 0)) {
        if (inner.sign < 0) parts.push({ base: '-1', exp: 1 });
        parts.push(...inner.f);
      } else {
        const p = parse(g);
        if (!p) return false;
        parts = [{ base: format(p), exp: 1 }];
      }
    } else if (/[a-zA-Z]/.test(s[i] ?? '')) parts = [{ base: s[i++], exp: 1 }];
    else {
      const n = num();
      if (n === null) return false;
      parts = [{ base: String(Number(n)), exp: 1 }];
    }
    let e = 1;
    if (s[i] === '^') {
      i++;
      const x = index();
      if (x === null) return false;
      e = x;
    }
    for (const p of parts) into.push({ base: p.base, exp: p.exp * e * root * k });
    return true;
  };
  if (s[i] === '-') i++, (out.sign = -1);
  else if (s[i] === '+') i++;
  if (!unit(out.f, 1)) return sumAlone(s);
  while (i < s.length) {
    let k = 1;
    if (s[i] === '*') i++;
    else if (s[i] === '/') i++, (k = -1);
    else if (!/[(a-zA-Z0-9√]/.test(s[i])) return sumAlone(s);
    if (!unit(out.f, k)) return sumAlone(s);
  }
  // a minus inside a bracket factor (−1) moves to the sign
  for (const x of out.f.filter((y) => y.base === '-1')) out.sign *= Number.isInteger(x.exp) && x.exp % 2 ? -1 : 1;
  out.f = out.f.filter((y) => y.base !== '-1');
  return out;
}
/** "x - 3" typed alone: one bracket factor. */
function sumAlone(s: string): Factors | null {
  const p = parse(s);
  return p && kindsOf(p).length > 1 ? { sign: 1, f: [{ base: format(p), exp: 1 }] } : null;
}

const isNum = (b: string) => /^\d+(\.\d+)?$/.test(b);

/** The form: bases as written with their indices summed; plain numbers (index 1) multiplied into one; 1 and ^0 dropped. */
export function formOf(x: Factors): Map<string, number> {
  const m = new Map<string, number>();
  let k = 1;
  for (const { base, exp } of x.f) {
    if (isNum(base) && exp === 1) { k *= Number(base); continue; }
    m.set(base, tidy((m.get(base) ?? 0) + exp));
  }
  if (tidy(k) !== 1) m.set(String(tidy(k)), tidy((m.get(String(tidy(k))) ?? 0) + 1));
  for (const [b, e] of m) if (e === 0 || b === '1') m.delete(b);
  return m;
}

/** The value: every number split into primes (0.5 = 5 × 10^-1), indices summed per prime, letter or bracket. */
export function valueOf(x: Factors): { sign: number; zero: boolean; m: Map<string, number> } {
  const m = new Map<string, number>();
  const put = (b: string, e: number) => m.set(b, tidy((m.get(b) ?? 0) + e));
  let zero = false;
  for (const { base, exp } of x.f) {
    if (!isNum(base)) { put(base, exp); continue; }
    const [w, d = ''] = base.split('.');
    const n = Number(w + d);
    if (n === 0) { zero = true; continue; }
    for (const p of primes(n)) put(String(p), exp);
    if (d) for (const p of ['2', '5']) put(p, -d.length * exp);
  }
  for (const [b, e] of m) if (e === 0) m.delete(b);
  return { sign: x.sign, zero, m };
}

const sameMap = (a: Map<string, number>, b: Map<string, number>) => a.size === b.size && [...a].every(([k, v]) => Math.abs((b.get(k) ?? NaN) - v) < EPS);

/** top / bottom polynomials when every index is whole (for brackets: x^2 - 9 over x + 3 equals x - 3). */
function fractionOf(x: Factors): [Poly, Poly] | null {
  let t: Poly = { '1': x.sign }, d: Poly = { '1': 1 };
  for (const { base, exp } of x.f) {
    if (!Number.isInteger(exp) || Math.abs(exp) > 24) return null;
    const p = parse(base);
    if (!p) return null;
    for (let k = 0; k < Math.abs(exp); k++) exp > 0 ? (t = mul(t, p)) : (d = mul(d, p));
  }
  return [t, d];
}

export function sameValue(a: Factors, b: Factors): boolean {
  const x = valueOf(a), y = valueOf(b);
  if (x.zero || y.zero) return x.zero && y.zero;
  if (x.sign === y.sign && sameMap(x.m, y.m)) return true;
  const p = fractionOf(a), q = fractionOf(b);
  return !!p && !!q && equal(mul(p[0], q[1]), mul(q[0], p[1]));
}
export const sameForm = (a: Factors, b: Factors) => a.sign === b.sign && sameMap(formOf(a), formOf(b));

/**
 * Judge a typed answer against the target (docs/STUDIOS.md, `factors.result`): null when right. Codes: `empty`,
 * `syntax`, a trap's code (traps are matched by form, then by value), `form` (the right value written another way,
 * when the target has an index, a root or a letter: 128 for 2^7, √12 for 2√3), `not-simplified` (a base twice:
 * 2^3 × 2^4), `zero-power-zero`, `negative-power-negative`, `wrong-index` (the same bases, other indices),
 * `wrong-result`.
 */
export function judgeResult(written: string | null | undefined, target: string, traps: { write: string; code: string }[] = []): string | null {
  const src = written?.trim();
  if (!src) return 'empty';
  const got = readFactors(src);
  if (!got) return 'syntax';
  const want = readFactors(target);
  if (!want) throw new Error(`algebra-tiles factors: cannot read "${target}"`);
  const repeated = (x: Factors) => { const bs = x.f.filter((y) => !isNum(y.base) || y.exp !== 1).map((y) => y.base); return bs.some((b, i) => bs.indexOf(b) !== i); };
  if (sameForm(got, want)) return repeated(got) && !repeated(want) ? 'not-simplified' : null;
  const ts = traps.map((t) => ({ t, x: readFactors(t.write) }));
  const trap = ts.find(({ x }) => x && sameForm(x, got)) ?? ts.find(({ x }) => x && sameValue(x, got));
  if (trap) return trap.t.code;
  const shaped = /[\^√a-zA-Z]/.test(target);
  if (sameValue(got, want)) return shaped ? 'form' : null;
  const gv = valueOf(got), wv = valueOf(want);
  if (gv.zero && !wv.zero && wv.m.size === 0 && wv.sign > 0) return 'zero-power-zero';
  if (gv.sign < 0 && wv.sign > 0 && [...formOf(want).values()].some((e) => e < 0)) return 'negative-power-negative';
  const gf = formOf(got), wf = formOf(want);
  if (gf.size && gf.size === wf.size && [...wf.keys()].every((k) => gf.has(k))) return 'wrong-index';
  return 'wrong-result';
}

/** The "which x are not allowed?" step: the typed values against the wanted ones, in any order. */
export function judgeExcluded(typed: (string | null)[], want: (number | string)[]): string | null {
  if (!typed.length || typed.some((t) => !t?.trim())) return 'excluded-empty';
  const vals = typed.map((t) => parse(t!)), ws = want.map((w) => Number(w));
  if (vals.some((v) => !v || kindsOf(v).some((k) => k !== '1'))) return 'syntax';
  const got = vals.map((v) => v!['1'] ?? 0);
  const has = (xs: number[], ys: number[]) => ys.every((y) => xs.filter((x) => Math.abs(x - y) < EPS).length >= ys.filter((z) => Math.abs(z - y) < EPS).length);
  if (has(got, ws) && got.length === ws.length) return null;
  if (has(got.map((g) => -g), ws)) return 'excluded-sign';
  if (got.every((g) => ws.some((w) => Math.abs(w - g) < EPS))) return 'excluded-missing';
  return 'excluded-wrong';
}


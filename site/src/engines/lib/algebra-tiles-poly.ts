// Polynomials for <kg-algebra-tiles>: parse what a mission or a learner writes ("x^2 + x - 2", "3(x + 4)", "2√3"),
// compare by coefficients, multiply, divide, and write them back out. Letters are Latin in every locale
// (docs/NOTATION.md); a symbol is one Latin letter or a labelled root such as √3 (kept as a symbol, never simplified).

/** Monomial key → coefficient. Keys: "1" (constant), "x", "x^2", "x*y", "√3", "a^2*b"; symbols in alphabetical order. */
export type Poly = Record<string, number>;

const EPS = 1e-9;
const tidy = (c: number) => (Math.abs(c - Math.round(c)) < EPS ? Math.round(c) : +c.toFixed(9));

/** { x: 2, y: 1 } → "x^2*y"; {} → "1". */
export function keyOf(pows: Record<string, number>): string {
  const parts = Object.keys(pows).filter((s) => pows[s]).sort().map((s) => (pows[s] === 1 ? s : `${s}^${pows[s]}`));
  return parts.length ? parts.join('*') : '1';
}

/** "x^2*y" → { x: 2, y: 1 }; "1" → {}. */
export function powsOf(key: string): Record<string, number> {
  const o: Record<string, number> = {};
  if (key === '1') return o;
  for (const p of key.split('*')) {
    const [s, e] = p.split('^');
    o[s] = e ? Number(e) : 1;
  }
  return o;
}

export const degreeOf = (key: string) => Object.values(powsOf(key)).reduce((a, b) => a + b, 0);

/** Highest degree first; among equal degrees, higher powers of the earlier letter first: x², xy, y², x, y, 1. */
export function kindOrder(a: string, b: string): number {
  const d = degreeOf(b) - degreeOf(a);
  if (d) return d;
  const pa = powsOf(a), pb = powsOf(b);
  for (const s of [...new Set([...Object.keys(pa), ...Object.keys(pb)])].sort()) {
    const e = (pb[s] ?? 0) - (pa[s] ?? 0);
    if (e) return e;
  }
  return 0;
}

export function clean(p: Poly): Poly {
  const o: Poly = {};
  for (const [k, c] of Object.entries(p)) if (Math.abs(c) > EPS) o[k] = tidy(c);
  return o;
}

/** a + k·b */
export function add(a: Poly, b: Poly, k = 1): Poly {
  const o: Poly = { ...a };
  for (const [m, c] of Object.entries(b)) o[m] = (o[m] ?? 0) + k * c;
  return clean(o);
}

export function mulKey(m: string, n: string): string {
  const p = powsOf(m);
  for (const [s, e] of Object.entries(powsOf(n))) p[s] = (p[s] ?? 0) + e;
  return keyOf(p);
}

export function mul(a: Poly, b: Poly): Poly {
  const o: Poly = {};
  for (const [m, c] of Object.entries(a)) for (const [n, d] of Object.entries(b)) {
    const k = mulKey(m, n);
    o[k] = (o[k] ?? 0) + c * d;
  }
  return clean(o);
}

export const isZero = (p: Poly) => Object.keys(clean(p)).length === 0;
export const equal = (a: Poly, b: Poly) => isZero(add(a, b, -1));
/** The kinds (monomial keys) present, in writing order. */
export const kindsOf = (p: Poly) => Object.keys(clean(p)).sort(kindOrder);
export const coef = (p: Poly, k: string) => p[k] ?? 0;

/** Σ c · Π value^power; NaN when a symbol has no value. */
export function evaluate(p: Poly, values: Record<string, number>): number {
  let t = 0;
  for (const [k, c] of Object.entries(p)) {
    let v = c;
    for (const [s, e] of Object.entries(powsOf(k))) v *= (values[s] ?? NaN) ** e;
    t += v;
  }
  return tidy(t);
}

/** Highest common factor of the whole-number coefficients (1 when any is not whole). */
export function content(p: Poly): number {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const cs = Object.values(clean(p));
  if (!cs.length || cs.some((c) => !Number.isInteger(c))) return 1;
  return cs.map(Math.abs).reduce(g);
}

// ---------- reading ----------

type Tok = { t: 'n'; v: number } | { t: 's'; v: string } | { t: 'o'; v: string };

/** Persian/Arabic digits, − × · ² ³ and spaces normalised to ASCII. A number (as YAML gives `1`) is read as its digits. */
export function normalize(src: string | number): string {
  return String(src)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => '^' + '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d))
    .replace(/[\s⁦-⁩‎‏]/g, '');
}

function tokenize(src: string): Tok[] | null {
  const s = normalize(src), out: Tok[] = [];
  for (let i = 0; i < s.length; ) {
    const rest = s.slice(i);
    const m = rest.match(/^\d+(\.\d+)?/) ?? rest.match(/^√(\d+|[a-zA-Z])/) ?? rest.match(/^[a-zA-Z]/) ?? rest.match(/^[-+*^()]/);
    if (!m) return null;
    const v = m[0];
    out.push(/^\d/.test(v) ? { t: 'n', v: Number(v) } : /^[-+*^()]$/.test(v) ? { t: 'o', v } : { t: 's', v });
    i += v.length;
  }
  return out;
}

/** Recursive descent: sum := [±] term (± term)*; term := power ([*] power)*; power := atom [^ n]; atom := n | s | ( sum ). */
function parser(toks: Tok[]) {
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'o' && peek()!.v === v;
  function sumTerms(): Poly[] {
    const terms: Poly[] = [];
    let sign = 1;
    if (isOp('+') || isOp('-')) sign = toks[i++].v === '-' ? -1 : 1;
    terms.push(mul({ '1': sign }, term()));
    while (isOp('+') || isOp('-')) {
      const s = toks[i++].v === '-' ? -1 : 1;
      terms.push(mul({ '1': s }, term()));
    }
    return terms;
  }
  function term(): Poly {
    let p = power();
    for (;;) {
      if (isOp('*')) { i++; p = mul(p, power()); continue; }
      const k = peek();
      if (k && (k.t === 'n' || k.t === 's' || (k.t === 'o' && k.v === '('))) { p = mul(p, power()); continue; }
      return p;
    }
  }
  function power(): Poly {
    const base = atom();
    if (!isOp('^')) return base;
    i++;
    const e = peek();
    if (!e || e.t !== 'n' || !Number.isInteger(e.v) || e.v > 12) throw new Error('power');
    i++;
    let p: Poly = { '1': 1 };
    for (let k = 0; k < e.v; k++) p = mul(p, base);
    return p;
  }
  function atom(): Poly {
    const k = toks[i++];
    if (!k) throw new Error('end');
    if (k.t === 'n') return { '1': k.v };
    if (k.t === 's') return { [k.v]: 1 };
    if (k.v === '(') {
      const inner = sumTerms().reduce((a, b) => add(a, b), {} as Poly);
      if (!isOp(')')) throw new Error(')');
      i++;
      return inner;
    }
    throw new Error(k.v);
  }
  return { sumTerms, done: () => i === toks.length };
}

/** The top-level terms as written, each expanded but not combined: "2x + 3x - 1" → [{x:2}, {x:3}, {1:-1}]. Null if unreadable. */
export function parseTerms(src: string): Poly[] | null {
  const toks = tokenize(src);
  if (!toks || !toks.length) return null;
  try {
    const p = parser(toks);
    const terms = p.sumTerms();
    return p.done() ? terms : null;
  } catch {
    return null;
  }
}

export function parse(src: string): Poly | null {
  const t = parseTerms(src);
  return t ? t.reduce((a, b) => add(a, b), {} as Poly) : null;
}

/** Parse, or throw: for expressions authored in mission YAML. */
export function poly(src: string): Poly {
  const p = parse(src);
  if (!p) throw new Error(`algebra-tiles: cannot read "${src}"`);
  return p;
}

/** Written in one line, every term a single monomial and no two terms alike, nothing zero: 3x² + 2x − 3, not 2x + x − 3. */
export function isCollected(src: string): boolean {
  const terms = parseTerms(src);
  if (!terms) return false;
  const seen = new Set<string>();
  for (const t of terms) {
    const ks = Object.keys(t);
    if (ks.length !== 1 || seen.has(ks[0])) return false;
    seen.add(ks[0]);
  }
  return true;
}

// ---------- writing ----------

/** One monomial with its coefficient, ASCII: 1·x → "x", −1·x² → "-x^2", 2·√3 → "2√3", 5 → "5". */
function monoText(k: string, c: number): string {
  if (k === '1') return String(c);
  const body = k.replace(/\*/g, '');
  return c === 1 ? body : c === -1 ? `-${body}` : `${c}${body}`;
}

/** ASCII in writing order: "3x^2 + 2x - 3"; the zero polynomial is "0". */
export function format(p: Poly): string {
  const ks = kindsOf(p);
  if (!ks.length) return '0';
  return ks.map((k, i) => {
    const t = monoText(k, p[k]);
    return i === 0 ? t : t.startsWith('-') ? `- ${t.slice(1)}` : `+ ${t}`;
  }).join(' ');
}

/** Long division by a polynomial in one letter: n = d·q + r with deg r < deg d. Null if d is zero or uses other letters. */
export function divide(n: Poly, d: Poly, v = 'x'): { q: Poly; r: Poly } | null {
  const deg = (p: Poly) => Math.max(-1, ...kindsOf(p).map((k) => (k === '1' ? 0 : powsOf(k)[v] ?? NaN)));
  const ok = (p: Poly) => kindsOf(p).every((k) => k === '1' || keyOf({ [v]: powsOf(k)[v] ?? 0 }) === k);
  if (isZero(d) || !ok(d) || !ok(n)) return null;
  const dd = deg(d), lead = d[dd ? keyOf({ [v]: dd }) : '1'];
  let q: Poly = {}, r: Poly = clean(n);
  while (!isZero(r) && deg(r) >= dd) {
    const e = deg(r) - dd, k = e ? keyOf({ [v]: e }) : '1';
    const t: Poly = { [k]: r[deg(r) ? keyOf({ [v]: deg(r) }) : '1'] / lead };
    q = add(q, t);
    r = add(r, mul(t, d), -1);
  }
  return { q, r };
}

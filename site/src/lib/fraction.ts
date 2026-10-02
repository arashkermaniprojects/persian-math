// Exact rational arithmetic for answer checking. Never compare fractions as floats.

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export class Frac {
  /** Always stored in lowest terms with a positive denominator. */
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`Frac needs integers: ${n}/${d}`);
    if (d === 0) throw new Error('Frac: zero denominator');
    const g = gcd(n, d) || 1;
    const s = d < 0 ? -1 : 1;
    this.n = (s * n) / g;
    this.d = (s * d) / g;
  }

  static of(v: Frac | number | [number, number]): Frac {
    if (v instanceof Frac) return v;
    return Array.isArray(v) ? new Frac(v[0], v[1]) : new Frac(v);
  }

  add(o: Frac): Frac { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Frac): Frac { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Frac): Frac { return new Frac(this.n * o.n, this.d * o.d); }
  div(o: Frac): Frac { return new Frac(this.n * o.d, this.d * o.n); }
  cmp(o: Frac): number { return Math.sign(this.n * o.d - o.n * this.d); }
  equals(o: Frac): boolean { return this.n === o.n && this.d === o.d; }
  valueOf(): number { return this.n / this.d; }
  toString(): string { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }

  /** Split into whole part and proper remainder, e.g. 7/3 → { whole: 2, rest: 1/3 }. */
  toMixed(): { whole: number; rest: Frac } {
    const whole = Math.trunc(this.n / this.d);
    return { whole, rest: new Frac(this.n - whole * this.d, this.d) };
  }
}

/**
 * A fraction exactly as the learner wrote it (not reduced), so checks can tell
 * "6/8" from "3/4" when a mission asks for simplest form or a given denominator.
 */
export interface WrittenFrac { n: number; d: number; whole?: number }

export function writtenValue(w: WrittenFrac): Frac {
  const base = new Frac(w.n, w.d);
  return w.whole ? base.add(new Frac(w.whole)) : base;
}

export function isSimplest(w: WrittenFrac): boolean {
  return gcd(w.n, w.d) === 1;
}

/** Convert Persian (۰–۹) and Arabic-Indic (٠–٩) digits to ASCII so learners can type with any keyboard. */
export function asciiDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

/**
 * Parse a learner's typed integer in any digit script; null if it isn't one.
 * Thousands separators are ignored (٬ Persian, , and ' Latin, thin/narrow spaces), so ۲٬۳۰۰٬۰۰۰ reads as 2300000.
 */
export function parseInteger(s: string): number | null {
  const t = asciiDigits(s.trim()).replace(/[−–]/g, '-').replace(/(?<=\d)[٬,'\u2009\u202f ](?=\d{3}(?!\d))/g, '');
  return /^-?\d+$/.test(t) ? Number(t) : null;
}

/**
 * Parse a learner's typed decimal exactly (as a fraction), accepting the locale's decimal mark
 * ("/" in Iran, "," in Afghanistan) as well as "." and the Arabic decimal separator "٫".
 * Returns null for anything that isn't a plain decimal number.
 */
export function parseDecimal(s: string, decimalMark = '.'): Frac | null {
  let t = asciiDigits(s.trim()).replace(/[−–]/g, '-');
  for (const mark of new Set([decimalMark, '.', '٫', ','])) t = t.split(mark).join('.');
  const m = t.match(/^(-?)(\d*)(?:\.(\d+))?$/);
  if (!m || (!m[2] && !m[3])) return null;
  const frac = m[3] ?? '';
  const value = new Frac(Number((m[2] || '0') + frac), 10 ** frac.length);
  return m[1] ? new Frac(-value.n, value.d) : value;
}

// Pure place-value arithmetic for <kg-place-value>. Counts are held per place, lowest place first; a place may
// hold 10 or more for a while (ten loose ones before they are bundled), exactly as on the Afghan «چوت».
// Exact: values are built with BigInt and returned as decimal strings ("27", "3.45").

/** Canonical digits of a non-negative number or decimal string, lowest place `lo` first, `n` places. */
export function countsOf(value: number | string, lo: number, n: number): number[] {
  const [int, frac = ''] = String(value).replace(/^\+/, '').split('.');
  // Digit for place p: int digits count from the right of the integer part, fraction digits from the mark.
  return Array.from({ length: n }, (_, i) => {
    const p = lo + i;
    const ch = p >= 0 ? int[int.length - 1 - p] : frac[-p - 1];
    return ch ? Number(ch) : 0;
  });
}

/** Exact value of counts (lowest place `lo` first) as a normalised decimal string. */
export function valueOf(counts: number[], lo: number): string {
  let n = 0n;
  counts.forEach((c, i) => (n += BigInt(c) * 10n ** BigInt(i)));
  // n is the value in units of 10^lo.
  if (lo >= 0) return (n * 10n ** BigInt(lo)).toString();
  const s = n.toString().padStart(-lo + 1, '0');
  const int = s.slice(0, lo), frac = s.slice(lo).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/** Normalise a decimal string or number: no leading/trailing zeros ("03.50" → "3.5"). */
export function normalise(v: number | string): string {
  const [int, frac = ''] = String(v).trim().split('.');
  const i = int.replace(/^0+(?=\d)/, '') || '0', f = frac.replace(/0+$/, '');
  return f ? `${i}.${f}` : i;
}

/** Every place holds a single digit (0–9). */
export const isCanonical = (counts: number[]) => counts.every((c) => c >= 0 && c <= 9);

/** Ten of place i become one of place i + 1. Returns null if that is not possible. */
export function bundle(counts: number[], i: number, max = 19): number[] | null {
  if (i + 1 >= counts.length || counts[i] < 10 || counts[i + 1] >= max) return null;
  const c = counts.slice();
  c[i] -= 10;
  c[i + 1] += 1;
  return c;
}

/** One of place i becomes ten of place i − 1. Returns null if that is not possible. */
export function unbundle(counts: number[], i: number, max = 19): number[] | null {
  if (i < 1 || counts[i] < 1 || counts[i - 1] + 10 > max) return null;
  const c = counts.slice();
  c[i] -= 1;
  c[i - 1] += 10;
  return c;
}

/**
 * Multiply (dir = 1) or divide (dir = −1) by ten: every count slides one place, which is how both countries'
 * books want it taught ("the digits move", never "add a zero"). Null if a non-zero count would fall off the chart.
 */
export function shift(counts: number[], dir: 1 | -1): number[] | null {
  const n = counts.length;
  if (dir === 1 ? counts[n - 1] : counts[0]) return null;
  return dir === 1 ? [0, ...counts.slice(0, n - 1)] : [...counts.slice(1), 0];
}

/** Highest place index at which two count lists differ, or −1. */
export function firstDiff(a: number[], b: number[]): number {
  for (let i = Math.max(a.length, b.length) - 1; i >= 0; i--) if ((a[i] ?? 0) !== (b[i] ?? 0)) return i;
  return -1;
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Roman numeral for 1–3999; '' outside that range. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return '';
  let s = '';
  for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; }
  return s;
}

/** Roman column symbol for a place (I, X, C, M), '' beyond thousands. */
export const romanSymbol = (place: number) => 'IXCM'[place] ?? '';

/** Group the integer part in threes with `sep` (e.g. "1234567.5" → "1,234,567.5" before digit mapping). */
export function groupThrees(v: string, sep: string): string {
  const [int, frac] = v.split('.');
  const g = int.replace(/\B(?=(\d{3})+$)/g, sep);
  return frac === undefined ? g : `${g}.${frac}`;
}

/** Round a whole number to the nearest 10^place (half up, as taught in all three curricula). */
export function roundTo(value: number, place: number): number {
  const u = 10 ** place;
  return Math.floor(value / u + 0.5) * u;
}

/** The engine's default look: the «چوت» abacus for Afghan locales (Dari, Pashto), blocks elsewhere. */
export function defaultView(lang: string): 'abacus' | 'blocks' {
  return /^(fa-AF|ps)\b/i.test(lang) ? 'abacus' : 'blocks';
}

/** Thousands separator for a locale's decimal mark: ٬ beside Iran's "/", a thin space beside Afghanistan's ",". */
export function separatorFor(decimalMark: string): string {
  return decimalMark === '/' ? '٬' : decimalMark === ',' ? ' ' : ',';
}

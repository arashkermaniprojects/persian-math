// Money for <kg-clock-calendar-money>: currencies per locale, default coins and notes, formatting, the fewest pieces
// for an amount, and the diagnosis of wrong amounts (used by the `money-equals` and `money-compare` checks). Pure.
//
// Amounts are whole numbers in the currency's counting unit: toman (or rial) in Iran, afghani, and pence in the UK
// (so £3.45 is 345). Iranian notes are printed in rial but prices are said in toman (×10): a studio can show rial on
// the faces (`face: rial`) while amounts stay in toman (docs/NOTATION.md §9; Iran G2 «معرّفی پول»).

export type Currency = 'IRR' | 'AFN' | 'GBP';
export type MoneyUnit = 'toman' | 'rial';
export type MoneyLocale = 'fa-IR' | 'fa-AF' | 'ps' | 'en';

export const currencyFor = (loc: MoneyLocale): Currency => (loc === 'en' ? 'GBP' : loc === 'fa-IR' ? 'IRR' : 'AFN');

/**
 * Everyday coins and notes, smallest first, and the smallest note. Simplified for children: Iran in toman stops at
 * 10 000 toman (100 000 rial); studios can pass their own `denominations` (e.g. Iran G2's 1, 10, 100 rial coins).
 */
export function currencyDefaults(cur: Currency, unit: MoneyUnit = 'toman'): { denominations: number[]; noteFrom: number } {
  if (cur === 'GBP') return { denominations: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], noteFrom: 500 };
  if (cur === 'AFN') return { denominations: [1, 2, 5, 10, 20, 50, 100, 500, 1000], noteFrom: 10 };
  const toman = [100, 200, 500, 1000, 2000, 5000, 10000];
  return unit === 'rial' ? { denominations: toman.map((v) => v * 10), noteFrom: 10000 } : { denominations: toman, noteFrom: 1000 };
}

const UNIT_WORD: Record<string, Partial<Record<MoneyLocale, string>> & { en: string }> = {
  toman: { 'fa-IR': 'تومان', 'fa-AF': 'تومان', ps: 'تومان', en: 'toman' },
  rial: { 'fa-IR': 'ریال', 'fa-AF': 'ریال', ps: 'ریال', en: 'rial' },
  afghani: { 'fa-IR': 'افغانی', 'fa-AF': 'افغانی', ps: 'افغانۍ', en: 'afghani' },
};

export interface Fmt { digits: string; decimal: string }
const LATIN: Fmt = { digits: '0123456789', decimal: '.' };
const dig = (s: string, f: Fmt) => s.replace(/[0-9]/g, (d) => f.digits[+d]).replace('.', f.decimal);

/** Number and unit as two strings, e.g. {n: '۵۰۰', unit: 'تومان'} or {n: '£3.45', unit: ''} or {n: '50', unit: 'p'}. */
export function moneyParts(v: number, cur: Currency, loc: MoneyLocale, unit: MoneyUnit = 'toman', f: Fmt = LATIN): { n: string; unit: string; before?: boolean } {
  if (cur === 'GBP') {
    if (Math.abs(v) < 100) return { n: dig(String(v), f), unit: 'p' };
    const pounds = v % 100 === 0 ? String(v / 100) : (v / 100).toFixed(2);
    return { n: dig(pounds, f), unit: '£', before: true };
  }
  const word = UNIT_WORD[cur === 'AFN' ? 'afghani' : unit];
  const n = loc === 'en' && v >= 10000 ? v.toLocaleString('en-GB') : String(v);
  return { n: dig(n, f), unit: word[loc] ?? word.en };
}

/** Plain-text amount: "۵۰۰ تومان", "۲۰ افغانۍ", "£3.45", "50p". */
export function formatMoney(v: number, cur: Currency, loc: MoneyLocale, unit: MoneyUnit = 'toman', f: Fmt = LATIN): string {
  const p = moneyParts(v, cur, loc, unit, f);
  return p.before ? p.unit + p.n : p.unit === 'p' ? p.n + p.unit : `${p.n} ${p.unit}`;
}

export const sum = (pieces: number[]) => pieces.reduce((a, b) => a + b, 0);

/** The fewest coins and notes that make `amount` exactly (largest first), or null if it cannot be made. */
export function fewestPieces(amount: number, denominations: number[]): number[] | null {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = denominations.reduce(gcd, 0);
  if (amount < 0 || !g || amount % g) return null;
  // Dynamic programming in units of the common divisor (Iranian toman amounts are all hundreds).
  const n = amount / g, ds = denominations.map((d) => d / g);
  const count = new Array<number>(n + 1).fill(Infinity), last = new Array<number>(n + 1).fill(0);
  count[0] = 0;
  for (let a = 1; a <= n; a++)
    for (const d of ds) if (d <= a && count[a - d] + 1 < count[a]) { count[a] = count[a - d] + 1; last[a] = d; }
  if (count[n] === Infinity) return null;
  const out: number[] = [];
  for (let a = n; a > 0; a -= last[a]) out.push(last[a] * g);
  return out.sort((x, y) => y - x);
}

/** Greedy change (largest first); fine for every default set here, which are all canonical. */
export function greedyPieces(amount: number, denominations: number[]): number[] {
  const out: number[] = [];
  for (const d of [...denominations].sort((x, y) => y - x)) while (amount >= d) { out.push(d); amount -= d; }
  return amount === 0 ? out : [];
}

export interface MoneyRule {
  /** Must also use as few pieces as possible (from `denominations`). */
  fewest?: boolean;
  /** Must use exactly this many pieces. */
  pieces?: number;
  /** Known wrong totals with their own feedback code (e.g. the price instead of the change). */
  traps?: { value: number; code: string }[];
}

/**
 * Why a set of pieces is not the amount `want` (null when right). Codes: `empty`, a trap's code, `too-big`, `too-small`,
 * `piece-count`, `not-fewest`.
 */
export function diagnoseMoney(pieces: number[], want: number, rule: MoneyRule = {}, denominations: number[] = []): string | null {
  if (!pieces.length) return 'empty';
  const got = sum(pieces);
  if (got !== want) return rule.traps?.find((t) => t.value === got)?.code ?? (got > want ? 'too-big' : 'too-small');
  if (rule.pieces !== undefined && pieces.length !== rule.pieces) return 'piece-count';
  if (rule.fewest) {
    const best = fewestPieces(want, denominations.length ? denominations : [...new Set(pieces)]);
    if (best && pieces.length > best.length) return 'not-fewest';
  }
  return null;
}

/**
 * Which group of money the learner should pick: `most`, `least`, or -1 when all are equal (the "same" button).
 * Codes: `empty`, `counted-pieces` (picked the group with the most/fewest pieces instead of the most/least money),
 * `not-equal` (said "same" but they differ), `wrong`.
 */
export function diagnoseCompare(groups: number[][], selected: number | null | undefined, pick: 'most' | 'least'): string | null {
  if (selected == null) return 'empty';
  const totals = groups.map(sum);
  const allEqual = totals.every((t) => t === totals[0]);
  const target = pick === 'most' ? Math.max(...totals) : Math.min(...totals);
  if (allEqual ? selected === -1 : selected >= 0 && totals[selected] === target) return null;
  if (selected === -1) return 'not-equal';
  const counts = groups.map((g) => g.length);
  const extreme = pick === 'most' ? Math.max(...counts) : Math.min(...counts);
  return counts[selected] === extreme && counts.filter((c) => c === extreme).length === 1 ? 'counted-pieces' : 'wrong';
}

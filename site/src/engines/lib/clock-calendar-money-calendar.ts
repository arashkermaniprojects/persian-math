// Calendar maths for <kg-clock-calendar-money>: Solar Hijri ↔ Gregorian, month lengths, weekdays, month grids,
// and month/weekday names per locale (docs/NOTATION.md §8). Pure, so it is unit-tested and needs no Intl:
// old phones often ship without ICU's Persian calendar.
//
// Solar Hijri (Iran and Afghanistan): months 1–6 have 31 days, 7–11 have 30, month 12 has 29 (30 in a leap year).
// Leap years follow the 2820-year "breaks" table of the astronomical calendar (Borkowski's algorithm, as in
// jalaali-js), which matches the official Iranian calendar for 1178–1633 SH.

export type CalSystem = 'solar' | 'gregorian';
import type { CalLocale } from './clock-calendar-money-locale';
export { calLocale, type CalLocale } from './clock-calendar-money-locale';
export interface YMD { y: number; m: number; d: number }

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

/** Leap info for Solar Hijri year jy: leap (0 = leap year), the Gregorian year of its Nowruz, and Nowruz's day in March. */
function solarYearInfo(jy: number) {
  if (jy < BREAKS[0] || jy >= BREAKS[BREAKS.length - 1]) throw new RangeError(`Solar Hijri year out of range: ${jy}`);
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

/** Julian day number of a Gregorian date. */
export function gregorianToJdn(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

export function jdnToGregorian(jdn: number): YMD {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const d = div(mod(i, 153), 5) + 1;
  const m = mod(div(i, 153), 12) + 1;
  const y = div(j, 1461) - 100100 + div(8 - m, 6);
  return { y, m, d };
}

export function solarToJdn(jy: number, jm: number, jd: number): number {
  const r = solarYearInfo(jy);
  return gregorianToJdn(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export function jdnToSolar(jdn: number): YMD {
  const gy = jdnToGregorian(jdn).y;
  let y = gy - 621;
  const r = solarYearInfo(y);
  let k = jdn - gregorianToJdn(gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { y, m: 1 + div(k, 31), d: mod(k, 31) + 1 };
    k -= 186;
  } else {
    y -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { y, m: 7 + div(k, 30), d: mod(k, 30) + 1 };
}

export const solarToGregorian = (y: number, m: number, d: number): YMD => jdnToGregorian(solarToJdn(y, m, d));
export const gregorianToSolar = (y: number, m: number, d: number): YMD => jdnToSolar(gregorianToJdn(y, m, d));

export const isSolarLeap = (y: number) => solarYearInfo(y).leap === 0;
export const isGregorianLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function monthLength(sys: CalSystem, y: number, m: number): number {
  if (sys === 'solar') return m <= 6 ? 31 : m <= 11 ? 30 : isSolarLeap(y) ? 30 : 29;
  return m === 2 ? (isGregorianLeap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export const toJdn = (sys: CalSystem, y: number, m: number, d: number) =>
  sys === 'solar' ? solarToJdn(y, m, d) : gregorianToJdn(y, m, d);

/** Day of the week, 0 = Sunday … 6 = Saturday (as in JavaScript's Date). */
export const weekday = (sys: CalSystem, y: number, m: number, d: number) => mod(toJdn(sys, y, m, d) + 1, 7);

/** The month `delta` months after (y, m). */
export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const t = y * 12 + (m - 1) + delta;
  return { y: Math.floor(t / 12), m: (((t % 12) + 12) % 12) + 1 };
}

/** Weeks of a month as rows of 7 day numbers (null = blank), the first column being `weekStart` (0 = Sunday). */
export function monthGrid(sys: CalSystem, y: number, m: number, weekStart: number): (number | null)[][] {
  const lead = (weekday(sys, y, m, 1) - weekStart + 7) % 7;
  const n = monthLength(sys, y, m);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ---- names (docs/NOTATION.md §8; Afghan names confirmed in AF_G03_riazi(_ps) «جنتری») ----

export const MONTHS: Record<CalLocale, string[]> = {
  'fa-IR': ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
  'fa-AF': ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت'],
  ps: ['وری', 'غویی', 'غبرګولی', 'چنګاښ', 'زمری', 'وږی', 'تله', 'لړم', 'لیندۍ', 'مرغومی', 'سلواغه', 'کب'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// Indexed by JavaScript weekday (0 = Sunday). The Afghan calendars in both G3 books print the Persian names.
const FA_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
export const WEEKDAYS: Record<CalLocale, string[]> = {
  'fa-IR': FA_DAYS,
  'fa-AF': FA_DAYS,
  ps: ['یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
/** One- or two-letter column heads, as on Iranian wall calendars (ش ی د س چ پ ج). */
const FA_SHORT = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];
export const WEEKDAYS_SHORT: Record<CalLocale, string[]> = {
  'fa-IR': FA_SHORT, 'fa-AF': FA_SHORT, ps: FA_SHORT,
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
};

/** Calendar conventions per locale: system, first day of the week, rest days. */
export function calendarDefaults(loc: CalLocale): { system: CalSystem; weekStart: number; weekend: number[] } {
  return loc === 'en' ? { system: 'gregorian', weekStart: 1, weekend: [6, 0] } : { system: 'solar', weekStart: 6, weekend: [5] };
}

/** A date to find, in the shown calendar system. All parts optional; `day: 'last'` is the month's last day. */
export interface DateRule { day?: number | 'last'; month?: number; year?: number; weekday?: number }

/**
 * Why the tapped date does not match the rule (null when it does). Codes: `empty`, `wrong-year`, `wrong-month`,
 * `off-by-one` (one day out: counted the start day), `wrong-week` (right weekday, wrong week), `too-late`,
 * `too-early`, `wrong-weekday`.
 */
export function diagnoseDate(sys: CalSystem, got: YMD | null | undefined, rule: DateRule): string | null {
  if (!got) return 'empty';
  if (rule.year !== undefined && got.y !== rule.year) return 'wrong-year';
  if (rule.month !== undefined && got.m !== rule.month) return 'wrong-month';
  if (rule.day !== undefined) {
    const want = rule.day === 'last' ? monthLength(sys, got.y, got.m) : rule.day;
    const diff = got.d - want;
    if (diff) return Math.abs(diff) === 1 ? 'off-by-one' : diff % 7 === 0 ? 'wrong-week' : diff > 0 ? 'too-late' : 'too-early';
  }
  if (rule.weekday !== undefined && weekday(sys, got.y, got.m, got.d) !== rule.weekday) return 'wrong-weekday';
  return null;
}

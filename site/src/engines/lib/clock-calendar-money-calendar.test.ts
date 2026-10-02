import { describe, expect, it } from 'vitest';
import {
  addMonths, calLocale, calendarDefaults, diagnoseDate, gregorianToJdn, gregorianToSolar, isSolarLeap, jdnToGregorian, monthGrid,
  monthLength, MONTHS, solarToGregorian, weekday, WEEKDAYS,
} from './clock-calendar-money-calendar';

describe('Solar Hijri ↔ Gregorian', () => {
  it('converts known Nowruz dates (1 Farvardin)', () => {
    expect(solarToGregorian(1300, 1, 1)).toEqual({ y: 1921, m: 3, d: 21 });
    expect(solarToGregorian(1385, 1, 1)).toEqual({ y: 2006, m: 3, d: 21 }); // AF_G03 «حمل – وری ۱۳۸۵»: 21 March, a Tuesday
    expect(solarToGregorian(1403, 1, 1)).toEqual({ y: 2024, m: 3, d: 20 });
    expect(solarToGregorian(1404, 1, 1)).toEqual({ y: 2025, m: 3, d: 21 });
    expect(solarToGregorian(1405, 1, 1)).toEqual({ y: 2026, m: 3, d: 21 });
  });

  it('converts other known dates both ways', () => {
    expect(gregorianToSolar(2026, 10, 2)).toEqual({ y: 1405, m: 7, d: 10 }); // 10 Mehr 1405
    expect(gregorianToSolar(1979, 2, 11)).toEqual({ y: 1357, m: 11, d: 22 });
    expect(gregorianToSolar(2000, 1, 1)).toEqual({ y: 1378, m: 10, d: 11 });
    expect(gregorianToSolar(2025, 3, 20)).toEqual({ y: 1403, m: 12, d: 30 }); // 1403 is a leap year
    expect(solarToGregorian(1399, 12, 30)).toEqual({ y: 2021, m: 3, d: 20 });
    expect(solarToGregorian(1405, 7, 1)).toEqual({ y: 2026, m: 9, d: 23 });
  });

  it('round-trips every day from 1300 to 1500 SH and stays consecutive', () => {
    let jdn = gregorianToJdn(1921, 3, 21);
    for (let y = 1300; y < 1500; y++)
      for (let m = 1; m <= 12; m++)
        for (let d = 1; d <= monthLength('solar', y, m); d++) {
          const g = solarToGregorian(y, m, d);
          expect(gregorianToJdn(g.y, g.m, g.d)).toBe(jdn);
          expect(gregorianToSolar(g.y, g.m, g.d)).toEqual({ y, m, d });
          jdn++;
        }
  }, 30_000); // exhaustive day-by-day loop: generous timeout for busy machines

  it('matches the platform Persian calendar (ICU in Node) for 1340–1460 SH', () => {
    // Used only as an independent oracle in the test; the engine itself never depends on Intl.
    const f = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = (t: number) => Object.fromEntries(f.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    if (!/^1\d{3}/.test(parts(Date.UTC(2026, 9, 2)).year ?? '')) return; // no ICU Persian data here: skip
    for (let t = Date.UTC(1961, 2, 21); t < Date.UTC(2081, 2, 21); t += 86400000) {
      const g = new Date(t);
      const p = parts(t);
      const s = gregorianToSolar(g.getUTCFullYear(), g.getUTCMonth() + 1, g.getUTCDate());
      expect([s.y, s.m, s.d]).toEqual([parseInt(p.year), parseInt(p.month), parseInt(p.day)]);
    }
  }, 30_000);

  it('jdn ↔ Gregorian round-trips across century leap rules', () => {
    for (const [y, m, d] of [[1900, 2, 28], [1900, 3, 1], [2000, 2, 29], [2100, 3, 1], [1582, 10, 15]])
      expect(jdnToGregorian(gregorianToJdn(y, m, d))).toEqual({ y, m, d });
    expect(gregorianToJdn(2000, 3, 1) - gregorianToJdn(2000, 2, 28)).toBe(2);
    expect(gregorianToJdn(1900, 3, 1) - gregorianToJdn(1900, 2, 28)).toBe(1);
  });
});

describe('month lengths and leap years', () => {
  it('Solar Hijri: first six months 31 days, then 30, Esfand 29 or 30', () => {
    for (let m = 1; m <= 6; m++) expect(monthLength('solar', 1405, m)).toBe(31);
    for (let m = 7; m <= 11; m++) expect(monthLength('solar', 1405, m)).toBe(30);
    expect(monthLength('solar', 1404, 12)).toBe(29);
    expect(monthLength('solar', 1403, 12)).toBe(30);
    expect([1399, 1403, 1408].map(isSolarLeap)).toEqual([true, true, true]);
    expect([1400, 1401, 1402, 1404, 1405].map(isSolarLeap)).toEqual([false, false, false, false, false]);
  });

  it('Gregorian', () => {
    expect(monthLength('gregorian', 2024, 2)).toBe(29);
    expect(monthLength('gregorian', 2026, 2)).toBe(28);
    expect(monthLength('gregorian', 1900, 2)).toBe(28);
    expect(monthLength('gregorian', 2000, 2)).toBe(29);
    expect([1, 3, 4, 9, 12].map((m) => monthLength('gregorian', 2026, m))).toEqual([31, 31, 30, 30, 31]);
  });

  it('a Solar Hijri year has 365 or 366 days', () => {
    for (let y = 1390; y < 1420; y++) {
      const days = Array.from({ length: 12 }, (_, i) => monthLength('solar', y, i + 1)).reduce((a, b) => a + b);
      expect(days).toBe(isSolarLeap(y) ? 366 : 365);
    }
  });
});

describe('weekdays and grids', () => {
  it('weekday: 0 = Sunday', () => {
    expect(weekday('gregorian', 2026, 10, 2)).toBe(5); // Friday
    expect(weekday('solar', 1405, 7, 10)).toBe(5);
    expect(weekday('solar', 1385, 1, 1)).toBe(2); // Tuesday (the G3 Afghan calendar)
    expect(weekday('gregorian', 2000, 1, 1)).toBe(6); // Saturday
  });

  it('Mehr 1405 starts on a Wednesday; with Saturday first it has 4 blanks', () => {
    const g = monthGrid('solar', 1405, 7, 6);
    expect(g[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(g.flat().filter((x) => x !== null)).toHaveLength(30);
    expect(g.every((r) => r.length === 7)).toBe(true);
    expect(g[g.length - 1]).toContain(30);
  });

  it('October 2026 with Monday first', () => {
    const g = monthGrid('gregorian', 2026, 10, 1);
    expect(g[0]).toEqual([null, null, null, 1, 2, 3, 4]); // 1 Oct 2026 is a Thursday
    expect(g).toHaveLength(5);
  });

  it('a month starting on the first day of the week has no blanks', () => {
    // 1 Farvardin 1404 (21 March 2025) is a Friday; 1 Dey 1404 (22 Dec 2025) is a Monday.
    expect(monthGrid('solar', 1404, 1, 5)[0][0]).toBe(1);
    expect(monthGrid('gregorian', 2025, 12, 1)[0][0]).toBe(1);
  });

  it('addMonths wraps years both ways', () => {
    expect(addMonths(1404, 12, 1)).toEqual({ y: 1405, m: 1 });
    expect(addMonths(1405, 1, -1)).toEqual({ y: 1404, m: 12 });
    expect(addMonths(2026, 5, 14)).toEqual({ y: 2027, m: 7 });
    expect(addMonths(2026, 5, -17)).toEqual({ y: 2024, m: 12 });
  });
});

describe('locale conventions', () => {
  it('maps <html lang> to calendar locales', () => {
    expect(calLocale('fa-IR')).toBe('fa-IR');
    expect(calLocale('fa-AF')).toBe('fa-AF');
    expect(calLocale('ps-AF')).toBe('ps');
    expect(calLocale('en')).toBe('en');
    expect(calLocale('')).toBe('en');
  });

  it('month names follow NOTATION.md §8', () => {
    expect(MONTHS['fa-IR'][0]).toBe('فروردین');
    expect(MONTHS['fa-IR'][11]).toBe('اسفند');
    expect(MONTHS['fa-AF'][0]).toBe('حمل');
    expect(MONTHS['fa-AF'][9]).toBe('جدی');
    expect(MONTHS.ps[0]).toBe('وری');
    expect(MONTHS.ps[11]).toBe('کب');
    for (const l of Object.values(MONTHS)) expect(l).toHaveLength(12);
    for (const l of Object.values(WEEKDAYS)) expect(l).toHaveLength(7);
  });

  it('the week starts on Saturday in fa-IR, fa-AF and ps, Monday in en', () => {
    expect(calendarDefaults('fa-IR')).toMatchObject({ system: 'solar', weekStart: 6, weekend: [5] });
    expect(calendarDefaults('ps').weekStart).toBe(6);
    expect(calendarDefaults('en')).toMatchObject({ system: 'gregorian', weekStart: 1 });
    expect(WEEKDAYS['fa-IR'][6]).toBe('شنبه');
  });
});

describe('diagnoseDate', () => {
  const mehr = (d: number) => ({ y: 1405, m: 7, d });
  it('one week after the 5th is the 12th', () => {
    expect(diagnoseDate('solar', mehr(12), { day: 12 })).toBeNull();
    expect(diagnoseDate('solar', null, { day: 12 })).toBe('empty');
    expect(diagnoseDate('solar', mehr(11), { day: 12 })).toBe('off-by-one');
    expect(diagnoseDate('solar', mehr(13), { day: 12 })).toBe('off-by-one');
    expect(diagnoseDate('solar', mehr(19), { day: 12 })).toBe('wrong-week');
    expect(diagnoseDate('solar', mehr(5), { day: 12 })).toBe('wrong-week');
    expect(diagnoseDate('solar', mehr(20), { day: 12 })).toBe('too-late');
    expect(diagnoseDate('solar', mehr(9), { day: 12 })).toBe('too-early');
  });

  it('the last day depends on the month and system', () => {
    expect(diagnoseDate('solar', { y: 1405, m: 1, d: 31 }, { day: 'last' })).toBeNull();
    expect(diagnoseDate('solar', { y: 1405, m: 7, d: 30 }, { day: 'last' })).toBeNull();
    expect(diagnoseDate('solar', { y: 1405, m: 7, d: 29 }, { day: 'last' })).toBe('off-by-one');
    expect(diagnoseDate('gregorian', { y: 2026, m: 2, d: 28 }, { day: 'last' })).toBeNull();
  });

  it('checks month, year and weekday', () => {
    expect(diagnoseDate('solar', { y: 1405, m: 1, d: 1 }, { month: 1, day: 1 })).toBeNull();
    expect(diagnoseDate('solar', { y: 1404, m: 12, d: 1 }, { month: 1, day: 1 })).toBe('wrong-month');
    expect(diagnoseDate('solar', { y: 1404, m: 1, d: 1 }, { year: 1405, month: 1, day: 1 })).toBe('wrong-year');
    expect(diagnoseDate('solar', mehr(10), { weekday: 5 })).toBeNull(); // a Friday
    expect(diagnoseDate('solar', mehr(11), { weekday: 5 })).toBe('wrong-weekday');
  });
});

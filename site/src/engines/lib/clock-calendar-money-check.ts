// Answer checking for <kg-clock-calendar-money> (check types `time-equals`, `date-equals`, `money-equals`,
// `money-compare`; docs/STUDIOS.md). Pure, so lib/checks.ts can use it.
import { diagnoseDate, type CalSystem, type DateRule, type YMD } from './clock-calendar-money-calendar';
import { diagnoseTime, parseTime } from './clock-calendar-money-clock';
import { diagnoseCompare, diagnoseMoney, type Currency } from './clock-calendar-money-money';

/** A number, or one number per currency (amounts differ: 500 toman, 20 afghani, 50p). */
type PerCurrency = number | Partial<Record<Currency, number>>;

export type CcmCheck =
  /** The clock shows `value` ("7:30"). `h24`: morning and afternoon differ. `clock`: which clock (default the first the learner can change). */
  | { type: 'time-equals'; value: string; h24?: boolean; clock?: number }
  /** The tapped day matches. `solar` / `gregorian` hold per-calendar rules that override the shared ones. */
  | ({ type: 'date-equals'; solar?: DateRule; gregorian?: DateRule } & DateRule)
  /** The purse holds `value`. `fewest`: as few pieces as possible; `pieces`: exactly n pieces; `traps`: known wrong totals. */
  | { type: 'money-equals'; value: PerCurrency; fewest?: boolean; pieces?: number; traps?: { value: PerCurrency; code: string }[] }
  /** The learner picked the group with the most (or least) money, or "same" when all groups are equal. */
  | { type: 'money-compare'; pick?: 'most' | 'least' };

export const CCM_CHECKS = ['time-equals', 'date-equals', 'money-equals', 'money-compare'] as const;

export interface CcmState {
  clocks?: { time: string; interactive: boolean }[];
  calendar?: { system: CalSystem; date: YMD | null };
  money?: { currency: Currency; pieces: number[]; denominations: number[]; groups?: number[][]; selected?: number | null };
}

type Result = { ok: boolean; code?: string };
const res = (code: string | null): Result => (code ? { ok: false, code } : { ok: true });
const forCur = (v: PerCurrency, cur: Currency) => (typeof v === 'number' ? v : v[cur]);

export function checkCcm(check: CcmCheck, state?: CcmState): Result {
  switch (check.type) {
    case 'time-equals': {
      const clocks = state?.clocks ?? [];
      const c = clocks[check.clock ?? Math.max(0, clocks.findIndex((k) => k.interactive))];
      if (!c) return res('empty');
      return res(diagnoseTime(parseTime(c.time), parseTime(check.value), check.h24));
    }
    case 'date-equals': {
      const cal = state?.calendar;
      if (!cal) return res('empty');
      const { type: _t, solar, gregorian, ...shared } = check;
      return res(diagnoseDate(cal.system, cal.date, { ...shared, ...(cal.system === 'solar' ? solar : gregorian) }));
    }
    case 'money-equals': {
      const m = state?.money;
      if (!m) return res('empty');
      const want = forCur(check.value, m.currency);
      if (want === undefined) throw new Error(`money-equals: no value for ${m.currency}`);
      const traps = (check.traps ?? []).flatMap((t) => {
        const v = forCur(t.value, m.currency);
        return v === undefined ? [] : [{ value: v, code: t.code }];
      });
      return res(diagnoseMoney(m.pieces, want, { fewest: check.fewest, pieces: check.pieces, traps }, m.denominations));
    }
    case 'money-compare': {
      const m = state?.money;
      return res(diagnoseCompare(m?.groups ?? [], m?.selected, check.pick ?? 'most'));
    }
  }
}

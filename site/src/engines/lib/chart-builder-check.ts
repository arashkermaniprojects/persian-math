// Answer checking for <kg-chart-builder> (check type `chart`, docs/STUDIOS.md). Pure, so lib/checks.ts can use it.

export interface ChartCheck {
  type: 'chart';
  /** Tally marks per category (category order). */
  tally?: number[];
  /** Numbers typed in the table's count column («تعداد»). */
  typed?: number[];
  /** Chart values per category, in data units (a pictogram symbol is worth `key`). */
  values?: number[];
  /** Levelling: every bar the same height and nothing left in the hand. */
  level?: boolean;
  /** Category key(s) the learner must tap (e.g. the most popular, the mode). */
  pick?: string | string[];
  /** Chart type(s) the learner must choose («انتخاب نمودار»). */
  chosen?: string | string[];
  /** Known wrong picks or chart choices with their own feedback code. */
  traps?: { pick?: string; chosen?: string; code: string }[];
}

export interface ChartState {
  /** Tally marks per category. */
  tally?: number[];
  /** Typed counts per category (null = blank). */
  typed?: (number | null)[];
  /** Chart values per category, in data units. */
  values?: number[];
  /** What one pictogram symbol, pie sector or grid step is worth (for `key-ignored`). */
  unit?: number;
  /** Levelling: units taken off bars and not yet given back. */
  pool?: number;
  /** Survey cards not yet tallied. */
  left?: number;
  /** Category key the learner tapped. */
  cat?: string | null;
  /** Chart type the learner chose. */
  chart?: string | null;
}

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });
const list = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

/**
 * Order: tally → typed → values → level → pick → chosen. Codes:
 * tally: `empty`, `cards-left`, `tally-few`, `tally-many`, `tally-wrong`;
 * typed: `empty`, `count-empty`, `gate-as-four` (a group of five read as 4), `count-wrong`;
 * values: `empty`, `key-ignored` (one symbol or grid step per item), `half-needed` (off by part of a symbol), `too-high`/`too-low`;
 * level: `pool-left`, `not-level`; pick: `empty`, trap code, `wrong-pick`; chosen: `empty`, trap code, `wrong-chart`.
 */
export function checkChart(check: ChartCheck, s: ChartState = {}): Result {
  if (check.tally) {
    const got = s.tally ?? [];
    const want = check.tally;
    if (!sum(got)) return fail('empty');
    if (!want.every((w, i) => (got[i] ?? 0) === w)) {
      if (s.left) return fail('cards-left');
      const d = sum(got) - sum(want);
      return fail(d < 0 ? 'tally-few' : d > 0 ? 'tally-many' : 'tally-wrong');
    }
  }
  if (check.typed) {
    const got = s.typed ?? [];
    if (got.every((v) => v == null)) return fail('empty');
    if (check.typed.some((_, i) => got[i] == null)) return fail('count-empty');
    const bad = check.typed.findIndex((w, i) => got[i] !== w);
    if (bad >= 0) {
      const w = check.typed[bad];
      return fail(w >= 5 && got[bad] === w - Math.floor(w / 5) ? 'gate-as-four' : 'count-wrong');
    }
  }
  if (check.values) {
    const got = s.values ?? [];
    const want = check.values;
    const unit = s.unit ?? 1;
    if (!sum(got) && sum(want)) return fail('empty');
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    if (!want.every((w, i) => near(got[i] ?? 0, w))) {
      if (unit > 1 && want.every((w, i) => near(got[i] ?? 0, w * unit))) return fail('key-ignored');
      const off = want.flatMap((w, i) => (near(got[i] ?? 0, w) ? [] : [[w, (got[i] ?? 0) - w]]));
      const wrong = off.map(([, d]) => d);
      // Every wrong value needs part of a symbol (or a step) and is less than one symbol away.
      if (unit > 1 && off.every(([w, d]) => Math.abs(d) < unit && !near(w % unit, 0))) return fail('half-needed');
      return fail(wrong[0] > 0 ? 'too-high' : 'too-low');
    }
  }
  if (check.level) {
    if (s.pool) return fail('pool-left');
    const v = s.values ?? [];
    if (v.some((x) => x !== v[0])) return fail('not-level');
  }
  if (check.pick !== undefined) {
    if (s.cat == null) return fail('empty');
    if (!list(check.pick).includes(s.cat)) return fail(check.traps?.find((t) => t.pick === s.cat)?.code ?? 'wrong-pick');
  }
  if (check.chosen !== undefined) {
    if (s.chart == null) return fail('empty');
    if (!list(check.chosen).includes(s.chart)) return fail(check.traps?.find((t) => t.chosen === s.chart)?.code ?? 'wrong-chart');
  }
  return { ok: true };
}

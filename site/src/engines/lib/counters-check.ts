// The `counters` check: compares a <kg-counters> state with what a mission asks for (docs/STUDIOS.md).
import type { CountersState, ZoneState } from './counters-model';

/**
 * Every field is optional; the check passes when all the given ones hold. Conditions are tested in this
 * order and the first failure gives the reason code:
 * count → marked → left → equal → each → colors → array/rect → tree → pick.
 */
export interface CountersCheck {
  type: 'counters';
  /** Zones that sums, `equal`, `each`, `colors`, `array` and `tree` look at (default: all). */
  in?: number[];
  /** Counters present (marked ones included): a total over `in`, or one entry per zone (null = any). */
  count?: number | (number | null)[];
  /** Counters crossed out or circled: a total over `in`, or one entry per zone (null = any). */
  marked?: number | (number | null)[];
  /** Counters left after taking away: count − marked over `in`. */
  left?: number;
  /** Every zone in `in` holds the same number of counters (sharing). */
  equal?: boolean;
  /** Every zone in `in` holds exactly this many counters (equal groups of `each`). */
  each?: number;
  /** Unmarked [red, yellow] over `in`. */
  colors?: [number, number];
  /** The first array zone in `in` has [rows, cols]. */
  array?: [number, number];
  /** The first array zone in `in` is a full rectangle (no short last row). */
  rect?: boolean;
  /** `colors` and `array` also accept the two numbers swapped (3 + 7 or 7 + 3; 3 × 4 or 4 × 3). */
  anyOrder?: boolean;
  /** The first factor tree in `in` ends in primes only. */
  tree?: boolean;
  /** The number picked from the tiles. */
  pick?: number;
  /** Known wrong picks with their own feedback code, e.g. the number taken away instead of the number left. */
  traps?: { pick: number; code: string }[];
}

type Result = { ok: true } | { ok: false; code: string };
const fail = (code: string): Result => ({ ok: false, code });
const size = (got: number, want: number, more: string, fewer: string) => (got > want ? more : fewer);
const same = (a: number[], b: number[], anyOrder?: boolean) =>
  (a[0] === b[0] && a[1] === b[1]) || (!!anyOrder && a[0] === b[1] && a[1] === b[0]);

/** Compare a per-zone or total quantity; returns a failing code or null. */
function compareBy(zones: ZoneState[], picked: ZoneState[], want: number | (number | null)[], f: (z: ZoneState) => number, more: string, fewer: string) {
  if (typeof want === 'number') {
    const got = picked.reduce((s, z) => s + f(z), 0);
    return got === want ? null : size(got, want, more, fewer);
  }
  for (let i = 0; i < want.length; i++) {
    const w = want[i];
    if (w === null || w === undefined) continue;
    const got = zones[i] ? f(zones[i]) : 0;
    if (got !== w) return size(got, w, more, fewer);
  }
  return null;
}

export function checkCounters(c: CountersCheck, s: Partial<CountersState> | undefined): Result {
  const zones = s?.zones ?? [];
  const sel = c.in ? c.in.map((i) => zones[i]).filter(Boolean) : zones;
  let code: string | null = null;
  if (c.count !== undefined && (code = compareBy(zones, sel, c.count, (z) => z.count, 'too-many', 'too-few'))) return fail(code);
  if (c.marked !== undefined && (code = compareBy(zones, sel, c.marked, (z) => z.marked, 'marked-too-many', 'marked-too-few'))) return fail(code);
  if (c.left !== undefined && (code = compareBy(zones, sel, c.left, (z) => z.count - z.marked, 'too-many', 'too-few'))) return fail(code);
  if (c.equal && sel.some((z) => z.count !== sel[0].count)) return fail('not-equal');
  if (c.each !== undefined) {
    if (sel.some((z) => z.count !== sel[0].count)) return fail('not-equal');
    if (!sel.length || sel[0].count !== c.each) return fail(size(sel[0]?.count ?? 0, c.each, 'too-many', 'too-few'));
  }
  if (c.colors) {
    const got = sel.reduce((t, z) => [t[0] + z.colors[0], t[1] + z.colors[1]], [0, 0]);
    if (!same(got, c.colors, c.anyOrder)) return fail('wrong-colors');
  }
  if (c.array || c.rect) {
    const a = sel.find((z) => z.rows !== undefined);
    if (!a) return fail('wrong-array');
    if (c.rect && a.count !== a.rows! * a.cols!) return fail('not-rect');
    if (c.array && !same([a.rows!, a.cols!], c.array, c.anyOrder)) return fail('wrong-array');
  }
  if (c.tree && !sel.find((z) => z.leaves)?.done) return fail('tree-unfinished');
  if (c.pick !== undefined) {
    const p = s?.picked;
    if (p === null || p === undefined) return fail('empty');
    if (p !== c.pick) return fail(c.traps?.find((t) => t.pick === p)?.code ?? size(p, c.pick, 'too-big', 'too-small'));
  }
  return { ok: true };
}

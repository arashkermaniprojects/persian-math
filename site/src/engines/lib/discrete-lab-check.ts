// Answer checking for <kg-discrete-lab> (check type `sets`, docs/STUDIOS.md). Pure, so lib/checks.ts can use it.
import { exprRegions, inRegion, OUT, repeats, sameSet, setsOf, symbolFamily, type Region } from './discrete-lab-sets';

type Val = string | number;

export interface SetsTrap {
  code: string;
  /** A card put in a region. */
  item?: Val;
  region?: Region;
  /** A region count (`count` = region, `value` = the number), a table cell (`cell` = "r,c", `value`) or a written set (`written` = its key, `value` = its elements). */
  count?: Region;
  cell?: string;
  written?: string;
  value?: number | Val[];
  /** The shading equals this expression (e.g. "A ∩ B" when A ∪ B was asked). */
  shaded?: string;
  /** The ovals drawn this way (e.g. "B⊆C" when C⊆B was asked). */
  layout?: string;
  /** A statement row answered with this option. */
  row?: string;
  pick?: string;
  /** The typed whole number. */
  answer?: number;
}

export interface SetsCheck {
  type: 'sets';
  /** Cards per region: every listed card must be in that region ("A", "AB", "out", …). */
  regions?: Record<Region, Val[]>;
  /** Each set's elements from the cards, in any order. */
  members?: Record<string, Val[]>;
  /** Region counts (counts mode). */
  counts?: Record<Region, number>;
  /** The ovals are drawn this way: "X⊆Y" (X inside Y), "apart" or "overlap". */
  subset?: string;
  /** The shaded regions are exactly this set expression (A ∪ B, A ∩ B, A − B, A′, …). */
  shaded?: string;
  /** Sets written in braces, by their key: any order, each element once ([] = the empty set). */
  written?: Record<string, Val[]>;
  /** Every statement row is answered with a true option. */
  rows?: boolean;
  /** Every cell to fill in the two-way table is right. */
  table?: boolean;
  /** The typed whole number (`answer: integer`). */
  answer?: number;
  /** The typed fraction (`answer: fraction`), e.g. a probability read from the table. */
  probability?: [number, number];
  traps?: SetsTrap[];
}

/** A statement row: the option picked and every option that makes the statement true. */
export interface SetsRow { key: string; picked: string | null; truth: string[] }

export interface SetsState {
  /** Where each card is: a region, or null while it is still in the tray. */
  regions?: Record<string, Region | null>;
  /** Each set's elements, from the cards (or the mission's `define`). */
  members?: Record<string, string[]>;
  /** The regions of the drawing as it is now, and the shaded ones. */
  drawn?: Region[];
  shaded?: Region[];
  layout?: string;
  counts?: Record<Region, number | null>;
  written?: Record<string, string[]>;
  rows?: SetsRow[];
  table?: { cells: Record<string, number | null>; truth: Record<string, number> };
  /** Module `tree` (prob-trees-counting) reports its branches here; checked by its own `tree` condition. */
  tree?: unknown;
}

export interface SetsInput { integer?: number | null; fraction?: { n: number; d: number; whole?: number } | null }

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });
const S = (v: Val) => String(v);
const norm = (l: string) => l.replace(/\s+/g, '');

function checkLayout(check: SetsCheck, layout = 'overlap'): Result | null {
  if (!check.subset) return null;
  const want = norm(check.subset), got = norm(layout);
  if (got === want) return null;
  const t = check.traps?.find((t) => t.layout && norm(t.layout) === got);
  if (t) return fail(t.code);
  const [x, y] = want.split('⊆');
  return fail(y && got === `${y}⊆${x}` ? 'subset-reversed' : 'layout-wrong');
}

/**
 * Conditions are tested in this order (a wrong nesting or separation of the ovals comes first):
 * regions → members → counts → subset → shaded → written → rows → table → answer → probability. */
export function checkSets(check: SetsCheck, s: SetsState = {}, input: SetsInput = {}): Result {
  const traps = check.traps ?? [];
  const subset = checkLayout(check, s.layout);
  // A wrong nesting or separation is named first: it moves cards out of regions that no longer exist.
  if (subset && norm(s.layout ?? 'overlap') !== 'overlap') return subset;
  if (check.regions) {
    const want = Object.entries(check.regions).flatMap(([r, items]) => items.map((i) => [S(i), r] as const));
    const got = s.regions ?? {};
    if (want.some(([i]) => got[i] == null)) return fail('cards-left');
    const wrong = want.filter(([i, r]) => got[i] !== r);
    if (wrong.length) {
      for (const [i] of wrong) {
        const t = traps.find((t) => t.item !== undefined && S(t.item) === i && t.region === got[i]);
        if (t) return fail(t.code);
      }
      const [i, r] = wrong[0], a = got[i]!;
      if (r !== OUT && a !== OUT && setsOf(a).every((x) => inRegion(r, x))) return fail('in-both');
      return fail(r === OUT ? 'not-a-member' : a === OUT ? 'is-a-member' : 'region-wrong');
    }
  }
  if (check.members) {
    for (const [set, items] of Object.entries(check.members)) {
      const got = s.members?.[set] ?? [], want = items.map(S);
      if (want.some((x) => !got.includes(x))) return fail('members-missing');
      if (got.some((x) => !want.includes(x))) return fail('members-extra');
    }
  }
  if (check.counts) {
    const got = s.counts ?? {};
    const keys = Object.keys(check.counts);
    if (keys.some((r) => got[r] == null)) return fail('count-empty');
    const bad = keys.find((r) => got[r] !== check.counts![r]);
    if (bad) {
      const t = traps.find((t) => t.count && keys.includes(t.count) && got[t.count] === t.value && got[t.count] !== check.counts![t.count]);
      return fail(t?.code ?? 'count-wrong');
    }
  }
  if (subset) return subset;
  if (check.shaded) {
    const L = { regions: s.drawn ?? [] };
    const got = s.shaded ?? [], want = exprRegions(check.shaded, L);
    if (!got.length) return fail('shade-empty');
    if (!sameSet(got, want)) {
      const t = traps.find((t) => t.shaded && sameSet(got, exprRegions(t.shaded, L)));
      if (t) return fail(t.code);
      if (want.includes(OUT) && sameSet(got, want.filter((r) => r !== OUT))) return fail('outside-missed');
      return fail(got.every((r) => want.includes(r)) ? 'shade-missing' : 'shade-extra');
    }
  }
  if (check.written) {
    for (const [key, items] of Object.entries(check.written)) {
      const got = s.written?.[key] ?? [], want = items.map(S);
      if (!got.length && want.length) return fail('write-empty');
      const twice = repeats(got);
      if (twice.length) {
        // An element of the overlap written once for each set: the classic A ∪ B slip.
        const sets = Object.values(s.members ?? {});
        return fail(twice.some((x) => sets.filter((m) => m.includes(x)).length > 1) ? 'overlap-twice' : 'repeat');
      }
      if (!sameSet(got, want)) {
        const t = traps.find((t) => t.written === key && Array.isArray(t.value) && sameSet(got, t.value.map(S)));
        if (t) return fail(t.code);
        return fail(want.some((x) => !got.includes(x)) ? 'members-missing' : 'members-extra');
      }
    }
  }
  if (check.rows) {
    const rows = s.rows ?? [];
    if (!rows.length || rows.some((r) => !r.picked)) return fail('rows-unanswered');
    const bad = rows.find((r) => !r.truth.includes(r.picked!));
    if (bad) {
      const t = traps.find((t) => t.row === bad.key && (!t.pick || t.pick === bad.picked));
      if (t) return fail(t.code);
      // ∈ where ⊆ was meant, or the other way round.
      const pf = symbolFamily(bad.picked!), tf = bad.truth.map(symbolFamily);
      if (pf !== 'equal' && tf.some((f) => f !== 'equal' && f !== pf)) return fail('element-vs-subset');
      return fail('row-wrong');
    }
  }
  if (check.table) {
    const t = s.table;
    if (!t) return fail('table-empty');
    const keys = Object.keys(t.truth);
    if (keys.some((k) => t.cells[k] == null)) return fail('table-empty');
    const bad = keys.filter((k) => t.cells[k] !== t.truth[k]);
    if (bad.length) {
      const trap = traps.find((x) => x.cell && bad.includes(x.cell) && t.cells[x.cell] === x.value);
      if (trap) return fail(trap.code);
      return fail(bad.some((k) => k.includes('t')) ? 'total-wrong' : 'table-wrong');
    }
  }
  if (check.answer !== undefined) {
    const n = input.integer;
    if (n == null) return fail('empty');
    if (n !== check.answer) return fail(traps.find((t) => t.answer === n)?.code ?? (n > check.answer ? 'too-big' : 'too-small'));
  }
  if (check.probability) {
    const f = input.fraction;
    if (!f || !f.d) return fail('empty');
    const n = f.n + (f.whole ?? 0) * f.d, [a, b] = check.probability;
    if (n * b !== a * f.d) {
      const t = traps.find((t) => Array.isArray(t.value) && t.value.length === 2 && !t.written && n * +t.value[1] === +t.value[0] * f.d);
      return fail(t?.code ?? 'prob-wrong');
    }
  }
  return { ok: true };
}

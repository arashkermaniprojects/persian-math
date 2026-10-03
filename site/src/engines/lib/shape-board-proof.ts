// Proof panel for <kg-shape-board> (module shape-board/proof.ts): statements built from parts of a named figure
// (sides "A B", angles "A B C"), reasons from a per-locale bank, the congruence criterion, the vertex correspondence,
// and counterexamples dragged on the dynamic figure. Pure: the module draws the panel, lib/checks.ts calls checkProof.
import { term, toks, type Pts } from './shape-board-dynamic';
import type { ShapeBoardState } from './shape-board-check';

/** One proof row as the learner wrote it: "A B = A D", "A B C = A D C" (angles), "A B C ≅ A D C"; r = reason key. */
export interface Row { s: string; r: string | null; locked?: boolean }
export interface ProofState { rows: Row[]; criterion: string | null; corr: string[] }

export interface ProofConfig {
  /** Sides ("A B") and angles ("A B C", the angle at B) the learner taps to build a statement. */
  parts?: string[];
  /** Correspondence slots: △`of` ≅ △ _ _ _, filled from the letters in `from`. */
  corr?: { of: string; from: string };
  /** Criterion choices (labels `crit-<key>`), e.g. sss sas asa aas rhs aaa ssa none. */
  criteria?: string[];
  /** Reason bank for the rows (labels `reason-<key>`, else `crit-<key>`). */
  reasons?: string[];
  /** Most rows the learner may write (0 = no proof table). */
  rows?: number;
  /** Rows written in advance and locked (the hypothesis, «فرض»). */
  given?: Row[];
  /** A claim to break (label `claim-<key>`), shown as a row above the panel. */
  claim?: string;
}

export interface ProofCheck {
  type: 'proof';
  /** The dynamic figure was dragged into at least n positions (counterexamples: explore first). */
  dragged?: number;
  /** The criterion chosen. Picking `aaa` or `ssa` (when wrong) gives those codes. */
  criterion?: string;
  /** The letters in the slots, in order (△of ≅ △ these). Right letters in the wrong order: `order`. */
  correspondence?: string;
  /** Statements every proof must contain, each with an acceptable reason, after the statements in `after`. */
  steps?: { s: string; r: string | string[]; after?: string[] }[];
  /** Statements the hypothesis gives: only these may have reason `given`. */
  facts?: string[];
  /** What is being proved: given as its own reason, or before its steps, is `circular`. */
  conclusion?: string;
  /**
   * The dragged figure satisfies every hypothesis pair and breaks at least one conclusion pair. A pair is two watch
   * keys of the dynamic figure, or a key and a number, compared as shown (± tolerance).
   */
  counterexample?: { hypothesis: [string, string | number][]; conclusion: [string, string | number][]; tolerance?: number };
  traps?: { criterion?: string; reason?: string; corr?: string; code: string }[];
}

type Result = { ok: true } | { ok: false; code: string };
const fail = (code: string): Result => ({ ok: false, code });

/** A side or angle with its ends in a fixed order: "B A" → "A B", "C B A" → "A B C". */
export function part(p: string): string {
  const t = toks(p);
  if (t.length === 2) return [...t].sort().join(' ');
  if (t.length === 3) { const [a, b] = [t[0], t[2]].sort(); return `${a} ${t[1]} ${b}`; }
  return t.join(' ');
}
/** A statement in one canonical form: equal parts in either order; a congruence by its vertex pairs. */
export function canon(s: string): string {
  if (s.includes('≅')) {
    const [a, b] = s.split('≅').map((x) => toks(x.trim()));
    if (a.length !== b.length) return s.trim();
    return '≅' + a.map((v, i) => [v, b[i]].sort().join(':')).sort().join(',');
  }
  if (s.includes('=')) return s.split('=').map((x) => part(x.trim())).sort().join(' = ');
  return part(s);
}

/** Is the statement true in the figure? (null when it cannot be measured). */
export function holds(s: string, pts: Pts, tol = 0.01): boolean | null {
  if (s.includes('≅')) {
    const [a, b] = s.split('≅').map((x) => toks(x.trim()));
    if (a.length !== 3 || b.length !== 3) return null;
    for (const [i, j] of [[0, 1], [1, 2], [0, 2]]) {
      const u = term(`${a[i]} ${a[j]}`, pts), v = term(`${b[i]} ${b[j]}`, pts);
      if (u === null || v === null) return null;
      if (Math.abs(u - v) > tol * Math.max(1, u)) return false;
    }
    return true;
  }
  const [x, y] = s.split('=').map((p) => term(p.trim(), pts));
  if (x == null || y == null) return null;
  return Math.abs(x - y) <= tol * Math.max(1, Math.abs(x));
}

export function checkProof(c: ProofCheck, b: ShapeBoardState | undefined): Result {
  const p = b?.proof, d = b?.dyn;
  const trap = (f: (t: NonNullable<ProofCheck['traps']>[number]) => boolean) => c.traps?.find(f)?.code;
  if (c.dragged !== undefined && (d?.dragged ?? 0) < c.dragged) return fail('not-dragged');

  if (c.criterion !== undefined) {
    const got = p?.criterion;
    if (!got) return fail('empty');
    if (got !== c.criterion) return fail(trap((t) => t.criterion === got) ?? (got === 'aaa' || got === 'ssa' ? got : 'wrong-criterion'));
  }

  if (c.correspondence !== undefined) {
    const want = toks(c.correspondence), got = p?.corr ?? [];
    if (got.length < want.length) return fail('empty');
    if (got.join(' ') !== want.join(' ')) {
      const t = trap((x) => x.corr !== undefined && toks(x.corr).join(' ') === got.join(' '));
      if (t) return fail(t);
      return fail([...got].sort().join() === [...want].sort().join() ? 'order' : 'wrong-correspondence');
    }
  }

  if (c.steps) {
    const rows = (p?.rows ?? []).filter((r) => !r.locked), all = p?.rows ?? [];
    if (!rows.length) return fail('empty');
    const facts = new Set((c.facts ?? []).map(canon)), goal = c.conclusion ? canon(c.conclusion) : null;
    for (const r of rows) {
      if (!r.r) return fail('no-reason');
      const s = canon(r.s);
      if (r.r === 'given' && !facts.has(s)) return fail(s === goal ? 'circular' : trap((t) => t.reason === 'given') ?? 'not-given');
      if (r.r === 'goal') return fail('circular');
      if (r.r === 'looks') return fail(trap((t) => t.reason === 'looks') ?? 'looks-equal');
      if (d?.pts && holds(r.s, d.pts) === false) return fail('false-statement');
    }
    const at = (s: string) => all.findIndex((r) => canon(r.s) === canon(s));
    for (const st of c.steps) {
      const i = at(st.s);
      if (i < 0) return fail('missing-step');
      const ok = [st.r].flat();
      const r = all[i].r!;
      if (!ok.includes(r)) return fail(trap((t) => t.reason === r) ?? 'wrong-reason');
      if ((st.after ?? []).some((a) => { const j = at(a); return j < 0 || j > i; })) return fail(canon(st.s) === goal ? 'circular' : 'step-order');
    }
  }

  if (c.counterexample) {
    if (!d) return fail('empty');
    const tol = c.counterexample.tolerance ?? 1e-6;
    const val = (k: string | number) => (typeof k === 'number' ? k : d.values[k] ?? null);
    const same = ([a, b]: [string, string | number]) => { const x = val(a), y = val(b); return x !== null && y !== null && Math.abs(x - y) <= tol; };
    if (!c.counterexample.hypothesis.every(same)) return fail('hypothesis-broken');
    if (c.counterexample.conclusion.every(same)) return fail('conclusion-holds');
  }
  return { ok: true };
}

// Pure maths and checking for the `tree` module of <kg-discrete-lab> (docs/STUDIOS.md "Engine options → discrete-lab"):
// the true tree from a mission's stages or bag, branch and path probabilities, frequency-tree counts, the layout of the
// drawing and the `tree` condition of the `sets` check. No DOM, so the tests and lib/checks.ts can use it.
//
// A node is named by its path from the root: "" is the root, "r" the branch r of stage 1, "r.b" then b in stage 2.
// Outcome keys must not contain a dot.

/** A fraction [numerator, denominator], kept as written (unsimplified): 2/6 × 2/6 = 4/36, as the books write it. */
export type Frac = [number, number];

/** Which branches, leaves or nodes the learner fills: "all", or a list of paths and stage numbers (2 = every branch of stage 2). */
export type Ask = 'all' | (string | number)[];

export interface TreeConfig {
  /** Each stage's outcomes (keys → label item-<key>), with optional probabilities, the same at every node of that stage. */
  stages?: { outcomes: string[]; p?: Frac[] }[];
  /** Draw from a bag instead: count per outcome. Probabilities are worked out; `replace: false` changes the later stages. */
  bag?: Record<string, number>;
  /** Number of draws from the bag (default 2). */
  draws?: number;
  /** Put the drawn item back (default true). Without replacement an outcome that has run out has no branch. */
  replace?: boolean;
  /** Probabilities per branch path, over the stage's or the bag's (dependent events: "rain.late": [1, 4]). */
  p?: Record<string, Frac>;
  /** A frequency tree: the count at each node path ("" = the root total). */
  values?: Record<string, number>;
  /** Colour of an outcome's dot: red, blue, green, yellow, black, grey, white, orange, purple. */
  colors?: Record<string, string>;
  /** The learner grows the tree: true = tap + to grow every branch of a node; "choose" = pick which branches grow. */
  grow?: boolean | 'choose';
  /** With `grow`: stages already grown at the start (default 0). */
  given?: number;
  /** What the learner fills: branch probabilities (p), path products at the leaves (product), frequency counts (count). */
  ask?: { p?: Ask; product?: Ask; count?: Ask };
  /** What is shown when not asked: branch probabilities (default true when known), path products (default false). */
  show?: { p?: boolean; product?: boolean };
  /** The learner taps leaves to choose the outcomes of an event. */
  pick?: boolean;
}

// ---------- fractions ----------
export const fmul = (a: Frac, b: Frac): Frac => [a[0] * b[0], a[1] * b[1]];
export const fadd = (a: Frac, b: Frac): Frac => (a[1] === b[1] ? [a[0] + b[0], a[1]] : [a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
export const feq = (a: Frac | null | undefined, b: Frac | null | undefined) => !!a && !!b && a[1] !== 0 && b[1] !== 0 && a[0] * b[1] === b[0] * a[1];
export const fsum = (fs: Frac[]): Frac => fs.reduce(fadd, [0, 1]);

// ---------- paths ----------
export const depthOf = (path: string) => (path ? path.split('.').length : 0);
export const parentOf = (path: string) => path.split('.').slice(0, -1).join('.');
export const lastOf = (path: string) => path.split('.').pop()!;
export const childOf = (path: string, k: string) => (path ? `${path}.${k}` : k);

export const stageCount = (c: TreeConfig) => c.stages?.length ?? c.draws ?? 2;

/** The outcomes offered at a node of this depth (the palette when the learner chooses branches). */
export function options(c: TreeConfig, depth: number): string[] {
  if (c.stages) return c.stages[depth]?.outcomes ?? [];
  return Object.keys(c.bag ?? {});
}

/** Items of each kind left in the bag at this node (the bag itself with replacement). */
function left(c: TreeConfig, path: string): Record<string, number> {
  const bag = { ...(c.bag ?? {}) };
  if (c.replace === false && path) for (const k of path.split('.')) bag[k] = (bag[k] ?? 0) - 1;
  return bag;
}

/** The true branches of a node: every option, except, without replacement, an outcome that has run out. */
export function children(c: TreeConfig, path: string): string[] {
  if (depthOf(path) >= stageCount(c)) return [];
  if (!c.bag) return options(c, depthOf(path));
  const l = left(c, path);
  return options(c, 0).filter((k) => l[k] > 0);
}

/** Options that have no branch because the item was not put back. */
export const exhausted = (c: TreeConfig, path: string) => (depthOf(path) >= stageCount(c) ? [] : options(c, depthOf(path)).filter((k) => !children(c, path).includes(k)));

/** Every node of the true tree, root first, depth-first in the order of the options. */
export function allPaths(c: TreeConfig, from = ''): string[] {
  return [from, ...children(c, from).flatMap((k) => allPaths(c, childOf(from, k)))];
}
export const leavesOf = (c: TreeConfig) => allPaths(c).filter((p) => depthOf(p) === stageCount(c));

/** The probability on the branch into `path` (null when the mission gives none, e.g. a counting tree). */
export function prob(c: TreeConfig, path: string): Frac | null {
  if (c.p?.[path]) return c.p[path];
  const d = depthOf(path) - 1, k = lastOf(path);
  const st = c.stages?.[d];
  if (st?.p) {
    const i = st.outcomes.indexOf(k);
    return i < 0 ? null : st.p[i] ?? null;
  }
  if (!c.bag) return null;
  const l = left(c, parentOf(path));
  return [Math.max(0, l[k] ?? 0), Object.values(l).reduce((a, b) => a + Math.max(0, b), 0)];
}

/** Without replacement: what the branch would be if the item were put back (the classic slip). */
export const altProb = (c: TreeConfig, path: string): Frac | null =>
  c.bag && c.replace === false ? prob({ ...c, replace: true }, path) : null;

/** Multiply along the path from the root (the first rule of paths); `f` gives each branch. */
export function pathProd(path: string, f: (p: string) => Frac | null): Frac | null {
  let r: Frac = [1, 1], q = '';
  for (const k of path.split('.')) {
    const b = f((q = childOf(q, k)));
    if (!b) return null;
    r = fmul(r, b);
  }
  return r;
}

/** Add along the path instead of multiplying (the misconception `added-along-branch`). */
export function pathSum(path: string, f: (p: string) => Frac | null): Frac | null {
  const fs: Frac[] = [];
  let q = '';
  for (const k of path.split('.')) {
    const b = f((q = childOf(q, k)));
    if (!b) return null;
    fs.push(b);
  }
  return fsum(fs);
}

/** Sum of the branch counts of the stages (3 shirts + 2 trousers = 5): the answer that adds instead of multiplying. */
export function stageSum(c: TreeConfig): number {
  let s = 0, p = '';
  for (let d = 0; d < stageCount(c); d++) {
    const ch = children(c, p);
    s += ch.length;
    p = childOf(p, ch[0]);
  }
  return s;
}

/** The paths an `ask` names among `paths` (stage numbers pick every path of that depth). */
export function asked(a: Ask | undefined, paths: string[]): string[] {
  if (!a) return [];
  if (a === 'all') return paths;
  return paths.filter((p) => a.some((x) => (typeof x === 'number' ? depthOf(p) === x : x === p)));
}

// ---------- layout ----------
export interface TreeLayout {
  /** Every visible node: [x, y] in drawing units; the drawing is `w` × `h`, left to right in every locale. */
  pos: Record<string, [number, number]>;
  w: number;
  h: number;
  /** x of each depth's nodes. */
  xs: number[];
}

/**
 * Leaves of the visible tree (the nodes with no visible branches) sit in rows `gap` apart; every other node sits
 * halfway between its first and last branch. `reserve` = room on the right for the leaves' names and products.
 */
export function layoutTree(kids: (path: string) => string[], depth: number, o: { gap: number; reserve: number; w?: number; x0?: number; margin?: number }): TreeLayout {
  const w = o.w ?? 360, x0 = o.x0 ?? 26, m = o.margin ?? 36;
  const xs = Array.from({ length: depth + 1 }, (_, d) => x0 + (d * (w - o.reserve - x0)) / Math.max(1, depth));
  const pos: Record<string, [number, number]> = {};
  let row = 0;
  const walk = (p: string): number => {
    const ks = kids(p);
    const y = ks.length ? (() => { const ys = ks.map((k) => walk(childOf(p, k))); return (ys[0] + ys[ys.length - 1]) / 2; })() : m + o.gap * row++;
    pos[p] = [xs[depthOf(p)], y];
    return y;
  };
  walk('');
  return { pos, w, h: Math.max(120, 2 * m + o.gap * (row - 1)), xs };
}

// ---------- checking ----------
export interface TreeCheck {
  /** Every node of the learner's tree has exactly its true branches. */
  grown?: boolean;
  /** Every branch probability the learner writes is right (equivalent fractions count). */
  branches?: boolean;
  /** Every path product the learner writes at a leaf is right. */
  products?: boolean;
  /** Every frequency-tree count the learner writes is right. */
  counts?: boolean;
  /** The leaves picked are exactly these paths (the outcomes of the event). */
  event?: string[];
}

export interface TreeTrap {
  code: string;
  /** A branch probability or path product written as `value`. */
  branch?: string;
  product?: string;
  /** A frequency-tree count written as `value`. */
  node?: string;
  value?: unknown;
  /** These leaves picked for the event. */
  leaves?: string[];
}

export interface TreeState {
  /** Leaves of the learner's tree at the last stage. */
  leaves: number;
  /** stageSum of the true tree, for `sum-not-product`. */
  sum: number;
  /** Every node of the learner's tree above the last stage: its branches, the true ones, and the ones run out. */
  nodes: { path: string; got: string[]; truth: string[]; gone: string[] }[];
  /** Branches with a known probability: what the learner wrote (asked ones) and the truth. */
  p: Record<string, { ask: boolean; got: Frac | null; truth: Frac; alt?: Frac | null }>;
  product: Record<string, { got: Frac | null; truth: Frac; add: Frac | null; alt?: Frac | null }>;
  count: Record<string, { ask: boolean; got: number | null; truth: number }>;
  picked: string[];
}

type Result = { ok: boolean; code?: string };
const fail = (code: string): Result => ({ ok: false, code });
const isFrac = (v: unknown): v is Frac => Array.isArray(v) && v.length === 2;

/** Tested in this order: grown → counts → branches → products → event. Null when every part given holds. */
export function checkTree(check: TreeCheck, s: TreeState | undefined, traps: TreeTrap[] = []): Result | null {
  if (!s) return fail('not-grown');
  if (check.grown) {
    if (s.nodes.some((n) => !n.got.length)) return fail('not-grown');
    for (const n of s.nodes) {
      const extra = n.got.filter((k) => !n.truth.includes(k));
      if (extra.some((k) => n.gone.includes(k))) return fail('replacement-ignored');
      if (extra.length) return fail('branch-extra');
      if (n.truth.some((k) => !n.got.includes(k))) return fail('branch-missing');
    }
  }
  if (check.counts) {
    const cs = Object.entries(s.count), ask = cs.filter(([, v]) => v.ask);
    if (ask.some(([, v]) => v.got == null)) return fail('count-empty');
    const bad = ask.filter(([, v]) => v.got !== v.truth);
    if (bad.length) {
      const t = traps.find((t) => t.node !== undefined && bad.some(([k, v]) => k === t.node && v.got === t.value));
      if (t) return fail(t.code);
      // The branches out of a node must add up to it.
      const val = (k: string) => (s.count[k]?.ask ? s.count[k].got : s.count[k]?.truth);
      const parts = (p: string) => cs.filter(([k]) => k && parentOf(k) === p).map(([k]) => val(k) ?? 0);
      const notTotal = cs.some(([k]) => parts(k).length > 0 && parts(k).reduce((a, b) => a + b, 0) !== val(k));
      return fail(notTotal ? 'parts-not-total' : 'count-wrong');
    }
  }
  if (check.branches) {
    const bs = Object.entries(s.p), ask = bs.filter(([, v]) => v.ask);
    if (!ask.length || ask.some(([, v]) => !v.got)) return fail('branch-empty');
    const bad = ask.filter(([, v]) => !feq(v.got, v.truth));
    if (bad.length) {
      const t = traps.find((t) => t.branch !== undefined && isFrac(t.value) && bad.some(([k, v]) => k === t.branch && feq(v.got, t.value as Frac)));
      if (t) return fail(t.code);
      if (bad.some(([, v]) => feq(v.got, v.alt))) return fail('replacement-ignored');
      const val = (k: string) => (s.p[k].ask ? s.p[k].got! : s.p[k].truth);
      const notOne = [...new Set(bad.map(([k]) => parentOf(k)))].some((p) => !feq(fsum(bs.filter(([k]) => parentOf(k) === p).map(([k]) => val(k))), [1, 1]));
      return fail(notOne ? 'branches-not-one' : 'branch-wrong');
    }
  }
  if (check.products) {
    const ps = Object.entries(s.product);
    if (!ps.length || ps.some(([, v]) => !v.got)) return fail('product-empty');
    const bad = ps.filter(([, v]) => !feq(v.got, v.truth));
    if (bad.length) {
      const t = traps.find((t) => t.product !== undefined && isFrac(t.value) && bad.some(([k, v]) => k === t.product && feq(v.got, t.value as Frac)));
      if (t) return fail(t.code);
      if (bad.some(([, v]) => feq(v.got, v.add))) return fail('added-along-branch');
      if (bad.some(([, v]) => feq(v.got, v.alt))) return fail('replacement-ignored');
      return fail('product-wrong');
    }
  }
  if (check.event) {
    const got = s.picked, want = check.event;
    const same = (a: string[]) => a.length === got.length && a.every((x) => got.includes(x));
    if (!same(want)) {
      const t = traps.find((t) => t.leaves && same(t.leaves));
      if (t) return fail(t.code);
      if (!got.length) return fail('event-empty');
      return fail(want.some((x) => !got.includes(x)) ? 'event-missing' : 'event-extra');
    }
  }
  return null;
}

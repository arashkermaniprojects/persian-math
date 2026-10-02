// Pure model for <kg-counters>: zones of two-colour counters, arrays and factor trees. No DOM here.

export type Color = 0 | 1;
/** A counter: its colour, whether the learner marked it (crossed out or circled), and whether it is fixed. */
export interface Counter { c: Color; x?: boolean; l?: boolean }
/** A place in a zone: frames and rows have fixed slots (null = empty); groups hold only counters. */
export type Slot = Counter | null;

/** Engine state for one zone, as the checks see it. */
export interface ZoneState {
  /** Counters in the zone, marked ones included. */
  count: number;
  /** Counters the learner crossed out or circled. */
  marked: number;
  /** Unmarked counters of colour 0 (red) and colour 1 (yellow). */
  colors: [number, number];
  rows?: number;
  cols?: number;
  /** Factor tree: the numbers at the ends of the branches, smallest first, and whether they are all prime. */
  leaves?: number[];
  done?: boolean;
}

export interface CountersState {
  zones: ZoneState[];
  /** The number the learner picked from the number tiles, or null. */
  picked: number | null;
}

/** Counters at the start: `n` red, or `[red, yellow]`; the first `lock` are fixed. */
export function initialCounters(fill: number | [number, number] | undefined, lock = 0): Counter[] {
  const [a, b] = typeof fill === 'number' ? [fill, 0] : fill ?? [0, 0];
  return Array.from({ length: a + b }, (_, i) => ({ c: (i < a ? 0 : 1) as Color, ...(i < lock ? { l: true } : {}) }));
}

/**
 * Keep counters in order and, for slotted zones (frames, rows), pad with empty slots up to `slots`, so a
 * ten-frame always fills from its first cell and reads as "5 and some more".
 */
export function compact(items: Slot[], slots?: number): Slot[] {
  const cs = items.filter((s): s is Counter => !!s);
  return slots ? [...cs, ...Array<Slot>(Math.max(0, slots - cs.length)).fill(null)].slice(0, Math.max(slots, cs.length)) : cs;
}

export const countOf = (items: Slot[]) => items.filter(Boolean).length;

/** Add a counter in the first empty place; false when the zone is full. */
export function addCounter(items: Slot[], c: Counter, cap: number, slots?: number): Slot[] | null {
  if (countOf(items) >= cap) return null;
  return compact([...items.filter(Boolean), c], slots);
}

/** Remove the counter at i (not a fixed one); returns the new items and the counter, or null. */
export function removeAt(items: Slot[], i: number, slots?: number): [Slot[], Counter] | null {
  const c = items[i];
  if (!c || c.l) return null;
  const rest = items.slice();
  rest[i] = null;
  return [compact(rest, slots), c];
}

export function zoneState(items: Slot[]): ZoneState {
  const cs = items.filter((s): s is Counter => !!s);
  const live = cs.filter((c) => !c.x);
  return { count: cs.length, marked: cs.length - live.length, colors: [live.filter((c) => c.c === 0).length, live.filter((c) => c.c === 1).length] };
}

/**
 * Array size. With `keep`, the array always holds `keep` counters in rows of `cols`: the learner sets the row
 * length and the rows follow, so the last row is short when `cols` is not a factor of `keep`. Otherwise rows × cols.
 */
export function arrayShape(rows: number, cols: number, keep?: number): { rows: number; cols: number; n: number; full: boolean } {
  if (keep) return { rows: Math.ceil(keep / cols), cols, n: keep, full: keep % cols === 0 };
  return { rows, cols, n: rows * cols, full: true };
}

/** Colour of counter i in an array split after `split` columns: the first columns red, the rest yellow. */
export const splitColor = (i: number, cols: number, split: number): Color => (split > 0 && i % cols >= split ? 1 : 0);

export function isPrime(n: number): boolean {
  if (n < 2 || !Number.isInteger(n)) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** Factor pairs a × b of n with 1 < a ≤ b, smallest a first: 12 → [[2, 6], [3, 4]]. */
export function factorPairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 2; a * a <= n; a++) if (n % a === 0) out.push([a, n / a]);
  return out;
}

/** A factor tree: a number, split into two factors (each itself a tree) or not yet. */
export interface TreeNode { v: number; k?: [TreeNode, TreeNode] }

/** The node at a path of child indices, e.g. "01" = second child of the first child. */
export function nodeAt(t: TreeNode, path: string): TreeNode | undefined {
  let n: TreeNode | undefined = t;
  for (const ch of path) n = n?.k?.[Number(ch)];
  return n;
}

/** Split the leaf at `path` into a × (v / a); a must be a proper factor. Returns false if not allowed. */
export function splitNode(t: TreeNode, path: string, a: number): boolean {
  const n = nodeAt(t, path);
  if (!n || n.k || a < 2 || a >= n.v || n.v % a) return false;
  n.k = [{ v: a }, { v: n.v / a }];
  return true;
}

export function leaves(t: TreeNode): number[] {
  return (t.k ? [...leaves(t.k[0]), ...leaves(t.k[1])] : [t.v]).sort((a, b) => a - b);
}

export const treeDone = (t: TreeNode) => leaves(t).every(isPrime);

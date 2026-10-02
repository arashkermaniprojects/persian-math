// Repeating patterns for <kg-pattern-machine> (mode "repeat"): items such as "red-circle", the unit that repeats,
// and how a learner's sequence differs from the pattern. Pure, no DOM.

export const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart'] as const;
export const COLORS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'] as const;

/** "red-circle" → { color: "red", shape: "circle" }. Anything else (a letter, a digit) is a plain text item. */
export function parseItem(item: string): { color?: string; shape?: string; text?: string } {
  const [c, s] = item.split('-');
  if ((COLORS as readonly string[]).includes(c) && (SHAPES as readonly string[]).includes(s)) return { color: c, shape: s };
  return { text: item };
}

/** The pattern itself: the unit repeated to `length` items. */
export function repeatUnit(unit: string[], length: number): string[] {
  return Array.from({ length }, (_, i) => unit[i % unit.length]);
}

/** Length of the shortest unit that repeats through the whole sequence (the sequence length if none does). */
export function period(seq: (string | null)[]): number {
  const n = seq.length;
  for (let p = 1; p < n; p++) if (seq.every((s, i) => i < p || s === seq[i - p])) return p;
  return n;
}

/**
 * Is a learner-made sequence a repeating pattern? It must be complete, use at least two kinds of item, and show its
 * unit at least `repeats` times in full. Returns a failing code or null.
 */
export function madeCode(seq: (string | null)[], repeats = 2): string | null {
  if (seq.some((s) => !s)) return 'not-finished';
  if (new Set(seq).size < 2) return 'one-kind';
  const p = period(seq);
  return p * repeats <= seq.length ? null : 'no-repeat';
}

/**
 * Compare a learner's sequence with the pattern. The first wrong slot gives the code: not-finished (a slot is
 * empty), wrong-color (right shape, wrong colour), wrong-shape (right colour, wrong shape) or wrong-item.
 */
export function compareCode(seq: (string | null)[], target: string[]): string | null {
  if (seq.some((s) => !s)) return 'not-finished';
  const i = seq.findIndex((s, j) => s !== target[j]);
  if (i < 0) return null;
  const a = parseItem(seq[i]!), b = parseItem(target[i]);
  if (a.shape && b.shape) {
    if (a.shape === b.shape) return 'wrong-color';
    if (a.color === b.color) return 'wrong-shape';
  }
  return 'wrong-item';
}

/** Does the chosen unit length match the pattern? null when right, else a code. */
export function unitCode(chosen: number | null | undefined, target: string[]): string | null {
  if (!chosen) return 'empty';
  const p = period(target);
  if (chosen === p) return null;
  if (chosen % p === 0) return 'unit-repeats';
  return chosen < p ? 'unit-short' : 'unit-long';
}

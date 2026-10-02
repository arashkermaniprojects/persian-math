// Pure helpers for <kg-fraction-bars> "given" cells and the area model (no DOM, so they can be unit-tested).
import { cellsFor, nextParts } from './fraction-bars-amount';

/** Number of cells in a bar: `parts` columns, split into `rows` rows in the area model. */
export function totalCells(parts: number, rows = 1): number {
  return parts * Math.max(1, rows);
}

/** Cells are numbered row by row; in the area model the first `tint` columns are tinted. */
export function isTinted(index: number, parts: number, tint = 0): boolean {
  return index % parts < tint;
}

/**
 * The next number of parts for a bar with given (pre-coloured) cells: like nextParts, but partitions that
 * cannot show the given amount `given`/`givenParts` exactly are skipped (halves: 2 → 4 → 6, never 3).
 */
export function nextPartsShowing(
  parts: number, delta: 1 | -1, given: number, givenParts: number, step = 1, min = 1, max = 12,
): number | null {
  let p: number | null = parts;
  while ((p = nextParts(p, delta, step, min, max)) !== null) if (cellsFor(given, givenParts, p) !== null) return p;
  return null;
}

/** The next number of rows in the area model after pressing + or −, or null outside [min, max]. */
export function nextRows(rows: number, delta: 1 | -1, min = 1, max = 6): number | null {
  const next = rows + delta;
  return next < min || next > max ? null : next;
}

/** Bar state for checks: an area-model bar of `parts` columns × `rows` rows counts as rows × parts cells. */
export function gridState(parts: number, rows: number, cells: boolean[]): { parts: number; shaded: number } {
  return { parts: totalCells(parts, rows), shaded: cells.filter(Boolean).length };
}

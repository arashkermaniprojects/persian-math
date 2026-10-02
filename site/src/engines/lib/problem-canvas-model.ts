// Pure state and maths for <kg-problem-canvas> (docs/STUDIOS.md → "Engine options → problem-canvas"):
// bar-model geometry, guess-and-check rows, computed table cells and number sentences.
import { evaluate } from './problem-canvas-expr';

/** A slot in a bar model or a number sentence: a number, the unknown "?" (□), or still empty. */
export type Val = number | '?' | null;

export interface BarState {
  kind: 'bar';
  /** part-whole: a whole over its parts; compare: two rows and their difference; groups: equal parts. */
  model: 'part-whole' | 'compare' | 'groups';
  /** part-whole/groups: the whole; compare: unused (null). */
  whole: Val;
  /** part-whole/groups: one value per part; compare: [row 1, row 2]. */
  parts: Val[];
  /** compare: the difference, and which row is longer (0 = row 1; null = not chosen yet). */
  d?: Val;
  more?: 0 | 1 | null;
}
export interface TableState { kind: 'table'; cols: string[]; rows: (number | null)[][] }
export interface GuessRow { x: number; v: (number | null)[]; cmp: -1 | 0 | 1 | null }
export interface GuessState { kind: 'guess'; guesses: GuessRow[]; found: boolean }
export interface ListState { kind: 'list'; items: (number | string)[]; crossed: number[] }
/** tokens: numbers as ASCII strings, "?" for the box, "+", "-", "×", "÷", "="; null = empty slot. */
export interface SentenceState { kind: 'sentence'; tokens: (string | null)[]; solved: number | null }
export type ToolState = (BarState | TableState | GuessState | ListState | SentenceState) & { shown?: boolean };

export interface CanvasState {
  /** Facts the learner marked as known («داده‌ها») and the question they picked («خواسته»). */
  known: string[];
  asked: string | null;
  strategy: string | null;
  tools: ToolState[];
  answer: number | null;
}

const num = (v: Val | undefined): v is number => typeof v === 'number';
const clamp = (x: number) => Math.min(0.9, Math.max(0.1, x));

/**
 * Widths of the parts of a part-whole bar as fractions of the whole (they add up to 1), so the drawing
 * looks like the numbers in it: a "?" or empty part takes what the whole leaves over, or the average part.
 */
export function partWidths(whole: Val, parts: Val[]): number[] {
  const known = parts.filter(num) as number[];
  const sum = known.reduce((s, v) => s + v, 0);
  const u = parts.length - known.length;
  if (!parts.length) return [];
  if (!known.length || sum <= 0) return parts.map(() => 1 / parts.length);
  const left = num(whole) && whole > sum ? (whole - sum) / (u || 1) : sum / known.length;
  const w = parts.map((p) => (num(p) ? p : u ? left : 0));
  const total = w.reduce((s, v) => s + v, 0);
  // Keep every part visible and tappable, even 1 next to 99.
  const min = 0.12 / parts.length;
  const raw = w.map((x) => Math.max(min, x / total));
  const t2 = raw.reduce((s, v) => s + v, 0);
  return raw.map((x) => x / t2);
}

/** Compare model: the shorter row as a fraction of the longer one (the difference is the rest). */
export function shortShare(long: Val, short: Val, d: Val): number {
  if (num(long) && long > 0 && num(short)) return clamp(short / long);
  if (num(long) && long > 0 && num(d)) return clamp((long - d) / long);
  if (num(short) && num(d) && short + d > 0) return clamp(short / (short + d));
  return 0.6;
}

export interface GuessCol { key: string; expr: string }

/**
 * One guess-and-check row: each column's expression is worked out from the guess `x` and the columns before
 * it, then the column `of` (default the last) is compared with `target` (−1 smaller, 0 equal, 1 bigger).
 */
export function tryGuess(x: number, cols: GuessCol[], target?: number, of?: string): GuessRow {
  const vars: Record<string, number | null> = { x };
  const v = cols.map((c) => (vars[c.key] = evaluate(c.expr, vars)));
  const at = of ? cols.findIndex((c) => c.key === of) : cols.length - 1;
  const got = at >= 0 ? v[at] : x;
  const cmp = target === undefined || got === null || got === undefined ? null : got === target ? 0 : got > target ? 1 : -1;
  return { x, v, cmp };
}

export interface TableCol { key: string; expr?: string }

/** Fill a table row's computed columns (`expr` over the other columns' keys); typed cells are kept. */
export function computeRow(row: (number | null)[], cols: TableCol[]): (number | null)[] {
  const vars: Record<string, number | null> = {};
  cols.forEach((c, i) => (vars[c.key] = c.expr ? null : row[i]));
  return cols.map((c, i) => (c.expr ? (vars[c.key] = evaluate(c.expr, vars)) : row[i]));
}

/** Does a number sentence hold when the box is `box`? Every side of every "=" must have the same value. */
export function sentenceHolds(tokens: (string | null)[], box: number): boolean {
  if (tokens.some((t) => t === null) || !tokens.includes('=')) return false;
  const sides = tokens.map((t) => (t === '?' ? `(${box})` : t)).join(' ').split('=');
  const vals = sides.map((s) => evaluate(s));
  return vals.every((v) => v !== null && v === vals[0]);
}


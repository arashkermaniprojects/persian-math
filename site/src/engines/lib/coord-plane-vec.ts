// Pure vector logic for the coord-plane `vectors` module (engines/coord-plane/vectors.ts) and the vector parts of the
// `coord` check: arrows tail → head, column vectors, and the classic slips (reversed, components swapped, one sign,
// one component, tails joined in a sum). No DOM, so it is unit-tested (coord-plane-vec.test.ts).
import { near, num, samePt, tidy, type P } from './coord-plane-math';

type Num = number | [number, number];
/** An arrow on the plane, tail → head. */
export interface Arrow { from: P; to: P }
/** A vector as written in YAML: [x, y] (each a number or a fraction [n, d]). */
export type Vec = [Num, Num];

/** The column vector of an arrow: head − tail. */
export const vecOf = (a: Arrow): P => [tidy(a.to[0] - a.from[0]), tidy(a.to[1] - a.from[1])];
export const vec = (v: Vec): P => [num(v[0]), num(v[1])];
export const add = (a: P, b: P): P => [tidy(a[0] + b[0]), tidy(a[1] + b[1])];
export const scale = (k: number, a: P): P => [tidy(k * a[0]), tidy(k * a[1])];
export const len = (a: P) => Math.hypot(a[0], a[1]);

/** One arrow a mission asks for. The vector is `v`, or worked out from `equal`, `opposite`, `sum` or `multiple`. */
export interface VecWant {
  v?: Vec;
  /** The same vector as this one (anywhere on the plane). */
  equal?: Vec;
  /** The opposite of this vector: the same length, the other way. */
  opposite?: Vec;
  /** The sum of these vectors (head to tail). */
  sum?: Vec[];
  /** k times a vector, e.g. { of: [2, 1], k: -0.5 }. */
  multiple?: { of: Vec; k: Num };
  /** Fixed tail and/or head (otherwise the arrow may be drawn anywhere). */
  from?: P;
  to?: P;
}

/** The vector a want stands for (null if it only fixes a tail and a head, which then give it). */
export function wanted(w: VecWant): P | null {
  if (w.v) return vec(w.v);
  if (w.equal) return vec(w.equal);
  if (w.opposite) return scale(-1, vec(w.opposite));
  if (w.sum) return w.sum.map(vec).reduce(add, [0, 0]);
  if (w.multiple) return scale(num(w.multiple.k), vec(w.multiple.of));
  if (w.from && w.to) return [tidy(w.to[0] - w.from[0]), tidy(w.to[1] - w.from[1])];
  return null;
}

/** Does arrow `a` fit the want (vector and any fixed ends)? */
export function fits(w: VecWant, a: Arrow): boolean {
  const v = wanted(w), g = vecOf(a);
  return (!v || samePt(g, v)) && (!w.from || samePt(a.from, w.from)) && (!w.to || samePt(a.to, w.to));
}

/**
 * Why `got` is not the vector `want`, by the classic slips, most telling first:
 * `tail-head` (reversed), `components-swapped` ([y, x]), `sign` (one component's sign), `one-component` (one right),
 * or null when nothing specific fits. `same-direction`: the opposite of u was asked and u itself was drawn.
 */
export function slip(want: P, got: P, w: VecWant = {}): string | null {
  const [x, y] = want, [a, b] = got;
  if (samePt(got, want)) return null;
  if (w.opposite && samePt(got, vec(w.opposite))) return 'same-direction';
  if (w.sum?.length === 2) {
    // adding by joining the tails: the arrow from one head to the other (b − a or a − b)
    const [p, q] = w.sum.map(vec), d: P = [tidy(q[0] - p[0]), tidy(q[1] - p[1])];
    if (samePt(got, d) || samePt(got, scale(-1, d))) return 'tails-joined';
  }
  if (w.multiple && num(w.multiple.k) < 0 && samePt(got, scale(-num(w.multiple.k), vec(w.multiple.of)))) return 'sign';
  if (samePt(got, [-x, -y])) return 'tail-head';
  if (!near(x, y) && samePt(got, [y, x])) return 'components-swapped';
  if ((!near(x, 0) && samePt(got, [-x, y])) || (!near(y, 0) && samePt(got, [x, -y]))) return 'sign';
  if (near(a, x) !== near(b, y)) return 'one-component';
  return null;
}

export interface Result { ok: boolean; code?: string }
const fail = (code: string): Result => ({ ok: false, code });

/** Exactly these arrows (any order). Codes: empty, too-few, too-many, the slips above, wrong-tail, wrong-head, wrong-vector. */
export function checkArrows(want: VecWant[], got: Arrow[]): Result | null {
  if (!got.length) return fail('empty');
  const left = [...got], miss: VecWant[] = [];
  for (const w of want) {
    const i = left.findIndex((a) => fits(w, a));
    if (i >= 0) left.splice(i, 1);
    else miss.push(w);
  }
  if (!miss.length && !left.length) return null;
  if (got.length < want.length) return fail('too-few');
  if (got.length > want.length) return fail('too-many');
  // as many arrows as asked, some wrong: the first specific reason over the unmatched pairs
  let best: string | null = null;
  for (const w of miss) {
    const v = wanted(w)!;
    for (const a of left) {
      const g = vecOf(a);
      // the right ends drawn the wrong way round
      if (w.from && w.to && samePt(a.from, w.to) && samePt(a.to, w.from)) return fail('tail-head');
      const s = slip(v, g, w);
      if (s) best ??= s;
      else if (samePt(g, v)) best ??= w.from && !samePt(a.from, w.from) ? 'wrong-tail' : 'wrong-head';
    }
  }
  return fail(best ?? 'wrong-vector');
}

/** Which of the `choices` are picked: exactly those equal to (or opposite to) a vector. */
export function checkPick(want: { equal?: Vec; opposite?: Vec }, choices: Arrow[], picked: number[]): Result | null {
  if (!picked.length) return fail('pick-empty');
  const v = want.equal ? vec(want.equal) : scale(-1, vec(want.opposite!));
  const good = (i: number) => !!choices[i] && samePt(vecOf(choices[i]), v);
  const extra = picked.find((i) => !good(i));
  if (extra !== undefined && choices[extra]) {
    const g = vecOf(choices[extra]);
    const s = slip(v, g, want.opposite ? { opposite: want.opposite } : {});
    if (s && s !== 'one-component' && s !== 'sign') return fail(s);
    // same direction but another length, or the same length another way
    const cross = v[0] * g[1] - v[1] * g[0], dot = v[0] * g[0] + v[1] * g[1];
    if (near(cross, 0) && dot > 0) return fail('length');
    if (near(len(g), len(v))) return fail('direction');
    return fail('wrong-pick');
  }
  return choices.some((_, i) => good(i) && !picked.includes(i)) ? fail('missed') : null;
}

/** The shape's image moved by `want`. Codes: not-moved, the slips above, wrong-shift. */
export function checkShift(want: Vec, got: P | null | undefined): Result | null {
  const v = vec(want);
  if (!got || samePt(got, [0, 0])) return samePt(v, [0, 0]) ? null : fail('not-moved');
  if (samePt(got, v)) return null;
  return fail(slip(v, got) ?? 'wrong-shift');
}

/** A trap on an arrow: some learner arrow fits this (vector and/or ends). */
export const arrowTrap = (t: VecWant, arrows: Arrow[] | undefined) => (arrows ?? []).some((a) => fits(t, a));

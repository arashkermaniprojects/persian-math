// Clock maths for <kg-clock-calendar-money>: times as minutes since midnight, hand angles, geared dragging, and the
// diagnosis of wrong times (used by the `time-equals` check). Pure, no DOM.

export const DAY = 1440;
export const HALF_DAY = 720;
const mod = (a: number, b: number) => ((a % b) + b) % b;

/** "7:30", "16:05", "۷:۳۰" → minutes since midnight. Throws on nonsense. */
export function parseTime(s: string): number {
  const t = String(s).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 24 || +m[2] > 59) throw new Error(`Bad time "${s}"`);
  return mod(+m[1] * 60 + +m[2], DAY);
}

/** Hours and minutes for display: 12-hour shows 1–12 (no padding), 24-hour shows 00–23 (padded, as on phones). */
export function timeParts(min: number, h24: boolean): { h: string; m: string } {
  const t = mod(min, DAY);
  const h = Math.floor(t / 60);
  const mm = String(t % 60).padStart(2, '0');
  return h24 ? { h: String(h).padStart(2, '0'), m: mm } : { h: String(mod(h - 1, 12) + 1), m: mm };
}

export const formatTime = (min: number, h24: boolean) => {
  const p = timeParts(min, h24);
  return `${p.h}:${p.m}`;
};

/** "HH:MM" (24-hour, padded): the canonical form reported in engine state. */
export const isoTime = (min: number) => formatTime(min, true);

/** Hand angles in degrees clockwise from 12. The hour hand moves on smoothly with the minutes. */
export function handAngles(min: number): { hour: number; minute: number } {
  const t = mod(min, HALF_DAY);
  return { hour: t / 2, minute: (t % 60) * 6 };
}

/** Angle in degrees clockwise from 12 o'clock of a point (dx, dy) from the centre, y pointing down. */
export function angleOf(dx: number, dy: number): number {
  return mod((Math.atan2(dx, -dy) * 180) / Math.PI, 360);
}

/**
 * Geared minute-hand drag: point the minute hand at `angle` (snapped to `step` minutes) and let the hour follow,
 * so dragging past 12 moves on to the next hour (or back to the previous one). `cycle` is 720 or 1440.
 */
export function dragMinute(cur: number, angle: number, step: number, cycle = HALF_DAY): number {
  const target = mod(Math.round(angle / 6 / step) * step, 60);
  let delta = target - mod(cur, 60);
  if (delta > 30) delta -= 60;
  if (delta < -30) delta += 60;
  return mod(cur + delta, cycle);
}

/** Hour-hand drag: move to the nearest whole hour the hand points at, keeping the minutes. */
export function dragHour(cur: number, angle: number, cycle = HALF_DAY): number {
  const minutes = mod(cur, 60);
  const target = mod(Math.round(angle / 30 - minutes / 60), 12);
  let delta = target - mod(Math.floor(cur / 60), 12);
  if (delta > 6) delta -= 12;
  if (delta < -6) delta += 12;
  return mod(cur + delta * 60, cycle);
}

/** Step a time by `delta` minutes within a 12- or 24-hour cycle. */
export const stepTime = (cur: number, delta: number, cycle = HALF_DAY) => mod(cur + delta, cycle);

/**
 * Why `got` is not `want` (null when right). With h24 false, times are compared on a 12-hour face.
 * Codes, most specific first:
 * - `am-pm`: right on the face but the wrong half of the day (e.g. 4:30 for 16:30).
 * - `hands-swapped`: the hour and minute hands traded places (12:15 for 3:00).
 * - `minute-as-number`: the minute hand's numeral read as minutes (7:06 for 7:30).
 * - `hour-off-by-one`: minutes right, hour one out (8:30 for half past 7).
 * - `wrong-hour`: minutes right, hour wrong.
 * - `wrong-minute`: hour right, minutes wrong.
 * - `wrong`: both wrong.
 */
export function diagnoseTime(got: number, want: number, h24 = false): string | null {
  const g = mod(got, DAY), w = mod(want, DAY);
  if (g === w) return null;
  if (mod(g, HALF_DAY) === mod(w, HALF_DAY)) return h24 ? 'am-pm' : null;
  const gh = mod(Math.floor(g / 60), 12), gm = g % 60, wh = mod(Math.floor(w / 60), 12), wm = w % 60;
  if (gm === wh * 5 && wm % 5 === 0 && gh === wm / 5 % 12) return 'hands-swapped';
  if (gh === wh && wm % 5 === 0 && wm > 0 && gm === wm / 5) return 'minute-as-number';
  if (gm === wm) return Math.abs(mod(gh - wh + 6, 12) - 6) === 1 ? 'hour-off-by-one' : 'wrong-hour';
  if (gh === wh) return 'wrong-minute';
  return 'wrong';
}

/** Minutes from `a` to `b`, going forward (a duration that may pass midnight). */
export const minutesBetween = (a: number, b: number) => mod(b - a, DAY);

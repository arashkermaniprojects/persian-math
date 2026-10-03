// The factor board for <kg-algebra-tiles> (module `factors`), loaded only by missions with `mode: factors`.
// A fraction bar with factor chips above and below it (numbers, letters, powers, brackets, roots). Tap a chip, then
// «split» to write it as factors (2³ → 2 × 2 × 2); tap a chip above and an equal one below to cancel them (both are
// struck through: each pair is 1); under a root, tap two equal chips to take them out as one; tap two roots on the
// same side to join them. The answer is typed on the engine's keypad and read as an index law, a simplified surd or
// a simplified algebraic fraction. The board runs left to right in every locale, as written algebra does.
import type { AlgebraConfig, AlgebraHost, AlgebraPart } from '../algebra-tiles';
import {
  boardText, byBoth, cloneBoard, find, isSum, makeBoard, splitChip, splitOf, tap, type Chip, type Frac, type Side,
} from '../lib/algebra-tiles-factors';

export interface FactorsConfig extends AlgebraConfig {
  /** Chips above and below one bar: top: ["2^3", "2^4"], bottom: ["a^2"]; or several fractions with `join`. */
  top?: string[];
  bottom?: string[];
  fractions?: { top?: string[]; bottom?: string[] }[];
  /** Between the fractions: "+", "-", "*" (default "+"). */
  join?: string;
  /** A mission's own factors for a chip the board cannot split by itself: { "2x^2 + 5x + 3": ["2x + 3", "x + 1"] }. */
  split?: Record<string, string[]>;
  /** Chips to multiply top and bottom by (rationalising, a common bottom): ["√3"]. */
  by?: string[];
  /** The "which x are not allowed?" step: this many typed values, after `letter ≠` (default letter: x). */
  exclude?: number;
  letter?: string;
}

const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export function mount(host: AlgebraHost, cfg: AlgebraConfig): AlgebraPart {
  const c = cfg as FactorsConfig;
  const own: Record<string, string[]> = Object.fromEntries(Object.entries(c.split ?? {}).map(([k, v]) => [k, (v as unknown[]).map(String)]));
  const start = () => makeBoard(c.fractions ?? [{ top: c.top, bottom: c.bottom }]);
  const join = String(c.join ?? '+');
  const nEx = Number(c.exclude ?? 0);
  const digits = host.lab('digits') || '0123456789';
  /** Plain text for screen readers and messages: 2³, (x − 3), √12. */
  const plain = (s: string) => s.replace(/\^\(([^()]*)\)/g, '^$1').replace(/\^(-?\d+)/g, (_, e: string) => [...e].map((ch) => SUP[ch]).join(''))
    .replace(/\*/g, ' × ').replace(/-/g, '−').replace(/\d/g, (d) => digits[+d]);

  let board: Frac[] = start(), undo: Frac[][] = [], sel: number | null = null, msg = '';
  const letter = c.letter ?? (board.flatMap((f) => f.bottom).map((x) => x.f.match(/[a-z]/)?.[0]).find(Boolean) ?? 'x');

  const chipName = (x: Chip) => (x.root ? `√(${x.root.filter((y) => !y.out).map((y) => plain(y.f)).join(' × ')})` : plain(x.f));
  const where = (s: Side, inRoot: boolean) => (inRoot ? 'label-chip-root' : s === 'top' ? 'label-chip-top' : 'label-chip-bottom');

  const chipHTML = (x: Chip, side: Side, many: boolean, inRoot = false): string => {
    if (x.out) return `<span class="kg-at-chip out" role="img" aria-label="${host.fill('label-chip-out', { f: chipName(x) }, '{f}, cancelled')}">${host.alg(many && isSum(x.f) ? `(${x.f})` : x.f)}</span>`;
    const on = sel === x.id;
    const attrs = `data-a="f-chip" data-id="${x.id}" data-k="c${x.id}" aria-pressed="${on}"`;
    if (x.root) {
      const inner = x.root.filter((y) => !y.out);
      const rad = inner.map((y) => chipHTML(y, side, inner.length > 1, true)).join('<span class="kg-at-times" aria-hidden="true">×</span>');
      return `<span class="kg-at-root"><button type="button" class="kg-at-rs${on ? ' sel' : ''}" ${attrs} aria-label="${host.fill(where(side, false), { f: chipName(x) }, '{f}')}">√</button><span class="kg-at-rad">${rad}</span></span>`;
    }
    const text = many && isSum(x.f) ? `(${x.f})` : x.f;
    return `<button type="button" class="kg-at-chip${on ? ' sel' : ''}${inRoot ? ' in' : ''}" ${attrs} aria-label="${host.fill(where(side, inRoot), { f: plain(text) }, '{f}')}">${host.alg(text)}</button>`;
  };

  const sideHTML = (l: Chip[], side: Side) => {
    const many = l.length > 1;
    const h = l.map((x) => chipHTML(x, side, many)).join('<span class="kg-at-times" aria-hidden="true">×</span>');
    return h || `<span class="kg-at-one">${host.alg('1')}</span>`;
  };

  const boardHTML = () => board.map((fr, fi) => {
    const bar = fr.bottom.length > 0 || start()[fi].bottom.length > 0;
    return `${fi ? `<span class="kg-at-join">${host.alg(join)}</span>` : ''}<div class="kg-at-fr${bar ? ' bar' : ''}"><div class="kg-at-fr-t">${sideHTML(fr.top, 'top')}</div>${bar ? `<div class="kg-at-fr-b">${sideHTML(fr.bottom, 'bottom')}</div>` : ''}</div>`;
  }).join('');

  const selected = () => (sel === null ? null : find(board, sel));
  const canSplit = () => {
    const s = selected();
    if (!s) return false;
    const x = s.list[s.at];
    return !x.out && !x.root && !!splitOf(x.f, own);
  };

  const btn = (a: string, key: string, face: string, extra = '') => `<button type="button" class="kg-at-btn" data-a="${a}" data-k="${key}"${extra}>${face}</button>`;
  const toolsHTML = () => {
    let h = btn('f-split', 'split', host.lab('label-split', 'split into factors'), canSplit() ? '' : ' disabled');
    for (const f of c.by ?? []) h += btn('f-by', `by${f}`, host.fill('label-by', { f: host.alg(String(f)) }, 'top and bottom × {f}'), ` data-f="${String(f).replace(/"/g, '&quot;')}"`);
    h += btn('f-undo', 'undo', host.lab('label-undo', 'undo'), undo.length ? '' : ' disabled');
    h += btn('f-clear', 'clear', host.lab('label-clear', 'start again'), undo.length ? '' : ' disabled');
    return `<div class="kg-at-tools">${h}</div>`;
  };

  const exclHTML = () => {
    if (!nEx) return '';
    const fields = Array.from({ length: nEx }, (_, i) => `<span class="kg-at-ex">${host.alg(`${letter} ≠`)}${host.field(`e${i}`, host.fill('label-exclude', { v: letter }, 'a value {v} cannot be'))}</span>`).join('');
    return `<div class="kg-at-excl" dir="ltr" role="group" aria-label="${host.fill('label-excluded', { v: letter }, 'values {v} cannot be')}">${fields}</div>`;
  };

  const save = () => { undo.push(cloneBoard(board)); };

  return {
    keypad: nEx > 0,
    html() {
      return `<div class="kg-at-fx" dir="ltr" role="group" aria-label="${host.lab('label-board', 'factors')}">${boardHTML()}</div>` +
        toolsHTML() + `<p class="kg-at-msg fx" role="status">${msg}</p>` + exclHTML();
    },
    act(d) {
      switch (d.a) {
        case 'f-chip': {
          const id = Number(d.id);
          msg = '';
          if (sel === null || sel === id) { sel = sel === id ? null : id; break; }
          const before = cloneBoard(board);
          const r = tap(board, sel, id);
          if (r.did === 'select') { sel = id; break; }
          const names = { a: chipName(r.a), b: chipName(r.b) };
          if (r.did === 'refuse') {
            host.log({ do: 'refuse', k: r.why, tile: `${r.a.f}|${r.b.f}` });
            msg = host.fill(`label-${r.why}`, names, r.why === 'cancel-terms' ? 'Only a whole factor cancels, not a term.' : r.why === 'split-first' ? 'Split them into factors first.' : 'Only equal factors cancel.');
            sel = null;
            break;
          }
          undo.push(before);
          host.log({ do: r.did, tile: r.a.f });
          msg = host.fill(`label-${r.did}`, names, r.did === 'cancel' ? '{a} ÷ {b} = 1' : r.did === 'pair' ? 'A pair under the root comes out as one {a}.' : 'Two roots make one root.');
          sel = null;
          break;
        }
        case 'f-split': {
          const s = selected();
          if (!s) return true;
          const x = s.list[s.at], sp = splitOf(x.f, own);
          save();
          if (sp && splitChip(board, x.id, own)) {
            host.log({ do: 'split', tile: x.f });
            const parts = s.list.slice(s.at, s.at + (sp.root ? 1 : sp.chips.length)); // the chips that took its place
            msg = host.fill('label-split-done', { a: plain(x.f), b: parts.map(chipName).join(' × ') }, '{a} = {b}');
          } else {
            undo.pop();
            msg = host.fill('label-no-split', { a: plain(x.f) }, '{a} does not split.');
          }
          sel = null;
          break;
        }
        case 'f-by': {
          const s = selected();
          const fi = s ? s.fi : board.length === 1 ? 0 : -1;
          if (fi < 0) { msg = host.lab('label-pick-frac', 'First tap a chip of the fraction.'); break; }
          save();
          byBoth(board, fi, d.f!);
          host.log({ do: 'by', tile: d.f });
          msg = '';
          sel = null;
          break;
        }
        case 'f-undo': {
          const u = undo.pop();
          if (u) board = u;
          host.log({ do: 'undo' });
          sel = null;
          msg = '';
          break;
        }
        case 'f-clear':
          board = start();
          undo = [];
          host.log({ do: 'clear' });
          sel = null;
          msg = '';
          break;
        default:
          return false;
      }
      return true;
    },
    state() {
      return {
        chips: cloneBoard(board),
        result: boardText(board, join),
        excluded: nEx ? Array.from({ length: nEx }, (_, i) => host.val(`e${i}`) || null) : undefined,
      };
    },
  };
}

// The equation balance for <kg-algebra-tiles> (module `balance`), loaded only by missions with `mode: balance`.
// Two pans hold the tiles of each side of an equation (or inequality, or formula). The learner picks a move (add or
// take away a tile, × or ÷ by a number or a letter), then taps a pan, or «both pans». A move on one pan only tips
// the beam, and the same move on the other pan levels it again; every level equation is written in the steps list,
// as Iran's books chain them with arrows. `try` puts a value on every letter tile instead: the beam shows if it fits.
// The scale, the pans and the steps run left to right in every locale (the left pan is the left side).
import type { AlgebraConfig, AlgebraHost, AlgebraPart } from '../algebra-tiles';
import {
  applyOp, denOf, judge, lettersOf, move, opText, panText, parseScale, polyText, relText, scaleText, termText, tiltOf, valueOf,
  weightsOf, type Op, type Pan, type Rel, type Scale,
} from '../lib/algebra-tiles-balance';
import { degreeOf, kindOrder, kindsOf, powsOf, type Poly } from '../lib/algebra-tiles-poly';
import { tileValueText } from '../lib/algebra-tiles-mat';

export interface BalanceConfig extends AlgebraConfig {
  /** "3x + 2 = 14", "2(x + 3) = 16" (groups), "x/3 + 1 = 5", "2x + 1 > 7", "v = u + at". */
  equation?: string;
  /** Tiles to add or take away (default: the equation's one-letter kinds and 1). */
  tray?: string[];
  /** Moves offered: `tiles` (add / take away), `times`, `divide` (default all; [] = none, e.g. try mode). */
  ops?: string[];
  /** Letters to × and ÷ by (formulae): [a]. */
  by?: string[];
  /** The «both pans» button (default true); false = the learner does each move pan by pan. */
  both?: boolean;
  /** Biggest number to × or ÷ by (default 12); `negative: false` = positive numbers only. */
  max?: number;
  negative?: boolean;
  /** Try mode: every letter tile shows this value (`true` = none yet), changed with −/+ within `range` (default [−10, 20]). */
  try?: number | boolean;
  range?: [number, number];
  /** A solution of the first equation, so a tipped beam leans the right way (default: solved, if linear). */
  weights?: Record<string, number>;
  /** Inequalities: the sign turns itself after × or ÷ by a negative (`auto`, default) or the learner taps it. */
  flip?: 'auto' | 'learner';
}

type Step = { eq: string; op?: Op };
const opKey = (o: Op) => (o.op === 'add' ? `add:${kindsOf(o.q)[0]}:${Math.sign(Object.values(o.q)[0])}` : o.op === 'expand' ? 'expand' : `${o.op}:${o.k}`);

export function mount(host: AlgebraHost, cfg: AlgebraConfig): AlgebraPart {
  const c = cfg as BalanceConfig;
  const first = parseScale(c.equation ?? 'x = 0');
  const letters = lettersOf(first);
  const weights = c.weights ?? weightsOf(first);
  const trying = c.try !== undefined && c.try !== false;
  const ops = c.ops ?? (trying ? [] : ['tiles', 'times', 'divide']);
  const tray = c.tray ?? [...new Set(first.pans.flatMap((p) => kindsOf(p.p)).filter((k) => degreeOf(k) === 1 && !k.includes('*')).concat('1'))].sort(kindOrder);
  const max = Number(c.max ?? 12);
  const ks = [...(c.negative === false ? [] : Array.from({ length: max }, (_, i) => i - max)), ...Array.from({ length: max - 1 }, (_, i) => i + 2)];
  const [lo, hi] = (c.range ?? [-10, 20]).map(Number);
  const digits = host.lab('digits') || '0123456789';
  const plain = (s: string) => s.replace(/\*/g, '×').replace(/-/g, '−').replace(/\^2/g, '²').replace(/\d/g, (d) => digits[+d]);

  let cur: Scale, steps: Step[], undo: { cur: Scale; steps: Step[]; ok: boolean }[], ok: boolean, turned: boolean;
  let pending: string[] = [], armed: Op | null = null, k = 2, msg = '';
  let g: number | null = trying && c.try !== true ? Number(c.try) : null;
  const shows = () => trying && g !== null; // the letter tiles show the value tried
  const reset = () => {
    cur = { pans: [...first.pans], rel: first.rel };
    steps = [{ eq: String(c.equation ?? scaleText(first)) }]; // as the mission writes it: v = u + at
    undo = [];
    pending = [];
    ok = true;
    turned = false;
  };
  reset();

  const doMove = (o: Op, where: 0 | 1 | 'both') => {
    const was = ok;
    undo.push({ cur, steps: [...steps], ok });
    cur = move(cur, o, where);
    const j = judge(cur, first);
    const turn = j.same && cur.rel !== j.rel && c.flip !== 'learner';
    if (turn) cur = { ...cur, rel: j.rel };
    ok = j.same && cur.rel === j.rel;
    turned = j.same && !ok;
    if (ok) {
      const last = steps[steps.length - 1];
      // the same tile again (on both pans, or pan by pan): one step (−1, −1 → −2)
      pending.push(opKey(o));
      if (last.op?.op === 'add' && o.op === 'add' && pending.every((x) => x === opKey(last.op!))) {
        const q: Poly = {};
        for (const [kk, v] of Object.entries(last.op.q)) q[kk] = v + (o.q[kk] ?? 0);
        steps[steps.length - 1] = { eq: scaleText(cur), op: { op: 'add', q } };
      } else steps.push({ eq: scaleText(cur), op: o });
      pending = [];
    } else pending.push(opKey(o));
    msg = !ok ? host.lab(turned ? 'label-turn' : 'label-tipped', turned ? 'Turn the sign round!' : 'The scale tipped!')
      : turn ? host.lab('label-turned', 'A negative number turned the sign round.')
      : !was ? host.lab('label-level', 'Level again.') : '';
    const tile = o.op === 'add' ? termText(kindsOf(o.q)[0], Object.values(o.q)[0]) : undefined;
    host.log({ do: o.op, tile, k: o.op === 'mul' || o.op === 'div' ? String(o.k) : undefined, pan: where === 'both' ? 'both' : where ? 'right' : 'left' });
  };

  // ---------- drawing ----------

  const lump = (kind: string, cf: number, flip: boolean) => {
    const syms = Object.keys(powsOf(kind));
    let t = termText(kind, cf);
    if (flip && kind !== '1') {
      const d = denOf(cf), n = Math.round(cf * d), v = tileValueText(kind, { [letters[0]]: g ?? 0 });
      t = `${n === 1 ? '' : n === -1 ? '-' : `${n}*`}${n !== 1 && v.startsWith('-') ? `(${v})` : v}${d > 1 ? `/${d}` : ''}`;
    }
    const cls = `kg-at-t kg-at-lump d${Math.min(2, degreeOf(kind))}${cf < 0 ? ' neg' : ''}${syms.includes('y') ? ' y' : ''}${syms.some((s) => s !== 'x' && s !== 'y') ? ' sym' : ''}`;
    return `<span class="${cls}" aria-hidden="true">${host.alg(t)}</span>`;
  };
  // biggest tiles first, white before red: v and −u, not −u and v
  const order = (p: Poly) => kindsOf(p).sort((a, b) => degreeOf(b) - degreeOf(a) || Math.sign(p[b]) - Math.sign(p[a]) || kindOrder(a, b));
  const tilesOf = (p: Poly) => order(p).map((kind) => {
    const cf = p[kind];
    return Number.isInteger(cf) && Math.abs(cf) <= 20 && degreeOf(kind) <= 2 ? host.tile(kind, Math.sign(cf), shows()).repeat(Math.abs(cf)) : lump(kind, cf, shows());
  }).join('');
  const count = (p: Poly) => Object.values(p).reduce((a, v) => a + (Number.isInteger(v) ? Math.abs(v) : 1), 0);

  const panInner = (pan: Pan) => {
    let h = !kindsOf(pan.p).length ? `<span class="kg-at-zero">${host.alg('0')}</span>`
      : pan.n > 1 && pan.n * count(pan.p) <= 24 ? `<span class="kg-at-grp">${tilesOf(pan.p)}</span>`.repeat(pan.n)
      : pan.n > 1 ? `<span class="kg-at-t kg-at-lump d1">${host.alg(panText({ ...pan, den: '1' }))}</span>` : tilesOf(pan.p);
    if (pan.den !== '1') h = `<span class="kg-at-over"><span class="kg-at-top">${h}</span><span class="kg-at-den">${host.alg(pan.den.replace(/\*/g, ''))}</span></span>`;
    return h;
  };

  const panHTML = (i: 0 | 1) => {
    const pan = cur.pans[i];
    const name = host.fill(i ? 'label-right' : 'label-left', { e: plain(panText(pan)) }, i ? 'right pan: {e}' : 'left pan: {e}');
    const total = trying ? `<span class="kg-at-total">${g === null ? '?' : host.alg(polyText({ '1': valueOf(pan, { [letters[0]]: g }) }))}</span>` : '';
    const cls = `kg-at-pan${i ? ' r' : ''}`;
    return ops.length || c.by?.length
      ? `<button type="button" class="${cls}" data-a="b-pan" data-i="${i}" data-k="pan${i}" aria-label="${name}">${panInner(pan)}</button>${total}`
      : `<div class="${cls}" role="img" aria-label="${name}">${panInner(pan)}</div>${total}`;
  };

  const tilt = () => {
    if (!trying) return tiltOf(cur, ok, weights);
    if (g === null) return 0;
    const d = valueOf(cur.pans[0], { [letters[0]]: g }) - valueOf(cur.pans[1], { [letters[0]]: g });
    return Math.abs(d) < 1e-9 ? 0 : d > 0 ? 1 : -1;
  };
  const shown = (): string => {
    if (trying) return g === null ? '?' : tilt() ? '≠' : '=';
    return cur.rel === '=' && !ok ? '≠' : relText(cur.rel);
  };

  const scaleHTML = () => {
    const t = tilt(), sign = shown();
    const mid = c.flip === 'learner' && cur.rel !== '='
      ? `<button type="button" class="kg-at-rel" data-a="b-rel" data-k="rel" aria-label="${host.lab('label-rel', 'turn the sign')}">${host.alg(sign)}</button>`
      : `<span class="kg-at-rel${sign === '≠' ? ' bad' : ''}">${host.alg(sign)}</span>`;
    return `<div class="kg-at-bal" dir="ltr" style="--t:${t}" data-tilt="${t}"><span class="kg-at-beam" aria-hidden="true"></span>` +
      `<div class="kg-at-pans"><div class="kg-at-side-l">${panHTML(0)}</div><div class="kg-at-mid">${mid}<span class="kg-at-post" aria-hidden="true"></span></div><div class="kg-at-side-r">${panHTML(1)}</div></div></div>`;
  };

  const stepsHTML = () => {
    const items = steps.map((s) => {
      const op = s.op ? (s.op.op === 'expand' ? host.lab('label-open', 'open brackets') : host.alg(opText(s.op))) : '';
      return `<li>${op ? `<span class="kg-at-op">${op}</span>` : ''}${host.alg(s.eq)}</li>`;
    });
    if (!ok && !trying) items.push(`<li class="bad">${host.alg(`${panText(cur.pans[0])} ${shown()} ${panText(cur.pans[1])}`)}</li>`);
    return `<ol class="kg-at-steps" dir="ltr" aria-label="${host.lab('label-steps', 'steps')}">${items.slice(-6).join('')}</ol>`;
  };

  const btn = (a: string, key: string, face: string, label: string, extra = '') =>
    `<button type="button" class="kg-at-btn" data-a="${a}" data-k="${key}" aria-label="${label}"${extra}>${face}</button>`;

  const opsHTML = () => {
    const press = (o: Op) => ` aria-pressed="${!!armed && opKey(armed) === opKey(o)}"`;
    let rows = '';
    if (ops.includes('tiles')) rows += `<div class="kg-at-row">${tray.flatMap((kind) => [1, -1].map((s) => {
      const name = host.tileName(kind, 1);
      return btn('b-op', `o${s}${kind}`, `${s > 0 ? '+' : '−'}${host.tile(kind, 1)}`,
        host.fill(s > 0 ? 'label-put' : 'label-take', { t: name }, s > 0 ? 'add {t}' : 'take away {t}'), ` data-o="add" data-kind="${kind}" data-s="${s}"${press({ op: 'add', q: { [kind]: s } })}`);
    })).join('')}</div>`;
    const num = ['times', 'divide'].filter((x) => ops.includes(x));
    if (num.length || c.by?.length) {
      let h = '';
      if (num.length) {
        h += `<span class="kg-at-num">${btn('b-k', 'k-', '−', host.lab('label-smaller', 'smaller number'), ks.indexOf(k) <= 0 ? ' disabled' : '')}<output>${host.alg(String(k))}</output>${btn('b-k', 'k+', '+', host.lab('label-bigger', 'bigger number'), ks.indexOf(k) >= ks.length - 1 ? ' disabled' : '')}</span>`;
        for (const x of num) {
          const o: Op = { op: x === 'times' ? 'mul' : 'div', k };
          h += btn('b-op', `o${x}`, host.alg(opText(o)), host.fill(`label-${x}`, { n: plain(String(k)) }, x === 'times' ? 'times {n}' : 'divide by {n}'), ` data-o="${o.op}" data-n="${k}"${press(o)}`);
        }
      }
      for (const s of c.by ?? []) for (const o of [{ op: 'mul', k: s }, { op: 'div', k: s }] as Op[])
        h += btn('b-op', `o${opKey(o)}`, host.alg(opText(o)), host.fill(o.op === 'mul' ? 'label-times' : 'label-divide', { n: s }, o.op === 'mul' ? 'times {n}' : 'divide by {n}'), ` data-o="${o.op}" data-n="${s}"${press(o)}`);
      rows += `<div class="kg-at-row">${h}</div>`;
    }
    let h = '';
    if (c.both !== false && (ops.length || c.by?.length)) h += `<button type="button" class="kg-at-btn both" data-a="b-both" data-k="both"${armed ? '' : ' disabled'}>${host.lab('label-both', 'both pans')}</button>`;
    if (cur.pans.some((p) => p.n > 1)) h += `<button type="button" class="kg-at-btn" data-a="b-open" data-k="open">${host.lab('label-open', 'open brackets')}</button>`;
    if (ops.length || c.by?.length) {
      h += `<button type="button" class="kg-at-btn" data-a="b-undo" data-k="undo"${undo.length ? '' : ' disabled'}>${host.lab('label-undo', 'undo')}</button>`;
      h += `<button type="button" class="kg-at-btn" data-a="b-clear" data-k="clear"${undo.length ? '' : ' disabled'}>${host.lab('label-clear', 'start again')}</button>`;
    }
    rows += h ? `<div class="kg-at-row">${h}</div>` : '';
    return rows ? `<div class="kg-at-ops" dir="ltr" role="group" aria-label="${host.lab('label-moves', 'moves')}">${rows}</div>` : '';
  };

  const tryHTML = () => {
    const name = host.fill('label-try', { v: letters[0] }, '{v} =');
    return `<div class="kg-at-try" dir="ltr" role="group" aria-label="${name}"><span>${host.alg(`${letters[0]} =`)}</span>` +
      btn('b-try', 'try-', '−', host.lab('label-smaller', 'smaller number'), g !== null && g <= lo ? ' disabled' : ' data-d="-1"') +
      `<output>${g === null ? '?' : host.alg(String(g))}</output>` +
      btn('b-try', 'try+', '+', host.lab('label-bigger', 'bigger number'), g !== null && g >= hi ? ' disabled' : ' data-d="1"') + '</div>';
  };

  return {
    keypad: false,
    html() {
      if (g !== null) c.value = { [letters[0]]: g }; // the tiles show the value tried (the engine's flip picture)
      return (trying ? '' : stepsHTML()) + scaleHTML() + (trying ? tryHTML() : opsHTML()) + `<p class="kg-at-msg bal" role="status">${msg}</p>`;
    },
    act(d) {
      switch (d.a) {
        case 'b-op': {
          const o: Op = d.o === 'add' ? { op: 'add', q: { [d.kind!]: Number(d.s) } } : { op: d.o as 'mul' | 'div', k: /^-?\d+$/.test(d.n!) ? Number(d.n) : d.n! };
          armed = o; // stays chosen until another move is chosen: tap a pan, then the other, or Both pans again
          msg = armed ? host.lab(c.both === false ? 'label-pick-pan' : 'label-pick', c.both === false ? 'Now tap a pan.' : 'Now tap a pan, or both pans.') : '';
          break;
        }
        case 'b-k': {
          k = ks[Math.max(0, Math.min(ks.length - 1, ks.indexOf(k) + (d.k === 'k+' ? 1 : -1)))];
          if (armed && armed.op !== 'add' && typeof armed.k === 'number') armed = { ...armed, k };
          break;
        }
        case 'b-pan':
          if (!armed) msg = host.lab('label-pick-move', 'First choose a move.');
          else doMove(armed, Number(d.i) as 0 | 1);
          break;
        case 'b-both':
          if (armed) doMove(armed, 'both');
          break;
        case 'b-open':
          undo.push({ cur, steps: [...steps], ok });
          cur = { ...cur, pans: cur.pans.map((p) => applyOp(p, { op: 'expand' })) as [Pan, Pan] };
          if (ok) steps.push({ eq: scaleText(cur), op: { op: 'expand' } });
          host.log({ do: 'expand' });
          msg = '';
          break;
        case 'b-undo': {
          const u = undo.pop();
          if (u) ({ cur, steps, ok } = u), (turned = !ok && judge(cur, first).same), (pending = []);
          host.log({ do: 'undo' });
          msg = '';
          break;
        }
        case 'b-clear':
          reset();
          armed = null;
          host.log({ do: 'clear' });
          msg = '';
          break;
        case 'b-rel': {
          undo.push({ cur, steps: [...steps], ok });
          const was = ok;
          cur = { ...cur, rel: ({ '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=' } as Record<Rel, Rel>)[cur.rel] };
          const j = judge(cur, first);
          ok = j.same && cur.rel === j.rel;
          turned = j.same && !ok;
          if (ok && !was) steps.push({ eq: scaleText(cur) });
          msg = ok ? host.lab('label-level', 'Level again.') : '';
          host.log({ do: 'rel' });
          break;
        }
        case 'b-try':
          g = Math.max(lo, Math.min(hi, (g ?? 0) + Number(d.d)));
          host.log({ do: 'try', k: String(g) });
          break;
        default:
          return false;
      }
      return true;
    },
    state() {
      return {
        pans: cur.pans.map((p) => ({ p: { ...p.p }, n: p.n, den: p.den })),
        rel: cur.rel,
        level: ok,
        turned,
        tried: trying ? g : undefined,
        steps: steps.map((s) => s.eq),
      };
    },
  };
}

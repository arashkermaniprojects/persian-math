// The `summary` module of <kg-chart-builder>, loaded only by missions with `module: summary`: averages and spread.
//   line   the data as a row of cards; the learner lines them up in order (tap a card, then its new place; or
//          arrow keys) and marks the middle card(s), the ends …
//   dots   a dot plot on a number line (one dot per value, stacked); tap a stack to mark it (the mode, the ends,
//          an outlier); drag a dot along the line and watch the mean, median and range react.
//   two sets are drawn as two dot plots on the same scale, for comparing.
// Under the picture: live readouts, typed answers, «which average is best?» and sentence frames for comparing.
// Every picture runs left to right in every locale; the questions follow the page. Logic: ../lib/chart-builder-summary.
import type { ChartBuilderConfig, ChartHost, ChartModule } from '../chart-builder';
import { asciiDigits } from '../../lib/fraction';
import { mad, mean, median, modes, range, type Stat, type SummaryState } from '../lib/chart-builder-summary';

export interface SummaryConfig {
  /** The data (one set), in the order the cards are dealt. */
  numbers?: number[];
  /** Several sets on the same scale (label `set-<key>`), e.g. two classes. */
  sets?: { key: string; numbers: number[] }[];
  /** `dots` (default): dot plot; `line`: a row of cards; `both`. Cards are for one set only. */
  view?: 'dots' | 'line' | 'both';
  /** The learner can move the cards to line them up. */
  order?: boolean;
  /** The learner can mark cards (line) or stacks (dot plot). */
  mark?: boolean;
  /** Dots that can be dragged along the line: true = all, or card indices of the first set. */
  drag?: boolean | number[];
  /** Dot plot scale: ends, the gap between columns (default 1) and between numbers (default: as fits). */
  min?: number;
  max?: number;
  unit?: number;
  step?: number;
  /** Axis title: label `axis-<key>`. */
  axis?: string;
  /** Live readouts (mean, median, mode, range, mad); `balance` = ▲ at the mean under the line; `deviations` = each
   *  dot's distance from the mean. */
  show?: string[];
  /** Typed answers (one box per set when there are several). */
  ask?: Stat[];
  /** «Which average is best?»: the choices (mean, median, mode), labels `stat-<key>`. */
  best?: string[];
  /** Sentence frames: label `frame-<key>` with {1}, {2} … for the slots; options are labels `opt-<o>` (or a set name). */
  frames?: { key: string; slots: string[][] }[];
}

/** One data set: values as given, values now (by card id), and the marked card ids. */
interface Data { key: string; given: number[]; data: number[]; marked: Set<number> }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const NS = 'http://www.w3.org/2000/svg';
const SHOW: Record<string, (a: number[]) => number> = { mean, median, range, mad, mode: (a) => modes(a)[0] ?? NaN };

export function mount(host: ChartHost, cfg: ChartBuilderConfig): ChartModule {
  const c: SummaryConfig = (cfg as { summary?: SummaryConfig }).summary ?? {};
  const sets: Data[] = (c.sets ?? (c.numbers ? [{ key: 'a', numbers: c.numbers }] : [])).map((s) => ({
    key: s.key, given: s.numbers.slice(), data: s.numbers.slice(), marked: new Set<number>(),
  }));
  const view = c.view ?? 'dots';
  const line = view !== 'dots' && sets.length ? sets[0].data.map((_, i) => i) : null; // card ids, left to right
  const dots = view !== 'line';
  let tool: 'move' | 'mark' = c.order ? 'move' : 'mark';
  let picked = -1;
  const typed: Record<string, number | null> = {}, raw: Record<string, string> = {};
  let best: string | null = null;
  const compare: Record<string, (string | null)[]> = {};
  let drag: { s: number; id: number; r: DOMRect } | null = null;
  let say = '';

  const unit = c.unit ?? 1;
  const all = sets.flatMap((s) => s.given);
  const lo = c.min ?? Math.min(...all, Infinity);
  const hi = c.max ?? Math.max(...all, -Infinity);
  const can = (s: number, id: number) => c.drag === true || (Array.isArray(c.drag) && !s && c.drag.includes(id));
  const L = (k: string, fb = '') => host.L(k, fb);
  const fill = (t: string, o: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => o[k] ?? m);
  const setName = (s: Data) => L(`set-${s.key}`, s.key);
  const keyOf = (stat: string, s: Data) => (sets.length > 1 ? `${stat}-${s.key}` : stat);

  // ---------- drawing ----------

  function plot(si: number) {
    const s = sets[si];
    const W = Math.max(240, host.width);
    const M = 18;
    const span = Math.max(unit, hi - lo);
    const x = (v: number) => M + ((v - lo) / span) * (W - 2 * M);
    const colW = ((W - 2 * M) / span) * unit;
    const r = Math.max(5, Math.min(11, colW / 2 - 1.5));
    const gap = 2 * r + 2;
    const top = Math.max(2, ...sets.map((t) => Math.max(...t.given.map((v) => t.given.filter((w) => w === v).length)))) + (c.drag ? 1 : 0);
    const named = sets.length > 1;
    const T = named ? 22 : 6;
    const y0 = T + top * gap + 6;
    const labelEvery = c.step ?? Math.max(1, Math.ceil(34 / colW)) * unit;
    const H = y0 + 30 + (c.show?.includes('balance') ? 14 : 0) + (c.axis ? 18 : 0);
    let g = named ? `<text class="lab ttl" x="${M}" y="15">${esc(setName(s))}</text>` : '';
    g += `<path class="axis" d="M${M - 10} ${y0}H${W - M + 10}"/>`;
    for (let v = lo, k = 0; v <= hi + 1e-9; v = lo + ++k * unit) {
      const lab = Math.abs(((v - lo) / labelEvery) % 1) < 1e-6 || Math.abs((((v - lo) / labelEvery) % 1) - 1) < 1e-6;
      g += `<path class="axis" d="M${x(v)} ${y0}v${lab ? 7 : 4}"/>`;
      if (lab) g += `<text class="lab" x="${x(v)}" y="${y0 + 22}" text-anchor="middle">${host.num(+v.toFixed(6))}</text>`;
    }
    const m = mean(s.data);
    const stacks = new Map<number, number[]>();
    s.data.forEach((v, id) => stacks.set(v, [...(stacks.get(v) ?? []), id]));
    if (c.show?.includes('deviations'))
      g += `<path class="mean" d="M${x(m)} ${T - 2}V${y0}"/>` + [...stacks].map(([v, ids]) => ids.map((_, j) => `<path class="dev" d="M${x(v)} ${y0 - r - 2 - j * gap}H${x(m)}"/>`).join('')).join('');
    for (const [v, ids] of [...stacks].sort((a, b) => a[0] - b[0])) {
      const on = ids.every((id) => s.marked.has(id));
      if (c.mark) {
        const said = fill(L('label-stack', '{v}: {n}'), { v: host.num(v), n: host.num(ids.length) });
        g += `<rect class="hit stk${on ? ' on' : ''}" x="${x(v) - Math.max(colW, 22) / 2}" y="${T}" width="${Math.max(colW, 22)}" height="${y0 - T + 4}" data-a="s-stack" data-set="${si}" data-v="${v}" data-k="stack-${si}-${v}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(said)}"/>`;
      }
      ids.forEach((id, j) => {
        const cy = y0 - r - 2 - j * gap;
        const cls = `dot${s.marked.has(id) ? ' on' : ''}${can(si, id) ? ' dr' : ''}${drag?.s === si && drag.id === id ? ' now' : ''}`;
        g += `<circle class="${cls}" cx="${x(v)}" cy="${cy}" r="${r}"/>`;
        if (can(si, id))
          g += `<circle class="hd" cx="${x(v)}" cy="${cy}" r="22" data-d="${si}:${id}" data-k="drag-${si}-${id}" tabindex="0" role="slider" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${v}" aria-valuetext="${host.num(v)}" aria-label="${esc(L('label-drag', 'drag'))}"/>`;
      });
    }
    if (c.show?.includes('balance')) g += `<path class="fulcrum" d="M${x(m)} ${y0 + 27}l-8 12h16z"/>`;
    if (c.axis) g += `<text class="lab ttl" x="${W - M}" y="${H - 4}" text-anchor="end">${esc(L(`axis-${c.axis}`))}</text>`;
    const role = c.mark || c.drag ? 'group' : 'img';
    const said = `${named ? setName(s) + ': ' : ''}${[...s.data].sort((a, b) => a - b).map((v) => host.num(v)).join(' ')}`;
    return `<svg xmlns="${NS}" class="kg-cb-svg kg-cbs-plot" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="${role}" aria-label="${esc(L('label-plot', '') + ' ' + said)}">${g}</svg>`;
  }

  function cards() {
    const s = sets[0];
    const tools = c.order && c.mark
      ? `<div class="kg-cbs-tools" role="radiogroup" aria-label="${esc(L('label-tools'))}">` +
        (['move', 'mark'] as const).map((t) => `<button type="button" role="radio" class="kg-cb-kind" data-a="s-tool" data-t="${t}" data-k="tool-${t}" aria-checked="${tool === t}">${esc(L(`label-tool-${t}`, t))}</button>`).join('') + '</div>'
      : '';
    const b = line!.map((id, pos) => {
      const on = s.marked.has(id), up = picked === id;
      const press = tool === 'move' ? up : on;
      const said = `${host.num(s.data[id])}${on ? ' — ' + L('label-marked') : ''}`;
      return `<button type="button" class="kg-cbs-card${on ? ' on' : ''}${up ? ' up' : ''}" data-a="s-card" data-p="${pos}" data-k="card-${id}" aria-pressed="${press}" aria-label="${esc(said)}">${host.num(s.data[id])}</button>`;
    });
    return tools + `<div class="kg-cbs-line" dir="ltr" role="group" aria-label="${esc(L('label-cards'))}">${b.join('')}</div>`;
  }

  function readouts() {
    const ks = (c.show ?? []).filter((k) => SHOW[k]);
    if (!ks.length) return '';
    const rows = sets.map((s) => {
      const parts = ks.map((k) => {
        const v = SHOW[k](s.data);
        return `<span>${esc(L(`stat-${k}`, k))}: <b>${Number.isNaN(v) ? '—' : host.num(+v.toFixed(2))}</b></span>`;
      });
      return `<p>${sets.length > 1 ? `<b>${esc(setName(s))}</b> ` : ''}${parts.join(' ')}</p>`;
    });
    return `<div class="kg-cbs-read" role="status">${rows.join('')}</div>`;
  }

  function asks() {
    if (!c.ask?.length) return '';
    const f = c.ask.flatMap((k) => sets.map((s) => {
      const key = keyOf(k, s);
      const name = (sets.length > 1 ? setName(s) + ' — ' : '') + L(`stat-${k}`, k);
      return `<label class="kg-cbs-q"><span>${esc(name)}</span><input class="kg-cb-num" inputmode="decimal" autocomplete="off" data-ask="${key}" data-k="ask-${key}" value="${esc(raw[key] ?? '')}"></label>`;
    }));
    return `<div class="kg-cbs-asks">${f.join('')}</div>`;
  }

  function bestOf() {
    if (!c.best) return '';
    const b = c.best.map((k) => `<button type="button" role="radio" class="kg-cb-kind" data-a="s-best" data-b="${k}" data-k="best-${k}" aria-checked="${best === k}">${esc(L(`stat-${k}`, k))}</button>`);
    return `<div class="kg-cbs-best" role="radiogroup" aria-label="${esc(L('label-best'))}"><p>${esc(L('label-best'))}</p>${b.join('')}</div>`;
  }

  function frames() {
    return (c.frames ?? []).map((f) => {
      const got = compare[f.key] ?? [];
      const html = L(`frame-${f.key}`, f.slots.map((_, i) => `{${i + 1}}`).join(' ')).split(/(\{\d\})/).map((part) => {
        const m = /^\{(\d)\}$/.exec(part);
        if (!m) return esc(part);
        const i = +m[1] - 1, opts = f.slots[i] ?? [];
        const o = opts.map((v) => `<option value="${esc(v)}"${got[i] === v ? ' selected' : ''}>${esc(L(`opt-${v}`, L(`set-${v}`, L(`stat-${v}`, v))))}</option>`);
        return `<select data-f="${f.key}" data-i="${i}" data-k="frame-${f.key}-${i}" aria-label="${esc(fill(L('label-slot', '{n}'), { n: host.num(i + 1) }))}"><option value="">…</option>${o.join('')}</select>`;
      });
      return `<p class="kg-cbs-frame">${html.join('')}</p>`;
    }).join('');
  }

  // ---------- interaction ----------

  function moveCard(id: number, to: number) {
    const from = line!.indexOf(id);
    to = Math.max(0, Math.min(line!.length - 1, to));
    if (from === to) return false;
    line!.splice(from, 1);
    line!.splice(to, 0, id);
    return true;
  }

  function setVal(si: number, id: number, v: number) {
    v = Math.max(lo, Math.min(hi, lo + Math.round((v - lo) / unit) * unit));
    v = +v.toFixed(6);
    if (sets[si].data[id] === v) return false;
    sets[si].data[id] = v;
    return true;
  }

  return {
    html() {
      if (!sets.length) return bestOf() + frames();
      let h = '';
      if (line) h += cards();
      if (dots) h += `<div class="kg-cb-chart kg-cbs-dots" dir="ltr">${sets.map((_, i) => plot(i)).join('')}</div>`;
      return h + readouts() + asks() + bestOf() + frames() + `<p class="kg-cbs-say" role="status">${esc(say)}</p>`;
    },

    act(t) {
      say = '';
      const a = t.dataset.a;
      if (a === 's-tool') {
        tool = t.dataset.t as 'move' | 'mark';
        picked = -1;
        return true;
      }
      if (a === 's-card') {
        const id = line![+t.dataset.p!];
        const s = sets[0];
        if (tool === 'mark') s.marked.has(id) ? s.marked.delete(id) : s.marked.add(id);
        else if (picked < 0) (picked = id), (say = L('label-move-to'));
        else {
          if (picked !== id) moveCard(picked, +t.dataset.p!);
          picked = -1;
        }
        return true;
      }
      if (a === 's-stack') {
        const s = sets[+t.dataset.set!], v = +t.dataset.v!;
        const ids = s.data.flatMap((w, id) => (w === v ? [id] : []));
        const on = ids.every((id) => s.marked.has(id));
        ids.forEach((id) => (on ? s.marked.delete(id) : s.marked.add(id)));
        return true;
      }
      if (a === 's-best') {
        best = t.dataset.b!;
        return true;
      }
      return false;
    },

    key(e) {
      const t = e.target as HTMLElement;
      const d = t.dataset?.d;
      if (d) {
        const [si, id] = d.split(':').map(Number);
        const v = sets[si].data[id];
        const k: Record<string, number> = { ArrowRight: v + unit, ArrowUp: v + unit, ArrowLeft: v - unit, ArrowDown: v - unit, Home: lo, End: hi };
        if (!(e.key in k)) return false;
        if (setVal(si, id, k[e.key])) host.changed(true);
        return true;
      }
      // a picked-up card moves along the row with the arrow keys (the row runs left to right in every locale)
      if (t.dataset?.a === 's-card' && tool === 'move' && picked >= 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (moveCard(picked, line!.indexOf(picked) + (e.key === 'ArrowRight' ? 1 : -1))) host.changed(true);
        return true;
      }
      return false;
    },

    down(e) {
      const t = (e.target as Element).closest<SVGElement>('[data-d]');
      if (!t) return false;
      const [si, id] = t.dataset.d!.split(':').map(Number);
      drag = { s: si, id, r: t.ownerSVGElement!.getBoundingClientRect() };
      host.changed(true);
      return true;
    },

    move(e) {
      if (!drag) return;
      const W = Math.max(240, host.width), M = 18;
      const px = ((e.clientX - drag.r.left) / drag.r.width) * W;
      if (setVal(drag.s, drag.id, lo + ((px - M) / (W - 2 * M)) * Math.max(unit, hi - lo))) host.changed(true);
    },

    up() {
      if (!drag) return;
      drag = null;
      host.changed(true);
    },

    input(t) {
      if (t.dataset.ask) {
        const k = t.dataset.ask;
        raw[k] = t.value;
        const s = asciiDigits(t.value.trim()).replace(/[٫,/]/g, '.').replace(/[−–]/g, '-');
        typed[k] = /^-?\d+(\.\d+)?$|^-?\.\d+$/.test(s) ? +s : null;
        return true;
      }
      if (t.dataset.f) {
        (compare[t.dataset.f] ??= [])[+t.dataset.i!] = t.value || null;
        return true;
      }
      return false;
    },

    state(): { summary: SummaryState } {
      return {
        summary: {
          sets: sets.map((s, i) => ({
            key: s.key, given: s.given.slice(), data: s.data.slice(),
            ...(i === 0 && line ? { line: line.map((id) => s.data[id]) } : {}),
            marked: [...s.marked].map((id) => s.data[id]).sort((a, b) => a - b),
          })),
          typed: { ...typed },
          best,
          compare: Object.fromEntries(Object.entries(compare).map(([k, v]) => [k, [...v].map((x) => x ?? null)])),
        },
      };
    },
  };
}

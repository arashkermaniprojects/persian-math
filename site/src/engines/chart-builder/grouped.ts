// The `grouped` module of <kg-chart-builder>, loaded only by missions with `module: grouped`: grouped data.
//   cards   the raw data; the learner taps a card, then its class (classes are closed on the left: 140 ≤ x < 145);
//           without `sort` the data is a plain list to count from
//   table   per class: frequency, relative frequency, midpoint, midpoint × frequency, running total, each shown or
//           typed, with a total row; or named rows with a value each (a weighted mean of two classes' averages)
//   graph   an equal-width histogram (bars touch), a frequency polygon at the midpoints, a cumulative frequency
//           graph at the class ends: shown, or built by the learner (bars dragged; points tapped or placed with a
//           keyboard cursor); «which graph?» pictures to choose from
// Every graph runs left to right in every locale; the table follows the page. Logic: ../lib/chart-builder-grouped.
import type { ChartBuilderConfig, ChartHost, ChartModule } from '../chart-builder';
import { asciiDigits } from '../../lib/fraction';
import { niceStep } from '../lib/chart-builder-model';
import { COLS, counts, mids, running, type Col, type GroupedState } from '../lib/chart-builder-grouped';

type Graph = 'histogram' | 'polygon' | 'cumulative';
export interface GroupedConfig {
  /** Class boundaries, equal widths: [140, 145, …, 170] → 140 ≤ x < 145 … (label `label-class`, `{a}` `{b}`). */
  classes?: number[];
  /** The last class includes its upper end (label `label-class-last`). */
  last?: boolean;
  /** Named rows instead of classes (label `row-<key>`), each with its value (shown in the `mid` column) and frequency. */
  rows?: { key: string; x: number; f: number }[];
  /** The raw data, in the order dealt: cards to sort (`sort`), else a list to count from. */
  data?: number[];
  /** Frequencies per class when there is no `data`. */
  freq?: number[];
  /** Names the first column: label `head-<head>` (default `col-class`). */
  head?: string;
  /** The learner sorts the data cards into the classes. */
  sort?: boolean;
  /** Table columns, shown or typed: f, rel, mid, fx, cum (labels `col-<key>`). */
  columns?: Partial<Record<Col, 'show' | 'edit'>>;
  /** A total row (label `label-total`) under f, rel and fx; typed where the column is typed. */
  total?: boolean;
  /** «Which graph?»: pictures to choose from (bars, histogram, polygon, cumulative), labels `chart-<key>`. */
  choose?: string[];
  /** Graphs drawn from the data. */
  show?: Graph[];
  /** The graph the learner builds. */
  draw?: Graph;
  /** Value axis: top, numbers every `step`, the learner's values move in steps of `snap` (default 1). */
  max?: number;
  step?: number;
  snap?: number;
  /** Axis titles [x, y] → labels `axis-<key>`. */
  axes?: [string?, string?];
  /** Typed answers: mean, median (labels `stat-<key>`). */
  ask?: ('mean' | 'median')[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const NS = 'http://www.w3.org/2000/svg';
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
/** Small pictures of the graphs, for «which graph?». */
const PICS: Record<string, string> = {
  bars: '<path class="ax" d="M2 2v28h36"/><rect x="5" y="16" width="7" height="14"/><rect x="16" y="6" width="7" height="24"/><rect x="27" y="12" width="7" height="18"/>',
  histogram: '<path class="ax" d="M2 2v28h36"/><rect x="4" y="16" width="10" height="14"/><rect x="14" y="6" width="10" height="24"/><rect x="24" y="12" width="10" height="18"/>',
  polygon: '<path class="ax" d="M2 2v28h36"/><path class="ln" d="M4 30L9 16 19 6 29 12 37 30"/>',
  cumulative: '<path class="ax" d="M2 2v28h36"/><path class="ln" d="M4 30L12 25 20 12 28 6 36 4"/>',
};

export function mount(host: ChartHost, cfg: ChartBuilderConfig): ChartModule {
  const c: GroupedConfig = (cfg as { grouped?: GroupedConfig }).grouped ?? {};
  const L = (k: string, fb = '') => host.L(k, fb);
  const fill = (t: string, o: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => o[k] ?? m);
  const b = c.rows ? [] : c.classes ?? [];
  const last = !!c.last;
  const data = c.data ?? [];
  const k = c.rows ? c.rows.length : Math.max(0, b.length - 1);
  const freq = c.rows ? c.rows.map((r) => r.f) : c.freq ?? counts(data, b, last);
  const x = c.rows ? c.rows.map((r) => r.x) : mids(b);
  const n = sum(freq);
  const cols = COLS.filter((col) => c.columns?.[col]);
  const w = b.length > 1 ? b[1] - b[0] : 1;
  const snap = c.snap ?? 1;

  const cards = data.map(() => -1);
  let sel = -1;
  const typed: Record<string, number | null> = {}, raw: Record<string, string> = {};
  for (const col of cols)
    if (c.columns![col] === 'edit') {
      for (let i = 0; i < k; i++) typed[`${col}-${i}`] = null;
      if (c.total && col !== 'mid' && col !== 'cum') typed[`${col}-total`] = null;
    }
  for (const a of c.ask ?? []) typed[a] = null;
  const bars: number[] = c.draw === 'histogram' ? freq.map(() => 0) : [];
  let points: [number, number][] = [];
  let chosen: string | null = null;
  let cur: [number, number] | null = null; // the keyboard cursor on the points graph
  let drag: { r: DOMRect; bar?: number; pt?: number; tap?: boolean } | null = null;
  let say = '';

  // ---------- the graph's scales ----------
  const graphs = new Set<Graph>([...(c.show ?? []), ...(c.draw ? [c.draw] : [])]);
  const cumul = graphs.has('cumulative');
  const pad = graphs.has('polygon') ? w : 0;
  const xlo = (b[0] ?? 0) - pad, xhi = (b[k] ?? 1) + pad;
  const top0 = Math.max(1, cumul ? n : Math.max(...freq));
  const ystep = c.step ?? niceStep(top0, 8);
  const yhi = c.max ?? Math.ceil(top0 / ystep) * ystep;
  const W = () => Math.max(240, host.width);
  const ML = 38, MR = 14, MT = c.axes?.[1] ? 28 : 14, PH = 190, y0 = MT + PH;
  const X = (v: number) => ML + ((v - xlo) / (xhi - xlo)) * (W() - ML - MR);
  const Y = (v: number) => y0 - (v / yhi) * PH;
  const unX = (px: number) => xlo + ((px - ML) / (W() - ML - MR)) * (xhi - xlo);
  const unY = (py: number) => ((y0 - py) / PH) * yhi;
  const snapX = (v: number) => Math.max(xlo, Math.min(xhi, xlo + Math.round((v - xlo) / (w / 2)) * (w / 2)));
  const snapY = (v: number) => Math.max(0, Math.min(yhi, Math.round(v / snap) * snap));
  const r6 = (v: number) => +v.toFixed(6);

  const classText = (i: number) => c.rows
    ? esc(L(`row-${c.rows[i].key}`, c.rows[i].key))
    : `<span dir="ltr">${esc(fill(L(last && i === k - 1 ? 'label-class-last' : 'label-class', '{a}–{b}'), { a: host.num(b[i]), b: host.num(b[i + 1]) }))}</span>`;
  const live = () => (c.sort ? freq.map((_, i) => cards.filter((r) => r === i).length) : freq);
  const value = (col: Col, i: number) => {
    const f = live();
    return col === 'f' ? f[i] : col === 'rel' ? f[i] / n : col === 'mid' ? x[i] : col === 'fx' ? f[i] * x[i] : running(f)[i];
  };
  const input = (key: string, label: string) =>
    `<input class="kg-cb-num" inputmode="decimal" autocomplete="off" data-gt="${key}" data-k="in-${key}" value="${esc(raw[key] ?? '')}" aria-label="${esc(label)}">`;
  const colName = (col: Col) => L(`col-${col}`, col);
  const plain = (i: number) => (c.rows ? L(`row-${c.rows[i].key}`) : fill(L('label-class', '{a}–{b}'), { a: host.num(b[i]), b: host.num(b[i + 1]) }));

  // ---------- drawing ----------

  function tray() {
    const left = data.map((v, id) => [v, id]).filter(([, id]) => cards[id] < 0);
    const bt = left.map(([v, id]) =>
      `<button type="button" class="kg-cbg-card" data-a="g-card" data-c="${id}" data-k="card-${id}" aria-pressed="${sel === id}">${host.num(v)}</button>`);
    return `<div class="kg-cbg-cards" dir="ltr" role="group" aria-label="${esc(L('label-cards'))}">${bt.join('') || `<span>${esc(L('label-all-sorted', '✓'))}</span>`}</div>`;
  }

  function table() {
    const th = (s: string) => `<th scope="col">${esc(s)}</th>`;
    let h = `<div class="kg-cbg-wrap"><table class="kg-cb-table kg-cbg-table"><thead><tr>${th(L(c.head ? `head-${c.head}` : 'col-class'))}${c.sort ? th(L('col-cards')) : ''}${cols.map((col) => th(colName(col))).join('')}</tr></thead><tbody>`;
    for (let i = 0; i < k; i++) {
      h += '<tr>' + (c.sort
        ? `<th scope="row"><button type="button" class="kg-cbg-row" data-a="g-row" data-i="${i}" data-k="row-${i}" aria-label="${esc(fill(L('label-put', '{c}'), { c: plain(i) }))}">${classText(i)}</button></th>`
        : `<th scope="row">${classText(i)}</th>`);
      if (c.sort)
        h += `<td class="kg-cbg-in" dir="ltr">${data.map((v, id) => (cards[id] === i ? `<button type="button" class="kg-cbg-chip" data-a="g-chip" data-c="${id}" data-k="chip-${id}" aria-label="${esc(fill(L('label-take', '{v}'), { v: host.num(v) }))}">${host.num(v)}</button>` : '')).join('')}</td>`;
      for (const col of cols)
        h += c.columns![col] === 'edit'
          ? `<td>${input(`${col}-${i}`, `${plain(i)}: ${colName(col)}`)}</td>`
          : `<td class="kg-cb-n">${host.num(r6(value(col, i)))}</td>`;
      h += '</tr>';
    }
    if (c.total) {
      h += `<tr class="kg-cb-total"><th scope="row">${esc(L('label-total'))}</th>${c.sort ? '<td></td>' : ''}`;
      for (const col of cols) {
        const has = col === 'f' || col === 'rel' || col === 'fx';
        h += !has ? '<td></td>' : c.columns![col] === 'edit'
          ? `<td>${input(`${col}-total`, `${L('label-total')}: ${colName(col)}`)}</td>`
          : `<td class="kg-cb-n">${host.num(r6(sum(Array.from({ length: k }, (_, i) => value(col, i)))))}</td>`;
      }
      h += '</tr>';
    }
    return h + '</tbody></table></div>';
  }

  function choose() {
    const bt = c.choose!.map((g) => `<button type="button" role="radio" class="kg-cb-kind" data-a="g-kind" data-g="${g}" data-k="kind-${g}" aria-checked="${chosen === g}"><svg xmlns="${NS}" class="mini" width="40" height="32" viewBox="0 0 40 32" aria-hidden="true">${PICS[g] ?? ''}</svg><span>${esc(L(`chart-${g}`, g))}</span></button>`);
    return `<div class="kg-cb-kinds" role="radiogroup" aria-label="${esc(L('label-choose'))}">${bt.join('')}</div>`;
  }

  function graph() {
    const Wd = W(), H = y0 + 34 + (c.axes?.[0] ? 18 : 0);
    let g = '';
    for (let v = 0; v <= yhi + 1e-9; v += ystep)
      g += `<path class="grid" d="M${ML} ${Y(v)}H${Wd - MR}"/><text class="lab" x="${ML - 6}" y="${Y(v) + 5}" text-anchor="end">${host.num(r6(v))}</text>`;
    const every = X(xlo + w) - X(xlo) < 30 ? 2 : 1;
    for (let j = 0, v = xlo; v <= xhi + 1e-9; v = xlo + ++j * w) {
      g += `<path class="axis" d="M${X(v)} ${y0}v6"/>`;
      if (j % every === 0) g += `<text class="lab" x="${X(v)}" y="${y0 + 22}" text-anchor="middle">${host.num(r6(v))}</text>`;
    }
    if (xlo > 0) g += `<path class="brk" d="M${ML + 2} ${y0 + 5}l4-10 4 10 4-10"/>`; // the x axis does not start at 0
    if (c.axes?.[1]) g += `<text class="lab ttl" x="${ML - 30}" y="16">${esc(L(`axis-${c.axes[1]}`))}</text>`;
    if (c.axes?.[0]) g += `<text class="lab ttl" x="${Wd - MR}" y="${H - 4}" text-anchor="end">${esc(L(`axis-${c.axes[0]}`))}</text>`;
    // histogram: bars touch, one per class
    if (graphs.has('histogram'))
      for (let i = 0; i < k; i++) {
        const v = c.draw === 'histogram' ? bars[i] : freq[i];
        const rect = `<rect class="bar c-blue" x="${X(b[i])}" y="${Y(v)}" width="${X(b[i + 1]) - X(b[i])}" height="${y0 - Y(v)}"/>`;
        if (c.draw !== 'histogram') { g += rect; continue; }
        const said = `${plain(i)}: ${host.num(v)}`;
        g += `<g class="col" data-gb="${i}" data-k="bar-${i}" tabindex="0" role="slider" aria-label="${esc(plain(i))}" aria-valuemin="0" aria-valuemax="${yhi}" aria-valuenow="${v}" aria-valuetext="${esc(said)}">` +
          `<rect class="hit" x="${X(b[i])}" y="${MT}" width="${X(b[i + 1]) - X(b[i])}" height="${PH}"/>${rect}</g>`;
      }
    const line = (ps: [number, number][], cls: string) =>
      ps.length ? `<path class="ln ${cls}" d="M${ps.map(([px, py]) => `${X(px)} ${Y(py)}`).join('L')}"/>` + ps.map(([px, py]) => `<circle class="pt" cx="${X(px)}" cy="${Y(py)}" r="6"/>`).join('') : '';
    if (c.show?.includes('polygon')) g += line(x.map((m, i) => [m, freq[i]]), 'given');
    if (c.show?.includes('cumulative')) g += line([[b[0], 0], ...b.slice(1).map((e, i): [number, number] => [e, running(freq)[i]])], 'given');
    if (c.draw === 'polygon' || c.draw === 'cumulative') {
      const said = points.map(([px, py]) => fill(L('label-at', '({x}, {y})'), { x: host.num(px), y: host.num(py) })).join(' ');
      g += `<g class="kg-cbg-gp" data-gp="1" data-k="gp" tabindex="0" role="group" aria-label="${esc(L('label-points') + ' ' + said)}"><rect class="hit" x="${ML}" y="${MT - 8}" width="${Wd - ML - MR}" height="${PH + 16}"/>` +
        (cur ? `<path class="cur" d="M${X(cur[0])} ${MT}V${y0}M${ML} ${Y(cur[1])}H${Wd - MR}"/><circle class="cur" cx="${X(cur[0])}" cy="${Y(cur[1])}" r="9"/>` : '') +
        line(points, 'own') + '</g>';
    }
    g += `<path class="axis" d="M${ML} ${MT - 8}V${y0}H${Wd - 4}M${ML - 4} ${MT - 2}l4-7 4 7M${Wd - 10} ${y0 - 4}l7 4-7 4"/>`;
    return `<div class="kg-cb-chart" dir="ltr"><svg xmlns="${NS}" class="kg-cb-svg kg-cbg-svg" width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}" role="group" aria-label="${esc(L('label-chart'))}">${g}</svg></div>`;
  }

  function asks() {
    if (!c.ask?.length) return '';
    return `<div class="kg-cbs-asks">${c.ask.map((a) => `<label class="kg-cbs-q"><span>${esc(L(`stat-${a}`, a))}</span>${input(a, L(`stat-${a}`, a))}</label>`).join('')}</div>`;
  }

  // ---------- interaction ----------

  /** Put a point at (px, py): one point per x (a graph is a function); the same point again takes it away. */
  function toggle(px: number, py: number) {
    const j = points.findIndex((p) => p[0] === px);
    if (j < 0) points.push([px, py]);
    else if (points[j][1] === py) points.splice(j, 1);
    else points[j] = [px, py];
    points.sort((p, q) => p[0] - q[0]);
  }
  const at = (e: PointerEvent): [number, number] => {
    const r = drag!.r, Wd = W(), H = y0 + 34 + (c.axes?.[0] ? 18 : 0);
    return [r6(snapX(unX(((e.clientX - r.left) / r.width) * Wd))), r6(snapY(unY(((e.clientY - r.top) / r.height) * H)))];
  };

  return {
    html() {
      let h = '';
      if (data.length) h += c.sort ? tray() : `<p class="kg-cbg-data" dir="ltr" aria-label="${esc(L('label-cards'))}">${data.map((v) => `<span>${host.num(v)}</span>`).join('')}</p>`;
      if (k) h += table();
      if (c.choose) h += choose();
      if (graphs.size && b.length) h += graph();
      if (cur) h += `<p class="kg-cbg-at" role="status">${esc(fill(L('label-at', '({x}, {y})'), { x: host.num(cur[0]), y: host.num(cur[1]) }))}</p>`;
      return h + asks() + `<p class="kg-cbs-say" role="status">${esc(say)}</p>`;
    },

    act(t) {
      say = '';
      const a = t.dataset.a, id = Number(t.dataset.c);
      if (a === 'g-card') {
        sel = sel === id ? -1 : id;
        if (sel >= 0) say = L('label-pick-class');
        return true;
      }
      if (a === 'g-row') {
        if (sel < 0) say = L('label-pick-card');
        else (cards[sel] = +t.dataset.i!), (sel = -1);
        return true;
      }
      if (a === 'g-chip') {
        cards[id] = -1;
        return true;
      }
      if (a === 'g-kind') {
        chosen = t.dataset.g!;
        return true;
      }
      return false;
    },

    key(e) {
      const t = e.target as HTMLElement | SVGElement;
      const gb = t.dataset?.gb;
      if (gb !== undefined) {
        const i = +gb, v = bars[i];
        const m: Record<string, number> = { ArrowUp: v + snap, ArrowRight: v + snap, ArrowDown: v - snap, ArrowLeft: v - snap, PageUp: v + ystep, PageDown: v - ystep, Home: 0, End: yhi };
        if (!(e.key in m)) return false;
        bars[i] = snapY(m[e.key]);
        host.changed(true);
        return true;
      }
      if (t.dataset?.gp) {
        const [cx, cy] = cur ?? [xlo, 0];
        const m: Record<string, [number, number]> = {
          ArrowRight: [cx + w / 2, cy], ArrowLeft: [cx - w / 2, cy], ArrowUp: [cx, cy + snap], ArrowDown: [cx, cy - snap],
          PageUp: [cx, cy + ystep], PageDown: [cx, cy - ystep], Home: [xlo, cy], End: [xhi, cy],
        };
        if (e.key in m) cur = [r6(snapX(m[e.key][0])), r6(snapY(m[e.key][1]))];
        else if (e.key === 'Enter' || e.key === ' ') toggle(cx, cy), (cur = [cx, cy]);
        else if (e.key === 'Delete' || e.key === 'Backspace') points = points.filter((p) => p[0] !== cx);
        else return false;
        host.changed(true);
        return true;
      }
      return false;
    },

    down(e) {
      const t = (e.target as Element).closest<SVGElement>('[data-gb], [data-gp]');
      if (!t) return false;
      drag = { r: t.ownerSVGElement!.getBoundingClientRect() };
      const [px, py] = at(e);
      if (t.dataset.gb !== undefined) {
        drag.bar = +t.dataset.gb;
        bars[drag.bar] = py;
      } else {
        const j = points.findIndex((p) => p[0] === px);
        drag.tap = j >= 0 && points[j][1] === py; // tapping a point takes it away (unless it is dragged)
        if (!drag.tap) toggle(px, py);
        drag.pt = px;
        cur = null;
      }
      host.changed(true);
      return true;
    },

    move(e) {
      if (!drag) return;
      const [px, py] = at(e);
      if (drag.bar !== undefined) {
        if (bars[drag.bar] === py) return;
        bars[drag.bar] = py;
      } else {
        const j = points.findIndex((p) => p[0] === drag!.pt);
        if (j < 0 || (points[j][0] === px && points[j][1] === py) || (px !== drag.pt && points.some((p) => p[0] === px))) return;
        points[j] = [px, py];
        points.sort((p, q) => p[0] - q[0]);
        drag.pt = px;
        drag.tap = false;
      }
      host.changed(true);
    },

    up() {
      if (!drag) return;
      if (drag.tap) points = points.filter((p) => p[0] !== drag!.pt);
      drag = null;
      host.changed(true);
    },

    input(t) {
      const key = t.dataset.gt;
      if (!key) return false;
      raw[key] = t.value;
      const s = asciiDigits(t.value.trim()).replace(/[٫,/]/g, '.').replace(/[−–]/g, '-');
      typed[key] = /^-?\d+(\.\d+)?$|^-?\.\d+$/.test(s) ? +s : null;
      return true;
    },

    state(): { grouped: GroupedState } {
      return {
        grouped: {
          data: data.slice(), cards: cards.slice(), bounds: b.slice(), last, freq: freq.slice(), x: x.slice(),
          typed: { ...typed }, bars: bars.slice(), points: points.map((p) => [p[0], p[1]] as [number, number]), chosen,
        },
      };
    },
  };
}


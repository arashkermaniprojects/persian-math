// <kg-counters>: two-colour counters in ten-frames, rows, plates and arrays, a part-whole model, number tiles
// and a factor tree. For counting, number bonds, adding and taking away, equal groups, sharing and factors.
// Contract: docs/STUDIOS.md ("Engine contract", "Engine options → counters").
import { digitsOf, type NumberFormat } from '../lib/display';
import {
  addCounter, arrayShape, compact, countOf, factorPairs, initialCounters, isPrime, leaves, nodeAt, removeAt, splitColor,
  splitNode, treeDone, zoneState, type Color, type Counter, type CountersState, type Slot, type TreeNode, type ZoneState,
} from './lib/counters-model';

export interface ZoneConfig {
  /** frame: ten-frame(s), 5 per row (slots 20 = two ten-frames); row: one line of slots; group: a plate; array; tree. */
  kind?: 'frame' | 'row' | 'group' | 'array' | 'tree';
  /** Places in a frame (default 10) or row; the most counters a group holds (default 20). */
  slots?: number;
  /** Counters at the start: n red, or [red, yellow]. */
  fill?: number | [number, number];
  /** The first `lock` counters are fixed ("what you already have"). */
  lock?: number;
  /**
   * What tapping does. fill: tap an empty place to add a counter, a counter to remove it. cross: cross a counter
   * out (take away). ring: circle it (the extras when comparing). paint: turn it red ↔ yellow. move: pick it up,
   * then tap a zone's drop button. split (array): colour the columns after the tapped one yellow.
   */
  act?: 'fill' | 'cross' | 'ring' | 'paint' | 'move' | 'split' | 'none';
  /** Colour of counters added with fill (0 red, 1 yellow). */
  color?: Color;
  /** Tapping a counter moves it straight to zone `to` (joining groups). */
  to?: number;
  /** A drop button on this zone: puts the picked-up counter here, or else takes one from zone `from` (dealing). */
  drop?: boolean;
  from?: number;
  /** Caption key: the label is the studio's engine label `label-<name>`. */
  name?: string;
  /** Show the live number of counters next to the caption. */
  count?: boolean;
  /** Row: number the places 1, 2, 3 … (ordinals). */
  numbers?: boolean;
  /**
   * Array: rows × cols, with −/+ buttons inside min/max (default 1–10). `keep`: always this many counters in rows
   * of `cols`; only the row length changes and the last row is short when it is not a factor (factors, primes).
   */
  rows?: number;
  cols?: number;
  minRows?: number;
  maxRows?: number;
  minCols?: number;
  maxCols?: number;
  keep?: number;
  /** Array: show the −/+ buttons (default true) and a turn button. */
  resize?: boolean;
  turn?: boolean;
  /** Tree: the number at the top. */
  value?: number;
}

export interface CountersConfig {
  zones: ZoneConfig[];
  look?: 'dot' | 'apple';
  /** Icon hint above the engine, with the studio label `instruction-<name>`: tap, cross, ring, paint, move, pick, split, tree. */
  instruction?: string;
  /** Number sentence, always left to right, e.g. "3 + 4 = ?"; "?" shows the picked number. */
  sentence?: string;
  /** Part-whole model [whole, red part, yellow part]: a number, "?" (the picked number) or "*" (live from the counters). */
  bond?: (number | '?' | '*')[];
  /** Number tiles from min to max; the learner taps one as the answer. */
  pick?: [number, number];
}

interface Zone { cfg: ZoneConfig; items: Slot[]; rows: number; cols: number; split: number; tree?: TreeNode }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

export class Counters extends HTMLElement {
  private cfg: CountersConfig = { zones: [] };
  private zones: Zone[] = [];
  private picked: number | null = null;
  /** The counter picked up for moving: [zone, index]. */
  private held: [number, number] | null = null;
  /** Tree node whose factor pairs are showing. */
  private open: string | null = null;
  private built = false;

  set config(c: CountersConfig) {
    this.cfg = c;
    this.picked = null;
    this.held = null;
    this.open = null;
    this.zones = (c.zones ?? []).map((z) => {
      const kind = z.kind ?? 'frame';
      const slots = this.slotsOf(z);
      return {
        cfg: z, split: 0, rows: z.rows ?? 1, cols: z.cols ?? 1,
        items: kind === 'array' || kind === 'tree' ? [] : compact(initialCounters(z.fill, z.lock), slots),
        tree: kind === 'tree' ? { v: z.value ?? 12 } : undefined,
      };
    });
    if (this.built) this.render();
  }

  get state(): CountersState {
    return { zones: this.zones.map((z) => this.zoneState(z)), picked: this.picked };
  }

  private zoneState(z: Zone): ZoneState {
    if (z.tree) return { count: 0, marked: 0, colors: [0, 0], leaves: leaves(z.tree), done: treeDone(z.tree) };
    if (z.cfg.kind === 'array') {
      const a = arrayShape(z.rows, z.cols, z.cfg.keep);
      const red = Array.from({ length: a.n }, (_, i) => splitColor(i, a.cols, z.split)).filter((c) => c === 0).length;
      return { count: a.n, marked: 0, colors: [red, a.n - red], rows: a.rows, cols: a.cols };
    }
    return zoneState(z.items);
  }

  private get fmt(): NumberFormat {
    return { digits: this.dataset.digits ?? '0123456789', decimal: this.dataset.decimal ?? '.' };
  }

  private d = (n: number) => digitsOf(n, this.fmt);
  /** A studio label (data-* attribute), escaped, with an English fallback. */
  private lab = (k: string, en = '') => esc(this.dataset[camel(k)] ?? en);

  private slotsOf(z: ZoneConfig) {
    const k = z.kind ?? 'frame';
    return k === 'frame' ? z.slots ?? 10 : k === 'row' ? z.slots ?? 10 : undefined;
  }

  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-a]');
      if (b && this.contains(b)) this.act(b.dataset);
    });
    this.render();
  }

  private changed() {
    this.render();
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  private act(d: DOMStringMap) {
    const zi = Number(d.z), i = Number(d.i), z = this.zones[zi];
    const a = d.a!;
    if (a === 'pick') {
      this.picked = i;
      return this.changed();
    }
    if (!z) return;
    const c = z.cfg, slots = this.slotsOf(c), cap = slots ?? c.slots ?? 20;
    const it = z.items[i];
    if (a === 'add') {
      const next = addCounter(z.items, { c: c.color ?? 0 }, cap, slots);
      if (next) z.items = next;
    } else if (a === 'tap' && it) {
      const act = c.to !== undefined ? 'to' : c.act;
      if (act === 'fill') {
        const r = removeAt(z.items, i, slots);
        if (r) z.items = r[0];
      } else if (act === 'cross' || act === 'ring') it.x = !it.x;
      else if (act === 'paint') it.c = it.c ? 0 : 1;
      else if (act === 'to') this.move(zi, i, c.to!);
      else if (act === 'move') this.held = this.held?.[0] === zi && this.held[1] === i ? null : [zi, i];
    } else if (a === 'drop') {
      if (this.held) {
        this.move(this.held[0], this.held[1], zi);
        this.held = null;
      } else if (c.from !== undefined) {
        const src = this.zones[c.from];
        const last = src?.items.map((s, j) => (s && !s.l ? j : -1)).filter((j) => j >= 0).pop();
        if (last !== undefined) this.move(c.from, last, zi);
      }
    } else if (a === 'rows' || a === 'cols') {
      const lo = (a === 'rows' ? c.minRows : c.minCols) ?? 1, hi = (a === 'rows' ? c.maxRows : c.maxCols) ?? 10;
      const v = z[a] + Number(d.s);
      if (v < lo || v > hi) return;
      z[a] = v;
      z.split = 0;
    } else if (a === 'turn') {
      [z.rows, z.cols] = [z.cols, z.rows];
      z.split = 0;
    } else if (a === 'split') {
      const col = (i % arrayShape(z.rows, z.cols, c.keep).cols) + 1;
      z.split = z.split === col ? 0 : col;
    } else if (a === 'node' && z.tree) {
      const n = nodeAt(z.tree, d.p!);
      if (n?.k) delete n.k;
      else this.open = this.open === d.p ? null : d.p!;
    } else if (a === 'fac' && z.tree) {
      splitNode(z.tree, d.p!, i);
      this.open = null;
    } else return;
    this.changed();
  }

  /** Move counter i of zone `from` into zone `to`, if it may move and there is room. */
  private move(from: number, i: number, to: number) {
    const s = this.zones[from], t = this.zones[to];
    if (!s || !t || from === to) return;
    const tSlots = this.slotsOf(t.cfg);
    if (countOf(t.items) >= (tSlots ?? t.cfg.slots ?? 20)) return;
    const r = removeAt(s.items, i, this.slotsOf(s.cfg));
    if (!r) return;
    s.items = r[0];
    t.items = addCounter(t.items, { c: r[1].c }, Infinity, tSlots)!;
  }

  private counter(zi: number, i: number, k: Counter, tap: boolean, name: string) {
    const z = this.zones[zi].cfg;
    const act = z.act;
    const held = this.held?.[0] === zi && this.held[1] === i;
    const cls = `kg-ct-c c${k.c}${k.x ? (act === 'ring' ? ' ring' : ' x') : ''}${k.l ? ' lock' : ''}${held ? ' held' : ''}`;
    const label = `${name}${this.lab('label-counter', 'counter')} ${this.d(i + 1)}, ${k.c ? this.lab('label-yellow', 'yellow') : this.lab('label-red', 'red')}` +
      (k.x ? `, ${act === 'ring' ? this.lab('label-ringed', 'circled') : this.lab('label-crossed', 'crossed out')}` : '');
    if (!tap || k.l) return `<span class="${cls}" role="img" aria-label="${label}"></span>`;
    const pressed = act === 'cross' || act === 'ring' ? ` aria-pressed="${!!k.x}"` : act === 'move' ? ` aria-pressed="${held}"` : '';
    return `<button type="button" class="${cls}" data-a="tap" data-z="${zi}" data-i="${i}" data-k="t${zi}.${i}" aria-label="${label}"${pressed}></button>`;
  }

  private slot(zi: number, i: number, s: Slot, name: string, numbers?: boolean) {
    const z = this.zones[zi].cfg;
    const tap = !!z.act && z.act !== 'none' && z.act !== 'split' || z.to !== undefined;
    const num = numbers ? `<i>${this.d(i + 1)}</i>` : '';
    if (s) return `<span class="kg-ct-cell">${this.counter(zi, i, s, tap, name)}${num}</span>`;
    const inner = z.act === 'fill'
      ? `<button type="button" class="kg-ct-empty" data-a="add" data-z="${zi}" data-i="${i}" data-k="a${zi}.${i}" aria-label="${name}${this.lab('label-empty', 'empty place')} ${this.d(i + 1)}"></button>`
      : '<span class="kg-ct-empty"></span>';
    return `<span class="kg-ct-cell">${inner}${num}</span>`;
  }

  private btn(a: string, zi: number, text: string, label: string, extra = '') {
    return `<button type="button" class="kg-ct-btn" data-a="${a}" data-z="${zi}" ${extra} data-k="${a}${zi}${extra.replace(/\W/g, '')}" aria-label="${label}">${text}</button>`;
  }

  private zoneHTML(z: Zone, zi: number) {
    const c = z.cfg, kind = c.kind ?? 'frame';
    const cap = c.name ? this.lab(`label-${c.name}`) : '';
    const name = cap ? `${cap}, ` : '';
    let body = '';
    if (kind === 'frame') {
      for (let f = 0; f < z.items.length; f += 10)
        body += `<div class="kg-ct-frame">${z.items.slice(f, f + 10).map((s, j) => this.slot(zi, f + j, s, name)).join('')}</div>`;
    } else if (kind === 'row') {
      body = `<div class="kg-ct-row" style="--n:${z.items.length}">${z.items.map((s, j) => this.slot(zi, j, s, name, c.numbers)).join('')}</div>`;
    } else if (kind === 'group') {
      body = `<div class="kg-ct-plate">${z.items.map((s, j) => this.slot(zi, j, s, name)).join('')}</div>`;
    } else if (kind === 'array') {
      const a = arrayShape(z.rows, z.cols, c.keep);
      const tap = c.act === 'split';
      let cells = '';
      for (let i = 0; i < a.n; i++) {
        const k: Counter = { c: splitColor(i, a.cols, z.split) };
        cells += tap
          ? `<button type="button" class="kg-ct-c c${k.c}" data-a="split" data-z="${zi}" data-i="${i}" data-k="s${zi}.${i}" aria-label="${name}${this.lab('label-split', 'split after column')} ${this.d((i % a.cols) + 1)}"></button>`
          : this.counter(zi, i, k, false, name);
      }
      body = `<div class="kg-ct-array${a.full ? '' : ' short'}" style="--c:${a.cols}">${cells}</div>`;
      if (c.resize !== false) {
        const pm = (ax: 'rows' | 'cols', fewer: string, more: string) =>
          `<span class="kg-ct-pm">${this.btn(ax, zi, '−', this.lab(`label-${ax}-fewer`, fewer), 'data-s="-1"')}<output>${this.d(z[ax])}</output>${this.btn(ax, zi, '+', this.lab(`label-${ax}-more`, more), 'data-s="1"')}</span>`;
        body += `<div class="kg-ct-ctl">${c.keep ? '' : pm('rows', 'fewer rows', 'more rows') + '<span aria-hidden="true">×</span>'}${pm('cols', 'fewer columns', 'more columns')}` +
          `${c.turn ? this.btn('turn', zi, '⟳', this.lab('label-turn', 'turn')) : ''}</div>`;
      }
    } else if (z.tree) body = `<div class="kg-ct-tree" dir="ltr">${this.node(z.tree, '', zi)}</div>`;
    const n = c.count ? `<output class="kg-ct-n">${this.d(countOf(z.items))}</output>` : '';
    const head = cap || n ? `<div class="kg-ct-cap">${cap}${n}</div>` : '';
    const drop = c.drop || c.from !== undefined ? this.btn('drop', zi, '+', `${this.lab('label-drop', 'put one here')}${cap ? ', ' + cap : ''}`) : '';
    return `<div class="kg-ct-zone ${kind}" role="group"${cap ? ` aria-label="${cap}"` : ''}>${head}${body}${drop}</div>`;
  }

  private node(t: TreeNode, p: string, zi: number): string {
    const prime = isPrime(t.v);
    const v = prime || t.v < 4
      ? `<span class="kg-ct-v${prime ? ' prime' : ''}">${this.d(t.v)}</span>`
      : `<button type="button" class="kg-ct-v" data-a="node" data-z="${zi}" data-p="${p}" data-k="n${p}" aria-expanded="${this.open === p || !!t.k}">${this.d(t.v)}</button>`;
    const pairs = this.open === p && !t.k
      ? `<div class="kg-ct-pairs">${factorPairs(t.v).map(([a, b]) => `<button type="button" class="kg-ct-btn" data-a="fac" data-z="${zi}" data-p="${p}" data-i="${a}" data-k="f${p}.${a}">${this.d(a)} × ${this.d(b)}</button>`).join('')}</div>`
      : '';
    const kids = t.k ? `<div class="kg-ct-kids">${this.node(t.k[0], p + '0', zi)}${this.node(t.k[1], p + '1', zi)}</div>` : '';
    return `<div class="kg-ct-node">${v}${pairs}${kids}</div>`;
  }

  /** "?" shows the picked number (or an empty box); "*" is live: total, red or yellow unmarked counters. */
  private val(v: number | string, live: number) {
    if (v === '?') return `<span class="kg-ct-box${this.picked === null ? '' : ' on'}">${this.picked === null ? '?' : this.d(this.picked)}</span>`;
    return `<span>${this.d(v === '*' ? live : Number(v))}</span>`;
  }

  private render() {
    const cfg = this.cfg;
    const st = this.state.zones;
    const red = st.reduce((s, z) => s + z.colors[0], 0), yellow = st.reduce((s, z) => s + z.colors[1], 0);
    const ae = document.activeElement as HTMLElement | null;
    const focus = ae && this.contains(ae) ? ae.dataset.k : undefined;
    let h = '';
    if (cfg.instruction) {
      const t = this.lab(`instruction-${cfg.instruction}`);
      h += `<p class="kg-ct-hint"><span class="kg-ct-i i-${esc(cfg.instruction)}" aria-hidden="true"></span>${t}</p>`;
    }
    h += `<div class="kg-ct-zones">${this.zones.map((z, i) => this.zoneHTML(z, i)).join('')}</div>`;
    if (cfg.bond) {
      const [w, a, b] = cfg.bond;
      h += `<div class="kg-ct-bond" dir="ltr" role="group" aria-label="${this.lab('label-bond', 'part-whole model')}">` +
        `<div class="whole">${this.val(w, red + yellow)}</div><svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0L25 24M50 0L75 24"/></svg>` +
        `<div class="part c0">${this.val(a, red)}</div><div class="part c1">${this.val(b, yellow)}</div></div>`;
    }
    if (cfg.sentence) {
      h += `<p class="kg-ct-sent" dir="ltr">${cfg.sentence.split(/\s+/).map((t) => (t === '?' ? this.val(t, 0) : `<span>${esc(digitsOf(t, this.fmt))}</span>`)).join('')}</p>`;
    }
    if (cfg.pick) {
      let tiles = '';
      for (let n = cfg.pick[0]; n <= cfg.pick[1]; n++)
        tiles += `<button type="button" role="radio" class="kg-ct-tile" data-a="pick" data-i="${n}" data-k="p${n}" aria-checked="${this.picked === n}">${this.d(n)}</button>`;
      h += `<div class="kg-ct-pick" dir="ltr" role="radiogroup" aria-label="${this.lab('label-answer', 'answer')}">${tiles}</div>`;
    }
    this.toggleAttribute('apple', cfg.look === 'apple');
    this.innerHTML = h;
    if (focus) (this.querySelector<HTMLElement>(`[data-k="${focus}"]`) ?? this.querySelector<HTMLElement>('button'))?.focus();
  }
}

customElements.define('kg-counters', Counters);

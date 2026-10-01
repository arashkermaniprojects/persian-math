// <kg-measure>: measuring tools. One engine, one `tool` per mission:
//   ruler       an object (or several) above a ruler the learner slides into place (cm/mm, or inches)
//   units       non-standard units (paper clips, hand spans, cubes) laid end to end along an object
//   balance     a pan balance: items on the left pan, weights the learner puts on the right pan
//   scale       a dial scale (g/kg): read the needle, or turn it to a value
//   jug         a measuring jug (ml/l): read the level, or pour to a level
//   thermometer a vertical scale in °C (same gauge as the jug; negatives allowed)
//   protractor  arms from a vertex; rotate the protractor to read the angle, or turn an arm to draw one
//   convert     a unit strip (km | m | cm | mm) with the ×10/×100/×1000 factors between neighbours
// Contract: docs/STUDIOS.md ("Engine contract", "Engine options"). Drawings are LTR in every locale (scales grow
// left → right and bottom → top, as in both countries' books); only the text around them follows the page.
import {
  angleReading, between, clamp, dialAngle, dialValue, norm, numText, pointerAngle, rulerReading, snapRotation,
  snapTo, stripFactors, ticks, tidy, tilt,
} from './lib/measure-math';

export type Tool = 'ruler' | 'units' | 'balance' | 'scale' | 'jug' | 'thermometer' | 'protractor' | 'convert';
/** A thing to measure along: pencil | leaf | bar | line | ribbon, `length` in ruler units (or in units for `units`). */
export interface Obj { object?: string; length: number }
/** Something on a balance pan: apple | melon | bag | cube | box | book, `mass` is the total for `count` of them. */
export interface Item { item: string; mass: number; count?: number }

export interface MeasureConfig {
  tool: Tool;
  // ruler / units
  objects?: Obj[];
  object?: string;
  length?: number;
  /** Ruler length in units (ruler), or the most units that fit (units). */
  max?: number;
  /** Ruler subdivisions per unit: 1 (cm only), 10 (mm), 2/4/8 (inches). */
  minor?: number;
  /** Ruler reading at the object's start: 0 = lined up from zero; −2 = object starts 2 units before the 0 mark. */
  offset?: number;
  /** false: the ruler cannot be moved. */
  drag?: boolean;
  /** Unit: cm, mm, in (ruler); clip, span, cube (units); g, kg, lb (balance, scale); ml, l, pint (jug); C. */
  unit?: string;
  // balance
  left?: Item[];
  right?: Item[];
  /** Weights the learner can put on the right pan (each once), in `unit`. */
  weights?: number[];
  // scale / jug / thermometer
  min?: number;
  /** Labelled scale step. */
  major?: number;
  /** Marked scale step (unlabelled ticks between labels). */
  minorStep?: number;
  /** The reading shown (read mode), or where the learner starts (set mode). */
  value?: number;
  /** The learner sets the value (pours, turns the needle) instead of reading it. */
  set?: boolean;
  /** Step for setting (default: minorStep). */
  step?: number;
  // protractor
  /** Directions of the fixed arms, degrees counter-clockwise from the right. The angle is between the first two. */
  rays?: number[];
  /** A movable arm the learner turns, starting at this direction; the value is its angle from rays[0]. */
  ray?: number;
  /** The protractor can be turned (start direction `at`). */
  rotate?: boolean;
  at?: number;
  /** Angle marks to draw, as [from, to] directions. */
  arcs?: [number, number][];
  /** Draw the whole turn (needed for arms below the baseline). */
  full?: boolean;
  /** Hide the protractor (e.g. "draw an angle, then check with the protractor" is a later mission). */
  noProtractor?: boolean;
  // convert
  units?: string[];
  from?: string;
  to?: string;
  /** Icon hint with engine label `instruction-<key>` (default key: the tool), for children who don't read yet. */
  instruction?: string;
}

const NS = 'http://www.w3.org/2000/svg';
const PAD = 14;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pt = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)].map((n) => +n.toFixed(1));

export class Measure extends HTMLElement {
  private c: MeasureConfig = { tool: 'ruler' };
  /** The learner's value: units count, needle, level, movable-arm direction. */
  private v = 0;
  private off = 0;
  private rot = 0;
  private on: boolean[] = [];
  private W = 320;
  private H = 100;
  private ppu = 30;
  private svg = document.createElementNS(NS, 'svg');
  private ctl = document.createElement('div');
  private drag?: (x: number, y: number) => void;
  private ro?: ResizeObserver;

  set config(c: MeasureConfig) {
    this.c = c;
    this.off = c.offset ?? 0;
    this.rot = norm(c.at ?? 0);
    this.v = c.ray ?? c.value ?? (c.tool === 'units' ? 0 : c.min ?? 0);
    this.on = (c.weights ?? []).map(() => false);
    this.dataset.tool = c.tool;
    this.replaceChildren();
    const tip = this.dataset['instruction' + cap((c.instruction ?? c.tool).replace(/-(\w)/g, (_, x: string) => x.toUpperCase()))];
    if (tip) {
      const p = document.createElement('p');
      p.className = 'kg-ms-tip';
      p.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 4-2.5 6.5-6 6.5s-5-2-7-5l-1.6-2.6a1.4 1.4 0 0 1 2.3-1.6L9 14"/></svg>`;
      p.append(tip);
      this.append(p);
    }
    const wrap = document.createElement('div');
    wrap.className = 'kg-ms';
    wrap.dir = 'ltr';
    this.ctl.className = 'kg-ms-ctl';
    this.ctl.replaceChildren();
    if (c.tool === 'convert') this.strip(wrap);
    else wrap.append(this.svg);
    this.append(wrap, this.ctl);
    this.controls();
    this.render();
  }

  get state() {
    const c = this.c, t = c.tool;
    const s: Record<string, unknown> = { tool: t };
    if (t === 'ruler') Object.assign(s, { offset: this.off }, rulerReading(this.off, this.objs[0].length));
    else if (t === 'balance') Object.assign(s, { measured: this.weightsOn(), level: Math.sign(this.tiltNow()) });
    else if (t === 'protractor') {
      const a0 = c.rays?.[0] ?? 0;
      if (c.ray !== undefined) Object.assign(s, { measured: between(a0, this.v), aligned: true, misreads: [] });
      else {
        const r = angleReading(this.rot, [a0, c.rays?.[1] ?? a0]);
        Object.assign(s, { rotation: this.rot, aligned: r.aligned, misreads: r.misreads });
      }
    } else if (t === 'units' || c.set) s.measured = this.v;
    return s;
  }

  connectedCallback() {
    if (this.ro) return this.ro.observe(this);
    this.svg.addEventListener('pointerdown', (e) => this.down(e));
    this.svg.addEventListener('pointermove', (e) => this.drag && this.drag(...this.xy(e)));
    const up = () => (this.drag = undefined);
    this.svg.addEventListener('pointerup', up);
    this.svg.addEventListener('pointercancel', up);
    this.svg.addEventListener('keydown', (e) => this.key(e));
    this.ro = new ResizeObserver(() => {
      const w = Math.round(this.clientWidth);
      if (w > 0 && Math.abs(w - this.W) > 1) {
        this.W = w;
        this.render();
      }
    });
    this.ro.observe(this);
  }

  disconnectedCallback() {
    this.ro?.disconnect();
  }

  // ---------- helpers ----------
  private n(v: number) { return numText(v, this.dataset.digits, this.dataset.decimal); }
  private u(unit = this.c.unit ?? '') { return this.dataset['unit' + cap(unit)] ?? (unit === 'C' ? '°C' : unit.replace('2', '²')); }
  private lbl(k: string, f = '') { return this.dataset[k] ?? f; }
  private get objs(): Obj[] { return this.c.objects ?? [{ object: this.c.object, length: this.c.length ?? 5 }]; }
  private weightsOn() { return tidy((this.c.weights ?? []).reduce((s, w, i) => s + (this.on[i] ? w : 0), 0)); }
  private mass(items?: Item[]) { return (items ?? []).reduce((s, i) => s + i.mass, 0); }
  private tiltNow() { return tilt(this.mass(this.c.left), this.mass(this.c.right) + this.weightsOn()); }
  private get gauge() { const c = this.c; return { min: c.min ?? 0, max: c.max ?? 1000, step: c.step ?? c.minorStep ?? c.major ?? 1 }; }

  private changed() {
    this.render();
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  private button(text: string, label: string, f: () => void, cls = 'kg-ms-btn') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', f);
    this.ctl.append(b);
    return b;
  }

  /** −/+ buttons (units, pouring, turning the needle) and the balance's weight tray. */
  private controls() {
    const c = this.c;
    if (c.tool === 'balance') {
      (c.weights ?? []).forEach((w, i) => {
        const b = this.button(`${this.n(w)} ${this.u()}`, '', () => {
          this.on[i] = !this.on[i];
          b.setAttribute('aria-pressed', String(this.on[i]));
          this.changed();
        }, 'kg-ms-w');
        b.setAttribute('aria-pressed', 'false');
      });
    } else if (c.tool === 'units' || c.set) {
      const step = c.tool === 'units' ? 1 : this.gauge.step;
      this.button('−', this.lbl('labelDown'), () => this.setV(this.v - step));
      this.button('+', this.lbl('labelUp'), () => this.setV(this.v + step));
    }
  }

  private setV(v: number) {
    const c = this.c;
    if (c.tool === 'units') v = clamp(v, 0, this.unitsMax);
    else if (c.tool === 'protractor') v = norm(v);
    else v = snapTo(v, this.gauge.step, this.gauge.min, this.gauge.max, this.gauge.min);
    if (c.tool === 'protractor' && !c.full) v = clamp(v > 270 ? 0 : v, 0, 180);
    if (v === this.v) return;
    this.v = v;
    this.changed();
  }

  private get unitsMax() { return this.c.max ?? Math.ceil(this.objs[0].length) + 2; }

  private xy(e: PointerEvent): [number, number] {
    const r = this.svg.getBoundingClientRect();
    return [((e.clientX - r.left) * this.W) / (r.width || this.W), ((e.clientY - r.top) * this.H) / (r.height || this.H)];
  }

  // ---------- input ----------
  private down(e: PointerEvent) {
    const c = this.c, k = (e.target as Element).closest('[data-k]')?.getAttribute('data-k');
    const [x0, y0] = this.xy(e);
    let f: ((x: number, y: number) => void) | undefined;
    if (k === 'ruler' && c.drag !== false) {
      const o = this.off, step = 1 / (c.minor ?? 1);
      f = (x) => this.setOff(snapTo(o - (x - x0) / this.ppu, step, -Math.max(3, -(c.offset ?? 0)), (c.max ?? 10) - 1));
    } else if (k === 'ray') {
      f = (x, y) => this.setV(Math.round(pointerAngle(this.W / 2, this.cy, x, y) / (c.step ?? 5)) * (c.step ?? 5));
    } else if (k === 'prot' && c.rotate) {
      const a0 = pointerAngle(this.W / 2, this.cy, x0, y0), r0 = this.rot;
      f = (x, y) => this.setRot(snapRotation(r0 + pointerAngle(this.W / 2, this.cy, x, y) - a0, c.rays ?? []));
    } else if (c.set && (c.tool === 'jug' || c.tool === 'thermometer')) {
      f = (_, y) => this.setV(this.gMin + ((this.gY0 - y) / (this.gY0 - this.gY1)) * (this.gauge.max - this.gauge.min));
      f(x0, y0);
    } else if (c.set && c.tool === 'scale') {
      f = (x, y) => this.setV(dialValue((Math.atan2(x - this.W / 2, this.cy - y) * 180) / Math.PI, this.gauge.max));
      f(x0, y0);
    }
    if (!f) return;
    e.preventDefault();
    this.drag = f;
    this.svg.setPointerCapture?.(e.pointerId);
  }

  private get gMin() { return this.gauge.min; }
  private gY0 = 0; // gauge: y of min
  private gY1 = 0; // gauge: y of max
  private cy = 0; // protractor vertex / dial centre
  /** Accessible description when the whole drawing is a picture to read (not an input). */
  private img = '';

  private setOff(o: number) {
    if (o === this.off) return;
    this.off = o;
    this.changed();
  }

  private setRot(r: number) {
    if (r === this.rot) return;
    this.rot = r;
    this.changed();
  }

  private key(e: KeyboardEvent) {
    const k = (e.target as Element).getAttribute?.('data-k');
    const d = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 } as Record<string, number>)[e.key];
    if (!d || !k) return;
    e.preventDefault();
    const c = this.c, big = Math.abs(d) > 1, s = Math.sign(d);
    // The ruler moves the way the arrow points (its value, the reading at the object's start, goes the other way).
    if (k === 'ruler') {
      const dir = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? -s : s;
      this.setOff(clamp(tidy(this.off + dir * (big ? 1 : 1 / (c.minor ?? 1))), -Math.max(3, -(c.offset ?? 0)), (c.max ?? 10) - 1));
    } else if (k === 'prot') this.setRot(norm(this.rot + d));
    else if (k === 'ray') this.setV(this.v + s * (big ? 10 : c.step ?? 5));
    else this.setV(this.v + s * (big ? c.major ?? this.gauge.step * 5 : this.gauge.step));
  }

  // ---------- drawing ----------
  private render() {
    if (this.c.tool === 'convert') return;
    const hadFocus = this.svg.contains(document.activeElement) ? document.activeElement!.getAttribute('data-k') : null;
    const out: string[] = [];
    const t = this.c.tool;
    this.img = '';
    if (t === 'ruler' || t === 'units') this.drawLength(out);
    else if (t === 'balance') this.drawBalance(out);
    else if (t === 'scale') this.drawDial(out);
    else if (t === 'protractor') this.drawProtractor(out);
    else this.drawGauge(out);
    const svg = this.svg;
    svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    svg.setAttribute('width', String(this.W));
    svg.setAttribute('height', String(this.H));
    svg.setAttribute('class', 'kg-ms-svg');
    svg.setAttribute('role', this.img ? 'img' : 'group');
    if (this.img) svg.setAttribute('aria-label', this.img);
    else svg.removeAttribute('aria-label');
    svg.innerHTML = out.join('');
    if (hadFocus) svg.querySelector<SVGElement>(`[data-k="${hadFocus}"]`)?.focus();
  }

  private slider(k: string, label: string, now: number, text: string) {
    return ` data-k="${k}" tabindex="0" role="slider" aria-label="${label}" aria-valuenow="${now}" aria-valuetext="${text}"`;
  }

  private shape(kind: string | undefined, x: number, y: number, L: number) {
    // Every object starts exactly at x and ends exactly at x + L, so the ruler reading is exact.
    const m = y + 14;
    if (kind === 'pencil') {
      const tip = Math.min(L * 0.2, 18), e = Math.min(8, L / 6);
      return `<rect class="kg-ms-eraser" x="${x}" y="${m - 8}" width="${e}" height="16" rx="2"/>` +
        `<path class="kg-ms-obj" d="M${x + e} ${m - 8}H${x + L - tip}L${x + L} ${m}L${x + L - tip} ${m + 8}H${x + e}Z"/>` +
        `<path class="kg-ms-lead" d="M${x + L - tip / 3} ${m - 2.7}L${x + L} ${m}L${x + L - tip / 3} ${m + 2.7}Z"/>`;
    }
    if (kind === 'leaf')
      return `<path class="kg-ms-leaf" d="M${x} ${m}Q${x + L * 0.45} ${m - 22} ${x + L} ${m}Q${x + L * 0.45} ${m + 22} ${x} ${m}Z"/>` +
        `<path class="kg-ms-rib" d="M${x} ${m}H${x + L * 0.9}"/>`;
    if (kind === 'line') return `<path class="kg-ms-seg" d="M${x} ${m}H${x + L}"/><circle class="kg-ms-dot" cx="${x}" cy="${m}" r="3.5"/><circle class="kg-ms-dot" cx="${x + L}" cy="${m}" r="3.5"/>`;
    return `<rect class="kg-ms-obj ${kind ?? ''}" x="${x}" y="${m - 9}" width="${L}" height="18" rx="3"/>`;
  }

  private unitShape(kind: string, x: number, y: number, u: number, i: number) {
    const m = y + 14, cls = `kg-ms-unit${i % 2 ? ' odd' : ''}`;
    if (kind === 'span')
      return `<path class="${cls} kg-ms-span" d="M${x + 3} ${m + 8}Q${x + u / 2} ${m - 16} ${x + u - 3} ${m + 8}"/>` +
        `<circle class="${cls}" cx="${x + 3}" cy="${m + 8}" r="3"/><circle class="${cls}" cx="${x + u - 3}" cy="${m + 8}" r="3"/>`;
    if (kind === 'cube') return `<rect class="${cls}" x="${x + 0.5}" y="${m - u / 2 + 0.5}" width="${u - 1}" height="${u - 1}"/>`;
    // paper clip: a long loop with a smaller loop inside
    return `<rect class="${cls} kg-ms-clip" x="${x + 1}" y="${m - 6}" width="${u - 2}" height="12" rx="6"/>` +
      `<path class="${cls} kg-ms-clip" d="M${x + u * 0.3} ${m + 2}H${x + u - 7}a3 3 0 0 0 0-6H${x + 5}"/>`;
  }

  private drawLength(out: string[]) {
    const c = this.c, objs = this.objs, ruler = c.tool === 'ruler';
    const max = ruler ? c.max ?? Math.ceil(Math.max(...objs.map((o) => o.length))) + 1 : this.unitsMax;
    const slack = ruler ? Math.max(0, -(c.offset ?? 0)) : 0;
    const ppu = (this.ppu = (this.W - 2 * PAD) / (max + 0.8 + slack));
    const X0 = PAD + 0.4 * ppu;
    let y = 6;
    for (const o of objs) {
      out.push(this.shape(o.object, X0, y, o.length * ppu));
      y += 36;
    }
    const L0 = objs[0].length * ppu;
    if (!ruler) {
      for (let i = 0; i < this.v; i++) out.push(this.unitShape(c.unit ?? 'clip', X0 + i * ppu, y, ppu, i));
      out.push(`<text class="kg-ms-count" x="${X0}" y="${y + 52}" text-anchor="start">${this.n(this.v)}</text>`);
      this.H = y + 62;
      return;
    }
    // faint guides down from the object's ends help the eye find the readings
    out.push(`<path class="kg-ms-guide" d="M${X0} 4V${y + 22}M${X0 + L0} 4V${y + 22}"/>`);
    const minor = c.minor ?? 1, zero = X0 - this.off * ppu;
    const g = [`<rect class="kg-ms-ruler" x="${-0.4 * ppu}" y="0" width="${(max + 0.8) * ppu}" height="52" rx="4"/>`];
    for (const t of ticks(0, max, 1, 1 / minor)) {
      if (t.kind === 'minor' && ppu / minor < 2.5) continue;
      const x = (t.v * ppu).toFixed(1), h = t.kind === 'major' ? 16 : t.kind === 'mid' ? 11 : 7;
      g.push(`<path class="kg-ms-t ${t.kind}" d="M${x} 0V${h}"/>`);
      if (t.kind === 'major') g.push(`<text class="kg-ms-lab" x="${x}" y="33">${this.n(t.v)}</text>`);
    }
    g.push(`<text class="kg-ms-small" x="${(max - 0.5) * ppu}" y="48">${this.u()}</text>`);
    const { end } = rulerReading(this.off, objs[0].length);
    const label = this.lbl('labelRuler');
    const text = this.lbl('labelReading', '{s} – {e}').replace('{s}', this.n(this.off)).replace('{e}', this.n(end));
    out.push(`<g class="kg-ms-rg${c.drag === false ? '' : ' drag'}" transform="translate(${zero.toFixed(1)} ${y})"` +
      (c.drag === false ? ` role="img" aria-label="${label}: ${text}">` : `${this.slider('ruler', label, this.off, text)}>`) + g.join('') + '</g>');
    this.H = y + 56;
  }

  private item(it: string, x: number, yb: number, s: number, text = '') {
    if (it === 'apple') return `<circle class="kg-ms-apple" cx="${x}" cy="${yb - s / 2}" r="${s / 2}"/><path class="kg-ms-stem" d="M${x} ${yb - s}v-4"/>`;
    if (it === 'melon') return `<ellipse class="kg-ms-melon" cx="${x}" cy="${yb - s * 0.55}" rx="${s * 0.85}" ry="${s * 0.55}"/>`;
    if (it === 'weight')
      return `<path class="kg-ms-wt" d="M${x - s / 2} ${yb}l3 ${-s}h${s - 6}l3 ${s}Z"/><text class="kg-ms-wl" x="${x}" y="${yb - s / 2 + 3.5}">${text}</text>`;
    return `<rect class="kg-ms-${it}" x="${x - s / 2}" y="${yb - s}" width="${s}" height="${s}" rx="${it === 'bag' ? 5 : 1}"/>`;
  }

  private pan(out: string[], ex: number, ey: number, pw: number, things: [string, string][]) {
    const dy = 58, yb = ey + dy;
    out.push(`<path class="kg-ms-str" d="M${ex} ${ey}L${ex - pw} ${yb}M${ex} ${ey}L${ex + pw} ${yb}"/>`);
    // items sit on the dish, in rows from the bottom
    const s = 22, per = Math.max(1, Math.floor((2 * pw - 6) / (s + 4)));
    things.forEach(([it, text], i) => {
      const row = Math.floor(i / per), inRow = Math.min(per, things.length - row * per), col = i % per;
      const w = text.length > 3 ? s + 10 : s;
      out.push(this.item(it, ex + (col - (inRow - 1) / 2) * (s + 4), yb - row * (s + 2), it === 'weight' ? w : s, text));
    });
    out.push(`<path class="kg-ms-dish" d="M${ex - pw - 4} ${yb}Q${ex} ${yb + 22} ${ex + pw + 4} ${yb}Z"/>`);
  }

  private drawBalance(out: string[]) {
    const c = this.c, W = this.W, cx = W / 2, py = 74;
    const L = Math.min(W / 2 - PAD - 52, 130), pw = Math.min(56, L * 0.55);
    const th = this.tiltNow(), r = (th * Math.PI) / 180;
    const dx = L * Math.cos(r), dy = L * Math.sin(r);
    out.push(`<path class="kg-ms-stand" d="M${cx} ${py}V${py + 120}M${cx - 40} ${py + 122}H${cx + 40}"/>`,
      `<path class="kg-ms-beam" d="M${cx - dx} ${py - dy}L${cx + dx} ${py + dy}"/><circle class="kg-ms-pivot" cx="${cx}" cy="${py}" r="6"/>`);
    const items = (list?: Item[]) => (list ?? []).flatMap((i) => Array<[string, string]>(i.count ?? 1).fill([i.item, '']));
    const ws = (c.weights ?? []).flatMap((w, i) => (this.on[i] ? [['weight', this.n(w)] as [string, string]] : []));
    this.pan(out, cx - dx, py - dy, pw, items(c.left));
    this.pan(out, cx + dx, py + dy, pw, [...items(c.right), ...ws]);
    const state = th === 0 ? this.lbl('labelLevel') : this.lbl(th > 0 ? 'labelRightDown' : 'labelLeftDown');
    this.img = `${this.lbl('labelBalance')}: ${state}`;
    this.H = py + 130;
  }

  private drawDial(out: string[]) {
    const c = this.c, W = this.W, cx = W / 2, R = Math.min((W - 2 * PAD) / 2 - 12, 110), max = this.gauge.max;
    const cy = (this.cy = 64 + R);
    const p = (r: number, v: number) => { const a = (dialAngle(v, max) * Math.PI) / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)].map((n) => n.toFixed(1)); };
    out.push(`<rect class="kg-ms-plat" x="${cx - R * 0.8}" y="40" width="${R * 1.6}" height="8" rx="3"/><path class="kg-ms-stem2" d="M${cx} 48V${cy - R - 8}"/>`,
      this.item(c.object ?? 'bag', cx, 40, 34),
      `<rect class="kg-ms-body" x="${cx - R - 10}" y="${cy - R - 10}" width="${2 * R + 20}" height="${2 * R + 30}" rx="18"/>`,
      `<circle class="kg-ms-face" cx="${cx}" cy="${cy}" r="${R}"/>`);
    for (const t of ticks(0, max, c.major ?? max / 10, c.minorStep ?? c.major ?? max / 10)) {
      const [x1, y1] = p(R - 2, t.v), [x2, y2] = p(R - (t.kind === 'major' ? 14 : t.kind === 'mid' ? 10 : 7), t.v);
      out.push(`<path class="kg-ms-t ${t.kind}" d="M${x1} ${y1}L${x2} ${y2}"/>`);
      if (t.kind === 'major') { const [lx, ly] = p(R - 33, t.v); out.push(`<text class="kg-ms-lab" x="${lx}" y="${+ly + 5}">${this.n(t.v)}</text>`); }
    }
    const [nx, ny] = p(R - 12, this.v);
    out.push(`<text class="kg-ms-small" x="${cx}" y="${cy + R * 0.45}">${this.u()}</text>`,
      `<g class="kg-ms-needle"${c.set ? this.slider('needle', this.lbl('labelScale'), this.v, `${this.n(this.v)} ${this.u()}`) : ''}>` +
      `<path d="M${cx} ${cy}L${nx} ${ny}"/><circle cx="${cx}" cy="${cy}" r="7"/></g>`);
    if (!c.set) this.img = `${this.lbl('labelScale')}: ${this.n(this.v)} ${this.u()}`;
    this.H = cy + R + 26;
  }

  private drawGauge(out: string[]) {
    const c = this.c, W = this.W, cx = W / 2, therm = c.tool === 'thermometer';
    const { min, max } = this.gauge, H = (this.H = 280);
    const top = 22, y0 = (this.gY0 = therm ? H - 52 : H - 24), y1 = (this.gY1 = top + 22);
    const y = (v: number) => y0 - ((v - min) / (max - min)) * (y0 - y1);
    const hw = therm ? 9 : Math.min(62, (W - 2 * PAD - 110) / 2), L = cx - hw, Rr = cx + hw;
    if (therm) out.push(`<rect class="kg-ms-tube" x="${L}" y="${top}" width="${2 * hw}" height="${y0 - top + 10}" rx="${hw}"/><circle class="kg-ms-bulb" cx="${cx}" cy="${y0 + 22}" r="18"/>`,
      `<rect class="kg-ms-liquid" x="${cx - 4}" y="${y(this.v)}" width="8" height="${y0 + 10 - y(this.v)}"/>`);
    else out.push(`<path class="kg-ms-handle" d="M${Rr} ${top + 34}c34 0 34 90 0 90"/>`,
      `<rect class="kg-ms-water" x="${L}" y="${y(this.v)}" width="${2 * hw}" height="${y0 - y(this.v)}"/>`,
      `<path class="kg-ms-jug" d="M${L - 8} ${top - 6}L${L} ${top + 4}V${y0 - 6}q0 6 6 6H${Rr - 6}q6 0 6-6V${top}"/>`);
    for (const t of ticks(min, max, c.major ?? (max - min) / 5, c.minorStep ?? c.major ?? (max - min) / 5)) {
      const ty = y(t.v).toFixed(1), len = t.kind === 'major' ? 16 : t.kind === 'mid' ? 11 : 7;
      out.push(`<path class="kg-ms-t ${t.kind}" d="M${therm ? L - len : L} ${ty}h${len}"/>`);
      if (t.kind === 'major') out.push(`<text class="kg-ms-lab" text-anchor="end" x="${L - (therm ? 20 : 6)}" y="${+ty + 5}">${this.n(t.v)}</text>`);
    }
    out.push(`<text class="kg-ms-small" x="${Rr + (therm ? 22 : 10)}" y="${top + 4}" text-anchor="start">${this.u()}</text>`);
    const label = this.lbl(therm ? 'labelThermometer' : 'labelJug'), text = `${this.n(this.v)} ${this.u()}`;
    if (c.set) out.push(`<g class="kg-ms-level"${this.slider('level', label, this.v, text)}><path d="M${L - 4} ${y(this.v)}H${Rr + 4}"/><circle cx="${Rr - 16}" cy="${y(this.v)}" r="11"/></g>`);
    else this.img = `${label}: ${text}`;
  }

  private drawProtractor(out: string[]) {
    const c = this.c, W = this.W, cx = W / 2, R = Math.min((W - 2 * PAD) / 2 - 24, 150);
    const rays = c.rays ?? [0], full = !!c.full || !!c.rotate || rays.some((a) => norm(a) > 180);
    const cy = (this.cy = R + 30);
    const P = (r: number, a: number) => pt(cx, cy, r, a).join(' ');
    for (const [a, b] of c.arcs ?? [])
      out.push(`<path class="kg-ms-arc" d="M${cx} ${cy}L${P(30, a)}A30 30 0 ${norm(b - a) > 180 ? 1 : 0} 0 ${P(30, b)}Z"/>`);
    if (!c.noProtractor) {
      const g = [`<path class="kg-ms-prot" d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}Z"/>`,
        `<path class="kg-ms-t" d="M${cx - R} ${cy}H${cx + R}M${cx} ${cy}v-10"/><path class="kg-ms-inner" d="M${cx - R + 44} ${cy}A${R - 44} ${R - 44} 0 0 1 ${cx + R - 44} ${cy}"/>`];
      for (let a = 0; a <= 180; a += R >= 110 ? 1 : 5) {
        const len = a % 10 === 0 ? 12 : a % 5 === 0 ? 8 : 4;
        g.push(`<path class="kg-ms-t${a % 10 ? ' minor' : ''}" d="M${P(R, a)}L${P(R - len, a)}"/>`);
      }
      out.push(`<g class="kg-ms-pg${c.rotate ? ' drag' : ''}" transform="rotate(${-this.rot} ${cx} ${cy})"` +
        (c.rotate ? this.slider('prot', this.lbl('labelProtractor'), this.rot, `${this.n(this.rot)}°`) : '') + '>' + g.join('') + '</g>');
      // numbers stay upright, so they are drawn outside the turned group
      const tx = (cls: string, r: number, a: number, t: number) => { const [x, y] = pt(cx, cy, r, this.rot + a); return `<text class="kg-ms-${cls}" x="${x}" y="${y + 4}">${this.n(t)}</text>`; };
      for (let a = 0; a <= 180; a += R >= 110 ? 10 : 20) out.push(tx('o', R - 21, a, a), tx('i', R - 35, a, 180 - a));
    }
    for (const a of rays) out.push(`<path class="kg-ms-ray" d="M${cx} ${cy}L${P(R + 16, a)}"/>`);
    if (c.ray !== undefined) {
      const val = between(rays[0], this.v), [hx, hy] = pt(cx, cy, R + 12, this.v), hp = ` cx="${hx}" cy="${hy}"`;
      out.push(`<path class="kg-ms-ray mov" d="M${cx} ${cy}L${P(R + 16, this.v)}"/>`,
        `<g class="kg-ms-hd"${this.slider('ray', this.lbl('labelArm'), val, `${this.n(val)}°`)}><circle class="kg-ms-hit" r="22"${hp}/><circle r="11"${hp}/></g>`);
    }
    out.push(`<circle class="kg-ms-vx" cx="${cx}" cy="${cy}" r="4"/>`);
    this.H = full ? cy + R + 30 : cy + 22;
  }

  private strip(wrap: HTMLElement) {
    const c = this.c, us = c.units ?? ['km', 'm', 'cm', 'mm'], f = stripFactors(us);
    const a = us.indexOf(c.from ?? ''), b = us.indexOf(c.to ?? '');
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const row = document.createElement('div');
    row.className = 'kg-ms-strip';
    us.forEach((u, i) => {
      if (i) {
        const s = document.createElement('span');
        s.className = 'kg-ms-f' + (lo >= 0 && i > lo && i <= hi ? ' on' : '');
        s.textContent = `×${this.n(f[i - 1])}`;
        row.append(s);
      }
      const s = document.createElement('span');
      s.className = 'kg-ms-u' + (i === a ? ' from' : i === b ? ' to' : '');
      s.textContent = this.u(u);
      row.append(s);
    });
    wrap.removeAttribute('dir'); // the strip reads in the page's direction, biggest unit first
    wrap.append(row);
  }
}

customElements.define('kg-measure', Measure);

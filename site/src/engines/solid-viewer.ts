// <kg-solid-viewer>: a solid drawn in plain SVG with its own small orthographic projection (no 3D library), which
// the learner turns by dragging, with the arrow keys or with the turn buttons. Modes:
//   turn    look round it; with `pick`, tap faces (or use the face list) to choose the base, a face…
//   unfold  open the net of a prism or cylinder (button or slider); each face can show its area
//   fill    stack layers of the base (−/+) to see volume = base area × height
// Any mode can ask for a typed number with a unit (`ask`). The text under the picture says which faces can be
// seen from where (the screen-reader alternative to the picture). Geometry: engines/lib/solid-viewer-geom.ts,
// projection: engines/lib/iso-projection.ts (shared with shape-board's cube views), check: solid-viewer-check.ts.
// The picture is LTR in every locale. Contract: docs/STUDIOS.md.
import { orbit, type V3 } from './lib/iso-projection';
import { anchorNormal, dimsOf, edgesOf, hardEdge, layer, layerCount, measuresOf, meshOf, unfold, type Mesh, type Poly, type SolidSpec } from './lib/solid-viewer-geom';
import { misreadsFor, type Quantity, type SolidState } from './lib/solid-viewer-check';

export interface SolidViewerConfig {
  solid: SolidSpec;
  mode?: 'turn' | 'unfold' | 'fill';
  /** Start view [turn, tilt] in degrees (default [−30, 25]). */
  view?: [number, number];
  /** No turning (a fixed picture). */
  fixed?: boolean;
  /** turn: the learner picks faces. */
  pick?: boolean;
  /** dims (edge lengths, radius, height), areas (on the open net), hidden (dashed hidden edges at the start), base (colour the bases). */
  show?: string[];
  /** fill: layer thickness (default 1) and layers at the start. */
  step?: number;
  layers?: number;
  /** unfold: the side face that stays still (default 0). */
  anchor?: number;
  /** π for round solids (e.g. 3.14 as in the books; default Math.PI). */
  pi?: number;
  /** A typed answer: the quantity (volume, area, lateral, length) and the unit choices (unit-<u> labels). */
  ask?: { q: Quantity; units?: string[] };
  /** Icon hint + engine label instruction-<key>: turn, pick, unfold, fill. */
  instruction?: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const R = 130, STEP = 15;
type Parts = Record<'hint' | 'svg' | 'desc' | 'tools' | 'faces' | 'ctl' | 'ans', HTMLElement>;

export class SolidViewer extends HTMLElement {
  cfg: SolidViewerConfig = { solid: { kind: 'cube' } };
  private mesh!: Mesh;
  private k = 1; // svg units per solid unit
  private yaw = -30;
  private pitch = 25;
  private turns = 0;
  private hidden = false;
  private picked = new Set<number>();
  private t = 0;
  private goal = 0;
  private nLayers = 0;
  private value: number | null = null;
  private unit: string | null = null;
  private start: [number, number] = [-30, 25];
  private p?: Parts;
  private drag: { x: number; y: number; moved: boolean; f?: number } | null = null;
  private raf = 0;

  set config(c: SolidViewerConfig) {
    cancelAnimationFrame(this.raf);
    this.cfg = c;
    this.mesh = meshOf(c.solid);
    [this.yaw, this.pitch] = this.start = c.view ?? [-30, 25];
    this.turns = 0;
    this.hidden = !!c.show?.includes('hidden');
    this.picked = new Set();
    this.t = this.goal = 0;
    this.nLayers = c.layers ?? 0;
    this.value = this.unit = null;
    let far = Math.max(...this.mesh.polys.flatMap((f) => f.pts.map(len)));
    if (c.mode === 'unfold') far = Math.max(far, ...(unfold(c.solid, 1, c.anchor) ?? []).flatMap((f) => f.pts.map(len)));
    this.k = R / far;
    this.build();
    this.draw();
  }

  get state(): { solid: SolidState } {
    const c = this.cfg, g = this.mesh.groups, picked = [...this.picked].sort((a, b) => a - b);
    return {
      solid: {
        kind: c.solid.kind, turned: [this.yaw, this.pitch], turns: this.turns, picked, roles: picked.map((i) => g[i].role),
        bases: g.filter((x) => x.role === 'base').length, unfolded: this.t, layers: this.nLayers, full: layerCount(c.solid, c.step),
        answer: { value: this.value, unit: this.unit },
        misreads: c.ask ? misreadsFor(c.solid, c.ask.q, this.pi, [this.seenArea(this.yaw, this.pitch), this.seenArea(...this.start)]) : [],
        views: null, section: null,
      },
    };
  }

  // ---------- text helpers ----------
  /** Locale digits, decimal mark and minus; at most 2 decimals. */
  d(n: number) {
    const dg = this.dataset.digits ?? '0123456789';
    return String(+n.toFixed(2)).replace(/-/g, '−').replace(/[0-9]/g, (x) => dg[+x]).replace('.', this.dataset.decimal ?? '.');
  }
  lab(k: string, fb = '', vars: Record<string, string> = {}) {
    return (this.dataset[k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] ?? fb).replace(/\{(\w+)\}/g, (_, v: string) => vars[v] ?? '');
  }
  private get pi() { return this.cfg.pi ?? Math.PI; }
  private get mode() { return this.cfg.mode ?? 'turn'; }

  /** Area of face group g as the learner should compute it (π from the config for round faces). */
  private area(g: number) {
    const x = this.mesh.groups[g], s = this.cfg.solid;
    if (s.kind !== 'cylinder' && s.kind !== 'cone') return x.area;
    const m = measuresOf(s, this.pi);
    return x.role === 'base' ? m.base : m.lateral;
  }
  private seenGroups(yaw: number, pitch: number) {
    const o = orbit(yaw, pitch), seen = new Set<number>();
    for (const f of this.mesh.polys) if (o.facing(f.n) > 1e-6) seen.add(f.g);
    return [...seen];
  }
  private seenArea(yaw: number, pitch: number) { return this.seenGroups(yaw, pitch).reduce((t, g) => t + this.area(g), 0); }

  private faceName(g: number) {
    const x = this.mesh.groups[g];
    return `${this.lab(`shape-${x.shape}`, x.shape)} ${this.d(g + 1)}`;
  }

  // ---------- DOM ----------
  private build() {
    const mk = (tag: string, cls: string) => Object.assign(document.createElement(tag), { className: `kg-sv-${cls}` });
    if (!this.p) {
      this.p = { hint: mk('p', 'hint'), svg: mk('div', 'stage'), desc: mk('p', 'desc'), tools: mk('div', 'tools'), faces: mk('div', 'faces'), ctl: mk('div', 'ctl'), ans: mk('div', 'ans') };
      this.p.desc.id = `kg-sv-${Math.random().toString(36).slice(2, 8)}`;
      this.p.desc.setAttribute('aria-live', 'polite');
      this.p.svg.dir = this.p.tools.dir = 'ltr';
      this.replaceChildren(...Object.values(this.p));
      this.wire();
    }
    const c = this.cfg, p = this.p, set = (el: HTMLElement, html: string) => { el.innerHTML = html; el.hidden = !html; };
    const btn = (a: string, text: string, label = '', extra = '') => `<button type="button" class="secondary kg-sv-btn" data-a="${a}"${label ? ` aria-label="${esc(label)}"` : ''}${extra}>${text}</button>`;
    set(p.hint, c.instruction ? `<span class="kg-sv-i i-${esc(c.instruction)}" aria-hidden="true"></span>${esc(this.lab(`instruction-${c.instruction}`))}` : '');
    p.svg.innerHTML = `<svg class="kg-sv-svg${c.fixed ? '' : ' turnable'}" viewBox="-150 -150 300 300" tabindex="0" role="img" aria-describedby="${p.desc.id}"></svg>`;
    let tools = '';
    if (!c.fixed)
      tools += [['left', '←', 'Turn left'], ['right', '→', 'Turn right'], ['up', '↑', 'Tilt up'], ['down', '↓', 'Tilt down']].map(([a, t, l]) => btn(a, t, this.lab(`label-turn-${a}`, l))).join('');
    tools += btn('hidden', esc(this.lab('label-hidden', 'Hidden edges')), '', ` aria-pressed="${this.hidden}"`);
    set(p.tools, tools);
    const g = this.mesh.groups;
    set(p.faces, c.pick && g.length <= 12 ? g.map((_, i) => btn('face', esc(this.faceName(i)), '', ` data-f="${i}" aria-pressed="false"`)).join('') : '');
    p.faces.setAttribute('role', 'group');
    p.faces.setAttribute('aria-label', this.lab('label-faces', 'Faces'));
    let ctl = '';
    if (this.mode === 'fill')
      ctl = btn('less', '−', this.lab('label-fewer', 'One layer fewer')) + `<span class="kg-sv-count" aria-live="polite"></span>` + btn('more', '+', this.lab('label-more', 'One layer more'));
    if (this.mode === 'unfold')
      ctl = btn('open', '') + `<input type="range" class="kg-sv-range" min="0" max="100" value="0" data-a="slide" aria-label="${esc(this.lab('label-amount', 'How far open'))}">`;
    set(p.ctl, ctl);
    let ans = '';
    if (c.ask) {
      ans = `<label class="kg-sv-q"><span>${esc(this.lab(`label-ask-${c.ask.q}`, this.lab('label-answer', 'Answer')))}</span><input class="kg-sv-num" inputmode="decimal" autocomplete="off" data-a="num"></label>`;
      if (c.ask.units?.length)
        ans += `<div class="kg-sv-units" role="radiogroup" aria-label="${esc(this.lab('label-unit', 'Unit'))}">${c.ask.units.map((u) => `<button type="button" role="radio" class="kg-sv-unit" data-a="unit" data-u="${esc(u)}" aria-checked="false">${esc(this.lab(`unit-${u}`, u))}</button>`).join('')}</div>`;
    }
    set(p.ans, ans);
  }

  private wire() {
    const p = this.p!;
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button[data-a]');
      if (!b || !this.contains(b)) return;
      const a = b.dataset.a!;
      if (a === 'left' || a === 'right' || a === 'up' || a === 'down') return this.turn(a === 'left' ? -STEP : a === 'right' ? STEP : 0, a === 'up' ? -STEP : a === 'down' ? STEP : 0);
      if (a === 'hidden') this.hidden = !this.hidden;
      else if (a === 'face') return this.toggle(Number(b.dataset.f));
      else if (a === 'less' || a === 'more') this.nLayers = Math.max(0, Math.min(layerCount(this.cfg.solid, this.cfg.step), this.nLayers + (a === 'more' ? 1 : -1)));
      else if (a === 'open') return this.animate(this.goal > 0.5 ? 0 : 1);
      else if (a === 'unit') this.unit = b.dataset.u!;
      this.changed();
    });
    this.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.a === 'slide') { cancelAnimationFrame(this.raf); this.t = this.goal = Number(el.value) / 100; this.changed(); }
      if (el.dataset.a === 'num') { this.value = parseNum(el.value); this.changed(false); }
    });
    p.svg.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[e.key];
      if (!k || this.cfg.fixed) return;
      e.preventDefault();
      this.turn(k[0], k[1]);
    });
    p.svg.addEventListener('pointerdown', (e) => {
      const f = (e.target as Element).closest('[data-f]') as SVGElement | null;
      this.drag = { x: e.clientX, y: e.clientY, moved: false, f: f ? Number(f.dataset.f) : undefined };
      if (!this.cfg.fixed) p.svg.setPointerCapture?.(e.pointerId);
    });
    p.svg.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || this.cfg.fixed) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 8) return;
      d.moved = true;
      this.yaw += dx * 0.6;
      this.pitch = clamp(this.pitch + dy * 0.5);
      d.x = e.clientX;
      d.y = e.clientY;
      this.draw();
    });
    const end = () => {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      if (d.moved) { this.turns++; this.changed(); }
      else if (d.f !== undefined && this.cfg.pick) this.toggle(d.f);
    };
    p.svg.addEventListener('pointerup', end);
    p.svg.addEventListener('pointercancel', end);
  }

  private turn(dy: number, dp: number) {
    this.yaw += dy;
    this.pitch = clamp(this.pitch + dp);
    this.turns++;
    this.changed();
  }
  private toggle(g: number) {
    if (!this.picked.delete(g)) this.picked.add(g);
    this.changed();
  }
  private animate(to: number) {
    this.goal = to;
    cancelAnimationFrame(this.raf);
    const from = this.t, t0 = performance.now(), ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
    const tick = (now: number) => {
      const u = ms ? Math.min(1, (now - t0) / ms) : 1;
      this.t = from + (to - from) * (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
      if (u < 1) { this.draw(); this.raf = requestAnimationFrame(tick); }
      else { this.t = to; this.changed(); }
    };
    this.raf = requestAnimationFrame(tick);
  }
  changed(redraw = true) {
    if (redraw) this.draw();
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  // ---------- drawing ----------
  /** The view: the learner's, blended towards looking straight at the net as it opens. */
  private camera(): [number, number] {
    if (this.mode !== 'unfold' || !this.t) return [this.yaw, this.pitch];
    const n = anchorNormal(this.cfg.solid, this.cfg.anchor), deg = 180 / Math.PI;
    const yawT = -90 - Math.atan2(n[1], n[0]) * deg, pitchT = Math.atan2(n[2], Math.hypot(n[0], n[1])) * deg;
    const dy = ((((yawT - this.yaw) % 360) + 540) % 360) - 180;
    return [this.yaw + dy * this.t, this.pitch + (pitchT - this.pitch) * this.t];
  }

  draw() {
    const p = this.p!, c = this.cfg, k = this.k, mode = this.mode, show = c.show ?? [];
    const [yaw, pitch] = this.camera(), o = orbit(yaw, pitch);
    const P = (q: V3) => { const [x, y] = o(q); return [x * k, y * k]; };
    const pts = (f: Poly) => f.pts.map((q) => P(q).map((v) => v.toFixed(1)).join(',')).join(' ');
    const depth = (f: Poly) => f.pts.reduce((t, q) => t + o(q)[2], 0) / f.pts.length;
    const g = this.mesh.groups, out: string[] = [];
    const css = getComputedStyle(this), bg = rgb(css.getPropertyValue('--cell'));
    const poly = (f: Poly, cls: string, tap = false) => {
      const a = 0.35 + 0.55 * Math.abs(o.facing(f.n));
      let style = `fill-opacity:${a.toFixed(2)}`;
      // strips of a curved surface: an opaque colour (see-through strips would show seams), outlined in itself
      if (g[f.g]?.shape === 'curved' && !/glass/.test(cls)) {
        const c = rgb(css.getPropertyValue(/kg-sv-l/.test(cls) ? '--sv-fill' : /sel/.test(cls) ? '--sv-pick' : '--sv-side'));
        const mix = `rgb(${c.map((v, i) => Math.round(bg[i] + (v - bg[i]) * (/back/.test(cls) ? 0.25 : a))).join()})`;
        style = `fill:${mix};stroke:${mix};stroke-width:1.5`;
      }
      out.push(`<polygon class="kg-sv-f ${cls}"${tap ? ` data-f="${f.g}"` : ''} points="${pts(f)}" style="${style}"/>`);
    };
    const line = (a: V3, b: V3, cls: string) => { const [x1, y1] = P(a), [x2, y2] = P(b); out.push(`<line class="${cls}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`); };
    const text = ([x, y]: number[], s: string, cls = 'kg-sv-dim') => out.push(`<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(s)}</text>`);
    const faceCls = (gi: number) => `r-${g[gi]?.role ?? 'face'}${show.includes('base') && g[gi]?.role === 'base' ? ' base' : ''}${this.picked.has(gi) ? ' sel' : ''}`;
    const seen = (f: Poly) => o.facing(f.n) > 1e-6;

    if (mode === 'unfold' && this.t > 0) {
      const net = unfold(c.solid, this.t, c.anchor) ?? this.mesh.polys, m: Mesh = { polys: net, groups: g, edges: edgesOf(net) };
      for (const f of [...net].sort((a, b) => depth(b) - depth(a))) poly(f, faceCls(f.g) + (seen(f) ? '' : ' back'));
      for (const e of m.edges) if (hardEdge(m, e)) line(e.a, e.b, 'kg-sv-e');
      // the open net: each face's area; a cylinder's side also says how long (2πr) and high it is
      if (this.t > 0.999)
        g.forEach((x, gi) => {
          const q = net.filter((f) => f.g === gi).flatMap((f) => f.pts), [mx, my] = P(q.reduce((a, v) => a.map((y, i) => y + v[i] / q.length) as V3, [0, 0, 0]));
          const lines = show.includes('areas') ? [this.d(this.area(gi))] : [];
          if (show.includes('dims') && x.shape === 'curved')
            lines.push(this.lab('label-around', '2πr = {n}', { n: this.d(2 * this.pi * (c.solid.r ?? 1)) }), this.lab('label-high', 'h = {n}', { n: this.d(c.solid.h ?? 1) }));
          lines.forEach((l, i) => text([mx, my + 6 + (i - (lines.length - 1) / 2) * 24], l, i || !show.includes('areas') ? 'kg-sv-dim' : 'kg-sv-area'));
        });
    } else {
      const vis = this.mesh.polys.filter(seen), m = this.mesh;
      if (mode === 'fill') {
        for (const f of m.polys) if (!seen(f)) poly(f, 'glass back');
        const ls: Poly[] = [];
        for (let i = 0; i < this.nLayers; i++) ls.push(...layer(c.solid, i, c.step).polys.filter(seen));
        for (const f of ls.sort((a, b) => depth(b) - depth(a))) poly(f, `kg-sv-l${f.g < 2 ? ' top' : ''}`);
        for (const f of vis) poly(f, `glass ${faceCls(f.g)}`);
      } else for (const f of vis.sort((a, b) => depth(b) - depth(a))) poly(f, faceCls(f.g), !!c.pick);
      const on = (i: number) => seen(m.polys[i]);
      for (const e of m.edges) {
        const n = e.f.filter(on).length, hard = hardEdge(m, e);
        if (hard ? n > 0 : n === 1) line(e.a, e.b, 'kg-sv-e');
        else if (hard && (this.hidden || mode === 'fill')) line(e.a, e.b, 'kg-sv-e dash');
      }
      if (show.includes('dims'))
        for (const dm of dimsOf(c.solid)) {
          const score = ([a, b]: V3[]) => { const p = o(a), q = o(b); return dm.pick === 'out' ? -Math.hypot(p[0] + q[0], p[1] + q[1]) : p[2] + q[2]; };
          const [a, b, away] = [...dm.segs].sort((x, y) => score(x) - score(y))[0];
          if (dm.line) line(a, b, 'kg-sv-e r');
          const [x1, y1] = P(a), [x2, y2] = P(b), [cx, cy] = P(away), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dl = Math.hypot(mx - cx, my - cy) || 1;
          text(dm.line ? [mx, my - 8] : [mx + ((mx - cx) / dl) * 16, my + ((my - cy) / dl) * 16 + 6], this.d(dm.value));
        }
    }
    const svg = p.svg.firstElementChild as SVGElement;
    svg.innerHTML = out.join('');
    svg.setAttribute('aria-label', this.lab(`label-${c.solid.kind}`, c.solid.kind) + (c.fixed ? '' : '. ' + this.lab('label-keys', 'Arrow keys turn it.')));
    // the text alternative: which faces can be seen, and from where
    const groups = this.seenGroups(yaw, pitch).map((gi) => {
      // where it faces: the mean normal of its strips in view (a curved surface faces the viewer's way)
      const n = this.mesh.polys.filter((x) => x.g === gi && seen(x)).reduce((s, x) => s.map((v, i) => v + x.n[i]) as V3, [0, 0, 0] as V3), [sx, sy, dz] = o(n);
      const pos = [['front', -dz], ['top', -sy], ['bottom', sy], ['right', sx], ['left', -sx]].sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
      return `${this.faceName(gi)} (${this.lab(`pos-${pos}`, pos as string)})`;
    });
    let desc = mode === 'unfold' && this.t > 0.999 ? this.lab('label-open', 'The net is open.') : this.lab('label-seen', 'You can see: {list}.', { list: groups.join(this.lab('list-sep', ', ')) });
    if (mode === 'fill') desc += ' ' + this.lab('label-layers', '{n} layers', { n: this.d(this.nLayers) });
    p.desc.textContent = desc;
    // controls
    p.tools.querySelector('[data-a="hidden"]')?.setAttribute('aria-pressed', String(this.hidden));
    p.faces.querySelectorAll<HTMLElement>('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(this.picked.has(Number(b.dataset.f)))));
    const count = p.ctl.querySelector('.kg-sv-count');
    if (count) count.textContent = this.lab('label-layers', '{n} layers', { n: this.d(this.nLayers) });
    const open = p.ctl.querySelector('[data-a="open"]'), range = p.ctl.querySelector<HTMLInputElement>('.kg-sv-range');
    if (open) open.textContent = this.goal > 0.5 ? this.lab('label-fold', 'Fold') : this.lab('label-unfold', 'Unfold');
    if (range && document.activeElement !== range) range.value = String(Math.round(this.t * 100));
    p.ans.querySelectorAll<HTMLElement>('[data-u]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.u === this.unit)));
  }
}

const len = (q: V3) => Math.hypot(...q);
/** "#rrggbb" or "rgb(r, g, b)" → [r, g, b] (white if unreadable). */
const rgb = (v: string): number[] => {
  v = v.trim();
  const h = /^#([0-9a-f]{6})$/i.exec(v);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16));
  const m = v.match(/\d+/g);
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [255, 255, 255];
};
const clamp = (v: number) => Math.max(-85, Math.min(85, v));
/** A typed number in any locale: Persian or Arabic digits; "/", ",", "٫" or "." as the decimal mark. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/[۰-۹]/g, (x) => String(x.charCodeAt(0) - 0x6f0)).replace(/[٠-٩]/g, (x) => String(x.charCodeAt(0) - 0x660)).replace(/[/,٫]/, '.').replace(/[−–]/, '-');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

customElements.define('kg-solid-viewer', SolidViewer);

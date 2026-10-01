// <kg-number-line>: a number line the learner places points on by tapping, dragging or with the arrow keys.
// Contract: docs/STUDIOS.md ("Engine contract"). The line always runs left → right, in every locale (docs/NOTATION.md).
import { digitsOf, formatDecimal, type NumberFormat } from '../lib/display';
import { clamp, decimalString, labelStep, snap, tickKind, tickX, toTick, windowOf, type FracSpec } from './lib/number-line-math';

export interface NumberLineConfig {
  min?: number;
  max?: number;
  /** Ticks per unit; points snap to these ticks. */
  denominator?: number;
  /** Which ticks get number labels. With zoom, 'whole' also labels the two ends of the window. */
  labels?: 'whole' | 'all' | 'none';
  /** Points the learner may move, at the start. */
  points?: FracSpec[];
  /** Points drawn for reference only: they never move and are not part of `state`. */
  fixedPoints?: FracSpec[];
  /** How many more points the learner may place. */
  addPoints?: number;
  /** Label ticks as decimals with the locale's mark (۰/۳ fa-IR, ۰,۳ fa-AF, 0.3 en). */
  decimal?: boolean;
  /** Show only this part of min..max, magnified, under a small overview of the whole line. */
  zoom?: { from: FracSpec; to: FracSpec };
}

const NS = 'http://www.w3.org/2000/svg';
const PAD = 26; // keeps end labels inside the drawing
const HIT = 22; // hit radius: 44px touch targets

export class NumberLine extends HTMLElement {
  private cfg: NumberLineConfig = {};
  private den = 1;
  private lo = 0;
  private hi = 1;
  /** Movable points, as tick indices (tick i = i / den). */
  private pts: number[] = [];
  private active = -1;
  private dragging = -1;
  private width = 320;
  private svg = document.createElementNS(NS, 'svg');
  private ro?: ResizeObserver;
  private built = false;

  set config(c: NumberLineConfig) {
    this.cfg = c;
    this.den = Math.max(1, c.denominator ?? 1);
    [this.lo, this.hi] = windowOf(c.min ?? 0, c.max ?? 1, this.den, c.zoom);
    this.pts = (c.points ?? []).map((p) => clamp(toTick(p, this.den), this.lo, this.hi));
    this.active = this.pts.length - 1;
    this.render();
  }

  get state() {
    return { points: this.pts.map((i): FracSpec => [i, this.den]) };
  }

  private get fmt(): NumberFormat {
    return { digits: this.dataset.digits ?? '0123456789', decimal: this.dataset.decimal ?? '.' };
  }

  private get maxPoints() {
    return (this.cfg.points?.length ?? 0) + (this.cfg.addPoints ?? 0);
  }

  private get interactive() {
    return this.maxPoints > 0;
  }

  connectedCallback() {
    if (this.built) return this.ro?.observe(this.firstElementChild!);
    this.built = true;
    const wrap = document.createElement('div');
    wrap.dir = 'ltr';
    wrap.className = 'kg-nl';
    wrap.append(this.svg);
    this.append(wrap);
    if (this.interactive && (this.cfg.addPoints ?? 0) > 0) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'secondary kg-nl-reset';
      reset.textContent = this.dataset.labelClear ?? 'Clear points';
      reset.addEventListener('click', () => {
        this.config = this.cfg;
        this.changed();
      });
      this.append(reset);
    }
    this.svg.addEventListener('pointerdown', (e) => this.down(e));
    this.svg.addEventListener('pointermove', (e) => this.dragging >= 0 && this.moveTo(this.dragging, this.xToTick(e)));
    const up = () => (this.dragging = -1);
    this.svg.addEventListener('pointerup', up);
    this.svg.addEventListener('pointercancel', up);
    this.svg.addEventListener('keydown', (e) => this.key(e));
    this.ro = new ResizeObserver(() => {
      const w = Math.round(wrap.clientWidth);
      if (w > 0 && Math.abs(w - this.width) > 1) {
        this.width = w;
        this.render();
      }
    });
    this.ro.observe(wrap);
  }

  disconnectedCallback() {
    this.ro?.disconnect();
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  private get x0() { return PAD; }
  private get x1() { return Math.max(PAD + 40, this.width - PAD); }
  private x(i: number) { return tickX(i, this.lo, this.hi, this.x0, this.x1); }

  private xToTick(e: PointerEvent) {
    const r = this.svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) * this.width) / (r.width || this.width);
    return snap(x, this.lo, this.hi, this.x0, this.x1);
  }

  private down(e: PointerEvent) {
    if (!this.interactive) return;
    const hit = (e.target as Element).closest('[data-p]');
    let p = hit ? Number(hit.getAttribute('data-p')) : -1;
    if (p < 0) {
      if (!(e.target as Element).closest('.kg-nl-track')) return;
      const i = this.xToTick(e);
      if (this.pts.length < this.maxPoints) {
        this.pts.push(i);
        p = this.pts.length - 1;
        this.active = p;
        this.render();
        this.changed();
      } else {
        // Line is full: tapping moves the point the learner touched last.
        p = this.active >= 0 ? this.active : this.pts.length - 1;
        this.moveTo(p, i);
      }
    }
    e.preventDefault();
    this.active = p;
    this.dragging = p;
    this.svg.setPointerCapture?.(e.pointerId);
  }

  private moveTo(p: number, i: number) {
    i = clamp(i, this.lo, this.hi);
    this.active = p;
    if (this.pts[p] === i) return;
    this.pts[p] = i;
    this.render();
    this.changed();
  }

  private key(e: KeyboardEvent) {
    const t = e.target as Element;
    if (t.classList.contains('kg-nl-track')) {
      if ((e.key === 'Enter' || e.key === ' ') && this.pts.length < this.maxPoints) {
        e.preventDefault();
        this.pts.push(this.lo);
        this.active = this.pts.length - 1;
        this.render();
        this.changed();
      }
      return;
    }
    const p = Number(t.getAttribute('data-p'));
    if (Number.isNaN(p) || !t.hasAttribute('data-p')) return;
    const i = this.pts[p];
    // Right/Up always mean "bigger": the line runs left → right even on RTL pages.
    const step: Record<string, number> = {
      ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1,
      PageUp: i + this.den, PageDown: i - this.den, Home: this.lo, End: this.hi,
    };
    if (e.key in step) {
      e.preventDefault();
      this.moveTo(p, step[e.key]);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && (this.cfg.addPoints ?? 0) > 0) {
      e.preventDefault();
      this.pts.splice(p, 1);
      this.active = this.pts.length - 1;
      this.render();
      this.changed();
    }
  }

  /** Plain-text value of tick i, for labels and aria-valuetext. */
  private text(i: number): string {
    const f = this.fmt;
    if (i % this.den === 0) return digitsOf(i / this.den, f);
    const dec = this.decimal(i);
    return dec ?? `${i}/${this.den}`;
  }

  /** Decimal label in the locale's mark, or null if not in decimal mode (or i/den has no finite decimal). */
  private decimal(i: number): string | null {
    const dec = this.cfg.decimal ? decimalString(i, this.den) : null;
    return dec && formatDecimal(dec, this.fmt).replace(/<[^>]+>/g, '');
  }

  private label(i: number, y: number): string {
    const x = this.x(i).toFixed(1);
    const f = this.fmt;
    if (i % this.den === 0 || this.decimal(i)) return `<text class="kg-nl-lab" x="${x}" y="${y + 16}">${this.text(i)}</text>`;
    // Stacked fraction: numerator, bar, denominator (never "a/b": "/" is the Iranian decimal mark).
    const w = 5 + 5 * Math.max(String(i).length, String(this.den).length);
    return `<g class="kg-nl-frac"><text class="kg-nl-lab" x="${x}" y="${y + 9}">${digitsOf(i, f)}</text>` +
      `<line x1="${+x - w}" x2="${+x + w}" y1="${y + 14}" y2="${y + 14}"/>` +
      `<text class="kg-nl-lab" x="${x}" y="${y + 31}">${digitsOf(this.den, f)}</text></g>`;
  }

  private render() {
    const { lo, hi, den, cfg } = this;
    const W = this.width;
    const zoom = !!cfg.zoom;
    const y = zoom ? 104 : 40; // the main line
    let H = y + 28; // grows to fit the labels drawn below the line
    const out: string[] = [];

    if (zoom) {
      // Overview of min..max with the zoomed window highlighted, and a funnel down to the main line.
      const [a, b] = windowOf(cfg.min ?? 0, cfg.max ?? 1, den);
      const ox = (i: number) => tickX(i, a, b, this.x0, this.x1);
      const oy = 30; // overview labels sit above it, clear of the funnel
      out.push(`<line class="kg-nl-axis kg-nl-over" x1="${this.x0}" x2="${this.x1}" y1="${oy}" y2="${oy}"/>`);
      for (let u = a; u <= b; u += den)
        out.push(`<line class="kg-nl-tick" x1="${ox(u)}" x2="${ox(u)}" y1="${oy - 6}" y2="${oy + 6}"/>` +
          `<text class="kg-nl-lab kg-nl-small" x="${ox(u)}" y="${oy - 11}">${digitsOf(u / den, this.fmt)}</text>`);
      const w0 = ox(lo), w1 = Math.max(ox(hi), w0 + 3);
      out.push(`<rect class="kg-nl-win" x="${w0 - 1.5}" y="${oy - 8}" width="${w1 - w0 + 3}" height="16" rx="3"/>`,
        `<path class="kg-nl-funnel" d="M${w0} ${oy + 9}L${this.x0} ${y - 22}M${w1} ${oy + 9}L${this.x1} ${y - 22}"/>`);
    }

    // Track: the whole band is a tap target (≥44px tall).
    const aria = this.dataset.labelLine ?? 'Number line';
    out.push(`<rect class="kg-nl-track" x="${this.x0 - HIT / 2}" y="${y - 26}" width="${this.x1 - this.x0 + HIT}" height="52"` +
      (this.interactive && this.pts.length < this.maxPoints ? ` tabindex="0" role="button" aria-label="${aria}"` : '') + '/>');
    out.push(`<line class="kg-nl-axis" x1="${this.x0}" x2="${this.x1}" y1="${y}" y2="${y}"/>`);

    // Labels: 'all' thins out to every k-th tick when crowded; the window ends are labelled when zoomed.
    const spacing = (this.x1 - this.x0) / (hi - lo);
    const gap = 12 + 8 * Math.max(...[lo, hi, (lo + hi) >> 1, lo + 1].map((i) => (this.decimal(i) ?? String(i)).length));
    const step = cfg.labels === 'all' ? labelStep(spacing, gap, den) : 0;
    const roomy = (i: number) => spacing * Math.min(...[1, -1].map((s) => { let j = i; while (j % step) j += s; return Math.abs(j - i) || step; })) >= gap;
    for (let i = lo; i <= hi; i++) {
      const k = tickKind(i, den);
      const h = k === 'whole' ? 13 : k === 'mid' ? 9 : 6;
      const x = this.x(i).toFixed(1);
      out.push(`<line class="kg-nl-tick kg-nl-${k}" data-tick="${i}" x1="${x}" x2="${x}" y1="${y - h}" y2="${y + h}"/>`);
      const end = zoom && (i === lo || i === hi);
      const show = cfg.labels === 'all' ? i % step === 0 || (end && roomy(i)) : cfg.labels !== 'none' && (k === 'whole' || end);
      if (show) {
        out.push(this.label(i, y + 12));
        H = Math.max(H, y + (i % den === 0 || this.decimal(i) ? 36 : 50));
      }
    }

    for (const f of cfg.fixedPoints ?? []) {
      const i = toTick(f, den);
      if (i >= lo && i <= hi) out.push(`<circle class="kg-nl-fixed" cx="${this.x(i)}" cy="${y}" r="9"><title>${this.dataset.labelGiven ?? ''}</title></circle>`);
    }

    const name = this.dataset.labelPoint ?? 'Point';
    this.pts.forEach((i, p) => {
      const x = this.x(i);
      out.push(`<g class="kg-nl-pt${p === this.active ? ' active' : ''}" data-p="${p}" tabindex="0" role="slider" ` +
        `aria-label="${name} ${digitsOf(p + 1, this.fmt)}" aria-valuemin="${lo / den}" aria-valuemax="${hi / den}" ` +
        `aria-valuenow="${i / den}" aria-valuetext="${this.text(i)}">` +
        `<circle class="kg-nl-hit" cx="${x}" cy="${y}" r="${HIT}"/><circle class="kg-nl-dot" cx="${x}" cy="${y}" r="11"/></g>`);
    });

    const svg = this.svg;
    const hadFocus = svg.contains(document.activeElement);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('class', 'kg-nl-svg' + (this.interactive ? ' interactive' : ''));
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', aria);
    svg.innerHTML = out.join('');
    // Keep keyboard focus on the point being moved (or just added) across re-renders.
    if (hadFocus) (svg.querySelector<SVGElement>(`[data-p="${this.active}"]`) ?? svg.querySelector<SVGElement>('[tabindex]'))?.focus();
  }
}

customElements.define('kg-number-line', NumberLine);

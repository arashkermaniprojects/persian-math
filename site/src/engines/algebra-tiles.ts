// <kg-algebra-tiles>: algebra tiles on a mat (x², x, 1 and their red negatives; y, xy, y² and labelled tiles too).
// Build an expression, put like terms together, take off zero pairs (a red and a white tile of the SAME shape), flip
// the tiles to show a letter's value, and write the answer on a small keypad (no keyboard switching on a phone).
// Modes: tiles (here); rectangle and grid (./algebra-tiles/frame.ts, loaded on demand); later modules plug into
// MODULES below. Contract: docs/STUDIOS.md ("Engine options → algebra-tiles"). Logic: ./lib/algebra-tiles-*.
// The mat, the keypad and every expression run left to right in every locale, as written algebra does.
import { algHTML } from '../lib/display';
import type { AlgebraState, Move } from './lib/algebra-tiles-check';
import { matPoly, pairOf, sortTiles, tileValueText, tilesOf, zeroPairs, type Tile } from './lib/algebra-tiles-mat';
import { degreeOf, format, powsOf } from './lib/algebra-tiles-poly';

export interface AlgebraConfig {
  mode?: 'tiles' | 'rectangle' | 'grid';
  /** Icon hint above the engine with the studio label `instruction-<key>` (build, collect, read, flip, write). */
  instruction?: string;
  /** tiles: the mat at the start, as written and not combined ("2x^2 + 3x + 1 - x"). */
  mat?: string;
  /** tiles: kinds in the tray, each as a white and (unless `red: false`) a red tile, e.g. [x^2, x, 1]. */
  tray?: string[];
  red?: boolean;
  /** The mat cannot be changed (reading and substitution missions). */
  lock?: boolean;
  /** Offer «put like terms together» (default: when the mat can be changed). */
  sort?: boolean;
  /** Substitution: the value of each letter; a button flips every tile to show it. `flipped` starts flipped. */
  value?: Record<string, number>;
  flipped?: boolean;
  /** Show the expression the mat makes, live. */
  readout?: boolean;
  /** A typed answer under the engine: an expression or a number, on the engine's own keypad. */
  write?: 'expr' | 'number';
  /** Letter keys on the keypad (default: the letters of the tray and mat, else x). */
  letters?: string[];
  /** Extra keys: "(", ")". */
  keys?: string[];
  [k: string]: unknown;
}

/** What the engine lends to a mode loaded on demand. */
export interface AlgebraHost {
  readonly c: AlgebraConfig;
  lab(k: string, en?: string): string;
  fill(k: string, vars: Record<string, string>, en?: string): string;
  alg(src: string): string;
  tile(kind: string, sign: number, flipped?: boolean): string;
  tileName(kind: string, sign: number): string;
  field(key: string, label: string): string;
  val(key: string): string;
  activate(key: string): void;
  log(m: Move): void;
}
/** A mode loaded on demand: its HTML (between the mat and the keypad), its actions, its part of the state. */
export interface AlgebraPart {
  html(): string;
  act(d: DOMStringMap): boolean;
  state(): Partial<AlgebraState>;
  /** The keypad is shown for this part's own fields (grid cells) even without `write`. */
  keypad?: boolean;
}
type Mount = { mount(host: AlgebraHost, c: AlgebraConfig): AlgebraPart };

/**
 * Parts loaded only when a mission's `mode` asks for them (each its own chunk, within the size budget).
 * Planned modules plug in here:  balance: () => import('./algebra-tiles/balance')  (alg-solve-linear),
 * factors: () => import('./algebra-tiles/factors')  (num-index-laws, num-surds, alg-algebraic-fractions).
 */
const MODULES: Record<string, () => Promise<Mount>> = {
  rectangle: () => import('./algebra-tiles/frame'),
  grid: () => import('./algebra-tiles/frame'),
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
/** Tile sizes in px: a unit square, and the length of each letter (x is not a whole number of units). */
const U = 22, LEN: Record<string, number> = { x: 52, y: 38 }, OTHER = 44;
const len = (s: string) => LEN[s] ?? OTHER;
const MAX = 40;

type MatTile = Tile & { id: number };

export class AlgebraTiles extends HTMLElement implements AlgebraHost {
  c: AlgebraConfig = {};
  private tiles: MatTile[] = [];
  private next = 0;
  private sel: number | null = null;
  private focusId: number | null = null;
  private flipped = false;
  private moves: Move[] = [];
  private msg = '';
  private fields: Record<string, string> = {};
  private active = 'w';
  private part?: AlgebraPart;
  private built = false;
  private gen = 0;
  ready: Promise<void> = Promise.resolve();

  set config(cfg: AlgebraConfig) {
    // YAML reads `1` and `[3, x + 4]` as numbers: every expression in the config is kept as text.
    const c: AlgebraConfig = { ...cfg };
    for (const [k, v] of Object.entries(cfg)) {
      if (k === 'value') continue;
      if (typeof v === 'number' && k !== 'mode') c[k] = String(v);
      else if (Array.isArray(v) && k !== 'given') c[k] = v.map((x) => (typeof x === 'number' ? String(x) : x));
    }
    this.c = c;
    this.reset();
    this.fields = {};
    this.active = 'w';
    this.flipped = !!c.flipped;
    this.part = undefined;
    const load = MODULES[c.mode ?? 'tiles'], gen = ++this.gen;
    if (load) this.ready = load().then((m) => {
      if (gen !== this.gen) return; // a newer config arrived while this one was loading
      this.part = m.mount(this, c);
      if (this.built) this.render();
    });
    if (this.built) this.render();
  }

  private reset() {
    this.tiles = this.c.mat ? tilesOf(this.c.mat).map((t) => ({ ...t, id: this.next++ })) : [];
    this.sel = null;
    this.moves = [];
    this.msg = '';
  }

  get state(): { algebra: AlgebraState } {
    const s: AlgebraState = {
      mode: this.c.mode ?? 'tiles',
      mat: this.tiles.map(({ kind, sign }) => ({ kind, sign })),
      written: this.c.write ? this.fields.w ?? null : undefined,
      flipped: this.flipped,
      moves: [...this.moves],
    };
    return { algebra: { ...s, ...this.part?.state() } };
  }

  // ---------- host API (also used by modes loaded on demand) ----------

  lab = (k: string, en = '') => esc(this.dataset[camel(k)] ?? en);
  fill = (k: string, vars: Record<string, string>, en = '') => this.lab(k, en).replace(/\{(\w+)\}/g, (m, v: string) => vars[v] ?? m);
  alg = (src: string) => algHTML(src, this.dataset.digits ?? '0123456789');
  val = (key: string) => this.fields[key] ?? '';
  activate = (key: string) => { this.active = key; };
  log = (m: Move) => { this.moves.push(m); };

  /** ASCII written on a tile: its kind (−x², xy), or when flipped what it stands for (−(−3)^2). */
  private tileText(kind: string, sign: number, flipped: boolean) {
    let text = kind.replace(/\*/g, '');
    if (flipped && this.c.value) {
      text = tileValueText(kind, this.c.value);
      if (sign < 0 && text.startsWith('-')) text = `(${text})`;
    }
    return (sign < 0 ? '-' : '') + text;
  }

  /** Plain text for screen readers and messages: x², −x, (−۳)² × ۲. */
  private plain = (src: string) => src.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\*/g, '×').replace(/-/g, '−')
    .replace(/\d/g, (d) => (this.dataset.digits ?? '0123456789')[+d]);

  tileName(kind: string, sign: number, flipped = false) {
    const name = this.plain(this.tileText(kind, sign, false));
    return flipped && this.c.value ? `${name}: ${this.plain(this.tileText(kind, sign, true))}` : name;
  }

  /** A tile picture: its shape from its letters (the x strip lies flat), its colour from its sign. */
  tile(kind: string, sign: number, flipped = false) {
    const p = powsOf(kind), syms = Object.keys(p).flatMap((s) => Array(p[s]).fill(s) as string[]);
    const [w, h] = syms.length === 0 ? [U, U] : syms.length === 1 ? [len(syms[0]), U] : [len(syms[0]), len(syms[1])];
    const text = this.tileText(kind, sign, flipped);
    const cls = `kg-at-t d${Math.min(2, degreeOf(kind))}${sign < 0 ? ' neg' : ''}${syms.includes('y') ? ' y' : ''}${syms.some((s) => s !== 'x' && s !== 'y') ? ' sym' : ''}`;
    return `<span class="${cls}" style="inline-size:${w}px;block-size:${h}px" aria-hidden="true">${this.alg(text)}</span>`;
  }

  /** A typed field: tap it to write into it with the keypad (or type on a keyboard). */
  field(key: string, label: string) {
    const v = this.fields[key] ?? '', on = this.active === key;
    return `<span class="kg-at-field${on ? ' on' : ''}${v ? '' : ' empty'}" role="textbox" tabindex="0" data-a="field" data-f="${key}" data-k="f${key}" aria-label="${label}"${on ? ' aria-current="true"' : ''}>${v ? this.alg(v) : ''}</span>`;
  }

  // ---------- events ----------

  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-a]');
      if (b && this.contains(b) && !(b as HTMLButtonElement).disabled) this.act(b.dataset);
    });
    this.addEventListener('keydown', (e) => this.key(e));
    this.render();
  }

  private key(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.dataset.a === 'tile') {
      const ids = this.tiles.map((x) => x.id), at = ids.indexOf(Number(t.dataset.id));
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: ids.length - 1 }[e.key];
      if (to !== undefined) {
        e.preventDefault();
        this.focusId = ids[Math.max(0, Math.min(ids.length - 1, to))];
        this.render(`t${this.focusId}`);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.editable && this.c.tray?.length) {
        e.preventDefault();
        this.sel = Number(t.dataset.id);
        this.act({ a: 'remove' });
      }
      return;
    }
    if (t.dataset.a !== 'field') return;
    this.active = t.dataset.f!;
    const k = e.key.replace(/[۰-۹]/, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('−', '-');
    const v = k === 'Backspace' ? 'del' : k === '²' ? '^2' : k === '³' ? '^3' : k;
    if (v === 'del' || (v === '^' && this.c.write !== 'number') || this.keyset().includes(v)) {
      e.preventDefault();
      this.act({ a: 'key', v });
    }
  }

  private get editable() { return !this.c.lock; }

  private act(d: DOMStringMap) {
    if (this.part?.act(d)) { this.update(); return; }
    this.msg = '';
    switch (d.a) {
      case 'add':
        this.tiles.push({ kind: d.kind!, sign: d.sign === '-1' ? -1 : 1, id: this.next++ });
        this.moves.push({ do: 'add', tile: (d.sign === '-1' ? '-' : '') + d.kind });
        this.sel = null;
        break;
      case 'tile': {
        const id = Number(d.id), a = this.tiles.find((x) => x.id === this.sel), b = this.tiles.find((x) => x.id === id)!;
        this.focusId = id;
        if (!a || a.id === id) { this.sel = a ? null : id; break; }
        const kind = pairOf(a, b);
        if (kind === 'same-sign') { this.sel = id; break; }
        const names = { t: this.tileName(a.kind, a.sign), u: this.tileName(b.kind, b.sign) };
        if (kind === 'zero') {
          this.tiles = this.tiles.filter((x) => x !== a && x !== b);
          this.moves.push({ do: 'zero', tile: a.kind });
          this.msg = this.fill('label-zero', names, '{t} and {u} make 0.');
          this.focusId = this.tiles[0]?.id ?? null;
        } else {
          this.moves.push({ do: 'unlike', tile: `${a.kind}|${b.kind}` });
          this.msg = this.fill('label-unlike', names, '{t} and {u} are different shapes: not a zero pair.');
        }
        this.sel = null;
        break;
      }
      case 'remove': {
        // only where tiles can be added too: removing one tile changes the expression the mission gave
        const at = this.c.tray?.length ? this.tiles.findIndex((x) => x.id === this.sel) : -1;
        if (at < 0) return;
        const [t] = this.tiles.splice(at, 1);
        this.moves.push({ do: 'remove', tile: (t.sign < 0 ? '-' : '') + t.kind });
        this.sel = null;
        this.focusId = this.tiles[Math.min(at, this.tiles.length - 1)]?.id ?? null;
        break;
      }
      case 'sort':
        this.tiles = sortTiles(this.tiles);
        this.moves.push({ do: 'sort' });
        break;
      case 'clear':
        this.reset();
        this.moves.push({ do: 'clear' });
        break;
      case 'flip':
        this.flipped = !this.flipped;
        this.moves.push({ do: 'flip' });
        break;
      case 'field':
        this.active = d.f!;
        break;
      case 'key': {
        const v = this.fields[this.active] ?? '';
        this.fields[this.active] = d.v === 'del' ? v.replace(/(\^\d|.)$/, '') : (v + d.v).slice(0, MAX);
        break;
      }
      default:
        return;
    }
    this.update();
  }

  /** Redraw and tell the studio. */
  private update() {
    this.render();
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  // ---------- drawing ----------

  private letters(): string[] {
    const c = this.c;
    if (c.letters) return c.letters;
    const ks = [...(c.tray ?? []), ...(c.mat ? Object.keys(matPoly(tilesOf(c.mat))) : [])].flatMap((k) => Object.keys(powsOf(k)));
    const ls = [...new Set(ks)].filter((s) => /^[a-z]$/i.test(s)).sort();
    return ls.length ? ls : ['x'];
  }

  /** Keys of the keypad in order, six to a row: 1–5 and a sign, 6–0 and a sign, then letters and powers. */
  private keyset(): string[] {
    const a = ['1', '2', '3', '4', '5'], b = ['6', '7', '8', '9', '0'];
    if (this.c.write === 'number' && !this.part) return [...a, '-', ...b];
    return [...a, '+', ...b, '-', ...this.letters(), '^2', '^3', ...(this.c.keys ?? [])];
  }

  private keypadHTML() {
    const names: Record<string, [string, string]> = {
      '^2': ['label-key-square', 'squared'], '^3': ['label-key-cube', 'cubed'], '+': ['label-key-plus', 'plus'], '-': ['label-key-minus', 'minus'],
    };
    const keys = this.keyset().map((k) => {
      const face = k.startsWith('^') ? `□<sup>${this.plain(k.slice(1))}</sup>` : this.plain(k);
      const n = names[k];
      return `<button type="button" class="kg-at-key${/\d/.test(k) && k.length === 1 ? ' dig' : ''}" data-a="key" data-v="${esc(k)}" data-k="k${esc(k)}"${n ? ` aria-label="${this.lab(n[0], n[1])}"` : ''}>${face}</button>`;
    });
    keys.push(`<button type="button" class="kg-at-key del" data-a="key" data-v="del" data-k="kdel" aria-label="${this.lab('label-key-delete', 'delete')}">⌫</button>`);
    return `<div class="kg-at-keys" dir="ltr" role="group" aria-label="${this.lab('label-keypad', 'keypad')}">${keys.join('')}</div>`;
  }

  private trayHTML() {
    const c = this.c;
    const signs = c.red === false ? [1] : [1, -1];
    // one row of white tiles, one of red: the red row is the flip side of the white one
    const rows = signs.map((s) => `<div class="kg-at-row">${(c.tray ?? []).map((k) => {
      const name = this.tileName(k, s);
      return `<button type="button" class="kg-at-slot" data-a="add" data-kind="${esc(k)}" data-sign="${s}" data-k="a${s}${esc(k)}" aria-label="${this.fill('label-add', { t: name }, 'add {t}')}">${this.tile(k, s)}</button>`;
    }).join('')}</div>`);
    return `<div class="kg-at-tray" dir="ltr" role="group" aria-label="${this.lab('label-tray', 'tiles')}">${rows.join('')}</div>`;
  }

  private matHTML() {
    const lock = !this.editable;
    const focus = this.tiles.some((t) => t.id === this.focusId) ? this.focusId : this.tiles[0]?.id;
    // once like terms are side by side, a gap between the groups shows the terms
    const sorted = sortTiles(this.tiles).every((t, i) => t === this.tiles[i]);
    let h = '', prev = '';
    for (const t of this.tiles) {
      const gap = sorted && prev && prev !== t.kind ? ' gap' : '';
      prev = t.kind;
      const name = this.fill('label-tile', { t: this.tileName(t.kind, t.sign, this.flipped) }, '{t}');
      h += lock
        ? `<span class="kg-at-cell${gap}" role="img" aria-label="${name}">${this.tile(t.kind, t.sign, this.flipped)}</span>`
        : `<button type="button" class="kg-at-cell${gap}${this.sel === t.id ? ' sel' : ''}" data-a="tile" data-id="${t.id}" data-k="t${t.id}" tabindex="${t.id === focus ? 0 : -1}" aria-pressed="${this.sel === t.id}" aria-label="${name}">${this.tile(t.kind, t.sign, this.flipped)}</button>`;
    }
    if (!this.tiles.length) h = `<span class="kg-at-none">${this.lab('label-empty', 'empty')}</span>`;
    return `<div class="kg-at-mat" dir="ltr" role="group" aria-label="${this.lab('label-mat', 'mat')}">${h}</div>`;
  }

  private toolsHTML() {
    const c = this.c, b = (a: string, label: string, en: string, off = false, extra = '') =>
      `<button type="button" class="kg-at-btn" data-a="${a}" data-k="${a}"${off ? ' disabled' : ''}${extra}>${this.lab(label, en)}</button>`;
    let h = '';
    if (this.editable && c.sort !== false && this.tiles.length) h += b('sort', 'label-sort', 'like terms together');
    if (this.editable && c.tray?.length) h += b('remove', 'label-remove', 'remove', this.sel === null) + b('clear', 'label-clear', 'start again', !this.moves.length);
    if (c.value) {
      const v = Object.entries(c.value).map(([s, n]) => `${s} = ${n}`).join(', ');
      h += `<button type="button" class="kg-at-btn flip" data-a="flip" data-k="flip" aria-pressed="${this.flipped}">${this.flipped ? this.lab('label-unflip', 'letters') : this.fill('label-flip', { v: this.alg(v) }, 'put {v}')}</button>`;
    }
    return h ? `<div class="kg-at-tools">${h}</div>` : '';
  }

  private render(focusKey?: string) {
    const c = this.c;
    const ae = document.activeElement as HTMLElement | null;
    const focus = focusKey ?? (ae && this.contains(ae) ? ae.dataset.k : undefined);
    let h = '';
    if (c.instruction) h += `<p class="kg-at-hint"><span class="kg-at-i i-${esc(c.instruction)}" aria-hidden="true"></span>${this.lab(`instruction-${c.instruction}`)}</p>`;
    if (this.part) h += this.part.html();
    else if (!MODULES[c.mode ?? 'tiles']) {
      if (c.tray?.length && this.editable) h += this.trayHTML();
      if (c.mat !== undefined || c.tray?.length) h += this.matHTML() + this.toolsHTML();
      if (c.readout) h += `<p class="kg-at-read">${this.fill('label-readout', { e: this.alg(format(matPoly(this.tiles))) }, '{e}')}</p>`;
    }
    h += `<p class="kg-at-msg" role="status">${this.msg}</p>`;
    if (c.write || this.part?.keypad) {
      if (c.write) h += `<div class="kg-at-write"><span>${this.lab('label-write', 'answer')}</span>${this.field('w', this.lab('label-answer', 'your answer'))}</div>`;
      h += this.keypadHTML();
    }
    this.innerHTML = `<div class="kg-at" data-mode="${esc(c.mode ?? 'tiles')}" data-zero="${zeroPairs(this.tiles)}">${h}</div>`;
    if (focus) (this.querySelector<HTMLElement>(`[data-k="${CSS.escape(focus)}"]:not(:disabled)`) ?? this.querySelector<HTMLElement>('.kg-at-mat button, .kg-at-tray button'))?.focus();
  }
}

customElements.define('kg-algebra-tiles', AlgebraTiles);

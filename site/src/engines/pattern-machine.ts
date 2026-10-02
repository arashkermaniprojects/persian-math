// <kg-pattern-machine>: repeating shape patterns, growing figures, number patterns, input–output machines
// («ماشین ورودی ـ خروجی»), a hundred square for multiples and factors, and step-by-step order of operations.
// Contract: docs/STUDIOS.md ("Engine contract", "Engine options → pattern-machine"). Logic lives in ./lib/pattern-machine-*.
// Everything that carries numbers runs left to right, as both countries' books draw sequences, machines and formulas.
import { digitsOf } from '../lib/display';
import { applyAt, letterOf, ready, rightNext, round, runRule, show, showRule, tokenize, undoRule, type Tok } from './lib/pattern-machine-expr';
import { parseItem, repeatUnit } from './lib/pattern-machine-repeat';
import { continueJumps, figureCount, figureRows, members, sticks, term, type FigureConfig, type NumSet, type SeqConfig } from './lib/pattern-machine-seq';
import type { PatternState } from './lib/pattern-machine-check';

type Row = number | { ex?: number; out?: number };

export interface PatternConfig extends SeqConfig, FigureConfig {
  mode: 'repeat' | 'grow' | 'numbers' | 'machine' | 'hundred' | 'expr';
  /** Icon hint above the engine with the studio label `instruction-<name>`. */
  instruction?: string;
  // repeat
  /** The repeating unit, e.g. [red-circle, blue-triangle, blue-triangle]; other strings show as text (A, B). */
  unit?: string[];
  /** Slots in the row (default 2 units + `blank`). */
  length?: number;
  /** continue: fill the empty end slots; unit: tap where the pattern starts again; fix: replace the wrong item; make: build your own. */
  task?: 'continue' | 'unit' | 'fix' | 'make';
  /** continue: how many slots at the end are empty (default 3). */
  blank?: number;
  /** fix: wrong items shown, by position (1-based), e.g. { 5: blue-square }. */
  wrong?: Record<number, string>;
  /** Items to choose from (default: the unit's items). */
  palette?: string[];
  // grow and numbers
  /** Figures (grow) or terms (numbers) shown. */
  show?: number;
  /** grow: the learner may draw up to this many figures with −/+ (default: show). */
  more?: number;
  /** Positions (1-based) whose number the learner types; positions after `show` get their own columns or boxes. */
  ask?: number[];
  /** grow: show the count of every drawn figure that is not asked (default true). */
  counts?: boolean;
  /** numbers: draw the hops between terms (default true) and ask for the jump (`askStep`). */
  hops?: boolean;
  askStep?: boolean;
  // machine
  rule?: string | [string, number][];
  /** A number: its output is asked. { ex: n }: an example with both shown. { out: n }: its input is asked. */
  rows?: Row[];
  /** The rule is hidden; the learner sets an operation and a number (one stage only). */
  hide?: boolean;
  /** Operations offered when the rule is hidden. */
  ops?: string[];
  /** A free row: type any input and see the output. */
  try?: boolean;
  /** Column heading letter for the input (and output), e.g. n and P (a formula). */
  letter?: string;
  outLetter?: string;
  // hundred
  from?: number;
  to?: number;
  /** Columns (default 10). */
  cols?: number;
  /** Shading colours the learner can switch between (1 or 2). */
  layers?: number;
  /** Numbers shaded at the start, one set per layer. */
  shaded?: NumSet[];
  locked?: boolean;
  // expr
  expr?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const SHAPE: Record<string, string> = {
  circle: '<circle cx="20" cy="20" r="15"/>',
  square: '<rect x="6" y="6" width="28" height="28" rx="3"/>',
  triangle: '<path d="M20 4l16 30H4z"/>',
  star: '<path d="M20 3l5 10.6 11.6 1.4-8.6 7.9 2.3 11.5L20 28.6 9.7 34.4 12 22.9 3.4 15l11.6-1.4z"/>',
  diamond: '<path d="M20 3l17 17-17 17L3 20z"/>',
  heart: '<path d="M20 35S4 25 4 14a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 11-16 21-16 21z"/>',
};

export class PatternMachine extends HTMLElement {
  private c: PatternConfig = { mode: 'repeat' };
  private seq: (string | null)[] = [];
  private target: string[] = [];
  private sel = -1;
  private unitLen: number | null = null;
  private ans: Record<string, number | null> = {};
  private drawn = 0;
  private rule: [string | null, number | null] = [null, null];
  private tryIn: number | null = null;
  private lay: number[][] = [[], []];
  private layer = 0;
  private focusCell = 0;
  private lines: Tok[][] = [];
  /** One entry per step taken: was it the right next step? Undo pops it, so undoing a slip forgives it. */
  private inOrder: boolean[] = [];
  private built = false;

  set config(c: PatternConfig) {
    this.c = c;
    this.sel = -1;
    this.unitLen = null;
    this.ans = {};
    this.rule = [null, null];
    this.tryIn = null;
    this.layer = 0;
    this.inOrder = [];
    const unit = c.unit ?? [];
    const task = c.task ?? 'continue';
    const len = c.length ?? unit.length * 2 + (c.blank ?? 3);
    this.target = repeatUnit(unit, len);
    this.seq = this.target.map((t, i) =>
      task === 'make' ? null : task === 'continue' && i >= len - (c.blank ?? 3) ? null : c.wrong?.[i + 1] ?? t);
    if (task === 'continue') this.sel = this.seq.indexOf(null);
    this.drawn = c.show ?? 3;
    for (const k of this.keys()) this.ans[k] = null;
    const [from, to] = this.range();
    this.lay = [0, 1].map((i) => (c.shaded?.[i] ? members(c.shaded[i], from, to) : []));
    this.focusCell = 0;
    this.lines = c.expr ? [tokenize(c.expr)] : [];
    if (this.built) this.render();
  }

  get state(): { pattern: PatternState } {
    const c = this.c;
    const s: PatternState = { mode: c.mode };
    if (c.mode === 'repeat') Object.assign(s, { seq: [...this.seq], target: this.target, unit: this.unitLen });
    if (this.keys().length) s.answers = { ...this.ans }, s.expect = Object.fromEntries(this.keys().map((k) => [k, this.want(k)]));
    if (c.mode === 'machine' && c.hide) {
      s.rule = this.rule[0] && this.rule[1] !== null ? [this.rule[0], this.rule[1]] : null;
      s.pairs = (c.rows ?? []).map((r) => { const x = this.rowIn(r); return [x, runRule(c.rule!, x)]; });
    }
    if (c.mode === 'hundred') s.layers = this.lay.map((l) => [...l].sort((a, b) => a - b)), s.range = this.range();
    if (c.mode === 'expr') {
      const last = this.lines[this.lines.length - 1];
      s.finished = last.length === 1;
      s.ordered = this.inOrder.every(Boolean);
      s.result = s.finished ? (last[0] as { v: number }).v : undefined;
    }
    return { pattern: s };
  }

  private range = (): [number, number] => [this.c.from ?? 1, this.c.to ?? 100];

  /** Keys of the numbers the learner types: t<n> (term n), step, r<i> (machine row i, 1-based). */
  private keys(): string[] {
    const c = this.c;
    if (c.mode === 'grow' || c.mode === 'numbers') return [...(c.ask ?? []).map((n) => `t${n}`), ...(c.askStep ? ['step'] : [])];
    if (c.mode === 'machine') return (c.rows ?? []).flatMap((r, i) => (typeof r === 'object' && r.ex !== undefined ? [] : [`r${i + 1}`]));
    return [];
  }

  private want(k: string): number {
    const c = this.c;
    if (k === 'step') return c.step ?? 1;
    const n = Number(k.slice(1));
    if (c.mode === 'grow') return figureCount(c, n);
    if (c.mode === 'numbers') return term(c, n);
    const r = c.rows![n - 1];
    return typeof r === 'number' ? runRule(c.rule!, r) : this.rowIn(r);
  }

  /** The input of a machine row (for { out } rows, found by undoing the rule). */
  private rowIn(r: Row): number {
    if (typeof r === 'number') return r;
    if (r.ex !== undefined) return r.ex;
    const u = undoRule(this.c.rule!, r.out!);
    if (u === null) throw new Error('pattern-machine: { out } rows need a rule made of stages');
    return u;
  }

  private num = (v: number) => this.num0(String(round(v)).replace('-', '−').replace('.', this.dataset.decimal ?? '.'));
  private lab = (k: string, en = '') => esc(this.dataset[camel(k)] ?? en);
  private fill = (k: string, n: number | string) => this.lab(k).replace('{n}', typeof n === 'number' ? this.num(n) : n);

  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-a]');
      if (b && this.contains(b) && !(b as HTMLButtonElement).disabled) this.act(b.dataset);
    });
    this.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.dataset.key) return;
      const v = parseNum(t.value);
      if (t.dataset.key === 'try') {
        this.tryIn = v;
        this.querySelector('.kg-pm-try output')!.innerHTML = v === null ? '' : this.num(runRule(this.c.rule!, v));
      } else if (t.dataset.key === 'rule') this.rule[1] = v;
      else {
        this.ans[t.dataset.key] = v;
        if (t.dataset.key === 'step') this.querySelectorAll('.kg-pm-hop b').forEach((h) => (h.textContent = this.hopText(v)));
      }
      this.emit();
    });
    this.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (!t.classList.contains('kg-pm-cell')) return;
      const cols = this.c.cols ?? 10;
      const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (!d) return;
      e.preventDefault();
      const [from, to] = this.range();
      this.focusCell = Math.min(to - from, Math.max(0, Number(t.dataset.i) - from + d));
      this.querySelectorAll<HTMLElement>('.kg-pm-cell').forEach((b, i) => (b.tabIndex = i === this.focusCell ? 0 : -1));
      this.querySelectorAll<HTMLElement>('.kg-pm-cell')[this.focusCell].focus();
    });
    this.render();
  }

  private emit() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  private act(d: DOMStringMap) {
    const i = Number(d.i), c = this.c, task = c.task ?? 'continue';
    switch (d.a) {
      case 'slot':
        if (task === 'unit') this.unitLen = i || null;
        else if (this.sel === i && this.seq[i] && task !== 'fix') this.seq[i] = null;
        else this.sel = this.sel === i ? -1 : i;
        break;
      case 'put':
        if (this.sel < 0) return;
        this.seq[this.sel] = d.v!;
        if (task === 'fix') this.sel = -1;
        else {
          const next = this.seq.indexOf(null, this.sel);
          this.sel = next >= 0 ? next : this.seq.indexOf(null);
        }
        break;
      case 'figs':
        this.drawn = Math.min(c.more ?? c.show ?? 3, Math.max(1, this.drawn + i));
        break;
      case 'op':
        this.rule[0] = d.v!;
        break;
      case 'layer':
        this.layer = i;
        break;
      case 'cell': {
        const l = this.lay[this.layer], at = l.indexOf(i);
        if (at >= 0) l.splice(at, 1);
        else l.push(i);
        this.focusCell = i - this.range()[0];
        break;
      }
      case 'jumps': {
        const l = this.lay[this.layer];
        for (const v of continueJumps(l, this.range()[1])) if (!l.includes(v)) l.push(v);
        break;
      }
      case 'clear':
        this.lay[this.layer] = [];
        break;
      case 'do': {
        const cur = this.lines[this.lines.length - 1];
        this.inOrder.push(rightNext(cur).includes(i));
        this.lines.push(applyAt(cur, i));
        break;
      }
      case 'undo':
        if (this.lines.length > 1) { this.lines.pop(); this.inOrder.pop(); }
        break;
      default:
        return;
    }
    this.render();
    this.emit();
  }

  private item(v: string | null) {
    if (!v) return '';
    const p = parseItem(v);
    return p.shape ? `<svg viewBox="0 0 40 40" class="f-${p.color}" aria-hidden="true">${SHAPE[p.shape]}</svg>` : `<span class="kg-pm-tx">${esc(digitsOf(v, { digits: this.dataset.digits ?? '0123456789', decimal: '.' }))}</span>`;
  }

  private itemName(v: string | null) {
    if (!v) return this.lab('label-empty', 'empty');
    const p = parseItem(v);
    return p.shape ? `${this.lab(`color-${p.color}`, p.color)} ${this.lab(`shape-${p.shape}`, p.shape)}`.trim() : esc(v);
  }

  private input(key: string, label: string, v = this.ans[key]) {
    return `<input class="kg-pm-in" data-key="${key}" inputmode="decimal" autocomplete="off" aria-label="${label}" value="${v === null || v === undefined ? '' : this.num(v)}">`;
  }

  private repeatHTML() {
    const c = this.c, task = c.task ?? 'continue';
    const editable = (i: number) => task !== 'continue' || this.target.length - i <= (c.blank ?? 3);
    const u = this.unitLen;
    let h = `<div class="kg-pm-row" dir="ltr" role="group" aria-label="${this.lab('label-pattern', 'pattern')}">`;
    // On a phone the row breaks after whole units (at most 7 items a line), so each line still shows the pattern.
    const n = c.unit?.length || 3, per = n > 7 ? 7 : n * Math.floor(7 / n);
    this.seq.forEach((v, i) => {
      if (i && i % per === 0) h += '<i class="br"></i>';
      const cls = `kg-pm-slot${v ? '' : ' empty'}${this.sel === i ? ' sel' : ''}${u && i < u ? ' unit' : ''}${u && i && i % u === 0 ? ' cut' : ''}`;
      const name = `${this.fill('label-position', i + 1) || this.num(i + 1)}: ${this.itemName(v)}`;
      h += task === 'unit' || editable(i)
        ? `<button type="button" class="${cls}" data-a="slot" data-i="${i}" data-k="s${i}" aria-label="${name}" aria-pressed="${task === 'unit' ? u === i : this.sel === i}">${this.item(v)}</button>`
        : `<span class="${cls}" role="img" aria-label="${name}">${this.item(v)}</span>`;
    });
    h += '</div>';
    if (task === 'unit') return h;
    const pal = c.palette ?? [...new Set(c.unit)];
    return h + `<div class="kg-pm-pal" role="group" aria-label="${this.lab('label-palette', 'choose')}">${pal.map((v) =>
      `<button type="button" class="kg-pm-slot" data-a="put" data-v="${esc(v)}" data-k="p${esc(v)}" aria-label="${this.itemName(v)}"${this.sel < 0 ? ' disabled' : ''}>${this.item(v)}</button>`).join('')}</div>`;
  }

  private figure(n: number) {
    const c = this.c;
    let body = '', w = 0, h = 0;
    if (c.figure === 'sticks') {
      const U = 24, segs = sticks(c, n);
      w = Math.max(...segs.map((s) => Math.max(s[0], s[2]))) * U + 8;
      h = Math.max(...segs.map((s) => Math.max(s[1], s[3]))) * U + 8;
      body = segs.map(([a, b, x, y]) => `<line x1="${a * U + 4}" y1="${h - 4 - b * U}" x2="${x * U + 4}" y2="${h - 4 - y * U}"/>`).join('');
    } else {
      const U = 14, rows = figureRows(c, n);
      w = Math.max(1, ...rows) * U;
      h = rows.length * U;
      rows.forEach((k, r) => {
        for (let j = 0; j < k; j++) {
          const x = j * U, y = h - (r + 1) * U;
          body += c.figure === 'squares' ? `<rect x="${x + 1}" y="${y + 1}" width="${U - 2}" height="${U - 2}"/>` : `<circle cx="${x + U / 2}" cy="${y + U / 2}" r="${U / 2 - 2}"/>`;
        }
      });
    }
    const cap = this.fill('label-figure', n) || this.num(n);
    return `<figure class="kg-pm-fig"><svg class="${c.figure ?? 'dots'}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${cap}">${body}</svg><figcaption>${cap}</figcaption></figure>`;
  }

  private growHTML() {
    const c = this.c, ask = c.ask ?? [];
    let h = `<div class="kg-pm-figs" dir="ltr">${Array.from({ length: this.drawn }, (_, i) => this.figure(i + 1)).join('')}</div>`;
    if ((c.more ?? 0) > (c.show ?? 3))
      h += `<div class="kg-pm-ctl">${this.btn('figs', -1, '−', 'label-fewer-figures', 'fewer figures')}${this.btn('figs', 1, '+', 'label-more-figures', 'more figures')}</div>`;
    const pos = [...new Set([...Array.from({ length: c.show ?? 3 }, (_, i) => i + 1), ...ask])].sort((a, b) => a - b);
    let top = '', bot = '';
    pos.forEach((n, j) => {
      if (j && n > pos[j - 1] + 1) { top += '<td>…</td>'; bot += '<td>…</td>'; }
      top += `<td>${this.num(n)}</td>`;
      bot += `<td>${ask.includes(n) ? this.input(`t${n}`, this.fill('label-count-of', n)) : c.counts === false ? '' : this.num(figureCount(c, n))}</td>`;
    });
    return h + `<div class="kg-pm-scroll"><table class="kg-pm-tab" dir="ltr"><tr><th>${this.lab('label-figure-no', 'figure')}</th>${top}</tr><tr><th>${this.lab('label-count', 'how many')}</th>${bot}</tr></table></div>`;
  }

  private hopText(v: number | null | undefined) {
    const c = this.c, op = c.op ?? '+';
    return `${op === '-' ? '−' : op === '*' ? '×' : op}${v === undefined ? this.num(c.step ?? 1) : v === null ? '?' : this.num(v)}`;
  }

  private numbersHTML() {
    const c = this.c, ask = c.ask ?? [], n = c.show ?? 6;
    const hop = c.hops !== false && !c.rule && !c.terms;
    let h = '<div class="kg-pm-seq" dir="ltr">';
    for (let i = 1; i <= n; i++) {
      const t = ask.includes(i) ? this.input(`t${i}`, this.fill('label-term', i)) : `<span>${this.num(term(c, i))}</span>`;
      h += `<span class="kg-pm-t">${t}${hop && i < n ? `<span class="kg-pm-hop" aria-hidden="true"><svg viewBox="0 0 40 16"><path d="M3 14Q20-4 37 14"/><path d="M31 9l6 5-8 1"/></svg><b>${this.hopText(c.askStep ? this.ans.step : undefined)}</b></span>` : ''}</span>`;
    }
    h += '<span class="kg-pm-t">…</span></div>';
    if (c.askStep) h += `<p class="kg-pm-q">${this.lab('label-step', 'jump')} <bdi dir="ltr">${this.hopText(0).replace(/[0-9۰-۹]/g, '')} ${this.input('step', this.lab('label-step', 'jump'))}</bdi></p>`;
    for (const k of ask.filter((a) => a > n)) h += `<p class="kg-pm-q">${this.fill('label-term', k)} <bdi dir="ltr">${this.input(`t${k}`, this.fill('label-term', k))}</bdi></p>`;
    return h;
  }

  private machineHTML() {
    const c = this.c, rows = c.rows ?? [];
    const L = c.letter ?? (typeof c.rule === 'string' ? letterOf(c.rule) : '');
    let box: string;
    if (c.hide) {
      box = `<span role="radiogroup" aria-label="${this.lab('label-op', 'operation')}">${(c.ops ?? ['+', '−', '×', '÷']).map((o) =>
        `<button type="button" role="radio" class="kg-pm-op" data-a="op" data-v="${o}" data-k="o${o}" aria-checked="${this.rule[0] === o}">${o}</button>`).join('')}</span>` +
        this.input('rule', this.lab('label-rule-number', 'number'), this.rule[1]);
    } else {
      const r = c.rule!;
      box = typeof r === 'string' ? `<span class="kg-pm-stage">${this.num0(showRule(r))}</span>` : r.map(([o, n]) => `<span class="kg-pm-stage">${this.num0(showRule([[o, n]]))}</span>`).join('<i aria-hidden="true">→</i>');
    }
    let h = `<div class="kg-pm-mach" dir="ltr" style="--rows:${rows.length + (c.try ? 1 : 0)}">` +
      `<b class="kg-pm-h">${L ? esc(L) : this.lab('label-in', 'in')}</b><span></span><b class="kg-pm-h">${c.outLetter ? esc(c.outLetter) : this.lab('label-out', 'out')}</b>` +
      `<div class="kg-pm-box" role="group" aria-label="${this.lab('label-machine', 'machine')}">${box}</div>`;
    rows.forEach((r, i) => {
      const ex = typeof r === 'object' && r.ex !== undefined;
      const x = this.rowIn(r), y = runRule(c.rule!, x);
      const k = `r${i + 1}`, lab = this.fill(typeof r === 'object' && !ex ? 'label-row-in' : 'label-row-out', i + 1);
      h += `<span class="kg-pm-cellin">${typeof r === 'object' && !ex ? this.input(k, lab) : this.num(x)}</span>` +
        `<span class="kg-pm-cellout">${typeof r === 'number' ? this.input(k, lab) : this.num(y)}</span>`;
    });
    if (c.try) h += `<span class="kg-pm-cellin kg-pm-try">${this.input('try', this.lab('label-try', 'try a number'), this.tryIn)}</span><span class="kg-pm-cellout kg-pm-try"><output>${this.tryIn === null ? '' : this.num(runRule(c.rule!, this.tryIn))}</output></span>`;
    return h + '</div>';
  }

  /** Digits of an ASCII math string in the locale. */
  private num0 = (s: string) => esc(digitsOf(s, { digits: this.dataset.digits ?? '0123456789', decimal: '.' })).replace(/\^ ?(\S+)/g, '<sup>$1</sup>');

  private hundredHTML() {
    const c = this.c, [from, to] = this.range(), two = (c.layers ?? 1) > 1;
    let h = '';
    if (two && !c.locked)
      h += `<div class="kg-pm-ctl" role="radiogroup" aria-label="${this.lab('label-layers', 'colour')}">${[0, 1].map((i) =>
        `<button type="button" role="radio" class="kg-pm-lay l${i}" data-a="layer" data-i="${i}" data-k="l${i}" aria-checked="${this.layer === i}">${this.lab(`label-layer-${i + 1}`, i ? 'blue' : 'red')}</button>`).join('')}</div>`;
    h += `<div class="kg-pm-sq" dir="ltr" role="group" aria-label="${this.lab('label-square', 'hundred square')}" style="--c:${c.cols ?? 10}">`;
    for (let v = from; v <= to; v++) {
      const a = this.lay[0].includes(v), b = this.lay[1].includes(v);
      const cls = `kg-pm-cell${a ? ' l0' : ''}${b ? ' l1' : ''}`;
      const other = two && this.lay[1 - this.layer].includes(v) ? `, ${this.lab(`label-layer-${2 - this.layer}`)}` : '';
      h += c.locked
        ? `<span class="${cls}">${this.num(v)}</span>`
        : `<button type="button" class="${cls}" data-a="cell" data-i="${v}" data-k="c${v}" tabindex="${v - from === this.focusCell ? 0 : -1}" aria-pressed="${this.lay[this.layer].includes(v)}" aria-label="${this.num(v)}${other}">${this.num(v)}</button>`;
    }
    h += '</div>';
    if (!c.locked) {
      const l = this.lay[this.layer];
      h += `<div class="kg-pm-ctl">${this.btn('jumps', 0, this.lab('label-jumps', 'keep jumping'), '', '', !continueJumps(l, to).length)}${this.btn('clear', 0, this.lab('label-clear', 'clear'), '', '', !l.length)}</div>`;
    }
    return h;
  }

  private exprHTML() {
    const last = this.lines.length - 1;
    const line = (toks: Tok[], live: boolean) => {
      const can = live ? ready(toks) : [];
      let s = '';
      for (let i = 0; i < toks.length; i++) {
        const k = toks[i];
        if (k.t === 'o') {
          const pow = k.v === '^' && toks[i + 1]?.t === 'n';
          const txt = pow ? `<sup>${this.num((toks[++i] as { v: number }).v)}</sup>` : k.v;
          const at = pow ? i - 1 : i;
          s += can.includes(at) ? `<button type="button" class="kg-pm-op${pow ? ' pow' : ''}" data-a="do" data-i="${at}" data-k="d${at}" aria-label="${this.fill('label-do', show(toks.slice(at - 1, at + 2)).replace(/[0-9.]+/g, (m) => this.num(Number(m))))}">${txt}</button>` : `<span>${txt}</span>`;
        } else s += `<span>${k.t === 'n' ? this.num(k.v) : esc(k.t === 'x' ? k.v : k.t)}</span>`;
      }
      return s;
    };
    const done = this.lines[last].length === 1;
    return `<div class="kg-pm-ex" dir="ltr">${this.lines.map((t, i) => `<p class="${i === last ? 'cur' : ''}${i === last && done ? ' end' : ''}">${i ? '<span>=</span>' : ''}${line(t, i === last)}</p>`).join('')}</div>` +
      `<div class="kg-pm-ctl">${this.btn('undo', 0, this.lab('label-undo', 'undo'), '', '', last === 0)}</div>`;
  }

  private btn(a: string, i: number, text: string, label: string, en: string, off = false) {
    return `<button type="button" class="kg-pm-btn" data-a="${a}" data-i="${i}" data-k="${a}${i}"${label ? ` aria-label="${this.lab(label, en)}"` : ''}${off ? ' disabled' : ''}>${text}</button>`;
  }

  private render() {
    const c = this.c;
    const ae = document.activeElement as HTMLElement | null;
    const focus = ae && this.contains(ae) ? ae.dataset.k : undefined;
    let h = '';
    if (c.instruction) h += `<p class="kg-pm-hint"><span class="kg-pm-i i-${esc(c.instruction)}" aria-hidden="true"></span>${this.lab(`instruction-${c.instruction}`)}</p>`;
    h += c.mode === 'grow' ? this.growHTML() : c.mode === 'numbers' ? this.numbersHTML() : c.mode === 'machine' ? this.machineHTML()
      : c.mode === 'hundred' ? this.hundredHTML() : c.mode === 'expr' ? this.exprHTML() : this.repeatHTML();
    this.innerHTML = `<div class="kg-pm" data-mode="${c.mode}">${h}</div>`;
    if (focus) (this.querySelector<HTMLElement>(`[data-k="${CSS.escape(focus)}"]:not(:disabled)`) ?? this.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();
  }
}

/** A typed number in any of the locales' digits and decimal marks (/ , ٫ .); null if it is not one. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[/,٫]/g, '.').replace(/[−–]/g, '-');
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
}

customElements.define('kg-pattern-machine', PatternMachine);

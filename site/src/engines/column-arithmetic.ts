// <kg-column-arithmetic>: written column addition, subtraction with borrowing, and multiplication, filled in digit by
// digit and checked as typed. Contract: docs/STUDIOS.md ("Engine contract"). Logic: ./lib/column-arithmetic-plan.ts.
// The sheet is LTR (ones on the right) in every locale, as in the Iranian, Afghan and UK books.
//   Carries: written small ABOVE the next column in Iran and Afghanistan (G02 p.100, AF G02 p.37), BELOW the answer
//   line in the UK. Borrowing: tap the digit on the left; it is crossed out and its new value written above it.
//   Long multiplication: placeholder 0 in every locale (Iran G4 p.56–57, Afghan G4 p.58 and the UK all write it);
//   'shift' (no zero, row moved left, as in Afghan G3 p.114) only when a mission asks for it.
import { asciiDigits } from '../lib/fraction';
import { borrowFrom, diagnose, inverse, parseNum, plan, subDigit, tapBorrow, type Cell, type Code, type Op, type Plan } from './lib/column-arithmetic-plan';

export interface ColumnArithmeticConfig {
  op: Op;
  /** The numbers, top to bottom. Decimals as strings or numbers ("12.5"). add: 2 or more; sub, mul: 2. */
  terms: (number | string)[];
  /** 'type' (default): the learner writes each carry; 'show': carries appear by themselves; 'hide': no carries. */
  carries?: 'type' | 'show' | 'hide';
  /** Where carries go; 'auto' takes the locale's engine.carry label (above: fa-IR/fa-AF/ps; below: en). */
  carryAt?: 'auto' | 'above' | 'below';
  /** Long multiplication; 'auto' takes the studio's engine.placeholder label, else 'zero'. */
  placeholder?: 'auto' | 'zero' | 'shift';
  /** Place-value table: column headings and lines (Iran «جدول ارزش مکانی»). */
  header?: boolean;
  /** After the answer, check it with the inverse operation (Afghan «امتحان»): a − b = d by d + b. Two terms only. */
  inverse?: boolean;
  /** add/sub with decimals: the last number starts lined up on its last digit; the learner slides it under the mark. */
  align?: boolean;
  /** Number of steps (columns) already done, as a worked start. */
  given?: number;
}

interface Sheet { p: Plan; off: number; vals?: number[]; tops: HTMLButtonElement[]; marks: HTMLElement[]; el: HTMLElement }
interface Box { el: HTMLInputElement; c: Cell; sh: Sheet; g: number; ok: boolean }
interface Shown { el: HTMLElement; from: number; until?: number; dep?: Box }
interface Mover { el: HTMLElement; i: number; pad?: boolean }

const SIGN = { add: '+', sub: '−', mul: '×' };

export class ColumnArithmetic extends HTMLElement {
  private cfg!: ColumnArithmeticConfig;
  private above = true;
  private zero = false;
  private sheets: Sheet[] = [];
  private boxes: Box[] = [];
  private shown: Shown[] = [];
  private movers: Mover[] = [];
  private shift = 0;
  private target = 0;
  private maxShift = 0;
  private ask!: HTMLElement;
  private status!: HTMLElement;
  private revealBtn!: HTMLButtonElement;
  private alignBox?: HTMLElement;
  private wrong = 0;
  private revealed = 0;
  private errors: Record<string, number> = {};

  set config(c: ColumnArithmeticConfig) {
    this.cfg = c;
    const rtl = document.documentElement.dir === 'rtl';
    const at = c.carryAt && c.carryAt !== 'auto' ? c.carryAt : this.dataset.carry ?? (rtl ? 'above' : 'below');
    const ph = c.placeholder && c.placeholder !== 'auto' ? c.placeholder : this.dataset.placeholder ?? 'zero';
    this.above = at !== 'below';
    this.zero = ph === 'zero';
    this.dataset.caCarry = at;
    this.build();
  }

  get state() {
    const s0 = this.sheets[0];
    const r = this.boxes.filter((b) => b.sh === s0 && b.c.row === 'r').sort((a, b) => b.c.col - a.c.col);
    let answer = r.map((b) => asciiDigits(b.el.value) || '_').join('');
    const k = s0.p.scale;
    if (k && answer.length > k) answer = answer.slice(0, -k) + '.' + answer.slice(-k);
    return { stepsCorrect: this.boxes.every((b) => b.ok), answer, aligned: this.aligned, wrong: this.wrong, revealed: this.revealed, errors: { ...this.errors } };
  }

  private get aligned() { return this.shift === this.target; }

  private d(n: number | string) {
    const digits = this.dataset.digits ?? '0123456789';
    return String(n).replace(/[0-9]/g, (x) => digits[+x]).replace(/\./g, this.dataset.decimal ?? '.');
  }

  private lbl(key: string, fallback: string, vars: Record<string, number | string> = {}) {
    return (this.dataset[key] ?? fallback).replace(/\{(\w)\}/g, (_, k: string) => this.d(vars[k] ?? ''));
  }

  private place(p: Plan, col: number, short = false) {
    const k = col - p.ones;
    // Labels come from the studio's locale file (label-places, label-dec-places, label-place-names, label-dec-names).
    const list = (this.dataset['label' + (k < 0 ? 'Dec' : short ? '' : 'Place') + (short ? 'Places' : 'Names')] ?? '').split('|');
    return list[k < 0 ? -k - 1 : k] || this.d(10 ** k);
  }

  private build() {
    const c = this.cfg;
    this.boxes = [];
    this.shown = [];
    this.movers = [];
    this.sheets = [];
    const p = plan(c.op, c.terms, { placeholder: this.zero ? 'zero' : 'shift' });
    // Lining up: the last number starts under the first one's last digit.
    const last = c.terms.length - 1;
    this.target = p.scale - parseNum(c.terms[last]).scale;
    this.shift = c.align && c.op !== 'mul' ? p.scale - parseNum(c.terms[0]).scale : this.target;
    this.maxShift = Math.max(this.shift, this.target);
    const main = this.sheet(p, 0, c.op, c.terms);
    const parts: HTMLElement[] = [main.el];
    const inv = c.inverse ? inverse(c.op, c.terms, p.answer) : null;
    if (inv) {
      const s = this.sheet(plan(inv.op, inv.terms), p.steps, inv.op, inv.terms);
      const t = document.createElement('p');
      t.className = 'kg-ca-inv';
      t.textContent = this.dataset.labelInverse ?? 'Check';
      s.el.prepend(t);
      s.el.classList.add('kg-ca-check');
      this.shown.push({ el: s.el, from: p.steps });
      parts.push(s.el);
    }

    const tools = document.createElement('div');
    tools.className = 'kg-ca-tools';
    if (!this.aligned) {
      const a = (this.alignBox = document.createElement('div'));
      a.className = 'kg-ca-align';
      a.dir = 'ltr';
      for (const [g, k, dv] of [['◀', 'labelLeft', 1], ['▶', 'labelRight', -1]] as const) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary';
        b.textContent = g;
        b.setAttribute('aria-label', this.dataset[k] ?? g);
        b.addEventListener('click', () => this.move(dv));
        a.append(b);
      }
      tools.append(a);
    }
    this.ask = document.createElement('p');
    this.ask.className = 'kg-ca-ask';
    this.ask.setAttribute('aria-live', 'polite');
    this.status = document.createElement('p');
    this.status.className = 'kg-ca-status';
    this.status.setAttribute('role', 'status');
    this.revealBtn = document.createElement('button');
    this.revealBtn.type = 'button';
    this.revealBtn.className = 'secondary kg-ca-reveal';
    this.revealBtn.textContent = this.dataset.labelReveal ?? '?';
    this.revealBtn.addEventListener('click', () => { this.revealStep('shown'); this.revealed++; this.after(); });
    tools.append(this.ask, this.revealBtn, this.status);
    this.replaceChildren(...parts, tools);
    this.place0();
    while (this.aligned && this.current() < Math.min(c.given ?? 0, this.total())) this.revealStep('given');
    this.update();
  }

  private total() { return this.sheets.reduce((n, s) => n + s.p.steps, 0); }

  /** Render one sheet; `off` is the number of global steps before it. */
  private sheet(p: Plan, off: number, op: Op, terms: (number | string)[]): Sheet {
    const main = !this.sheets.length;
    const sh: Sheet = { p, off, tops: [], marks: [], el: document.createElement('div') };
    if (p.top) sh.vals = p.top.slice();
    this.sheets.push(sh);
    const header = !!this.cfg.header && main;
    const lastT = p.operands.length - 1;
    const W = Math.max(p.width, main ? p.operands[lastT].ds.length - this.target + this.maxShift : 0);
    const has = (r: string) => p.cells.some((c) => c.row === r);
    const multi = p.partials.length > 1;
    // Rows top to bottom, with their heights.
    const rows: [string, string][] = [];
    if (header) rows.push(['h', '30px']);
    if (op === 'sub') rows.push(['m', '26px']);
    if (this.above && p.cells.some((c) => c.row.startsWith('pc'))) rows.push(['ca', '44px']);
    if (this.above && !multi && has('c')) rows.push(['c', '44px']);
    p.operands.forEach((_, i) => rows.push([`t${i}`, '44px']));
    if (multi) {
      if (this.above && has('c')) rows.push(['c', '44px']);
      p.partials.forEach((x, k) => {
        rows.push([x.row, '44px']);
        if (!this.above && has(`pc${k}`)) rows.push([`pc${k}`, '44px']);
      });
    }
    rows.push(['r', '44px']);
    if (!this.above && has('c')) rows.push(['c', '44px']);
    const R = (name: string) => 1 + rows.findIndex((r) => r[0] === (this.above && name.startsWith('pc') ? 'ca' : name));

    const g = sh.el;
    g.className = 'kg-ca-sheet';
    g.dir = 'ltr';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', this.d(terms.join(` ${SIGN[op]} `)));
    g.style.gridTemplateColumns = `var(--ca-s) repeat(${W}, var(--ca-c))`;
    g.style.gridTemplateRows = rows.map((r) => r[1]).join(' ');
    g.style.setProperty('--ca-n', String(W));
    const X = (col: number) => 2 + (W - 1 - col);
    const put = <T extends HTMLElement>(el: T, row: number, col: number, from = 0, span = 1) => {
      el.style.gridArea = `${row} / ${col} / span 1 / span ${span}`;
      g.append(el);
      if (from) this.shown.push({ el, from: off + from });
      return el;
    };
    const span = (s: string, cls: string) => {
      const e = document.createElement('span');
      e.className = cls;
      e.textContent = s;
      e.setAttribute('aria-hidden', 'true');
      return e;
    };

    if (header) {
      g.classList.add('kg-ca-table');
      for (let col = 0; col < W; col++) {
        put(span('', 'kg-ca-line'), 1, X(col)).style.gridRow = '1 / -1';
        put(span(this.place(p, col, true), 'kg-ca-h'), 1, X(col));
      }
    }

    // The numbers. In subtraction the top digits are buttons: tap one to borrow from it.
    p.operands.forEach((o, i) => {
      const row = R(`t${i}`);
      const mover = main && i === lastT && !this.aligned;
      o.ds.forEach((dg, col) => {
        if (dg == null) return;
        let el: HTMLElement;
        if (op === 'sub' && i === 0) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'kg-ca-top' + (o.pad[col] ? ' kg-ca-pad' : '');
          b.textContent = this.d(dg);
          b.addEventListener('click', () => this.borrow(sh, col));
          sh.tops[col] = b;
          const m = put(span('', 'kg-ca-mark'), R('m'), X(col));
          sh.marks[col] = m;
          el = b;
        } else el = span(this.d(dg), 'kg-ca-d' + (o.pad[col] ? ' kg-ca-pad' : ''));
        put(el, row, X(col));
        if (mover) this.movers.push({ el, i: col - this.target, pad: o.pad[col] });
        else if (main && o.pad[col]) this.movers.push({ el, i: -1, pad: true });
      });
      if (o.mark >= 0) {
        const m = put(span(this.dataset.decimal ?? '.', 'kg-ca-mk'), row, X(o.mark));
        if (mover) this.movers.push({ el: m, i: o.mark - this.target });
      }
    });
    put(span(SIGN[op], 'kg-ca-d kg-ca-sign'), R(`t${lastT}`), 1);
    put(span('', 'kg-ca-rule'), R(`t${lastT}`), 1, 0, W + 1);
    if (op !== 'mul' && p.scale) put(span(this.dataset.decimal ?? '.', 'kg-ca-mk'), R('r'), X(p.ones));
    if (multi) {
      const lastP = p.partials[p.partials.length - 1].row;
      const sumFrom = Math.min(...p.cells.filter((c) => c.row === 'r').map((c) => c.step));
      put(span('+', 'kg-ca-d kg-ca-sign'), R(lastP), 1, sumFrom);
      put(span('', 'kg-ca-rule'), R(!this.above && has(`pc${p.partials.length - 1}`) ? `pc${p.partials.length - 1}` : lastP), 1, sumFrom, W + 1);
    }

    // Boxes, in step order. Each row of boxes appears when its first step starts.
    const start: Record<string, number> = {};
    for (const c of p.cells) start[c.row] = Math.min(start[c.row] ?? Infinity, c.step);
    const L = (k: string, f: string, c: Cell, n?: number) => this.lbl(k, f, { p: this.place(p, c.col), n: n ?? '' });
    for (const c of p.cells) {
      if (c.kind === 'c' && this.cfg.carries === 'hide') continue;
      const el = document.createElement('input');
      el.className = 'kg-ca-box' + (c.kind === 'c' ? ' kg-ca-carry' : '');
      el.inputMode = 'numeric';
      el.autocomplete = 'off';
      el.dir = 'ltr';
      const k = c.row[0] === 'p' ? +c.row.replace(/\D/g, '') : -1;
      el.setAttribute('aria-label', c.kind === 'c' ? L('labelCarry', '+ {p}', c) : c.row === 'r' ? L('labelResult', '{p}', c) : L('labelPartial', '{n}: {p}', c, k + 1));
      const b: Box = { el, c, sh, g: off + c.step, ok: false };
      el.addEventListener('input', () => this.onInput(b));
      el.addEventListener('focus', () => this.showAsk(b));
      el.addEventListener('keydown', (e) => this.onKey(e, b));
      this.boxes.push(b);
      put(el, R(c.row), X(c.col));
      if (c.kind === 'c') {
        this.shown.push({ el, from: off + c.step, dep: this.boxes.find((x) => x.sh === sh && x.c.step === c.step && x.c.kind !== 'c') });
        if (this.above && c.row.startsWith('pc')) {
          // One carry row above the top number, reused by each partial product in turn.
          const nx = p.partials[k + 1]?.row ?? 'r';
          this.shown[this.shown.length - 1].until = off + (start[nx] ?? Infinity);
        }
      } else if (start[c.row]) this.shown.push({ el, from: off + start[c.row] });
    }
    return sh;
  }

  /** Put the movable (last) number at the current shift. */
  private place0() {
    const s = this.sheets[0];
    const W = Number(s.el.style.getPropertyValue('--ca-n'));
    for (const m of this.movers) {
      if (m.i >= 0) m.el.style.gridColumnStart = String(2 + (W - 1 - (m.i + this.shift)));
      m.el.hidden = !!m.pad && !this.aligned;
    }
  }

  private move(dv: number) {
    const W = Number(this.sheets[0].el.style.getPropertyValue('--ca-n'));
    this.shift = Math.max(0, Math.min(W - 1 - Math.max(...this.movers.map((m) => m.i)), this.shift + dv));
    this.place0();
    if (this.aligned) {
      this.alignBox!.hidden = true;
      this.update();
      this.say(this.dataset.labelAligned ?? '✓', 'ok');
      this.boxes.find((b) => !b.ok)?.el.focus();
    } else this.say('');
    this.changed();
  }

  private say(t: string, cls = '') {
    this.status.textContent = t;
    this.status.className = 'kg-ca-status ' + cls;
  }

  private fill(b: Box, cls: string) {
    b.el.value = this.d(b.c.want);
    b.ok = true;
    b.el.readOnly = true;
    b.el.classList.remove('no');
    b.el.classList.add('ok', cls);
    b.el.removeAttribute('aria-invalid');
    if (this.cfg.carries === 'show') for (const x of this.boxes) if (x.g === b.g && x.c.kind === 'c' && !x.ok) this.fill(x, 'given');
  }

  /** Global step of the first unfilled box (total when all are done). */
  private current() {
    return this.boxes.find((x) => !x.ok)?.g ?? this.total();
  }

  private update() {
    const cur = this.current();
    for (const s of this.shown) s.el.hidden = s.from > cur || (s.until !== undefined && cur >= s.until) || (!!s.dep && !s.dep.ok);
    for (const b of this.boxes) b.el.disabled = !b.ok && (b.g !== cur || !this.aligned);
    const done = cur >= this.total();
    this.revealBtn.hidden = done || !this.aligned;
    if (!this.aligned) {
      this.ask.textContent = this.dataset.labelAlignAsk ?? '◀ ▶';
    } else if (done) {
      this.ask.textContent = '';
      this.say(this.dataset.labelDone ?? '✓', 'ok');
    } else {
      const next = this.boxes.find((x) => !x.ok);
      if (next && !this.contains(document.activeElement)) this.showAsk(next);
    }
    for (const s of this.sheets) this.marks(s);
  }

  private marks(s: Sheet) {
    if (!s.vals) return;
    const p = s.p;
    s.tops.forEach((b, col) => {
      if (!b) return;
      const v = s.vals![col];
      const x = v !== p.top![col];
      b.classList.toggle('x', x);
      s.marks[col].textContent = x ? this.d(v) : '';
      b.setAttribute('aria-label', this.lbl('labelBorrow', '{p} {v}', { p: this.place(p, col), v }));
    });
  }

  private showAsk(b: Box) {
    if (b.ok || !this.aligned) return;
    const c = b.c;
    let text: string;
    let ltr = true;
    if (c.kind === 'c') { text = this.lbl('labelAskCarry', '{s}', { s: c.s! }); ltr = false; }
    else if (c.kind === 'z') { text = this.lbl('labelAskZero', '0'); ltr = false; }
    else if (b.sh.vals) {
      const t = b.sh.vals[c.col];
      const bt = b.sh.p.bottom![c.col];
      ltr = t >= bt;
      text = ltr ? this.lbl('labelAskSum', '{e} = ?', { e: `${t} − ${bt}` }) : this.lbl('labelAskBorrow', '{t} < {b}', { t, b: bt });
    } else text = this.lbl('labelAskSum', '{e} = ?', { e: c.expr ?? String(c.want) });
    this.ask.replaceChildren();
    const e = document.createElement('bdi');
    if (ltr) e.dir = 'ltr';
    e.textContent = text;
    this.ask.append(e);
  }

  private msg(code: Code) {
    const k = 'labelErr' + code.replace(/(^|-)(\w)/g, (_, __, ch: string) => ch.toUpperCase());
    return this.dataset[k] ?? this.dataset.labelWrong ?? '✗';
  }

  private onInput(b: Box) {
    if (b.ok) return;
    const v = asciiDigits(b.el.value).replace(/\D/g, '').slice(-1);
    b.el.value = this.d(v);
    this.say('');
    if (!v) {
      b.el.classList.remove('no');
      b.el.removeAttribute('aria-invalid');
    } else {
      const t = +v;
      const s = b.sh;
      const r = s.vals && b.c.kind === 'd' ? subDigit(s.vals, s.p.top!, s.p.bottom!, b.c.col, t) : t === b.c.want ? { ok: true } : { ok: false, code: diagnose(b.c, t) };
      if (r.ok) {
        this.fill(b, 'typed');
        this.update();
        this.boxes.find((x) => !x.ok && !x.el.disabled)?.el.focus();
      } else {
        const code = r.code ?? 'wrong';
        if (code !== 'mark-borrow') this.wrong++;
        this.errors[code] = (this.errors[code] ?? 0) + 1;
        b.el.classList.add('no');
        b.el.setAttribute('aria-invalid', 'true');
        this.say(this.msg(code));
        b.el.select();
      }
    }
    this.changed();
  }

  private borrow(s: Sheet, col: number) {
    const cur = this.boxes.find((x) => !x.ok);
    const code = cur && cur.sh === s && this.aligned ? tapBorrow(s.vals!, s.p.bottom!, cur.c.col, col) : 'no-borrow';
    if (code) {
      this.errors[code] = (this.errors[code] ?? 0) + 1;
      this.say(this.msg(code));
    } else {
      this.say('');
      this.marks(s);
      // A digit typed before the borrow was written may be right now.
      if (cur!.el.value) this.onInput(cur!);
      if (borrowFrom(s.vals!, s.p.bottom!, cur!.c.col) < 0 && !cur!.ok) cur!.el.focus();
      if (!cur!.ok) this.showAsk(cur!);
    }
    this.changed();
  }

  private revealStep(cls: string) {
    const k = this.current();
    for (const b of this.boxes) {
      if (b.g !== k || b.ok) continue;
      const s = b.sh;
      if (s.vals && b.c.kind === 'd') for (let j: number; (j = borrowFrom(s.vals, s.p.bottom!, b.c.col)) >= 0; ) tapBorrow(s.vals, s.p.bottom!, b.c.col, j);
      this.fill(b, cls);
    }
  }

  private after() {
    this.update();
    this.boxes.find((x) => !x.ok)?.el.focus();
    this.changed();
  }

  private onKey(e: KeyboardEvent, b: Box) {
    const i = this.boxes.indexOf(b);
    const ok = (x?: Box) => x && !x.el.hidden && !x.el.disabled;
    const same = (dc: number) => this.boxes.find((x) => x.sh === b.sh && x.c.row === b.c.row && x.c.col === b.c.col + dc);
    let t: Box | undefined;
    if (e.key === 'ArrowLeft') t = same(1);
    else if (e.key === 'ArrowRight') t = same(-1);
    else if (e.key === 'ArrowDown') t = this.boxes.slice(i + 1).find(ok);
    else if (e.key === 'ArrowUp' || (e.key === 'Backspace' && !b.el.value)) t = this.boxes.slice(0, i).reverse().find(ok);
    else if (e.key === 'Enter') t = this.boxes.find((x) => !x.ok && ok(x));
    if (ok(t)) {
      e.preventDefault();
      t!.el.focus();
    }
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }
}

customElements.define('kg-column-arithmetic', ColumnArithmetic);

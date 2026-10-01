// <kg-long-division>: written long division, filled in digit by digit.
// Contract: docs/STUDIOS.md ("Engine contract"). Layouts: docs/NOTATION.md §3.
//   gallows (fa-IR, fa-AF, ps): dividend left, divisor top-right behind a bar, quotient under the divisor.
//   busstop (en): divisor left of the bracket, quotient on top.
// The whole sheet is LTR (dividend on the left) in every locale, as in both countries' books.
import { asciiDigits } from '../lib/fraction';
import { longDivision, type LDPlan } from '../lib/long-division';

export interface LongDivisionConfig {
  dividend: number;
  divisor: number;
  /** Continue to at most this many decimal places (fraction → decimal). */
  decimals?: number;
  layout?: 'auto' | 'gallows' | 'busstop';
  /** Number of steps already filled in, as a worked start. */
  given?: number;
}

type Part = 'q' | 'p' | 'r';
interface Box { el: HTMLInputElement; want: string; step: number; part: Part; ok: boolean }
interface Shown { el: HTMLElement; from: number }

export class LongDivision extends HTMLElement {
  private plan!: LDPlan;
  private boxes: Box[] = [];
  private shown: Shown[] = [];
  private ask!: HTMLElement;
  private status!: HTMLElement;
  private revealBtn!: HTMLButtonElement;
  private wrong = 0;
  private revealed = 0;

  set config(c: LongDivisionConfig) {
    this.plan = longDivision(c.dividend, c.divisor, c.decimals ?? 0);
    const l = c.layout && c.layout !== 'auto' ? c.layout : this.dataset.layout;
    // Not yet attached when config is set, so the page direction comes from <html dir>.
    const layout = l === 'gallows' || l === 'busstop' ? l : document.documentElement.dir === 'rtl' ? 'gallows' : 'busstop';
    this.dataset.ldLayout = layout;
    this.render(layout, c.given ?? 0);
  }

  get state() {
    const q = this.boxes.filter((b) => b.part === 'q');
    const firstDec = this.plan.steps.findIndex((s) => s.pos >= this.plan.intLen);
    const quotient = q.map((b, i) => (i === firstDec && i > 0 ? '.' : '') + asciiDigits(b.el.value)).join('');
    return { stepsCorrect: this.boxes.every((b) => b.ok), quotient, wrong: this.wrong, revealed: this.revealed };
  }

  private d(n: number | string) {
    const digits = this.dataset.digits ?? '0123456789';
    return String(n).replace(/[0-9]/g, (x) => digits[+x]);
  }

  private lbl(key: string, fallback: string, vars: Record<string, number> = {}) {
    return (this.dataset[key] ?? fallback).replace(/\{(\w)\}/g, (_, k: string) => this.d(vars[k] ?? ''));
  }

  private render(layout: 'gallows' | 'busstop', given: number) {
    const p = this.plan;
    const gallows = layout === 'gallows';
    const dec = p.decimals > 0;
    const W = p.digits.length + (dec ? 1 : 0);
    const D = String(p.divisor).length;
    const firstDec = p.steps.findIndex((s) => s.pos >= p.intLen);
    const nQ = p.steps.length + (dec ? 1 : 0);
    const w = (i: number) => i + (dec && i >= p.intLen ? 1 : 0);
    const mark = this.dataset.decimal ?? '.';

    // Column tracks (1-based grid lines), all LTR.
    const tracks: string[] = [];
    let col: (i: number) => number, sideCol = 0, barCol: number;
    const work = () => { for (let k = 0; k < W; k++) tracks.push(dec && k === p.intLen ? 'var(--ld-m)' : 'var(--ld-c)'); };
    if (gallows) {
      tracks.push('var(--ld-s)');
      work();
      tracks.push('var(--ld-b)');
      barCol = W + 2;
      sideCol = W + 3;
      for (let j = 0; j < Math.max(D, nQ); j++) tracks.push(dec && j === firstDec && j >= D ? 'var(--ld-m)' : 'var(--ld-c)');
      col = (i) => 2 + w(i);
    } else {
      for (let j = 0; j < D; j++) tracks.push('var(--ld-c)');
      tracks.push('var(--ld-b)');
      barCol = D + 1;
      work();
      col = (i) => D + 2 + w(i);
    }
    const base = gallows ? 1 : 2; // grid row of the dividend

    const sheet = document.createElement('div');
    sheet.className = 'kg-ld-sheet';
    sheet.dir = 'ltr';
    sheet.setAttribute('role', 'group');
    sheet.setAttribute('aria-label', this.lbl('labelSheet', '{a} ÷ {b}', { a: p.dividend, b: p.divisor }));
    sheet.style.gridTemplateColumns = tracks.join(' ');
    const nDigitCols = tracks.filter((t) => t === 'var(--ld-c)').length;
    sheet.style.setProperty('--ld-n', String(nDigitCols));
    this.boxes = [];
    this.shown = [];

    const put = (el: HTMLElement, row: number, c: number, from = 0, span = 1) => {
      el.style.gridArea = `${row} / ${c} / span 1 / span ${span}`;
      sheet.append(el);
      this.shown.push({ el, from });
      return el;
    };
    const txt = (s: string, cls = 'kg-ld-d') => {
      const e = document.createElement('span');
      e.className = cls;
      e.textContent = s;
      e.setAttribute('aria-hidden', 'true');
      return e;
    };
    const rule = (row: number, c1: number, c2: number, from: number, cls = 'kg-ld-rule') =>
      put(txt('', cls), row, c1, from, c2 - c1 + 1);
    const box = (row: number, c: number, want: number, step: number, part: Part, label: string) => {
      const el = document.createElement('input');
      el.className = 'kg-ld-box';
      el.inputMode = 'numeric';
      el.autocomplete = 'off';
      el.dir = 'ltr';
      el.setAttribute('aria-label', label);
      const b: Box = { el, want: String(want), step, part, ok: false };
      if (step < given) this.fill(b, 'given');
      el.addEventListener('input', () => this.onInput(b));
      el.addEventListener('focus', () => this.showAsk(b));
      el.addEventListener('keydown', (e) => this.onKey(e, b));
      this.boxes.push(b);
      return put(el, row, c, step);
    };
    const stepOf = (pos: number) => p.steps.findIndex((s) => s.pos === pos);

    // Divisor, dividend and the frame.
    const divDigits = String(p.divisor).split('');
    divDigits.forEach((ch, j) => put(txt(this.d(ch)), base, gallows ? sideCol + j : 1 + j));
    p.digits.forEach((dg, i) => put(txt(this.d(dg), i >= p.intLen ? 'kg-ld-d kg-ld-added' : 'kg-ld-d'), base, col(i), i >= p.intLen ? stepOf(i) : 0));
    if (dec) put(txt(mark, 'kg-ld-d kg-ld-mark'), base, col(p.intLen) - 1, firstDec);
    if (gallows) {
      put(txt('', 'kg-ld-bar'), 1, barCol, 0).style.gridRow = '1 / span 2';
      rule(1, sideCol, sideCol + Math.max(D, nQ) - 1, 0, 'kg-ld-rule kg-ld-divrule');
    } else {
      put(txt('', 'kg-ld-bracket'), 2, barCol, 0);
      rule(2, barCol + 1, barCol + W, 0, 'kg-ld-over');
    }

    const L = {
      q: this.dataset.labelQuotient ?? 'quotient',
      p: this.dataset.labelProduct ?? 'product',
      r: this.dataset.labelRemainder ?? 'remainder',
      step: this.dataset.labelStep ?? 'step',
      digit: this.dataset.labelDigit ?? 'digit',
    };
    const name = (part: Part, k: number, i: number, n: number) =>
      `${L[part]} – ${L.step} ${this.d(k + 1)}` + (n > 1 ? ` – ${L.digit} ${this.d(i + 1)}` : '');
    // Digits of n written so the last one sits at logical position `end`.
    const number = (n: number, row: number, end: number, k: number, part: Part) => {
      const s = String(n);
      [...s].forEach((ch, i) => box(row, col(end - s.length + 1 + i), +ch, k, part, name(part, k, i, s.length)));
      return end - s.length + 1;
    };

    let row = 0; // work row (0 = dividend) that holds the current partial
    p.steps.forEach((s, k) => {
      if (k > 0 && row > 0) put(txt(this.d(p.digits[s.pos]), 'kg-ld-d kg-ld-down'), base + row, col(s.pos), k);
      // Quotient digit (with the decimal mark when the quotient crosses the units).
      if (gallows) {
        const j = k + (dec && k >= firstDec ? 1 : 0);
        if (dec && k === firstDec) put(txt(mark, 'kg-ld-d kg-ld-mark'), 2, sideCol + j - 1, k);
        box(2, sideCol + j, s.q, k, 'q', name('q', k, 0, 1));
      } else {
        if (dec && k === firstDec) put(txt(mark, 'kg-ld-d kg-ld-mark'), 1, col(p.intLen) - 1, k);
        box(1, col(s.pos), s.q, k, 'q', name('q', k, 0, 1));
      }
      if (s.q === 0) return; // nothing to subtract: the next digit is brought down beside this partial
      const first = number(s.product, base + row + 1, s.pos, k, 'p');
      const minusCol = col(first) - 1;
      put(txt('−', 'kg-ld-d kg-ld-minus'), base + row + 1, minusCol, k);
      rule(base + row + 1, minusCol, col(s.pos), k);
      number(s.rem, base + row + 2, s.pos, k, 'r');
      row += 2;
    });

    const tools = document.createElement('div');
    tools.className = 'kg-ld-tools';
    this.ask = document.createElement('p');
    this.ask.className = 'kg-ld-ask';
    this.ask.setAttribute('aria-live', 'polite');
    this.status = document.createElement('p');
    this.status.className = 'kg-ld-status';
    this.status.setAttribute('role', 'status');
    this.revealBtn = document.createElement('button');
    this.revealBtn.type = 'button';
    this.revealBtn.className = 'secondary kg-ld-reveal';
    this.revealBtn.textContent = this.dataset.labelReveal ?? 'Show me this step';
    this.revealBtn.addEventListener('click', () => this.reveal());
    tools.append(this.ask, this.revealBtn, this.status);

    const wrap = document.createElement('div');
    wrap.className = 'kg-ld-wrap';
    wrap.append(sheet);
    this.replaceChildren(wrap, tools);
    this.update();
  }

  private fill(b: Box, cls: string) {
    b.el.value = this.d(b.want);
    b.ok = true;
    b.el.readOnly = true;
    b.el.classList.remove('no');
    b.el.classList.add('ok', cls);
    b.el.removeAttribute('aria-invalid');
  }

  /** Index of the first step with an unfilled box (steps.length when all are done). */
  private current() {
    const b = this.boxes.find((x) => !x.ok);
    return b ? b.step : this.plan.steps.length;
  }

  private update() {
    const cur = this.current();
    for (const s of this.shown) s.el.hidden = s.from > cur;
    const done = cur >= this.plan.steps.length;
    this.revealBtn.hidden = done;
    if (done) {
      this.ask.textContent = '';
      this.status.textContent = this.dataset.labelDone ?? 'Done!';
      this.status.className = 'kg-ld-status ok';
    } else {
      const next = this.boxes.find((x) => !x.ok);
      if (next && !this.contains(document.activeElement)) this.showAsk(next);
    }
  }

  private showAsk(b: Box) {
    if (b.ok) return;
    const s = this.plan.steps[b.step];
    const v = { a: s.partial, b: this.plan.divisor, q: s.q, p: s.product };
    this.ask.innerHTML = '';
    const text = b.part === 'q' ? this.lbl('labelAskQ', 'How many {b}s are in {a}?', v)
      : b.part === 'p' ? this.lbl('labelAskP', '{q} × {b} = ?', v)
      : this.lbl('labelAskR', '{a} − {p} = ?', v);
    const e = document.createElement('bdi');
    if (b.part !== 'q') e.dir = 'ltr';
    e.textContent = text;
    this.ask.append(e);
  }

  private next(from: Box) {
    const i = this.boxes.indexOf(from);
    return this.boxes.slice(i + 1).find((x) => !x.ok) ?? this.boxes.find((x) => !x.ok);
  }

  private onInput(b: Box) {
    if (b.ok) return;
    const v = asciiDigits(b.el.value).replace(/\D/g, '').slice(-1);
    b.el.value = this.d(v);
    this.status.textContent = '';
    this.status.className = 'kg-ld-status';
    if (!v) {
      b.el.classList.remove('no');
      b.el.removeAttribute('aria-invalid');
    } else if (v === b.want) {
      this.fill(b, 'typed');
      this.update();
      this.next(b)?.el.focus();
    } else {
      this.wrong++;
      b.el.classList.add('no');
      b.el.setAttribute('aria-invalid', 'true');
      this.status.textContent = this.dataset.labelWrong ?? 'Not yet. Check this digit again.';
      b.el.select();
    }
    this.changed();
  }

  private onKey(e: KeyboardEvent, b: Box) {
    const i = this.boxes.indexOf(b);
    const visible = (x?: Box) => x && !x.el.hidden;
    let t: Box | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') t = this.boxes[i + 1];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || (e.key === 'Backspace' && !b.el.value)) t = this.boxes[i - 1];
    else if (e.key === 'Enter') t = this.next(b);
    if (visible(t)) {
      e.preventDefault();
      t!.el.focus();
    }
  }

  private reveal() {
    const k = this.current();
    for (const b of this.boxes) if (b.step === k && !b.ok) this.fill(b, 'shown');
    this.revealed++;
    this.update();
    this.boxes.find((x) => !x.ok)?.el.focus();
    this.changed();
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }
}

customElements.define('kg-long-division', LongDivision);

// <kg-fact-fluency>: a short number-fact game (times tables first) with an array picture for every fact.
// Contract: docs/STUDIOS.md ("Engine contract"). Pure logic: ./lib/fact-fluency-facts.ts.
//   quiz:   a round of facts; missed facts come back later in the round and first in later rounds (spaced repetition,
//           kept on this device only). An optional gentle timer (off until the learner turns it on) never marks wrong.
//   recite: say one table in order, as in «جدول ضرب زبانی»: 1 × t, 2 × t, … while the array grows a row each time.
//   split:  one array cut by a movable line, for derived facts (6 × 7 = 5 × 7 + 1 × 7).
// Formulas are LTR islands; the array is drawn a rows of b for a × b.
import { asciiDigits } from '../lib/fraction';
import {
  Round, SIGN, answerOf, buildPool, distractors, factKey, pickRound, review, rng, tableFacts, type Fact, type Memories, type Op,
} from './lib/fact-fluency-facts';

export interface FactFluencyConfig {
  mode?: 'quiz' | 'recite' | 'split';
  op?: Op;
  /** quiz: the tables to practise. For × and ÷, tables above upTo are dropped (so [3, 11, 12] is [3] at 10 × 10). */
  tables?: number[];
  /** recite: the table to say in order. */
  table?: number;
  /** The other number runs from..upTo (default 1..upTo). */
  from?: number;
  /** Default 'auto': the locale's engine label "up-to" (10 for Iran and Afghanistan, 12 for the UK). */
  upTo?: number | 'auto';
  /** quiz: also ask the turned-around fact (default true). */
  swap?: boolean;
  /** quiz: facts in a round (default 10). */
  count?: number;
  /** When the array picture shows: always, on request (a button, and after a miss), or never. Default: help in quiz, always otherwise. */
  picture?: 'always' | 'help' | 'never';
  /** quiz: answer by choosing among this many options instead of typing (0 = keypad, the default). */
  choices?: number;
  /** quiz: offer the gentle timer switch (default true; it starts off). */
  timer?: boolean;
  /** Seconds per fact for the gentle timer (default 6, as in the UK multiplication check). */
  seconds?: number;
  /** Random seed (tests); default: a new round every time. */
  seed?: number;
  /** split: the fact [a, b] and where the line starts (after this many rows). */
  fact?: [number, number];
  split?: number;
}

const MEM = 'kamangir:facts';
const TIMER = 'kamangir:facts:timer';
const today = () => Math.floor(Date.now() / 864e5);
function load<T>(k: string, d: T): T {
  try { return JSON.parse(localStorage.getItem(k) ?? '') ?? d; } catch { return d; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: practice still works, it just is not remembered */ }
}
function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function btn(cls: string, text: string, on: () => void, label?: string) {
  const b = h('button', cls, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', on);
  return b;
}

export class FactFluency extends HTMLElement {
  private c: FactFluencyConfig = {};
  private mode: 'quiz' | 'recite' | 'split' = 'quiz';
  private upTo = 10;
  private round!: Round;
  private best = 0;
  private finished = false;
  private rand: () => number = Math.random;
  private mem: Memories = {};
  private split = 1;
  private timerOn = false;
  private slow = false;
  private timeout = 0;
  private seq = 0;
  private picShown = false;
  private els!: {
    pic: HTMLElement; q: HTMLElement; input: HTMLInputElement; msg: HTMLElement; pad: HTMLElement; choices: HTMLElement;
    prog: HTMLElement; bar: HTMLElement; help: HTMLButtonElement; list: HTMLElement; end: HTMLElement;
  };

  set config(c: FactFluencyConfig) {
    this.c = c;
    this.mode = c.mode ?? 'quiz';
    const auto = parseInt(asciiDigits(this.dataset.upTo ?? ''), 10);
    this.upTo = typeof c.upTo === 'number' ? c.upTo : auto > 0 ? auto : 10;
    this.rand = c.seed === undefined ? Math.random : rng(c.seed);
    this.mem = load<Memories>(MEM, {});
    this.timerOn = c.timer !== false && this.mode === 'quiz' && load(TIMER, false) === true;
    this.dataset.mode = this.mode;
    if (this.mode === 'split') this.renderSplit();
    else this.renderGame();
  }

  disconnectedCallback() { clearTimeout(this.timeout); }

  get state() {
    if (this.mode === 'split') {
      const [a, b] = this.c.fact ?? [6, 7];
      return { mode: this.mode, split: this.split, parts: [[this.split, b], [a - this.split, b]] };
    }
    const r = this.round;
    const f = r.current?.fact;
    return {
      mode: this.mode,
      total: r.total,
      answered: r.answered + (r.wrongNow && !r.current?.retry ? 1 : 0), // facts tried so far
      correct: Math.max(this.best, r.correct),
      done: this.finished,
      question: f ? { a: f.a, b: f.b, op: f.op } : null,
      missed: r.missed.map((m) => `${m.a}${SIGN[m.op]}${m.b}`),
      timer: this.timerOn,
    };
  }

  // ---- text helpers ----

  private d(n: number | string) {
    const digits = this.dataset.digits ?? '0123456789';
    return String(n).replace(/[0-9]/g, (x) => digits[+x]);
  }
  private formula(f: Fact, ans: number | string = answerOf(f)) {
    return `${this.d(f.a)} ${SIGN[f.op]} ${this.d(f.b)} = ${typeof ans === 'number' ? this.d(ans) : ans}`;
  }
  /** Fill el with a label template: {a} {b} {c} {g} {n} {t} are numbers, {f} is the whole fact (an LTR island). */
  private say(el: HTMLElement, key: string, fallback: string, f?: Fact, v: Record<string, number> = {}) {
    const tpl = this.dataset[key] ?? fallback;
    const vars: Record<string, number> = f ? { a: f.a, b: f.b, c: answerOf(f), ...v } : v;
    el.replaceChildren();
    tpl.split(/(\{\w\})/).forEach((part) => {
      const k = part.match(/^\{(\w)\}$/)?.[1];
      if (k === 'f' && f) {
        const b = h('bdi', 'kg-ff-f', this.formula(f));
        b.dir = 'ltr';
        el.append(b);
      } else el.append(k ? this.d(vars[k] ?? '') : part);
    });
    return el;
  }
  private text(key: string, fallback: string, f?: Fact, v?: Record<string, number>) {
    return this.say(h('span'), key, fallback, f, v).textContent!;
  }

  // ---- the array picture ----

  /** rows × cols dots, a gap after every 5 rows and columns. totals: running totals at row ends. pending: the last row is still a question. */
  private array(rows: number, cols: number, o: { totals?: boolean; pending?: boolean; split?: number } = {}) {
    const pic = h('div', 'kg-ff-array');
    pic.dir = 'ltr';
    pic.style.setProperty('--ff-cols', String(Math.max(cols, 5)));
    pic.setAttribute('role', 'img');
    pic.setAttribute('aria-label', this.text('labelArray', '{a} rows of {b}', undefined, { a: rows, b: cols }));
    if (!rows) pic.classList.add('kg-ff-none');
    for (let r = 0; r < rows; r++) {
      if (o.split === r && r > 0) pic.append(h('div', 'kg-ff-cut'));
      const row = h('div', 'kg-ff-row' + (r % 5 === 4 ? ' kg-ff-gap' : '') + (o.pending && r === rows - 1 ? ' kg-ff-new' : ''));
      if (!cols) row.classList.add('kg-ff-empty');
      for (let k = 0; k < cols; k++) row.append(h('i', k % 5 === 4 && k < cols - 1 ? 'kg-ff-g' : ''));
      if (o.totals) row.append(h('b', 'kg-ff-tot', o.pending && r === rows - 1 ? '?' : this.d((r + 1) * cols)));
      pic.append(row);
    }
    return pic;
  }

  /** The picture for any fact: × as rows; ÷ as the groups it makes; + and − as one row of two colours. */
  private picture(f: Fact, totals: boolean) {
    if (f.op === 'mul') return this.array(f.a, f.b, { totals });
    if (f.op === 'div') return this.array(f.b ? f.a / f.b : 0, f.b, { totals });
    const pic = h('div', 'kg-ff-array kg-ff-line');
    pic.dir = 'ltr';
    pic.setAttribute('role', 'img');
    pic.setAttribute('aria-label', this.formula(f));
    const n = f.op === 'add' ? f.a + f.b : f.a;
    pic.style.setProperty('--ff-cols', String(Math.min(Math.max(n, 5), 10)));
    const row = h('div', 'kg-ff-row');
    for (let k = 0; k < n; k++) row.append(h('i', (k % 5 === 4 ? 'kg-ff-g ' : '') + (f.op === 'add' ? (k >= f.a ? 'kg-ff-b' : '') : k >= f.a - f.b ? 'kg-ff-x' : '')));
    pic.append(row);
    return pic;
  }

  // ---- quiz and recite ----

  private renderGame() {
    const recite = this.mode === 'recite';
    const els = (this.els = {
      prog: h('div', 'kg-ff-prog'),
      pic: h('div', 'kg-ff-pic'),
      q: h('div', 'kg-ff-q'),
      input: h('input', 'kg-ff-in'),
      bar: h('div', 'kg-ff-bar'),
      msg: h('p', 'kg-ff-msg'),
      pad: h('div', 'kg-ff-pad'),
      choices: h('div', 'kg-ff-choices'),
      help: btn('secondary kg-ff-help', this.dataset.labelPicture ?? 'Show me a picture', () => this.showPic(true)),
      list: h('ol', 'kg-ff-list'),
      end: h('div', 'kg-ff-end'),
    });
    els.q.dir = 'ltr';
    els.msg.setAttribute('role', 'status');
    els.msg.setAttribute('aria-live', 'polite');
    els.pad.dir = 'ltr';
    els.choices.setAttribute('role', 'group');
    const inp = els.input;
    inp.inputMode = 'none'; // the on-screen keypad below; a hardware keyboard still types
    inp.autocomplete = 'off';
    inp.dir = 'ltr';
    inp.addEventListener('input', () => { inp.value = this.d(asciiDigits(inp.value).replace(/\D/g, '').slice(0, 3)); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.submit(); } });
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']) {
      const label = k === 'del' ? this.dataset.labelDelete ?? 'delete' : k === 'ok' ? this.dataset.labelOk ?? 'OK' : undefined;
      els.pad.append(btn('kg-ff-key' + (k === 'ok' ? ' kg-ff-ok' : ''), k === 'del' ? '⌫' : k === 'ok' ? '✓' : this.d(k), () => this.key(k), label));
    }
    const tools = h('div', 'kg-ff-tools');
    tools.append(els.prog);
    if (!recite && this.c.timer !== false) {
      const t = btn('kg-ff-timer', '⏱', () => {
        this.timerOn = !this.timerOn;
        save(TIMER, this.timerOn);
        t.setAttribute('aria-pressed', String(this.timerOn));
        this.startTimer();
        this.changed();
      }, this.dataset.labelTimer ?? 'Gentle timer');
      t.setAttribute('aria-pressed', String(this.timerOn));
      tools.append(t);
    }
    const play = h('div', 'kg-ff-play');
    play.append(els.pic, els.q, els.bar, els.msg, els.pad, els.choices, els.help);
    this.replaceChildren(tools, play, els.end, els.list);
    this.start();
  }

  private start() {
    const c = this.c;
    if (this.mode === 'recite') this.round = new Round(tableFacts(c.table ?? 2, c.from ?? 1, this.upTo), 0);
    else {
      const pool = buildPool({ op: c.op, tables: c.tables, from: c.from, upTo: this.upTo, swap: c.swap });
      this.round = new Round(pickRound(pool, this.mem, c.count ?? 10, today(), this.rand), 3);
    }
    this.els.list.replaceChildren();
    this.els.end.replaceChildren();
    this.els.end.hidden = true;
    this.els.msg.textContent = '';
    this.ask();
  }

  private picMode() { return this.c.picture ?? (this.mode === 'quiz' ? 'help' : 'always'); }

  private ask() {
    const { els, round } = this;
    const slot = round.current;
    this.renderProgress();
    els.input.value = '';
    els.input.classList.remove('no');
    els.input.removeAttribute('aria-invalid');
    for (const e of [els.q, els.pad, els.choices, els.help, els.pic, els.bar]) e.hidden = !slot;
    if (!slot) return this.finish();
    const f = slot.fact;
    const [x, op, y, eq] = [h('span', '', this.d(f.a)), h('span', 'kg-ff-op', SIGN[f.op]), h('span', '', this.d(f.b)), h('span', 'kg-ff-op', '=')];
    const choices = this.mode === 'quiz' ? this.c.choices ?? 0 : 0;
    els.q.replaceChildren(x, op, y, eq, choices ? h('span', 'kg-ff-in kg-ff-blank', '?') : els.input);
    els.input.setAttribute('aria-label', `${this.formula(f, '?')} – ${this.dataset.labelAnswer ?? 'answer'}`);
    els.pad.hidden = !!choices;
    els.choices.hidden = !choices;
    if (choices) {
      const opts = [answerOf(f), ...distractors(f, choices - 1, this.rand)].sort(() => this.rand() - 0.5);
      els.choices.replaceChildren(...opts.map((v) => btn('kg-ff-choice', this.d(v), () => this.submit(v))));
    }
    const mode = this.picMode();
    els.help.hidden = mode !== 'help';
    this.picShown = mode === 'always';
    if (this.mode === 'recite') {
      els.pic.replaceChildren(this.array(f.a, f.b, { totals: true, pending: true }));
    } else this.showPic(this.picShown);
    this.startTimer();
  }

  private showPic(on: boolean) {
    const f = this.round.current?.fact;
    if (!f || this.mode === 'recite') return;
    this.picShown = on;
    this.els.pic.replaceChildren(...(on && this.picMode() !== 'never' ? [this.picture(f, this.round.wrongNow)] : []));
    if (on) this.els.help.hidden = true;
  }

  private startTimer() {
    clearTimeout(this.timeout);
    this.slow = false;
    const bar = this.els.bar;
    bar.className = 'kg-ff-bar';
    bar.hidden = !this.timerOn || !this.round.current;
    if (bar.hidden) return;
    const s = this.c.seconds ?? 6;
    bar.style.setProperty('--ff-s', `${s}s`);
    void bar.offsetWidth; // restart the CSS animation
    bar.classList.add('run');
    const id = ++this.seq;
    this.timeout = window.setTimeout(() => {
      if (id !== this.seq) return;
      this.slow = true;
      bar.classList.add('out');
      this.say(this.els.msg, 'labelSlow', 'Take your time.');
    }, s * 1000);
  }

  private key(k: string) {
    const inp = this.els.input;
    const v = asciiDigits(inp.value);
    if (k === 'ok') return this.submit();
    inp.value = this.d(k === 'del' ? v.slice(0, -1) : (v + k).slice(0, 3));
  }

  private submit(given?: number) {
    const { els, round } = this;
    const slot = round.current;
    if (!slot) return;
    const v = given ?? parseInt(asciiDigits(els.input.value), 10);
    if (Number.isNaN(v)) return els.input.focus();
    const f = slot.fact;
    const firstTry = !round.wrongNow;
    const code = round.answer(v);
    const right = code === 'right';
    // Memory changes on a fact's first try only; the in-round retry of a missed fact keeps it due today, so the next round asks it first.
    if (firstTry && !slot.retry && this.mode === 'quiz') {
      this.mem[factKey(f)] = review(this.mem[factKey(f)], right, this.slow, today());
      save(MEM, this.mem);
    }
    if (right) {
      if (this.mode === 'recite') {
        const li = h('li', firstTry ? '' : 'kg-ff-fixed');
        const b = h('bdi', '', this.formula(f));
        b.dir = 'ltr';
        li.append(b);
        els.list.append(li);
      }
      this.say(els.msg, firstTry ? 'labelRight' : 'labelFixed', firstTry ? 'Yes! {f}' : 'Now you know it: {f}', f);
      els.msg.className = 'kg-ff-msg ok';
      const focus = this.contains(document.activeElement);
      this.ask();
      if (focus && !els.input.hidden) els.input.focus();
    } else {
      const fb = h('span');
      this.say(fb, 'labelFb' + code[0].toUpperCase() + code.slice(1).replace(/-(\w)/g, (_, x: string) => x.toUpperCase()), '', f, { g: v });
      if (!fb.textContent) this.say(fb, 'labelFbWrong', 'Not yet.', f, { g: v });
      els.msg.replaceChildren(fb, ' ', this.say(h('span'), 'labelRetype', 'Look at the picture and try again.', f));
      els.msg.className = 'kg-ff-msg no';
      els.input.value = '';
      els.input.classList.add('no');
      els.input.setAttribute('aria-invalid', 'true');
      if (this.mode === 'quiz' && this.picMode() !== 'never') this.showPic(true);
      if (this.mode === 'quiz') els.choices.querySelectorAll('button').forEach((b) => { if (b.textContent === this.d(v)) b.disabled = true; });
      if (this.contains(document.activeElement) && !els.pad.hidden) els.input.focus();
    }
    this.changed();
  }

  private renderProgress() {
    const r = this.round;
    const p = this.els.prog;
    p.replaceChildren();
    const pips = h('span', 'kg-ff-pips');
    pips.setAttribute('aria-hidden', 'true');
    r.facts.forEach((_, i) => pips.append(h('i', i < r.answered ? (r.missed.includes(r.facts[i]) ? 'no' : 'ok') : i === r.answered && !r.done ? 'now' : '')));
    p.append(pips, this.say(h('span', 'kg-ff-count'), 'labelProgress', '{n} of {t}', undefined, { n: r.answered, t: r.total }));
  }

  private finish() {
    clearTimeout(this.timeout);
    const { round: r, els } = this;
    this.finished = true;
    this.best = Math.max(this.best, r.correct);
    els.bar.hidden = true;
    const end = els.end;
    end.hidden = false;
    end.replaceChildren(this.say(h('p', 'kg-ff-score'), this.mode === 'recite' ? 'labelReciteDone' : 'labelDone',
      '{n} of {t} right first time.', undefined, { n: r.correct, t: r.total }));
    if (r.missed.length && this.mode === 'quiz') {
      end.append(h('p', '', this.dataset.labelPractise ?? 'Practise these again:'));
      const ul = h('ul', 'kg-ff-missed');
      for (const f of r.missed) {
        const li = h('li');
        const b = h('bdi', '', this.formula(f));
        b.dir = 'ltr';
        li.append(b, this.picture(f, false));
        ul.append(li);
      }
      end.append(ul);
    }
    end.append(btn('primary kg-ff-again', this.dataset.labelAgain ?? 'Play again', () => { this.start(); this.changed(); }));
  }

  // ---- split ----

  private renderSplit() {
    const [a, b] = this.c.fact ?? [6, 7];
    this.split = Math.min(Math.max(this.c.split ?? Math.min(5, a - 1), 1), a - 1);
    const wrap = h('div', 'kg-ff-split');
    const pic = h('div', 'kg-ff-pic');
    const parts = h('div', 'kg-ff-parts');
    parts.setAttribute('aria-live', 'polite');
    const less = btn('kg-ff-key', '−', () => move(-1), this.dataset.labelSplitUp ?? 'Move the line up');
    const more = btn('kg-ff-key', '+', () => move(1), this.dataset.labelSplitDown ?? 'Move the line down');
    const draw = () => {
      pic.replaceChildren(this.array(a, b, { split: this.split }));
      parts.replaceChildren(...[[this.split, b], [a - this.split, b]].map(([x, y]) => {
        const e = h('bdi', 'kg-ff-f', this.formula({ a: x, b: y, op: 'mul' }));
        e.dir = 'ltr';
        return e;
      }));
      less.disabled = this.split <= 1;
      more.disabled = this.split >= a - 1;
    };
    const move = (d: number) => {
      this.split = Math.min(Math.max(this.split + d, 1), a - 1);
      draw();
      this.changed();
    };
    const ctl = h('div', 'kg-ff-ctl');
    ctl.dir = 'ltr';
    ctl.append(less, parts, more);
    wrap.append(pic, ctl);
    this.replaceChildren(wrap);
    draw();
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }
}

customElements.define('kg-fact-fluency', FactFluency);

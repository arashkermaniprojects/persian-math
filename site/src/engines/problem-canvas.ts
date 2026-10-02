// <kg-problem-canvas>: a word-problem workspace for the «حل مسئله» strand. The learner says what is known and what is
// asked (Iran's step 1 «فهمیدن مسئله»), may choose a strategy (step 2), works in a matching tool (step 3: bar model,
// table, guess-and-check log, list to cross out, number sentence) and gives the answer; the studio's "why" is step 4
// («بازگشت به عقب»). Contract: docs/STUDIOS.md ("Engine contract", "Engine options → problem-canvas").
import { digitsOf, formatDecimal, type NumberFormat } from '../lib/display';
import { parseNum } from './lib/problem-canvas-expr';
import { hops } from './lib/problem-canvas-pattern';
import {
  computeRow, partWidths, shortShare, tryGuess, type CanvasState, type GuessCol, type GuessRow, type TableCol, type ToolState, type Val,
} from './lib/problem-canvas-model';

/** A fact in the problem (label `fact-<id>`); `n` puts its number on the tools' number trays. */
export interface Fact { id: string; n?: number }

interface ToolBase {
  /** Show this tool only when that strategy is chosen (with `strategies`). */
  for?: string;
  /** Numbers to place (default: the facts' numbers). A "?" (□ in sentences) is always offered. */
  tray?: number[];
}
export interface BarConfig extends ToolBase {
  kind: 'bar';
  /** part-whole: a whole over its parts; compare: two rows, the learner says who has more, and the difference; groups: equal parts. */
  model?: 'part-whole' | 'compare' | 'groups';
  /** part-whole/groups: number of parts (default 2); `resize` shows −/+ (1 … maxParts, default 10). */
  parts?: number;
  resize?: boolean;
  maxParts?: number;
  /** Slots filled in advance and locked: whole, parts (null = open), d (difference), more (row that is longer). */
  given?: { whole?: number | '?'; parts?: (number | '?' | null)[]; d?: number | '?'; more?: 0 | 1 };
  /** compare: the two rows' captions (labels `name-<key>`). */
  names?: [string, string];
  /** Unit squares inside segments of up to 30 (Iran G1–2: simple shapes, not drawings). */
  units?: boolean;
}
export interface TableConfig extends ToolBase {
  kind: 'table';
  /** Columns (label `col-<key>`): `given` values by row (null = typed by the learner), or `expr` = worked out for them. */
  cols: (TableCol & { given?: (number | null)[] })[];
  rows?: number;
  /** An "add a row" button, up to maxRows (default 12). */
  extend?: boolean;
  maxRows?: number;
  /** Column indexes that show the hop from the row above (+۳), for finding a pattern. */
  hops?: number[];
}
export interface GuessConfig extends ToolBase {
  kind: 'guess';
  /** Columns worked out from the guess x and earlier columns (label `col-<key>`; the guess column is `col-x`). */
  cols?: GuessCol[];
  /** Compared with column `of` (default the last, or the guess itself). */
  target?: number;
  of?: string;
}
export interface ListConfig extends ToolBase { kind: 'list'; /** Numbers, or label keys (`item-<key>`). */ items: (number | string)[] }
export interface SentenceConfig extends ToolBase {
  kind: 'sentence';
  /** Slots, space-separated: _ = a number from the tray, o = an operation (tap to change), = / numbers / ? fixed. */
  form?: string;
  ops?: string[];
  /** Ask for the box's value; it then joins later sentences' trays (sub-problems). */
  solve?: boolean;
}
export type ToolConfig = BarConfig | TableConfig | GuessConfig | ListConfig | SentenceConfig;

export interface CanvasConfig {
  /** Icon hint + label `instruction-<key>`. */
  instruction?: string;
  /** Step 1: facts to mark as known (distractors included), and questions to pick from (labels `ask-<id>`). */
  understand?: { known?: (Fact | string)[]; asked?: string[] };
  /** Step 2: strategy cards (labels `strategy-<id>`): draw, model, pattern, eliminate, guess, sub, simpler, symbolic. */
  strategies?: string[];
  tools?: ToolConfig[];
  /** The answer: label `answer-<key>` (else `label-answer`) with {n} where the number goes; `pick` = number tiles. */
  answer?: { key?: string; pick?: [number, number] };
}

interface Tool {
  cfg: ToolConfig;
  whole: Val; parts: Val[]; d: Val; more: 0 | 1 | null; locked: Set<string>;
  rows: (number | null)[][];
  guesses: GuessRow[];
  crossed: Set<number>;
  /** Sentence tokens and each slot's kind: _ (number), o (operation), f (fixed). */
  tokens: (string | null)[]; kinds: string[]; solved: number | null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const isNum = (v: unknown): v is number => typeof v === 'number';
const OPS = ['+', '-', '×', '÷'];
const sym = (t: string) => (t === '-' ? '−' : t === '?' ? '□' : t);

export class ProblemCanvas extends HTMLElement {
  private cfg: CanvasConfig = {};
  private tools: Tool[] = [];
  private known = new Set<string>();
  private asked: string | null = null;
  private strategy: string | null = null;
  private answer: number | null = null;
  /** The tray value picked up for placing: [tool, value]. */
  private held: [number, string] | null = null;
  private built = false;

  set config(c: CanvasConfig) {
    this.cfg = c;
    this.known = new Set();
    this.asked = this.strategy = this.answer = this.held = null;
    this.tools = (c.tools ?? []).map((t) => this.init(t));
    if (this.built) this.render();
  }

  private init(t: ToolConfig): Tool {
    const s: Tool = { cfg: t, whole: null, parts: [], d: null, more: null, locked: new Set(), rows: [], guesses: [], crossed: new Set(), tokens: [], kinds: [], solved: null };
    if (t.kind === 'bar') {
      const g = t.given ?? {};
      s.parts = Array.from({ length: t.model === 'compare' ? 2 : t.parts ?? 2 }, (_, i) => g.parts?.[i] ?? null);
      s.parts.forEach((v, i) => v !== null && s.locked.add('p' + i));
      if (g.whole !== undefined) s.locked.add('w'), (s.whole = g.whole);
      if (g.d !== undefined) s.locked.add('d'), (s.d = g.d);
      s.more = g.more ?? null;
    } else if (t.kind === 'table') {
      const n = Math.max(t.rows ?? 3, ...t.cols.map((c) => c.given?.length ?? 0));
      s.rows = Array.from({ length: n }, (_, r) => computeRow(t.cols.map((c) => c.given?.[r] ?? null), t.cols));
    } else if (t.kind === 'sentence') {
      const f = (t.form ?? '_ o _ = _').split(/\s+/);
      s.kinds = f.map((x) => (x === '_' || x === 'o' ? x : 'f'));
      s.tokens = f.map((x) => (x === '_' ? null : x === 'o' ? (t.ops ?? OPS)[0] : x));
    }
    return s;
  }

  get state(): CanvasState {
    return {
      known: [...this.known],
      asked: this.asked,
      strategy: this.strategy,
      answer: this.answer,
      tools: this.tools.map((t): ToolState => {
        const c = t.cfg, shown = this.shown(c);
        if (c.kind === 'bar') {
          const model = c.model ?? 'part-whole';
          return { kind: 'bar', model, whole: t.whole, parts: [...t.parts], ...(model === 'compare' ? { d: t.d, more: t.more } : {}), shown };
        }
        if (c.kind === 'table') return { kind: 'table', cols: c.cols.map((x) => x.key), rows: t.rows.map((r) => [...r]), shown };
        if (c.kind === 'guess') return { kind: 'guess', guesses: [...t.guesses], found: t.guesses.some((g) => g.cmp === 0), shown };
        if (c.kind === 'list') return { kind: 'list', items: c.items, crossed: [...t.crossed].sort((a, b) => a - b), shown };
        return { kind: 'sentence', tokens: [...t.tokens], solved: t.solved, shown };
      }),
    };
  }

  private shown = (c: ToolConfig) => !c.for || !this.cfg.strategies || c.for === this.strategy;

  private get fmt(): NumberFormat {
    return { digits: this.dataset.digits ?? '0123456789', decimal: this.dataset.decimal ?? '.' };
  }
  /** Numbers for display (locale digits and decimal mark) and in input boxes (no markup). */
  private n = (v: number) => formatDecimal(v, this.fmt);
  private d = (v: number) => digitsOf(v, this.fmt);
  private nIn = (v: number | null) => (v === null ? '' : digitsOf(String(v).replace('.', this.fmt.decimal), this.fmt));
  /** A studio label (data-* attribute), escaped, with an English fallback. */
  private lab = (k: string, en = '') => esc(this.dataset[camel(k)] ?? en);
  private v = (x: Val) => (x === null ? '' : x === '?' ? this.lab('mark-unknown', '?') : this.n(x));
  private say = (x: Val) => (x === null ? this.lab('label-empty', 'empty') : x === '?' ? this.lab('label-unknown', 'unknown') : String(x));

  /** A button that acts on tool `ti` with value `v`; `k` keeps focus on it across redraws. */
  private b(a: string, ti: number, v: string | number, inner: string, cls: string, attrs = '') {
    return `<button type="button" class="${cls}" data-a="${a}" data-t="${ti}" data-v="${esc(String(v))}" data-k="${a}${ti}.${esc(String(v))}"${attrs}>${inner}</button>`;
  }
  private input(a: string, ti: number, k: string, label: string, v: number | null, extra = '') {
    return `<input class="kg-pc-in" inputmode="decimal" autocomplete="off" data-a="${a}" data-t="${ti}" data-k="${a}${ti}.${k}"${extra} aria-label="${label}" value="${this.nIn(v)}">`;
  }

  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button[data-a]');
      if (b && this.contains(b)) this.act(b.dataset);
    });
    this.addEventListener('input', (e) => this.typed(e.target as HTMLInputElement, false));
    this.addEventListener('change', (e) => this.typed(e.target as HTMLInputElement, true));
    this.addEventListener('keydown', (e) => {
      const i = e.target as HTMLInputElement;
      if (e.key === 'Enter' && i.dataset.a === 'gx') e.preventDefault(), this.act({ a: 'try', t: i.dataset.t });
    });
    this.render();
  }

  private emit() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  /** Typing in a cell, the answer or the box: the state follows each key; the view redraws when they leave the box. */
  private typed(i: HTMLInputElement, done: boolean) {
    const d = i.dataset, t = this.tools[Number(d.t)];
    const v = parseNum(i.value, this.fmt.decimal);
    if (d.a === 'answer') this.answer = v;
    else if (d.a === 'cell' && t) {
      const r = Number(d.r);
      t.rows[r][Number(d.c)] = v;
      t.rows[r] = computeRow(t.rows[r], (t.cfg as TableConfig).cols);
    } else if (d.a === 'solve' && t) t.solved = v;
    else return;
    if (done) this.render();
    this.emit();
  }

  private act(d: DOMStringMap) {
    const a = d.a!, ti = Number(d.t), t = this.tools[ti], val = d.v ?? '';
    if (a === 'known') this.known.has(val) ? this.known.delete(val) : this.known.add(val);
    else if (a === 'asked') this.asked = val;
    else if (a === 'strategy') (this.strategy = val), (this.held = null);
    else if (a === 'pick') this.answer = Number(val);
    else if (!t) return;
    else if (a === 'tray') this.held = this.held?.[0] === ti && this.held[1] === val ? null : [ti, val];
    else if (a === 'slot') this.place(t, ti, val);
    else if (a === 'op') {
      const i = Number(val), ops = (t.cfg as SentenceConfig).ops ?? OPS;
      t.tokens[i] = ops[(ops.indexOf(t.tokens[i]!) + 1) % ops.length];
    } else if (a === 'parts') {
      const c = t.cfg as BarConfig, k = t.parts.length + Number(val);
      if (k < 1 || k > (c.maxParts ?? 10)) return;
      t.parts = Array.from({ length: k }, (_, i) => (c.model === 'groups' ? t.parts[0] : t.parts[i]) ?? null);
    } else if (a === 'more') t.more = val === '1' ? 1 : 0;
    else if (a === 'row') {
      const c = t.cfg as TableConfig;
      if (t.rows.length >= (c.maxRows ?? 12)) return;
      t.rows.push(computeRow(c.cols.map(() => null), c.cols));
    } else if (a === 'try') {
      const x = parseNum(this.querySelector<HTMLInputElement>(`[data-a="gx"][data-t="${ti}"]`)?.value ?? '', this.fmt.decimal);
      if (x === null) return;
      const c = t.cfg as GuessConfig;
      t.guesses.push(tryGuess(x, c.cols ?? [], c.target, c.of));
    } else if (a === 'cross') {
      const i = Number(val);
      t.crossed.has(i) ? t.crossed.delete(i) : t.crossed.add(i);
    } else return;
    this.render();
    this.emit();
  }

  /** Put the held tray value into a slot, or empty the slot when nothing is held. */
  private place(t: Tool, ti: number, slot: string) {
    if (t.locked.has(slot)) return;
    const h = this.held?.[0] === ti ? this.held[1] : null;
    const v: Val = h === null ? null : h === '?' ? '?' : Number(h);
    if (t.cfg.kind === 'sentence') t.tokens[Number(slot)] = h;
    else if (slot === 'w') t.whole = v;
    else if (slot === 'd') t.d = v;
    else if ((t.cfg as BarConfig).model === 'groups') t.parts = t.parts.map(() => v);
    else t.parts[Number(slot.slice(1))] = v;
    this.held = null;
  }

  private facts(): Fact[] {
    return (this.cfg.understand?.known ?? []).map((f) => (typeof f === 'string' ? { id: f } : f));
  }

  /** The tool's numbers to place: its own tray, else the facts' numbers, then boxes solved in earlier sentences, then "?". */
  private trayHTML(ti: number) {
    const sent = this.tools[ti].cfg.kind === 'sentence';
    const nums = this.tools[ti].cfg.tray ?? this.facts().map((f) => f.n).filter(isNum);
    const solved = this.tools.slice(0, ti).map((s) => s.solved).filter(isNum);
    const chips = [...new Set([...nums, ...solved].map(String)), '?'].map((v) =>
      this.b('tray', ti, v, v === '?' ? (sent ? '□' : this.v('?')) : this.n(Number(v)), 'kg-pc-chip',
        ` aria-pressed="${this.held?.[0] === ti && this.held[1] === v}"${v === '?' ? ` aria-label="${this.lab('label-unknown', 'unknown')}"` : ''}`)).join('');
    return `<div class="kg-pc-tray" role="group" aria-label="${this.lab('label-tray', 'numbers to place')}">${chips}</div>`;
  }

  private seg(ti: number, slot: string, v: Val, name: string, cls = '', grow?: number, units?: boolean) {
    const lock = this.tools[ti].locked.has(slot);
    const btn = this.b('slot', ti, slot, this.v(v), `kg-pc-seg ${cls}${v === null ? ' empty' : ''}${lock ? ' lock' : ''}`,
      ` aria-label="${name}: ${this.say(v)}"${lock ? ' aria-disabled="true"' : ''}`);
    if (grow === undefined) return btn;
    const u = units && isNum(v) && v > 0 && v <= 30 ? ` u" style="--u:${v};` : '" style="';
    return `<span class="kg-pc-grow${u}flex-grow:${grow.toFixed(3)}">${btn}</span>`;
  }

  private barHTML(t: Tool, ti: number) {
    const c = t.cfg as BarConfig;
    let h = '';
    if (c.model === 'compare') {
      const names = [0, 1].map((r) => (c.names ? this.lab(`name-${c.names[r]}`) : this.d(r + 1)));
      const q = this.lab('label-more', 'Who has more?');
      h = `<p class="kg-pc-q">${q}</p><div class="kg-pc-chips" role="radiogroup" aria-label="${q}">` +
        names.map((nm, r) => this.b('more', ti, r, nm, 'kg-pc-fact', ` role="radio" aria-checked="${t.more === r}"`)).join('') + '</div>';
      const s = t.more === null ? 1 : shortShare(t.parts[t.more], t.parts[1 - t.more], t.d);
      h += [0, 1].map((r) => {
        const short = t.more !== null && r !== t.more;
        const diff = short ? this.seg(ti, 'd', t.d, this.lab('label-diff', 'difference'), 'diff', 1 - s) : '';
        return `<div class="kg-pc-line"><span class="kg-pc-name">${names[r]}</span><div class="kg-pc-row">${this.seg(ti, 'p' + r, t.parts[r], names[r], '', short ? s : 1, c.units)}${diff}</div></div>`;
      }).join('');
    } else {
      const w = partWidths(t.whole, t.parts), part = this.lab('label-part', 'part');
      h = `<div class="kg-pc-row">${this.seg(ti, 'w', t.whole, this.lab('label-whole', 'whole'), 'whole')}</div><div class="kg-pc-brace"></div>` +
        `<div class="kg-pc-row">${t.parts.map((v, i) => this.seg(ti, 'p' + i, v, `${part} ${this.d(i + 1)}`, '', w[i], c.units)).join('')}</div>`;
      if (c.resize)
        h += `<div class="kg-pc-pm">${this.b('parts', ti, -1, '−', 'kg-pc-btn', ` aria-label="${this.lab('label-fewer-parts', 'fewer parts')}"`)}<output>${this.d(t.parts.length)}</output>` +
          `${this.b('parts', ti, 1, '+', 'kg-pc-btn', ` aria-label="${this.lab('label-more-parts', 'more parts')}"`)}</div>`;
    }
    return `${this.trayHTML(ti)}<div class="kg-pc-bar" role="group" aria-label="${this.lab('label-bar', 'bar model')}">${h}</div>`;
  }

  private hop(x: number | null | undefined) {
    return `<td class="hop">${isNum(x) ? `<bdi dir="ltr">${x < 0 ? '' : '+'}${this.n(x)}</bdi>` : ''}</td>`;
  }

  private tableHTML(t: Tool, ti: number) {
    const c = t.cfg as TableConfig, hc = c.hops ?? [];
    const hopsOf = c.cols.map((_, j) => (hc.includes(j) ? hops(t.rows.map((r) => r[j])) : []));
    const col = (k: string) => this.lab(`col-${k}`, k);
    const head = c.cols.map((x, j) => `<th scope="col">${col(x.key)}</th>${hc.includes(j) ? '<th class="hop"></th>' : ''}`).join('');
    const body = t.rows.map((row, r) => `<tr>${c.cols.map((x, j) => {
      const given = x.given?.[r] ?? null, v = row[j];
      const cell = x.expr ? `<td class="calc">${v === null ? '…' : this.n(v)}</td>`
        : given !== null ? `<td class="given">${this.n(given)}</td>`
        : `<td>${this.input('cell', ti, `${r}.${j}`, `${col(x.key)} ${this.d(r + 1)}`, v, ` data-r="${r}" data-c="${j}"`)}</td>`;
      return cell + (hc.includes(j) ? this.hop(r ? hopsOf[j][r - 1] : null) : '');
    }).join('')}</tr>`).join('');
    const more = c.extend && t.rows.length < (c.maxRows ?? 12) ? this.b('row', ti, 0, `+ ${this.lab('label-add-row', 'add a row')}`, 'kg-pc-btn') : '';
    return `<div class="kg-pc-scroll"><table class="kg-pc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${more}`;
  }

  private guessHTML(t: Tool, ti: number) {
    const c = t.cfg as GuessConfig, cols = c.cols ?? [], x = this.lab('col-x', 'guess'), tg = c.target;
    const rows = t.guesses.map((g) => `<tr><td>${this.n(g.x)}</td>${g.v.map((v) => `<td class="calc">${v === null ? '…' : this.n(v)}</td>`).join('')}` +
      (tg === undefined || g.cmp === null ? '' : `<td class="cmp ${['small', 'hit', 'big'][g.cmp + 1]}"><bdi dir="ltr">${['<', '=', '>'][g.cmp + 1]} ${this.n(tg)}</bdi>${g.cmp ? '' : ' ✓'}</td>`) + '</tr>').join('');
    const head = `<tr><th scope="col">${x}</th>${cols.map((k) => `<th scope="col">${this.lab(`col-${k.key}`, k.key)}</th>`).join('')}${tg === undefined ? '' : `<th scope="col">${this.lab('label-target', 'check')}</th>`}</tr>`;
    return `<div class="kg-pc-try">${this.input('gx', ti, '', x, null)}${this.b('try', ti, 0, this.lab('label-try', 'try it'), 'kg-pc-btn primary')}</div>` +
      (rows ? `<div class="kg-pc-scroll"><table class="kg-pc-table">${head}${rows}</table></div>` : '');
  }

  private listHTML(t: Tool, ti: number) {
    return `<div class="kg-pc-list">${(t.cfg as ListConfig).items.map((it, i) =>
      this.b('cross', ti, i, isNum(it) ? this.n(it) : this.lab(`item-${it}`, it), `kg-pc-item${t.crossed.has(i) ? ' x' : ''}`, ` aria-pressed="${t.crossed.has(i)}"`)).join('')}</div>`;
  }

  private sentenceHTML(t: Tool, ti: number) {
    const slots = t.tokens.map((tok, i) => {
      const k = t.kinds[i];
      if (k === 'f') return `<span class="kg-pc-fix">${/\d/.test(tok!) ? this.n(Number(tok)) : esc(sym(tok!))}</span>`;
      if (k === 'o') return this.b('op', ti, i, sym(tok!), 'kg-pc-op', ` aria-label="${this.lab('label-op', 'operation')}: ${sym(tok!)}"`);
      return this.b('slot', ti, i, tok === null ? '' : tok === '?' ? '□' : this.n(Number(tok)), `kg-pc-seg num${tok === null ? ' empty' : ''}`,
        ` aria-label="${this.lab('label-slot', 'number')} ${this.d(i + 1)}: ${this.say(tok === null || tok === '?' ? tok : Number(tok))}"`);
    }).join('');
    const solve = (t.cfg as SentenceConfig).solve ? `<p class="kg-pc-solve" dir="ltr"><span>□ =</span>${this.input('solve', ti, '', this.lab('label-solve', 'the box is'), t.solved)}</p>` : '';
    return `${this.trayHTML(ti)}<p class="kg-pc-sent" dir="ltr">${slots}</p>${solve}`;
  }

  private answerHTML() {
    const a = this.cfg.answer!, al = this.lab('label-your-answer', 'answer');
    const text = a.key ? this.lab(`answer-${a.key}`, '{n}') : this.lab('label-answer', 'Answer: {n}');
    if (!a.pick) return `<p>${text.includes('{n}') ? text.replace('{n}', this.input('answer', -1, '', al, this.answer)) : `${text} ${this.input('answer', -1, '', al, this.answer)}`}</p>`;
    let tiles = '';
    for (let k = a.pick[0]; k <= a.pick[1]; k++) tiles += this.b('pick', -1, k, this.n(k), 'kg-pc-tile', ` role="radio" aria-checked="${this.answer === k}"`);
    return `<p>${text.replace('{n}', `<b class="kg-pc-blank">${this.answer === null ? '…' : this.n(this.answer)}</b>`)}</p><div class="kg-pc-pick" dir="ltr" role="radiogroup" aria-label="${al}">${tiles}</div>`;
  }

  private step(n: number, key: string, en: string, body: string) {
    return `<section class="kg-pc-step"><h3><span class="kg-pc-num">${this.d(n)}</span>${this.lab(`step-${key}`, en)}</h3>${body}</section>`;
  }

  private chips(a: string, label: string, ids: string[], text: (id: string) => string, on: (id: string) => boolean, radio: boolean, cls = '') {
    return `<p class="kg-pc-q">${label}</p><div class="kg-pc-chips ${cls}" role="${radio ? 'radiogroup' : 'group'}" aria-label="${label}">` +
      ids.map((id) => this.b(a, -1, id, text(id), a === 'strategy' ? 'kg-pc-strat' : 'kg-pc-fact', radio ? ` role="radio" aria-checked="${on(id)}"` : ` aria-pressed="${on(id)}"`)).join('') + '</div>';
  }

  private render() {
    const c = this.cfg, u = c.understand;
    const ae = document.activeElement as HTMLElement | null;
    const focus = ae && this.contains(ae) ? ae.dataset.k : undefined;
    let h = '', n = 0;
    if (c.instruction) h += `<p class="kg-pc-hint"><span class="kg-pc-i i-${esc(c.instruction)}" aria-hidden="true"></span>${this.lab(`instruction-${c.instruction}`)}</p>`;
    if (u?.known?.length || u?.asked?.length) {
      h += this.step(++n, 'understand', 'Understand the problem',
        (u.known?.length ? this.chips('known', this.lab('label-known', 'What do we know?'), this.facts().map((f) => f.id), (id) => this.lab(`fact-${id}`, id), (id) => this.known.has(id), false) : '') +
        (u.asked?.length ? this.chips('asked', this.lab('label-asked', 'What is the question?'), u.asked, (id) => this.lab(`ask-${id}`, id), (id) => this.asked === id, true, 'col') : ''));
    }
    if (c.strategies?.length) {
      h += this.step(++n, 'strategy', 'Choose a strategy', this.chips('strategy', this.lab('label-strategy', 'Which way will you try?'), c.strategies,
        (s) => `<span class="kg-pc-i i-${esc(s)}" aria-hidden="true"></span>${this.lab(`strategy-${s}`, s)}`, (s) => this.strategy === s, true));
    }
    const tools = this.tools.map((t, ti) => {
      if (!this.shown(t.cfg)) return '';
      const k = t.cfg.kind;
      return `<div class="kg-pc-tool ${k}">${k === 'bar' ? this.barHTML(t, ti) : k === 'table' ? this.tableHTML(t, ti) : k === 'guess' ? this.guessHTML(t, ti) : k === 'list' ? this.listHTML(t, ti) : this.sentenceHTML(t, ti)}</div>`;
    }).join('');
    if (tools || c.answer) h += this.step(++n, 'solve', 'Solve', tools + (c.answer ? `<div class="kg-pc-answer">${this.answerHTML()}</div>` : ''));
    this.innerHTML = h;
    if (focus) (this.querySelector<HTMLElement>(`[data-k="${focus}"]`) ?? this.querySelector<HTMLElement>('button'))?.focus();
  }
}

customElements.define('kg-problem-canvas', ProblemCanvas);

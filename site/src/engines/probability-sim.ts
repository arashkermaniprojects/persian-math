// <kg-probability-sim>: coins, dice, spinners and a bag of coloured counters. The learner runs trials (1, 10 or 100
// at once, from a seeded generator), reads the tally (experimental vs theoretical), lists the sample space, picks the
// most likely outcome, edits a bag or spinner, and places events on a likelihood line (impossible … certain).
// Contract: docs/STUDIOS.md ("Engine contract", "Engine options → probability-sim"). Maths: engines/lib/probability-sim-*.ts.
import { fracHTML, type NumberFormat } from '../lib/display';
import {
  jointOutcomes, levelOf, outcomesOf, probOf, probTable, rng, runTrials, sampleSpace, sectorAngles, sectorPath, SCALE,
  tallyGroups, type DeviceConfig, type Level,
} from './lib/probability-sim-math';
import type { ChanceState } from './lib/probability-sim-check';

export interface DeviceDef extends DeviceConfig {
  /** Bag: −/+ per colour (true = the bag's colours, or a list of colours). Spinner: tap a sector to change its colour (list = palette). */
  edit?: boolean | string[];
  /** Bag: hide what is inside (a mystery bag to guess from trials). */
  hidden?: boolean;
  /** Bag: most counters of one colour (default 10). */
  max?: number;
}

export interface ProbConfig extends Partial<DeviceConfig> {
  /** Several devices used together (outcomes like "heads-3"); otherwise the top-level kind/sides/sectors/bag is the device. */
  devices?: DeviceDef[];
  edit?: DeviceDef['edit'];
  hidden?: boolean;
  max?: number;
  /** Trial buttons (default [1, 10, 100]; [] = no trials). */
  run?: number[];
  seed?: number;
  /** Most trials in total (default 1000). */
  limit?: number;
  /** Results table (default on when there are trials): `fractions` (count over trials), `theory` (theoretical probability). */
  tally?: boolean | { fractions?: boolean; theory?: boolean };
  /** Tap every outcome that can happen. `options`: the tiles in order (default: the sample space, then `extra`). */
  space?: boolean | { options?: string[]; extra?: string[] };
  /** "Which is most likely?": tap one outcome (true = the device's outcomes, or a list). */
  choose?: boolean | string[];
  /** Likelihood line with 3 or 5 levels; each event's level is computed from `outcomes` or given as `level`. `numbers`: 0, ½, 1. */
  scale?: { levels?: 3 | 5; numbers?: boolean; events: { key: string; outcomes?: string[]; level?: Level }[] };
  /** Icon hint + label `instruction-<key>`: draw, spin, roll, flip, tap, place, edit. */
  instruction?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const PALETTE = ['red', 'blue', 'green', 'yellow'];

export class ProbabilitySim extends HTMLElement {
  private cfg: ProbConfig = {};
  private devs: DeviceDef[] = [];
  private rand = rng(1);
  private tally: Record<string, number> = {};
  private trials = 0;
  private last: { key: string; us: number[] } | null = null;
  private placed: Record<string, Level> = {};
  private listed: string[] = [];
  private chosen: string | null = null;
  /** Spinner pointer turn (degrees, keeps growing so it always spins forward) and the turn drawn last. */
  private rot = 22;
  private drawn = 22;
  private rolled = false;
  /** Body is redrawn on every change; the live region stays so screen readers hear each result. */
  private body = document.createElement('div');
  private live = document.createElement('p');
  private built = false;

  set config(c: ProbConfig) {
    this.cfg = c;
    const one: DeviceDef = { kind: c.kind ?? 'coin', sides: c.sides, sectors: c.sectors, bag: c.bag, edit: c.edit, hidden: c.hidden, max: c.max };
    this.devs = (c.devices ?? [one]).map((d) => ({ ...d, bag: d.bag && { ...d.bag }, sectors: d.sectors && [...d.sectors] }));
    this.rand = rng(c.seed ?? 1);
    this.tally = {};
    this.trials = 0;
    this.last = null;
    this.placed = {};
    this.listed = [];
    this.chosen = null;
    if (this.built) this.render();
  }

  /** `{ chance }`, nested so its keys never clash with other engines' state in lib/checks.ts. */
  get state(): { chance: ChanceState } {
    const outs = jointOutcomes(this.devs);
    const s = this.cfg.scale, lv = s?.levels ?? 5;
    const bag = this.devs.find((d) => d.kind === 'bag')?.bag;
    return { chance: {
      trials: this.trials, tally: { ...this.tally }, last: this.last?.key ?? null, probs: probTable(outs),
      events: s?.events.map((e) => ({ key: e.key, placed: this.placed[e.key] ?? null, truth: e.level ?? levelOf(probOf(outs, e.outcomes ?? []), lv) })),
      levels: s ? lv : undefined, listed: [...this.listed], space: sampleSpace(this.devs), chosen: this.chosen, bag: bag && { ...bag },
    } };
  }

  private get fmt(): NumberFormat {
    return { digits: this.dataset.digits ?? '0123456789', decimal: this.dataset.decimal ?? '.' };
  }
  private d = (n: number | string) => String(n).replace(/[0-9]/g, (x) => this.fmt.digits[+x]);
  /** A studio label, escaped, with {n}/{c}/{i} filled in and an English fallback. */
  private lab(k: string, en = '', v: Record<string, string | number> = {}) {
    return esc(this.dataset[camel(k)] ?? en).replace(/\{(\w)\}/g, (_, x: string) => (typeof v[x] === 'number' ? this.d(v[x]) : String(v[x] ?? '')));
  }
  /** Name of an outcome: dice faces are digits, joint outcomes are joined with "، " / ", ". */
  private name = (key: string): string =>
    key.split('-').map((k) => (/^\d+$/.test(k) ? this.d(k) : this.lab(`label-${k}`, k))).join(this.dir === 'rtl' ? '، ' : ', ');
  private get dir() {
    return (this.closest('[dir]') ?? document.documentElement).getAttribute('dir') ?? 'ltr';
  }

  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.body.className = 'kg-ps-body';
    this.live.className = 'kg-ps-live';
    this.live.setAttribute('aria-live', 'polite');
    this.replaceChildren(this.body, this.live);
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement | SVGElement>('[data-a]');
      if (b && this.contains(b)) this.act(b.dataset);
    });
    this.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if ((e.key === 'Enter' || e.key === ' ') && t.dataset.a === 'paint') {
        e.preventDefault();
        return this.act(t.dataset);
      }
      // Arrow keys move along a radio group (likelihood line, choose); the line is always left to right.
      const g = t.closest('[role="radiogroup"]');
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!g || !step) return;
      const rs = [...g.querySelectorAll<HTMLElement>('[role="radio"]')];
      const flip = getComputedStyle(g).direction === 'rtl' ? -1 : 1;
      const n = rs[rs.indexOf(t) + step * flip];
      if (n) {
        e.preventDefault();
        n.click();
        this.querySelector<HTMLElement>(`[data-k="${n.dataset.k}"]`)?.focus();
      }
    });
    this.render();
  }

  private act(d: DOMStringMap) {
    const a = d.a, k = d.k2 ?? '';
    const dev = this.devs[Number(d.v ?? 0)];
    if (a === 'run') {
      const n = Math.min(Number(d.n), (this.cfg.limit ?? 1000) - this.trials);
      if (n <= 0 || !jointOutcomes(this.devs).length) return;
      const r = runTrials(this.devs, this.rand, n, this.tally);
      this.tally = r.tally;
      this.last = r.last;
      this.trials += n;
      const sp = this.devs.findIndex((x) => x.kind === 'spinner');
      if (sp >= 0 && this.last) this.rot += 720 + ((this.last.us[sp] * 360 - this.rot) % 360 + 360) % 360;
      this.rolled = true;
      this.say(`${this.lab('label-result', 'Result')}: ${this.name(this.last!.key)}`);
    } else if (a === 'reset') {
      this.tally = {};
      this.trials = 0;
      this.last = null;
    } else if (a === 'bag' && dev?.bag) {
      const v = (dev.bag[k] ?? 0) + Number(d.s);
      if (v < 0 || v > (dev.max ?? 10)) return;
      dev.bag[k] = v;
    } else if (a === 'paint' && dev?.sectors) {
      const i = Number(d.i), s = dev.sectors[i], c = typeof s === 'string' ? s : s.color;
      const pal = Array.isArray(dev.edit) ? dev.edit : PALETTE;
      const next = pal[(pal.indexOf(c) + 1) % pal.length];
      dev.sectors[i] = typeof s === 'string' ? next : { ...s, color: next };
    } else if (a === 'space') {
      this.listed = this.listed.includes(k) ? this.listed.filter((x) => x !== k) : [...this.listed, k];
    } else if (a === 'choose') this.chosen = k;
    else if (a === 'place') this.placed[d.e!] = k as Level;
    else return;
    this.render();
    this.rolled = false;
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  private say(html: string) {
    const t = document.createElement('p');
    t.innerHTML = html;
    this.live.textContent = t.textContent;
  }

  /** The name next to a chip; dice faces already show their number, so their name is for screen readers only. */
  private label(k: string, cls = '') {
    return `<span class="${/^[\d-]+$/.test(k) ? 'kg-ps-sr' : cls}">${this.name(k)}</span>`;
  }

  /** A small picture of one outcome: a colour counter, a coin face or a die face. */
  private chip(key: string): string {
    return key.split('-').map((k) => (/^\d+$/.test(k) ? `<span aria-hidden="true" class="kg-ps-chip num">${this.d(k)}</span>`
      : k === 'heads' || k === 'tails' ? `<span aria-hidden="true" class="kg-ps-chip coin ${k}">${this.lab(`label-${k}`, k).slice(0, 1)}</span>`
      : `<span aria-hidden="true" class="kg-ps-chip c-${esc(k)}"></span>`)).join('');
  }

  private device(dv: DeviceDef, vi: number): string {
    const res = this.last?.key.split('-')[vi];
    const roll = this.rolled ? ' roll' : '';
    const label = this.lab(`label-${dv.kind}`, dv.kind);
    if (dv.kind === 'coin') {
      const side = res ?? 'heads';
      return `<div class="kg-ps-coin ${side}${roll}" role="img" aria-label="${label}${res ? ': ' + this.name(res) : ''}"><span>${this.lab(`label-${side}`, side)}</span></div>`;
    }
    if (dv.kind === 'dice') {
      const n = Number(res ?? (dv.sides ?? 6));
      const face = PIPS[n] && (dv.sides ?? 6) <= 6
        ? Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i) ? ' class="p"' : ''}></i>`).join('')
        : `<b>${this.d(n)}</b>`;
      return `<div class="kg-ps-die${roll}" role="img" aria-label="${label}${res ? ': ' + this.d(n) : ''}">${face}</div>`;
    }
    if (dv.kind === 'spinner') {
      const edit = !!dv.edit;
      const paths = sectorAngles(dv.sectors).map((s, i) => {
        const p = `<path class="c-${esc(s.color)}" d="${sectorPath(s.a0, s.a1, 50)}"`;
        return edit
          ? `${p} data-a="paint" data-v="${vi}" data-i="${i}" data-k="p${vi}.${i}" tabindex="0" role="button" aria-label="${this.lab('label-sector', '{i}: {c}', { i: i + 1, c: this.name(s.color) })}"/>`
          : `${p}/>`;
      }).join('');
      return `<div class="kg-ps-spin" role="${edit ? 'group' : 'img'}" aria-label="${label}${res ? ': ' + this.name(res) : ''}">` +
        `<svg viewBox="-2 -2 104 104" aria-hidden="${!edit}">${paths}<g class="kg-ps-ptr" style="transform:rotate(${this.drawn}deg)"><path d="M50 50L50 12"/><path d="M44 18L50 6L56 18Z"/><circle cx="50" cy="50" r="5"/></g></svg></div>`;
    }
    // bag
    const bag = dv.bag ?? {};
    const dots = dv.hidden ? '<b>?</b>' : Object.entries(bag).flatMap(([c, n]) => Array(n).fill(`<i class="c-${esc(c)}"></i>`)).join('');
    const names = Object.entries(bag).filter(([, n]) => n).map(([c, n]) => `${this.d(n)} ${this.name(c)}`).join('، ');
    let h = `<div class="kg-ps-bagw"><div class="kg-ps-bag" role="img" aria-label="${label}${dv.hidden ? '' : ': ' + names}"><span>${dots}</span></div>` +
      (res ? `<div class="kg-ps-drawn${roll}" role="img" aria-label="${this.lab('label-result', 'Result')}: ${this.name(res)}">${this.chip(res)}</div>` : '') + '</div>';
    if (dv.edit) {
      const cols = Array.isArray(dv.edit) ? dv.edit : Object.keys(bag);
      h += `<div class="kg-ps-edit">${cols.map((c) => {
        const nm = this.name(c), n = bag[c] ?? 0;
        const b = (s: number, t: string, l: string) =>
          `<button type="button" class="kg-ps-btn" data-a="bag" data-v="${vi}" data-k2="${esc(c)}" data-s="${s}" data-k="b${vi}${c}${s}" aria-label="${this.lab(l, `${t} ${nm}`, { c: nm })}">${t === 'fewer' ? '−' : '+'}</button>`;
        return `<div class="kg-ps-row">${this.chip(c)}<span class="kg-ps-nm">${nm}</span>${b(-1, 'fewer', 'label-remove')}<output>${this.d(n)}</output>${b(1, 'more', 'label-add')}</div>`;
      }).join('')}</div>`;
    }
    return h;
  }

  private tiles(a: string, keys: string[], on: (k: string) => boolean, radio: boolean, label: string) {
    return `<div class="kg-ps-tiles" role="${radio ? 'radiogroup' : 'group'}" aria-label="${label}">${keys.map((k) =>
      `<button type="button" class="kg-ps-tile" data-a="${a}" data-k2="${esc(k)}" data-k="${a}${esc(k)}" ${radio ? 'role="radio" aria-checked' : 'aria-pressed'}="${on(k)}">${this.chip(k)}${this.label(k)}</button>`).join('')}</div>`;
  }

  private tallyHTML(): string {
    const t = this.cfg.tally;
    const opt = typeof t === 'object' ? t : {};
    const outs = jointOutcomes(this.devs), probs = probTable(outs);
    const keys = [...outs.map((o) => o.key), ...Object.keys(this.tally).filter((k) => !probs[k])];
    const f = this.fmt;
    const head = `<tr><th>${this.lab('label-outcome', 'Outcome')}</th><th>${this.lab('label-tally', 'Tally')}</th><th>${this.lab('label-count', 'Count')}</th>` +
      (opt.fractions ? `<th>${this.lab('label-experiment', 'Experiment')}</th>` : '') + (opt.theory ? `<th>${this.lab('label-theory', 'Theory')}</th>` : '') + '</tr>';
    const rows = keys.map((k) => {
      const n = this.tally[k] ?? 0, p = probs[k] ?? [0, 1];
      const marks = this.trials <= 30
        ? tallyGroups(n).map((g) => `<i class="g${g}">${'|'.repeat(g === 5 ? 4 : g)}</i>`).join('')
        : `<span class="kg-ps-bar"><b style="inline-size:${(100 * n) / this.trials}%"></b>${opt.theory ? `<i style="inset-inline-start:${(100 * p[0]) / p[1]}%"></i>` : ''}</span>`;
      return `<tr><th scope="row">${this.chip(k)}${this.label(k, 'kg-ps-nm')}</th><td class="kg-ps-marks" aria-hidden="true">${marks}</td><td>${this.d(n)}</td>` +
        (opt.fractions ? `<td>${this.trials ? fracHTML(n, this.trials, f) : '–'}</td>` : '') + (opt.theory ? `<td>${fracHTML(p[0], p[1], f)}</td>` : '') + '</tr>';
    }).join('');
    return `<table class="kg-ps-tally"><caption>${this.lab('label-trials', 'Trials: {n}', { n: this.trials })}</caption>${head}${rows}</table>`;
  }

  private scaleHTML(): string {
    const s = this.cfg.scale!, lv = s.levels ?? 5, levels = SCALE[lv];
    const f = this.fmt;
    const nums = s.numbers ? levels.map((l) => (l === 'impossible' ? this.d(0) : l === 'certain' ? this.d(1) : l === 'even' ? fracHTML(1, 2, f) : '')) : [];
    const line = `<div class="kg-ps-line" dir="ltr" style="--n:${lv}" aria-hidden="true">${levels.map((l, i) =>
      `<span class="lv l${i}"><span class="lbl">${this.lab(`level-${l}`, l)}</span>${s.numbers ? `<span class="num">${nums[i]}</span>` : ''}</span>`).join('')}</div>`;
    const evs = s.events.map((e) => {
      const nm = this.lab(`event-${e.key}`, e.key);
      const pics = e.outcomes?.length ? `<span class="kg-ps-pics">${e.outcomes.map((o) => this.chip(o)).join('')}</span>` : '';
      return `<div class="kg-ps-ev"><p>${pics}<span>${nm}</span></p><div class="kg-ps-stops" dir="ltr" role="radiogroup" aria-label="${nm}" style="--n:${lv}">${levels.map((l, i) =>
        `<button type="button" role="radio" class="l${i}" data-a="place" data-e="${esc(e.key)}" data-k2="${l}" data-k="s${esc(e.key)}${i}" aria-checked="${this.placed[e.key] === l}" aria-label="${this.lab(`level-${l}`, l)}"></button>`).join('')}</div></div>`;
    }).join('');
    return `<div class="kg-ps-scale" role="group" aria-label="${this.lab('label-scale', 'likelihood line')}">${line}${evs}</div>`;
  }

  private render() {
    const c = this.cfg, run = c.run ?? [1, 10, 100];
    const ae = document.activeElement as HTMLElement | null;
    const focus = ae && this.contains(ae) ? ae.dataset.k : undefined;
    let h = '';
    if (c.instruction) h += `<p class="kg-ps-hint"><span class="kg-ps-i i-${esc(c.instruction)}" aria-hidden="true"></span>${this.lab(`instruction-${c.instruction}`)}</p>`;
    h += `<div class="kg-ps-devs">${this.devs.map((dv, i) => `<div class="kg-ps-dev">${this.device(dv, i)}</div>`).join('')}</div>`;
    if (run.length) {
      const kind = this.devs.length === 1 ? this.devs[0].kind : '';
      const verb = this.lab(`label-run-${kind}`, this.lab('label-run', 'Go'));
      const full = this.trials >= (c.limit ?? 1000);
      h += `<div class="kg-ps-run">${run.map((n) => `<button type="button" class="kg-ps-btn go" data-a="run" data-n="${n}" data-k="r${n}"${full ? ' disabled' : ''}` +
        `${n > 1 ? ` aria-label="${verb}, ${this.lab('label-times', '{n} times', { n })}"` : ''}>${n > 1 ? this.lab('label-times', '{n} times', { n }) : verb}</button>`).join('')}` +
        `<button type="button" class="kg-ps-btn" data-a="reset" data-k="reset" aria-label="${this.lab('label-reset', 'Start again')}">⟲</button></div>`;
      if (c.tally !== false) h += this.tallyHTML();
    }
    if (c.space) {
      const o = typeof c.space === 'object' ? c.space : {};
      const keys = o.options ?? [...sampleSpace(this.devs), ...(o.extra ?? [])];
      h += this.tiles('space', keys, (k) => this.listed.includes(k), false, this.lab('label-space', 'What can happen?'));
    }
    if (c.choose) {
      const keys = Array.isArray(c.choose) ? c.choose : jointOutcomes(this.devs).map((o) => o.key);
      h += this.tiles('choose', keys, (k) => this.chosen === k, true, this.lab('label-choose', 'Most likely'));
    }
    if (c.scale) h += this.scaleHTML();
    this.body.innerHTML = h;
    if (focus) (this.querySelector<HTMLElement>(`[data-k="${focus}"]`) ?? this.querySelector<HTMLElement>('button'))?.focus();
    // Spin the pointer from where it was drawn to where it stops.
    const ptr = this.querySelector<SVGGElement>('.kg-ps-ptr');
    if (ptr && this.drawn !== this.rot) {
      const to = this.rot;
      ptr.getBoundingClientRect();
      requestAnimationFrame(() => (ptr.style.transform = `rotate(${to}deg)`));
      this.drawn = to;
    }
  }
}

customElements.define('kg-probability-sim', ProbabilitySim);

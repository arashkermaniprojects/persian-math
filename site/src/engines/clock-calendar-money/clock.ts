// Clock view of <kg-clock-calendar-money>: analogue faces with geared, draggable hands and a digital readout.
import { DAY, HALF_DAY, angleOf, dragHour, dragMinute, handAngles, isoTime, parseTime, stepTime, timeParts } from '../lib/clock-calendar-money-clock';
import { btn, h, icon, key, type Host, type View } from './dom';

export interface ClockConfig {
  /** The time shown ("7:30"); with `interactive: hands` the start time (default 12:00). */
  time?: string;
  /** hands: drag (or arrow-key) the hands; digital: set the digital readout to match the fixed clock; none. */
  interactive?: 'hands' | 'digital' | 'none';
  /** Which hands move (geared: the hour hand follows the minute hand). Default both. */
  hands?: 'both' | 'minute' | 'hour';
  /** 24-hour digital readout and a 24-hour cycle. */
  h24?: boolean;
  /** Minutes per drag / key / button step. Default 5. */
  step?: number;
  /** Show the digital readout linked to the hands. With `interactive: digital` it is always shown: it is the input. */
  digital?: boolean;
  /** Start of the digital input (default 12:00). */
  start?: string;
  /** false hides the analogue face (digital only). */
  analogue?: boolean;
  /** Minute numbers 5, 10 … 55 round the outside, as in Iran G2. */
  minuteLabels?: boolean;
  /** Sun or moon with the label-morning / label-afternoon / label-evening / label-night text. */
  badge?: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Shows the "caption-<key>" label above the clock. */
  caption?: string;
}

interface Run { c: ClockConfig; t: number; shown: number; svg?: SVGSVGElement; out?: HTMLElement; inputs?: HTMLInputElement[] }

const fromDigits = (s: string) => s.replace(/[۰-۹]/g, (x) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/\D/g, '');

export function mount(host: Host, cfg: ClockConfig & { clocks?: ClockConfig[] }): View {
  const ds = host.dataset;
  const root = h('div', 'kg-ccm-clocks');
  let drag: { run: Run; hand: 'hour' | 'minute' } | null = null;

  const setTime = (run: Run, t: number) => {
    if (t === run.t) return;
    run.t = t;
    paint(run);
    host.changed();
  };

  /** Where a hand points: "7", or "between 7 and 8". */
  const pointsAt = (angle: number) => {
    const x = angle / 30, r = Math.round(x);
    if (Math.abs(x - r) < 0.1) return host.d(r % 12 || 12);
    const a = Math.floor(x) % 12 || 12;
    return host.lbl('labelBetween', 'between {a} and {b}', { a, b: (a % 12) + 1 });
  };

  const paint = (run: Run) => {
    const h24 = !!run.c.h24, p = timeParts(run.t, h24), text = host.d(`${p.h}:${p.m}`);
    if (run.svg) {
      const a = handAngles(run.c.interactive === 'digital' ? run.shown : run.t);
      run.svg.querySelector('.hour')!.setAttribute('transform', `rotate(${a.hour})`);
      run.svg.querySelector('.minute')!.setAttribute('transform', `rotate(${a.minute})`);
      const sep = host.loc === 'en' ? ', ' : '، ';
      run.svg.setAttribute('aria-label', `${ds.labelClock ?? 'clock'}: ${ds.labelHourHand ?? 'hour hand'} ${pointsAt(a.hour)}${sep}${ds.labelMinuteHand ?? 'minute hand'} ${pointsAt(a.minute)}`);
      run.svg.querySelectorAll('[role=slider]').forEach((g) => {
        g.setAttribute('aria-valuetext', text);
        g.setAttribute('aria-valuenow', String(run.t));
      });
    }
    if (run.inputs) {
      run.inputs[0].value = host.d(p.h);
      run.inputs[1].value = host.d(p.m);
    } else if (run.out) run.out.textContent = text;
  };

  const local = (svg: SVGSVGElement, e: PointerEvent) => {
    const r = svg.getBoundingClientRect(), k = svg.viewBox.baseVal.width / r.width;
    return { x: (e.clientX - r.left - r.width / 2) * k, y: (e.clientY - r.top - r.height / 2) * k };
  };

  const face = (run: Run) => {
    const c = run.c, R = c.minuteLabels ? 124 : 100;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `${-R} ${-R} ${2 * R} ${2 * R}`);
    svg.setAttribute('class', 'kg-ccm-face');
    svg.setAttribute('role', 'img');
    const at = (a: number, r: number, n = '') => `x${n}="${(Math.sin(a) * r).toFixed(1)}" y${n}="${(-Math.cos(a) * r).toFixed(1)}"`;
    let s = '<circle class="kg-ccm-rim" r="96"/>';
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30, big = i % 5 === 0;
      s += `<line class="kg-ccm-tick${big ? ' big' : ''}" ${at(a, big ? 84 : 89, '1')} ${at(a, 93, '2')}/>`;
      if (big) {
        s += `<text class="kg-ccm-num" ${at(a, 70)}>${host.d(i / 5 || 12)}</text>`;
        if (c.minuteLabels) s += `<text class="kg-ccm-min" ${at(a, 111)}>${host.d(i)}</text>`;
      }
    }
    // Hands stop short of the numerals so they never hide them; their touch area reaches further.
    const hand = (k: string, len: number) => `<g class="kg-ccm-hand ${k}"><line class="hit" y2="${-len - 16}"/><line class="arm" y2="${-len}"/></g>`;
    svg.innerHTML = s + hand('hour', 40) + hand('minute', 60) + '<circle class="kg-ccm-pin" r="5"/>';
    run.svg = svg;
    const moving = c.interactive === 'hands' ? c.hands ?? 'both' : '';
    if (!moving) return svg;
    svg.setAttribute('role', 'group');
    svg.classList.add('live');
    const cycle = c.h24 ? DAY : HALF_DAY;
    for (const k of ['hour', 'minute'] as const) {
      if (moving !== 'both' && moving !== k) continue;
      const g = svg.querySelector(`.${k}`)!;
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'slider');
      g.setAttribute('aria-label', (k === 'hour' ? ds.labelHourHand : ds.labelMinuteHand) ?? `${k} hand`);
      g.setAttribute('aria-valuemin', '0');
      g.setAttribute('aria-valuemax', String(cycle - 1));
      g.addEventListener('keydown', (e) => {
        const ke = e as KeyboardEvent, rtl = host.rtl();
        const dir = ['ArrowUp', rtl ? 'ArrowLeft' : 'ArrowRight', 'PageUp'].includes(ke.key) ? 1 : ['ArrowDown', rtl ? 'ArrowRight' : 'ArrowLeft', 'PageDown'].includes(ke.key) ? -1 : 0;
        if (!dir) return;
        ke.preventDefault();
        setTime(run, stepTime(run.t, dir * (k === 'hour' ? 60 : c.step ?? 5), cycle));
      });
    }
    const move = (e: PointerEvent) => {
      const p = local(svg, e);
      if (!drag || Math.hypot(p.x, p.y) < 8) return;
      const a = angleOf(p.x, p.y);
      setTime(run, drag.hand === 'minute' ? dragMinute(run.t, a, c.step ?? 5, cycle) : dragHour(run.t, a, cycle));
    };
    svg.addEventListener('pointerdown', (e) => {
      // The hand nearest the touch by angle; when both are near (they overlap at 12:00), the short hand near the
      // centre and the long hand further out.
      const p = local(svg, e), a = angleOf(p.x, p.y), h = handAngles(run.t);
      const off = (x: number) => Math.abs(((a - x + 540) % 360) - 180);
      let hand: 'hour' | 'minute' = off(h.hour) < 30 && off(h.minute) < 30 ? (Math.hypot(p.x, p.y) < 46 ? 'hour' : 'minute') : off(h.hour) < off(h.minute) ? 'hour' : 'minute';
      if (moving !== 'both') hand = moving;
      drag = { run, hand };
      svg.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      move(e);
    });
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', () => (drag = null));
    svg.addEventListener('pointercancel', () => (drag = null));
    return svg;
  };

  const digital = (run: Run) => {
    const box = h('div', 'kg-ccm-digital');
    box.dir = 'ltr';
    run.out = box;
    if (run.c.interactive !== 'digital') {
      box.setAttribute('aria-hidden', 'true'); // the hands already announce the time
      return box;
    }
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', ds.labelDigital ?? 'digital clock');
    const h24 = !!run.c.h24, cycle = h24 ? DAY : HALF_DAY;
    run.inputs = [];
    (['hours', 'minutes'] as const).forEach((part, i) => {
      const name = (part === 'hours' ? ds.labelHours : ds.labelMinutes) ?? part;
      const col = h('div', 'kg-ccm-spin');
      const inp = h('input', 'kg-ccm-digit');
      inp.inputMode = 'numeric';
      inp.autocomplete = 'off';
      inp.maxLength = 2;
      inp.setAttribute('aria-label', name);
      const by = (k: number) => {
        // Hours wrap in the 12- or 24-hour cycle; minutes wrap within the hour.
        const t = run.t, mm = t % 60, step = run.c.step ?? 5;
        setTime(run, part === 'hours' ? stepTime(t, k * 60, cycle) : t - mm + ((((mm + k * step) % 60) + 60) % 60));
      };
      const up = btn('kg-ccm-step', '▲', host.lbl('labelMore', '{x} up', { x: name }));
      const down = btn('kg-ccm-step', '▼', host.lbl('labelLess', '{x} down', { x: name }));
      up.addEventListener('click', () => by(1));
      down.addEventListener('click', () => by(-1));
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        by(e.key === 'ArrowUp' ? 1 : -1);
      });
      inp.addEventListener('input', () => {
        const v = fromDigits(inp.value);
        inp.value = host.d(v);
        if (!v) return;
        const n = +v, hh = Math.floor(run.t / 60), mm = run.t % 60;
        if (part === 'hours' && (h24 ? n <= 23 : n >= 1 && n <= 12)) run.t = (h24 ? n : n % 12) * 60 + mm;
        else if (part === 'minutes' && n <= 59) run.t = (hh * 60 + n) % cycle;
        else return;
        host.changed();
      });
      inp.addEventListener('change', () => paint(run));
      col.append(up, inp, down);
      run.inputs!.push(inp);
      if (i) box.append(h('span', 'kg-ccm-colon', ':'));
      box.append(col);
    });
    return box;
  };

  const runs: Run[] = (cfg.clocks ?? [cfg]).map((c) => {
    const t = parseTime(c.time ?? '12:00');
    const run: Run = { c, t: c.interactive === 'digital' ? parseTime(c.start ?? '12:00') : t, shown: t };
    const fig = h('figure', 'kg-ccm-clock');
    if (c.caption) fig.append(h('figcaption', '', ds[key('caption', c.caption)] ?? c.caption));
    if (c.analogue !== false) fig.append(face(run));
    if (c.badge) {
      const b = h('p', `kg-ccm-badge ${c.badge}`);
      b.innerHTML = icon(c.badge === 'morning' || c.badge === 'afternoon' ? 'sun' : 'moon');
      b.append(ds[key('label', c.badge)] ?? c.badge);
      fig.append(b);
    }
    if (c.interactive === 'digital' || c.digital) fig.append(digital(run));
    root.append(fig);
    paint(run);
    return run;
  });

  return {
    root,
    tip: runs.some((r) => r.c.interactive === 'digital') ? 'set' : runs.some((r) => r.c.interactive === 'hands') ? 'drag' : undefined,
    state: () => ({ clocks: runs.map((r) => ({ time: isoTime(r.t), interactive: (r.c.interactive ?? 'none') !== 'none', shown: isoTime(r.shown) })) }),
  };
}

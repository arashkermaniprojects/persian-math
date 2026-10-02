// Calendar view of <kg-clock-calendar-money>: a month grid, Solar Hijri (fa-IR, fa-AF, ps) or Gregorian (en).
import {
  MONTHS, WEEKDAYS, WEEKDAYS_SHORT, addMonths, calendarDefaults, monthGrid, monthLength, weekday, type CalSystem, type YMD,
} from '../lib/clock-calendar-money-calendar';
import { btn, h, type Host, type View } from './dom';

export interface CalendarConfig {
  /** solar | gregorian; default from the locale (or the locale file's engine label `calendar`). */
  system?: CalSystem;
  year?: number;
  month?: number;
  /** day: tap a day (default); none: look only. */
  interactive?: 'day' | 'none';
  /** Previous / next month buttons. */
  navigate?: boolean;
  /** Day of the first shown month ringed as "today". */
  today?: number;
  /** Days of the first shown month dotted (events). */
  marks?: number[];
  /** 0 = Sunday … 6 = Saturday; default Saturday (fa-IR, fa-AF, ps) or Monday (en). */
  weekStart?: number;
}

export function mount(host: Host, base: CalendarConfig & { solar?: CalendarConfig; gregorian?: CalendarConfig }): View {
  const ds = host.dataset, def = calendarDefaults(host.loc);
  const forced = base.system ?? ds.calendar;
  const sys: CalSystem = forced === 'solar' || forced === 'gregorian' ? forced : def.system;
  // Years and months differ by calendar, so a mission gives each under `solar:` / `gregorian:`.
  const c: CalendarConfig = { ...base, ...(base[sys] ?? {}) };
  const first = { y: c.year ?? (sys === 'solar' ? 1405 : 2026), m: c.month ?? 1 };
  let view = first, picked: YMD | null = null, focusDay = c.today ?? 1;
  const ws = c.weekStart ?? def.weekStart, live = (c.interactive ?? 'day') === 'day';
  const names = (k: 'months' | 'weekdays', n: number, fallback: string[]) => {
    const own = ds[k]?.split(/[,،]\s*/);
    return own?.length === n ? own : fallback;
  };
  const months = names('months', 12, MONTHS[host.loc]), days = names('weekdays', 7, WEEKDAYS[host.loc]);
  const short = ds.weekdays ? days.map((d) => d.slice(0, host.loc === 'en' ? 2 : 1)) : WEEKDAYS_SHORT[host.loc];
  const sep = host.loc === 'en' ? ', ' : '، ';
  const root = h('div', 'kg-ccm-cal');

  const render = (focus = false) => {
    const { y, m } = view, len = monthLength(sys, y, m), here = y === first.y && m === first.m;
    focusDay = Math.min(focusDay, len);
    const head = h('div', 'kg-ccm-cal-head');
    const title = h('p', 'kg-ccm-cal-title', `${months[m - 1]} ${host.d(y)}`);
    title.setAttribute('aria-live', 'polite');
    head.append(title);
    if (c.navigate) {
      // Previous month sits at the inline start: on the right in RTL, with its arrow pointing that way.
      const rtl = host.rtl();
      const prev = btn('kg-ccm-nav prev', rtl ? '→' : '←', ds.labelPrevMonth ?? 'previous month');
      const next = btn('kg-ccm-nav next', rtl ? '←' : '→', ds.labelNextMonth ?? 'next month');
      prev.addEventListener('click', () => go(-1));
      next.addEventListener('click', () => go(1));
      head.prepend(prev);
      head.append(next);
    }
    const grid = h('div', 'kg-ccm-grid');
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', title.textContent!);
    const row = () => {
      const r = h('div', 'kg-ccm-row');
      r.setAttribute('role', 'row');
      grid.append(r);
      return r;
    };
    const we = (wd: number) => (def.weekend.includes(wd) ? ' we' : '');
    const hr = row();
    for (let i = 0; i < 7; i++) {
      const wd = (ws + i) % 7, th = h('div', 'kg-ccm-wd' + we(wd), short[wd]);
      th.setAttribute('role', 'columnheader');
      th.setAttribute('aria-label', days[wd]);
      th.title = days[wd];
      hr.append(th);
    }
    for (const week of monthGrid(sys, y, m, ws)) {
      const r = row();
      week.forEach((d, i) => {
        const wd = (ws + i) % 7, cell = h('div', 'kg-ccm-day' + we(wd));
        cell.setAttribute('role', 'gridcell');
        r.append(cell);
        if (d === null) return;
        const today = here && c.today === d;
        const b = btn('kg-ccm-date' + (today ? ' today' : '') + (here && c.marks?.includes(d) ? ' mark' : ''), host.d(d),
          `${host.d(d)} ${months[m - 1]}${sep}${days[wd]}${today ? sep + (ds.labelToday ?? 'today') : ''}`);
        b.dataset.day = String(d);
        if (!live) {
          b.disabled = true;
          return cell.append(b);
        }
        b.setAttribute('aria-pressed', String(!!picked && picked.y === y && picked.m === m && picked.d === d));
        b.tabIndex = d === focusDay ? 0 : -1;
        b.addEventListener('click', () => {
          picked = { y, m, d };
          focusDay = d;
          render(true);
          host.changed();
        });
        b.addEventListener('keydown', (e) => {
          const rtl = host.rtl();
          const k = ({ ArrowUp: -7, ArrowDown: 7, [rtl ? 'ArrowLeft' : 'ArrowRight']: 1, [rtl ? 'ArrowRight' : 'ArrowLeft']: -1 } as Record<string, number>)[e.key];
          if (!k) return;
          e.preventDefault();
          if (d + k < 1 || d + k > len) return;
          focusDay = d + k;
          root.querySelectorAll<HTMLButtonElement>('.kg-ccm-date').forEach((x) => (x.tabIndex = x.dataset.day === String(focusDay) ? 0 : -1));
          root.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
        });
        cell.append(b);
      });
    }
    root.replaceChildren(head, grid);
    if (focus) root.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  };
  const go = (delta: number) => {
    view = addMonths(view.y, view.m, delta);
    render();
  };
  render();

  return {
    root,
    tip: live ? 'tap' : undefined,
    state: () => ({ calendar: { system: sys, date: picked, view, weekday: picked ? weekday(sys, picked.y, picked.m, picked.d) : null } }),
  };
}

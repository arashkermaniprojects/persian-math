// <kg-clock-calendar-money>: three modes in one engine.
//   clock:    analogue faces with geared, draggable hands and a digital readout, 12- or 24-hour (clock-calendar-money/clock.ts)
//   calendar: a month grid, Solar Hijri for fa-IR/fa-AF/ps and Gregorian for en (clock-calendar-money/calendar.ts)
//   money:    coins and notes as plain shapes: toman/rial, afghani, pence/pounds (clock-calendar-money/money.ts)
// Contract: docs/STUDIOS.md ("Engine contract", "Engine options"). Pure maths and checks: engines/lib/clock-calendar-money-*.ts.
// Each page loads only the view its missions use.
//
// The locale comes from <html lang>. The locale file's "engine" labels can override it (`calendar`: solar|gregorian,
// `currency`: IRR|AFN|GBP, `months` / `weekdays`: comma lists) and give every visible or spoken label.
import { calLocale, type CalLocale } from './lib/clock-calendar-money-locale';
import { h, icon, key, type Host, type View } from './clock-calendar-money/dom';
import type { ClockConfig } from './clock-calendar-money/clock';
import type { CalendarConfig } from './clock-calendar-money/calendar';
import type { MoneyConfig } from './clock-calendar-money/money';
import type { Currency } from './lib/clock-calendar-money-money';

export type CCMConfig = {
  /** Default: clock if `time`/`clocks` is given, calendar if `year`/`solar`/`gregorian` is, else money. */
  mode?: 'clock' | 'calendar' | 'money';
  /** Instruction hint (an icon plus the instruction-<name> label); default by mode. "none" hides it. */
  instruction?: 'drag' | 'tap' | 'set' | 'none';
  clocks?: ClockConfig[];
  solar?: CalendarConfig;
  gregorian?: CalendarConfig;
} & ClockConfig & CalendarConfig & MoneyConfig & Partial<Record<Currency, MoneyConfig>>;

export class ClockCalendarMoney extends HTMLElement implements Host {
  loc: CalLocale = 'en';
  private view?: View;
  /** Resolves once the mode's view is drawn. */
  ready: Promise<void> = Promise.resolve();

  set config(c: CCMConfig) {
    this.loc = calLocale(document.documentElement.lang);
    const mode = c.mode ?? (c.clocks || c.time ? 'clock' : c.solar || c.gregorian || c.year ? 'calendar' : 'money');
    this.dataset.mode = mode;
    this.view = undefined;
    const load = mode === 'clock' ? import('./clock-calendar-money/clock') : mode === 'calendar' ? import('./clock-calendar-money/calendar') : import('./clock-calendar-money/money');
    this.ready = load.then((mod) => {
      const view = (mod.mount as (host: Host, cfg: CCMConfig) => View)(this, c);
      this.view = view;
      const tip = c.instruction ?? view.tip, text = tip && tip !== 'none' && this.dataset[key('instruction', tip)];
      const nodes: Node[] = [view.root];
      if (text) {
        const p = h('p', 'kg-ccm-tip');
        p.innerHTML = icon('hand');
        p.append(text);
        nodes.unshift(p);
      }
      this.replaceChildren(...nodes);
    });
  }

  get state() {
    return this.view?.state() ?? {};
  }

  d(n: number | string) {
    const digits = this.dataset.digits ?? '0123456789';
    return String(n).replace(/[0-9]/g, (x) => digits[+x]);
  }

  lbl(k: string, fallback: string, vars: Record<string, string | number> = {}) {
    return (this.dataset[k] ?? fallback).replace(/\{(\w+)\}/g, (_, v: string) => (typeof vars[v] === 'number' ? this.d(vars[v]) : String(vars[v] ?? '')));
  }

  /** Not yet attached when config is set, so the direction comes from <html dir>. */
  rtl() {
    return (this.closest('[dir]') ?? document.documentElement).getAttribute('dir') === 'rtl';
  }

  changed() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }
}

customElements.define('kg-clock-calendar-money', ClockCalendarMoney);

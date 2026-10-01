// Money view of <kg-clock-calendar-money>: coins and notes as plain shapes with their values (never copies of
// real banknotes), a purse to fill from a bank, things for sale, money paid, and groups to compare.
import { currencyDefaults, currencyFor, moneyParts, sum, type Currency, type MoneyUnit } from '../lib/clock-calendar-money-money';
import { btn, h, key, type Host, type View } from './dom';

export interface MoneyConfig {
  /** IRR | AFN | GBP; default from the locale (or the locale file's engine label `currency`). */
  currency?: Currency;
  /** Iran: amounts in toman (default) or rial. */
  unit?: MoneyUnit;
  /** Iran: print rial on the faces while amounts stay in toman (notes say ریال, prices say تومان). */
  face?: MoneyUnit;
  /** Coins and notes on offer (default: the everyday set for the currency). */
  denominations?: number[];
  /** Smallest value drawn as a note. */
  noteFrom?: number;
  /** make: tap the bank to add and the purse to remove; select: pick a group; none. */
  interactive?: 'make' | 'select' | 'none';
  /** Pieces already in the purse. */
  given?: number[];
  /** Things for sale: an emoji picture, a price, and an optional label key (item-<label>) for screen readers. */
  items?: { pic: string; price: number; label?: string }[];
  /** Pieces the shopper paid with (for change). */
  paid?: number[];
  /** Groups of pieces to compare (with interactive: select). */
  groups?: number[][];
  /** Adds a "same" choice to the groups. */
  same?: boolean;
  /** Show the purse's running total. */
  showTotal?: boolean;
  /** Most pieces the purse holds (default 20). */
  max?: number;
}

export function mount(host: Host, base: MoneyConfig & Partial<Record<Currency, MoneyConfig>>): View {
  const ds = host.dataset;
  const cur: Currency = base.currency ?? (ds.currency as Currency | undefined) ?? currencyFor(host.loc);
  // Amounts differ by currency (500 toman, 20 afghani, 50p), so a mission gives each under IRR: / AFN: / GBP:.
  const m: MoneyConfig = { ...base, ...(base[cur] ?? {}) };
  const def = currencyDefaults(cur, m.unit);
  const denoms = [...(m.denominations ?? def.denominations)].sort((a, b) => a - b);
  const noteFrom = m.noteFrom ?? def.noteFrom;
  const fmtOpts = { digits: ds.digits ?? '0123456789', decimal: ds.decimal ?? '.' };
  let purse = [...(m.given ?? [])].sort((a, b) => b - a), selected: number | null = null;
  const make = m.interactive === 'make';
  const root = h('div', 'kg-ccm-money');

  const fmt = (v: number) => {
    const p = moneyParts(v, cur, host.loc, m.unit, fmtOpts);
    return p.before ? p.unit + p.n : p.unit === 'p' ? p.n + p.unit : `${p.n} ${p.unit}`;
  };

  const piece = (v: number, tag: 'span' | 'button' = 'span') => {
    const note = v >= noteFrom;
    const rialFace = cur === 'IRR' && m.face === 'rial' && m.unit !== 'rial';
    const p = moneyParts(rialFace ? v * 10 : v, cur, host.loc, rialFace ? 'rial' : m.unit, fmtOpts);
    const rank = denoms.filter((x) => (x >= noteFrom) === note && x < v).length;
    const e = h(tag, `kg-ccm-piece ${note ? 'note' : 'coin'} t${rank % 5}${p.unit.length < 2 ? ' inl' : ''}`);
    if (tag === 'button') (e as HTMLButtonElement).type = 'button';
    const n = h('b', '', p.n), u = h('small', '', p.unit);
    if (p.before) e.append(u, n);
    else e.append(n, u);
    if (!note) e.style.setProperty('--r', String(Math.min(rank, 4)));
    e.setAttribute(tag === 'button' ? 'aria-label' : 'title', fmt(v));
    return e;
  };

  const pile = (pieces: number[], cls: string, caption?: string) => {
    const g = h('div', `kg-ccm-pile ${cls}`);
    if (caption) g.append(h('p', 'kg-ccm-cap', caption));
    const row = h('div', 'kg-ccm-pieces');
    pieces.forEach((v) => row.append(piece(v)));
    g.append(row);
    return g;
  };

  const changed = (say: string, refocus: string) => {
    render();
    root.querySelector<HTMLElement>(refocus)?.focus();
    if (!m.showTotal) root.querySelector('.kg-ccm-sr')!.textContent = say;
    host.changed();
  };

  const render = () => {
    root.replaceChildren();
    if (m.items?.length) {
      const shelf = h('div', 'kg-ccm-items');
      for (const it of m.items) {
        const card = h('div', 'kg-ccm-item');
        const pic = h('span', 'kg-ccm-pic', it.pic);
        pic.setAttribute('aria-hidden', 'true');
        card.append(pic, h('span', 'kg-ccm-price', fmt(it.price)));
        const name = it.label && ds[key('item', it.label)];
        if (name) card.title = name;
        shelf.append(card);
      }
      root.append(shelf);
    }
    if (m.paid?.length) root.append(pile(m.paid, 'paid', ds.labelPaid ?? 'paid'));
    if (m.groups?.length) {
      const set = h('div', 'kg-ccm-groups');
      set.setAttribute('role', 'radiogroup');
      const choice = (i: number, label: string) => {
        const b = btn('kg-ccm-choice' + (i < 0 ? ' same' : ''), i < 0 ? label : '', label);
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(selected === i));
        if (m.interactive === 'select')
          b.addEventListener('click', () => {
            selected = i;
            render();
            root.querySelector<HTMLElement>('[aria-checked=true]')?.focus();
            host.changed();
          });
        else b.disabled = true;
        set.append(b);
        return b;
      };
      m.groups.forEach((g, i) => choice(i, host.lbl('labelGroup', 'group {n}', { n: i + 1 }) + ': ' + g.map(fmt).join(' + ')).append(pile(g, '', host.d(i + 1))));
      if (m.same) choice(-1, ds.labelSame ?? 'same');
      root.append(set);
    }
    if (make || m.given?.length) {
      const box = h('div', 'kg-ccm-pile purse');
      box.append(h('p', 'kg-ccm-cap', ds.labelPurse ?? 'purse'));
      const row = h('div', 'kg-ccm-pieces');
      purse.forEach((v, i) => {
        if (!make) return row.append(piece(v));
        const b = piece(v, 'button');
        b.setAttribute('aria-label', host.lbl('labelRemove', 'remove {v}', { v: fmt(v) }));
        b.addEventListener('click', () => {
          purse.splice(i, 1);
          changed(`− ${fmt(v)}`, `.kg-ccm-purse-${Math.min(i, purse.length - 1)}, .kg-ccm-bank button`);
        });
        b.classList.add(`kg-ccm-purse-${i}`);
        row.append(b);
      });
      box.append(row);
      const total = h('p', 'kg-ccm-total', m.showTotal ? host.lbl('labelTotal', 'total: {v}', { v: fmt(sum(purse)) }) : '');
      total.setAttribute('aria-live', 'polite');
      box.append(total);
      root.append(box);
    }
    if (make) {
      const bank = h('div', 'kg-ccm-bank');
      for (const v of denoms) {
        const b = piece(v, 'button');
        b.setAttribute('aria-label', host.lbl('labelAdd', 'add {v}', { v: fmt(v) }));
        b.dataset.v = String(v);
        b.addEventListener('click', () => {
          if (purse.length >= (m.max ?? 20)) return;
          purse = [...purse, v].sort((a, b) => b - a);
          changed(`+ ${fmt(v)}`, `.kg-ccm-bank [data-v="${v}"]`);
        });
        bank.append(b);
      }
      root.append(bank);
    }
    const sr = h('p', 'kg-ccm-sr');
    sr.setAttribute('aria-live', 'polite');
    root.append(sr);
  };
  render();

  return {
    root,
    tip: make || m.interactive === 'select' ? 'tap' : undefined,
    state: () => ({ money: { currency: cur, unit: cur === 'IRR' ? m.unit ?? 'toman' : undefined, pieces: [...purse], total: sum(purse), denominations: denoms, groups: m.groups, selected } }),
  };
}

// Rectangle and grid modes for <kg-algebra-tiles>, loaded only by missions that use them:
//   rectangle  the area model. With `sides` the learner paints each block of the rectangle with the right tile
//              (expand: 3(x + 4)); with `tiles` the learner builds the two sides with −/+ and the rectangle fills itself,
//              to be compared with the tiles given (factorise; completing the square shows the missing corner).
//   grid       the box method: headings × headings, every cell typed on the keypad; `total` fills it backwards
//              (division, with an optional remainder).
// Everything is laid out left to right, as the books draw an area model and a multiplication grid.
import type { AlgebraConfig, AlgebraHost, AlgebraPart } from '../algebra-tiles';
import { areaOf, blocksOf, cellOf, headingsOf, segsOf, segsPoly, tileKey, type Seg } from '../lib/algebra-tiles-frame';
import { format, kindOrder, parse, powsOf } from '../lib/algebra-tiles-poly';

export interface FrameConfig extends AlgebraConfig {
  /** rectangle: given sides [left, top]: the learner paints the blocks. */
  sides?: [string, string];
  /** rectangle: the tiles to arrange; the learner builds the sides. */
  tiles?: string;
  /** rectangle with `tiles`: the side pieces offered (default: the tiles' letter and 1). */
  edge?: string[];
  /** grid: headings, as an expression ("x + 3") or a list (["x", "3"]); "?" = the learner types it. */
  rows?: string | string[];
  cols?: string | string[];
  /** grid: cells shown already filled, [row, column]. */
  given?: [number, number][];
  /** grid: the product, to fill the grid backwards (division); `remainder: true` adds a box for what is left. */
  total?: string;
  remainder?: boolean;
}

/** On-screen sizes in px: a unit edge and the length of each letter, big enough to tap a block. */
const UNIT = 44, LEN: Record<string, number> = { x: 96, y: 72 }, THICK = 26;
const plen = (k: string) => (k === '1' ? UNIT : LEN[k] ?? 80);

export function mount(host: AlgebraHost, cfg: AlgebraConfig): AlgebraPart {
  const c = cfg as FrameConfig;
  return c.mode === 'grid' ? grid(host, c) : rectangle(host, c);
}

// ---------- rectangle ----------

function rectangle(host: AlgebraHost, c: FrameConfig): AlgebraPart {
  const build = !c.sides;
  const given = c.tiles ? parse(c.tiles) : null;
  const edge = c.edge ?? [...new Set([...Object.keys(given ?? {}).flatMap((k) => Object.keys(powsOf(k))), '1'])].sort(kindOrder);
  // build: counts of each edge piece on each side (negative = red pieces)
  const count: [Record<string, number>, Record<string, number>] = [{}, {}];
  const segs = (i: 0 | 1): Seg[] => (build
    ? edge.filter((k) => count[i][k]).map((k) => ({ kind: k, sign: count[i][k] > 0 ? 1 : -1, n: Math.abs(count[i][k]) } as Seg))
    : segsOf(c.sides![i]));
  const painted: Record<string, string | null> = {};
  let brush: string | null = null;

  // the usual tiles for the sides' letters (x², x, 1), so choosing the right one is the learner's job
  const brushes = () => {
    const letters = [...segs(0), ...segs(1)].flatMap((s) => Object.keys(powsOf(s.kind)));
    const ks = [...new Set([...blocksOf(segs(0), segs(1)).map((b) => b.kind), ...letters.flatMap((v) => [`${v}^2`, v]), '1'])].sort(kindOrder);
    const neg = [...segs(0), ...segs(1)].some((s) => s.sign < 0);
    return [...ks.map((k) => tileKey(k, 1)), ...(neg ? ks.map((k) => tileKey(k, -1)) : [])];
  };
  const parts = (key: string): [string, number] => (key.startsWith('-') ? [key.slice(1), -1] : [key, 1]);

  const edgeHTML = (s: Seg[], side: 0 | 1) => s.map((g) => {
    const L = plen(g.kind);
    const dim = side ? `inline-size:${g.n * L}px;block-size:${THICK}px` : `inline-size:${THICK}px;block-size:${g.n * L}px`;
    return `<span class="kg-at-edge d${g.kind === '1' ? 0 : 1}${g.sign < 0 ? ' neg' : ''}${side ? ' top' : ''}" style="${dim};--step:${L}px" aria-hidden="true">${host.alg((g.sign < 0 ? '-' : '') + g.kind)}</span>`;
  }).join('');

  const frameHTML = () => {
    const rows = segs(0), cols = segs(1);
    if (!rows.length || !cols.length) return `<p class="kg-at-none">${host.lab('label-no-rect', 'build both sides')}</p>`;
    const colW = cols.map((g) => g.n * plen(g.kind)), rowH = rows.map((g) => g.n * plen(g.kind));
    let h = `<div class="kg-at-rect" dir="ltr" style="grid-template-columns:${THICK}px ${colW.map((w) => w + 'px').join(' ')};grid-template-rows:${THICK}px ${rowH.map((v) => v + 'px').join(' ')}">`;
    h += `<span></span>${cols.map((g) => edgeHTML([g], 1)).join('')}`;
    for (const b of blocksOf(rows, cols)) {
      if (b.c === 0) h += edgeHTML([rows[b.r]], 0);
      const r = rows[b.r], col = cols[b.c], key = `${b.r}-${b.c}`;
      const tile = build ? b.tile : painted[key] ?? null;
      const [kind, sign] = tile ? parts(tile) : [b.kind, b.sign];
      const name = host.fill('label-block', { n: String(b.count), t: tile ? host.tileName(kind, sign) : host.lab('label-empty-block', '?') }, '{n} × {t}');
      const style = `--w:${plen(col.kind)}px;--h:${plen(r.kind)}px`;
      const inner = tile ? `<span class="kg-at-bt">${host.alg((sign < 0 ? '-' : '') + kind.replace(/\*/g, ''))}</span>` : '';
      const cls = `kg-at-block${tile ? ` d${Math.min(2, Object.values(powsOf(kind)).reduce((a, e) => a + e, 0))}${sign < 0 ? ' neg' : ''}` : ' blank'}`;
      h += build
        ? `<span class="${cls}" style="${style}" role="img" aria-label="${name}">${inner}</span>`
        : `<button type="button" class="${cls}" style="${style}" data-a="m-paint" data-i="${key}" data-k="b${key}" aria-label="${name}">${inner}</button>`;
    }
    return h + '</div>';
  };

  const stepperHTML = (i: 0 | 1) => `<div class="kg-at-side" role="group" aria-label="${host.lab(i ? 'label-top' : 'label-left', i ? 'top side' : 'left side')}"><span>${host.lab(i ? 'label-top' : 'label-left', i ? 'top' : 'left')}</span>${edge.map((k) => {
    const n = count[i][k] ?? 0, name = host.tileName(k, 1);
    return `<span class="kg-at-step">${host.tile(k, n < 0 ? -1 : 1)}<button type="button" class="kg-at-btn" data-a="m-side" data-i="${i}" data-kind="${k}" data-d="-1" data-k="s${i}${k}-" aria-label="${host.fill('label-side-fewer', { t: name }, 'fewer {t}')}">−</button>` +
      `<output aria-label="${name}">${host.alg(String(n))}</output>` +
      `<button type="button" class="kg-at-btn" data-a="m-side" data-i="${i}" data-kind="${k}" data-d="1" data-k="s${i}${k}+" aria-label="${host.fill('label-side-more', { t: name }, 'more {t}')}">+</button></span>`;
  }).join('')}</div>`;

  return {
    html() {
      let h = '';
      if (build) {
        h += `<p class="kg-at-read">${host.fill('label-given', { e: host.alg(c.tiles!) }, 'tiles: {e}')}</p>${stepperHTML(0)}${stepperHTML(1)}`;
      } else {
        h += `<div class="kg-at-tray" dir="ltr" role="radiogroup" aria-label="${host.lab('label-tray', 'tiles')}">${brushes().map((t) => {
          const [k, s] = parts(t);
          return `<button type="button" role="radio" class="kg-at-slot" data-a="m-brush" data-v="${t}" data-k="p${t}" aria-checked="${brush === t}" aria-label="${host.tileName(k, s)}">${host.tile(k, s)}</button>`;
        }).join('')}</div>`;
      }
      h += `<div class="kg-at-scroll">${frameHTML()}</div>`;
      if (build && segs(0).length && segs(1).length) h += `<p class="kg-at-read">${host.fill('label-area', { e: host.alg(format(areaOf(segs(0), segs(1)))) }, 'area: {e}')}</p>`;
      return h;
    },
    act(d) {
      if (d.a === 'm-brush') brush = brush === d.v ? null : d.v!;
      else if (d.a === 'm-paint') {
        if (!brush) return true;
        painted[d.i!] = painted[d.i!] === brush ? null : brush;
        host.log({ do: 'paint', tile: brush });
      } else if (d.a === 'm-side') {
        const i = Number(d.i) as 0 | 1, k = d.kind!, max = k === '1' ? 9 : 3;
        count[i][k] = Math.max(k === '1' ? -max : 0, Math.min(max, (count[i][k] ?? 0) + Number(d.d)));
        host.log({ do: 'side', tile: k });
      } else return false;
      return true;
    },
    state() {
      const r = segs(0), q = segs(1);
      const sides: [string, string] | null = r.length && q.length ? [format(segsPoly(r)), format(segsPoly(q))] : null;
      return {
        sides, given: c.tiles,
        blocks: build ? undefined : blocksOf(r, q).map((b) => ({ tile: painted[`${b.r}-${b.c}`] ?? null, want: b.tile })),
      };
    },
  };
}

// ---------- grid ----------

function grid(host: AlgebraHost, c: FrameConfig): AlgebraPart {
  const list = (h?: string | string[]) => (Array.isArray(h) ? h.map(String) : h ? headingsOf(h) : ['?']);
  const rows = list(c.rows), cols = list(c.cols);
  const given = new Set((c.given ?? []).map(([i, j]) => `${i}-${j}`));
  const head = (h: string, key: string) => (h === '?' ? host.val(key) || null : h);
  const product = (i: number, j: number) => (rows[i] !== '?' && cols[j] !== '?' ? cellOf(rows[i], cols[j]) : null);
  const first = rows.findIndex((h) => h === '?') >= 0 ? `r${rows.indexOf('?')}` : cols.includes('?') ? `c${cols.indexOf('?')}` : `g0-0`;
  host.activate(first);

  const cell = (key: string, text: string | null, label: string) => (text !== null ? `<span class="kg-at-gc fixed">${host.alg(text)}</span>` : host.field(key, label));
  return {
    keypad: true,
    html() {
      let h = `<div class="kg-at-scroll"><table class="kg-at-grid" dir="ltr"><tr><th aria-hidden="true">×</th>`;
      cols.forEach((t, j) => (h += `<th>${cell(`c${j}`, t === '?' ? null : t, host.fill('label-col', { n: String(j + 1) }, 'top {n}'))}</th>`));
      h += '</tr>';
      rows.forEach((t, i) => {
        h += `<tr><th>${cell(`r${i}`, t === '?' ? null : t, host.fill('label-row', { n: String(i + 1) }, 'left {n}'))}</th>`;
        cols.forEach((_, j) => {
          const fixed = given.has(`${i}-${j}`) ? product(i, j) : null;
          h += `<td>${cell(`g${i}-${j}`, fixed, host.fill('label-grid-cell', { r: String(i + 1), c: String(j + 1) }, 'cell {r}, {c}'))}</td>`;
        });
        h += '</tr>';
      });
      h += '</table></div>';
      if (c.total) h += `<p class="kg-at-read">${host.fill('label-total', { e: host.alg(c.total) }, 'total: {e}')}</p>`;
      if (c.remainder) h += `<div class="kg-at-write"><span>${host.lab('label-remainder', 'remainder')}</span>${host.field('rem', host.lab('label-remainder', 'remainder'))}</div>`;
      return h;
    },
    act() { return false; },
    state() {
      return {
        rows: rows.map((t, i) => head(t, `r${i}`)),
        cols: cols.map((t, j) => head(t, `c${j}`)),
        cells: rows.map((_, i) => cols.map((_, j) => (given.has(`${i}-${j}`) ? product(i, j) : host.val(`g${i}-${j}`) || null))),
        total: c.total,
        remainder: c.remainder ? host.val('rem') || null : undefined,
      };
    },
  };
}

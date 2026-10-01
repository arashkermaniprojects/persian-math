# Studios and missions — format

A **studio** is one interactive page built on one **engine** (a reusable interactive tool). It holds about 4 **missions**. Each mission follows **Explore → Predict → Check → Justify**: the learner manipulates the engine or answers, checks, then explains why in their own words.

The structure is language-neutral. All text lives in per-locale files.

```
content/studios/<studio-id>.yaml                 # structure: engine, concepts, missions, checks
content/locales/<locale>/studios/<studio-id>.json # all text for that studio in one locale
site/src/engines/<engine>.ts                      # the engine (a custom element)
```

## Studio YAML

```yaml
id: frac-what-is
engine: fraction-bars
strand: frac
concepts: [frac.halves-quarters, frac.concept]   # concept-graph ids; grades per curriculum are derived from them
order: 1                                          # position within the strand's studio list
missions:
  - id: shade-three-quarters
    setup:                                        # passed to the engine as its config
      bars: [{ parts: 4, shaded: 0, interactive: shade }]
    check: { type: shaded-equals, value: [3, 4] }
  - id: name-the-fraction
    setup: { bars: [{ parts: 5, shaded: 2, interactive: none }] }
    answer: fraction                              # fraction | integer | decimal | choice: input shown under the engine
    check: { type: answer-equals, value: [2, 5] }
  - id: pounds-and-pence
    locales: [en]                                 # optional: only these locales get this mission
```

## Check types (`site/src/lib/checks.ts`)

| type | passes when | options |
|---|---|---|
| `shaded-equals` | the bar(s) show `value` | `exact: true` also requires the same denominator |
| `point-equals` | every number-line point is on one of `values` | |
| `answer-equals` | the typed fraction equals `value` | `simplest: true`; `denominator: n`; `mixed: true` (must be a mixed number, else `not-mixed`); `traps: [{ value: [2, 1], code: tops-and-bottoms }]` (a known wrong answer gets its own feedback code) |
| `answer-integer` | the typed whole number equals `value` | `traps: [{ value: 74, code: reversed }]` (a known wrong number gets its own feedback code) |
| `answer-decimal` | the typed decimal equals `value` exactly (`value` uses `.` in YAML) | the learner types the locale mark: ۲/۵ (fa-IR), ۲,۵ (fa-AF, ps) or 2.5 (en) |
| `choice` | the chosen option index is `correct` | `options` is a list of placeholders, e.g. `"{{frac:2/3}}"` |
| `steps-correct` | every step of a written method (long division) is right | |
| `counters` | every given condition on the `counters` engine holds, tested in this order: `count` → `marked` → `left` → `equal` → `each` → `colors` → `array`/`rect` → `tree` → `pick` | `count`/`marked`: a total over the zones in `in`, or one entry per zone (`null` = any); `left` (count − marked); `equal` (all zones in `in` the same size); `each: n`; `colors: [red, yellow]`; `array: [rows, cols]`; `rect`; `anyOrder` (colours/array either way round); `tree` (factor tree ends in primes); `pick` (number tapped) with `traps: [{ pick: 3, code: … }]`. Codes: `too-many`/`too-few`, `marked-too-many`/`marked-too-few`, `not-equal`, `wrong-colors`, `wrong-array`, `not-rect`, `tree-unfinished`, `empty` (nothing picked), `too-big`/`too-small` (pick) |
| `place-value` | the number shown on the `place-value` engine equals `value` (a number, or a decimal string such as `"3.45"`) | `canonical: true` (every place holds one digit; else `needs-exchange`); `counts: [14, 2]` (exactly these counts per place, lowest first; else `wrong-counts`); `traps: [{ value: 22, code: took-ten }]`. Other codes: `too-big`/`too-small`, `empty` (nothing shown) |
| `facts-correct` | at least `min` facts were right on the first try in one round of `fact-fluency` (the best round counts) | `min` (default: every fact in the round). Codes: `empty`, `not-finished` (round still going), `too-few` (round over: play again) |
| `measure` | the typed answer (`answer: integer`/`decimal`) or, when nothing is typed, the value set on the `measure` engine (weights on the pan, water poured, needle, arm drawn, units laid) equals `value` | `tolerance: n` (± for estimates); `aligned: true` (the ruler's 0 must be at the object's start / the protractor's baseline on an arm, else `not-aligned`); `traps: [{ value: 6, code: wrote-cm }]`. The engine also reports misreadings for where the tool is now: `not-from-zero` (read the end with the ruler not at 0, or a protractor number when it isn't lined up), `other-scale` (the other protractor scale, 180 − angle). Other codes: `too-big`/`too-small`, `empty` |
| `time-equals` | the clock on the `clock-calendar-money` engine (the first one the learner can change, or `clock: n`) shows `value` (`"7:30"`) | `h24: true` (morning and afternoon differ). Codes: `am-pm` (4:30 for 16:30), `hands-swapped`, `minute-as-number` (7:06 for 7:30), `hour-off-by-one` (8:30 for half past 7), `wrong-hour`, `wrong-minute`, `wrong`, `empty` |
| `date-equals` | the day tapped on the `clock-calendar-money` calendar matches every part given: `day` (a number or `last`), `month`, `year`, `weekday` (0 = Sunday … 6 = Saturday), in the calendar shown | `solar: {…}` / `gregorian: {…}` hold per-calendar rules that override the shared ones. Codes: `empty`, `wrong-year`, `wrong-month`, `off-by-one` (counted the start day), `wrong-week` (right weekday, wrong week), `too-late`/`too-early`, `wrong-weekday` |
| `money-equals` | the purse on the `clock-calendar-money` engine holds `value` | `value` is a number or one per currency (`{ IRR: 1500, AFN: 15, GBP: 15 }`, in toman/afghani/pence); `fewest: true` (as few pieces as the coins on offer allow, else `not-fewest`); `pieces: n` (else `piece-count`); `traps: [{ value: { GBP: 35 }, code: gave-price }]`. Other codes: `too-big`/`too-small`, `empty` |
| `money-compare` | the group of money picked on the `clock-calendar-money` engine has the most (`pick: most`, default) or least (`pick: least`) money, or "same" when all are equal | Codes: `counted-pieces` (picked the group with the most/fewest pieces instead), `not-equal` (said same, they differ), `wrong`, `empty` |

A failed check returns a **reason code** (e.g. `not-simplest`, `too-big`, `wrong-denominator`). The locale file can give specific feedback for a code; otherwise the generic "try again" is shown.

## Locale text JSON

```json
{
  "title": "کسر چیست؟",
  "summary": "…",
  "guide": ["paragraph 1", "paragraph 2"],
  "engine": { "label-point": "نقطه" },
  "missions": {
    "shade-three-quarters": {
      "title": "…",
      "prompt": "…",
      "hint": "…",
      "success": "…",
      "why": "question asking the learner to explain",
      "model": "a model explanation, shown after they write their own",
      "feedback": { "too-big": "…" }
    }
  }
}
```

**`engine`:** labels this studio's engine needs (aria-labels, button text). They reach the engine as `data-*` attributes, e.g. `label-point` → `dataset.labelPoint`. Shared fraction-bar labels live in the UI files.

**Placeholders in text:**
- `{{term:id}}`: a glossary term in the page's locale.
- `{{frac:3/4}}`: a stacked fraction. **Never write a/b inline**, because `/` is the Iranian decimal mark.
- `{{mixed:2 1/3}}`: a mixed number.
- `{{num:2.5}}`: a number with locale digits and decimal mark.

**Locale status:**
- fa-IR and en must exist for every studio.
- fa-AF and ps files may be missing (the build falls back to fa-IR in the reviewer preview) or marked `"_status": "draft"`.

## Engine options

- **number-line:** `min`, `max`, `denominator` (ticks per unit), `labels` (`whole`/`all`/`none`), `points` (start points the learner can move), `fixedPoints` (reference points the learner can't move; not part of `state.points`), `addPoints`, `decimal`, `zoom: { from, to }`.
- **fraction-bars:** see the comments in `site/src/engines/fraction-bars.ts` (`compare`, `keepAmount`, `partsStep`, `given`, `rows`/`tint` area model, `linkParts`).
- **long-division:** `dividend`, `divisor`, `decimals`, `layout` (`auto` = gallows for fa-IR/fa-AF/ps, bus stop for en), `given`.
- **column-arithmetic:** `op` (`add`/`sub`/`mul`), `terms` (top to bottom; decimals as strings, e.g. `"12.5"`; add takes 2 or more, sub/mul 2), `carries` (`type` = the learner writes each carry, default; `show`; `hide`), `carryAt` (`auto` = the studio's `engine.carry` label: `above` the next column for fa-IR/fa-AF/ps, `below` the answer line for en), `placeholder` (long multiplication; `auto` = `engine.placeholder`: `zero` for en, `shift` for fa-IR/fa-AF/ps), `header` (place-value table, «جدول ارزش مکانی»), `inverse` (then check it with the inverse operation on a second sheet, Afghan «امتحان»), `align` (decimals: the last number starts lined up on its last digit and the learner slides it under the mark), `given` (columns already done). Subtraction: the learner taps the top digit on the left to borrow; it is crossed out and its new value written above it (ripples through zeros). Add/sub line up on the decimal mark (shorter decimals padded with muted zeros); mul is right-aligned and the answer has no mark (ask for it with `answer: decimal`). Use `steps-correct`. State: `{ stepsCorrect, answer, aligned, wrong, revealed, errors: { code: n } }`. Wrong digits get targeted labels `label-err-<code>` (`forgot-carry`, `tens-digit`, `carry-first`, `placeholder`, `smaller-from-larger`, `mark-borrow`, `old-digit`, `no-borrow`, `borrow-zero`, `too-far`), else `label-wrong`. Other labels: `label-places`/`-dec-places` (headings, `|`-separated from the ones up), `label-place-names`/`label-dec-names`, `label-result`, `-carry`, `-partial`, `-borrow` (`{p}` = place, `{n}` = row, `{v}` = digit), `label-ask-sum` (`{e}`), `-ask-carry` (`{s}`), `-ask-borrow` (`{t}`, `{b}`), `-ask-zero`, `label-reveal`, `-done`, `-inverse`, `-left`, `-right`, `-aligned`, `-align-ask` (see `site/src/engines/column-arithmetic.ts`).
- **fact-fluency:** `mode` (`quiz` = a round of facts; `recite` = say one `table` in order, «جدول ضرب زبانی»; `split` = one array `fact: [a, b]` cut after `split` rows, for derived facts), `op` (`mul`/`div`/`add`/`sub`), `tables` (× and ÷ tables above `upTo` are dropped, so `[3, 11, 12]` asks 11 and 12 in en only), `from`/`upTo` (the other number; `upTo: auto` = the studio's `engine.up-to` label: `۱۰` for fa-IR/fa-AF/ps, `12` for en), `swap`, `count`, `picture` (`always`/`help`/`never`), `choices` (n options instead of the keypad), `timer` (offer the gentle timer; it starts off and never marks wrong), `seconds`, `seed`. Every fact is drawn as an array (a × b = a rows of b). Missed facts are kept on the device (`localStorage` `kamangir:facts`, Leitner boxes) and asked first next round. Per-fact feedback labels: `label-fb-zero`, `-one`, `-add`, `-near`, `-off-one`, `-wrong` (see `site/src/engines/fact-fluency.ts`).
- **counters:** `zones` (each: `kind` `frame` = ten-frame, `slots: 20` for two / `row` / `group` = plate / `array` / `tree`; `fill: n` or `[red, yellow]`; `lock`; `act` `fill`/`cross`/`ring`/`paint`/`move`/`split`; `to` (tap a counter to send it there); `drop`/`from` (a drop button; deals from zone `from`); `slots`; `color`; `name` (caption = engine label `label-<name>`); `count` (live number); `numbers` (ordinals under a row); array `rows`, `cols`, `min/maxRows`, `min/maxCols`, `resize`, `turn`, `keep` (always n counters in rows of `cols`, last row short if not a factor); tree `value`), `look: apple`, `instruction` (icon hint + engine label `instruction-<name>`), `sentence` (LTR, e.g. `"3 + 4 = ?"`; `?` shows the tapped number), `bond: [whole, red, yellow]` (number, `"?"` = tapped number, `"*"` = live), `pick: [min, max]` (number tiles). State: `{ zones: [{ count, marked, colors, rows?, cols?, leaves?, done? }], picked }`. Labels: `label-counter`, `-red`, `-yellow`, `-crossed`, `-ringed`, `-empty`, `-drop`, `-answer`, `-bond`, `-rows-fewer`/`-more`, `-cols-fewer`/`-more`, `-turn`, `-split` (see `site/src/engines/counters.ts`).
- **place-value:** `value` or `counts` (start; counts are lowest place first and may exceed 9, e.g. `[14, 0]` = 14 loose ones), `minPlace`/`maxPlace` (powers of ten; `-1` = tenths; default ones..start number's top place, at least tens), `view` (`auto` = «چوت» abacus for fa-AF/ps, blocks elsewhere; `blocks` up to thousands, `abacus`, `counters`), `views` (switch buttons; default blocks + abacus when `view` is auto, `[]` hides them), `locked`, `exchange` (bundle 10 → 1 and break 1 → 10 buttons, default on), `max` (per place, default 19), `table` (digit under each column, default on), `readout` (`number` grouped in threes with ٬ fa-IR / thin space fa-AF, ps / `,` en, `roman`, `both`), `roman` (counters show I/X/C/M), `classes` (ones/thousands/millions headings), `highlight: [places]`, `round: place` (outline it, dash the next lower place), `compare` (a fixed second number above; `highlightDiff` outlines the highest differing place), `shift` (×10 / ÷10: every digit slides one place), `instruction` (icon hint + label `instruction-<key>`; keys `add`, `sub`, `bundle`, `break`, `shift`, `read`). State: `{ value: "27", counts, canonical, exchanges, view }`. Labels: `place-0`… (`place-m1` = tenths), `class-0`…, `label-add`, `-remove`, `-bundle`, `-break` (`{p}`/`{q}` = place names), `label-views`, `-blocks`, `-abacus`, `-counters`, `-times10`, `-divide10`, `-number`, `separator` (see `site/src/engines/place-value.ts`).
- **measure:** `tool` = `ruler` (`object` `pencil`/`leaf`/`bar`/`line` and `length`, or `objects: [{ object, length }]` stacked to compare; `max`, `minor` subdivisions per unit (1 cm only, 10 mm, 2/4/8 inches), `offset` = the ruler reading at the object's start (0 lined up, −2 = starts 2 before the 0), `drag: false`, `unit`) · `units` (non-standard: `unit` `clip`/`span`/`cube` laid end to end with −/+, `length` in those units, `max`) · `balance` (`left`/`right` items `{ item: apple/melon/bag/cube/box/book, mass, count }`, `weights` the learner toggles onto the right pan, `unit`) · `scale` (dial: `max`, `major` labelled, `minorStep`, `value`, `object`; `set: true` = the learner turns the needle) · `jug` / `thermometer` (`min`, `max`, `major`, `minorStep`, `value`; `set: true` = pour/drag the level, `step`) · `protractor` (`rays` = arm directions in degrees anticlockwise from the right, the angle is between the first two; `rotate: true` + `at` = turn the protractor, it snaps onto an arm; `ray: start` = a movable arm, `step` (default 5); `arcs: [[from, to]]` angle marks; `full`; `noProtractor`) · `convert` (`units: [km, m, cm, mm]`, `from`, `to`: a strip with ×10/×100/×1000 between neighbours, any units in `engines/lib/measure-math.ts` `UNITS` incl. UK imperial). All tools: `unit`, `instruction` (icon hint + label `instruction-<key>`, default key = the tool). State: `{ tool, measured?, aligned?, misreads?, offset?/rotation?/level? }` (`measured` only for what the learner sets; reading missions use a typed answer). Labels: `unit-<unit>` (`unit-cm`, `unit-g`, `unit-ml`, `unit-C`…), `label-ruler`, `label-reading` (`{s}`/`{e}` = readings at the object's start/end), `label-balance`, `-level`, `-left-down`, `-right-down`, `label-scale`, `label-jug`, `label-thermometer`, `label-protractor`, `label-arm`, `label-up`/`-down` (the −/+ buttons) (see `site/src/engines/measure.ts`).
- **clock-calendar-money:** three modes, picked by `mode` (else from the keys given). The locale comes from `<html lang>`; the studio's engine labels `calendar` (`solar`/`gregorian`), `currency` (`IRR`/`AFN`/`GBP`), `months`/`weekdays` (comma lists) override it. All modes: `instruction` (`drag`/`tap`/`set`/`none`; icon hint + label `instruction-<key>`, default by mode). **clock:** one clock from the top-level keys or several in `clocks: [...]`, each `time` (`"7:30"`; the start for `interactive: hands`, default 12:00), `interactive` (`hands` = drag or arrow-key the hands, geared so the short hand follows the long one; `digital` = the face shows `time` and the learner sets the digital readout with ▲/▼ or by typing, starting at `start`; `none`), `hands` (`both`/`minute`/`hour`), `h24` (24-hour readout and cycle), `step` (minutes, default 5), `digital` (show the linked readout), `analogue: false`, `minuteLabels` (5 … 55 round the face, Iran G2), `badge` (`morning`/`afternoon`/`evening`/`night`: sun or moon + label), `caption` (label `caption-<key>`). State: `{ clocks: [{ time: "HH:MM", interactive, shown }] }`. **calendar:** `solar: { year, month }` and `gregorian: { year, month }` (the month shown in each calendar; or `year`/`month` with `system`), `interactive` (`day`/`none`), `navigate` (previous/next month), `today` (ringed day), `marks` (dotted days), `weekStart` (default Saturday for fa-IR/fa-AF/ps, Monday for en; Friday, or Saturday and Sunday, are rest days). Solar Hijri ↔ Gregorian is computed in `engines/lib/clock-calendar-money-calendar.ts` (no `Intl`). State: `{ calendar: { system, date: { y, m, d } | null, view, weekday } }`. **money:** amounts are whole numbers in toman (or `unit: rial`), afghani or pence; per-currency settings go under `IRR:`/`AFN:`/`GBP:`. `interactive` (`make` = tap the bank to add, the purse to remove; `select` = pick a group; `none`), `denominations` (default the everyday set, see `engines/lib/clock-calendar-money-money.ts`), `noteFrom`, `face: rial` (Iran: rial on the faces, toman in amounts), `given` (pieces in the purse), `items: [{ pic: 🍎, price, label }]`, `paid: [values]`, `groups: [[values], …]` with `same: true` (a "same" choice), `showTotal`, `max` (default 20). Coins and notes are plain shapes with values, never pictures of real money. State: `{ money: { currency, unit, pieces, total, denominations, groups, selected } }`. Labels: `label-clock`, `-hour-hand`, `-minute-hand`, `-between` (`{a}`, `{b}`), `-digital`, `-hours`, `-minutes`, `-more`/`-less` (`{x}`), `-morning`/`-afternoon`/`-evening`/`-night`, `-prev-month`, `-next-month`, `-today`, `-purse`, `-paid`, `-add`/`-remove` (`{v}`), `-total` (`{v}`), `-group` (`{n}`), `-same`, `item-<label>` (see `site/src/engines/clock-calendar-money.ts` and `clock-calendar-money/`).

## Engine contract

An engine is a custom element `<kg-<engine>>`:
- **Input:** `config` property set from the mission `setup`; `locale` attributes `data-digits`, `data-decimal` and `dir`.
- **Output:**
  - `state` getter: a plain object, e.g. `{ bars: [{ parts: 4, shaded: 3 }] }`.
  - Dispatches `kg-change` whenever the learner changes something.
- **Accessibility:** works with touch (≥44px targets) and keyboard (arrow keys / Enter), and every interactive part has an accessible label.
- **Requirements:**
  - No network.
  - No dependencies beyond the repo.
  - Each engine stays under about 15 KB of minified JS.
  - Lays out correctly in RTL and LTR.
  - Numbers on number lines always increase left → right.

### `fraction-bars`: given cells, area model, linked bars

Options in the mission `setup` (all optional; see `site/src/engines/fraction-bars.ts` for the full list):
- `given: n` on a bar: the first n cells are pre-coloured in a second colour (blue, dotted), as "what you already have". The learner cannot unshade them, and they count as shaded. The −/+ buttons skip part counts that cannot show the given amount exactly (halves: 2 → 4 → 6).
- `rows: r` on a bar: area model. The bar is `parts` columns × `r` rows, and its state reports `parts: rows × columns`. On that bar the −/+ buttons change the rows (`minRows`/`maxRows`, default 1–6) and clear the learner's shading. Label them with `label-fewer-rows` and `label-more-rows` in the studio's `engine` text.
- `tint: n` on an area-model bar: the first n columns are striped (e.g. the ⅔ you take half of). Striped cells do not count as shaded.
- `linkParts: true` at the top level: one set of −/+ buttons re-partitions every bar together.



## Adding an engine (no shared-file edits)
- **Code:** create `site/src/engines/<name>.ts` defining `<kg-<name>>`. It's registered automatically (`site/src/client/engines-registry.ts`). Put pure helpers and their tests in `site/src/engines/lib/`.
- **Styles:** create `site/src/styles/engines/<name>.css`; it's loaded automatically (glob in `layouts/Base.astro`). Use the tokens in `global.css` (`--accent`, `--card`, `--border`, `--shade`, `--ok`, `--no`, `--radius`, …) and logical properties only.
- **Labels:** put them in each studio's locale JSON under `"engine"`, never in the UI files.

## Testing in parallel without collisions
Build into your own folder and serve it on your own port:
```sh
cd site
npx astro build --outDir dist-<you>
npx vitest run
KG_DIST=dist-<you> KG_PORT=<45xx> npx playwright test
```
`dist-*/` is gitignored. Never kill other processes' servers.

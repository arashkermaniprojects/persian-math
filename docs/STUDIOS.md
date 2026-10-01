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
```

## Check types (`site/src/lib/checks.ts`)

| type | passes when | options |
|---|---|---|
| `shaded-equals` | the bar(s) show `value` | `exact: true` also requires the same denominator |
| `point-equals` | every number-line point is on one of `values` | |
| `answer-equals` | the typed fraction equals `value` | `simplest: true`; `denominator: n`; `mixed: true` (must be a mixed number, else `not-mixed`); `traps: [{ value: [2, 1], code: tops-and-bottoms }]` (a known wrong answer gets its own feedback code) |
| `answer-integer` | the typed whole number equals `value` | |
| `answer-decimal` | the typed decimal equals `value` exactly (`value` uses `.` in YAML) | the learner types the locale mark: ۲/۵ (fa-IR), ۲,۵ (fa-AF, ps) or 2.5 (en) |
| `choice` | the chosen option index is `correct` | `options` is a list of placeholders, e.g. `"{{frac:2/3}}"` |
| `steps-correct` | every step of a written method (long division) is right | |

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


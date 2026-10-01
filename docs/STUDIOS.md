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
    answer: fraction                              # shows a fraction input under the engine
    check: { type: answer-equals, value: [2, 5] }
```

## Check types (`site/src/lib/checks.ts`)

| type | passes when | options |
|---|---|---|
| `shaded-equals` | the bar(s) show `value` | `exact: true` also requires the same denominator |
| `point-equals` | every number-line point is on one of `values` | |
| `answer-equals` | the typed fraction equals `value` | `simplest: true`; `denominator: n` |
| `answer-integer` | the typed whole number equals `value` | |
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

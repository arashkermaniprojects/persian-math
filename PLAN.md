# کمانگیر — Kamangir Math Academy — Plan

A rich, interactive K12 math academy in the style of [Orco Academy](https://orco-academy.pages.dev). It covers **the union of the Iranian, Afghan and English (National Curriculum + GCSE + A-level) curricula**, and users can switch between four languages: **Iranian Persian (fa-IR, default), Dari (fa-AF), Pashto (ps), English (en)**.

The name comes from **آرش کمانگیر**, the archer of the shared Iranian–Afghan epic tradition, whose arrow set the border. It fits an academy whose aim is to reach as far as it can.

## 0. Decisions (2026-10-01)
| Question | Decision |
|---|---|
| Audience | Iranian and Afghan children, **mainly those inside Iran and Afghanistan**, plus the diaspora |
| Name | **کمانگیر / Kamangir** |
| Default language | **Iranian Persian (fa-IR)** |
| Dari / Pashto reviewers | **Not yet available; the owner will recruit them.** These locales stay as drafts until a reviewer signs them off (see §4.4) |

### What "inside the country" means for the design
- **Connectivity is unreliable and filtered.**
  - Iran has foreign-traffic throttling, filtering and periodic national shutdowns.
  - Afghanistan has low bandwidth and expensive data.
  - So the site must be **offline-first**:
    - Everything is self-hosted; there are no external CDNs, Google Fonts or analytics.
    - It is installable as a PWA.
    - It is downloadable **per grade** as a small zip, so it can be shared over USB or SD card, Bluetooth, or local messengers.
- **Devices are low-end Android phones.** Design mobile-first:
  - a small JavaScript budget per studio
  - no heavy 3D unless the user asks for it
  - large touch targets
- **Mirrors:** keep one international host (Cloudflare Pages) and add at least one mirror reachable from inside Iran, i.e. an Iranian host or CDN. Afghanistan needs its own reachable mirror or offline distribution.
- **Safety and privacy are essential.**
  - Use no accounts, store no personal data, and make no network calls after the page loads.
  - Progress lives only on the device.
  - Since 2021, Afghan girls have been barred from school above grade 6. Kamangir can reach them, so it must be **safe to use quietly**:
    - neutral branding
    - no tracking
    - working fully offline
- **Content must be acceptable in both countries.** Word-problem contexts stay neutral: daily life, nature, markets, sport. Avoid political and religious imagery, and anything that would get the site blocked or put a child at risk.
- **The Iranian and Afghan paths come first.** The UK path and the UK-only topics (mechanics, numerical methods, …) remain as **enrichment and the Explorer path**, not as a primary path.

---

## 1. Principles

1. **One concept, many paths.**
   - Content is organised around a single **concept graph**, not around any one country's books.
   - Each curriculum (Iran / Afghanistan / England) is just an ordered *path* through that graph.
   - The same studio serves an Iranian grade 8 student, an Afghan صنف ۸ student and a UK Year 9 student.
2. **Language is a setting, not a fork.**
   - Every string, term, numeral, unit, name and calendar date comes from the locale layer.
   - Switching language never changes the math. It changes the words, the script direction, the digits and the cultural context of word problems.
3. **Orco-style learning.**
   - Interactive studios, each with about 4 guided missions.
   - A short guide inside each studio, and self-checking with justification.
   - No login, works offline, no data collection.
4. **Original content only.**
   - The textbooks are used for *alignment* (topic + sequence), never copied.
   - See RESOURCES.md §4: the Iranian books explicitly forbid adaptation, summarising and translation.
5. **Engines, not one-offs.**
   - About 20 reusable interactive engines, each configured by data, power about 200 studios.
   - That is what makes this scale.

---

## 2. Scope: the superset curriculum

Sources already gathered:
- Iran: 26 books, outlines in `curriculum/`.
- Afghanistan: 12 books, outlines in `curriculum_af/`.
- England: National Curriculum programmes of study (KS1–4, Open Government Licence), plus GCSE and A-level subject content (DfE).

### Strands (shared by all three)
| Strand | Notable sources |
|---|---|
| Number & place value | all |
| Operations & mental fluency | all; UK times tables to 12×12 |
| Fractions, decimals, percentages | all |
| Ratio, proportion, rates | all; UK compound units; AF compound proportion |
| Financial math | AF simple/compound interest; IR percentages in money problems; UK growth/decay |
| Algebra | all |
| Functions & graphs | all |
| Sequences & series | all; AF infinite series |
| Geometry (shape, angle, constructions, proof) | all; IR Thales, Heron, transformations |
| Measures (length, area, volume, time, money) | all; UK imperial; AF calendar |
| Position, direction, transformations | UK strongest; IR transformations |
| Trigonometry | all; AF triple-angle, tangent rule |
| Coordinate geometry & conics | IR, AF (hyperbola); UK circle equation |
| Vectors (2D/3D) | IR from grade 7; AF and UK 3D |
| Matrices | IR, AF (Cramer, Gauss); UK Further Maths |
| Complex numbers | AF grade 10; UK Further Maths |
| Statistics | all; AF/UK correlation and regression |
| Probability & distributions | all; AF/UK binomial, Poisson, normal; UK hypothesis testing |
| Calculus (limits, derivatives, integrals) | IR derivatives only; AF and UK full |
| Discrete math (sets, logic, number theory, graphs, combinatorics) | IR strongest; AF logic and induction |
| Mechanics | UK A-level only |
| Numerical methods | UK A-level only |
| Problem-solving strategies | IR (حل مسئله in every primary chapter) |

### Grade alignment (by age)
| Age | Iran پایه | Afghanistan صنف | England |
|---|---|---|---|
| 6–7 | ۱ | ۱ | Year 2 |
| 7–8 | ۲ | ۲ | Year 3 |
| … | N | N | Year N+1 |
| 16–17 | ۱۱ | ۱۱ | Year 12 (AS) |
| 17–18 | ۱۲ | ۱۲ | Year 13 (A2) |

England Year 1 (age 5–6) maps to Iranian preschool (پیش‌دبستانی) and the Afghan دورهٔ آماده‌گی, so it gets a **Grade 0 / Foundation** band.
Orco labels Year N as "Grade N". This academy will label by **age band** internally and show each curriculum's own grade name.

### Upper-secondary tracks
Iran has three tracks: ریاضی‌فیزیک (math & physics), تجربی (science) and انسانی (humanities). The UK has GCSE Foundation and Higher, then A-level and Further Maths. Afghanistan has a single track.
- Paths become **path variants**: `iran/riazi-fizik`, `iran/tajrobi`, `iran/ensani`, `uk/gcse-foundation`, `uk/gcse-higher`, `uk/a-level`, `uk/further`.
- An **Explorer** path also exists: the full superset, unlocked by prerequisites.

### Estimated size
- About 1,900 source lesson entries (Iran ≈ 600, Afghanistan ≈ 700, UK ≈ 600 statements).
- After merging, about **450–550 concept nodes**, grouped into **about 180–220 studios** with about 4 missions each, so **about 800 missions**.

---

## 3. Data model

```
content/
  concepts/            # one YAML per concept node (language-neutral)
  studios/             # studio = engine + config + list of missions
  paths/               # iran.yaml, afghanistan.yaml, uk.yaml (+ track variants)
  locales/
    fa-IR/ fa-AF/ ps/ en/
      ui.json          # interface strings
      glossary.json    # term base (see §4)
      studios/*.json   # all text of each studio and mission
      contexts.json    # names, currency, places, foods used in word problems
```

**Concept node** (no prose, only structure):
```yaml
id: frac.add.unlike-denominators
strand: fractions
age_band: 9-11
prerequisites: [frac.equivalent, num.lcm]
studios: [fraction-bar-studio#mission-3]
alignment:
  iran:        { grade: 5, book: G05_riazi_panjom, chapter: 2, lesson: "جمع و تفریق عددهای مخلوط" }
  afghanistan: { grade: 5, chapter: 5, lesson: "جمع کسرهایی که مخرج‌های مختلف داشته باشند" }
  uk:          { year: 5, ref: "NC Y5 Fractions: add and subtract fractions with the same denominator and denominators that are multiples of the same number" }
```
The alignment fields are *references* (book + lesson title), which is not the same as reproducing content.

**Mission** (language-neutral structure, text by key):
```yaml
id: fraction-bar-studio/m3
engine: fraction-bars
goal: frac.add.unlike-denominators
setup: { a: [1,3], b: [1,4] }
steps: [explore, predict, check, justify]
checks: [{ type: equals-fraction, value: [7,12] }, { type: free-text-justification }]
text_key: studios.fraction-bars.m3     # resolved per locale
```

---

## 4. Localisation: four languages

### 4.1 What changes per locale
| Aspect | fa-IR | fa-AF (Dari) | ps (Pashto) | en |
|---|---|---|---|---|
| Direction | RTL | RTL | RTL | LTR |
| Digits | ۰۱۲۳۴۵۶۷۸۹ | ۰۱۲۳۴۵۶۷۸۹ | ۰۱۲۳۴۵۶۷۸۹ | 0123456789 |
| Decimal mark | `/` in school books (۲/۵), `٫` in typography | to verify in the AF books | to verify | `.` |
| Calendar | Solar Hijri, فروردین… | Solar Hijri, حمل، ثور… | Solar Hijri, وری، غویی… | Gregorian |
| Currency in problems | تومان / ریال | افغانی | افغانۍ | £ |
| Grade label | پایه | صنف | ټولګی | Year / Grade |
| Script extras | — | — | ټ ډ ړ ږ ښ ګ ڼ ۍ ې | — |

### 4.2 Terminology glossary (the critical asset)
The same concept has different names in Iran and Afghanistan, so a shared **term base** with one entry per concept is the backbone. Seed entries from the outlines:

| concept | fa-IR | fa-AF | ps | en |
|---|---|---|---|---|
| set | مجموعه | ست | (from Pashto books) | set |
| limit | حد | لیمت | | limit |
| matrix | ماتریس | متریکس | | matrix |
| mean | میانگین | اوسط | | mean |
| percent | درصد | فیصد | | percent |
| statistics | آمار | احصائیه | | statistics |
| integer | عدد صحیح | عدد تام | | integer |
| rational number | عدد گویا | عدد نسبتی | | rational number |
| place value | ارزش مکانی | قیمت مقامی | | place value |
| power/exponent | توان | طاقت | | power |
| GCD | ب.م.م | بزرگترین قاسم مشترک | | HCF / GCD |
| congruent | هم‌نهشت | انطباق‌پذیر | | congruent |
| symmetry | تقارن | تناظر | | symmetry |
| rhombus | لوزی | معین | | rhombus |
| vector | بردار | وکتور | | vector |
| polynomial | چندجمله‌ای | پولینوم | | polynomial |
| complex number | عدد مختلط | عدد مختلط | | complex number |

- **Source for Pashto terms:** the official Afghan Pashto math books (`G*-Ps-Math.pdf` on moe.gov.af, same URL pattern). Download them as the terminology reference.
- **Rule:** studio text never hard-codes a term. It writes `{{term:set}}`, and the renderer resolves it per locale.

### 4.3 Math rendering in RTL
- Formulas stay LTR inside RTL text, wrapped in `<bdi dir="ltr">` and rendered with KaTeX.
- Numbers inside formulas use the locale's digits. This needs a KaTeX post-processing step to map 0–9 to ۰–۹.
- Variable letters stay Latin (x, y) in all locales, which matches all three book series.
- Graphs and number lines:
  - Axes stay mathematically oriented: +x points right in every locale.
  - Labels use locale digits.
  - Iranian books draw number lines left to right, so do the same.

### 4.4 Translation workflow
1. **Author in fa-IR, the default.** English is written alongside it as the pivot for review and for the UK path.
2. **Derive fa-AF from fa-IR.** Apply automatic glossary substitution, then have an **Afghan Dari math teacher** review it. Contexts (names, currency, calendar) are swapped from `contexts.json`.
3. **Pashto translation:** machine-assisted draft, then **mandatory native Pashto math teacher review**. This is the highest-risk locale.

**Release status per locale.** There are no Dari or Pashto reviewers yet, so every locale file carries a status:
- `draft`: machine and glossary generated. It is **not shown to children**, only in a preview build for reviewers.
- `reviewed`: a native teacher has signed it off. It ships.

| Locale | Phase 1 status |
|---|---|
| fa-IR | ships |
| en | ships |
| fa-AF | draft. It can ship *early as beta* if needed, because Dari differs from Iranian Persian mainly in terminology, which the glossary covers. Still needs one Afghan review pass. |
| ps | draft only, until a Pashto reviewer exists |

- **Reviewer recruitment brief (for the owner):** an Afghan math teacher for Dari and one for Pashto.
- **Their first job is the glossary** (about 300 terms), the highest-leverage review. Studio texts come after that.
- **Build a simple review page** that shows fa-IR / fa-AF / ps side by side per studio, with an approve/fix button and an exported diff, so reviewers can work remotely without technical skills.
4. **CI checks:**
   - every key exists in all 4 locales
   - no raw Latin digits in RTL text
   - every `{{term:…}}` resolves
   - an RTL screenshot test of each studio

---

## 5. Product structure

```
Home (opens in fa-IR, path = ایران)
 ├─ Choose language (fa-IR / fa-AF / ps / en)   — remembered locally
 │     choosing fa-AF or ps suggests the افغانستان path; it never forces it
 ├─ Choose path: ایران / افغانستان / Explorer (+ track); UK under «بیشتر»
 └─ Path view → Grade → Strand → Studio → Missions (≈4)
Topic map: browse the concept graph; see where a topic sits in each country
Cross-grade labs: Number Sense, Fractions, Pattern & Function, Data & Chance, Shape & Space, Problem Solving
Workbenches: drawing pad, writing pad (RTL-aware), calculator, graph paper
```

**Inside a studio:**
- a short guide (راهنما)
- a live interactive area
- missions in order: **Explore → Predict → Check → Justify**. This mirrors Orco's flow and the three stages of the Iranian pilot grade 1 book: درگیری → دستیابی → تثبیت و بازاندیشی.
- a free-text "why?" box on each check
- an export button (image, text or print sheet)

**Progress:** stored in the browser only, with JSON export and import so it can move between devices. Use no accounts and no analytics.

**Offline:**
- Build a PWA, and also ship a **downloadable zip bundle**.
- This matters because some hosting domains (pages.dev, Google Fonts) can be unreliable or filtered in Iran and Afghanistan.
- Self-host all fonts and libraries.

---

## 6. Interactive engines (about 20 engines, about 200 studios)

| # | Engine | Serves |
|---|---|---|
| 1 | Counters & ten-frames | counting, number bonds (grades 0–2) |
| 2 | Place-value blocks / abacus | place value up to billions, decimals |
| 3 | Number line (integers, fractions, decimals, roots) | grades 1–9 |
| 4 | Fraction bars & area model | fractions and percentages |
| 5 | Column arithmetic & long division with step check | operations |
| 6 | Times-table & mental fluency trainer | fluency (UK 12×12) |
| 7 | Clock, calendar & money | time (3 calendars), currency |
| 8 | Measuring tools (ruler, protractor, scales, jug) | measures |
| 9 | Geometry board (ruler-and-compass constructions, transformations, proofs) | constructions, Thales, congruence, circles |
| 10 | Coordinate plane & function grapher (sliders) | graphs, linear/quadratic/trig/exp/log, conics |
| 11 | Algebra tiles & equation balance | expressions, factorising, equations, inequalities |
| 12 | Pattern & sequence machine (input–output) | patterns, sequences, series |
| 13 | 3D solids viewer (nets, cross-sections, volume) | solids, 3D geometry |
| 14 | Vector & matrix playground | vectors (2D/3D), matrices, transformations |
| 15 | Data & chart builder | tables, bar, pie, line, stem-and-leaf, box, histogram, scatter, regression |
| 16 | Probability simulator (coins, dice, spinners, trees, Venn) | probability, conditional probability |
| 17 | Distribution explorer | binomial, Poisson, normal, sampling, central limit theorem, hypothesis tests |
| 18 | Calculus lab (secant→tangent, Riemann sums, area, volume of revolution) | limits, derivatives, integrals |
| 19 | Discrete lab (sets/Venn, logic truth tables, graphs, modular clock) | discrete math |
| 20 | Mechanics sim (motion, forces, projectiles, moments) | UK mechanics |
| 21 | Numerical methods lab (iteration, Newton-Raphson, trapezium rule) | UK numerical methods |
| 22 | Problem-solving canvas (draw, table, guess-and-check, work backwards) | Iranian حل مسئله strand |

---

## 7. Technology

- **Static site generator:** Astro (or Vite + Svelte), with content as YAML/JSON and a build step that validates against schemas.
- **Libraries:**
  - KaTeX for formulas, with a digit-localisation step
  - JSXGraph or custom SVG for geometry and graphing
  - Three.js for 3D
  - a small in-house simulation core
- **i18n:** locale routing (`/fa-IR/…`, `/fa-AF/…`, `/ps/…`, `/en/…`), a logical-properties CSS design system (`margin-inline-start`, etc.), `dir` set on `<html>`.
- **Fonts:** self-hosted. Choose a family that covers Persian **and** Pashto letters (Vazirmatn or Noto Naskh/Sans Arabic; check the Pashto glyphs before committing).
- **Hosting:** Cloudflare Pages, like Orco, plus mirror hosting and the offline zip.
- **Testing:**
  - schema validation
  - locale completeness
  - unit tests for the engines' answer checking
  - Playwright screenshots in all 4 locales at phone width

---

## 8. Roadmap

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **0. Foundations** | Concept graph v1 (merge the three outlines + UK statements); glossary seed (≈300 terms × 4 locales); design system (RTL/LTR); data schemas; age-band mapping | Every source lesson maps to a concept node; glossary reviewed by an Iranian, an Afghan and a Pashto teacher |
| **1. Vertical slice** | The **fractions strand, ages 7–12** (present in all three curricula): 3 engines (number line, fraction bars, column arithmetic), about 8 studios. **fa-IR and en ship**; fa-AF and ps exist as drafts in the reviewer preview | Language switching works end to end in all 4 locales; fa-IR reviewed; works fully offline on a low-end Android phone; per-grade zip under 15 MB |
| **2. Primary** | Ages 5–11, all strands; engines 1–8, 12, 15, 16, 22 | Iran grades 1–6, Afghan grades 1–6 and UK Years 1–6 paths complete |
| **3. Lower secondary** | Ages 12–14; engines 9–11, 13, 14, 19 | Iran 7–9, Afghan 7–9, UK Years 7–9 / KS3 |
| **4. Upper secondary core** | Ages 15–16 plus all three Iranian tracks; GCSE Foundation/Higher | Iran grade 10 (3 tracks), Afghan grade 10, GCSE |
| **5. Advanced** | Ages 16–18: calculus incl. integration, distributions, complex numbers, matrices, conics, discrete math, mechanics, numerical methods; engines 17, 18, 20, 21 | Iran 11–12 (3 tracks), Afghan 11–12, A-level (+ Further Maths options) |
| **6. Polish** | Cross-grade labs, printable worksheets, teacher view (lists missions by curriculum and grade; no data collection) | Accessibility audit (WCAG AA) in RTL and LTR |

Phase 1 is deliberately the riskiest slice in miniature, covering 4 locales, RTL math and engines. Solve those once, and phases 2–5 become mostly content production.

---

## 9. Team & effort

- **Engineering:** 1–2 front-end developers. Engines are the main cost.
- **Content authors:** math teachers who write the missions in fa-IR and en.
- **Reviewers per locale:**
  - one Iranian teacher (fa-IR)
  - one Afghan Dari teacher (fa-AF)
  - one Afghan Pashto teacher (ps)
  - one UK-curriculum teacher (en, GCSE/A-level accuracy)
- **Illustration:** neutral, culturally inclusive illustration; word-problem contexts come from `contexts.json` per locale.
- **Claude's role:**
  - building the concept graph and alignment
  - glossary drafts
  - mission drafts
  - engine code
  - translation drafts
  - consistency checks

  A human reviews every published line.

---

## 10. Risks & decisions

| Risk / decision | Mitigation / default |
|---|---|
| Copyright on Iranian/Afghan books | Original content only; store only references (book + lesson title). Optionally request permission from سازمان پژوهش و برنامه‌ریزی آموزشی. |
| Pashto quality | Use the official Pashto books as the term source; native review is mandatory; Pashto may launch after the other three locales. |
| Decimal-mark and notation conventions differ (Iran `/`) | A per-locale notation setting; verify conventions from the Afghan and Pashto books in Phase 0. |
| Politically or religiously sensitive imagery | Neutral contexts; no political or religious imagery in problems; contexts reviewed per locale. |
| Access from Iran/Afghanistan (filtering) | Self-host everything; offline zip; mirrors. |
| Scale (≈800 missions × 4 locales) | Engines + data-driven missions; automated completeness checks; phase gates. |
| Grade labelling across systems | Age bands internally; each path shows its own labels (پایه / صنف / ټولګی / Year). |
| No Dari/Pashto reviewers yet | Draft/reviewed status per locale; reviewer preview page; glossary reviewed first |
| Users inside Iran/Afghanistan: filtering, shutdowns, slow links | Offline-first PWA; per-grade zips for USB or messenger sharing; a mirror inside Iran; no external requests |
| Child safety (especially Afghan girls studying at home) | No accounts, no tracking, no network calls, neutral branding, works fully offline |

### Resolved (see §0)
Audience, name (کمانگیر), default language (fa-IR), and the reviewer situation are settled.

### Still open
1. **Domain and hosting inside Iran:** which Iranian host or CDN to use for the mirror. This needs someone with an Iranian account.
2. **Offline distribution channel in Afghanistan:** for example through NGOs or community schools, on SD cards.

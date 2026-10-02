# Brief: building a Phase 2 engine and its pilot studio

You are building one interactive engine for **Kamangir (کمانگیر)**, an offline-first math academy for Iranian and Afghan children, mostly inside their countries and on low-end Android phones.
- Default language: Iranian Persian (fa-IR). Also Dari (fa-AF), Pashto (ps) and English (en).
- Repo: /Users/arashkermanikolankeh/Documents/Work/Peojects/Persian_math, on branch `phase-2-primary`.
- **Don't commit or push.**

## Read first. Follow these patterns exactly.
- **docs/STUDIOS.md:** the studio, mission, check and engine contracts, plus "Adding an engine" and "Testing in parallel".
- **docs/NOTATION.md:** locale conventions.
  - Iran's decimal mark is "/", so never write a/b fractions inline; use `{{frac:a/b}}`.
  - Afghanistan's decimal mark is ",".
  - Persian digits ۱۲۳ are always used in fa-IR, fa-AF and ps (owner decision).
  - Formulas run left to right.
  - Iranian and Afghan written methods differ from UK ones.
- **Reference implementations:**
  - `site/src/engines/fraction-bars.ts`, `number-line.ts`, `long-division.ts` (with `site/src/lib/long-division.ts` and its tests)
  - `site/src/client/studio.ts`, `site/src/lib/{checks,fraction,display,richtext}.ts`
  - `content/studios/frac-*.yaml` and `content/locales/*/studios/frac-*.json`
  - `site/e2e/frac-*.spec.ts`
- **content/_work/phase2-studios.yaml:** the plan. Find your pilot studio and **every other studio that uses your engine**. Your engine must be designed so those later studios can be built with config alone; read their `notes` and concepts.
- **content/concepts/*.yaml** (concept ids) and **content/glossary.json** (use `{{term:id}}` for math terms).

## Deliverables
1. **The engine.**
   - `site/src/engines/<engine>.ts` defines `<kg-<engine>>`. It registers itself; don't edit studio.ts's registry.
   - Pure logic goes in `site/src/engines/lib/<engine>-*.ts`, with thorough vitest tests beside it.
   - Styles go in `site/src/styles/engines/<engine>.css` (auto-loaded). Use the global.css tokens and logical properties only.
   - **Requirements:**
     - Touch targets ≥ 44px; works with keyboard and screen reader (aria-labels from `this.dataset`, supplied by the studio JSON "engine" labels).
     - Works in RTL and LTR, and fits 390px wide with no horizontal scroll.
     - About 15 KB minified or less; no dependencies; no network.
     - `state` getter plus a `kg-change` event.
   - **Checks:** if you need a new check type, add it to `site/src/lib/checks.ts` with tests, document it in docs/STUDIOS.md (check table plus an "Engine options" bullet for your engine), and keep existing behaviour. Other agents edit these two shared files at the same time, so **re-read right before each edit, keep edits small and additive, and never reformat**.
2. **The pilot studio**, exactly as specified in the plan:
   - `content/studios/<id>.yaml`
   - fa-IR and en text in `content/locales/{fa-IR,en}/studios/<id>.json`
   - fa-AF and ps drafts with `"_status": "draft"`
   - About 4 missions, each following Explore → Predict → Check → Justify, with a real "why" question and a model explanation.
   - Targeted feedback for the common mistakes at this age.
3. **Language and tone**
   - **fa-IR:** warm, simple Persian addressed to a young child with «تو», matching the Iranian textbook terms.
   - **fa-AF and ps:** polite «شما» and the Afghan textbook terms (glossary).
   - **Grade 1 studios:** very short sentences, and pictures over words. Don't assume the child can read long prompts; consider an "engine.instruction" label the engine can show as an icon hint.
   - **Word-problem contexts:** neutral daily life (fruit, school, market, sport, nature).
     - Names common in both countries: علی، سارا، مریم، رضا، زهرا، احمد، فاطمه، حسن.
     - Currency per locale: تومان/ریال (fa-IR), افغانی (fa-AF), افغانۍ (ps), £/p (en).
     - No political or religious imagery.
4. **Tests**
   - `site/e2e/<id>.spec.ts`: at least one wrong and one right attempt per interaction type; fa-IR and en; no horizontal scroll at 390px on every mission.
5. **Verify in isolation.** Never use the shared `dist/` or port 4400, and never kill other processes' servers.
   ```sh
   cd site
   npx astro build --outDir dist-<engine> && npx vitest run && KG_DIST=dist-<engine> KG_PORT=<your port> npx playwright test
   ```
   All tests must pass, including other studios' tests. If another agent's in-progress files break the build, check that your own files are not the cause, then say so in your report.
6. **Check visually.** Take Playwright screenshots of at least two missions in fa-IR and one in en at 390px, Read them, and fix layout problems. Then delete your `dist-<engine>` folder.

## When you're done, reply with
- the files you created or changed
- the engine config options, as a short table
- test results
- the screenshots you checked
- how the engine will serve the plan's later studios
- anything you were unsure of

---

# Phase 3 engines (lower secondary, ages 12–14)

Everything above still applies. For Phase 3 the plan is **content/_work/phase3-studios.yaml** (check it with `python3 content/_work/check_phase3.py`); find your pilot under `waves.pilot` and read every other studio with your `engine` (and `module`). A **module** is a part of an engine loaded on demand, like `shape-board/iso.ts`: put it in `site/src/engines/<engine>/<module>.ts`, load it with a dynamic `import()` only when a mission's `setup` asks for it, and keep each chunk within the ~15 KB budget. Modules must not change what existing missions see.

PLAN.md §6 lists six engines for Phase 3 (9, 10, 11, 13, 14, 19). After planning the studios:
- **#9 Geometry board is not a new engine.** `shape-board` already has the grid, polygons, compass, crossings, transformations, `similar`, and 3D cube views. A second geometry engine would duplicate all of that. #9 becomes two shape-board modules, `dynamic` and `proof`.
- **#14 Vector & matrix playground is folded into #10 for now.** No lower-secondary book teaches matrices. The vectors (Iran G7 ch.8, G8 ch.5; UK GCSE) are arrows on a coordinate grid, so they are a `vectors` module of `coord-plane`. A matrix playground is reconsidered in Phase 5, when Afghan/UK matrices arrive; it can reuse coord-plane's grid.
- **#19 Discrete lab ships only Venn/table and tree in Phase 3.** Graphs (vertices and edges) and the modular clock wait for Phase 5. In Phase 3 the only graph content is one gifted-supplement page (deferred). Truth tables wait for Phase 4/5 (Iran G10 هندسه ۱ reasoning, Afghan G10 منطق).

Existing engines also get small, additive options. The plan notes name each one: place-value `readout: standard`, problem-canvas letter tokens, measure ruler `scale`, probability-sim two-device `space` grid, and pattern-machine decimal `×` steps.

## `coord-plane` (#10, new): coordinate plane and function grapher
- **What it is:**
  - A square-ish SVG plane with numbered axes (x right, y up, LTR in every locale) and a choice of scales.
  - Snapping to the grid or to `step`.
  - Keyboard: arrows move the focused point, Enter places it.
- **Modes**
  - **`points`:** plot or drag points (`given`, `max`); optional table of values linked to the points; `labels` (letters as in shape-board). Used for scatter graphs together with a draggable `fit` line.
  - **`line`:** drag two handles, or set `m`/`c` sliders. Shows the step triangle (rise/run) on request (`show: [gradient, intercept, equation]`).
  - **`graph`:** plot `y = f(x)` from an expression in x (shares the parser with `pattern-machine-expr`). Options:
    - `sliders` for parameters, e.g. `a`, `k`
    - `trace` (a cursor that reads (x, y))
    - `intersect` (tap where two graphs cross)
    - `pieces` for piecewise-linear real-life graphs (distance–time)
    - `region` for inequalities: dashed or solid boundary, a test point, tap a side to shade (per-locale `shade: wanted|unwanted`)
  - **`mapping`:** two set ovals with arrows between them, convertible to ordered pairs and points (relations and functions); the vertical-line test as a draggable line.
  - **Module `vectors`:** draw an arrow tail → head. Readout as a column vector (Iran: bracketed column, like shape-board `label-coords "{x}\n{y}"`). Then:
    - equal/opposite vectors anywhere
    - translate a shape by a vector
    - head-to-tail and parallelogram sums
    - scalar multiples
    - `i`/`j` components
- **Checks (`coord`):**
  - `points` (set, any order, ± tolerance)
  - `line` (`m`, `c`, `through`, `parallelTo`, `perpendicularTo`)
  - `graph` (the learner's graph matches f at sample x)
  - `intersection`
  - `region` (shaded side and boundary style)
  - `mapping` (`isFunction` answer, pairs)
  - `fit` (the line passes between the cloud's bounds)
  - `vector` (components, `equal`, `opposite`, `sum`, `multiple`)
  - Trap codes:
    - `swapped` (x and y)
    - `run-over-rise`
    - `sign` (gradient sign)
    - `intercept-x` (c read as the x-intercept)
    - `scale` (squares counted, not units)
    - `one-coordinate`
    - `dashed-solid`, `wrong-side`
    - `joined` (scatter dots joined)
    - `tail-head` (vector reversed)
    - `components-swapped`
    - `tails-joined` (vector sum)
- **State:** `{ plane: { points, lines, graphs, shaded, mapping, vectors } }`.
- **Pilots:** `coord-gradient-lines` (core), `vec-directed-segments` (`vectors`).
- **Also serves:**
  - `alg-simultaneous`, `alg-inequality-regions`
  - `coord-line-forms`
  - `func-relations-functions`, `func-real-life-graphs`, `func-quadratic-graphs`
  - `ratio-proportion-graphs`
  - `stat-scatter`
  - `vec-add-scale`, `vec-extra-applications`
  - Later phases: trig, exponential and log graphs, and conics (Phase 4/5).

## `algebra-tiles` (#11, new): algebra tiles, grid method and equation balance
- **What it is:** a tray of tiles and a work mat. The tiles are `x²` (big square), `x` (strip), `1` (small square) and their negatives (red, the flip side), plus optional `y`/`xy` tiles and labelled tiles (`√3`, `a`). Tiles are dragged or tap-placed, and a red/white pair cancels as a zero pair.
- **Modes**
  - **`tiles`:**
    - build an expression (`target`)
    - collect like terms
    - substitute: `value: { x: 3 }` flips each x tile to show 3
  - **`rectangle`:** arrange given tiles into a rectangle (factorise), or fill a rectangle with given side lengths (expand, multiply monomials). It also covers completing the square: split the bx strips around x², then add the corner squares (al-Khwarizmi, Afghan G9).
  - **`grid`:** the box method for any polynomial product, filled forwards (expand) or backwards with `divide` (polynomial division with a remainder); an optional long-division layout (gallows in fa-IR/fa-AF/ps).
  - **Module `balance`:** two pans hold tiles. Every move (add/remove the same tiles, split both pans into n equal groups) is applied to both pans; a one-sided move tips the beam and is recorded. Includes an `inequality` variant: the beam is already tilted, and × or ÷ by a negative swaps the pans. Also `rearrange` for formulae with letter tiles.
  - **Module `factors`:** a fraction bar with factor chips above and below (numbers, letters, powers, bracket factors such as `(x + 3)`, `√` chips):
    - expand a power into factors
    - cancel equal chips top and bottom
    - pull pairs out of a √
    - the result is read as an index law, a simplified surd or a simplified algebraic fraction
    - optional "which x are not allowed?" step
- **Checks (`algebra`):**
  - `expr` (the mat equals a target polynomial, compared by coefficients)
  - `simplified` (no like terms or zero pairs left)
  - `rectangle` (`sides` in any order)
  - `grid` (cells and result)
  - `solution` (balance reached `x = n` by legal moves)
  - `subject`
  - `factors` (`result`, `fullyCancelled`)
  - Trap codes:
    - `x-plus-x-is-x2`
    - `unlike-added` (3x + 2 = 5x)
    - `one-pan` (move done to one side only)
    - `sign-flip-missed`
    - `bracket-first-term-only`
    - `missing-middle` ((a + b)² without 2ab)
    - `cancel-terms` ((x+3)/3)
    - `index-multiplied` (aᵐ·aⁿ = aᵐⁿ)
    - `base-multiplied` (2³·2⁴ = 4⁷)
    - `zero-power-zero`
    - `negative-power-negative`
    - `root-of-sum`
    - `partial-factor`
- **State:** `{ algebra: { mat, rows?, cols?, cells?, pans?, moves, chips?, result } }`.
- **Pilots:** `alg-expressions-like-terms` (core), `alg-solve-linear` (`balance`), `num-index-laws` (`factors`).
- **Also serves:**
  - `alg-expand-factorise`, `alg-binomial-identities`, `alg-factorise-quadratics`
  - `alg-completing-square`, `alg-polynomial-division`, `alg-algebraic-fractions`
  - `num-surds`

## `solid-viewer` (#13, new): 3D solids (turn, unfold, fill, slice)
- **What it is:** a wireframe/flat-shaded solid drawn in SVG with its own small projection, with no Three.js (PLAN.md §0 says no heavy 3D on low-end phones). Drag or arrow keys turn it; dashed hidden edges can be toggled. Share the isometric helpers with `shape-board/iso.ts` by moving them into `engines/lib/iso-projection.ts`; the existing `geo-solids` studio stays on shape-board.
- **Solids:**
  - prisms (any polygon base), cylinders, pyramids, cones, spheres and hemispheres
  - cube towers
  - the five regular polyhedra
  - composites (stacked parts)
- **Modes**
  - **`turn`:** pick faces, edges, vertices or the base; `views` matches or draws front/side/top views on a grid.
  - **`unfold`:** animate the net open or closed. Each face shows its area, and the cylinder's side becomes a 2πr × h rectangle; the cone's side becomes a sector.
  - **`fill`:** pour layers of the base to build volume = base × height; a cone/pyramid poured into its prism shows the ⅓, a sphere into its cylinder the ⅔.
  - **`measure`:** highlight a hidden right triangle (space diagonal, slant height) and type lengths.
  - **`slice`:** move a plane through the solid and name the cross-section (extra studios only).
- **Checks (`solid`):**
  - `pick` (faces/edges/vertices/base)
  - `views` (grid cells)
  - `net`
  - typed `volume`/`area`/`length` with units
  - `section` (polygon kind)
  - Trap codes:
    - `visible-only` (hidden faces forgotten)
    - `wrong-base`
    - `area-for-volume` (units)
    - `no-third`
    - `slant-for-height`
    - `joint-face-counted`
    - `face-diagonal`
    - `views-swapped`
- **State:** `{ solid: { kind, turned, picked, unfolded, layers, views, section } }`.
- **Pilot:** `meas-prisms-volume-surface`.
- **Also serves:**
  - `meas-pyramid-cone-sphere`
  - `geo-spatial-views`
  - `geo-extra-solids`
  - Later phases: Phase 4 تجسم فضایی (Iran G10 هندسه ۱ ch.4), and 3D vectors and solids of revolution in Phase 5.

## `discrete-lab` (#19, new): sets, Venn diagrams, tables and trees
- **What it is:** element cards and set ovals inside a universal rectangle, in the page direction for text. Set notation `{…}` runs LTR inside, as formulas do (docs/NOTATION.md).
- **Modes**
  - **`venn`:**
    - two or three sets
    - drag cards into regions
    - write a set in braces from a card tray
    - nest ovals for ⊆
    - tap regions to shade A ∪ B, A ∩ B, A − B, A′
    - region counts instead of cards (`counts`) for enumeration and probability
    - `toTable` flips the same data into a two-way table and back
  - **`table`:** a two-way table with totals. The learner fills cells, totals or probabilities.
  - **Module `tree`:**
    - grow branches (outcomes per stage; `replace: false` changes the second stage)
    - write probabilities on branches
    - multiply along a path, add paths
    - count leaves for the product rule
    - frequency trees (UK)
  - **Not built in Phase 3:** `graph` (vertices, edges, degree; Ramsey colour game) and `clock` (modular arithmetic). They are planned for Phase 5; disc.graph is deferred.
- **Checks (`sets`):**
  - `members` (per set, any order, no repeats)
  - `regions` (cards per region or counts)
  - `shaded` (set expression)
  - `subset`
  - `table` (cells/totals)
  - `tree` (branches, path products, total)
  - `probability` (fraction)
  - Trap codes:
    - `order-matters` / `repeat` ({1, 2} vs {2, 1, 1})
    - `empty-vs-zero`
    - `element-vs-subset`
    - `difference-reversed`
    - `overlap-twice`
    - `only-vs-all` ("only A" vs A)
    - `outside-missed`
    - `added-along-branch`
    - `branches-not-one`
    - `replacement-ignored`
    - `sum-not-product` (counting)
- **State:** `{ sets: { regions, members, shaded, table, tree } }`.
- **Pilots:** `disc-sets-intro` (core), `prob-trees-counting` (`tree`).
- **Also serves:** `prob-venn-events`; Phase 4/5 conditional probability, counting, logic.

## `shape-board` modules (#9 Geometry board)
- **Module `dynamic`:** dynamic geometry on the existing board.
  - **Given points can be draggable** (`drag: [names]`), with constraints:
    - `on: line|circle|segment`
    - `parallelTo`
    - `fixed`
  - **Constructions stay attached** (a perpendicular bisector moves with its segment).
  - **`watch` shows live readouts:**
    - angles, lengths
    - ratios (AD/DB)
    - sums (∠A + ∠B + ∠C)
    - products (AP·PB)
    - trig ratios
  - **Why:** the learner sees an invariant hold while dragging, then answers the "why" question.
  - **Serves:**
    - parallel-line angles (pilot `geo-parallel-angles`)
    - triangle inequality and centres
    - Thales and similarity
    - circle angles and tangents
    - cyclic quadrilaterals, intersecting chords
    - trig ratios as constant ratios
  - **Checks:** extend `shape-board` with
    - `watch: { key, equals|sum|ratio }` (the learner's reading or typed value)
    - `dragged: n` (explored at least n positions before answering)
    - `invariant` (choose which quantity stayed the same)
    - Trap codes:
      - `not-parallel-assumed`
      - `co-interior-equal`
      - `part-whole` (Thales ratio)
      - `inscribed-equals-central`
      - `opposite-equal` (cyclic quadrilateral)
- **Module `proof`:** a proof panel under the board.
  - **Rows run given → statement → reason.** Statements are built by tapping marked parts on the figure (sides, angles); reasons come from a per-locale bank: «فرض», «زاویه‌های متقابل به رأس», «ض‌ض‌ض», «اجزای متناظر», … for fa-IR; Afghan terms in fa-AF/ps; SSS/SAS/ASA/RHS, "alternate angles", … in en.
  - **Congruence:** pick the criterion and the vertex correspondence (آب‌پ ≅ …).
  - **Counterexample:** a "counterexample" row lets the learner drag a figure that breaks a claim.
  - **Serves:** `geo-congruence` (pilot), `geo-proof-isosceles`, `geo-extra-right-triangle`; later Iran G10 هندسه ۱ استدلال.
  - **Checks (`proof`):**
    - `criterion`
    - `correspondence`
    - `steps` (every required statement present, each with an acceptable reason, in a valid order)
    - `counterexample` (the dragged figure satisfies the hypothesis and breaks the conclusion)
    - Trap codes:
      - `aaa`, `ssa`
      - `order` (vertices matched wrongly)
      - `circular` (conclusion used as a reason)
      - `looks-equal` (reason "from the picture")
      - `example-not-proof`
- **Base shape-board additions:**
  - `region` check: shaded cells inside a locus (`geo-loci`)
  - `show: area` squares on triangle sides (`geo-pythagoras`)

## Other modules of existing engines
- **`number-line` / `intervals`:**
  - A shaded ray or segment between endpoints, each endpoint open (hollow) or closed (filled). The learner toggles each endpoint and drags it.
  - Optional interval notation `[a, b)` per locale: Iran and Afghanistan show it, UK shows inequalities.
  - Sign rows under the line for a product or quotient of linear factors: zeros filled, poles hollow, +/− per interval.
  - Check `interval`:
    - `from`, `to`, `open`
    - `union` of intervals
    - `signs`
  - Trap codes:
    - `open-closed`
    - `wrong-direction`
    - `sign-not-flipped`
    - `pole-included`
  - Pilot `alg-inequalities`; also `alg-sign-tables`.
- **`chart-builder` / `summary`:** a dot plot / line-up of data cards.
  - The learner orders cards, taps the median (or the two middle cards), the mode stack and the range ends.
  - A value can be dragged out to see mean/median/range react; two dot plots for comparing.
  - Check `summary`: `median`, `mode`, `range`, `mean`, `best` (choose an average), `compare` (sentence frames).
  - Trap codes:
    - `unordered-median`
    - `mode-is-frequency`
    - `range-is-max`
    - `even-middle`
  - Pilot `stat-averages-range`; also `stat-compare-outliers`, `stat-extra-mean-deviation`.
- **`chart-builder` / `grouped`:**
  - Class intervals (`classes: [140, 145, …]`, closed on the left per Iran/Afghan convention, label per locale).
  - Sort values into classes, then fill the table with frequency, relative frequency, midpoint × frequency and running total.
  - Draw an equal-width histogram (bars touch), a frequency polygon at midpoints, and a cumulative frequency graph at class ends.
  - Check `grouped`: `table`, `histogram`, `polygon`, `cumulative`, `mean`.
  - Trap codes:
    - `boundary-twice`
    - `gap-bars`
    - `polygon-at-ends`
    - `mean-of-classes`
    - `width-not-midpoint`
  - Pilot `stat-grouped-histogram`; also `stat-grouped-mean-cumulative`.

## Phase 3 pilots and order
Build the 13 pilots in `waves.pilot` first: 4 new engines plus 9 new modules. Each must be designed so the later studios in the plan need configuration only. `wave1` uses only existing engines and can run in parallel with the pilots; waves 2–7 assume the pilots are merged.

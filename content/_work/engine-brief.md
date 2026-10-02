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

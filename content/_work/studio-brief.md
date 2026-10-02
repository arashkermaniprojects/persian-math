# Brief: writing Phase 2 studios on existing engines

You are writing studios for **Kamangir (کمانگیر)**, an offline-first math academy for Iranian and Afghan children, mostly inside their countries and on low-end Android phones.
- Default language: Iranian Persian (fa-IR). Also Dari (fa-AF), Pashto (ps) and English (en).
- Repo: /Users/arashkermanikolankeh/Documents/Work/Peojects/Persian_math, on branch `phase-2-primary`.
- **Don't commit or push.**

## Read first
- **docs/STUDIOS.md:** the formats, check types, the **Engine options** for each engine, and per-locale missions (`locales: [en]`).
- **docs/NOTATION.md:** Persian digits ۱۲۳ always in fa-IR, fa-AF and ps; Iran's decimal mark is "/" (so `{{frac:a/b}}`, never inline a/b); Afghanistan's is ","; formulas run left to right.
- **content/_work/phase2-studios.yaml:** your studios' plan entries (concepts, notes, grades, ages). Follow them; if a note conflicts with the engine's real abilities, adapt and say so.
- **The engine you use:**
  - `site/src/engines/<engine>.ts`
  - `site/src/engines/lib/*` for its options and its check
  - **its pilot studio** in `content/studios/` and `content/locales/*/studios/` as the model to copy: pilot ids are listed under `waves.pilot` in the plan, and the Phase 1 `frac-*` studios are the models for fraction-bars, number-line and long-division
  - its e2e spec in `site/e2e/`
- **content/glossary.json:** use `{{term:id}}` for math terms; Afghan terms come from the glossary.
- **How the textbooks teach your topics:** read the relevant lessons. Render a few pages with `pdftoppm -f P -l P -r 70 -png <pdf> <scratchpad>/<you>/x` and Read them, using the page numbers in the `curriculum/` and `curriculum_af/` outlines. Scratchpad: /private/tmp/claude-501/-Users-arashkermanikolankeh-Documents-Work-Peojects-Persian-math/f055c3ff-caea-4065-a25a-8e2d05968574/scratchpad

## Each studio
- **Files:**
  - `content/studios/<id>.yaml`, with `order` taken from the plan's order
  - full **fa-IR and en** text
  - **fa-AF and ps drafts** with `"_status": "draft"`
- **Missions:**
  - About 4, each Explore → Predict → Check → Justify.
  - A real "why" question and a model explanation.
  - Targeted feedback for the classic mistakes at that age.
- **Engine changes:** don't change engines unless a studio truly can't be built otherwise. If you must, keep changes small and additive, add tests, re-read the file right before editing (other agents may touch it), and report it.
- **Tone:**
  - **fa-IR:** warm and simple, addressed to the child with «تو», in Iranian textbook terms.
  - **fa-AF and ps:** polite «شما» and Afghan textbook terms.
  - **Grade 1–2 studios:** very short sentences and picture-first; use the engine `instruction` hints.
- **Contexts:**
  - Neutral daily life.
  - Names: علی، سارا، مریم، رضا، زهرا، احمد، فاطمه، حسن.
  - Currency: تومان/ریال (fa-IR), افغانی (fa-AF), افغانۍ (ps), £/p (en).
  - No political or religious imagery.
- **Curriculum differences:** where the countries' methods differ (e.g. the Afghan abacus, or UK-only content), use per-locale missions or per-locale engine labels.

## Tests
- `site/e2e/<id>.spec.ts` for each studio: a wrong and a right attempt on at least 2 missions; fa-IR and en; no horizontal scroll at 390px on every mission.

## Verify in isolation
Never use the shared `dist/` or port 4400, and never kill other processes' servers.
```sh
cd site && npx astro build --outDir dist-<you> && npx vitest run && KG_DIST=dist-<you> KG_PORT=<your port> npx playwright test e2e/<your specs>
```
Also run the full Playwright suite once at the end. If another agent's unfinished files fail, check that yours aren't the cause and say so.

## Check visually
Take Playwright screenshots of one mission per studio in fa-IR, plus one en, at 390px. Read them and fix problems. Delete `dist-<you>` at the end.

## When you're done, reply with
- per studio: id, missions (one line each), and which concepts each covers
- test results
- the screenshots you checked
- any engine changes
- anything you were unsure of

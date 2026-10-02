# Phase 3: where we stopped (2026-10-02)

Paused by the owner after module round 1 to save tokens. Nothing below is merged yet.

## State
- `phase-3-plan` @ 6f028e5 holds the plan plus the 4 new engines and their pilots (algebra-tiles, coord-plane,
  solid-viewer, discrete-lab). On that commit: build 155 pages, vitest 610/610, Playwright 491/491.
- **Module round 1 is built, tested and pushed, but not merged.** Every branch starts from 6f028e5:

| Branch | Engine / module | Pilot studio | Head |
|---|---|---|---|
| p3m-balance | algebra-tiles / balance | alg-solve-linear | b047821 |
| p3m-vectors | coord-plane / vectors | vec-directed-segments | dcde129 |
| p3m-tree | discrete-lab / tree | prob-trees-counting | bfe2e4c |
| p3m-dynamic | shape-board / dynamic | geo-parallel-angles | 32f7493 |
| p3m-intervals | number-line / intervals | alg-inequalities | d7c5f1d |
| p3m-summary | chart-builder / summary | stat-averages-range | d624e45 |

Each branch's own vitest and pilot e2e tests passed. In the 4-worker full Playwright runs (six agents at once),
a few older specs timed out under load. They are geo-constructions, num-divisibility-powers, fin-shopping-change,
ops-times-tables and alg-expressions-like-terms, and all passed when rerun alone.

## Next steps, in order
1. **Merge round 1** into `phase-3-plan` and run the full suite: build, vitest, Playwright (use fewer workers if the
   timeouts come back) and `python3 content/_work/check_phase3.py`. Then push.
   - Expected additive conflicts:
     - `site/src/lib/checks.ts`, `checks.test.ts` and `docs/STUDIOS.md`
     - `richtext.ts`/`.test.ts`: vectors adds `{{col}}`, intervals adds `{{interval}}`
     - `display.ts`: balance changes `algHTML` to stack `a/b`
   - Vectors also adds a `vec` strand (the 4 UI files and `pages/[locale]/path/[path].astro`).
   - `.wip-drafts/resolve_additive.py` keeps both sides (local only). Check test-file `});` closings and import
     unions by hand.
2. **Round 2 modules** (each reuses a round-1 engine): factors (num-index-laws, algebra-tiles), proof
   (geo-congruence, shape-board, builds on dynamic), grouped (stat-grouped-histogram, chart-builder).
3. **Waves 1–7** (52 studios, listed in `phase3-studios.yaml` → `waves`). Use one agent per group of related studios
   (same engine), not one per studio; this saves roughly 30–40% of tokens.

## Running agents
- Agent worktrees start at `main` (39d00cd). Tell each agent to `git checkout -b <branch>` and
  `git reset --hard <phase-3-plan head>` first.
- Have agents commit and `git push -u origin <branch>` after every step, so work survives a power cut.
- Give each agent its own `dist-<name>` folder and `KG_PORT` (4511+). Never use the shared `dist/` or port 4400.
- Briefs to give the agents: `engine-brief.md` (module specs) and `studio-brief.md` (studio rules); the repo path and
  branch named inside them are out of date.
- Cost: about 250–300k tokens per module agent. All of the rest of Phase 3 is about 10–15M tokens and 7–9 hours.

## Open follow-ups
- vec-directed-segments shows an "Afghanistan: grade 11" badge although the plan has `af: null`.
- Vectors and dynamic use Latin point letters A B C in every locale (as both countries' books do).
- Intervals uses «،» as the interval-end separator in fa-AF and ps.
- Balance: fractional answers can't be typed on the keypad; these mistakes are caught as states of the scale instead.
- The engine cores are above the ~15 KB guideline: chart-builder 19.7, shape-board 17.8, coord-plane 16.7 KB.
- UK grade badges read only UK_Y codes, so KS3/GCSE studios show no UK badge.
- All fa-AF and ps texts are `draft` and need a native-speaker review.
- Owner question: should fa-IR show interest (optional enrichment)?

## Local preview
`cd site && npx astro build --outDir dist-preview && python3 -m http.server 8000 -d dist-preview`, then open
http://localhost:8000/fa-IR/studio/<id>/. The site isn't hosted anywhere yet.

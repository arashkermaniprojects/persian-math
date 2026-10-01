# Concept graph — format

The concept graph is the curriculum backbone (PLAN.md §2–3).
- Each node is one **teachable idea**: small enough for one studio mission, big enough to recur across curricula.
- The Iran, Afghanistan and UK curricula are *paths* over these nodes.

## Files

```
content/concepts/<strand>.yaml   # one file per strand, list of nodes
content/strands.yaml             # strand ids, names in 4 locales, order
```

## Node

```yaml
- id: frac.add.unlike          # <strand>.<topic>[.<subtopic>], lowercase ascii, stable forever
  title: { fa-IR: "جمع کسرهای با مخرج متفاوت", en: "Adding fractions with different denominators" }
  age: [9, 11]                 # youngest/oldest typical age across the three curricula
  requires: [frac.equivalent, num.lcm]
  level: core                  # core | extension (gifted/Higher/A-level-only) | specialist (only one country's track)
  align:                       # entry keys from content/_work/entries.tsv (tools/entries.py)
    iran: [iran:G05_riazi_panjom:2:9c1e0b]
    af:   [af:AF_G05_riazi:5:4e7a21]
    uk:   [uk:UK_Y05:4:b8d2f0]
```

Rules:
- **`title`:** only fa-IR and en are needed at this stage. fa-AF and ps titles are produced from the glossary later.
- **`align`:** lists stable entry keys (`<cur>:<book>:<unit>:<hash6>`), never copied text. Run `tools/entries.py` to list them. The lists may be empty. A node that appears in only one curriculum is fine; that is exactly the superset.
- **One source lesson can map to several nodes,** e.g. Iranian «کسر» lessons often cover two ideas.
- **`requires`:** only direct prerequisites, and they must not form a cycle.
- **Strand ids:**
  - `num`: number and place value
  - `ops`: operations and fluency
  - `frac`: fractions, decimals, percent
  - `ratio`: ratio, proportion, rates
  - `fin`: financial
  - `alg`: algebra
  - `func`: functions and graphs
  - `seq`: sequences and series
  - `geo`: geometry, shape, angle, proof
  - `meas`: measures
  - `pos`: position and transformations
  - `trig`: trigonometry
  - `coord`: coordinate geometry and conics
  - `vec`: vectors
  - `mat`: matrices
  - `cplx`: complex numbers
  - `stat`: statistics
  - `prob`: probability and distributions
  - `calc`: calculus
  - `disc`: sets, logic, number theory, graphs, combinatorics
  - `mech`: mechanics
  - `numm`: numerical methods
  - `ps`: problem-solving strategies

## Coverage report

`tools/coverage.py` builds `docs/coverage.html`, a table of all nodes with an Iran/AF/UK grade column for each. It also lists every source lesson that is **not mapped** to any node. That list must be empty before Phase 0 is done.

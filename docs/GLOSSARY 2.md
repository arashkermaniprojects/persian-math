# Glossary (term base)

The glossary maps each math term to its word in **fa-IR, fa-AF (Dari), ps (Pashto) and en**. Page text never hard-codes a term; it writes `{{term:id}}`.

- **Source files:** `content/glossary/*.yaml`, one file per strand group.
- **Built output:** `content/glossary.json`, made by `tools/build_glossary.py`. The site reads this file.
- **Where each language's term comes from:**
  - **fa-IR:** the Iranian textbooks (`curriculum/`).
  - **fa-AF:** the Afghan Dari textbooks (`curriculum_af/AF_G*_riazi.md`).
  - **ps:** the Afghan Pashto textbooks. `curriculum_af/AF_G*_riazi_ps.md` is aligned line by line with the Dari outlines, and `content/_work/af_dari_pashto.tsv` holds the pairs.
  - **en:** the UK National Curriculum, GCSE and A-level statements (`curriculum_uk/`).
- **`src`:** records where each term was found, e.g. `AF_G05_riazi line 63` or `AF_G05_riazi_ps p.95`.
- **`status`:** fa-AF and ps entries are `draft` until a native math teacher reviews them. Reviewers should start with this file: one approval here fixes the term on every page.
- **When the countries differ:** if Iranian and Afghan usage differ (مجموعه/ست, میانگین/اوسط), each locale keeps its own textbook term; never "correct" Dari towards Iranian Persian.

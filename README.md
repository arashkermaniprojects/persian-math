# کمانگیر — Kamangir

An offline-first, interactive K12 math academy for Iranian and Afghan children. It covers the union of the Iranian, Afghan and English math curricula, in **Iranian Persian (default), Dari, Pashto and English**.

- [PLAN.md](PLAN.md): the full plan (audience, architecture, localisation, roadmap)
- [RESOURCES.md](RESOURCES.md): source curricula and where to get them
- `curriculum/`: Iranian textbook outlines (1405–1406), plus `iran_math.json`
- `curriculum_af/`: Afghan textbook outlines, plus `afghan_math.json`
- `tools/`: scripts that extract and build these

The source textbooks are copyrighted and are **not** in this repo. Fetch them locally:

```sh
./download_textbooks.sh          # Iran → textbooks/
./download_afghan_textbooks.sh   # Afghanistan (Dari + Pashto) → textbooks_af/
```

All lesson content in Kamangir is original. The textbooks are used only to align the topic sequence.

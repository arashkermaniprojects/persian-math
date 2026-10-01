# Iranian K12 Math — Curriculum Outline (1405–1406)

There is one `.md` per textbook, transcribed from the printed contents pages (فهرست), with page numbers. All files are merged into `iran_math.json` by `python3 tools/build_index.py curriculum curriculum/iran_math.json`.

## Grade → books

| Grade | Core book(s) | Extra |
|---|---|---|
| 1 | G01_riazi_aval (25 بخش, no titles) | G01_riazi_doost_dashtani_pilot (pilot, 6 picture units, not transcribed) |
| 2 | G02_riazi_dovom — 8 فصل / 48 درس | |
| 3 | G03_riazi_sevom — 8 / 48 | |
| 4 | G04_riazi_chaharom — 7 / 42 | |
| 5 | G05_riazi_panjom — 7 / 33 | |
| 6 | G06_riazi_sheshom — 7 / 33 | |
| 7 | G07_riazi_haftom — 9 / 40 | G07_gifted_supplement |
| 8 | G08_riazi_hashtom — 9 / 43 | G08_gifted_supplement |
| 9 | G09_riazi_nohom — 8 / 28 | G09_gifted |
| 10 | Math: riazi1 + hendese1 · Science: riazi1 · Humanities: riazi_amar1 | |
| 11 | Math: hesaban1 + hendese2 + amar_ehtemal · Science: riazi2 · Humanities: riazi_amar2 | |
| 12 | Math: hesaban2 + hendese3 + gosaste · Science: riazi3 · Humanities: riazi_amar3 | |

The lesson counts include «حل مسئله» and «مرور فصل» entries.

## Notes for building the site
- **Structure maps well onto Orco:** each grade has 7–9 chapters (فصل) with 3–6 lessons (درس) each, so one chapter can become one "studio" and one lesson one "mission".
- **Grades 10–12 have three tracks.** Grade 10 ریاضی (۱) is shared by the Math and Science tracks.
- **Each grade 1–6 chapter opens with a «حل مسئله» strategy lesson** (رسم شکل، الگوسازی، حدس و آزمایش …), a ready-made problem-solving strand.
- **Recurring strands** run across grades: عدد و الگو → کسر → اعشار → هندسه/اندازه‌گیری → آمار و احتمال → (from grade 7) جبر و معادله → (grade 10+) تابع، مثلثات، حد و مشتق.
- **Licensing:** the topic sequence is fine to follow, but write all lesson content yourself (see RESOURCES.md §4).

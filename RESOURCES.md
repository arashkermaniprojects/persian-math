# Iranian K12 Math — Source Resources

Goal: a Persian, Orco-Academy-style set of interactive browser studios aligned to the Iranian K12 math curriculum.
Reference model: https://orco-academy.pages.dev (grades 1–12, ~4 guided "missions" per studio, offline, no login).

## 1. Official textbooks (primary source) — academic year 1405–1406

Publisher: سازمان پژوهش و برنامه‌ریزی آموزشی. Distribution site: **chap.sch.ir** (اداره کل نظارت بر نشر و توزیع مواد آموزشی).
The PDFs are **not encrypted**, and the Persian text can be extracted with `pdftotext` (checked on C723).
To download all of them: `./download_textbooks.sh`.

Base URL: `http://chap.sch.ir/sites/default/files/lbooks/1405-1406/`

| Grade | Track | Book | Code | Page | PDF |
|---|---|---|---|---|---|
| 1 | — | ریاضی (اول) | 105 | [14145](http://chap.sch.ir/books/14145) | 8/C105.pdf (36 MB) |
| 1 | pilot | ریاضی دوست‌داشتنی (اجرای آزمایشی) | 1051 | [15023](http://chap.sch.ir/books/15023) | 8/C1051.pdf |
| 2 | — | ریاضی (دوم) | 205 | [14151](http://chap.sch.ir/books/14151) | 9/C205.pdf |
| 3 | — | ریاضی (سوم) | 305 | [14159](http://chap.sch.ir/books/14159) | 10/C305.pdf |
| 4 | — | ریاضی (چهارم) | 405 | [14168](http://chap.sch.ir/books/14168) | 12/C405.pdf |
| 5 | — | ریاضی (پنجم) | 505 | [14177](http://chap.sch.ir/books/14177) | 13/C505-New.pdf |
| 6 | — | ریاضی (ششم) | 605 | [14187](http://chap.sch.ir/books/14187) | 32/C605.pdf |
| 7 | — | ریاضی (هفتم) | 705 | [14199](http://chap.sch.ir/books/14199) | 555/C705.pdf |
| 7 | gifted | محتوای تکمیلی استعدادهای درخشان | 723 | [14213](http://chap.sch.ir/books/14213) | 555/C723.pdf |
| 8 | — | ریاضی (هشتم) | 805 | [14220](http://chap.sch.ir/books/14220) | 558/C805.pdf |
| 8 | gifted | محتوای تکمیلی استعدادهای درخشان | 823 | [14232](http://chap.sch.ir/books/14232) | 558/C823.pdf |
| 9 | — | ریاضی (نهم) | 905 | [14240](http://chap.sch.ir/books/14240) | 556/C905.pdf |
| 9 | gifted | ریاضیات ویژه استعداد درخشان | 923 | [14251](http://chap.sch.ir/books/14251) | 556/C923.pdf |
| 10 | Math & Science | ریاضی (۱) | 110211 | [14259](http://chap.sch.ir/books/14259) | 40/C110211.pdf |
| 10 | Math | هندسه (۱) | 110213 | [14260](http://chap.sch.ir/books/14260) | 29/C110213.pdf |
| 10 | Humanities | ریاضی و آمار (۱) | 110212 | [14272](http://chap.sch.ir/books/14272) | 43/C110212.pdf |
| 11 | Math | حسابان (۱) | 111214 | [14323](http://chap.sch.ir/books/14323) | 30/C111214.pdf |
| 11 | Math | هندسه (۲) | 111213 | [14322](http://chap.sch.ir/books/14322) | 30/C111213.pdf |
| 11 | Math | آمار و احتمال | 111215 | [14324](http://chap.sch.ir/books/14324) | 30/C111215.pdf |
| 11 | Science | ریاضی (۲) | 111211 | [14330](http://chap.sch.ir/books/14330) | 41/C111211.pdf |
| 11 | Humanities | ریاضی و آمار (۲) | 111212 | [14337](http://chap.sch.ir/books/14337) | 44/C111212.pdf |
| 12 | Math | حسابان (۲) | 112214 | [14362](http://chap.sch.ir/books/14362) | 711/C112214.pdf |
| 12 | Math | هندسه (۳) | 112213 | [14361](http://chap.sch.ir/books/14361) | 711/C112213.pdf |
| 12 | Math | ریاضیات گسسته | 112215 | [14363](http://chap.sch.ir/books/14363) | 711/C112215.pdf |
| 12 | Science | ریاضی (۳) | 112211 | [14359](http://chap.sch.ir/books/14359) | 712/C112211.pdf |
| 12 | Humanities | ریاضی و آمار (۳) | 112212 | [14360](http://chap.sch.ir/books/14360) | 710/C112212.pdf |

Note: the Iranian system splits into three tracks after grade 9 (ریاضی‌فیزیک، علوم تجربی، انسانی). Orco has one path from grade 10 to 12; this curriculum needs three.

## 2. Teacher guides (کتاب معلم / راهنمای تدریس)

These hold the learning objectives, teaching sequence and suggested activities, which are useful when designing the "missions." Most are **older editions** (1391–1402). Check each one against the current book.

| Grade / book | Page |
|---|---|
| 1 | [5103](http://chap.sch.ir/books/5103) (96-97) |
| 2 | [893](http://chap.sch.ir/books/893) |
| 5 | [3821](http://chap.sch.ir/books/3821) (94-95) |
| 6 | [4694](http://chap.sch.ir/books/4694) (95-96) |
| 9 | [3823](http://chap.sch.ir/books/3823) (94-95), [11070](http://chap.sch.ir/books/11070) (1401-1402) |
| ریاضی (۱) | [4748](http://chap.sch.ir/books/4748) |
| ریاضی (۳) | [7969](http://chap.sch.ir/books/7969) |
| ریاضی و آمار (۱) | [4689](http://chap.sch.ir/books/4689) |
| هندسه (۱) | [4676](http://chap.sch.ir/books/4676) |
| هندسه (۳) | [7017](http://chap.sch.ir/books/7017) |
| حسابان (۱) | [5841](http://chap.sch.ir/books/5841) |
| آمار و احتمال | [6176](http://chap.sch.ir/books/6176) |

Index of all teacher guides: http://chap.sch.ir/category/%D8%AF%D9%88%D8%B1%D9%87/682?field_year_tid=All
Gaps: no guide was found for grades 3, 4, 7 or 8, or for حسابان ۲, هندسه ۲ or گسسته. Search chap.sch.ir by hand for these.

## 3. Curriculum framework (equivalent of the English National Curriculum statements)

- سند برنامه درسی ملی (National Curriculum Document). Mathematics is one of its 11 learning areas. Overview: https://www.roshd.ir/omoumi/Content/سند-برنامه-درسی-ملی-چیست
- Critique of the math learning area in the national curriculum: http://ensani.ir/fa/article/273049
- Office of Textbook Authoring (دفتر تألیف): talif.sch.ir. It hosts the per-subject curriculum guides (راهنمای برنامه درسی ریاضی). **It could not be reached from outside Iran.**
- roshd.ir (the official educational content portal, including Roshd math magazines) returned **403 from outside Iran**. Use an Iranian connection or VPN.

## 4. Licensing caveat

Orco's curriculum statements are published under the UK Open Government Licence. Iranian textbooks are **copyrighted** by سازمان پژوهش و برنامه‌ریزی آموزشی and come with no open licence. Use them to align topics and objectives, and write original problems, text and visuals. Don't copy book pages or exercises word for word.

Each book carries an explicit notice (e.g. هندسه ۱, p. 4): «کلیه حقوق مادی و معنوی این کتاب متعلق به سازمان پژوهش و برنامه‌ریزی آموزشی ... است و هرگونه استفاده از کتاب و اجزای آن به صورت چاپی و الکترونیکی و ارائه در پایگاه‌های مجازی، نمایش، **اقتباس، تلخیص**، تبدیل، ترجمه ... بدون کسب مجوز از این سازمان ممنوع است».
In English: it forbids, without the organisation's permission, any print or electronic use of the book or its parts, publishing it on websites, and adapting, summarising, converting or translating it. So:
- A topic or lesson sequence, which is a curriculum fact, is reasonable to follow.
- Paraphrased lesson content, figures and exercises from the books carry real legal risk.
- If the site is public and closely mirrors the books, contact the organisation for permission (talif.sch.ir).

---

# Afghanistan — K12 Math in Dari (second source)

Researched 2026-10-01. Run `./download_afghan_textbooks.sh` to download them into `textbooks_af/`.

## Textbooks (official MoE, grades 1–12, single track)
Index page: https://moe.gov.af/dr/كتب-نصاب-تعليمى. All 12 links returned `200 application/pdf`.

Base URL: `https://moe.gov.af/sites/default/files/`

| Grade | Title | Path |
|---|---|---|
| 1–6 | ریاضی صنف اول … ششم | `2020-02/G{1..6}-Dr-Math.pdf` |
| 7, 9–12 | ریاضی صنف هفتم، نهم … دوازدهم | `2020-03/G{7,9,10,11,12}-Dr-Math.pdf` |
| 8 | ریاضی صنف هشتم | `2020-03/G8-Dr-Math_0.pdf` |

Pashto editions use the same pattern with `Ps` in place of `Dr` (not verified).

## Edition
- These are the **older series** (about 1396, reprinted 1398–1399 / 2017–2020).
- The 2018–2020 competency-based reform produced new books for grades 1–3 Dari language only; it produced none for math.
- Since 2022 the de facto MoE has distributed the pre-2021 books.
- Revised grade 1–6 math books are reportedly in progress (2025), but none are online.

## Teacher guides (رهنمای معلم ریاضی صنف ۱–۱۲)
- These are dead on moe.gov.af (404).
- Mirror: https://github.com/LiaBooks/Afghan-CurriculumBooks, under `files/2021-03/`. Filenames are irregular, for example `رهنمای معلم ریاضی، صنف اول.pdf`.

## Other
- Teacher-training material for grades 10–12 math: https://moe.gov.af/sites/default/files/2020-03/Final%20Math%20Grade%2010%20-12%20final%20Dari%20colar%204-7-13%20final.pdf
- MoE question bank, grades 1–6 (2025, 374 questions): `2025-03/سوالات مضمون ریاضی از صنف اول الی ششم.pdf`
- Curriculum Framework 2003 (English), available via Wayback: http://web.archive.org/web/20180827214324/http://www.ibe.unesco.org:80/curricula/afghanistan/af_alfw_2003_eng.pdf
- The 2018–2020 math syllabus (مفردات) was **not found** online.

## Licensing
No open licence is stated anywhere. Treat the books as government copyright and use them as a reference only.

## Iran vs Afghanistan for this project
- Iran has current editions (1405–1406), separate tracks for grades 10–12, and teacher guides on the official site, though with a strict "no adaptation" notice.
- Afghanistan has one book per grade (simpler to map to Orco's 1–12 structure). Its editions are older, and it uses Dari terms (صنف rather than پایه, for example).

## Afghan outlines
The outlines are in `curriculum_af/` (merged in `afghan_math.json`).
**`AF_G09_riazi.pdf` from moe.gov.af is truncated**: it has 133 pages and stops after chapter 4. Chapters 5–9 are missing, so look for a complete copy (Darakht Danesh, banfes.com).

## Afghan Pashto math textbooks (grades 1–12)
- **Source:** `https://moe.gov.af/sites/default/files/2020-03/G{1..12}-Ps-Math.pdf`. All 12 returned 200 and are downloaded to `textbooks_af/AF_GNN_riazi_ps.pdf` (≈216 MB) by `download_afghan_textbooks.sh`.
- **They are page-for-page translations of the Dari books.** Page counts match for grades 1–11, and grade 12 differs by one page. So Dari and Pashto terms can be aligned **by page**, which is ideal for building the glossary.
- **The Pashto grade 9 book is complete (240 pages),** unlike the truncated Dari grade 9 PDF (133 pages). Use it for chapters 5–9 of grade 9.
- **Many section headings include the English term,** e.g. «د سټونو تقاطع (Intersection of Sets)». This gives a three-way Pashto/Dari/English anchor for the glossary.
- **Text extraction is lossy for some Pashto letters.** The font maps ړ and ږ to digits, e.g. «لوم7ي» for «لومړي». Glossary terms need visual checking against rendered pages, or a per-font character fix-up table.

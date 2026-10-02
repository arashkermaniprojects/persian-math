# Notation guide: fa-IR, fa-AF (Dari), ps (Pashto), en (UK)

This guide sets the math notation for each of Kamangir's four locales. Every claim about Iranian or Afghan practice was checked against rendered page images of the textbooks in `textbooks/` and `textbooks_af/`. Text extraction was not trusted, because these PDFs map many digits to Latin code points. The `en` column follows UK school conventions and comes from general knowledge, not from a book.

**How to read the citations.** `(G04_riazi_chaharom.pdf p.70 [۶۴])` means **PDF page 70**, which is the page you pass to `pdftoppm -f 70`. The number in brackets is the page number printed in the book. The two differ by a fixed offset in each book:

| Book | PDF page = printed page + |
|---|---|
| G04_riazi_chaharom | 6 |
| G05_riazi_panjom | 0 |
| G06_riazi_sheshom | 8 |
| G07_riazi_haftom | 10 |
| G09_riazi_nohom | 8 |
| G11_hesaban1_math | 6 |
| AF_G03 / AF_G04 / AF_G05 / AF_G07 | 7 |
| AF_G06 / AF_G08 | 9 (G08: approximately) |

"Unverified" means the item was not seen in a book image.

---

## 1. Comparison table

| # | Convention | fa-IR (Iran) | fa-AF (Dari) | ps (Pashto) | en (UK) |
|---|---|---|---|---|---|
| 1a | Digits in text and formulas | Persian ۰–۹ at every grade checked (G04–G11). Exponents and subscripts are also Persian, e.g. `x۲`. | Persian ۰–۹ in grades 3–6. **Latin 0–9 from grade 7 on** (formulas and running text). Page numbers stay Persian. | Same split as Dari (grades 1–6 Eastern, grade 7+ Latin) | 0–9 |
| 1b | Shapes of 4, 5, 6 | Persian ۴ ۵ ۶ | Persian ۴ ۵ ۶ | **Varies by book.** In G04, running text shows Arabic-style ٤ and ٦ next to Persian ۵. G05 and G06 show Persian ۴ ۵ ۶. | – |
| 1c | Shape of zero | Small hollow circle `۰` | Dot `۰` | Dot `۰` | 0 |
| 1d | Latin digits seen? | Not in math content checked | Yes: grade 7+, and Gregorian dates in the G3 calendar | Same as Dari | – |
| 2a | **Decimal separator** | **Slash `/`**: `۱/۳`, `۰/۷`, `۴/۳ + ۲/۵`. Called «ممیز». | **Comma `,`** with Eastern digits (G6): `۰,۳`, `۲,۵`. Called «ممیزه». **Point `.`** with Latin digits (G7–G8): `2.32`. G10 mixes `,` and `.` on one page. | Same as Dari (`۰,۳`, called «ممیزه») | Point `.` |
| 2b | Thousands separator | Comma `,`: `۱,۰۰۰,۰۰۰,۰۰۰`. Often omitted, e.g. `۱۰۰۰۰۰۰`. | Comma `,`: `۱,۷۸۱,۴۳۵,۲۶۴`. It is the same glyph as the decimal comma, and inline rendering is bidi-garbled. | Usually none in examples: `۲۳۷۹۰۰۰` | Comma `,` |
| 3a | Multiplication | `×`. In algebra, `.` or juxtaposition (G7). | `×`. From G8, `·` may replace `×`. | Same as Dari | `×`; `·` or juxtaposition in algebra |
| 3b | Division sign | `÷` | `÷` | `÷` | `÷` |
| 3c | **Long division** | Dividend on the left. Divisor top-right, behind a vertical bar with a rule under it. Quotient below the divisor. Subtractions run down under the dividend. Grade 4 first stacks partial quotients (`۱۰ + ۲`). | Same layout ("gallows"). Parts are labelled مقسوم / مقسوم علیه / خارج قسمت / باقیمانده. | Same layout. Labels: مقسوم / مقسوم علیه / د وېش حاصل / پاتې | "Bus stop": divisor on the left outside the bracket, dividend inside, **quotient on top** |
| 4a | Fractions | Stacked | Stacked | Stacked | Stacked (`a/b` inline is acceptable) |
| 4b | Mixed numbers | Whole part on the **left**: `۱ ۳/۱۰` | Whole part on the **left**: `۲ ۵/۱۰` | Whole part on the **left** | 2¾, whole part on the left |
| 5a | Minus sign | On the **left** of the digits (`−۴`), stated explicitly in G07 p.14. Inline text is sometimes bidi-flipped. | Left of digits (`-5`) on the number line and in display formulas. Inline text is often bidi-flipped (`5+`). | Same as Dari | −3 |
| 5b | Number line | Left-to-right: 0 on the left, negatives on the left | Left-to-right: negatives on the left, positives on the right (stated in the text) | Same as Dari | Left-to-right |
| 6 | Algebra letters | **Latin** (a, n, x, y, P, S), with Persian digits mixed in: `۶n + ۷ = ۳۷`. Geometry points use Persian letters (آ, م, ب). | **Latin** letters with Latin digits (G8): `a×a=a²`. Geometry points in G5 use Persian letters (الف, ب, ج). | Same as Dari | Latin, italic |
| 6b | Formula direction | Display formulas are LTR | Display formulas are LTR. Inline equations are often visually RTL (bidi). | Same as Dari | LTR |
| 7a | Degree | `۴۵°`, sign to the right in diagrams. Running text shows `°۱۰` (bidi). | `۲۰°`, `۴۵°`, `۹۰°`, sign to the right. G10 uses `°`, `′`, `″`. | Same as Dari (unverified for Pashto specifically) | 45° |
| 7b | Percent | `٪`. Both `۱۶٪` (text) and `٪۱۶` (chart labels) appear. | `٪`. Both `(۳٪)` and `(٪ ۵)` appear on one page. Called «فیصد». | Same as Dari (`فیصده`) | 25% |
| 7c | Ratio | `۳ به ۵` or a fraction `۳/۵`. No colon seen. | Fraction, colon `۳ : ۴`, or `÷`: all three are named in the book. | Same as Dari (unverified on the Pashto page) | 3 : 4 |
| 8 | Calendar | Solar Hijri, Iranian names (فروردین … اسفند) | Solar Hijri, Arabic zodiac names (حمل … حوت) | Solar Hijri, Pashto names (وری … کب) | Gregorian |
| 9 | Currency | ریال and تومان | افغانی | افغانۍ (plural افغانیو) | £ and p (pounds and pence) |
| 10 | Grade label | پایه (پایهٔ چهارم) | صنف (صنف پنجم) | **ټولګی** (پنځم ټولګی) | Year (Year 5) |

---

## 2. Notes by item

### 1. Digits
- **Iran.** Persian digits are used everywhere: running text, formulas, tables, number lines, exponents and subscripts. Examples include `۴۸ | ۴` (G04_riazi_chaharom.pdf p.70 [۶۴]), `ax۲ + bx + c = ۰` with `x۱`, `x۲` (G11_hesaban1_math.pdf p.14 [۸]) and `۳ × ۱۰۸` (G09_riazi_nohom.pdf p.73 [۶۵]). Zero is drawn as a small hollow circle. No Latin digits appeared in the math content checked.
- **Dari.** Persian ۴ ۵ ۶ appear in grades 3–6, for example `۴۴۷ | ۲۱` (AF_G04_riazi.pdf p.78 [۷۱]). Zero is a dot. **From grade 7 the Afghan books switch to Latin digits** for all math: `I = {…, -1, 0, +1, …}` (AF_G07_riazi.pdf p.80 [۷۳]), `(+3) + (+4) = (+7)` (AF_G07_riazi.pdf p.84 [۷۷]), `2.32 = 2 + 0.3 + 0.02` (AF_G07_riazi.pdf p.119 [۱۱۲]) and `a×a=a²` (AF_G08_riazi.pdf p.167 [۱۶۰]). The surrounding text stays Dari and page numbers stay Persian. The G3 calendar shows Latin digits for Gregorian dates and Persian digits for Solar Hijri dates (AF_G03_riazi.pdf p.105 [۹۸]).
- **Pashto.** Digit shapes depend on the font. In AF_G04_riazi_ps.pdf, running text shows Arabic-style ٤ and ٦ but a Persian-style ۵ within a single number, e.g. `(۸۱۰۲۵۹٤)` (p.45 [۳۸]) and `د ٤٤٧`, `۱۲٦` (p.78 [۷۱]). The figures on the same page, which are shared with the Dari edition, use Persian ۴ ۶. AF_G05_riazi_ps.pdf p.32 [۲۵] and AF_G06_riazi_ps.pdf p.87 [۷۸] use Persian ۴ ۵ ۶ throughout. Grade 7+ uses Latin digits, as in Dari (AF_G07_riazi_ps.pdf p.80 and p.119).
  - **Recommendation:** store U+06F0–U+06F9 for fa-IR, fa-AF and ps alike. Let the Pashto font decide the glyph shapes of 4 and 6. A rendered image cannot show which code points the books used, so that part is *unverified*.
- **Product decision needed.** Should fa-AF and ps follow the books and use Latin digits from grade 7? The other option is to keep Eastern digits throughout for consistency.

### 2. Decimal and thousands separators
- **Iran: slash.**
  - `۱ ۳/۱۰ = ۱/۳`, `۲/۱۰ = ۰/۲`, `۷/۱۰ = ۰/۷`. The text names the mark «خطّ ممیز یا اعشار» (G04_riazi_chaharom.pdf p.110 [۱۰۴]).
  - It stays a slash in later grades: `۴/۳ + ۲/۵`, `۲/۲۸ + ۱/۴۷` (G05_riazi_panjom.pdf p.139), `۰/۲۵` and `× ۰/۷` (G05 p.147), and `۳/۶ × ۱۰۵` (G09_riazi_nohom.pdf p.73 [۶۵]).
  - Because the slash is also a fraction bar, **never render a fraction inline as `a/b` in fa-IR. Always stack it.**
- **Iran: thousands.** A comma: `۱,۰۰۰,۰۰۰,۰۰۰` (G05_riazi_panjom.pdf p.18) and `۹۰۰,۰۰۰` (G04_riazi_chaharom.pdf p.22 [۱۶]). The same page also writes `۱۰۰۰۰۰۰` with no separator.
- **Afghanistan, grades 1–6: comma.**
  - `۰,۳ = ۳/۱۰` (Dari) is read «صفر صحیح سه دهم». The text names the mark «ممیزه «,»», with ones, tens and so on to its left and tenths, hundredths and so on to its right (AF_G06_riazi.pdf p.75 [۶۶]).
  - Other examples: `۳×۲,۵ = … = ۷,۵` (AF_G06_riazi.pdf p.87 [۷۸]), and `۴۵۳ ÷ ۰,۳` with long division of `۱۰۹۲,۵۷` (AF_G06_riazi.pdf p.96 [۸۷]).
  - Pashto is identical, also naming the mark «ممیزه «,»» (AF_G06_riazi_ps.pdf p.75 [۶۶], p.87 [۷۸]).
- **Afghanistan, grade 7+: point.** `2.3125`, `0.412`, `−1.5` (AF_G07_riazi.pdf p.119 [۱۱۲]; AF_G07_riazi_ps.pdf p.119). Later books are inconsistent: AF_G10_riazi.pdf p.179 [۱۷۲] prints `sin 39° = 0.6293` and `cos 39° = 0,7771` on the same page.
- **Afghanistan: thousands.**
  - A comma: «عدد (۱,۷۸۱,۴۳۵,۲۶۴)» (AF_G04_riazi.pdf p.36 [۲۹]). In the printed line the digit groups appear **reversed** (`۲۶۴,۴۳۵,۷۸۱,۱`), which is a bidi error in the book.
  - The Pashto examples print large numbers without separators: `(۲۳۷۹۰۰۰) افغانۍ` (AF_G04_riazi_ps.pdf p.45 [۳۸]).
  - Since `,` is also the Afghan decimal mark, **recommend no thousands separator, or a thin space, in fa-AF and ps.**

### 3. Operators and long division
- **× and ÷.**
  - Iran: `۵ ÷ ۳ = ۵ × ۱/۳` and `۷ ÷ ۴ = ۷ × ۱/۴ = ۷/۴ = ۱ ۳/۴` (G05_riazi_panjom.pdf p.59).
  - Afghanistan: `۴×۷=۲۸` (AF_G03_riazi.pdf p.124 [۱۱۷]) and `۶۴۲۳ ÷ ۱۲۲ = ?` (AF_G05_riazi_ps.pdf p.32 [۲۵]).
- **Multiplication dot.**
  - Iran G7 says that algebra usually writes multiplication with «.» or parentheses and avoids `×` because it can be confused with the letter x. It shows `xy, x.y, x(y), (x)y, (x)(y)` (G07_riazi_haftom.pdf p.41 [۳۱]).
  - Afghan G8: «از این به بعد علامت (×) را به علامت (·) می‌توانید نشان دهید» (AF_G08_riazi.pdf p.16 [۹]).
- **Long division in Iran** (G04_riazi_chaharom.pdf p.70–71 [۶۴–۶۵]):
  ```
  ۴۸ │ ۴          ← dividend left, divisor right, vertical bar between them
  -۴۰ ‾‾‾‾        ← horizontal rule under the divisor only
  ‾‾‾  ۱۰         ← quotient written UNDER the divisor
   ۸   +۲         ← grade 4: partial quotients stacked and summed
  -۸   ‾‾
  ‾‾   ۱۲
   ۰
  ```
  - The compact form (one quotient line, subtractions under the dividend) appears in `۷۴۵ | ۳ → ۲۴۸` (G06_riazi_sheshom.pdf p.60 [۵۲]) and `۲۴۳۹ | ۱۹` (p.61 [۵۳]).
  - The same layout is used for polynomial division: `۲x۲ − ۷x − ۱۵ | x − ۵` (G09_riazi_nohom.pdf p.135 [۱۲۷]).
  - This is the "potence" layout used in France and Latin America. It is **not** the UK bus stop.
- **Long division in Afghanistan.**
  - The structure is the same, with labelled parts: `۴۴۷ | ۲۱` with quotient `۲۱` under the divisor and remainder `۶`. The labels are مقسوم (dividend), مقسوم علیه (divisor), خارج قسمت (quotient) and باقیمانده (remainder) (AF_G04_riazi.pdf p.78 [۷۱]).
  - Grade 3 introduces it with a "bring-down" arrow: `۹۸ | ۷ → ۱۴` (AF_G03_riazi.pdf p.124 [۱۱۷]). Partial quotients are not used.
  - Pashto keeps the identical figure and relabels the parts مقسوم / مقسوم علیه / د وېش حاصل / پاتې (AF_G04_riazi_ps.pdf p.78 [۷۱]; also AF_G05_riazi_ps.pdf p.32 [۲۵], `۱۷۶۴۳۲ | ۳۰۵ → ۵۷۸`).
- **UK (en).** Bus-stop short and long division: `  ⟌` with the divisor outside on the left, the dividend under the bracket, and the quotient written above the dividend.
- **Implication.** The long-division widget needs two layouts. One is the "gallows" layout for fa-IR, fa-AF and ps, with the quotient under the divisor on the right. The other is the bus stop for en. Note that the gallows layout is itself LTR (dividend on the left) even inside RTL pages.

### 4. Fractions and mixed numbers
- **Stacked fractions are used everywhere.** Mixed numbers put the whole part on the **left** of the fraction in all three Eastern-script locales.
  - Iran: `۱ ۳/۱۰ = ۱/۳` (G04_riazi_chaharom.pdf p.110 [۱۰۴]) and `= ۱ ۳/۴` (G05_riazi_panjom.pdf p.59).
  - Dari: `۲,۵ = ۲ ۵/۱۰` and `۳×۲ ۵/۱۰` (AF_G06_riazi.pdf p.87 [۷۸]).
  - Pashto: the same expression (AF_G06_riazi_ps.pdf p.87 [۷۸]).
- **The left-hand position of the whole part is fixed.** What varies is the order of an inline equation: Iran writes `۷/۱۰ = ۰/۷` (LTR), while the Afghan running text displays `۲,۵ = ۲ ۵/۱۰` (RTL order). See item 6.

### 5. Negative numbers and the number line
- **Iran.**
  - Explicit rule: «برای نمایش قرینهٔ هر عدد از نماد «−» در سمت چپ آن عدد استفاده می‌کنیم» ("to show the opposite of a number we put the − symbol on its left").
  - The number line runs LTR from `−۷` to `+۷`, with negatives on the left (G07_riazi_haftom.pdf p.24 [۱۴]).
  - Number lines in earlier grades are also LTR with 0 on the left (G04_riazi_chaharom.pdf p.106 [۱۰۰]; G05_riazi_panjom.pdf p.139, p.147).
  - In a summary box on the same G07 page, the inline expressions come out bidi-scrambled (`+۷ = ۷`, `۳ = +۳`).
- **Afghanistan.**
  - The number line is LTR. The text states that numbers right of zero carry `+` and numbers left of zero carry `−` (AF_G07_riazi.pdf p.80 [۷۳], p.84 [۷۷]).
  - In display formulas the sign is on the left (`(+3) + (+4) = (+7)`).
  - In running text the sign often lands on the right («عدد 5+ را با عدد 2+ جمع نموده», AF_G07_riazi.pdf p.84 [۷۷]). This is a bidi artifact, not a convention.
  - Pashto is identical (AF_G07_riazi_ps.pdf p.80 [۷۳]).
- **Implication.** Always render signed numbers in an LTR isolate (`<bdi dir="ltr">` or U+2066…U+2069) so that the minus sign stays on the left.

### 6. Algebra and formula direction
- **Iran.**
  - Latin letters (upright in G7, italic in G11) are mixed with Persian digits: `۴a`, `a+a+a+a=۴a`, `۳x−۷`, `۵z`, `m × ۵n`, `۴ + p/q` (G07_riazi_haftom.pdf p.41 [۳۱]).
  - Equations: `۶n + ۷ = ۳۷`, `۸x−۷ = ۱۷`, `۵(x+۲) = ۴۰` (G07 p.47 [۳۷]).
  - Higher grades: `S = x۱ + x۲ = −b/a`, `P = c/a` (G11_hesaban1_math.pdf p.14 [۸]).
  - Geometry labels use Persian letters (زاویهٔ «آ م ب», G07 p.24 [۱۴]).
  - All display formulas run LTR. In tables the expressions are written LTR with a trailing `=` on the right: `۲۷ − ۳۹ =` (G07 p.30 [۲۰]).
- **Afghanistan.**
  - Latin letters with Latin digits: `a + 5`, `a×a=a²`, `(1/2)²` (AF_G08_riazi.pdf p.167 [۱۶۰]; Pashto the same: AF_G08_riazi_ps.pdf p.167).
  - Geometry labels in G5 use Persian letters (الف، ب، ج), e.g. «زاویهٔ (الف ب ج)» (AF_G05_riazi.pdf p.60 [۵۳]). G8 uses Latin labels (a), (b) (AF_G08_riazi.pdf p.16 [۹]).
  - Display formulas run LTR. Inline equations inside Dari or Pashto sentences often display in RTL order, e.g. «در نتیجه ۷,۵ = ۲,۵ × ۳» (AF_G06_riazi.pdf p.87 [۷۸]) and «7 = 4 + 3» (AF_G07_riazi.pdf p.84 [۷۷]). This is uncontrolled bidi, not a convention to copy.
- **Recommendation for all RTL locales.** Typeset every formula, inline or display, as an LTR island (MathML/KaTeX with `dir="ltr"`). Map digits to Persian in fa-IR, and to Persian in fa-AF/ps grades 1–6 (see the decision in item 1).

### 7. Angles, percent, ratio (and time)
- **Degrees.**
  - Iran: diagrams show `۴۰°`, `۱۳۵°`, `۴۵°` with the sign on the right (G07_riazi_haftom.pdf p.24 [۱۴]). Running text in G04 prints «ده درجه را به صورت °۱۰ می‌نویسیم», where bidi puts the sign on the left (G04_riazi_chaharom.pdf p.88 [۸۲]).
  - Afghanistan: «علامت درجه (°) … ۲۰° (بیست درجه)، ۴۵°، ۹۰°», sign on the right (AF_G05_riazi.pdf p.60 [۵۳]). Minutes and seconds use `′` and `″` (AF_G10_riazi.pdf p.179 [۱۷۲]).
  - **Use `n°` inside an LTR isolate.**
- **Percent.**
  - Iran: «۱۶ درصد را به صورت ۱۶٪ می‌نویسیم», with the sign visually right of the digits. The pie chart on the same page labels `٪۱۶`, `٪۳۳`, with the sign on the left (G05_riazi_panjom.pdf p.93).
  - Afghanistan: «(۳٪) یا پنج فیصد (٪ ۵)», both orders in one paragraph (AF_G06_riazi.pdf p.138 [۱۲۹]). Pashto is the same (AF_G06_riazi_ps.pdf p.138 [۱۲۹]).
  - **Recommend `۱۶٪` (digits then U+066A, displayed with the sign on the right, i.e. LTR order) for all RTL locales.**
- **Ratio.**
  - Iran: «نسبت … ۳ به ۵ یا ۳/۵» (G05_riazi_panjom.pdf p.78), and ratio tables (G06_riazi_sheshom.pdf p.120 [۱۱۲]). A colon ratio was not seen in the Iranian pages checked (*unverified* whether it is used at all).
  - Afghanistan names three forms: «برای نشان دادن نسبت بین دو عدد از خط کسری، یا از علامت (:) و یا از علامت (÷) … ۳/۴، ۳ ÷ ۴، ۳ : ۴» (AF_G06_riazi.pdf p.119 [۱۱۰]).
- **Time (extra).** Iran writes clock times as `۷:۱۰′` and durations as `۱:۵۹′:۳۵″`, with prime marks for minutes and seconds (G05_riazi_panjom.pdf p.27).

### 8. Calendar (Solar Hijri months)
| # | fa-IR | fa-AF (Dari) | ps (Pashto) |
|---|---|---|---|
| 1 | فروردین | حمل | وری |
| 2 | اردیبهشت | ثور | غویی |
| 3 | خرداد | جوزا | غبرګولی |
| 4 | تیر | سرطان | چنګاښ |
| 5 | مرداد | اسد | زمری |
| 6 | شهریور | سنبله | وږی |
| 7 | مهر | میزان | تله |
| 8 | آبان | عقرب | لړم |
| 9 | آذر | قوس | لیندۍ |
| 10 | دی | جدی | مرغومی |
| 11 | بهمن | دلو | سلواغه |
| 12 | اسفند | حوت | کب |

- **fa-IR: all 12 confirmed** in a month table running RTL from فروردین to اسفند (G04_riazi_chaharom.pdf p.153 [۱۴۷]). مهر–اسفند are confirmed again on G04 p.151 [۱۴۵].
- **fa-AF and ps: all 12 confirmed.** The «معرفی جنتری» lesson prints each month header as «Dari – Pashto ۱۳۸۵», e.g. «حمل – وری ۱۳۸۵» and «جدی – مرغومی ۱۳۸۵» (AF_G03_riazi.pdf p.105–106 [۹۸–۹۹]).
  - The Pashto edition reuses the same calendar images under the lesson title «د کلیزې یا جنتري پېژندنه» (AF_G03_riazi_ps.pdf p.106–107 [۹۹–۱۰۰]).
  - In this font the book prints 9 as «لیندی» (no visible ۍ). The table uses standard spelling.
  - The calendars put Saturday on the right, and each cell also shows the Gregorian and Hijri-Qamari dates.
- **Page alignment.** The Pashto G3 book is **one page behind the Dari book here**. It is not strictly page-for-page. The G4, G5, G6, G7 and G8 pages checked did align.
- **en:** Gregorian (January–December).

### 9. Currency
- **fa-IR.**
  - ریال: «ارزش پول‌ها را به ریال بنویسید» (G04_riazi_chaharom.pdf p.22 [۱۶]).
  - تومان: in word problems such as «۳۵۰۰۰ تومان» (G07_riazi_haftom.pdf p.21 [۱۱]).
  - Both are common (by text-extraction count, G04 has 27 تومان and 11 ریال). One word problem in G04 also uses «قیمت به دلار» (p.151 [۱۴۵]).
- **fa-AF:** افغانی, e.g. «عبدالله ۸۰ افغانی … ۲۰ افغانی» (AF_G06_riazi.pdf p.118 [۱۰۹]) and «۱۰ فیصد ۱۰۰ افغانی» (p.138 [۱۲۹]).
- **ps:** افغانۍ in the singular and افغانیو in the plural (AF_G06_riazi_ps.pdf p.138 [۱۲۹]; AF_G04_riazi_ps.pdf p.45 [۳۸]).
- **en:** £ and p (unverified; from general knowledge).

### 10. Grade labels
- **fa-IR: «پایه».** The G04 introduction reads «کتاب ریاضی پایه ی چهارم» (G04_riazi_chaharom.pdf p.4; found by text extraction only), and a word problem has «دانش‌آموز پایهٔ هفتم» (p.151 [۱۴۵]).
- **fa-AF: «صنف».** The title page reads «ریاضی — صنف پنجم» (AF_G05_riazi.pdf p.1, p.3).
- **ps: «ټولګی».** The title page reads «ریاضي — پنځم ټولګی», and the colophon has «ټولګی: پنځم» (AF_G05_riazi_ps.pdf p.3, p.4). It is spelled with ټ (U+067C), ګ (U+06AB) and a final ی (U+06CC).
- **Related words.** Lesson: درس in Iran and Dari, لوست in Pashto (AF_G03_riazi_ps.pdf p.105). Percent: درصد in Iran, فیصد in Dari, فیصده in Pashto.
- **en:** "Year" (England, e.g. Year 5).

---

## 3. Implementation checklist
1. **Formulas.** Render every number, signed number, percent, degree and formula in an LTR isolate. Both national textbooks show bidi damage where they did not do this: flipped signs, reversed thousands groups, and `°` and `٪` on the wrong side.
2. **Per-locale number formatter.**
   - fa-IR: Persian digits, decimal `/`, thousands `,` or none.
   - fa-AF and ps: Persian digits, decimal `,`, no thousands separator (pending the grade-7 decision).
   - en: `.` and `,`.
   - Do **not** use the CLDR defaults blindly. CLDR uses `٫` (U+066B) for fa, which matches neither textbook.
3. **No inline slash fractions in fa-IR.** The slash is the decimal mark there, so always stack fractions.
4. **Long-division component.** Build a "gallows" variant (fa-IR, fa-AF, ps) and a "bus stop" variant (en). Iran grade 4 additionally needs a partial-quotient mode.
5. **Algebra letters.** Use Latin letters in all locales. Geometry point labels: آ/ب/ج… in fa-IR, الف/ب/ج… in fa-AF and ps (lower grades), A/B/C in en.

## 4. Unverified or open items
- The code points behind the Pashto ٤/٦ glyphs (font substitution versus Arabic-Indic code points).
- Whether Iran uses a colon ratio anywhere.
- Pashto-specific degree and ratio pages (they are assumed identical to Dari because the editions are translations; only the percent, decimal, division, algebra and calendar pages were checked in Pashto).
- The UK column is from general knowledge.
- The page offset for AF_G08 is approximate. Only p.16 and p.167 were checked.


## Decisions
- **Digits (owner decision, 2026-10-02):** fa-IR, fa-AF and ps always use Persian digits ۰۱۲۳۴۵۶۷۸۹, at every grade, with no Latin-digit setting. This holds even though Afghan books switch to Latin digits from grade 7.

## Charts
Checked on rendered pages of G02_riazi_dovom.pdf ch. 8 (PDF page = printed + 6), G03_riazi_sevom.pdf ch. 7 (PDF page = printed page) and G04_riazi_chaharom.pdf ch. 7.
- **Charts run left to right in every locale, and the value axis is on the left and goes up.** This holds for both the axes and the order of the categories.
  - Bar charts: the axis arrows point up and to the right, and the categories go from left to right in the order of the table, e.g. شنبه … جمعه (G02_riazi_dovom.pdf p.137 [۱۳۱], p.145 [۱۳۹]; G03_riazi_sevom.pdf p.127; G04_riazi_chaharom.pdf p.150 [۱۴۴]).
  - Pictograms in columns go left to right (G02 p.142 [۱۳۶], p.144 [۱۳۸]). In pictograms drawn as table rows, the pictures start at the left and the part picture is at the right end (G02 p.143 [۱۳۷]). Each one has a key: «هر ■ یعنی ۱۰ کتاب» (G03 p.127).
  - Line graphs: time runs left to right, and the value axis may start above 0, with a note that the values start at ۱۰۰ (G04 p.151 [۱۴۵]).
- **Only tables follow the page direction.** Frequency tables and tally tables put their first column on the right (G02 p.134–135 [۱۲۸–۱۲۹]). Inside a cell, tally marks still run left to right in groups of five, with the fifth stroke drawn across the other four (G02 p.135 [۱۲۹]; G03 p.128).
- **Pie charts** start at 12 o'clock and go clockwise. In G3 the learner colours equal sectors: 12 for the hours of a day, 10 for 10 spins, 8 for 80 books (G03 p.124–127). The legend is a list of «نام: رنگ» entries.
- **Our rule (`chart-builder`).**
  - Every chart is drawn inside an LTR box in every locale, as on the number line.
  - Labels use the locale's digits and words.
  - Only the frequency table and the legend follow the page direction.
  - This matches the books. The idea that categories run right to left in RTL locales was not seen in any Iranian book checked.
  - Afghan and UK chart pages were not checked (*unverified*). UK practice is the same left-to-right layout.

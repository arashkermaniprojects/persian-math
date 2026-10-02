# Contributing to Kamangir · مشارکت در کمانگیر

Thank you for helping. Kamangir is a free, offline-first math academy for Iranian and Afghan children, in **Iranian Persian, Dari, Pashto and English**. Most of the help we need is **not programming**.

[فارسی در پایین همین صفحه](#فارسی)

## Ways to help

| You are… | You can… | Where to start |
|---|---|---|
| **An Afghan teacher (Dari or Pashto)** | Review math terms and studio texts. This is our most urgent need: Dari and Pashto stay hidden from children until a native teacher approves them. | [Reviewing Dari and Pashto](#reviewing-dari-and-pashto) |
| **An Iranian teacher** | Check that missions fit the grade, the tone is right and the terms match the books | Open an issue: **"Mistake or suggestion in a studio"** |
| **A math educator** | Suggest missions and the common mistakes children make | Open an issue: **"Suggest a studio or mission"** |
| **A developer** | Fix bugs, improve engines, build new ones | [For developers](#for-developers) |
| **A designer or illustrator** | Make studios friendlier for young children | Open an issue or a discussion |
| **Anyone with a low-end Android phone** | Test studios and offline use, and report what breaks | Open an issue: **"Bug"** |

Look for issues labelled **`good first issue`**, **`review-dari`**, **`review-pashto`** and **`help wanted`**.

## Reviewing Dari and Pashto
You don't need GitHub skills for this.

1. **The glossary first:** about 500 math terms, each with its Iranian, Dari, Pashto and English word, and the textbook page where we found it.
   - The reviewer page (`/review/glossary/` in the reviewer build) lets you correct a word and tick "approve".
   - Click "download corrections" and send us the file, either by attaching it to an issue labelled `review-dari` / `review-pashto`, or through the [contact](#contact) below.
2. **Then studio texts.** We will send you a studio's text side by side with Iranian Persian.

We use the words of the **Afghan textbooks** (for example «ست»، «اوسط»، «فیصد»). Please don't change them to Iranian words, and the other way round.

## Rules for all content
- **Original work only.** Never copy text, exercises or pictures from school textbooks, which are copyrighted. Use the books to understand *what* is taught at each grade, then write your own.
- **Neutral contexts:** daily life, nature, markets, sport. No political or religious imagery, and nothing that could put a child, or the site, at risk.
- **Persian digits ۱۲۳** in Iranian Persian, Dari and Pashto. Formulas run left to right. Never write fractions as a/b, because "/" is the Iranian decimal mark. See [docs/NOTATION.md](docs/NOTATION.md).
- By contributing, you agree that your contribution is licensed under **CC BY-SA 4.0** (content) or **MIT** (code). See [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

## Your safety and privacy
- **You can contribute under a pseudonym.** You never need to use your real name.
- If you live in Iran or Afghanistan and prefer not to use GitHub, send files through the [contact](#contact) below.
- Kamangir itself collects no data about learners: no accounts, no tracking, no network calls after a page loads.

## For developers
```sh
git clone https://github.com/arashkermaniprojects/persian-math.git
cd persian-math/site
npm install
npm run build                 # Iranian Persian + English
PUBLIC_PREVIEW=1 npm run build   # also Dari + Pashto (drafts), for reviewers
python3 -m http.server -d dist   # open http://localhost:8000
npx vitest run                # unit tests
npx playwright test           # browser tests (uses your installed Chrome)
```
Read first:
- [PLAN.md](PLAN.md): the architecture and roadmap.
- [docs/STUDIOS.md](docs/STUDIOS.md): how studios, missions, checks and engines work. To add an engine, add one file; it registers itself.
- [docs/CONCEPTS.md](docs/CONCEPTS.md): the concept graph. [docs/GLOSSARY.md](docs/GLOSSARY.md): the term base.

Pull requests should:
- Pass `npm run build`, `npx vitest run` and `npx playwright test`.
- Keep engines dependency-free, offline and RTL/LTR-safe, with 44px touch targets and no horizontal scroll at 390px.
- Not hard-code math terms in any language; use `{{term:id}}`.

## Contact
- **Public:** [Issues](https://github.com/arashkermaniprojects/persian-math/issues) and [Discussions](https://github.com/arashkermaniprojects/persian-math/discussions).
- **Private** (to send files outside GitHub, or for code-of-conduct reports): open a discussion asking a maintainer for a private channel. Don't post personal details publicly.

---

<div dir="rtl" lang="fa">

## فارسی

از این‌که می‌خواهید کمک کنید سپاسگزاریم. کمانگیر یک آکادمی ریاضی رایگان و بدون نیاز به اینترنت برای کودکان ایرانی و افغان است، به زبان‌های فارسی، دری، پشتو و انگلیسی. **بیشتر کمکی که لازم داریم برنامه‌نویسی نیست.**

**چه کمکی می‌توانید بکنید؟**
- **معلم افغان (دری یا پشتو):** واژه‌ها و متن‌ها را بازبینی کنید. این مهم‌ترین نیاز ماست، چون متن دری و پشتو تا وقتی یک معلم آن را تأیید نکند به کودکان نشان داده نمی‌شود.
- **معلم ایرانی:** بررسی کنید مأموریت‌ها با پایهٔ تحصیلی جور است و لحن و اصطلاحات درست است.
- **کارشناس آموزش ریاضی:** مأموریت پیشنهاد کنید و بگویید بچه‌ها معمولاً کجا اشتباه می‌کنند.
- **برنامه‌نویس، طراح، یا هر کسی با یک گوشی اندرویدی ساده:** کمک کنید، طراحی کنید، یا آزمایش کنید و مشکل‌ها را گزارش دهید.

**قاعده‌ها:**
- فقط کار اصیل؛ از کتاب‌های درسی رونویسی نکنید.
- زمینه‌های بی‌طرف و روزمره.
- رقم‌های فارسی ۱۲۳.

**امنیت شما:** می‌توانید با نام مستعار مشارکت کنید. اگر نمی‌خواهید از گیت‌هاب استفاده کنید، از راه [تماس](#contact) فایل بفرستید.

</div>

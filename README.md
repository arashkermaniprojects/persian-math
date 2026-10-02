<div align="center">

# کمانگیر · Kamangir

**A free, open-source math academy for Iranian and Afghan children**
**آکادمی ریاضی رایگان و متن‌باز برای کودکان ایرانی و افغان**

Iranian Persian · دری · پښتو · English

[Contribute](CONTRIBUTING.md) · [Plan](PLAN.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Licences](LICENSE-CONTENT.md)

</div>

---

Kamangir teaches K–12 math through short interactive **studios**. Children shade fraction bars, place points on number lines, do long division the way their own textbooks lay it out, build charts, and explain *why* their answer is right.

It covers **the Iranian, Afghan and English curricula together**. Each child follows their own country's path through one shared map of 678 math topics.

### Built for children inside Iran and Afghanistan
- **Works offline.** After one visit the whole site works without internet. There's also a small download (under 1 MB) that runs from an SD card or USB stick.
- **For cheap Android phones:** light pages and big touch targets.
- **Safe:** no accounts, no tracking, no data collection. Progress stays on the device.
- **Four languages, done properly.**
  - Right-to-left layout, with Persian digits ۱۲۳.
  - Each country's own math words (مجموعه / ست, میانگین / اوسط) and writing conventions (Iran writes 2.5 as ۲/۵, Afghanistan as ۲,۵).
  - Each country's calendar month names.

### Status
- **Phase 0 (done):** the curriculum map, a 4-language glossary of about 500 terms, and the notation guide.
- **Phase 1 (done):** 8 fraction studios.
- **Phase 2 (in progress):** about 60 primary-school studios on 15 interactive engines.
- Dari and Pashto texts exist as **drafts** and are shown to children only after a native teacher approves them.

## 🙌 We need you
Most of the help we need is **not code**:
- **Afghan teachers (Dari and Pashto):** review math terms and lesson texts. This is the most urgent need, and it doesn't require GitHub skills.
- **Iranian teachers and math educators:** check grade fit and tone, and suggest missions.
- **Developers, designers, and testers with low-end phones.**

👉 Start with **[CONTRIBUTING.md](CONTRIBUTING.md)**. Contributing under a pseudonym is welcome.

## Run it locally
```sh
cd site && npm install && npm run build && python3 -m http.server -d dist
```
Then open http://localhost:8000.

## Licences
- **Code:** [MIT](LICENSE).
- **Educational content:** [CC BY-SA 4.0](LICENSE-CONTENT.md).
- **School textbooks are not included.** They are copyrighted; Kamangir's lessons are original and only follow the curricula's topic order.

---

<div dir="rtl" lang="fa">

## دربارهٔ کمانگیر

کمانگیر ریاضی دبستان تا دبیرستان را با **کارگاه‌های** کوتاه و تعاملی آموزش می‌دهد. بچه‌ها نوار کسر را رنگ می‌کنند، نقطه را روی محور اعداد می‌گذارند، تقسیم را همان‌طور که در کتاب خودشان آمده انجام می‌دهند، نمودار می‌سازند و توضیح می‌دهند *چرا* پاسخشان درست است.

برنامه‌های درسی **ایران، افغانستان و انگلستان** با هم پوشش داده شده‌اند. هر کودک مسیر کشور خودش را دنبال می‌کند.

**برای کودکان داخل ایران و افغانستان ساخته شده است:**
- بدون اینترنت کار می‌کند.
- روی گوشی‌های ساده سبک است.
- هیچ حسابی لازم ندارد و هیچ داده‌ای جمع نمی‌کند.

### به کمک شما نیاز داریم
- **معلمان افغان (دری و پشتو):** واژه‌ها و متن‌ها را بازبینی کنید. این مهم‌ترین نیاز ماست و به دانستن گیت‌هاب نیازی ندارد.
- **معلمان ایرانی و کارشناسان آموزش ریاضی:** مناسب بودن برای پایه و لحن را بررسی کنید و مأموریت پیشنهاد دهید.
- **برنامه‌نویسان، طراحان و آزمایش‌کنندگان.**

راهنمای مشارکت: **[CONTRIBUTING.md](CONTRIBUTING.md)**. مشارکت با نام مستعار هم پذیرفته است.

</div>

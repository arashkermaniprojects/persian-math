"""Stable keys for every teachable source entry (Iran, Afghanistan, UK).

Key format: <cur>:<book>:<unit>:<hash6>, e.g. "iran:G05_riazi_panjom:2:3f9a1c".
The hash is of the entry title, so keys stay stable as long as the outline text does.

Run directly to write content/_work/entries.tsv (key, curriculum, book, grade, unit title, entry title).
"""
import hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = {
    "iran": "curriculum/iran_math.json",
    "af": "curriculum_af/afghan_math.json",
    "uk": "curriculum_uk/uk_math.json",
}
# Entries that are not teachable content on their own.
SKIP = re.compile(r"^(مرور فصل|تمرین|خلاصه|نکات مهم|منابع|کتاب‌نامه|پیوست|دربارهٔ طرح|گفت‌وگو|سؤال‌ها|جایزه نوبل)")
UK_GRADE = {"KS3": "7-9", "KS4": "10-11", "GCSE": "10-11", "ALEVEL": "12-13", "FURTHER": "12-13"}


def grade_of(book_id):
    """Iran/AF: grade number. UK: Year (Y01→1) or the key-stage range."""
    m = re.match(r"(?:AF_)?G(\d+)", book_id)
    if m:
        return m.group(1).lstrip("0")
    m = re.match(r"UK_Y(\d+)", book_id)
    if m:
        return m.group(1).lstrip("0")
    return UK_GRADE.get(book_id.replace("UK_", ""), "")


def key(cur, book, unit_no, title, occurrence=1):
    """Repeated titles within one unit (e.g. two lessons both named «یک‌ها، ده‌ها و صدها») get a ~2, ~3 suffix."""
    k = f"{cur}:{book}:{unit_no}:{hashlib.sha1(title.encode()).hexdigest()[:6]}"
    return k if occurrence == 1 else f"{k}~{occurrence}"


def entries():
    """Yield dicts for every teachable entry in all available sources."""
    for cur, path in SOURCES.items():
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            continue
        for book in json.load(open(full, encoding="utf-8")):
            if "pilot" in book["id"]:
                continue  # picture-only pilot book, not transcribed
            for u_no, unit in enumerate(book["units"], 1):
                lessons = unit["lessons"] or [{"title": unit["title"]}]
                seen = {}
                for les in lessons:
                    title = re.sub(r"^درس [^:]*:\s*", "", les["title"]).strip()
                    if SKIP.match(title):
                        continue
                    seen[title] = seen.get(title, 0) + 1
                    yield {
                        "key": key(cur, book["id"], u_no, title, seen[title]),
                        "cur": cur,
                        "book": book["id"],
                        "grade": grade_of(book["id"]),
                        "unit": unit["title"],
                        "title": title,
                    }


if __name__ == "__main__":
    out = os.path.join(ROOT, "content/_work/entries.tsv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    rows = list(entries())
    assert len({r["key"] for r in rows}) == len(rows), "key collision"
    with open(out, "w", encoding="utf-8") as f:
        f.write("key\tcur\tbook\tgrade\tunit\ttitle\n")
        for r in rows:
            f.write("\t".join(r[k].replace("\t", " ") for k in ("key", "cur", "book", "grade", "unit", "title")) + "\n")
    print(f"{len(rows)} entries → {os.path.relpath(out, ROOT)}")

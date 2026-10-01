"""Apply a reviewer's downloaded glossary decisions (from /review/glossary/) to content/glossary/*.yaml.

Usage: .venv/bin/python tools/apply_review.py kamangir-glossary-ps-2026-10-15.json
- Approved terms get the reviewer's spelling and status "reviewed" for that locale, plus a `reviewed_by` record.
- Unapproved but changed terms are applied with status "draft" so the next reviewer sees the suggestion.
Then run tools/build_glossary.py.
"""
import glob, json, os, sys
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(path):
    review = json.load(open(path, encoding="utf-8"))
    loc, decisions = review["locale"], review["decisions"]
    who = f'{review.get("reviewer") or "unknown"} {review.get("date", "")}'.strip()
    applied = 0
    for f in sorted(glob.glob(os.path.join(ROOT, "content/glossary/*.yaml"))):
        terms = yaml.safe_load(open(f, encoding="utf-8")) or []
        touched = False
        for t in terms:
            d = decisions.get(t["id"])
            if not d or not (d.get("ok") or d.get("changed")):
                continue
            if d.get("term"):
                t[loc] = d["term"]
            t.setdefault("status", {})[loc] = "reviewed" if d.get("ok") else "draft"
            if d.get("ok"):
                t.setdefault("reviewed_by", {})[loc] = who
            touched, applied = True, applied + 1
        if touched:
            yaml.safe_dump(terms, open(f, "w", encoding="utf-8"), allow_unicode=True, sort_keys=False, width=200)
    print(f"applied {applied} {loc} decisions from {who}")


if __name__ == "__main__":
    main(sys.argv[1])

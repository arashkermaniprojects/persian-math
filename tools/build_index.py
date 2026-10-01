"""Parse curriculum/*.md outlines into one JSON file the site can be generated from."""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")

def page(s):
    m = re.search(r"ص\s*([۰-۹0-9]+)\s*$", s)
    return (int(m.group(1).translate(FA)), s[: m.start()].rstrip(" —-")) if m else (None, s)

def parse(path):
    book = {"id": os.path.basename(path)[:-3], "title": None, "units": []}
    unit = None
    for line in open(path, encoding="utf-8"):
        line = line.rstrip()
        if line.startswith("# "):
            book["title"] = line[2:].strip()
        elif line.startswith("## "):
            p, t = page(line[3:].strip())
            unit = {"title": t, "page": p, "lessons": []}
            book["units"].append(unit)
        elif re.match(r"^- ", line) and unit is not None:
            p, t = page(line[2:].strip())
            unit["lessons"].append({"title": t, "page": p, "topics": []})
        elif re.match(r"^\s+- ", line) and unit and unit["lessons"]:
            p, t = page(line.strip()[2:])
            unit["lessons"][-1]["topics"].append({"title": t, "page": p})
    return book

src, out = sys.argv[1], sys.argv[2]
# *_ps.md are Pashto translations of the Dari outlines (terminology source), not separate curricula.
books = [parse(p) for p in sorted(glob.glob(os.path.join(ROOT, src, "*.md"))) if not p.endswith(("README.md", "_ps.md"))]
json.dump(books, open(os.path.join(ROOT, out), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for b in books:
    print(f'{b["id"]:34} units={len(b["units"]):3} lessons={sum(len(u["lessons"]) for u in b["units"]):3}')

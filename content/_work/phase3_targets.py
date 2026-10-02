"""Derive the Phase 3 (lower secondary, ages 12–14) target concepts from the concept graph.

A concept is a Phase 3 target when
  1. at least one of its source alignments is a lower-secondary book or statement:
     Iran grades 7–9 (ریاضی هفتم/هشتم/نهم and the تیزهوشان supplements), Afghan grades 7–9 (صنف ۷–۹),
     or the UK KS3 programme of study; and
  2. no existing studio in content/studios/ already teaches it (Phases 1–2), unless it is listed in
     REVISIT below because lower secondary needs a genuinely new studio for it.

Usage (from the repo root):
  python3 content/_work/phase3_targets.py            # writes content/_work/phase3-concepts.json
  python3 content/_work/phase3_targets.py --sources  # also prints every target's source lessons with pages
  python3 content/_work/phase3_targets.py --sources alg.factorise geo.thales   # just these concepts

The output has the same shape as Phase 2's primary_concepts.json: {strand: [concept ids in graph order]}.
"""
import glob, json, os, re, sys
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from entries import key as entry_key, SKIP  # noqa: E402  (same keys as the concept graph's `align`)

OUT = os.path.join(HERE, "phase3-concepts.json")
LOWER_SECONDARY = re.compile(r"^(iran:G0[789]_|af:AF_G0[789]_|uk:UK_KS3:)")
SOURCES = {"iran": "curriculum/iran_math.json", "af": "curriculum_af/afghan_math.json", "uk": "curriculum_uk/uk_math.json"}

# Concepts already taught by an existing studio that lower secondary still needs a new studio for.
# Empty on purpose: every overlap found (integers, powers, nth term, transformations, mean, constructions, …)
# is handled by reusing the old concept as a bridge inside a new Phase 3 studio whose *target* is the new
# lower-secondary concept (e.g. num.integers.add-sub opens the integer-operations studio). See phase3-studios.yaml.
REVISIT: dict[str, str] = {}


def load_concepts():
    nodes = []
    for f in sorted(glob.glob(os.path.join(ROOT, "content/concepts/*.yaml"))):
        nodes += yaml.safe_load(open(f, encoding="utf-8")) or []
    return nodes


def covered_by_studios():
    """Concepts taught by studios built before Phase 3. Studios built FROM this plan don't count, so the
    targets stay the same as the pilots and waves land."""
    plan = os.path.join(ROOT, "content/_work/phase3-studios.yaml")
    phase3 = {s["id"] for s in yaml.safe_load(open(plan, encoding="utf-8"))["studios"]} if os.path.exists(plan) else set()
    cov = set()
    for f in glob.glob(os.path.join(ROOT, "content/studios/*.yaml")):
        s = yaml.safe_load(open(f, encoding="utf-8")) or {}
        if s.get("id") not in phase3:
            cov |= set(s.get("concepts") or [])
    return cov


def is_lower_secondary(node):
    return any(LOWER_SECONDARY.match(k) for refs in node["align"].values() for k in (refs or []))


def targets():
    nodes = load_concepts()
    ids = {n["id"] for n in nodes}
    unknown = sorted(set(REVISIT) - ids)
    if unknown:
        sys.exit(f"REVISIT has unknown ids: {unknown}")
    cov = covered_by_studios()
    out = {}
    for n in nodes:  # graph order (file order, then node order) is kept within each strand
        if is_lower_secondary(n) and (n["id"] not in cov or n["id"] in REVISIT):
            out.setdefault(n["id"].split(".")[0], []).append(n["id"])
    return dict(sorted(out.items())), {n["id"]: n for n in nodes}


def source_index():
    """align key -> (book, unit title, lesson title, page). Mirrors tools/entries.py, keeping the page."""
    idx = {}
    for cur, path in SOURCES.items():
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            continue
        for book in json.load(open(full, encoding="utf-8")):
            if "pilot" in book["id"]:
                continue
            for u_no, unit in enumerate(book["units"], 1):
                lessons = unit["lessons"] or [{"title": unit["title"], "page": unit.get("page")}]
                seen = {}
                for les in lessons:
                    title = re.sub(r"^درس [^:]*:\s*", "", les["title"]).strip()
                    if SKIP.match(title):
                        continue
                    seen[title] = seen.get(title, 0) + 1
                    idx[entry_key(cur, book["id"], u_no, title, seen[title])] = (
                        book["id"], unit["title"], title, les.get("page") or unit.get("page"))
    return idx


def main(argv):
    T, nodes = targets()
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(T, f, ensure_ascii=False, indent=1)
        f.write("\n")
    total = sum(len(v) for v in T.values())
    print(f"{total} target concepts → {os.path.relpath(OUT, ROOT)}")
    print("  " + ", ".join(f"{s} {len(v)}" for s, v in T.items()))
    if argv and argv[0] == "--sources":
        want = set(argv[1:]) or {c for v in T.values() for c in v}
        idx = source_index()
        for c in [c for v in T.values() for c in v] + sorted(want - {c for v in T.values() for c in v}):
            if c not in want:
                continue
            n = nodes[c]
            print(f"\n## {c} [{n['level']}, age {n['age'][0]}–{n['age'][1]}] {n['title']['en']} | {n['title'].get('fa-IR', '')}")
            print(f"   requires: {', '.join(n.get('requires') or []) or '—'}")
            for cur in ("iran", "af", "uk"):
                for k in n["align"].get(cur) or []:
                    b, u, t, p = idx.get(k, ("?", "?", k, None))
                    mark = "*" if LOWER_SECONDARY.match(k) else " "
                    print(f"  {mark} {b} | {u} | {t}" + (f" | p.{p}" if p else ""))


if __name__ == "__main__":
    main(sys.argv[1:])

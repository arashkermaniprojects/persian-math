"""Check the concept graph against the three source curricula and write docs/coverage.html.

Usage: .venv/bin/python tools/coverage.py
Exit code 1 if the graph is invalid (unknown prerequisite, cycle, duplicate id).
Unmapped source lessons are reported, not fatal, until Phase 0 is complete.
"""
import glob, html, json, os, re, sys
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from entries import entries  # noqa: E402

CURS = ("iran", "af", "uk")


def load_nodes():
    nodes = []
    for f in sorted(glob.glob(os.path.join(ROOT, "content/concepts/*.yaml"))):
        nodes += yaml.safe_load(open(f, encoding="utf-8")) or []
    return nodes


def validate(nodes):
    errors, ids = [], {}
    for n in nodes:
        if n["id"] in ids:
            errors.append(f"duplicate id {n['id']}")
        ids[n["id"]] = n
    for n in nodes:
        for r in n.get("requires", []):
            if r not in ids:
                errors.append(f"{n['id']}: unknown prerequisite {r}")
    # cycle check (DFS)
    state = {}
    def visit(i, stack):
        if state.get(i) == 1:
            errors.append("cycle: " + " → ".join(stack + [i]))
            return
        if state.get(i) == 2 or i not in ids:
            return
        state[i] = 1
        for r in ids[i].get("requires", []):
            visit(r, stack + [i])
        state[i] = 2
    for i in ids:
        visit(i, [])
    return errors


def mapped_keys(nodes):
    return {k for n in nodes for refs in (n.get("align") or {}).values() for k in refs or []}


def main():
    nodes = load_nodes()
    errors = validate(nodes)
    mapped = mapped_keys(nodes)
    lessons = list(entries())
    by_key = {e["key"]: e for e in lessons}
    errors += [f"unknown entry key {k}" for k in sorted(mapped - by_key.keys())]
    unmapped = [e for e in lessons if e["key"] not in mapped]

    rows = []
    for n in sorted(nodes, key=lambda n: (n["id"].split(".")[0], n.get("age", [99])[0])):
        cells = []
        for cur in CURS:
            refs = (n.get("align") or {}).get(cur) or []
            cells.append(", ".join(sorted({by_key[k]["grade"] for k in refs if k in by_key})) or "—")
        title = n.get("title", {})
        rows.append(
            f"<tr><td><code>{html.escape(n['id'])}</code></td><td dir='rtl'>{html.escape(title.get('fa-IR',''))}</td>"
            f"<td>{html.escape(title.get('en',''))}</td><td>{'–'.join(map(str, n.get('age', [])))}</td>"
            + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"
        )
    un_rows = "".join(
        f"<tr><td>{e['cur']}</td><td>{html.escape(e['book'])}</td><td dir='auto'>{html.escape(e['unit'])}</td><td dir='auto'>{html.escape(e['title'])}</td></tr>"
        for e in unmapped
    )
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    with open(os.path.join(ROOT, "docs/coverage.html"), "w", encoding="utf-8") as f:
        f.write(f"""<!doctype html><meta charset="utf-8"><title>Kamangir coverage</title>
<style>body{{font-family:Vazirmatn,system-ui,sans-serif;margin:1rem}}table{{border-collapse:collapse;font-size:.85rem}}td,th{{border:1px solid #ccc;padding:.2rem .4rem}}</style>
<h1>Concept coverage</h1><p>{len(nodes)} concepts · {len(lessons)} source lessons · {len(unmapped)} unmapped</p>
<table><tr><th>id</th><th>fa-IR</th><th>en</th><th>age</th><th>Iran grade</th><th>AF grade</th><th>UK year</th></tr>{''.join(rows)}</table>
<h2>Unmapped source lessons ({len(unmapped)})</h2><table><tr><th>cur</th><th>book</th><th>unit</th><th>lesson</th></tr>{un_rows}</table>""")
    print(f"{len(nodes)} concepts, {len(lessons)} source lessons, {len(unmapped)} unmapped")
    for e in errors:
        print("ERROR", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

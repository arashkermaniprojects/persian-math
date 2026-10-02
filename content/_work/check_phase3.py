"""Validate the Phase 3 studio plan (content/_work/phase3-studios.yaml).

Adapted from Phase 2's check_phase2.py. Run from anywhere:
  python3 content/_work/check_phase3.py          # exit 1 on any error
  python3 content/_work/check_phase3.py -v       # also list deferred concepts, extras and per-curriculum coverage

Checks
  - every studio has the plan fields; ids are unique and don't clash with built studios in content/studios/
  - strand = id prefix; order unique per strand (also against built studios)
  - phase3-concepts.json matches a fresh run of phase3_targets.py
  - concept ids exist; every target in phase3-concepts.json is in a studio or deferred (with a reason)
  - 2–6 concepts per studio
  - engine is a built engine or a planned Phase 3 engine; `module` is one this plan declares for that engine
  - every studio is in exactly one wave; wave ids exist
  - the first wave is `pilot`; each new engine and each new module has a pilot there; pilots are not extras
  - specialist concepts appear only in `extra: true` studios or as deferred
  - grades: every target taught in a regular lower-secondary book of curriculum c (Iran G7–9 ریاضی, Afghan G7–9,
    UK KS3) is in at least one studio whose grades.c is 7–9, so no path skips it (gifted-supplement-only
    alignments are reported, not required); ages match the grades (PLAN.md §2)
  - every lower-secondary source lesson (Iran G7–9, Afghan G7–9, UK KS3) maps to a concept that a built studio,
    a planned Phase 3 studio or a deferral covers
"""
import collections, glob, json, os, re, sys
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from entries import entries  # noqa: E402
sys.path.insert(0, HERE)
from phase3_targets import targets as derive_targets  # noqa: E402

PLAN = os.path.join(HERE, "phase3-studios.yaml")
TARGETS = os.path.join(HERE, "phase3-concepts.json")

BUILT = {"fraction-bars", "number-line", "long-division", "counters", "place-value", "column-arithmetic",
         "fact-fluency", "clock-calendar-money", "measure", "shape-board", "pattern-machine", "chart-builder",
         "probability-sim", "problem-canvas"}
# Phase 3 engines (PLAN.md §6 numbers). #9 is shape-board's `dynamic` + `proof` modules, #14 is coord-plane `vectors`.
NEW = {"coord-plane", "algebra-tiles", "solid-viewer", "discrete-lab"}  # 10, 11, 13, 19
MODULES = {  # new lazily loaded modules, each needs its own pilot
    "shape-board": {"dynamic", "proof"},
    "number-line": {"intervals"},
    "chart-builder": {"summary", "grouped"},
    "coord-plane": {"vectors"},
    "algebra-tiles": {"balance", "factors"},
    "discrete-lab": {"tree"},
}
FIELDS = ("id", "strand", "engine", "order", "concepts", "title_fa", "title_en", "ages", "grades", "notes")
LS = {"iran": re.compile(r"^iran:G0([789])_"), "af": re.compile(r"^af:AF_G0([789])_"), "uk": re.compile(r"^uk:UK_KS3:")}
PATH = {"iran": re.compile(r"^iran:G0[789]_riazi_"), "af": LS["af"], "uk": LS["uk"]}  # regular books only
AGE_OFFSET = {"iran": 5, "af": 5, "uk": 4}  # Iran/Afghan grade g = age g+5..g+6; UK Year y = age y+4..y+5


def main(verbose):
    nodes = {}
    for f in glob.glob(os.path.join(ROOT, "content/concepts/*.yaml")):
        for n in yaml.safe_load(open(f, encoding="utf-8")) or []:
            nodes[n["id"]] = n
    allbuilt = [yaml.safe_load(open(f, encoding="utf-8")) for f in glob.glob(os.path.join(ROOT, "content/studios/*.yaml"))]
    planned_ids = {s["id"] for s in yaml.safe_load(open(PLAN, encoding="utf-8"))["studios"]}
    # Studios built FROM this plan are the plan being delivered, not clashes; only earlier studios are "built".
    delivered = {b["id"]: b for b in allbuilt if b["id"] in planned_ids}
    built = [b for b in allbuilt if b["id"] not in planned_ids]
    built_cov = {c for s in built for c in s.get("concepts") or []}
    T = json.load(open(TARGETS, encoding="utf-8"))
    target = {c for v in T.values() for c in v}
    fresh = derive_targets()[0]
    plan = yaml.safe_load(open(PLAN, encoding="utf-8"))
    st, waves = plan["studios"], plan["waves"]
    deferred = {d["concept"]: d.get("reason", "") for d in plan.get("deferred") or []}
    covered = {c for s in st for c in s["concepts"]}
    errs, warns = [], []
    E = errs.append
    if fresh != T:
        E("phase3-concepts.json is stale: re-run python3 content/_work/phase3_targets.py")

    # fields, ids, strands, order
    for s in st:
        miss = [k for k in FIELDS if k not in s]
        if miss:
            E(f"{s.get('id')}: missing fields {miss}")
        if set((s.get("grades") or {})) != {"iran", "af", "uk"}:
            E(f"{s.get('id')}: grades must have iran, af and uk")
    sids = [s["id"] for s in st]
    E_ = [f"duplicate studio id {i}" for i, n in collections.Counter(sids).items() if n > 1]
    errs += E_
    errs += [f"studio id {s['id']} already built in content/studios/" for s in st if s["id"] in {b["id"] for b in built}]
    # A delivered studio must match its plan entry (engine, strand, order, concepts).
    for s in st:
        b = delivered.get(s["id"])
        if b:
            errs += [f"{s['id']}: built {k} {b.get(k)!r} differs from the plan's {s[k]!r}" for k in ("engine", "strand", "order")
                     if b.get(k) != s[k]]
            if set(b.get("concepts") or []) != set(s["concepts"]):
                errs.append(f"{s['id']}: built concepts {sorted(b.get('concepts') or [])} differ from the plan's {sorted(s['concepts'])}")
    errs += [f"{s['id']}: strand {s['strand']} is not the id prefix" for s in st if s["id"].split("-")[0] != s["strand"]]
    strands = {c.split(".")[0] for c in nodes}
    errs += [f"{s['id']}: unknown strand {s['strand']}" for s in st if s["strand"] not in strands]
    orders = collections.Counter((s["strand"], s["order"]) for s in st + built)
    errs += [f"order {o} used twice in strand {k}" for (k, o), n in orders.items() if n > 1]

    # concepts, coverage, sizes
    errs += [f"unknown concept id {c} in {s['id']}" for s in st for c in s["concepts"] if c not in nodes]
    errs += [f"unknown deferred id {c}" for c in deferred if c not in nodes]
    errs += [f"deferred without a reason: {c}" for c, r in deferred.items() if not str(r).strip()]
    errs += [f"deferred but also in a studio: {c}" for c in deferred if c in covered]
    warns += [f"deferred concept is not a Phase 3 target: {c}" for c in deferred if c not in target]
    errs += [f"target not covered or deferred: {c}" for c in sorted(target - covered - set(deferred))]
    errs += [f"{s['id']}: {len(s['concepts'])} concepts (need 2–6)" for s in st if not 2 <= len(s["concepts"]) <= 6]
    errs += [f"{s['id']}: concept {c} listed twice" for s in st for c, n in collections.Counter(s["concepts"]).items() if n > 1]
    errs += [f"{s['id']}: no Phase 3 target concept" for s in st if not set(s["concepts"]) & target]

    # engines and modules
    for s in st:
        e, m = s["engine"], s.get("module")
        if e not in BUILT | NEW:
            E(f"{s['id']}: unknown engine {e}")
        if m is not None and m not in MODULES.get(e, set()):
            E(f"{s['id']}: unknown module {e}/{m}")

    # waves
    w_of = {}
    for wi, (wname, ids) in enumerate(waves.items()):
        for i in ids:
            if i in w_of:
                E(f"{i} in more than one wave")
            w_of.setdefault(i, (wi, wname))
    errs += [f"wave id unknown: {i}" for i in w_of if i not in sids]
    errs += [f"not in a wave: {i}" for i in sids if i not in w_of]
    if list(waves)[0] != "pilot":
        E("the first wave must be `pilot`")
    by_id = {s["id"]: s for s in st}
    pilots = [by_id[i] for i in waves.get("pilot", []) if i in by_id]
    kinds = {(e, None) for e in NEW} | {(e, m) for e, ms in MODULES.items() for m in ms}
    piloted = {(p["engine"], p.get("module")) for p in pilots}
    errs += [f"no pilot for {e}" + (f"/{m}" if m else "") for e, m in sorted(kinds - piloted, key=str)]
    errs += [f"pilot {p['id']} uses no new engine or module" for p in pilots
             if (p["engine"], p.get("module")) not in kinds]
    errs += [f"extra studio {p['id']} is a pilot" for p in pilots if p.get("extra")]

    # specialist concepts
    errs += [f"specialist outside Extra/deferred: {c} in {s['id']}" for s in st if not s.get("extra")
             for c in s["concepts"] if c in nodes and nodes[c]["level"] == "specialist"]
    warns += [f"extra studio {s['id']} has no specialist/extension concept" for s in st if s.get("extra")
              and not any(nodes.get(c, {}).get("level") in ("specialist", "extension") or
                          all("gifted" in k for v in nodes.get(c, {}).get("align", {}).values() for k in v or [])
                          for c in s["concepts"])]

    # grades and ages: every path (Iran regular books, Afghan, UK KS3) must reach each target it teaches in
    # grades 7–9, through at least one studio. Gifted-supplement-only alignments don't bind the Iran path.
    for c in sorted(target & covered):
        for cur, rx in PATH.items():
            hits = [k for k in nodes[c]["align"].get(cur) or [] if rx.match(k)]
            if not hits:
                continue
            ok = [s["id"] for s in st if c in s["concepts"] and (s["grades"].get(cur) or 0) in (7, 8, 9)]
            if not ok:
                have = {s["id"]: s["grades"].get(cur) for s in st if c in s["concepts"]}
                E(f"{cur} path gap: {c} is taught in {hits[0].split(':')[1]} but its studios give grades.{cur} {have}")
    for s in st:
        g = s.get("grades") or {}
        known = [(v, AGE_OFFSET[k]) for k, v in g.items() if v is not None]
        if not known:
            E(f"{s['id']}: no grade in any curriculum")
            continue
        want = [min(v + o for v, o in known), max(v + o + 1 for v, o in known)]
        if list(s["ages"]) != want:
            E(f"{s['id']}: ages {s['ages']} should be {want} from grades {g}")

    # curriculum coverage of lower-secondary source lessons
    all_cov = built_cov | covered | set(deferred)
    by_key = collections.defaultdict(set)
    for n in nodes.values():
        for refs in n["align"].values():
            for k in refs or []:
                by_key[k].add(n["id"])
    gaps, per_cur = [], collections.Counter()
    for e in entries():
        if any(rx.match(e["key"]) for rx in LS.values()):
            per_cur[e["cur"]] += 1
            if not by_key[e["key"]] & all_cov:
                gaps.append(f"{e['book']} | {e['unit']} | {e['title']}")
    errs += [f"source lesson not covered: {g}" for g in gaps]

    # report
    core = [s for s in st if not s.get("extra")]
    print("target concepts:", len(target), "| covered by Phase 3 studios:", len(target & covered),
          "| deferred:", len(deferred), "| bridge (non-target) concepts in studios:", len(covered - target))
    print("studios:", len(st), f"({len(core)} core + {len(st) - len(core)} extra)")
    print("per strand:", dict(collections.Counter(s["strand"] for s in st)))
    print("per engine:", dict(collections.Counter(s["engine"] for s in st).most_common()))
    print("per module:", dict(collections.Counter(f"{s['engine']}/{s['module']}" for s in st if s.get("module")).most_common()))
    print("waves:", {k: len(v) for k, v in waves.items()})
    print("pilots:", ", ".join(f"{p['id']} ({p['engine']}{'/' + p['module'] if p.get('module') else ''})" for p in pilots))
    print("lower-secondary source lessons:", dict(per_cur), "| uncovered:", len(gaps))
    gifted = sorted(c for c in target if any(LS["iran"].match(k) for k in nodes[c]["align"].get("iran") or [])
                    and not any(PATH["iran"].match(k) for k in nodes[c]["align"].get("iran") or []))
    print("Iran gifted-supplement-only targets:", len(gifted))
    if verbose:
        print("  " + ", ".join(gifted))
        print("deferred:")
        for c, r in deferred.items():
            print(f"  {c}: {r}")
        print("extra studios:", ", ".join(s["id"] for s in st if s.get("extra")))
        print("bridge concepts:", ", ".join(sorted(covered - target)))
    for w in warns:
        print("WARN:", w)
    print("ERRORS:" if errs else "OK: all checks pass", *errs, sep="\n  ")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main("-v" in sys.argv[1:]))

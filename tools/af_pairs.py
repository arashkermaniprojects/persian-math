"""Pair each line of the Dari outlines with the same line of the Pashto outlines → content/_work/af_dari_pashto.tsv.
The *_ps.md files mirror the Dari files line by line (see their headers), so pairing is positional.
"""
import glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def clean(line):
    line = re.sub(r"<!--.*?-->", "", line)
    line = re.sub(r"^\s*(#+|-)\s*", "", line)
    line = re.sub(r"\s*—\s*(ص|مخ)\s*[۰-۹0-9\-]+\s*$", "", line)
    return line.strip()


rows = []
for dari in sorted(glob.glob(os.path.join(ROOT, "curriculum_af/AF_G*_riazi.md"))):
    ps = dari[:-3] + "_ps.md"
    if not os.path.exists(ps):
        continue
    d_lines, p_lines = open(dari, encoding="utf-8").read().splitlines(), open(ps, encoding="utf-8").read().splitlines()
    for i, (d, p) in enumerate(zip(d_lines, p_lines), 1):
        if d.startswith(("#", "-", " ")) and not d.startswith("# "):
            dc, pc = clean(d), clean(p)
            if dc and pc:
                rows.append((os.path.basename(dari)[3:6], str(i), dc, pc))
out = os.path.join(ROOT, "content/_work/af_dari_pashto.tsv")
with open(out, "w", encoding="utf-8") as f:
    f.write("grade\tline\tdari\tpashto\n")
    f.writelines("\t".join(r) + "\n" for r in rows)
print(f"{len(rows)} Dari–Pashto pairs → {os.path.relpath(out, ROOT)}")

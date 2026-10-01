"""Find each textbook's table-of-contents pages (فهرست) and render them to PNG for transcription."""
import glob, os, subprocess, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "toc_pages")
os.makedirs(OUT, exist_ok=True)

def page_text(pdf, n):
    t = subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), pdf, "-"], capture_output=True, text=True).stdout
    return unicodedata.normalize("NFKC", t).replace("\u0640", "")  # strip tatweel (فهـرست)

for pdf in sorted(glob.glob(os.path.join(ROOT, "textbooks", "*.pdf"))):
    name = os.path.basename(pdf)[:-4]
    if glob.glob(os.path.join(OUT, name + "-*.png")):
        continue
    hits = [n for n in range(1, 16) if "فهرست" in page_text(pdf, n)]
    if hits:  # TOC usually spans the hit page plus the next one or two
        first, last = hits[0], hits[0] + 2
    else:
        first, last = 3, 8
    subprocess.run(["pdftoppm", "-f", str(first), "-l", str(last), "-r", "90", "-png", pdf, os.path.join(OUT, name)])
    print(name, "hits", hits, "rendered", first, "-", last)

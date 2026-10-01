#!/usr/bin/env bash
# Downloads the official Afghan (MoE) Dari + Pashto math textbooks, grades 1-12 (older series, reprinted 1398-1399 / 2019-2020) into ./textbooks_af/
set -e
mkdir -p textbooks_af && cd textbooks_af
B=https://moe.gov.af/sites/default/files
grep -v '^$' <<'LIST' | xargs -P 6 -L 1 sh -c '[ -f "$0.pdf" ] || { curl -sfL --retry 3 -o "$0.pdf.part" "'"$B"'/$1" && mv "$0.pdf.part" "$0.pdf" && echo "done $0"; } || echo "FAIL $0"'
AF_G01_riazi 2020-02/G1-Dr-Math.pdf
AF_G02_riazi 2020-02/G2-Dr-Math.pdf
AF_G03_riazi 2020-02/G3-Dr-Math.pdf
AF_G04_riazi 2020-02/G4-Dr-Math.pdf
AF_G05_riazi 2020-02/G5-Dr-Math.pdf
AF_G06_riazi 2020-02/G6-Dr-Math.pdf
AF_G07_riazi 2020-03/G7-Dr-Math.pdf
AF_G08_riazi 2020-03/G8-Dr-Math_0.pdf
AF_G09_riazi 2020-03/G9-Dr-Math.pdf
AF_G10_riazi 2020-03/G10-Dr-Math.pdf
AF_G11_riazi 2020-03/G11-Dr-Math.pdf
AF_G12_riazi 2020-03/G12-Dr-Math.pdf
AF_G01_riazi_ps 2020-03/G1-Ps-Math.pdf
AF_G02_riazi_ps 2020-03/G2-Ps-Math.pdf
AF_G03_riazi_ps 2020-03/G3-Ps-Math.pdf
AF_G04_riazi_ps 2020-03/G4-Ps-Math.pdf
AF_G05_riazi_ps 2020-03/G5-Ps-Math.pdf
AF_G06_riazi_ps 2020-03/G6-Ps-Math.pdf
AF_G07_riazi_ps 2020-03/G7-Ps-Math.pdf
AF_G08_riazi_ps 2020-03/G8-Ps-Math.pdf
AF_G09_riazi_ps 2020-03/G9-Ps-Math.pdf
AF_G10_riazi_ps 2020-03/G10-Ps-Math.pdf
AF_G11_riazi_ps 2020-03/G11-Ps-Math.pdf
AF_G12_riazi_ps 2020-03/G12-Ps-Math.pdf
LIST

#!/usr/bin/env bash
# Downloads the official 1405-1406 Iranian K12 math textbooks (chap.sch.ir) into ./textbooks/
set -e
mkdir -p textbooks && cd textbooks
B=http://chap.sch.ir/sites/default/files/lbooks/1405-1406
# Parallel (server is slow per connection); writes to .part and renames on success.
grep -v '^$' <<'LIST' | xargs -P 10 -L 1 sh -c '[ -f "$0.pdf" ] || { curl -sfL --retry 3 -o "$0.pdf.part" "'"$B"'/$1" && mv "$0.pdf.part" "$0.pdf" && echo "done $0"; } || echo "FAIL $0"'
G01_riazi_aval 8/C105.pdf
G01_riazi_doost_dashtani_pilot 8/C1051.pdf
G02_riazi_dovom 9/C205.pdf
G03_riazi_sevom 10/C305.pdf
G04_riazi_chaharom 12/C405.pdf
G05_riazi_panjom 13/C505-New.pdf
G06_riazi_sheshom 32/C605.pdf
G07_riazi_haftom 555/C705.pdf
G07_gifted_supplement 555/C723.pdf
G08_riazi_hashtom 558/C805.pdf
G08_gifted_supplement 558/C823.pdf
G09_riazi_nohom 556/C905.pdf
G09_gifted 556/C923.pdf
G10_riazi1_math_science 40/C110211.pdf
G10_hendese1_math 29/C110213.pdf
G10_riazi_amar1_humanities 43/C110212.pdf
G11_hesaban1_math 30/C111214.pdf
G11_hendese2_math 30/C111213.pdf
G11_amar_ehtemal_math 30/C111215.pdf
G11_riazi2_science 41/C111211.pdf
G11_riazi_amar2_humanities 44/C111212.pdf
G12_hesaban2_math 711/C112214.pdf
G12_hendese3_math 711/C112213.pdf
G12_gosaste_math 711/C112215.pdf
G12_riazi3_science 712/C112211.pdf
G12_riazi_amar3_humanities 710/C112212.pdf
LIST

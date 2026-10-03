"""Copy each Phase 3 studio's plan grades (phase3-studios.yaml) into content/studios/<id>.yaml as `grades:`.

The studio badges and country paths then show the plan's grade, not the lowest grade of the concepts (which can be
far off: vec.2d is Afghan grade 11, and UK KS3/GCSE codes carry no Year). Safe to rerun; it rewrites the line.
"""
import os, re, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
plan = yaml.safe_load(open(os.path.join(ROOT, 'content/_work/phase3-studios.yaml')))
n = 0
for s in plan['studios']:
    p = os.path.join(ROOT, 'content/studios', s['id'] + '.yaml')
    if not os.path.exists(p):
        continue
    g = s['grades']
    line = 'grades: { iran: %s, af: %s, uk: %s }\n' % tuple('null' if g[k] is None else g[k] for k in ('iran', 'af', 'uk'))
    t = open(p).read()
    t = re.sub(r'^grades:.*\n', '', t, flags=re.M)
    t, k = re.subn(r'^(order: .*\n)', lambda m: m.group(1) + line, t, count=1, flags=re.M)
    assert k == 1, p
    open(p, 'w').write(t); n += 1
print(n, 'studios synced')

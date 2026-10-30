import json, subprocess, sys
f = 'tools/i18n/en/manual.json'
get = lambda st: json.loads(subprocess.run(['git', 'show', ':%d:%s' % (st, f)], capture_output=True, text=True).stdout)
ours, theirs = get(2), get(3)
out = dict(ours)
for k, v in theirs.items():
    if k not in out: out[k] = v
json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('merged', len(ours), len(theirs), '->', len(out))

from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

functions = ['fetchDualCoordinate', 'loadBatchDataV174', 'searchWorkLocation']
changed = []
for fn in functions:
    pat = rf'(async function {re.escape(fn)}\([^)]*\)\{{\s*)const token=await getLineAccessToken\(\);'
    repl = rf"\1const token=await getBestDataToken();if(!token)throw new Error('AUTH_REQUIRED');"
    s2, n = re.subn(pat, repl, s, count=1)
    if n:
        s = s2
        changed.append(fn)

if not changed:
    raise SystemExit('No target coordinate auth calls found; refusing empty patch')

p.write_text(s, encoding='utf-8')
print('patched coordinate auth functions:', ', '.join(changed))

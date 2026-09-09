from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

pat=r'''async function fetchPrivateImage\(objectPath\)\s*\{.*?\n\s*\}\n\n\n\s*window\._qcBatchCoordinateMap'''
repl='''async function fetchPrivateImage(objectPath) {\n      // Speed hotfix: do not pre-download every image before assigning it to <img>.\n      // The previous implementation fetched each full image once for verification,\n      // then the browser fetched it again for display, effectively doubling traffic.\n      return await createSignedImageUrl(objectPath);\n    }\n\n\n\n    window._qcBatchCoordinateMap'''

s2,n=re.subn(pat,repl,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'fetchPrivateImage target not found or ambiguous: {n}')

p.write_text(s2,encoding='utf-8')
print('patched fetchPrivateImage to direct signed URL loading')

from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

old = '''    async function qcApi(action, payload = {}) {\n      const accessToken = await getLineAccessToken();\n'''
new = '''    async function qcApi(action, payload = {}) {\n      const accessToken = await getBestDataToken();\n      if (!accessToken) throw new Error("AUTH_REQUIRED");\n'''
if old not in text:
    raise SystemExit('qcApi LINE-only pattern not found')
text = text.replace(old, new, 1)

anchor = '''      setMenuVisible("navQc",!!a.qc);\n      setMenuVisible("navSearch",!!a.qc);\n'''
replacement = '''      setMenuVisible("navQc",!!a.qc);\n      setMenuVisible("navSearch",!!a.qc);\n      // QC controls follow the same effective permission as the QC menu.\n      // This keeps Username/Password sessions usable even when LIFF is absent.\n      try{ setQcEnabled(!!a.qc); }catch(_){ }\n'''
if anchor not in text:
    raise SystemExit('applyMenuAccess QC anchor not found')
text = text.replace(anchor, replacement, 1)

old_catch = '''        setQcEnabled(false);\n        // V52: transient LINE errors must not collapse an already-authorized sidebar.\n        applyMenuAccess();\n'''
new_catch = '''        // A LINE failure must not disable QC for an authoritative web session.\n        if(!getFallbackSessionToken()) setQcEnabled(false);\n        else applyMenuAccess();\n        // V52: transient LINE errors must not collapse an already-authorized sidebar.\n        applyMenuAccess();\n'''
if old_catch in text:
    text = text.replace(old_catch, new_catch, 1)

if text == original:
    raise SystemExit('no changes made')

path.write_text(text, encoding='utf-8')
print('Applied QC web-session hotfix')

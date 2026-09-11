from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
mark = 'QC_EMPLOYEE_NAME_EMPHASIS_V1'
if mark in s:
    print('Already patched')
    raise SystemExit(0)

# The employee row added by QC_BATCH_OWNER_NAME_V1 is the only batch-row containing <b>พนักงาน:</b>.
old = '<div class="batch-row"><b>พนักงาน:</b> ${escapeHtml(batch.employee_name || batch.uploaded_by_username || "-")}</div>'
new = '<div class="batch-row qc-employee-name"><b>พนักงาน:</b> ${escapeHtml(batch.employee_name || batch.uploaded_by_username || "-")}</div>'
if old not in s:
    raise SystemExit('Employee row marker not found')
s = s.replace(old, new, 1)

css = '''\n<style id="QC_EMPLOYEE_NAME_EMPHASIS_V1">\n/* Make worker identity immediately readable on QC batch cards. */\n.qc-employee-name {\n  margin: 7px 0 5px !important;\n  padding: 7px 9px !important;\n  border-radius: 8px !important;\n  background: rgba(124, 58, 237, 0.09) !important;\n  color: #4c1d95 !important;\n  font-size: 17px !important;\n  font-weight: 800 !important;\n  line-height: 1.35 !important;\n  letter-spacing: .1px;\n  overflow-wrap: anywhere;\n}\n.qc-employee-name b {\n  font-size: inherit !important;\n  font-weight: 900 !important;\n}\n@media (max-width: 900px) {\n  .qc-employee-name { font-size: 16px !important; }\n}\n</style>\n'''
if '</head>' not in s:
    raise SystemExit('head closing tag not found')
s = s.replace('</head>', css + '</head>', 1)
p.write_text(s, encoding='utf-8')
print('Patched QC employee name emphasis')

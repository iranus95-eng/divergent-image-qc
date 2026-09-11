from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old = """            (!nok && mok ? 'ยังไม่มีพิกัดใบแจ้งเตือนของ CA นี้' :
             nok && !mok ? 'ยังไม่มีพิกัดมิเตอร์ของ CA นี้' :
             'ยังไม่มีพิกัดครบ 2 จุด')+"""
new = """            (!nok && mok ? '⚠️ ยังไม่มีพิกัดงาน/ใบแจ้งเตือนของ CA นี้' :
             nok && !mok ? '✅ พิกัดงานมาแล้ว / ⚠️ รอพิกัดมิเตอร์จากฐานลูกค้า' :
             '⚠️ ยังไม่มีพิกัดงานและพิกัดมิเตอร์')+"""

if old not in s:
    raise SystemExit('Target QC coordinate status block not found; refusing empty patch')

s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('patched QC coordinate status wording')

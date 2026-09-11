from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
old='.home-menu5-copy{min-width:0;flex:1}.home-menu5-copy b{display:block;font-size:14px;line-height:1.3;color:#2f155e}.home-menu5-copy span{display:block;margin-top:6px;font-size:11px;line-height:1.4;color:#80718f}.home-menu5-arrow{display:block;margin-top:7px;color:#6f35c9;font-weight:900;font-size:13px}'
new='.home-menu5-copy{min-width:0;flex:1}.home-menu5-copy b{display:block;font-size:17px;line-height:1.28;color:#2f155e}.home-menu5-copy span{display:block;margin-top:7px;font-size:13px;line-height:1.45;color:#80718f}.home-menu5-arrow{display:block;margin-top:8px;color:#6f35c9;font-weight:900;font-size:14px}'
if old not in s:
    raise SystemExit('target home menu font CSS not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('home menu fonts increased')

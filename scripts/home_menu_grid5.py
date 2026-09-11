from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='</head>'
patch=r'''
<style id="home-grid5-navigation-v1">
/* Desktop home: replace the fixed sidebar with the same permission-aware navigation as a 5-column card grid. */
body.home-grid5-mode .sidebar{display:none!important}
body.home-grid5-mode .main-shell{margin-left:0!important}
body.home-grid5-mode .divergent-footer{left:0!important}
body.home-grid5-mode .main-shell .container{max-width:1540px!important;padding-left:34px!important;padding-right:34px!important}
#homeMenuGrid5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-top:20px}
.home-menu5-card{min-height:116px;border:1px solid #e8def6;border-radius:18px;background:rgba(255,255,255,.91);padding:16px 16px 14px;display:flex;align-items:flex-start;gap:13px;cursor:pointer;box-shadow:0 7px 20px rgba(67,35,105,.07);transition:.18s transform,.18s box-shadow,.18s border-color;text-align:left;color:#30165b}
.home-menu5-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(67,35,105,.13);border-color:#cdb7f4}
.home-menu5-icon{width:46px;height:46px;flex:0 0 46px;border-radius:14px;display:grid;place-items:center;font-size:22px;color:#fff;background:linear-gradient(145deg,#8b56ef,#6f35c9);box-shadow:0 6px 14px rgba(93,48,166,.18)}
.home-menu5-card:nth-child(5n+1) .home-menu5-icon{background:linear-gradient(145deg,#3678f6,#2e60d7)}
.home-menu5-card:nth-child(5n+2) .home-menu5-icon{background:linear-gradient(145deg,#26c47b,#16a862)}
.home-menu5-card:nth-child(5n+3) .home-menu5-icon{background:linear-gradient(145deg,#8b56ef,#6f35c9)}
.home-menu5-card:nth-child(5n+4) .home-menu5-icon{background:linear-gradient(145deg,#ffad52,#f1842f)}
.home-menu5-card:nth-child(5n+5) .home-menu5-icon{background:linear-gradient(145deg,#ef5b8c,#c83f73)}
.home-menu5-copy{min-width:0;flex:1}.home-menu5-copy b{display:block;font-size:14px;line-height:1.3;color:#2f155e}.home-menu5-copy span{display:block;margin-top:6px;font-size:11px;line-height:1.4;color:#80718f}.home-menu5-arrow{display:block;margin-top:7px;color:#6f35c9;font-weight:900;font-size:13px}
@media(max-width:1200px){#homeMenuGrid5{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:950px){#homeMenuGrid5{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:700px){#homeMenuGrid5{grid-template-columns:repeat(2,minmax(0,1fr))}.main-shell .container{padding-left:12px!important;padding-right:12px!important}}
@media(max-width:460px){#homeMenuGrid5{grid-template-columns:1fr}}
</style>
<script id="home-grid5-navigation-script">
(function(){
 const LABELS={navHome:['หน้าหลัก','ภาพรวมระบบ'],navClaim:['ตั้งเบิกค่าตอบแทน','บันทึกและส่งคำขอ'],navClaimPending:['การไฟฟ้าที่ยังเบิกไม่ได้','ติดตามงานค้าง'],navPayroll:['จัดการเงินเดือน','ข้อมูลเงินเดือน'],navAdvance:['พนักงานเบิกเงินล่วงหน้า','คำขอและอนุมัติ'],navStaffExpense:['ค่าใช้จ่าย','บันทึกค่าใช้จ่าย'],navQc:['ตรวจสอบงาน','ตรวจสอบรูปภาพ'],navSearch:['ค้นหาข้อมูล','ค้นหารูปภาพ/ข้อมูล'],navLocation:['ค้นหาพิกัดตำแหน่ง','ค้นหาและเปรียบเทียบพิกัด'],navUsers:['จัดการผู้ใช้งาน','จัดการสิทธิ์และผู้ใช้'],navInvoice:['จัดทำใบตั้งหนี้','สร้างใบแจ้งหนี้'],navBilling:['จัดทำใบวางบิล','สร้างใบวางบิล'],navProfitLoss:['กำไร-ขาดทุนรายเดือน','รายงานผล'],navStaffPayroll:['เงินเดือนพนักงาน','ข้อมูลพนักงาน']};
 const ICONS={navHome:'⌂',navClaim:'▤',navClaimPending:'⚠',navPayroll:'฿',navAdvance:'♟',navStaffExpense:'▣',navQc:'✓',navSearch:'⌕',navLocation:'⌖',navUsers:'♟',navInvoice:'▤',navBilling:'▤',navProfitLoss:'▥',navStaffPayroll:'฿'};
 function visible(el){const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&!el.classList.contains('muted')}
 function build(){
   const home=document.getElementById('homeWorkspace'), nav=document.querySelector('.side-nav'); if(!home||!nav)return;
   document.body.classList.add('home-grid5-mode');
   let grid=document.getElementById('homeMenuGrid5'); if(!grid){grid=document.createElement('div');grid.id='homeMenuGrid5';const hero=home.querySelector('.home-hero');(hero||home).insertAdjacentElement('afterend',grid)}
   grid.innerHTML='';
   [...nav.querySelectorAll('.nav-item[id]')].forEach(item=>{if(!visible(item))return;const id=item.id, meta=LABELS[id]||[(item.textContent||'').trim(),''];const card=document.createElement('button');card.type='button';card.className='home-menu5-card';card.innerHTML='<span class="home-menu5-icon">'+(ICONS[id]||'•')+'</span><span class="home-menu5-copy"><b>'+meta[0]+'</b><span>'+meta[1]+'</span><i class="home-menu5-arrow">เข้าใช้งาน →</i></span>';card.onclick=()=>item.click();grid.appendChild(card)});
   const old=home.querySelector('.home-grid'); if(old)old.style.display='none';
 }
 window.addEventListener('load',()=>{build();setTimeout(build,700);setTimeout(build,1800)});
 const mo=new MutationObserver(()=>{clearTimeout(window.__grid5t);window.__grid5t=setTimeout(build,80)});window.addEventListener('DOMContentLoaded',()=>{const n=document.querySelector('.side-nav');if(n)mo.observe(n,{attributes:true,subtree:true,attributeFilter:['style','class']})});
})();
</script>
'''
if 'home-grid5-navigation-v1' in s: raise SystemExit('already patched')
s=s.replace(marker,patch+'\n'+marker,1)
p.write_text(s,encoding='utf-8')
print('home 5-column menu patch applied')

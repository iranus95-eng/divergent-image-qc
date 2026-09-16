(function(){
'use strict';

const STYLE_ID='home-menu-order-v3-style';
const CONFIG=[
  {key:'ตรวจสอบงาน',nav:'navQc',desc:'ตรวจสอบรูปภาพ',icon:'✓'},
  {key:'ค้นหาข้อมูล',nav:'navSearch',desc:'ค้นหารูปภาพ/ข้อมูล',icon:'⌕'},
  {key:'ค้นหาพิกัดตำแหน่ง',nav:'navLocation',desc:'ค้นหาและเปรียบเทียบพิกัด',icon:'⌖'},
  {key:'พนักงานเบิกเงินล่วงหน้า',nav:'navEmployeeAdvance',desc:'คำขอและอนุมัติ',icon:'💸'},
  {key:'ค่าใช้จ่าย',nav:'navStaffExpense',desc:'บันทึกค่าใช้จ่าย',icon:'▣'},
  {key:'จัดการเงินเดือน',nav:'navPayroll',desc:'ข้อมูลเงินเดือน',icon:'฿'},
  {key:'ตั้งเบิกค่าตอบแทน',nav:'navClaim',desc:'บันทึกและส่งคำขอ',icon:'▤'},
  {key:'การไฟฟ้าที่ยังเบิกไม่ได้',nav:'navClaimPending',desc:'ติดตามงานค้าง',icon:'⚠'},
  {key:'จัดการผู้ใช้งาน',nav:'navUsers',desc:'จัดการสิทธิ์และผู้ใช้',icon:'♟'},
  {key:'จัดทำใบตั้งหนี้',nav:'navInvoice',desc:'สร้างใบตั้งหนี้',icon:'▤'},
  {key:'ใบแจ้งหนี้-ใบวางบิล',nav:'navBilling',desc:'สร้างใบแจ้งหนี้/ใบวางบิล',icon:'▤'},
  {key:'ใบเสร็จรับเงิน-ใบกำกับภาษี',nav:'navReceiptTax',desc:'สร้างใบเสร็จรับเงินและใบกำกับภาษี',icon:'▤'},
  {key:'กำไร-ขาดทุนรายเดือน',nav:'navPnL',desc:'รายงานผล',icon:'▥'}
];
const ORDER=CONFIG.map(x=>x.key);

function clean(v){return String(v||'').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim()}
function canonical(title){
  const t=clean(title);
  if(t==='จัดทำใบวางบิล'||t==='ใบวางบิล')return 'ใบแจ้งหนี้-ใบวางบิล';
  if(t==='ใบตั้งหนี้')return 'จัดทำใบตั้งหนี้';
  if(t==='ตั้งเบิก')return 'ตั้งเบิกค่าตอบแทน';
  if(t==='งานค้าง')return 'การไฟฟ้าที่ยังเบิกไม่ได้';
  if(t==='ผู้ใช้')return 'จัดการผู้ใช้งาน';
  if(t==='กำไร-ขาดทุน')return 'กำไร-ขาดทุนรายเดือน';
  if(t.includes('ใบเสร็จรับเงิน-ใบกำกับภาษี'))return 'ใบเสร็จรับเงิน-ใบกำกับภาษี';
  return t;
}
function isVisible(el){
  if(!el)return false;
  const cs=getComputedStyle(el);
  return cs.display!=='none'&&cs.visibility!=='hidden'&&!el.classList.contains('muted');
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
    #homeMenuGrid5{grid-template-columns:repeat(4,minmax(0,1fr))!important}
    @media(max-width:1100px){#homeMenuGrid5{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
    @media(max-width:760px){#homeMenuGrid5{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    @media(max-width:460px){#homeMenuGrid5{grid-template-columns:1fr!important}}
  `;document.head.appendChild(style);
}
function findCard(grid,key){
  return [...grid.querySelectorAll(':scope > .home-menu5-card')].find(card=>canonical(card.querySelector('.home-menu5-copy b')?.textContent||'')===key)||null;
}
function makeCard(grid,cfg,nav){
  const card=document.createElement('button');
  card.type='button';card.className='home-menu5-card';card.dataset.homeMenuKey=cfg.key;
  card.innerHTML=`<span class="home-menu5-icon">${cfg.icon}</span><span class="home-menu5-copy"><b>${cfg.key}</b><span>${cfg.desc}</span><i class="home-menu5-arrow">เข้าใช้งาน →</i></span>`;
  card.onclick=()=>nav.click();
  grid.appendChild(card);
  return card;
}
let running=false,queued=false;
function arrange(){
  queued=false;if(running)return;
  const grid=document.getElementById('homeMenuGrid5');if(!grid)return;
  running=true;
  try{
    const keep=new Map();
    for(const cfg of CONFIG){
      const nav=document.getElementById(cfg.nav);
      let card=findCard(grid,cfg.key);
      if(nav&&isVisible(nav)){
        if(!card)card=makeCard(grid,cfg,nav);
        card.style.display='';
        if(card.dataset.homeMenuKey===cfg.key)card.onclick=()=>nav.click();
        keep.set(cfg.key,card);
      }else if(card){
        card.style.display='none';
      }
    }
    const all=[...grid.querySelectorAll(':scope > .home-menu5-card')];
    const seen=new Set();
    for(const card of all){
      const key=canonical(card.querySelector('.home-menu5-copy b')?.textContent||'');
      if(key==='หน้าหลัก'||key==='เงินเดือนพนักงาน'||key==='เงินเดือนสตาฟ'||!ORDER.includes(key)){
        card.style.display='none';continue;
      }
      if(seen.has(key)||keep.get(key)!==card){
        card.style.display='none';continue;
      }
      seen.add(key);
    }
    const ordered=ORDER.map(k=>keep.get(k)).filter(Boolean);
    const visibleNow=[...grid.querySelectorAll(':scope > .home-menu5-card')].filter(c=>c.style.display!=='none');
    const same=visibleNow.length===ordered.length&&visibleNow.every((c,i)=>c===ordered[i]);
    if(!same){
      const frag=document.createDocumentFragment();
      ordered.forEach(c=>frag.appendChild(c));
      [...grid.querySelectorAll(':scope > .home-menu5-card')].filter(c=>!ordered.includes(c)).forEach(c=>frag.appendChild(c));
      grid.appendChild(frag);
    }
  }finally{running=false;}
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(arrange)}
function boot(){
  installStyle();arrange();
  const side=document.querySelector('.side-nav');
  if(side)new MutationObserver(()=>{if(!running)schedule()}).observe(side,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  const grid=document.getElementById('homeMenuGrid5');
  if(grid)new MutationObserver(()=>{if(!running)schedule()}).observe(grid,{childList:true,subtree:true});
  [100,300,700,1200,2000,3200,5000,8000].forEach(ms=>setTimeout(arrange,ms));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

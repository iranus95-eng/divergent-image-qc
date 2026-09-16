(function(){
'use strict';

const STYLE_ID='home-menu-order-v1-style';
const ORDER=[
  'ตรวจสอบงาน',
  'ค้นหาข้อมูล',
  'ค้นหาพิกัดตำแหน่ง',
  'พนักงานเบิกเงินล่วงหน้า',
  'ค่าใช้จ่าย',
  'จัดการเงินเดือน',
  'ตั้งเบิกค่าตอบแทน',
  'การไฟฟ้าที่ยังเบิกไม่ได้',
  'เงินเดือนพนักงาน',
  'จัดทำใบตั้งหนี้',
  'ใบแจ้งหนี้-ใบวางบิล',
  'ใบเสร็จรับเงิน-ใบกำกับภาษี',
  'กำไร-ขาดทุนรายเดือน'
];

function clean(v){
  return String(v||'')
    .replace(/[–—]/g,'-')
    .replace(/\s+/g,' ')
    .trim();
}

function canonical(title){
  const t=clean(title);
  if(t==='ตรวจสอบงาน')return 'ตรวจสอบงาน';
  if(t==='ค้นหาข้อมูล')return 'ค้นหาข้อมูล';
  if(t==='ค้นหาพิกัดตำแหน่ง')return 'ค้นหาพิกัดตำแหน่ง';
  if(t==='พนักงานเบิกเงินล่วงหน้า')return 'พนักงานเบิกเงินล่วงหน้า';
  if(t==='ค่าใช้จ่าย')return 'ค่าใช้จ่าย';
  if(t==='จัดการเงินเดือน')return 'จัดการเงินเดือน';
  if(t==='เงินเดือนพนักงาน'||t==='เงินเดือนสตาฟ')return 'เงินเดือนพนักงาน';
  if(t==='ตั้งเบิกค่าตอบแทน'||t==='ตั้งเบิก')return 'ตั้งเบิกค่าตอบแทน';
  if(t==='การไฟฟ้าที่ยังเบิกไม่ได้'||t==='งานค้าง')return 'การไฟฟ้าที่ยังเบิกไม่ได้';
  if(t==='จัดทำใบตั้งหนี้'||t==='ใบตั้งหนี้')return 'จัดทำใบตั้งหนี้';
  if(t==='ใบแจ้งหนี้-ใบวางบิล'||t==='จัดทำใบวางบิล'||t==='ใบวางบิล')return 'ใบแจ้งหนี้-ใบวางบิล';
  if(t.includes('ใบเสร็จรับเงิน-ใบกำกับภาษี'))return 'ใบเสร็จรับเงิน-ใบกำกับภาษี';
  if(t==='กำไร-ขาดทุนรายเดือน'||t==='กำไร-ขาดทุน')return 'กำไร-ขาดทุนรายเดือน';
  if(t==='หน้าหลัก')return 'หน้าหลัก';
  if(t==='จัดการผู้ใช้งาน'||t==='ผู้ใช้')return 'จัดการผู้ใช้งาน';
  return t;
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #homeMenuGrid5{grid-template-columns:repeat(4,minmax(0,1fr))!important}
    @media(max-width:1100px){#homeMenuGrid5{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
    @media(max-width:760px){#homeMenuGrid5{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    @media(max-width:460px){#homeMenuGrid5{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);
}

let running=false;
let queued=false;
function arrange(){
  queued=false;
  if(running)return;
  const grid=document.getElementById('homeMenuGrid5');
  if(!grid)return;
  running=true;
  try{
    const cards=[...grid.querySelectorAll(':scope > .home-menu5-card')];
    const byKey=new Map();
    const extras=[];
    for(const card of cards){
      const title=card.querySelector('.home-menu5-copy b');
      const key=canonical(title?.textContent||'');
      if((key==='หน้าหลัก')||(key==='จัดการผู้ใช้งาน')){
        card.style.display='none';
        extras.push(card);
        continue;
      }
      if(!ORDER.includes(key)){
        card.style.display='none';
        extras.push(card);
        continue;
      }
      if(byKey.has(key)){
        card.style.display='none';
        extras.push(card);
        continue;
      }
      card.style.display='';
      byKey.set(key,card);
    }

    const ordered=ORDER.map(k=>byKey.get(k)).filter(Boolean);
    const currentVisible=[...grid.querySelectorAll(':scope > .home-menu5-card')].filter(c=>c.style.display!=='none');
    const same=currentVisible.length===ordered.length&&currentVisible.every((c,i)=>c===ordered[i]);
    if(!same){
      const frag=document.createDocumentFragment();
      ordered.forEach(card=>frag.appendChild(card));
      extras.forEach(card=>frag.appendChild(card));
      grid.appendChild(frag);
    }
  }finally{
    running=false;
  }
}

function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(arrange);
}

function boot(){
  installStyle();
  arrange();
  const home=document.getElementById('homeWorkspace')||document.body;
  new MutationObserver(muts=>{
    if(running)return;
    for(const m of muts){
      if(m.type==='childList'&&m.addedNodes.length){schedule();break;}
      if(m.type==='attributes'){schedule();break;}
    }
  }).observe(home,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  [100,350,800,1500,2600,4200].forEach(ms=>setTimeout(arrange,ms));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

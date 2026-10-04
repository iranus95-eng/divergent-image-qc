(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/staff-expense-history-api';
const WEB_SESSION_KEY='divergent_web_session_token_v1';
const FALLBACK_SESSION_KEY='divergent_fallback_session_token';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>(Number(v)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>{if(!v)return '-';const s=String(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${Number(m[1])+543}`:s;};
async function token(){try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t;}}catch(_){}try{return localStorage.getItem(WEB_SESSION_KEY)||localStorage.getItem(FALLBACK_SESSION_KEY)||'';}catch(_){return '';}}
async function history(){const t=await token();if(!t)throw Error('กรุณาเข้าสู่ระบบใหม่');const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'history'})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw Error(d.error||'โหลดรายงานย้อนหลังไม่สำเร็จ');return d;}
function importedCycleRows(m){const b=Array.isArray(m.sheet_breakdown)?m.sheet_breakdown:[];return b.map((x,i)=>({label:String(x.sheet||`รอบที่ ${i+1}`),date:(()=>{const q=String(x.sheet||'').match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);return q?`${String(q[1]).padStart(2,'0')}/${String(q[2]).padStart(2,'0')}/25${q[3]}`:'-';})(),total:Number(x.total||0),details:Array.isArray(x.details)?x.details:[]}));}
function liveCycleRows(m){return (Array.isArray(m.cycles)?m.cycles:[]).map(c=>({label:c.cycle_label||c.note||c.cycle_type||'รอบค่าใช้จ่าย',date:date(c.actual_date||c.scheduled_date),total:Number(c.total_amount||0),items:Array.isArray(c.items)?c.items:[]}));}
function monthSection(m){
  if(m.source==='EMPTY')return `<section class="month"><h2>${esc(m.label)}</h2><div class="monthtotal">ยอดรวม ${money(m.total_amount)} บาท</div><p class="muted">ยังไม่มีรายการ</p></section>`;
  if(m.source==='IMPORTED'){
    const cycles=importedCycleRows(m);
    const blocks=cycles.map(c=>{const details=c.details.length?`<table><thead><tr><th>#</th><th>รายละเอียดค่าใช้จ่าย</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>${c.details.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.category||'ไม่ระบุรายละเอียด')}</td><td class="num">${money(x.amount)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">รวมรอบ ${esc(c.label)}</td><td class="num">${money(c.total)}</td></tr></tfoot></table>`:`<p class="muted">ไม่มีรายละเอียดหมวดค่าใช้จ่ายของรอบนี้</p>`;return `<div class="cycle"><h3>รอบ ${esc(c.label)} <span>${esc(c.date)}</span></h3>${details}</div>`;}).join('');
    return `<section class="month"><h2>${esc(m.label)}</h2><div class="monthtotal">ยอดรวมเดือน ${money(m.total_amount)} บาท · ${cycles.length} รอบ</div>${blocks}</section>`;
  }
  const cycles=liveCycleRows(m);
  const blocks=cycles.map(c=>{const items=c.items||[];const rows=items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(date(x.expense_date))}</td><td>${esc(x.staff_name||'-')}</td><td>${esc(x.category||'-')}${x.detail||x.note?`<div class="sub">${esc(x.detail||x.note)}</div>`:''}</td><td class="num">${money(x.amount)}</td></tr>`).join('');return `<div class="cycle"><h3>${esc(c.label)} <span>${esc(c.date)}</span></h3>${rows?`<table><thead><tr><th>#</th><th>วันที่</th><th>ผู้เบิก</th><th>รายละเอียดค่าใช้จ่าย</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="4">รวมรอบ</td><td class="num">${money(c.total)}</td></tr></tfoot></table>`:'<p class="muted">ยังไม่มีรายการในรอบนี้</p>'}</div>`;}).join('');
  return `<section class="month"><h2>${esc(m.label)}</h2><div class="monthtotal">ยอดรวมเดือน ${money(m.total_amount)} บาท · ${cycles.length} รอบ</div>${blocks}</section>`;
}
function openPrint(d){
  const months=(d.months||[]).filter(m=>m.source!=='EMPTY'||Number(m.total_amount||0)!==0);
  const summary=months.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.label)}</td><td>${Number(m.cycle_count||0)}</td><td class="num">${money(m.total_amount)}</td></tr>`).join('');
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานค่าใช้จ่ายสตาฟย้อนหลังแบบละเอียด</title><style>@page{size:A4 portrait;margin:10mm 9mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#222;font-size:12px;margin:0}h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:0}h3{font-size:14px;margin:14px 0 7px;color:#3d2466}h3 span{font-weight:400;color:#666;font-size:12px;margin-left:8px}.headnote{color:#666;margin:0 0 14px}.summary,.cycle table{width:100%;border-collapse:collapse}.summary th,.summary td,.cycle th,.cycle td{border:1px solid #bbb;padding:6px 7px;vertical-align:top}.summary th,.cycle th{background:#f2eef8}.num{text-align:right;white-space:nowrap}.month{margin-top:18px;break-before:page}.month:first-of-type{break-before:auto}.monthtotal{font-weight:700;margin:5px 0 8px}.cycle{break-inside:avoid;margin-bottom:14px}.sub{font-size:10px;color:#666;margin-top:2px}.muted{color:#777}.grand{font-size:15px;font-weight:800;text-align:right;margin-top:8px}@media print{.month{page-break-before:always}.month:first-of-type{page-break-before:auto}}</style></head><body><h1>รายงานค่าใช้จ่ายสตาฟย้อนหลังแบบละเอียด</h1><p class="headnote">มกราคม–เดือนปัจจุบัน พ.ศ. ${esc(d.year_be||'')}</p><table class="summary"><thead><tr><th>#</th><th>เดือน</th><th>จำนวนรอบ</th><th class="num">ยอดรวม (บาท)</th></tr></thead><tbody>${summary}</tbody></table><div class="grand">รวมทั้งหมด ${money(d.grand_total)} บาท</div>${months.map(monthSection).join('')}<script>window.onload=()=>window.print()<\/script></body></html>`;
  const w=window.open('','_blank');if(!w){alert('เบราว์เซอร์ปิดกั้นหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');return;}w.document.open();w.document.write(html);w.document.close();
}
async function run(){try{const d=await history();openPrint(d);}catch(e){alert('พิมพ์รายงานไม่สำเร็จ: '+(e?.message||e));}}
function label(){const b=document.getElementById('sehPrintBtn');if(b)b.textContent='🖨 พิมพ์รายงานละเอียด';}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#sehPrintBtn'):null;if(!b)return;e.preventDefault();e.stopImmediatePropagation();run();},true);
new MutationObserver(label).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',label,{once:true});else label();
})();
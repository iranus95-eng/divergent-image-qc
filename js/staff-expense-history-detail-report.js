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
// 2026-10-04: print only the month selected in the history window, all rounds in one list
function monthRounds(m){
  if(m.source==='IMPORTED'&&!(Array.isArray(m.cycles)&&m.cycles.some(c=>(c.items||[]).length))){
    return importedCycleRows(m).map(c=>({label:c.label,date:c.date,total:c.total,items:(c.details||[]).map(x=>({expense_date:'',staff_name:'',category:x.category||'ไม่ระบุรายละเอียด',amount:x.amount})),imported:true}));
  }
  return liveCycleRows(m).map(c=>({...c,imported:false}));
}
function openPrint(d,monthKey){
  const all=d.months||[];
  const m=all.find(x=>x.key===monthKey)||all.filter(x=>x.source!=='EMPTY').slice(-1)[0];
  if(!m){alert('ไม่พบข้อมูลเดือนที่เลือก');return;}
  const rounds=monthRounds(m);let n=0;const body=[];
  rounds.forEach(c=>{
    body.push(`<tr class="round"><td colspan="5"><b>${esc(c.label)}</b> <span>${esc(c.date||'')}${c.items.length&&!c.imported?' · '+c.items.length+' รายการ':''}</span></td></tr>`);
    if(!c.items.length)body.push(`<tr><td></td><td colspan="3" class="muted">${c.imported?'ข้อมูลย้อนหลังจากไฟล์เดิม มีเฉพาะยอดรวมของรอบ':'รอบนี้ยังไม่มีรายการ'}</td><td class="num">${money(c.total)}</td></tr>`);
    c.items.forEach(x=>{n++;body.push(`<tr><td class="c">${n}</td><td>${esc(x.expense_date?date(x.expense_date):'-')}</td><td>${esc(x.staff_name||'-')}</td><td>${esc(x.category||'-')}${x.detail||x.note?`<div class="sub">${esc(x.detail||x.note)}</div>`:''}</td><td class="num">${money(x.amount)}</td></tr>`);});
    body.push(`<tr class="subtotal"><td colspan="4">รวม ${esc(c.label)}</td><td class="num">${money(c.total)}</td></tr>`);
  });
  const summary=rounds.map((c,i)=>`<tr><td class="c">${i+1}</td><td>${esc(c.label)}</td><td>${esc(c.date||'-')}</td><td class="c">${c.imported?'-':c.items.length}</td><td class="num">${money(c.total)}</td></tr>`).join('');
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานค่าใช้จ่ายสตาฟ ${esc(m.label)}</title><style>@page{size:A4 portrait;margin:10mm 9mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,Tahoma,sans-serif;color:#222;font-size:12px;margin:0}
  .brand{font-size:11px;font-weight:800;color:#5b2a86;letter-spacing:.3px}h1{font-size:22px;margin:2px 0 4px}.headnote{color:#666;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px 7px;vertical-align:top}th{background:#5b2a86;color:#fff;text-align:left}.num{text-align:right;white-space:nowrap}.c{text-align:center}
  .summary{margin-bottom:14px}.summary th{background:#f2eef8;color:#3d2466}
  .round td{background:#f3eefa;color:#3d2466}.round span{color:#666;font-weight:400;margin-left:6px}.subtotal td{background:#fbf9fe;font-weight:700;text-align:right}.total td{background:#3b2366;color:#fff;font-weight:800;text-align:right;font-size:14px}
  .sub{font-size:10px;color:#666;margin-top:2px}.muted{color:#777;font-style:italic}h2{font-size:15px;margin:14px 0 6px;color:#3d2466}</style></head><body>
  <div class="brand">DIVERGENT CORPORATION CO., LTD.</div><h1>รายงานค่าใช้จ่ายสตาฟ ${esc(m.label)}</h1><p class="headnote">ยอดรวมเดือน ${money(m.total_amount)} บาท · ${rounds.length} รอบ${n?' · '+n+' รายการ':''} · พิมพ์เมื่อ ${esc(new Date().toLocaleString('th-TH'))}</p>
  <table class="summary"><thead><tr><th style="width:8%">#</th><th>รอบเบิก</th><th style="width:18%">วันที่</th><th style="width:12%">รายการ</th><th class="num" style="width:22%">ยอดรวม (บาท)</th></tr></thead><tbody>${summary}</tbody></table>
  <h2>รายละเอียดทุกรอบ</h2>
  <table class="detail"><thead><tr><th style="width:6%">#</th><th style="width:13%">วันที่</th><th style="width:20%">ผู้เบิก</th><th>รายละเอียดค่าใช้จ่าย</th><th class="num" style="width:18%">จำนวนเงิน (บาท)</th></tr></thead><tbody>${body.join('')}</tbody>
  <tfoot><tr class="total"><td colspan="4">รวมทั้งเดือน ${esc(m.label)}</td><td class="num">${money(m.total_amount)}</td></tr></tfoot></table></body></html>`;
  const name=`Divergent_Expense_${String(m.key||'month').replace(/[^0-9-]/g,'')}.pdf`;
  if(window.DivergentPdf)return window.DivergentPdf.fromHtml(html,{padding:'38px 34px'}).then(b=>window.DivergentPdf.download(b,name)).catch(e=>{console.error(e);alert('สร้าง PDF ไม่สำเร็จ: '+(e.message||e));});
  const w=window.open('','_blank');if(!w){alert('เบราว์เซอร์ปิดกั้นหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');return;}w.document.open();w.document.write(html.replace('</body>','<script>window.onload=()=>window.print()<\/script></body>'));w.document.close();
}
async function run(){try{const key=window.__sehSelectedMonth||document.querySelector('#sehContent .seh-month.active')?.dataset.key||'';const d=await history();await openPrint(d,key);}catch(e){alert('พิมพ์รายงานไม่สำเร็จ: '+(e?.message||e));}}
// only write when different: writing textContent is itself a DOM change and re-triggered this observer forever (page froze when the history loaded)
function label(){const b=document.getElementById('sehPrintBtn');const t='🖨 พิมพ์เฉพาะเดือนที่เลือก';if(b&&b.textContent!==t)b.textContent=t;}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#sehPrintBtn'):null;if(!b)return;e.preventDefault();e.stopImmediatePropagation();run();},true);
new MutationObserver(label).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',label,{once:true});else label();
})();
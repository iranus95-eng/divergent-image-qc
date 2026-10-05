(function(){
'use strict';

const API='https://neauzvqroaszvqffahkv.functions.supabase.co/staff-expense-history-api';
const WEB_SESSION_KEY='divergent_web_session_token_v1';
const FALLBACK_SESSION_KEY='divergent_fallback_session_token';
let cache=null,loading=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>(Number(v)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>{if(!v)return '-';const s=String(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return s;return `${m[3]}/${m[2]}/${Number(m[1])+543}`;};
const sourceLabel=s=>s==='LIVE'?'ข้อมูลรอบเบิกจริง':s==='IMPORTED'?'ข้อมูลย้อนหลังที่นำเข้า':'ยังไม่มีรายการ';
const cycleLabel=c=>c?.cycle_label||c?.note||c?.cycle_type||'รอบค่าใช้จ่าย';

async function bestToken(){
  try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t;}}catch(_){}
  try{return localStorage.getItem(WEB_SESSION_KEY)||localStorage.getItem(FALLBACK_SESSION_KEY)||'';}catch(_){return '';}
}
async function fetchHistory(force=false){
  if(cache&&!force)return cache;if(loading)return loading;
  loading=(async()=>{
    const token=await bestToken();if(!token)throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'history'})});
    const d=await r.json().catch(()=>({error:'SERVER_ERROR'}));if(!r.ok||!d.ok)throw new Error(d.error||'โหลดรายงานย้อนหลังไม่สำเร็จ');
    cache=d;return d;
  })();
  try{return await loading;}finally{loading=null;}
}
function ensureStyle(){
  if(document.getElementById('staffExpenseHistoryStyle'))return;
  const s=document.createElement('style');s.id='staffExpenseHistoryStyle';s.textContent=`
  #staffExpenseHistoryBtn{background:#4d2c91!important;color:#fff!important;border:0!important}
  .seh-overlay{position:fixed;inset:0;z-index:20050;background:rgba(24,14,38,.58);display:flex;align-items:flex-start;justify-content:center;padding:28px 14px;overflow:auto}
  .seh-panel{width:min(1120px,97vw);background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(34,16,61,.3);overflow:hidden}
  .seh-head{padding:20px 22px;background:linear-gradient(135deg,#3d1d79,#7347d8);color:#fff;display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}
  .seh-head h2{margin:0;font-size:24px}.seh-head p{margin:5px 0 0;opacity:.88}.seh-close{background:rgba(255,255,255,.18)!important;color:#fff!important;border:1px solid rgba(255,255,255,.35)!important;padding:9px 14px!important}
  .seh-body{padding:20px 22px 28px}.seh-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}.seh-toolbar button{margin:0}.seh-summary{margin-left:auto;font-weight:800;color:#40206e}
  .seh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.seh-month{border:1px solid #e5ddf2;border-radius:16px;padding:15px;background:#fbf9ff;cursor:pointer;transition:.15s;text-align:left;color:#2d2240}
  .seh-month:hover,.seh-month.active{border-color:#7d55ce;box-shadow:0 5px 16px rgba(89,55,143,.14);transform:translateY(-1px)}.seh-month-title{font-weight:900;font-size:17px}.seh-month-amount{font-size:24px;font-weight:900;color:#542b9c;margin-top:8px}.seh-month-meta{font-size:12px;color:#746782;margin-top:5px}
  .seh-detail{margin-top:18px;border:1px solid #e7dff2;border-radius:16px;padding:17px;background:#fff}.seh-detail h3{margin:0 0 12px;color:#3a1d68}.seh-sub{font-size:13px;color:#756a80;margin:-4px 0 14px}
  .seh-cycles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.seh-cycle{border:1px solid #e6def0!important;background:#fff!important;color:#33233f!important;border-radius:14px!important;padding:12px!important;text-align:left!important;box-shadow:none!important}
  .seh-cycle:hover,.seh-cycle.active{border-color:#774dc7!important;background:#f7f2ff!important}.seh-cycle-title{font-weight:900}.seh-cycle-total{margin-top:7px;color:#542b9c;font-weight:900;font-size:18px}.seh-cycle-meta{margin-top:5px;font-size:11px;color:#756a80}
  .seh-cycle-detail{margin-top:14px;border-top:1px solid #eee;padding-top:14px}.seh-cycle-detail h4{margin:0 0 10px;color:#3c2863;font-size:17px}
  .seh-table-wrap{width:100%;overflow:auto}.seh-table{width:100%;border-collapse:collapse;min-width:700px}.seh-table th,.seh-table td{padding:9px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}.seh-table th{font-size:12px;color:#71677d;background:#faf8fd;white-space:nowrap}.seh-table td.amount,.seh-table th.amount{text-align:right;white-space:nowrap}.seh-item-detail{font-size:12px;color:#746b7b;margin-top:3px}.seh-empty{padding:20px;text-align:center;color:#81778b;background:#fafafa;border-radius:12px}
  .seh-source{display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#eee7fb;color:#4e298d;margin-left:6px}.seh-warning{padding:13px 14px;border-radius:12px;background:#fff7e7;color:#815800;font-size:13px;line-height:1.55}.seh-print-note{font-size:12px;color:#776d80;margin-top:12px}
  @media(max-width:850px){.seh-grid,.seh-cycles{grid-template-columns:repeat(2,minmax(0,1fr))}.seh-summary{width:100%;margin-left:0}}
  @media(max-width:540px){.seh-grid,.seh-cycles{grid-template-columns:1fr}.seh-panel{width:100%}.seh-body{padding:15px}.seh-head{padding:17px}.seh-month-amount{font-size:22px}}
  
  .seh-people{margin:14px 0 6px}.seh-people h4,.seh-detail-title{margin:16px 0 8px;font-size:16px;color:#3B2366}.seh-people-table td:nth-child(3),.seh-people-table td:nth-child(4){white-space:nowrap}
  .seh-combined .seh-round td{background:#F3EFFA;color:#3B2366;border-top:2px solid #E2D9F1}.seh-combined .seh-round span{color:#5F5875;font-weight:400;margin-left:6px}
  .seh-combined .seh-subtotal td{background:#FBF9FE;font-weight:700;color:#3B2366;text-align:right}.seh-combined .seh-subtotal td.amount{color:#4d1d78}
  .seh-combined .seh-monthtotal td{background:#3B2366;color:#fff;font-weight:800;text-align:right;font-size:16px}.seh-muted{color:#6b6475;font-style:italic}
`;document.head.appendChild(s);
}
function ensureModal(){
  ensureStyle();let el=document.getElementById('staffExpenseHistoryModal');if(el)return el;
  el=document.createElement('div');el.id='staffExpenseHistoryModal';el.className='seh-overlay';el.style.display='none';
  el.innerHTML=`<div class="seh-panel"><div class="seh-head"><div><h2>รายงานค่าใช้จ่ายสตาฟย้อนหลัง</h2><p>เลือกเดือน → เลือกรอบค่าใช้จ่าย → ดูรายการของรอบนั้น</p></div><button class="seh-close" type="button">ปิด</button></div><div class="seh-body"><div id="sehContent"><div class="seh-empty">กำลังโหลดข้อมูล...</div></div></div></div>`;
  el.addEventListener('click',e=>{if(e.target===el)closeHistory();});el.querySelector('.seh-close').addEventListener('click',closeHistory);document.body.appendChild(el);return el;
}
function closeHistory(){const el=document.getElementById('staffExpenseHistoryModal');if(el)el.style.display='none';}
function cycleItemsHtml(c){
  if(c.source==='IMPORTED')return `<div class="seh-warning">รอบย้อนหลังนี้มีชื่อรอบและยอดรวมจากไฟล์เดิม แต่ฐานข้อมูลรอบแรกไม่ได้เก็บรายการย่อยของแต่ละคนไว้ จึงแสดงยอดของรอบได้ แต่ยังเปิดรายการย่อยไม่ได้</div>`;
  const items=Array.isArray(c.items)?c.items:[];
  if(!items.length)return `<div class="seh-empty">รอบนี้ยังไม่มีรายการค่าใช้จ่าย</div>`;
  const rows=items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(date(x.expense_date))}</td><td><b>${esc(x.staff_name||'-')}</b></td><td>${esc(x.category||'-')}<div class="seh-item-detail">${esc(x.detail||x.note||'')}</div></td><td>${esc(x.payment_method||'-')}</td><td class="amount">${money(x.amount)}</td></tr>`).join('');
  return `<div class="seh-table-wrap"><table class="seh-table"><thead><tr><th>#</th><th>วันที่</th><th>พนักงาน</th><th>รายการ / รายละเอียด</th><th>วิธีจ่าย</th><th class="amount">จำนวนเงิน (บาท)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
// total claimed per person across every round of the month (rounds with item details only)
function personTotals(cycles){
  const map=new Map();
  (cycles||[]).forEach(c=>{(Array.isArray(c.items)?c.items:[]).forEach(x=>{const name=String(x.staff_name||'ไม่ระบุชื่อ').trim()||'ไม่ระบุชื่อ';let p=map.get(name);if(!p){p={name,count:0,total:0,roundSet:new Set()};map.set(name,p);}p.count++;p.total+=Number(x.amount||0);p.roundSet.add(c.cycle_key||c.id);});});
  return [...map.values()].map(p=>({name:p.name,count:p.count,total:Math.round(p.total*100)/100,rounds:p.roundSet.size})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'th'));
}
// 2026-10-04: one combined list per month — every round's items, with a header and subtotal per round
function monthDetailHtml(m){
  const cycles=Array.isArray(m.cycles)?m.cycles:[];
  if(!cycles.length){
    if(m.source==='IMPORTED')return `<div class="seh-detail"><h3>${esc(m.label)} <span class="seh-source">${sourceLabel(m.source)}</span></h3><div class="seh-warning">เดือนนี้มีเฉพาะยอดรวมย้อนหลัง ${money(m.total_amount)} บาท แต่ข้อมูลที่นำเข้าครั้งแรกไม่ได้เก็บชื่อรอบ/ชีตไว้ จึงยังแยกทุกรอบไม่ได้</div><div class="seh-print-note">แหล่งข้อมูล: ${esc(m.source_file||'ข้อมูลย้อนหลัง')}</div></div>`;
    return `<div class="seh-detail"><h3>${esc(m.label)}</h3><div class="seh-empty">เดือนนี้ยังไม่มีรายการค่าใช้จ่ายสตาฟ</div></div>`;
  }
  let n=0;const body=[];
  cycles.forEach(c=>{
    const items=Array.isArray(c.items)?c.items:[];
    const meta=[c.scheduled_date?date(c.scheduled_date):'',items.length?items.length.toLocaleString('th-TH')+' รายการ':'',c.status||''].filter(Boolean).join(' · ');
    body.push(`<tr class="seh-round"><td colspan="6"><b>${esc(cycleLabel(c))}</b> <span>${esc(meta)}</span></td></tr>`);
    if(c.source==='IMPORTED'||!items.length){
      body.push(`<tr><td></td><td colspan="4" class="seh-muted">${c.source==='IMPORTED'?'ข้อมูลย้อนหลังจากไฟล์เดิม มีเฉพาะยอดรวมของรอบ ไม่มีรายการย่อย':'รอบนี้ยังไม่มีรายการ'}</td><td class="amount">${money(c.total_amount)}</td></tr>`);
    }else items.forEach(x=>{n++;body.push(`<tr><td>${n}</td><td>${esc(date(x.expense_date))}</td><td><b>${esc(x.staff_name||'-')}</b></td><td>${esc(x.category||'-')}<div class="seh-item-detail">${esc(x.detail||x.note||'')}</div></td><td>${esc(x.payment_method||'-')}</td><td class="amount">${money(x.amount)}</td></tr>`);});
    body.push(`<tr class="seh-subtotal"><td colspan="5">รวม ${esc(cycleLabel(c))}</td><td class="amount">${money(c.total_amount)}</td></tr>`);
  });
  const people=personTotals(cycles);
  const personHtml=people.length?`<div class="seh-people"><h4>สรุปยอดเบิกรายบุคคล</h4><div class="seh-table-wrap"><table class="seh-table seh-combined seh-people-table"><thead><tr><th>#</th><th>พนักงาน</th><th>จำนวนรายการ</th><th>รอบที่เบิก</th><th class="amount">ยอดเบิกรวม (บาท)</th></tr></thead><tbody>${people.map((p,i)=>`<tr><td>${i+1}</td><td><b>${esc(p.name)}</b></td><td>${p.count.toLocaleString('th-TH')}</td><td>${p.rounds.toLocaleString('th-TH')} รอบ</td><td class="amount"><b>${money(p.total)}</b></td></tr>`).join('')}</tbody><tfoot><tr class="seh-monthtotal"><td colspan="4">รวม ${people.length.toLocaleString('th-TH')} คน</td><td class="amount">${money(people.reduce((a,p)=>a+p.total,0))}</td></tr></tfoot></table></div></div>`:'';
  return `<div class="seh-detail" data-month="${esc(m.key)}"><h3>${esc(m.label)} <span class="seh-source">${sourceLabel(m.source)}</span></h3><div class="seh-sub">ยอดรวมเดือน ${money(m.total_amount)} บาท · ${cycles.length.toLocaleString('th-TH')} รอบค่าใช้จ่าย${n?' · '+n.toLocaleString('th-TH')+' รายการ':''}</div>${personHtml}<h4 class="seh-detail-title">รายละเอียดทุกรอบ</h4>
  <div class="seh-table-wrap"><table class="seh-table seh-combined"><thead><tr><th>#</th><th>วันที่</th><th>พนักงาน</th><th>รายการ / รายละเอียด</th><th>วิธีจ่าย</th><th class="amount">จำนวนเงิน (บาท)</th></tr></thead><tbody>${body.join('')}</tbody>
  <tfoot><tr class="seh-monthtotal"><td colspan="5">รวมทั้งเดือน ${esc(m.label)}</td><td class="amount">${money(m.total_amount)}</td></tr></tfoot></table></div>${m.source_file?`<div class="seh-print-note">แหล่งข้อมูล: ${esc(m.source_file)}</div>`:''}</div>`;
}
function render(d,selectedMonthKey,selectedCycleKey){
  const months=d.months||[];const selected=months.find(x=>x.key===selectedMonthKey)||months[months.length-1]||null;
  const content=document.getElementById('sehContent');if(!content)return;
  const defaultCycle=selected?.cycles?.[0]?.cycle_key||null;const activeCycle=selectedCycleKey||defaultCycle;
  content.innerHTML=`<div class="seh-toolbar"><button type="button" id="sehRefreshBtn">↻ รีเฟรช</button><button type="button" id="sehPrintBtn">🖨 พิมพ์สรุปย้อนหลัง</button><div class="seh-summary">รวม ม.ค.–ปัจจุบัน ${money(d.grand_total)} บาท</div></div><div class="seh-grid">${months.map(m=>`<button type="button" class="seh-month${selected&&m.key===selected.key?' active':''}" data-key="${esc(m.key)}"><div class="seh-month-title">${esc(m.label)}</div><div class="seh-month-amount">${money(m.total_amount)} <span style="font-size:13px">บาท</span></div><div class="seh-month-meta">${sourceLabel(m.source)}${m.cycle_count?` · ${Number(m.cycle_count).toLocaleString('th-TH')} รอบ`:''}${m.item_count?` · ${Number(m.item_count).toLocaleString('th-TH')} รายการ`:''}</div></button>`).join('')}</div><div id="sehDetail">${selected?monthDetailHtml(selected):''}</div>`;
  content.querySelectorAll('.seh-month').forEach(btn=>btn.addEventListener('click',()=>render(d,btn.dataset.key,null)));
  window.__sehSelectedMonth=selected?selected.key:null;
  document.getElementById('sehRefreshBtn')?.addEventListener('click',()=>openHistory(true));document.getElementById('sehPrintBtn')?.addEventListener('click',()=>printHistory(d));
}
function printHistory(d){
  const rows=(d.months||[]).map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.label)}</td><td>${Number(m.cycle_count||0).toLocaleString('th-TH')}</td><td>${esc(sourceLabel(m.source))}</td><td style="text-align:right">${money(m.total_amount)}</td></tr>`).join('');
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานค่าใช้จ่ายสตาฟย้อนหลัง</title><style>body{font-family:Arial,Tahoma,sans-serif;padding:24px;color:#222}h1{margin:0 0 6px}p{color:#666;margin:0 0 18px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border:1px solid #bbb}th{background:#f1edf7;text-align:left}tfoot td{font-weight:800}</style></head><body><h1>รายงานค่าใช้จ่ายสตาฟย้อนหลัง</h1><p>มกราคม–เดือนปัจจุบัน พ.ศ. ${d.year_be||''}</p><table><thead><tr><th>#</th><th>เดือน</th><th>จำนวนรอบ</th><th>แหล่งข้อมูล</th><th style="text-align:right">ยอดรวม (บาท)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="4">รวมทั้งหมด</td><td style="text-align:right">${money(d.grand_total)}</td></tr></tfoot></table><script>window.onload=()=>window.print()<\/script></body></html>`;
  const w=window.open('','_blank');if(!w)return alert('เบราว์เซอร์ปิดกั้นหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');w.document.open();w.document.write(html);w.document.close();
}
async function openHistory(force=false){
  const modal=ensureModal();modal.style.display='flex';const content=document.getElementById('sehContent');if(content)content.innerHTML='<div class="seh-empty">กำลังโหลดข้อมูลย้อนหลัง...</div>';
  try{const d=await fetchHistory(force);render(d);}catch(e){if(content)content.innerHTML=`<div class="seh-empty" style="color:#a11818">โหลดข้อมูลไม่สำเร็จ: ${esc(e?.message||e)}</div>`;}
}
function injectButton(){
  const root=document.getElementById('staffExpenseWorkspace');if(!root||document.getElementById('staffExpenseHistoryBtn'))return;const head=root.querySelector('.expense-head');if(!head)return;const actions=head.querySelector('div:last-child')||head;
  const b=document.createElement('button');b.id='staffExpenseHistoryBtn';b.type='button';b.textContent='📊 รายงานย้อนหลัง';b.addEventListener('click',()=>openHistory(false));actions.insertBefore(b,actions.firstChild);
}
function boot(){ensureStyle();injectButton();new MutationObserver(injectButton).observe(document.body,{childList:true,subtree:true});}
window.openStaffExpenseHistory=openHistory;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
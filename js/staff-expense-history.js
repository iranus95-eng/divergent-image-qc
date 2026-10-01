(function(){
'use strict';

const API='https://neauzvqroaszvqffahkv.functions.supabase.co/staff-expense-history-api';
const WEB_SESSION_KEY='divergent_web_session_token_v1';
const FALLBACK_SESSION_KEY='divergent_fallback_session_token';
let cache=null;
let loading=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>(Number(v)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>{if(!v)return '-';const s=String(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return s;return `${m[3]}/${m[2]}/${Number(m[1])+543}`;};
const sourceLabel=s=>s==='LIVE'?'ข้อมูลรอบเบิกจริง':s==='IMPORTED'?'ข้อมูลย้อนหลังที่นำเข้า':'ยังไม่มีรายการ';

async function bestToken(){
  try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t;}}catch(_){}
  try{return localStorage.getItem(WEB_SESSION_KEY)||localStorage.getItem(FALLBACK_SESSION_KEY)||'';}catch(_){return '';}
}
async function fetchHistory(force=false){
  if(cache&&!force)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const token=await bestToken();
    if(!token)throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'history'})});
    const d=await r.json().catch(()=>({error:'SERVER_ERROR'}));
    if(!r.ok||!d.ok)throw new Error(d.error||'โหลดรายงานย้อนหลังไม่สำเร็จ');
    cache=d;return d;
  })();
  try{return await loading;}finally{loading=null;}
}
function ensureStyle(){
  if(document.getElementById('staffExpenseHistoryStyle'))return;
  const s=document.createElement('style');s.id='staffExpenseHistoryStyle';s.textContent=`
  #staffExpenseHistoryBtn{background:#4d2c91!important;color:#fff!important;border:0!important}
  .seh-overlay{position:fixed;inset:0;z-index:20050;background:rgba(24,14,38,.58);display:flex;align-items:flex-start;justify-content:center;padding:28px 14px;overflow:auto}
  .seh-panel{width:min(1040px,96vw);background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(34,16,61,.3);overflow:hidden}
  .seh-head{padding:20px 22px;background:linear-gradient(135deg,#3d1d79,#7347d8);color:#fff;display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}
  .seh-head h2{margin:0;font-size:24px}.seh-head p{margin:5px 0 0;opacity:.88}
  .seh-close{background:rgba(255,255,255,.18)!important;color:#fff!important;border:1px solid rgba(255,255,255,.35)!important;padding:9px 14px!important}
  .seh-body{padding:20px 22px 26px}.seh-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
  .seh-toolbar button{margin:0}.seh-summary{margin-left:auto;font-weight:800;color:#40206e}
  .seh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}
  .seh-month{border:1px solid #e5ddf2;border-radius:16px;padding:15px;background:#fbf9ff;cursor:pointer;transition:.15s;text-align:left;color:#2d2240}
  .seh-month:hover,.seh-month.active{border-color:#7d55ce;box-shadow:0 5px 16px rgba(89,55,143,.14);transform:translateY(-1px)}
  .seh-month-title{font-weight:900;font-size:17px}.seh-month-amount{font-size:24px;font-weight:900;color:#542b9c;margin-top:8px}.seh-month-meta{font-size:12px;color:#746782;margin-top:5px}
  .seh-detail{margin-top:18px;border:1px solid #e7dff2;border-radius:16px;padding:17px;background:#fff}.seh-detail h3{margin:0 0 12px;color:#3a1d68}
  .seh-table{width:100%;border-collapse:collapse}.seh-table th,.seh-table td{padding:9px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}.seh-table th{font-size:12px;color:#71677d;background:#faf8fd}.seh-table td:last-child,.seh-table th:last-child{text-align:right}.seh-empty{padding:20px;text-align:center;color:#81778b;background:#fafafa;border-radius:12px}
  .seh-source{display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#eee7fb;color:#4e298d;margin-left:6px}
  .seh-status{font-weight:700}.seh-print-note{font-size:12px;color:#776d80;margin-top:12px}
  @media(max-width:800px){.seh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.seh-summary{width:100%;margin-left:0}.seh-table{font-size:13px}}
  @media(max-width:520px){.seh-grid{grid-template-columns:1fr}.seh-panel{width:100%}.seh-body{padding:15px}.seh-head{padding:17px}.seh-month-amount{font-size:22px}}
  `;document.head.appendChild(s);
}
function ensureModal(){
  ensureStyle();
  let el=document.getElementById('staffExpenseHistoryModal');
  if(el)return el;
  el=document.createElement('div');el.id='staffExpenseHistoryModal';el.className='seh-overlay';el.style.display='none';
  el.innerHTML=`<div class="seh-panel"><div class="seh-head"><div><h2>รายงานค่าใช้จ่ายสตาฟย้อนหลัง</h2><p>แสดงเป็นรายเดือน ตั้งแต่มกราคมถึงเดือนปัจจุบัน</p></div><button class="seh-close" type="button">ปิด</button></div><div class="seh-body"><div id="sehContent"><div class="seh-empty">กำลังโหลดข้อมูล...</div></div></div></div>`;
  el.addEventListener('click',e=>{if(e.target===el)closeHistory();});
  el.querySelector('.seh-close').addEventListener('click',closeHistory);
  document.body.appendChild(el);return el;
}
function closeHistory(){const el=document.getElementById('staffExpenseHistoryModal');if(el)el.style.display='none';}
function detailHtml(m){
  let rows='';
  if(m.source==='LIVE'&&Array.isArray(m.cycles)&&m.cycles.length){
    rows=m.cycles.map(c=>`<tr><td>${esc(c.cycle_type||'รอบเบิก')}<div style="font-size:12px;color:#777">กำหนด ${esc(date(c.scheduled_date))}${c.actual_date?' · จ่าย '+esc(date(c.actual_date)):''}</div></td><td>${Number(c.item_count||0).toLocaleString('th-TH')} รายการ</td><td class="seh-status">${esc(c.status||'-')}</td><td>${money(c.total_amount)} บาท</td></tr>`).join('');
    return `<div class="seh-detail"><h3>${esc(m.label)} <span class="seh-source">${sourceLabel(m.source)}</span></h3><table class="seh-table"><thead><tr><th>รอบเบิก</th><th>รายการ</th><th>สถานะ</th><th>ยอดรวม</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  if(m.source==='IMPORTED'&&Array.isArray(m.sheet_breakdown)&&m.sheet_breakdown.length){
    rows=m.sheet_breakdown.map(x=>`<tr><td>${esc(x.sheet||'-')}</td><td>${money(x.total)} บาท</td></tr>`).join('');
    return `<div class="seh-detail"><h3>${esc(m.label)} <span class="seh-source">${sourceLabel(m.source)}</span></h3><table class="seh-table"><thead><tr><th>รอบ/ชีตเดิม</th><th>ยอดรวม</th></tr></thead><tbody>${rows}</tbody></table><div class="seh-print-note">แหล่งข้อมูล: ${esc(m.source_file||'ข้อมูลนำเข้าย้อนหลัง')}</div></div>`;
  }
  if(m.source==='IMPORTED')return `<div class="seh-detail"><h3>${esc(m.label)} <span class="seh-source">${sourceLabel(m.source)}</span></h3><div class="seh-empty">ยอดรวมย้อนหลัง ${money(m.total_amount)} บาท · ไม่มีรายละเอียดรอบแยกในข้อมูลต้นฉบับ</div></div>`;
  return `<div class="seh-detail"><h3>${esc(m.label)}</h3><div class="seh-empty">เดือนนี้ยังไม่มีรายการค่าใช้จ่ายสตาฟ</div></div>`;
}
function render(d,selectedKey){
  const months=d.months||[];const selected=months.find(x=>x.key===selectedKey)||months[months.length-1]||null;
  const content=document.getElementById('sehContent');if(!content)return;
  content.innerHTML=`<div class="seh-toolbar"><button type="button" id="sehRefreshBtn">↻ รีเฟรช</button><button type="button" id="sehPrintBtn">🖨 พิมพ์รายงานย้อนหลัง</button><div class="seh-summary">รวม ม.ค.–ปัจจุบัน ${money(d.grand_total)} บาท</div></div><div class="seh-grid">${months.map(m=>`<button type="button" class="seh-month${selected&&m.key===selected.key?' active':''}" data-key="${esc(m.key)}"><div class="seh-month-title">${esc(m.label)}</div><div class="seh-month-amount">${money(m.total_amount)} <span style="font-size:13px">บาท</span></div><div class="seh-month-meta">${sourceLabel(m.source)}${m.item_count?` · ${Number(m.item_count).toLocaleString('th-TH')} รายการ`:''}</div></button>`).join('')}</div><div id="sehDetail">${selected?detailHtml(selected):''}</div>`;
  content.querySelectorAll('.seh-month').forEach(btn=>btn.addEventListener('click',()=>render(d,btn.dataset.key)));
  document.getElementById('sehRefreshBtn')?.addEventListener('click',()=>openHistory(true));
  document.getElementById('sehPrintBtn')?.addEventListener('click',()=>printHistory(d));
}
function printHistory(d){
  const rows=(d.months||[]).map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.label)}</td><td>${esc(sourceLabel(m.source))}</td><td style="text-align:right">${money(m.total_amount)}</td></tr>`).join('');
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานค่าใช้จ่ายสตาฟย้อนหลัง</title><style>body{font-family:Arial,Tahoma,sans-serif;padding:24px;color:#222}h1{margin:0 0 6px}p{color:#666;margin:0 0 18px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border:1px solid #bbb}th{background:#f1edf7;text-align:left}tfoot td{font-weight:800} @media print{button{display:none}}</style></head><body><h1>รายงานค่าใช้จ่ายสตาฟย้อนหลัง</h1><p>มกราคม–เดือนปัจจุบัน พ.ศ. ${d.year_be||''}</p><table><thead><tr><th>#</th><th>เดือน</th><th>แหล่งข้อมูล</th><th style="text-align:right">ยอดรวม (บาท)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">รวมทั้งหมด</td><td style="text-align:right">${money(d.grand_total)}</td></tr></tfoot></table><script>window.onload=()=>window.print()<\/script></body></html>`;
  const w=window.open('','_blank');if(!w)return alert('เบราว์เซอร์ปิดกั้นหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');w.document.open();w.document.write(html);w.document.close();
}
async function openHistory(force=false){
  const modal=ensureModal();modal.style.display='flex';
  const content=document.getElementById('sehContent');if(content)content.innerHTML='<div class="seh-empty">กำลังโหลดข้อมูลย้อนหลัง...</div>';
  try{const d=await fetchHistory(force);render(d);}catch(e){if(content)content.innerHTML=`<div class="seh-empty" style="color:#a11818">โหลดข้อมูลไม่สำเร็จ: ${esc(e?.message||e)}</div>`;}
}
function injectButton(){
  const root=document.getElementById('staffExpenseWorkspace');if(!root||document.getElementById('staffExpenseHistoryBtn'))return;
  const head=root.querySelector('.expense-head');if(!head)return;
  const actions=head.querySelector('div:last-child')||head;
  const b=document.createElement('button');b.id='staffExpenseHistoryBtn';b.type='button';b.textContent='📊 รายงานย้อนหลัง';b.addEventListener('click',()=>openHistory(false));
  actions.insertBefore(b,actions.firstChild);
}
function boot(){ensureStyle();injectButton();new MutationObserver(injectButton).observe(document.body,{childList:true,subtree:true});}
window.openStaffExpenseHistory=openHistory;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
/* การไฟฟ้าที่ยังเบิกไม่ได้ — 2026-10-04
 * Shows every row, in every month, that has no "รายการรับเงินวันที่" (received date) yet,
 * grouped by month from January. Data: claim-pending-api (register rows merged with edits made in
 * the ตั้งเบิกค่าตอบแทน menu). Missing bill count / claim amount is shown as a note on the row.
 */
(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/claim-pending-api';
const MONTH_KEYS=['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'];
const MONTH_NAMES=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
let state={loaded:false,loading:null,loadedAt:0,months:[],rows:[],error:''};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthValue=(y,m)=>`${y}-${String(m).padStart(2,'0')}`;
const money=v=>Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const n=v=>Number(v||0).toLocaleString('th-TH');
function oldToValue(v){
  if(v==='ALL'||/^\d{4}-\d{2}$/.test(String(v||'')))return String(v||'ALL');
  const i=MONTH_KEYS.indexOf(String(v||''));return i>=0?monthValue(2569,i+1):'ALL';
}
function selected(){return document.getElementById('claimPendingMonth')?.value||'ALL';}
function labelFor(v){if(v==='ALL')return 'ทุกเดือน';const m=state.months.find(x=>x.key===v);return m?.label||v;}
async function api(){
  const token=typeof window.getBestDataToken==='function'?await window.getBestDataToken():'';
  if(!token)throw new Error('AUTH_REQUIRED');
  const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'list'})});
  const d=await res.json().catch(()=>({error:'SERVER_ERROR'}));if(!res.ok||!d.ok)throw new Error(d.error||'SERVER_ERROR');return d;
}
function isUnpaid(r){return !String(r.received_date||'').trim();}
function normalizeRow(r){
  const sourceRow=Number(r.source_row||0);
  return {...r,branch:r.agency||'',seq:sourceRow>=4?sourceRow-3:(sourceRow||'-'),key:monthValue(r.report_year,r.report_month),
    month_label:r.month_label||`${MONTH_NAMES[Number(r.report_month||1)-1]||''} ${r.report_year||''}`,unpaid:isUnpaid(r)};
}
function allRows(){return state.rows.map(normalizeRow).sort((a,b)=>a.report_year-b.report_year||a.report_month-b.report_month||Number(a.seq||9999)-Number(b.seq||9999));}
function rowsFor(value){
  const rows=allRows();
  if(!value||value==='ALL')return rows;
  if(/^\d{4}-\d{2}$/.test(value))return rows.filter(r=>r.key===value);
  const idx=MONTH_KEYS.indexOf(value);return idx>=0?rows.filter(r=>Number(r.report_year)===2569&&Number(r.report_month)===idx+1):[];
}
function unpaidFor(value){return rowsFor(value).filter(r=>r.unpaid);}
function monthsFor(value){return (value==='ALL'?state.months:state.months.filter(m=>m.key===value));}
function fillMonths(){
  const sel=document.getElementById('claimPendingMonth');if(!sel)return;
  const prior=sel.dataset.touched?oldToValue(sel.value):'ALL';
  const all=allRows();
  const options=['<option value="ALL">ทุกเดือน (ม.ค. → ล่าสุด)</option>'].concat(state.months.map(m=>{
    const c=all.filter(r=>r.key===m.key&&r.unpaid).length;
    return `<option value="${esc(m.key)}">${esc(m.label)} · ${c?'ค้างรับเงิน '+n(c)+' แห่ง':'รับเงินครบ'}</option>`;
  }));
  sel.innerHTML=options.join('');
  sel.value=[...sel.options].some(o=>o.value===prior)?prior:'ALL';
}
function setupStatic(){
  const ws=document.getElementById('claimPendingWorkspace');if(!ws||ws.dataset.unpaidV2)return;
  ws.dataset.unpaidV2='1';
  const p=ws.querySelector('.payroll-head p');if(p)p.textContent='แสดงทุกรายการที่ยังไม่มี “รายการรับเงินวันที่” เรียงตามเดือน ตั้งแต่มกราคม • แก้วันที่รับเงินได้ที่เมนูตั้งเบิกค่าตอบแทน';
  const labels=[['claimPendingCount','ยังไม่ได้รับเงิน'],['claimPendingBoth','ยอดค้างรับ (บาท)'],['claimPendingBillCount','เดือนที่มีค้าง'],['claimPendingAmountCount','ข้อมูลตั้งเบิกไม่ครบ']];
  labels.forEach(([id,t])=>{const b=document.getElementById(id);const s=b&&b.parentElement&&b.parentElement.querySelector('span');if(s)s.textContent=t;});
  const head=ws.querySelector('.pending-claim-table thead tr');
  if(head)head.innerHTML='<th style="width:70px">ลำดับ</th><th>การไฟฟ้า</th><th style="text-align:right">ยอดตั้งเบิก (บาท)</th><th>สถานะ</th>';
  const st=document.createElement('style');st.textContent=`
    #claimPendingWorkspace .cp-month td{background:#F3EFFA;color:#3B2366;font-weight:700;border-top:2px solid #E2D9F1}
    #claimPendingWorkspace .cp-month .cp-sub{font-weight:400;color:#5F5875;margin-left:8px}
    #claimPendingWorkspace .cp-month.cp-clear td{background:#F1FAF4;color:#166534;border-top-color:#D5EEDD}
    #claimPendingWorkspace .cp-amt{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    #claimPendingWorkspace .cp-note{display:inline-block;margin-top:4px;font-size:13px;color:#9a3412;background:#FFF4E5;border-radius:6px;padding:2px 8px}
    #claimPendingWorkspace .cp-seq{color:#5F5875;text-align:center}
    #claimPendingWorkspace .cp-subtotal td{background:#FBF9FE;font-weight:700;color:#3B2366;border-top:1px solid #E2D9F1}
    #claimPendingWorkspace .cp-subtotal .cp-amt{color:#b42318;font-size:16px}
    #claimPendingWorkspace .cp-grand td{background:#3B2366;color:#fff;font-weight:800;font-size:16px}
    #claimPendingWorkspace .cp-grand .cp-sub{color:#E6DDF5}
    #claimPendingWorkspace .cp-subtotal .cp-sub{font-weight:400;color:#5F5875}
    #claimPendingWorkspace .pending-claim-table{table-layout:auto!important;width:100%!important;min-width:640px!important}
    #claimPendingWorkspace .payroll-head{flex-wrap:wrap}
    #claimPendingWorkspace .payroll-head>div:first-child{flex:1 1 320px;min-width:0}
    #claimPendingWorkspace .pending-claim-toolbar{flex:1 1 320px}
    #claimPendingWorkspace .pending-claim-table td:last-child,#claimPendingWorkspace .pending-claim-table th:last-child{width:150px;white-space:nowrap}
    #claimPendingWorkspace .pending-claim-table .pending-bad{white-space:nowrap;display:inline-block}
  `;document.head.appendChild(st);
  const sel=document.getElementById('claimPendingMonth');if(sel)sel.addEventListener('change',()=>{sel.dataset.touched='1';},true);
}
function render(){
  setupStatic();
  const value=selected();const q=String(document.getElementById('claimPendingSearch')?.value||'').trim().toLowerCase();
  const unpaid=unpaidFor(value);
  const total=unpaid.reduce((s,r)=>s+Number(r.claim_amount||0),0);
  const monthsWith=new Set(unpaid.map(r=>r.key)).size;
  const incomplete=unpaid.filter(r=>(r.missing||[]).length>0).length;
  const set=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
  set('claimPendingCount',n(unpaid.length)+' แห่ง');set('claimPendingBoth',money(total));set('claimPendingBillCount',n(monthsWith));set('claimPendingAmountCount',n(incomplete));
  let visible=unpaid;
  if(q)visible=visible.filter(r=>String(r.branch||'').toLowerCase().includes(q)||String(r.month_label||'').toLowerCase().includes(q));
  const body=document.getElementById('claimPendingBody');
  if(body){
    if(state.loading&&!state.loaded)body.innerHTML='<tr><td colspan="4" style="padding:24px;text-align:center">กำลังโหลดข้อมูลล่าสุดจากฐานข้อมูล...</td></tr>';
    else if(state.error)body.innerHTML=`<tr><td colspan="4" style="padding:24px;text-align:center;color:#b42318">โหลดข้อมูลไม่สำเร็จ: ${esc(state.error)}</td></tr>`;
    else{
      const html=[];let grand=0,grandCount=0;
      for(const m of monthsFor(value)){
        const rows=visible.filter(r=>r.key===m.key);
        const allInMonth=unpaid.filter(r=>r.key===m.key);
        if(!rows.length){
          if(!q&&!allInMonth.length)html.push(`<tr class="cp-month cp-clear"><td colspan="4">${esc(m.label)}<span class="cp-sub">รับเงินครบทุกแห่ง ✓ (${n(m.total)} แห่ง)</span></td></tr>`);
          continue;
        }
        const sum=allInMonth.reduce((s,r)=>s+Number(r.claim_amount||0),0);
        html.push(`<tr class="cp-month"><td colspan="4">${esc(m.label)}<span class="cp-sub">ค้างรับเงิน ${n(allInMonth.length)} จาก ${n(m.total)} แห่ง • ยอด ${money(sum)} บาท</span></td></tr>`);
        rows.forEach(r=>{
          const note=(r.missing||[]).length?`<div><span class="cp-note">ข้อมูลตั้งเบิกยังไม่ครบ: ${esc(r.missing.join(', '))}</span></div>`:'';
          html.push(`<tr><td class="cp-seq">${esc(r.seq)}</td><td><div style="font-weight:700;color:#352245">${esc(r.branch||'-')}</div>${note}</td><td class="cp-amt">${r.claim_amount>0?money(r.claim_amount):'<span style="color:#9a3412">ยังไม่มียอด</span>'}</td><td><span class="pending-bad">ยังไม่ได้รับเงิน</span></td></tr>`);
        });
        const vsum=rows.reduce((s,r)=>s+Number(r.claim_amount||0),0);
        html.push(`<tr class="cp-subtotal"><td></td><td>รวมค้างรับ ${esc(m.label)} <span class="cp-sub">(${n(rows.length)} แห่ง)</span></td><td class="cp-amt">${money(vsum)}</td><td></td></tr>`);
        grand+=vsum;grandCount+=rows.length;
      }
      if(grandCount)html.push(`<tr class="cp-grand"><td></td><td>รวมค้างรับทั้งหมด${value==='ALL'?' ทุกเดือน':''} <span class="cp-sub">(${n(grandCount)} แห่ง)</span></td><td class="cp-amt">${money(grand)}</td><td></td></tr>`);
      body.innerHTML=html.length?html.join(''):'<tr><td colspan="4" style="padding:24px;text-align:center;color:#6f617c">'+(q?'ไม่พบรายการตามคำค้นหา':'ทุกแห่งมีวันที่รับเงินแล้ว ✓')+'</td></tr>';
    }
  }
  const s=document.getElementById('claimPendingStatus');
  if(s)s.textContent=state.error?'โหลดข้อมูลล่าสุดไม่สำเร็จ':`ข้อมูลล่าสุดจากฐานข้อมูล • ${labelFor(value)} • ยังไม่ได้รับเงิน ${n(unpaid.length)} แห่ง ยอด ${money(total)} บาท${q?' • ผลค้นหา '+n(visible.length)+' รายการ':''}`;
}
async function load(force=false){
  if(state.loading)return state.loading;if(state.loaded&&!force&&Date.now()-state.loadedAt<30000){render();return;}
  state.error='';state.loading=(async()=>{try{const d=await api();state.months=(d.months||[]).map(m=>({...m,key:monthValue(m.report_year,m.report_month)})).sort((a,b)=>a.report_year-b.report_year||a.report_month-b.report_month);state.rows=d.rows||[];state.loaded=true;state.loadedAt=Date.now();fillMonths();}catch(e){state.error=String(e?.message||e||'SERVER_ERROR');}finally{state.loading=null;render();}})();render();return state.loading;
}
window.claimPendingRows=function(monthKey){return unpaidFor(monthKey||selected());};
window.renderClaimPendingWorkspace=function(){if(!state.loaded||Date.now()-state.loadedAt>30000)load(false);else render();};
window.refreshClaimPendingData=function(){return load(true);};
window.pendingReportSnapshot=function(){const key=selected(),rows=unpaidFor(key);return {key,label:labelFor(key),rows,months:monthsFor(key),total:rows.reduce((s,r)=>s+Number(r.claim_amount||0),0),monthsWith:new Set(rows.map(r=>r.key)).size,incomplete:rows.filter(r=>(r.missing||[]).length>0).length};};
// PDF/LINE report: same grouping as the screen
window.buildPendingPdfPages=function(){
  const s=window.pendingReportSnapshot();
  const td='padding:7px 5px;border-bottom:1px solid #eee8f2';
  const body=[];
  for(const m of s.months){
    const rows=s.rows.filter(r=>r.key===m.key);
    if(!rows.length){body.push(`<tr><td colspan="4" style="${td};background:#f1faf4;color:#166534;font-weight:700">${reportPdfEsc(m.label)} — รับเงินครบทุกแห่ง</td></tr>`);continue;}
    const sum=rows.reduce((a,r)=>a+Number(r.claim_amount||0),0);
    body.push(`<tr><td colspan="4" style="${td};background:#f4eef8;color:#4a2369;font-weight:900">${reportPdfEsc(m.label)} — ค้างรับเงิน ${n(rows.length)} แห่ง • ${money(sum)} บาท</td></tr>`);
    rows.forEach(r=>body.push(`<tr><td style="${td};text-align:center">${reportPdfEsc(r.seq)}</td><td style="${td};font-weight:700">${reportPdfEsc(r.branch||'-')}${(r.missing||[]).length?`<div style="font-weight:400;color:#9a3412">ข้อมูลตั้งเบิกยังไม่ครบ: ${reportPdfEsc(r.missing.join(', '))}</div>`:''}</td><td style="${td};text-align:right">${r.claim_amount>0?money(r.claim_amount):'-'}</td><td style="${td};color:#a53b4b">ยังไม่ได้รับเงิน</td></tr>`));
    body.push(`<tr><td style="${td};background:#fbf9fe"></td><td style="${td};background:#fbf9fe;font-weight:900;color:#4a2369">รวมค้างรับ ${reportPdfEsc(m.label)} (${n(rows.length)} แห่ง)</td><td style="${td};background:#fbf9fe;text-align:right;font-weight:900;color:#b42318">${money(sum)}</td><td style="${td};background:#fbf9fe"></td></tr>`);
  }
  if(s.rows.length)body.push(`<tr><td style="${td};background:#3b2366"></td><td style="${td};background:#3b2366;color:#fff;font-weight:900">รวมค้างรับทั้งหมด (${n(s.rows.length)} แห่ง)</td><td style="${td};background:#3b2366;color:#fff;text-align:right;font-weight:900">${money(s.total)}</td><td style="${td};background:#3b2366"></td></tr>`);
  const pages=[];const PER=34;const chunks=[];for(let i=0;i<body.length;i+=PER)chunks.push(body.slice(i,i+PER));if(!chunks.length)chunks.push([]);
  chunks.forEach((chunk,i)=>{
    const page=document.createElement('div');page.style.cssText=reportA4Base();
    page.innerHTML=reportHeader('การไฟฟ้าที่ยังไม่ได้รับเงิน',`${s.label} • รายการที่ยังไม่มีวันที่รับเงิน`,'UNPAID REPORT')+
      (i===0?`<div style="position:relative;margin-top:62px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${[['ยังไม่ได้รับเงิน',n(s.rows.length),'แห่ง'],['ยอดค้างรับ',money(s.total),'บาท'],['เดือนที่มีค้าง',n(s.monthsWith),'เดือน'],['ข้อมูลตั้งเบิกไม่ครบ',n(s.incomplete),'แห่ง']].map(x=>`<div style="border:1px solid #e7ddec;border-radius:14px;padding:13px;background:#fff"><div style="font-size:9px;color:#817487">${x[0]}</div><div style="font-size:19px;font-weight:900;color:#a53b4b;margin-top:4px">${x[1]}</div><div style="font-size:8px;color:#9b8fa1">${x[2]}</div></div>`).join('')}</div>`:'<div style="height:62px"></div>')+
      `<div style="margin-top:15px;border:1px solid #e8deef;border-radius:15px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr style="background:#f4eef8;color:#5a4568"><th style="padding:8px 5px;width:40px">#</th><th style="padding:8px 5px;text-align:left">การไฟฟ้า</th><th style="padding:8px 5px;text-align:right">ยอดตั้งเบิก (บาท)</th><th style="padding:8px 5px;text-align:left">สถานะ</th></tr></thead><tbody>${chunk.join('')||'<tr><td colspan="4" style="padding:22px;text-align:center;color:#777">ทุกแห่งมีวันที่รับเงินแล้ว</td></tr>'}</tbody></table></div>`+
      reportFooter(i+1,chunks.length);
    pages.push(page);
  });
  return {pages,label:s.label,fileName:`Divergent_Unpaid_${reportSafeFilePart(s.label)}.pdf`,summary:`รายงานการไฟฟ้าที่ยังไม่ได้รับเงิน ${s.label}\nค้างรับเงิน ${n(s.rows.length)} แห่ง ยอด ${money(s.total)} บาท`};
};
const oldOpen=window.openClaimPendingManagement;
window.openClaimPendingManagement=function(){
  if(typeof window.requireMenuAccess==='function'&&!window.requireMenuAccess('claim_pending','เมนูการไฟฟ้าที่ยังเบิกไม่ได้'))return;
  if(typeof window.showWorkspace==='function')window.showWorkspace('claimPending');else if(typeof oldOpen==='function')oldOpen();
  load(true);
};
function boot(){
  setupStatic();
  const toolbar=document.querySelector('#claimPendingWorkspace .pending-claim-toolbar');
  if(toolbar){const btn=[...toolbar.querySelectorAll('button')].find(b=>(b.textContent||'').includes('รีเฟรช'));if(btn){btn.removeAttribute('onclick');btn.addEventListener('click',()=>load(true));}}
  const sel=document.getElementById('claimPendingMonth');if(sel){sel.removeAttribute('onchange');sel.value='ALL';sel.addEventListener('change',render);}
  const search=document.getElementById('claimPendingSearch');if(search){search.removeAttribute('oninput');search.addEventListener('input',render);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

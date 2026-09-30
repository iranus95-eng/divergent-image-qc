(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/claim-pending-api';
const MONTH_KEYS=['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'];
const MONTH_NAMES=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
let state={loaded:false,loading:null,loadedAt:0,months:[],rows:[],totalRecords:0,error:''};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthValue=(y,m)=>`${y}-${String(m).padStart(2,'0')}`;
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
function fillMonths(){
  const sel=document.getElementById('claimPendingMonth');if(!sel)return;
  const prior=oldToValue(sel.value);
  const options=['<option value="ALL">ทุกเดือน</option>'].concat(state.months.map(m=>`<option value="${esc(m.key)}">${esc(m.label)} · ${Number(m.total||0).toLocaleString('th-TH')} รายการ${Number(m.pending)>0?' · ยังเบิกไม่ได้ '+Number(m.pending).toLocaleString('th-TH'):''}</option>`));
  sel.innerHTML=options.join('');
  sel.value=[...sel.options].some(o=>o.value===prior)?prior:'ALL';
}
function normalizeRow(r){
  const sourceRow=Number(r.source_row||0);
  return {...r,branch:r.agency||'',seq:sourceRow>=4?sourceRow-3:(sourceRow||'-'),month_label:r.month_label||`${MONTH_NAMES[Number(r.report_month||1)-1]||''} ${r.report_year||''}`};
}
function rowsFor(value){
  const rows=state.rows.map(normalizeRow);
  if(!value||value==='ALL')return rows;
  if(/^\d{4}-\d{2}$/.test(value))return rows.filter(r=>monthValue(r.report_year,r.report_month)===value);
  const idx=MONTH_KEYS.indexOf(value);return idx>=0?rows.filter(r=>Number(r.report_year)===2569&&Number(r.report_month)===idx+1):[];
}
function render(){
  const value=selected();const q=String(document.getElementById('claimPendingSearch')?.value||'').trim().toLowerCase();
  const selectedRows=rowsFor(value);const pendingRows=selectedRows.filter(r=>(r.missing||[]).length>0);
  const both=pendingRows.filter(r=>(r.missing||[]).length===2).length;
  const missBill=pendingRows.filter(r=>(r.missing||[]).includes('(จน.ราย) ตั้งเบิกตามใบเสร็จ')).length;
  const missAmount=pendingRows.filter(r=>(r.missing||[]).includes('จำนวนเงินตั้งเบิก')).length;
  let visibleRows=selectedRows;
  if(q)visibleRows=visibleRows.filter(r=>String(r.branch||'').toLowerCase().includes(q)||String(r.month_label||'').toLowerCase().includes(q));
  const set=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
  set('claimPendingCount',pendingRows.length.toLocaleString('th-TH')+' แห่ง');set('claimPendingBoth',both.toLocaleString('th-TH'));set('claimPendingBillCount',missBill.toLocaleString('th-TH'));set('claimPendingAmountCount',missAmount.toLocaleString('th-TH'));
  const body=document.getElementById('claimPendingBody');
  if(body){
    if(state.loading&&!state.loaded)body.innerHTML='<tr><td colspan="3" style="padding:24px;text-align:center">กำลังโหลดข้อมูลล่าสุดจากฐานข้อมูล...</td></tr>';
    else if(state.error)body.innerHTML=`<tr><td colspan="3" style="padding:24px;text-align:center;color:#b42318">โหลดข้อมูลไม่สำเร็จ: ${esc(state.error)}</td></tr>`;
    else if(!visibleRows.length)body.innerHTML='<tr><td colspan="3" style="padding:24px;text-align:center;color:#6f617c">ไม่พบรายการตามตัวกรองที่เลือก</td></tr>';
    else body.innerHTML=visibleRows.map(r=>{
      const pending=(r.missing||[]).length>0;
      const detail=pending?(r.missing||[]).map(x=>`<span class="pending-missing">ขาด: ${esc(x)}</span>`).join(' '):'<span class="pending-ok">ข้อมูลครบสำหรับตั้งเบิก</span>';
      const status=pending?'<span class="pending-bad">ยังเบิกไม่ได้</span>':'<span class="pending-ok">ข้อมูลครบ</span>';
      return `<tr><td>${esc(r.month_label||'')}</td><td><div style="font-weight:800;color:#352245">${esc(r.branch||'-')}</div><div style="margin-top:5px">${detail}</div></td><td>${status}</td></tr>`;
    }).join('');
  }
  const s=document.getElementById('claimPendingStatus');
  if(s){
    s.textContent=state.error?'โหลดข้อมูลล่าสุดไม่สำเร็จ':`ข้อมูลล่าสุดจากฐานข้อมูลจริง • แสดง ${selectedRows.length.toLocaleString('th-TH')} รายการ • ยังเบิกไม่ได้ ${pendingRows.length.toLocaleString('th-TH')} แห่ง${q?' • ผลค้นหา '+visibleRows.length.toLocaleString('th-TH')+' รายการ':''}`;
  }
}
async function load(force=false){
  if(state.loading)return state.loading;if(state.loaded&&!force&&Date.now()-state.loadedAt<30000){render();return;}
  state.error='';state.loading=(async()=>{try{const d=await api();state.months=(d.months||[]).map(m=>({...m,key:monthValue(m.report_year,m.report_month)}));state.rows=d.rows||[];state.totalRecords=Number(d.total_records||0);state.loaded=true;state.loadedAt=Date.now();fillMonths();}catch(e){state.error=String(e?.message||e||'SERVER_ERROR');}finally{state.loading=null;render();}})();render();return state.loading;
}
window.claimPendingRows=function(monthKey){return rowsFor(monthKey||selected()).filter(r=>(r.missing||[]).length>0);};
window.renderClaimPendingWorkspace=function(){if(!state.loaded||Date.now()-state.loadedAt>30000)load(false);else render();};
window.refreshClaimPendingData=function(){return load(true);};
window.pendingReportSnapshot=function(){const key=selected(),rows=rowsFor(key).filter(r=>(r.missing||[]).length>0),both=rows.filter(r=>(r.missing||[]).length===2).length,missBill=rows.filter(r=>(r.missing||[]).includes('(จน.ราย) ตั้งเบิกตามใบเสร็จ')).length,missAmount=rows.filter(r=>(r.missing||[]).includes('จำนวนเงินตั้งเบิก')).length;return {key,label:labelFor(key),rows,both,missBill,missAmount};};
const oldOpen=window.openClaimPendingManagement;
window.openClaimPendingManagement=function(){
  if(typeof window.requireMenuAccess==='function'&&!window.requireMenuAccess('claim_pending','เมนูการไฟฟ้าที่ยังเบิกไม่ได้'))return;
  if(typeof window.showWorkspace==='function')window.showWorkspace('claimPending');else if(typeof oldOpen==='function')oldOpen();
  load(true);
};
function boot(){
  const toolbar=document.querySelector('#claimPendingWorkspace .pending-claim-toolbar');
  if(toolbar){const btn=[...toolbar.querySelectorAll('button')].find(b=>(b.textContent||'').includes('รีเฟรช'));if(btn){btn.removeAttribute('onclick');btn.addEventListener('click',()=>load(true));}}
  const sel=document.getElementById('claimPendingMonth');if(sel){sel.removeAttribute('onchange');sel.addEventListener('change',render);}
  const search=document.getElementById('claimPendingSearch');if(search){search.removeAttribute('oninput');search.addEventListener('input',render);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

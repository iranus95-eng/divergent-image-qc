(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/claim-legacy-api';
const LOCAL_KEY='divergent_claim_legacy_overrides_v1';
let installed=false,loaded=false,loading=null,bypassOverlay=false;
const cache=new Map();
const original={};

function monthInfo(){
  const select=document.getElementById('claimMonthSelect');
  const monthKey=String(select?.value||'มิย');
  const label=String(select?.options?.[select.selectedIndex]?.textContent||'');
  const m=label.match(/(24|25|26)\d{2}/);
  return {monthKey,reportYear:m?Number(m[0]):2569};
}
function keyOf(reportYear,monthKey,seq,sourceBranch){return [reportYear,monthKey,seq,String(sourceBranch||'').trim()].join('|')}
function rowToOverride(r){return {branch:r.branch??'',contact:r.contact??'',phone:r.phone??'',bill_count:r.bill_count,actual_count:r.actual_count,rate:r.rate,claim_amount:r.claim_amount,penalty_raw:r.penalty,received:r.received,received_date:r.received_date??''}}
function loadLocal(){
  try{const rows=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]');if(Array.isArray(rows))for(const r of rows){if(r&&r.report_year&&r.month_key&&r.seq&&r.source_branch)cache.set(keyOf(r.report_year,r.month_key,r.seq,r.source_branch),r)}}catch(_){}
}
function saveLocal(){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(Array.from(cache.values())))}catch(_){}
}
async function api(action,data){
  const token=typeof window.getBestDataToken==='function'?await window.getBestDataToken():'';
  if(!token)throw new Error('AUTH_REQUIRED');
  const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,data})});
  const body=await res.json().catch(()=>({error:'SERVER_ERROR'}));
  if(!res.ok||!body.ok)throw new Error(body.error||'SERVER_ERROR');
  return body;
}
async function loadAll(){
  if(loading)return loading;
  loading=(async()=>{
    try{
      const d=await api('list');
      for(const r of d.rows||[])cache.set(keyOf(r.report_year,r.month_key,r.seq,r.source_branch),r);
      loaded=true;saveLocal();
      if(typeof window.renderClaimWorkspace==='function')window.renderClaimWorkspace();
    }catch(e){console.warn('claim legacy persistence load failed',e);loaded=true;}
  })();
  return loading;
}
function ids(){return {
  modal:document.getElementById('claimItemModal'),status:document.getElementById('claimModalStatus'),
  branch:document.getElementById('clBranch'),contact:document.getElementById('clContact'),phone:document.getElementById('clPhone'),
  bill:document.getElementById('clBillCount'),actual:document.getElementById('clActualCount'),rate:document.getElementById('clRate'),
  claim:document.getElementById('clClaimAmount'),penalty:document.getElementById('clPenalty'),received:document.getElementById('clReceived'),date:document.getElementById('clReceivedDate')
}}
function setVal(el,v){if(el)el.value=v===null||v===undefined?'':String(v)}
function decorateModal(){
  const x=ids();if(!x.modal)return;
  const seq=Number(x.modal.dataset.seq||0),sourceBranch=x.modal.dataset.sourceBranch||'';if(!seq||!sourceBranch)return;
  const mi=monthInfo(),row=cache.get(keyOf(mi.reportYear,mi.monthKey,seq,sourceBranch));
  if(row){setVal(x.branch,row.branch);setVal(x.contact,row.contact);setVal(x.phone,row.phone);setVal(x.bill,row.bill_count);setVal(x.actual,row.actual_count);setVal(x.rate,row.rate);setVal(x.claim,row.claim_amount);setVal(x.penalty,row.penalty);setVal(x.received,row.received);setVal(x.date,row.received_date);if(x.status)x.status.textContent='โหลดข้อมูลที่บันทึกจาก Supabase แล้ว';}
  else if(x.status)x.status.textContent=loaded?'ยังไม่มีการแก้ไขที่บันทึกใน Supabase':'กำลังโหลดข้อมูลที่บันทึก…';
  const buttons=Array.from(x.modal.querySelectorAll('button'));
  const save=buttons.find(b=>(b.getAttribute('onclick')||'').includes('saveClaimPreviewOnly')||/บันทึกตัวอย่าง/.test(b.textContent||''));
  if(save)save.textContent='บันทึกข้อมูล';
}
function install(){
  if(installed)return true;
  if(typeof window.getClaimRows!=='function'||typeof window.openClaimItemModal!=='function'||typeof window.saveClaimPreviewOnly!=='function')return false;
  installed=true;
  original.getRows=window.getClaimRows;
  original.open=window.openClaimItemModal;
  original.save=window.saveClaimPreviewOnly;
  window.getClaimRows=function(){
    const rows=original.getRows.apply(this,arguments)||[];if(bypassOverlay)return rows;
    const mi=monthInfo();
    return rows.map(r=>{const saved=cache.get(keyOf(mi.reportYear,mi.monthKey,Number(r.seq||0),r.branch));return saved?{...r,...rowToOverride(saved)}:r});
  };
  window.openClaimItemModal=function(){
    bypassOverlay=true;let out;
    try{out=original.open.apply(this,arguments)}finally{bypassOverlay=false}
    const x=ids();if(x.modal){x.modal.dataset.sourceBranch=String(x.branch?.value||'').trim();decorateModal();if(!loaded)loadAll().then(decorateModal)}
    return out;
  };
  window.saveClaimPreviewOnly=async function(){
    const x=ids();const seq=Number(x.modal?.dataset.seq||0);if(!seq){if(x.status)x.status.textContent='ไม่พบลำดับรายการ';return}
    const mi=monthInfo(),sourceBranch=String(x.modal?.dataset.sourceBranch||x.branch?.value||'').trim();
    const payload={report_year:mi.reportYear,month_key:mi.monthKey,seq,source_branch:sourceBranch,branch:String(x.branch?.value||'').trim(),contact:String(x.contact?.value||'').trim(),phone:String(x.phone?.value||'').trim(),bill_count:x.bill?.value===''?null:Number(x.bill?.value),actual_count:x.actual?.value===''?null:Number(x.actual?.value),rate:x.rate?.value===''?null:Number(x.rate?.value),claim_amount:x.claim?.value===''?null:Number(x.claim?.value),penalty:x.penalty?.value===''?null:Number(x.penalty?.value),received:x.received?.value===''?null:Number(x.received?.value),received_date:String(x.date?.value||'').trim()};
    if(x.status)x.status.textContent='กำลังบันทึกลง Supabase…';
    try{
      const d=await api('save',payload),row=d.row||payload;cache.set(keyOf(row.report_year,row.month_key,row.seq,row.source_branch),row);saveLocal();
      if(x.status)x.status.textContent='บันทึกลง Supabase แล้ว';
      if(typeof window.renderClaimWorkspace==='function')window.renderClaimWorkspace();
    }catch(e){
      cache.set(keyOf(payload.report_year,payload.month_key,payload.seq,payload.source_branch),payload);saveLocal();
      if(x.status)x.status.textContent='บันทึก Supabase ไม่สำเร็จ แต่เก็บสำรองในเครื่องนี้แล้ว';
      console.error('claim legacy save failed',e);
    }
  };
  loadLocal();loadAll();
  return true;
}
function boot(){if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>60)clearInterval(timer)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

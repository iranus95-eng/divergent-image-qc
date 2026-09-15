(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/invoice-master-api';
let master=null,loading=null;
function token(){
  try{if(typeof window.getBestDataToken==='function')return Promise.resolve(window.getBestDataToken()).then(v=>v||'')}catch(_){ }
  try{return Promise.resolve(localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token')||'')}catch(_){return Promise.resolve('')}
}
async function loadMaster(){
  if(master)return master;if(loading)return loading;
  loading=(async()=>{const t=await token();if(!t)throw Error('AUTH_REQUIRED');const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap'})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP '+r.status));master={customers:Array.isArray(d.customers)?d.customers:[],items:Array.isArray(d.items)?d.items:[]};return master})();
  try{return await loading}finally{loading=null}
}
function norm(v){return String(v||'').replace(/\s+/g,' ').replace(/[()]/g,'').trim().toLowerCase()}
function unique(a){return [...new Set(a.map(v=>String(v||'').trim()).filter(Boolean))]}
function fire(el){if(!el)return;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function ensureList(root,id,values,labeler){let dl=root.querySelector('#'+id);if(!dl){dl=document.createElement('datalist');dl.id=id;root.appendChild(dl)}dl.innerHTML='';for(const v of values){const o=document.createElement('option');if(typeof v==='object'){o.value=String(v.value||'');if(v.label)o.label=String(v.label)}else{o.value=String(v);if(labeler)o.label=labeler(v)}dl.appendChild(o)}return dl}
function customerMatch(customers,value,branch){const n=norm(value),b=String(branch||'').trim();return customers.find(c=>b&&String(c.branch_code||'').trim()===b)||customers.find(c=>norm(c.customer_name)===n)||null}
function makeCustomerCombo(root,data){
  let el=root.querySelector('[name="customer"]');if(!el)return null;
  if(el.tagName==='SELECT'){
    const input=document.createElement('input');input.name='customer';input.value=el.value||'';input.className='rt-master-select rt-smart-combo';input.autocomplete='off';el.replaceWith(input);el=input;
  }
  el.setAttribute('list','rtCustomerSmartList');el.setAttribute('autocomplete','off');
  ensureList(root,'rtCustomerSmartList',data.customers.map(c=>({value:c.customer_name||'',label:(c.branch_code||'')+(c.contract_number?' · '+c.contract_number:'')})));
  const address=root.querySelector('[name="address"]'),tax=root.querySelector('[name="tax"]'),branch=root.querySelector('[name="branch"]');
  [address,tax,branch].forEach(x=>{if(x){x.readOnly=false;x.removeAttribute('aria-readonly')}});
  if(branch){branch.setAttribute('list','rtBranchSmartList');ensureList(root,'rtBranchSmartList',unique(data.customers.map(c=>c.branch_code)))}
  if(tax){tax.setAttribute('list','rtTaxSmartList');ensureList(root,'rtTaxSmartList',unique(data.customers.map(c=>c.tax_id)))}
  const apply=c=>{if(!c)return;root.dataset.rtCustomerId=String(c.id||'');el.value=String(c.customer_name||'');if(address)address.value=String(c.address||'');if(tax)tax.value=String(c.tax_id||'');if(branch)branch.value=String(c.branch_code||'');[el,address,tax,branch].forEach(fire);refreshLists(root,data)};
  const choose=()=>{const c=customerMatch(data.customers,el.value,branch?.value);if(c)apply(c);else root.dataset.rtCustomerId='';refreshLists(root,data)};
  if(!el.dataset.rtSmartBound){el.addEventListener('change',choose);el.addEventListener('blur',choose);el.dataset.rtSmartBound='1'}
  const c=customerMatch(data.customers,el.value,branch?.value);if(c){root.dataset.rtCustomerId=String(c.id||'');if(!address?.value||!tax?.value||!branch?.value)apply(c)}
  const field=el.closest('.rt-field');if(field&&!field.querySelector('.rt-smart-help')){const h=document.createElement('div');h.className='rt-smart-help';h.textContent='เลือกจากรายการได้ หรือพิมพ์ข้อความใหม่ได้ หากไม่มีในรายการ';field.appendChild(h)}
  return el;
}
function currentCustomerItems(root,data){const id=Number(root.dataset.rtCustomerId||0);const rows=id?data.items.filter(x=>Number(x.customer_id)===id):data.items;return rows.length?rows:data.items}
function refreshLists(root,data){
  const rows=currentCustomerItems(root,data);
  const currentCards=[...root.querySelectorAll('.rt-item-editor')];
  const itemValues=unique(['ค่าจ้างจัดพิมพ์ (P00001)',...currentCards.map(c=>c.querySelector('[name="item"]')?.value)]);
  const detailValues=unique(['ค่าจ้างจัดพิมพ์ใบแจ้งเตือนและส่งใบแจ้งเตือนค่าไฟฟ้า',...currentCards.map(c=>c.querySelector('[name="detail"]')?.value)]);
  const periodValues=unique([...rows.map(x=>x.billing_text),...currentCards.map(c=>c.querySelector('[name="period"]')?.value)]);
  const siteValues=unique(['เขตชุมชน','นอกเขตชุมชน',...rows.map(x=>x.area_name),...currentCards.map(c=>c.querySelector('[name="site"]')?.value)]);
  ensureList(root,'rtItemSmartList',itemValues);ensureList(root,'rtDetailSmartList',detailValues);ensureList(root,'rtPeriodSmartList',periodValues);ensureList(root,'rtSiteSmartList',siteValues);
  currentCards.forEach(card=>{
    const item=card.querySelector('[name="item"]'),detail=card.querySelector('[name="detail"]'),period=card.querySelector('[name="period"]'),site=card.querySelector('[name="site"]');
    if(item)item.setAttribute('list','rtItemSmartList');if(detail)detail.setAttribute('list','rtDetailSmartList');if(period)period.setAttribute('list','rtPeriodSmartList');if(site)site.setAttribute('list','rtSiteSmartList');
    if(site&&!site.dataset.rtSmartBound){site.addEventListener('change',()=>{const match=rows.find(x=>norm(x.area_name)===norm(site.value));if(match&&period){const knownPeriods=new Set(data.items.map(x=>String(x.billing_text||'')));if(!period.value||knownPeriods.has(period.value)){period.value=String(match.billing_text||'');fire(period)}}});site.dataset.rtSmartBound='1'}
  });
  const bank=root.querySelector('[name="chequeBank"]');if(bank){bank.setAttribute('list','rtBankSmartList');ensureList(root,'rtBankSmartList',['ธนาคารกรุงไทย','ธนาคารกสิกรไทย','ธนาคารกรุงเทพ','ธนาคารไทยพาณิชย์','ธนาคารกรุงศรีอยุธยา','ธนาคารทหารไทยธนชาต','ธนาคารออมสิน','ธ.ก.ส.'])}
}
function addStyle(){if(document.getElementById('rt-smart-dropdown-style'))return;const s=document.createElement('style');s.id='rt-smart-dropdown-style';s.textContent=`#receiptTaxV1 .rt-smart-help{margin-top:5px;font-size:11px;color:#786c89}#receiptTaxV1 .rt-smart-combo{width:100%;border:1px solid #d9d2e7;border-radius:8px;padding:9px 10px;font:inherit;background:#fff;color:#25183d}`;document.head.appendChild(s)}
async function enhance(root){if(!root||root.dataset.rtSmartEnhancing==='1')return;root.dataset.rtSmartEnhancing='1';addStyle();try{const data=await loadMaster();if(!document.body.contains(root))return;makeCustomerCombo(root,data);refreshLists(root,data);root.dataset.rtSmartReady='1'}catch(e){console.error('receipt smart dropdowns',e)}finally{root.dataset.rtSmartEnhancing='0'}}
function scan(){const root=document.getElementById('receiptTaxV1');if(!root)return;enhance(root)}
function boot(){scan();new MutationObserver(()=>scan()).observe(document.body,{childList:true,subtree:true});[200,700,1600,3000].forEach(ms=>setTimeout(scan,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

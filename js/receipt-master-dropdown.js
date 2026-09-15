(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/invoice-master-api';
let customers=[];
let loading=null;
function token(){
  try{
    if(typeof window.getBestDataToken==='function')return Promise.resolve(window.getBestDataToken()).then(v=>v||'');
  }catch(_){ }
  try{return Promise.resolve(localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token')||'')}catch(_){return Promise.resolve('')}
}
async function loadCustomers(){
  if(customers.length)return customers;
  if(loading)return loading;
  loading=(async()=>{
    const t=await token();
    if(!t)throw new Error('AUTH_REQUIRED');
    const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap'})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    customers=Array.isArray(d.customers)?d.customers:[];
    return customers;
  })();
  try{return await loading}finally{loading=null}
}
function norm(v){return String(v||'').replace(/\s+/g,' ').replace(/[()]/g,'').trim().toLowerCase()}
function findCurrent(value,branch){
  const nv=norm(value),nb=String(branch||'').trim();
  return customers.find(c=>nb&&String(c.branch_code||'').trim()===nb)||customers.find(c=>norm(c.customer_name)===nv)||customers.find(c=>nv&&norm(c.customer_name).includes(nv))||null;
}
function fire(el){
  if(!el)return;
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}
function applyCustomer(root,c){
  if(!root||!c)return;
  const sel=root.querySelector('select[name="customer"]');
  const address=root.querySelector('[name="address"]');
  const tax=root.querySelector('[name="tax"]');
  const branch=root.querySelector('[name="branch"]');
  if(sel)sel.value=String(c.customer_name||'');
  if(address)address.value=String(c.address||'');
  if(tax)tax.value=String(c.tax_id||'');
  if(branch)branch.value=String(c.branch_code||'');
  [sel,address,tax,branch].forEach(fire);
}
function style(){
  if(document.getElementById('rt-master-style'))return;
  const s=document.createElement('style');s.id='rt-master-style';s.textContent=`
    #receiptTaxV1 .rt-master-select{width:100%;border:1px solid #d9d2e7;border-radius:8px;padding:9px 10px;font:inherit;background:#fff;color:#25183d}
    #receiptTaxV1 [name="address"][readonly],#receiptTaxV1 [name="tax"][readonly],#receiptTaxV1 [name="branch"][readonly]{background:#f7f7fb;color:#4b4653;cursor:not-allowed}
    #receiptTaxV1 .rt-master-note{margin-top:5px;font-size:11px;color:#786c89}
  `;document.head.appendChild(s);
}
async function mount(root){
  if(!root||root.dataset.masterCustomerReady==='1')return;
  const input=root.querySelector('input[name="customer"]');
  if(!input)return;
  root.dataset.masterCustomerReady='loading';
  style();
  try{
    const list=await loadCustomers();
    if(!document.body.contains(root))return;
    const current=input.value;
    const branch=root.querySelector('[name="branch"]')?.value||'';
    const field=input.closest('.rt-field');
    const select=document.createElement('select');
    select.name='customer';select.className='rt-master-select';
    select.innerHTML='<option value="">-- เลือกการไฟฟ้า / หน่วยงาน --</option>'+list.map(c=>`<option value="${String(c.customer_name||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">${String((c.branch_code||'')+' · '+(c.customer_name||'')).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');
    input.replaceWith(select);
    const note=document.createElement('div');note.className='rt-master-note';note.textContent='เลือกหน่วยงานแล้ว ระบบจะเติมที่อยู่ เลขประจำตัวผู้เสียภาษี และสาขาให้อัตโนมัติ';
    field?.appendChild(note);
    const address=root.querySelector('[name="address"]'),tax=root.querySelector('[name="tax"]'),branchEl=root.querySelector('[name="branch"]');
    [address,tax,branchEl].forEach(el=>{if(el){el.readOnly=true;el.setAttribute('aria-readonly','true')}});
    const currentCustomer=findCurrent(current,branch);
    if(currentCustomer){select.value=String(currentCustomer.customer_name||'');applyCustomer(root,currentCustomer)}
    else if(current){const opt=document.createElement('option');opt.value=current;opt.textContent=current+' (ข้อมูลเดิม)';select.appendChild(opt);select.value=current;fire(select)}
    select.addEventListener('change',()=>{
      const c=list.find(x=>String(x.customer_name||'')===select.value);
      if(c)applyCustomer(root,c);
    });
    root.dataset.masterCustomerReady='1';
  }catch(e){
    root.dataset.masterCustomerReady='error';
    console.error('receipt customer master',e);
    const field=input.closest('.rt-field');
    if(field&&!field.querySelector('.rt-master-note')){const note=document.createElement('div');note.className='rt-master-note';note.style.color='#a42323';note.textContent='โหลดรายชื่อการไฟฟ้าไม่สำเร็จ กรุณาลองเปิดเมนูใหม่';field.appendChild(note)}
  }
}
function scan(){const root=document.getElementById('receiptTaxV1');if(root&&root.dataset.masterCustomerReady!=='1'&&root.dataset.masterCustomerReady!=='loading')mount(root)}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});[200,700,1500,3000].forEach(ms=>setTimeout(scan,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

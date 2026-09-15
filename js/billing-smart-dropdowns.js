(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/invoice-master-api';
let master=null,loading=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(v){return String(v||'').replace(/\s+/g,' ').replace(/[()]/g,'').trim().toLowerCase()}
function unique(values){return [...new Set(values.map(v=>String(v||'').trim()).filter(Boolean))]}
async function token(){try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t}}catch(_){}try{return localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token')||''}catch(_){return''}}
async function loadMaster(){if(master)return master;if(loading)return loading;loading=(async()=>{const t=await token();if(!t)throw Error('AUTH_REQUIRED');const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap'})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP '+r.status));master={customers:Array.isArray(d.customers)?d.customers:[],items:Array.isArray(d.items)?d.items:[]};return master})();try{return await loading}finally{loading=null}}
function fire(el){if(!el)return;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function style(){if(document.getElementById('bi-smart-dropdown-style'))return;const s=document.createElement('style');s.id='bi-smart-dropdown-style';s.textContent=`
#billingInvoiceV1 .bi-smart-select{width:100%;border:1px solid #cfc4df;border-radius:8px;padding:9px 34px 9px 10px;font:inherit;background:#fff;color:#25183d;appearance:auto;min-height:39px}
#billingInvoiceV1 .bi-smart-source.bi-smart-hidden{display:none!important}
#billingInvoiceV1 .bi-smart-source:not(.bi-smart-hidden){margin-top:7px!important}
#billingInvoiceV1 .bi-smart-help{font-size:11px;color:#786c89;margin-top:5px}
`;document.head.appendChild(s)}
function customerByValue(data,value,branch){const n=norm(value),b=String(branch||'').trim();return data.customers.find(c=>n&&norm(c.customer_name)===n)||data.customers.find(c=>b&&String(c.branch_code||'').trim()===b)||null}
function customerItems(root,data){const id=Number(root.dataset.biCustomerId||0);const rows=id?data.items.filter(x=>Number(x.customer_id)===id):data.items;return rows.length?rows:data.items}
function setSource(el,value,hide=true){if(!el)return;el.value=String(value??'');el.classList.add('bi-smart-source');el.classList.toggle('bi-smart-hidden',hide);fire(el)}
function makeSelect(el,options,onPick,label){
  if(!el||el.dataset.biSmartBound==='1')return null;
  const field=el.closest('.bi-field');if(!field)return null;
  const sel=document.createElement('select');sel.type='select-one';sel.className='bi-smart-select';sel.setAttribute('aria-label',label||'เลือกข้อมูล');
  sel.innerHTML='<option value="">-- เลือกจากรายการ --</option>'+options.map(o=>`<option value="${esc(o.value)}">${esc(o.label||o.value)}</option>`).join('')+'<option value="__manual__">✎ พิมพ์ข้อความอื่นเอง</option>';
  el.classList.add('bi-smart-source');field.insertBefore(sel,el);
  const current=String(el.value||'').trim();const exact=options.find(o=>String(o.value)===current);
  if(exact){sel.value=String(exact.value);el.classList.add('bi-smart-hidden')}else{sel.value='__manual__';el.classList.remove('bi-smart-hidden')}
  sel.addEventListener('change',()=>{if(sel.value==='__manual__'){el.classList.remove('bi-smart-hidden');el.focus();return}if(sel.value===''){return}onPick(sel.value,sel,el);el.classList.add('bi-smart-hidden')});
  el.dataset.biSmartBound='1';
  return sel;
}
function refreshDependent(root,data){
  const rows=customerItems(root,data);
  const item=root.querySelector('[name="item"]'),detail=root.querySelector('[name="detail"]'),period=root.querySelector('[name="period"]'),area=root.querySelector('[name="area"]'),unit=root.querySelector('[name="unit"]');
  makeSelect(item,[{value:'ค่าจ้างจัดพิมพ์ (P00001)'}],v=>setSource(item,v,true),'รายการ');
  makeSelect(detail,[{value:'ค่าจ้างจัดพิมพ์ใบแจ้งเตือนและส่งใบแจ้งเตือนค่าไฟฟ้า'}],v=>setSource(detail,v,true),'รายละเอียด');
  makeSelect(period,unique(rows.map(x=>x.billing_text)).map(v=>({value:v})),v=>setSource(period,v,true),'รอบบิล');
  makeSelect(area,unique(['เขตชุมชน','นอกเขตชุมชน',...rows.map(x=>x.area_name)]).map(v=>({value:v})),v=>{setSource(area,v,true);const hit=rows.find(x=>norm(x.area_name)===norm(v));if(hit){if(period){setSource(period,hit.billing_text||period.value,true);const ps=period.previousElementSibling;if(ps&&ps.classList.contains('bi-smart-select')&&[...ps.options].some(o=>o.value===String(hit.billing_text||'')))ps.value=String(hit.billing_text||'')}const rate=root.querySelector('[name="rate"]');if(rate&&Number(hit.unit_price)>0){rate.value=Number(hit.unit_price);fire(rate)}}},'พื้นที่ / เขตงาน');
  makeSelect(unit,['ฉบับ','ราย','ชุด','งาน'].map(v=>({value:v})),v=>setSource(unit,v,true),'หน่วย');
}
function syncSimpleSelect(fieldEl,value){if(!fieldEl)return;const sel=fieldEl.previousElementSibling;if(sel&&sel.classList.contains('bi-smart-select')){const found=[...sel.options].find(o=>o.value===String(value??''));if(found){sel.value=found.value;fieldEl.classList.add('bi-smart-hidden')}else{sel.value='__manual__';fieldEl.classList.remove('bi-smart-hidden')}}}
function applyCustomer(root,data,c){if(!c)return;root.dataset.biCustomerId=String(c.id||'');const customer=root.querySelector('[name="customer"]'),address=root.querySelector('[name="address"]'),tax=root.querySelector('[name="tax"]'),branch=root.querySelector('[name="branch"]');setSource(customer,c.customer_name||'',true);setSource(address,c.address||'',true);setSource(tax,c.tax_id||'',true);setSource(branch,c.branch_code||'',true);[customer,address,tax,branch].forEach(x=>syncSimpleSelect(x,x?.value));refreshDependent(root,data)}
async function enhance(root){if(!root||root.dataset.biSmartReady==='1'||root.dataset.biSmartLoading==='1')return;root.dataset.biSmartLoading='1';style();try{const data=await loadMaster();if(!document.body.contains(root))return;const customer=root.querySelector('[name="customer"]'),address=root.querySelector('[name="address"]'),tax=root.querySelector('[name="tax"]'),branch=root.querySelector('[name="branch"]');
  const customerOpts=data.customers.map(c=>({value:String(c.id),label:`${c.branch_code||''} · ${c.customer_name||''}`}));
  if(customer&&customer.dataset.biSmartBound!=='1'){
    const field=customer.closest('.bi-field');const sel=document.createElement('select');sel.className='bi-smart-select';sel.setAttribute('aria-label','ลูกค้า / หน่วยงาน');sel.innerHTML='<option value="">-- เลือกการไฟฟ้า / หน่วยงาน --</option>'+customerOpts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')+'<option value="__manual__">✎ พิมพ์ข้อความอื่นเอง</option>';customer.classList.add('bi-smart-source');field.insertBefore(sel,customer);const current=customerByValue(data,customer.value,branch?.value);if(current){sel.value=String(current.id);customer.classList.add('bi-smart-hidden');root.dataset.biCustomerId=String(current.id)}else{sel.value='__manual__';customer.classList.remove('bi-smart-hidden')}
    sel.addEventListener('change',()=>{if(sel.value==='__manual__'){customer.classList.remove('bi-smart-hidden');customer.focus();return}const c=data.customers.find(x=>String(x.id)===sel.value);if(c)applyCustomer(root,data,c)});customer.dataset.biSmartBound='1';
    if(field&&!field.querySelector('.bi-smart-help')){const h=document.createElement('div');h.className='bi-smart-help';h.textContent='เลือกจากรายการก่อน หากไม่มีให้เลือก “พิมพ์ข้อความอื่นเอง”';field.appendChild(h)}
  }
  makeSelect(address,unique(data.customers.map(c=>c.address)).map(v=>({value:v})),v=>setSource(address,v,true),'ที่อยู่');
  makeSelect(tax,unique(data.customers.map(c=>c.tax_id)).map(v=>({value:v})),v=>setSource(tax,v,true),'เลขประจำตัวผู้เสียภาษี');
  makeSelect(branch,unique(data.customers.map(c=>c.branch_code)).map(v=>({value:v})),v=>setSource(branch,v,true),'สาขา');
  const current=customerByValue(data,customer?.value,branch?.value);if(current){root.dataset.biCustomerId=String(current.id);syncSimpleSelect(address,address?.value);syncSimpleSelect(tax,tax?.value);syncSimpleSelect(branch,branch?.value)}
  refreshDependent(root,data);root.dataset.biSmartReady='1';
}catch(e){console.error('billing smart dropdowns',e);const box=root.querySelector('.bi-body');if(box&&!box.querySelector('.bi-smart-help-error')){const d=document.createElement('div');d.className='bi-smart-help bi-smart-help-error';d.style.color='#a42323';d.textContent='โหลดรายการ Dropdown ไม่สำเร็จ กรุณาเปิดเมนูใหม่';box.prepend(d)}}finally{root.dataset.biSmartLoading='0'}}
function scan(){const root=document.getElementById('billingInvoiceV1');if(root)enhance(root)}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});[100,400,900,1800,3200].forEach(ms=>setTimeout(scan,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

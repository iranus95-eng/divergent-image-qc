(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/invoice-master-api';
const HISTORY_KEY='divergent_document_dropdown_history_v2';
let master=null,loading=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(v){return String(v||'').replace(/\s+/g,' ').replace(/[()]/g,'').trim().toLowerCase()}
function unique(a){return [...new Set((a||[]).map(v=>String(v??'').trim()).filter(Boolean))]}
function history(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}')||{}}catch(_){return{}}}
function remember(name,value){value=String(value??'').trim();if(!value)return;const h=history(),arr=unique([value,...(h[name]||[])]).slice(0,40);h[name]=arr;try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h))}catch(_){}}
function hist(name){return history()[name]||[]}
async function token(){try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t}}catch(_){}try{return localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token')||''}catch(_){return''}}
async function loadMaster(){if(master)return master;if(loading)return loading;loading=(async()=>{const t=await token();if(!t)throw Error('AUTH_REQUIRED');const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap'})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP '+r.status));master={customers:Array.isArray(d.customers)?d.customers:[],items:Array.isArray(d.items)?d.items:[]};return master})();try{return await loading}finally{loading=null}}
function fire(el){if(!el)return;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function style(){if(document.getElementById('bi-smart-dropdown-style-v3'))return;const s=document.createElement('style');s.id='bi-smart-dropdown-style-v3';s.textContent=`
#billingInvoiceV1 .bi-smart-select{display:block!important;width:100%!important;margin:0 0 6px!important;border:1px solid #bcaedd!important;border-radius:8px!important;padding:9px 34px 9px 10px!important;font:inherit!important;background:#fff!important;color:#25183d!important;appearance:auto!important;min-height:39px!important}
#billingInvoiceV1 .bi-smart-source{width:100%!important}
#billingInvoiceV1 .bi-smart-source.bi-smart-hidden{display:none!important}
#billingInvoiceV1 .bi-smart-source:not(.bi-smart-hidden){display:block!important;margin-top:6px!important}
#billingInvoiceV1 .bi-smart-help{font-size:11px;color:#786c89;margin:4px 0 0;line-height:1.3}
`;document.head.appendChild(s)}
function customerByValue(data,value,branch){const n=norm(value),b=String(branch||'').trim();return data.customers.find(c=>n&&norm(c.customer_name)===n)||data.customers.find(c=>!n&&b&&String(c.branch_code||'').trim()===b)||null}
function customerItems(root,data){const id=Number(root.dataset.biCustomerId||0);const rows=id?data.items.filter(x=>Number(x.customer_id)===id):data.items;return rows.length?rows:data.items}
function source(root,name){return root.querySelector(`[name="${name}"]`)}
function optionList(values){return unique(values).map(v=>({value:v,label:v}))}
function syncPicker(sel,options,current,placeholder){if(!sel)return;const cur=String(current??'').trim(),opts=options||[];sel.innerHTML=`<option value="">${esc(placeholder||'-- เลือกจากรายการ --')}</option>`+opts.map(o=>`<option value="${esc(o.value)}">${esc(o.label||o.value)}</option>`).join('')+'<option value="__manual__">✎ พิมพ์ข้อความอื่นเอง</option>';const hit=opts.find(o=>String(o.value)===cur);if(hit)sel.value=String(hit.value);else if(cur)sel.value='__manual__';else sel.value=''}
function setValue(el,val,hide){if(!el)return;el.value=String(val??'');el.classList.add('bi-smart-source');el.classList.toggle('bi-smart-hidden',!!hide);remember(el.name,el.value);fire(el)}
function picker(root,name,options,placeholder,onPick){const el=source(root,name);if(!el)return null;const field=el.closest('.bi-field');if(!field)return null;el.classList.add('bi-smart-source');let sel=field.querySelector(`.bi-smart-select[data-for="${name}"]`);if(!sel){sel=document.createElement('select');sel.className='bi-smart-select';sel.dataset.for=name;sel.setAttribute('aria-label',placeholder||name);field.insertBefore(sel,el);const help=document.createElement('div');help.className='bi-smart-help';help.textContent='เลือกจากรายการ หากไม่มีให้เลือก “พิมพ์ข้อความอื่นเอง”';field.appendChild(help);sel.addEventListener('change',()=>{if(sel.value==='__manual__'){el.classList.remove('bi-smart-hidden');el.focus();return}if(sel.value==='')return;setValue(el,sel.value,true);if(typeof onPick==='function')onPick(sel.value)});if(!el.dataset.biHistoryBound){el.addEventListener('change',()=>remember(name,el.value));el.dataset.biHistoryBound='1'}}syncPicker(sel,options,el.value,placeholder);if(sel.value!=='__manual__'&&sel.value!=='')el.classList.add('bi-smart-hidden');else if(sel.value==='__manual__')el.classList.remove('bi-smart-hidden');else el.classList.add('bi-smart-hidden');return sel}
function historyDocValues(root){let inv='';try{inv=document.getElementById('invNo')?.value||''}catch(_){ }let receipt={};try{receipt=JSON.parse(localStorage.getItem('divergent_receipt_tax_invoice_v1')||'{}')}catch(_){ }return unique([source(root,'docNo')?.value,inv,receipt.invoiceNo,...hist('docNo')])}
function detailValues(root){return unique(['ค่าจ้างจัดพิมพ์ใบแจ้งเตือนและส่งใบแจ้งเตือนค่าไฟฟ้า',source(root,'detail')?.value,...hist('detail')])}
function noteValues(root){return unique([source(root,'note')?.value,...hist('note')])}
function itemValues(root){return unique(['ค่าจ้างจัดพิมพ์ (P00001)',source(root,'item')?.value,...hist('item')])}
function refresh(root,data){
  const rows=customerItems(root,data);
  picker(root,'address',optionList([...data.customers.map(c=>c.address),...hist('address')]),'-- เลือกที่อยู่ --');
  picker(root,'tax',optionList([...data.customers.map(c=>c.tax_id),...hist('tax')]),'-- เลือกเลขประจำตัวผู้เสียภาษี --');
  picker(root,'branch',optionList([...data.customers.map(c=>c.branch_code),...hist('branch')]),'-- เลือกสาขา --');
  picker(root,'docNo',optionList(historyDocValues(root)),'-- เลือกเลขที่เอกสารเดิม หรือพิมพ์เลขใหม่ --');
  picker(root,'period',optionList([...rows.map(x=>x.billing_text),...hist('period')]),'-- เลือกรอบบิล / เดือน --');
  picker(root,'detail',optionList(detailValues(root)),'-- เลือกรายละเอียดเอกสาร --');
  picker(root,'area',optionList(['เขตชุมชน','นอกเขตชุมชน',...rows.map(x=>x.area_name),...hist('area')]),'-- เลือกพื้นที่ / เขตงาน --',v=>{const hit=rows.find(x=>norm(x.area_name)===norm(v));if(!hit)return;const period=source(root,'period'),rate=source(root,'rate');if(period&&hit.billing_text){setValue(period,hit.billing_text,true);const ps=period.closest('.bi-field')?.querySelector('.bi-smart-select[data-for="period"]');if(ps)syncPicker(ps,optionList([...rows.map(x=>x.billing_text),...hist('period')]),period.value,'-- เลือกรอบบิล / เดือน --')}if(rate&&Number(hit.unit_price)>0){rate.value=Number(hit.unit_price);fire(rate)}});
  picker(root,'note',optionList(noteValues(root)),'-- เลือกหมายเหตุเดิม หรือพิมพ์ข้อความใหม่ --');
  picker(root,'item',optionList(itemValues(root)),'-- เลือกรายการ --');
  picker(root,'unit',optionList(['ฉบับ','ราย','ชุด','งาน',...hist('unit')]),'-- เลือกหน่วย --');
}
function applyCustomer(root,data,c){if(!c)return;root.dataset.biCustomerId=String(c.id||'');setValue(source(root,'customer'),c.customer_name||'',true);setValue(source(root,'address'),c.address||'',true);setValue(source(root,'tax'),c.tax_id||'',true);setValue(source(root,'branch'),c.branch_code||'',true);refresh(root,data)}
function customerPicker(root,data){const el=source(root,'customer');if(!el)return;const field=el.closest('.bi-field');if(!field)return;el.classList.add('bi-smart-source');let sel=field.querySelector('.bi-smart-select[data-for="customer"]');const opts=data.customers.map(c=>({value:String(c.id),label:`${c.branch_code||''} · ${c.customer_name||''}`}));if(!sel){sel=document.createElement('select');sel.className='bi-smart-select';sel.dataset.for='customer';field.insertBefore(sel,el);const help=document.createElement('div');help.className='bi-smart-help';help.textContent='เลือกการไฟฟ้าแล้ว ระบบเติมที่อยู่ เลขภาษี และสาขาให้อัตโนมัติ';field.appendChild(help);sel.addEventListener('change',()=>{if(sel.value==='__manual__'){el.classList.remove('bi-smart-hidden');el.focus();return}if(!sel.value)return;const c=data.customers.find(x=>String(x.id)===sel.value);if(c)applyCustomer(root,data,c)});el.addEventListener('change',()=>remember('customer',el.value))}
  const current=customerByValue(data,el.value,source(root,'branch')?.value);sel.innerHTML='<option value="">-- เลือกการไฟฟ้า / หน่วยงาน --</option>'+opts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')+'<option value="__manual__">✎ พิมพ์หน่วยงานอื่นเอง</option>';if(current){root.dataset.biCustomerId=String(current.id);sel.value=String(current.id);el.classList.add('bi-smart-hidden')}else if(el.value){sel.value='__manual__';el.classList.remove('bi-smart-hidden')}else{sel.value='';el.classList.add('bi-smart-hidden')}}
async function enhance(root){if(!root||root.dataset.biSmartV4==='loading')return;root.dataset.biSmartV4='loading';style();try{const data=await loadMaster();if(!document.body.contains(root))return;customerPicker(root,data);const cur=customerByValue(data,source(root,'customer')?.value,source(root,'branch')?.value);if(cur)root.dataset.biCustomerId=String(cur.id);refresh(root,data);root.dataset.biSmartV4='1'}catch(e){console.error('billing smart dropdowns v4',e);const box=root.querySelector('.bi-body');if(box&&!box.querySelector('.bi-smart-help-error')){const d=document.createElement('div');d.className='bi-smart-help bi-smart-help-error';d.style.color='#a42323';d.textContent='โหลดรายการ Dropdown ไม่สำเร็จ กรุณาเปิดเมนูใหม่';box.prepend(d)}}finally{root.dataset.biSmartV4='0'}}
function scan(){const root=document.getElementById('billingInvoiceV1');if(root)enhance(root)}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});[100,300,700,1400,2600,4200].forEach(ms=>setTimeout(scan,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

(function(){
'use strict';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/invoice-master-api';
const HISTORY_KEY='divergent_document_dropdown_history_v2';
let master=null,loading=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(v){return String(v||'').replace(/\s+/g,' ').replace(/[()]/g,'').trim().toLowerCase()}
function unique(a){return [...new Set((a||[]).map(v=>String(v??'').trim()).filter(Boolean))]}
function history(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}')||{}}catch(_){return{}}}
function hist(name){return history()[name]||[]}
function remember(name,value){value=String(value??'').trim();if(!value)return;const h=history();h[name]=unique([value,...(h[name]||[])]).slice(0,40);try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h))}catch(_){}}
async function token(){try{if(typeof window.getBestDataToken==='function')return Promise.resolve(window.getBestDataToken()).then(v=>v||'')}catch(_){ }try{return Promise.resolve(localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token')||'')}catch(_){return Promise.resolve('')}}
async function loadMaster(){if(master)return master;if(loading)return loading;loading=(async()=>{const t=await token();if(!t)throw Error('AUTH_REQUIRED');const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap'})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP '+r.status));master={customers:Array.isArray(d.customers)?d.customers:[],items:Array.isArray(d.items)?d.items:[]};return master})();try{return await loading}finally{loading=null}}
function fire(el){if(!el)return;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function source(root,name){return root.querySelector(`[name="${name}"]`)}
function ensureInput(root,name){let el=source(root,name);if(!el)return null;if(el.tagName==='SELECT'){const n=document.createElement(name==='address'?'textarea':'input');n.name=name;n.value=el.value||'';n.className=el.className||'';if(name==='address')n.rows=2;el.replaceWith(n);el=n}el.readOnly=false;el.removeAttribute('aria-readonly');return el}
function style(){if(document.getElementById('rt-smart-dropdown-style-v4'))return;const s=document.createElement('style');s.id='rt-smart-dropdown-style-v4';s.textContent=`
#receiptTaxV1 .rt-smart-picker{display:block!important;width:100%!important;margin:0 0 6px!important;border:1px solid #bdaee0!important;border-radius:8px!important;padding:9px 34px 9px 10px!important;font:inherit!important;background:#fff!important;color:#25183d!important;cursor:pointer!important;appearance:auto!important;min-height:39px!important}
#receiptTaxV1 .rt-smart-source.rt-smart-hidden{display:none!important}
#receiptTaxV1 .rt-smart-source:not(.rt-smart-hidden){display:block!important;margin-top:6px!important}
#receiptTaxV1 .rt-smart-help{margin:4px 0 0;font-size:11px;color:#786c89;line-height:1.3}
`;document.head.appendChild(s)}
function customerMatch(customers,value,branch){const n=norm(value),b=String(branch||'').trim();return customers.find(c=>n&&norm(c.customer_name)===n)||customers.find(c=>!n&&b&&String(c.branch_code||'').trim()===b)||null}
function currentCustomer(root,data){const id=Number(root.dataset.rtCustomerId||0);return data.customers.find(c=>Number(c.id)===id)||null}
function customerItems(root,data){const c=currentCustomer(root,data),rows=c?data.items.filter(x=>Number(x.customer_id)===Number(c.id)):data.items;return rows.length?rows:data.items}
function opts(values){return unique(values).map(v=>({value:v,label:v}))}
function syncPicker(sel,options,current,placeholder){if(!sel)return;const cur=String(current??'').trim();sel.innerHTML=`<option value="">${esc(placeholder||'-- เลือกจากรายการ --')}</option>`+(options||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label||o.value)}</option>`).join('')+'<option value="__manual__">✎ พิมพ์ข้อความอื่นเอง</option>';const hit=(options||[]).find(o=>String(o.value)===cur);if(hit)sel.value=String(hit.value);else if(cur)sel.value='__manual__';else sel.value=''}
function setValue(el,val,hide){if(!el)return;el.value=String(val??'');el.classList.add('rt-smart-source');el.classList.toggle('rt-smart-hidden',!!hide);remember(el.name,el.value);fire(el)}
function picker(root,name,options,placeholder,onPick){const el=ensureInput(root,name);if(!el)return null;const field=el.closest('.rt-field');if(!field)return null;el.classList.add('rt-smart-source');let sel=field.querySelector(`.rt-smart-picker[data-for="${name}"]`);if(!sel){sel=document.createElement('select');sel.className='rt-smart-picker';sel.dataset.for=name;field.insertBefore(sel,el);const help=document.createElement('div');help.className='rt-smart-help';help.textContent='เลือกจากรายการ หากไม่มีให้เลือก “พิมพ์ข้อความอื่นเอง”';field.appendChild(help);sel.addEventListener('change',()=>{if(sel.value==='__manual__'){el.classList.remove('rt-smart-hidden');el.focus();return}if(!sel.value)return;setValue(el,sel.value,true);if(typeof onPick==='function')onPick(sel.value)});if(!el.dataset.rtHistoryBound){el.addEventListener('change',()=>remember(name,el.value));el.dataset.rtHistoryBound='1'}}syncPicker(sel,options,el.value,placeholder);if(sel.value!=='__manual__')el.classList.add('rt-smart-hidden');else el.classList.remove('rt-smart-hidden');return sel}
function refresh(root,data){
  const rows=customerItems(root,data);
  picker(root,'address',opts([...data.customers.map(x=>x.address),...hist('address')]),'-- เลือกที่อยู่ --');
  picker(root,'tax',opts([...data.customers.map(x=>x.tax_id),...hist('tax')]),'-- เลือกเลขประจำตัวผู้เสียภาษี --');
  picker(root,'branch',opts([...data.customers.map(x=>x.branch_code),...hist('branch')]),'-- เลือกสาขา --');
  let billing={};try{billing=JSON.parse(localStorage.getItem('divergent_billing_invoice_v1')||'{}')}catch(_){ }
  picker(root,'receiptNo',opts([source(root,'receiptNo')?.value,...hist('receiptNo')]),'-- เลือกเลขที่ใบเสร็จเดิม หรือพิมพ์เลขใหม่ --');
  picker(root,'invoiceNo',opts([source(root,'invoiceNo')?.value,billing.docNo,...hist('invoiceNo'),...hist('docNo')]),'-- เลือกเลขที่ใบแจ้งหนี้เดิม หรือพิมพ์เลขใหม่ --');
  const cards=[...root.querySelectorAll('.rt-item-editor')];
  cards.forEach(card=>{
    const item=card.querySelector('[name="item"]'),detail=card.querySelector('[name="detail"]'),period=card.querySelector('[name="period"]'),site=card.querySelector('[name="site"]');
    if(item)picker(root,'item',opts(['ค่าจ้างจัดพิมพ์ (P00001)',item.value,...hist('item')]),'-- เลือกรายการ --');
    if(detail)picker(root,'detail',opts(['ค่าจ้างจัดพิมพ์ใบแจ้งเตือนและส่งใบแจ้งเตือนค่าไฟฟ้า',detail.value,...hist('detail')]),'-- เลือกรายละเอียด --');
    if(period)picker(root,'period',opts([...rows.map(x=>x.billing_text),period.value,...hist('period')]),'-- เลือกรอบบิล / เดือน --');
    if(site)picker(root,'site',opts(['เขตชุมชน','นอกเขตชุมชน',...rows.map(x=>x.area_name),site.value,...hist('site'),...hist('area')]),'-- เลือกพื้นที่ / เขตงาน --',v=>{const hit=rows.find(x=>norm(x.area_name)===norm(v));if(hit&&period&&hit.billing_text){setValue(period,hit.billing_text,true);const ps=period.closest('.rt-field')?.querySelector('.rt-smart-picker[data-for="period"]');if(ps)syncPicker(ps,opts([...rows.map(x=>x.billing_text),...hist('period')]),period.value,'-- เลือกรอบบิล / เดือน --')}});
  });
  picker(root,'chequeBank',opts(['ธนาคารกรุงไทย','ธนาคารกสิกรไทย','ธนาคารกรุงเทพ','ธนาคารไทยพาณิชย์','ธนาคารกรุงศรีอยุธยา','ธนาคารทหารไทยธนชาต','ธนาคารออมสิน','ธ.ก.ส.',...hist('chequeBank')]),'-- เลือกธนาคาร --');
}
function applyCustomer(root,data,c){if(!c)return;root.dataset.rtCustomerId=String(c.id||'');setValue(ensureInput(root,'customer'),c.customer_name||'',true);setValue(ensureInput(root,'address'),c.address||'',true);setValue(ensureInput(root,'tax'),c.tax_id||'',true);setValue(ensureInput(root,'branch'),c.branch_code||'',true);refresh(root,data)}
function customerPicker(root,data){const el=ensureInput(root,'customer');if(!el)return;const field=el.closest('.rt-field');if(!field)return;el.classList.add('rt-smart-source');let sel=field.querySelector('.rt-smart-picker[data-for="customer"]');if(!sel){sel=document.createElement('select');sel.className='rt-smart-picker';sel.dataset.for='customer';field.insertBefore(sel,el);const help=document.createElement('div');help.className='rt-smart-help';help.textContent='เลือกการไฟฟ้าแล้ว ระบบเติมที่อยู่ เลขภาษี และสาขาให้อัตโนมัติ';field.appendChild(help);sel.addEventListener('change',()=>{if(sel.value==='__manual__'){el.classList.remove('rt-smart-hidden');el.focus();return}if(!sel.value)return;const c=data.customers.find(x=>String(x.id)===sel.value);if(c)applyCustomer(root,data,c)});el.addEventListener('change',()=>remember('customer',el.value))}
  const current=customerMatch(data.customers,el.value,ensureInput(root,'branch')?.value);sel.innerHTML='<option value="">-- เลือกการไฟฟ้า / หน่วยงาน --</option>'+data.customers.map(c=>`<option value="${esc(c.id)}">${esc((c.branch_code||'')+' · '+(c.customer_name||''))}</option>`).join('')+'<option value="__manual__">✎ พิมพ์หน่วยงานอื่นเอง</option>';if(current){root.dataset.rtCustomerId=String(current.id||'');sel.value=String(current.id);el.classList.add('rt-smart-hidden')}else if(el.value){sel.value='__manual__';el.classList.remove('rt-smart-hidden')}else{sel.value='';el.classList.add('rt-smart-hidden')}}
async function enhance(root){if(!root||root.dataset.rtSmartV4==='loading')return;root.dataset.rtSmartV4='loading';style();try{const data=await loadMaster();if(!document.body.contains(root))return;customerPicker(root,data);const cur=customerMatch(data.customers,ensureInput(root,'customer')?.value,ensureInput(root,'branch')?.value);if(cur)root.dataset.rtCustomerId=String(cur.id||'');refresh(root,data);root.dataset.rtSmartV4='1'}catch(e){root.dataset.rtSmartV4='error';console.error('receipt smart dropdowns v4',e)}finally{if(root.dataset.rtSmartV4==='loading')root.dataset.rtSmartV4='0'}}
function scan(){const root=document.getElementById('receiptTaxV1');if(root&&root.dataset.rtSmartV4!=='1')enhance(root)}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});[100,300,700,1400,2600,4200].forEach(ms=>setTimeout(scan,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

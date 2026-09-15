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
function currentCustomer(root,data){const id=Number(root.dataset.rtCustomerId||0);return data.customers.find(c=>Number(c.id)===id)||null}
function customerMatch(customers,value,branch){const n=norm(value),b=String(branch||'').trim();return customers.find(c=>n&&norm(c.customer_name)===n)||customers.find(c=>!n&&b&&String(c.branch_code||'').trim()===b)||null}
function optionEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}
function ensureEditable(root,name){
  let el=root.querySelector(`[name="${name}"]`);if(!el)return null;
  if(el.tagName==='SELECT'){
    const input=document.createElement(name==='address'?'textarea':'input');
    input.name=name;input.value=el.value||'';input.className=el.className||'';
    if(name==='address')input.rows=2;
    el.replaceWith(input);el=input;
  }
  el.readOnly=false;el.removeAttribute('aria-readonly');el.removeAttribute('list');return el;
}
function setPickerOptions(select,values,current,placeholder){
  const vals=unique(values),cur=String(current||'').trim();
  select.innerHTML=`<option value="">${optionEsc(placeholder||'-- เลือกจากรายการ --')}</option>`+vals.map(v=>`<option value="${optionEsc(v)}">${optionEsc(v)}</option>`).join('')+'<option value="__custom__">✎ พิมพ์ข้อความอื่นเอง</option>';
  if(cur&&vals.includes(cur))select.value=cur;else if(cur)select.value='__custom__';else select.value='';
}
function makePicker(root,el,values,placeholder,onPick){
  if(!el)return null;
  const field=el.closest('.rt-field');if(!field)return null;
  let picker=field.querySelector(`.rt-smart-picker[data-for="${el.name}"]`);
  if(!picker){
    picker=document.createElement('select');picker.type='button';picker.className='rt-smart-picker';picker.dataset.for=el.name;
    field.insertBefore(picker,el);
    const help=document.createElement('div');help.className='rt-smart-help';help.textContent='เลือกจากรายการด้านบน หรือพิมพ์เองในช่องด้านล่างเมื่อไม่มีรายการที่ต้องการ';field.appendChild(help);
    picker.addEventListener('change',()=>{
      if(picker.value==='__custom__'){el.focus();return}
      if(picker.value!==''){el.value=picker.value;fire(el);if(onPick)onPick(picker.value)}
    });
  }
  setPickerOptions(picker,values,el.value,placeholder);return picker;
}
function applyCustomer(root,data,c){
  if(!c)return;root.dataset.rtCustomerId=String(c.id||'');
  const customer=ensureEditable(root,'customer'),address=ensureEditable(root,'address'),tax=ensureEditable(root,'tax'),branch=ensureEditable(root,'branch');
  if(customer)customer.value=String(c.customer_name||'');if(address)address.value=String(c.address||'');if(tax)tax.value=String(c.tax_id||'');if(branch)branch.value=String(c.branch_code||'');
  [customer,address,tax,branch].forEach(fire);refresh(root,data);
}
function setupCustomer(root,data){
  const customer=ensureEditable(root,'customer');if(!customer)return;
  const branch=ensureEditable(root,'branch');
  const picker=makePicker(root,customer,data.customers.map(c=>c.customer_name),'-- เลือกการไฟฟ้า / หน่วยงาน --',value=>{
    const c=data.customers.find(x=>String(x.customer_name||'')===value);if(c)applyCustomer(root,data,c);
  });
  if(picker){
    picker.innerHTML='<option value="">-- เลือกการไฟฟ้า / หน่วยงาน --</option>'+data.customers.map(c=>`<option value="${optionEsc(c.customer_name||'')}">${optionEsc((c.branch_code||'')+' · '+(c.customer_name||''))}</option>`).join('')+'<option value="__custom__">✎ พิมพ์หน่วยงานอื่นเอง</option>';
    const c=customerMatch(data.customers,customer.value,branch?.value);if(c){root.dataset.rtCustomerId=String(c.id||'');picker.value=String(c.customer_name||'')}else if(customer.value)picker.value='__custom__';
  }
  if(!customer.dataset.rtCustomerBound){customer.addEventListener('blur',()=>{const c=customerMatch(data.customers,customer.value,branch?.value);if(c)applyCustomer(root,data,c);else root.dataset.rtCustomerId=''});customer.dataset.rtCustomerBound='1'}
}
function customerItems(root,data){const c=currentCustomer(root,data),rows=c?data.items.filter(x=>Number(x.customer_id)===Number(c.id)):data.items;return rows.length?rows:data.items}
function refresh(root,data){
  setupCustomer(root,data);
  const c=currentCustomer(root,data),rows=customerItems(root,data);
  const address=ensureEditable(root,'address'),tax=ensureEditable(root,'tax'),branch=ensureEditable(root,'branch');
  makePicker(root,address,unique(data.customers.map(x=>x.address)),'-- เลือกที่อยู่ --');
  makePicker(root,tax,unique(data.customers.map(x=>x.tax_id)),'-- เลือกเลขประจำตัวผู้เสียภาษี --');
  makePicker(root,branch,unique(data.customers.map(x=>x.branch_code)),'-- เลือกสาขา --');
  const cards=[...root.querySelectorAll('.rt-item-editor')];
  cards.forEach(card=>{
    const item=card.querySelector('[name="item"]'),detail=card.querySelector('[name="detail"]'),period=card.querySelector('[name="period"]'),site=card.querySelector('[name="site"]');
    const itemVals=unique(['ค่าจ้างจัดพิมพ์ (P00001)',...cards.map(x=>x.querySelector('[name="item"]')?.value)]);
    const detailVals=unique(['ค่าจ้างจัดพิมพ์ใบแจ้งเตือนและส่งใบแจ้งเตือนค่าไฟฟ้า',...cards.map(x=>x.querySelector('[name="detail"]')?.value)]);
    const periodVals=unique([...rows.map(x=>x.billing_text),...cards.map(x=>x.querySelector('[name="period"]')?.value)]);
    const siteVals=unique(['เขตชุมชน','นอกเขตชุมชน',...rows.map(x=>x.area_name),...cards.map(x=>x.querySelector('[name="site"]')?.value)]);
    makePicker(root,item,itemVals,'-- เลือกรายการ --');
    makePicker(root,detail,detailVals,'-- เลือกรายละเอียด --');
    makePicker(root,period,periodVals,'-- เลือกรอบบิล --');
    makePicker(root,site,siteVals,'-- เลือกพื้นที่ / เขตงาน --',value=>{const match=rows.find(x=>norm(x.area_name)===norm(value));if(match&&period){period.value=String(match.billing_text||period.value||'');fire(period);const pp=period.closest('.rt-field')?.querySelector('.rt-smart-picker');if(pp)setPickerOptions(pp,periodVals,period.value,'-- เลือกรอบบิล --')}});
  });
  const bank=ensureEditable(root,'chequeBank');makePicker(root,bank,['ธนาคารกรุงไทย','ธนาคารกสิกรไทย','ธนาคารกรุงเทพ','ธนาคารไทยพาณิชย์','ธนาคารกรุงศรีอยุธยา','ธนาคารทหารไทยธนชาต','ธนาคารออมสิน','ธ.ก.ส.'],'-- เลือกธนาคาร --');
  if(c){const customer=root.querySelector('[name="customer"]');const cp=customer?.closest('.rt-field')?.querySelector('.rt-smart-picker');if(cp)cp.value=String(c.customer_name||'')}
}
function addStyle(){if(document.getElementById('rt-smart-dropdown-style-v2'))return;const s=document.createElement('style');s.id='rt-smart-dropdown-style-v2';s.textContent=`
#receiptTaxV1 .rt-smart-picker{display:block!important;width:100%!important;margin:0 0 6px!important;border:1px solid #bdaee0!important;border-radius:8px!important;padding:9px 34px 9px 10px!important;font:inherit!important;background:#fff!important;color:#25183d!important;cursor:pointer!important;appearance:auto!important}
#receiptTaxV1 .rt-smart-help{margin:5px 0 0;font-size:11px;color:#786c89;line-height:1.3}
#receiptTaxV1 .rt-field input,#receiptTaxV1 .rt-field textarea{display:block!important}
`;document.head.appendChild(s)}
async function enhance(root){if(!root||root.dataset.rtDropdownV2==='1'||root.dataset.rtDropdownV2==='loading')return;root.dataset.rtDropdownV2='loading';addStyle();try{const data=await loadMaster();if(!document.body.contains(root))return;refresh(root,data);root.dataset.rtDropdownV2='1'}catch(e){root.dataset.rtDropdownV2='error';console.error('receipt visible dropdowns',e)} }
function scan(){const root=document.getElementById('receiptTaxV1');if(root&&root.dataset.rtDropdownV2!=='1'&&root.dataset.rtDropdownV2!=='loading')enhance(root)}
function boot(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});[100,300,700,1500,3000].forEach(ms=>setTimeout(scan,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

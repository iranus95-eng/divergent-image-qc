(function(){
'use strict';
function fire(el){if(!el)return;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}
function style(){
  if(document.getElementById('bi-extra-smart-style-v2'))return;
  const s=document.createElement('style');
  s.id='bi-extra-smart-style-v2';
  s.textContent=`
#billingInvoiceV1 .bi-extra-item .bi-extra-smart{display:block!important;width:100%!important;margin:0 0 6px!important;border:1px solid #bcaedd!important;border-radius:8px!important;padding:9px 34px 9px 10px!important;font:inherit!important;background:#fff!important;color:#25183d!important;appearance:auto!important;min-height:39px!important}
#billingInvoiceV1 .bi-extra-item .bi-extra-source.bi-extra-hidden{display:none!important}
#billingInvoiceV1 .bi-extra-item .bi-extra-source:not(.bi-extra-hidden){display:block!important;margin-top:6px!important}
#billingInvoiceV1 #billingPaper .bi-item-row td{height:10.5mm!important;vertical-align:top!important;padding-top:.8mm!important}
`;
  document.head.appendChild(s);
}
function baseOptions(root,name){
  const base=root.querySelector(`.bi-smart-select[data-for="${name}"]`);
  if(base){
    return [...base.options].map(o=>({value:o.value,text:o.textContent||o.value})).filter(o=>o.value!==''&&o.value!=='__manual__');
  }
  const defaults={
    item:['ค่าจ้างจัดพิมพ์ (P00001)'],
    detail:['ค่าจ้างจัดพิมพ์ใบแจ้งเตือนและส่งใบแจ้งเตือนค่าไฟฟ้า'],
    area:['เขตชุมชน','นอกเขตชุมชน'],
    unit:['ฉบับ','ราย','ชุด','งาน'],
    period:[]
  };
  return (defaults[name]||[]).map(v=>({value:v,text:v}));
}
function enhanceField(root,card,name){
  const input=card.querySelector(`[data-bi-item-field="${name}"]`);
  if(!input||input.dataset.biExtraSmartBound==='1')return;
  input.dataset.biExtraSmartBound='1';
  input.classList.add('bi-extra-source');
  const sel=document.createElement('select');
  sel.className='bi-extra-smart';
  sel.dataset.for=name;
  const opts=baseOptions(root,name);
  const current=String(input.value||'');
  sel.innerHTML='<option value="">-- เลือกจากรายการ --</option>'+opts.map(o=>`<option value="${esc(o.value)}">${esc(o.text)}</option>`).join('')+'<option value="__manual__">✎ พิมพ์ข้อความอื่นเอง</option>';
  if(opts.some(o=>o.value===current)){
    sel.value=current;
    input.classList.add('bi-extra-hidden');
  }else if(current){
    sel.value='__manual__';
    input.classList.remove('bi-extra-hidden');
  }else{
    sel.value='';
    input.classList.add('bi-extra-hidden');
  }
  sel.addEventListener('change',()=>{
    if(sel.value==='__manual__'){
      input.classList.remove('bi-extra-hidden');
      input.focus();
      return;
    }
    if(!sel.value)return;
    input.value=sel.value;
    input.classList.add('bi-extra-hidden');
    fire(input);
  });
  input.parentNode.insertBefore(sel,input);
}
function enhanceCard(root,card){
  if(!card||card.dataset.biExtraEnhanced==='1')return;
  card.dataset.biExtraEnhanced='1';
  ['period','detail','area','item','unit'].forEach(name=>enhanceField(root,card,name));
}
function enhance(root){
  if(!root)return;
  style();
  root.querySelectorAll('.bi-extra-item:not([data-bi-extra-enhanced="1"])').forEach(card=>enhanceCard(root,card));
}
function scan(){const root=document.getElementById('billingInvoiceV1');if(root)enhance(root)}
function boot(){
  scan();
  const observer=new MutationObserver(mutations=>{
    let relevant=false;
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches?.('.bi-extra-item')||node.querySelector?.('.bi-extra-item')){relevant=true;break}
      }
      if(relevant)break;
    }
    if(relevant)scan();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  [100,400,1000,2200].forEach(ms=>setTimeout(scan,ms));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
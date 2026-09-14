(function(window){
'use strict';
const STYLE_ID='invoice-excel-exact-style-v3';
const PAPER_ID='invoicePaper';
let headerSrc='';
let footerSrc='';
let patched=false;
let patchTimer=0;

const TH_MONTHS=['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MONTHS_SHORT=['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const FONT="'TH SarabunPSK','TH Sarabun New','Sarabun',Tahoma,sans-serif";

function byId(id){return document.getElementById(id)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function n(v){const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:0}
function money(v){return n(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})}
function integer(v){return Math.round(n(v)).toLocaleString('th-TH')}
function isoParts(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?{y:+m[1],m:+m[2],d:+m[3]}:null}
function thaiShortDate(v){const p=isoParts(v);return p?`${p.d} ${TH_MONTHS_SHORT[p.m]} ${p.y+543}`:''}
function thaiMonth(v){const m=String(v||'').match(/^(\d{4})-(\d{2})/);return m?`${TH_MONTHS[+m[2]]} ${+m[1]+543}`:''}
function cleanCustomerName(s){return String(s||'').replace(/^\s*\d+\s*[·\-:]\s*/,'').replace(/\s*\(\s*สาขาที่\s*[^)]*\)\s*$/,'').trim()}
function selectedCustomer(){
  const p=byId('pInvCustomer');
  if(p&&p.textContent.trim())return cleanCustomerName(p.textContent);
  const sel=byId('invCustomer');
  return cleanCustomerName(sel?.selectedOptions?.[0]?.textContent||'');
}
function branchName(){
  const rows=readInputRows();
  if(rows[0]?.area)return rows[0].area;
  let s=selectedCustomer();
  return s.replace(/^การไฟฟ้าส่วนภูมิภาค(?:สาขา|อำเภอ)?/,'').trim()||s;
}
function currentSubject(){return 'ส่งมอบงานจ้างเหมาจัดส่งบิลแจ้งเตือนค่าไฟฟ้าด้วยระบบ INSX'}
function currentRecipient(){return `ผู้จัดการ ${selectedCustomer()||'การไฟฟ้าส่วนภูมิภาค'}`}
function currentReference(){
  const contract=String(byId('invContractNumber')?.value||'').trim();
  const c=selectedCustomer()||'การไฟฟ้าส่วนภูมิภาค';
  return contract?`ตามใบสั่งจ้าง${c} สัญญาเลขที่ ${contract}`:`ตามใบสั่งจ้าง${c}`;
}
function currentCompanyLine(){return 'บริษัท ไดเวอร์เจนท์ คอร์ปอเรชั่น จำกัด เป็นผู้รับจ้างเหมาส่งบิลแจ้งเตือนค่าไฟฟ้าด้วยระบบINSX'}
function completionText(){return 'บัดนี้ บริษัท ไดเวอร์เจนท์ คอร์ปอเรชั่น จำกัด ได้ดำเนินงานส่งบิลแจ้งเตือนค่าไฟฟ้าด้วยระบบ INSX เป็นที่เรียบร้อยถูกต้อง\nตามแผนผังและรายละเอียดในใบสั่งจ้างทุกประการและเป็นไปตามมาตรฐานของการไฟฟ้าส่วนภูมิภาค ดังนั้นจึงขอส่งมอบงาน'}

function captureImages(){
  const p=byId(PAPER_ID);if(!p)return;
  const imgs=[...p.querySelectorAll('img')];
  if(!headerSrc){const x=p.querySelector('.invoice-head-img')||imgs[0];headerSrc=x?.src||''}
  if(!footerSrc){const x=p.querySelector('.invoice-foot-img')||imgs[imgs.length-1];footerSrc=x?.src||''}
}

const EXACT_CSS=`
#invoicePaper.invoice-excel-exact{position:relative!important;width:794px!important;height:1123px!important;min-height:1123px!important;padding:0!important;margin:0!important;overflow:hidden!important;background:#fff!important;color:#000!important;box-sizing:border-box!important;font-family:${FONT}!important;font-size:12pt!important;font-weight:700!important;line-height:1!important}
#invoicePaper.invoice-excel-exact *{box-sizing:border-box!important;font-family:${FONT}!important;color:#000!important}
#invoicePaper.invoice-excel-exact .xl-head-image{position:absolute!important;left:26px!important;top:34px!important;width:679px!important;height:105px!important;object-fit:fill!important;display:block!important;margin:0!important;padding:0!important}
#invoicePaper.invoice-excel-exact .xl-foot-image{position:absolute!important;left:23px!important;top:987px!important;width:680px!important;height:89px!important;object-fit:fill!important;display:block!important;margin:0!important;padding:0!important}
#invoicePaper.invoice-excel-exact .xl-top{position:absolute!important;left:22.68px!important;top:174px!important;width:748.35px!important;height:168px!important;display:grid!important;grid-template-columns:56.90px 279.49px 77.30px 77.30px 81.54px 77.30px 98.53px!important;grid-template-rows:repeat(6,28px)!important;align-items:center!important;font-size:12pt!important;font-weight:700!important;line-height:1!important}
#invoicePaper.invoice-excel-exact .xl-top .xl-cell{height:28px!important;display:flex!important;align-items:center!important;white-space:nowrap!important;overflow:visible!important;padding:0!important;margin:0!important}
#invoicePaper.invoice-excel-exact .xl-top .xl-label{padding-left:1px!important}
#invoicePaper.invoice-excel-exact .xl-top .xl-value{grid-column:2/8!important;padding-left:2px!important}
#invoicePaper.invoice-excel-exact .xl-top .xl-span{grid-column:1/8!important;padding-left:1px!important}
#invoicePaper.invoice-excel-exact .xl-top .xl-no-label{grid-column:6!important;justify-content:flex-end!important;padding-right:4px!important}
#invoicePaper.invoice-excel-exact .xl-top .xl-no{grid-column:7!important;padding-left:4px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table{position:absolute!important;left:22.68px!important;top:354px!important;width:748.35px!important;margin:0!important;border-collapse:collapse!important;border-spacing:0!important;table-layout:fixed!important;font-size:12pt!important;font-weight:700!important;line-height:1!important;background:#fff!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table col:nth-child(1){width:56.90px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table col:nth-child(2){width:279.49px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table col:nth-child(3){width:77.30px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table col:nth-child(4){width:77.30px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table col:nth-child(5){width:81.54px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table col:nth-child(6){width:77.30px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table col:nth-child(7){width:98.53px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table th,#invoicePaper.invoice-excel-exact .invoice-table.xl-table td{border:1px solid #000!important;background:#fff!important;padding:0 3px!important;margin:0!important;vertical-align:middle!important;font-size:12pt!important;font-weight:700!important;line-height:1.02!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table th{text-align:center!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-h1,#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-h2{height:28px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-desc{height:89px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-desc td:nth-child(2){text-align:left!important;line-height:1.20!important;padding-left:3px!important;white-space:normal!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-data-first{height:40.8px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-data{height:28px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-total{height:28px!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-center{text-align:center!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-left{text-align:left!important}
#invoicePaper.invoice-excel-exact .invoice-table.xl-table .xl-words{text-align:center!important;line-height:1.02!important;white-space:nowrap!important;overflow:hidden!important}
#invoicePaper.invoice-excel-exact #pInvCompletionNote{position:absolute!important;left:22.68px!important;top:670px!important;width:748.35px!important;height:74px!important;margin:0!important;padding:0!important;white-space:pre-line!important;overflow:hidden!important;text-align:left!important;font-size:12pt!important;font-weight:700!important;line-height:1.35!important}
#invoicePaper.invoice-excel-exact .xl-close-1,#invoicePaper.invoice-excel-exact .xl-close-2,#invoicePaper.invoice-excel-exact .xl-sign-name,#invoicePaper.invoice-excel-exact .xl-sign-role{position:absolute!important;left:22.68px!important;width:748.35px!important;height:28px!important;text-align:center!important;font-size:12pt!important;font-weight:700!important;line-height:28px!important;margin:0!important;padding:0!important}
#invoicePaper.invoice-excel-exact .xl-close-1{top:767.4px!important}
#invoicePaper.invoice-excel-exact .xl-close-2{top:795.4px!important}
#invoicePaper.invoice-excel-exact .xl-sign-name{top:879.4px!important}
#invoicePaper.invoice-excel-exact .xl-sign-role{top:907.4px!important}
#invoicePaper.invoice-excel-exact .xl-hidden{display:none!important}
@media print{
 @page{size:A4 portrait;margin:0}
 #invoicePaper.invoice-excel-exact{width:210mm!important;height:297mm!important;min-height:297mm!important;transform:none!important;transform-origin:top left!important;margin:0!important;overflow:hidden!important}
}
`;

function installStyle(){if(byId(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=EXACT_CSS;document.head.appendChild(s)}

function template(){
  return `
    ${headerSrc?`<img class="xl-head-image" src="${esc(headerSrc)}" alt="Divergent Corporation">`:''}
    <div class="xl-top">
      <div class="xl-cell xl-no-label" style="grid-row:1">เลขที่</div><div class="xl-cell xl-no" id="pInvNo" style="grid-row:1"></div>
      <div class="xl-cell xl-label" style="grid-column:1;grid-row:2">วันที่</div><div class="xl-cell xl-value" id="pInvDate" style="grid-row:2"></div>
      <div class="xl-cell xl-label" style="grid-column:1;grid-row:3">เรื่อง</div><div class="xl-cell xl-value" id="xlInvSubject" style="grid-row:3"></div>
      <div class="xl-cell xl-label" style="grid-column:1;grid-row:4">เรียน</div><div class="xl-cell xl-value" id="xlInvRecipient" style="grid-row:4"></div>
      <div class="xl-cell xl-span" id="pInvContractLine" style="grid-row:5"></div>
      <div class="xl-cell xl-span" id="xlInvCompany" style="grid-row:6"></div>
    </div>
    <table class="invoice-table xl-table">
      <colgroup><col><col><col><col><col><col><col></colgroup>
      <thead>
        <tr class="xl-h1"><th rowspan="2">ลำดับ</th><th rowspan="2">รายการ</th><th>จำนวน</th><th>ราคา/ห<br>น่วย</th><th rowspan="2">จำนวนเง<br>ิน</th><th rowspan="2">ภาษี<br>มูลค่าเพิ่ม<br>7%</th><th rowspan="2">ราคารวม<br>(บาท)</th></tr>
        <tr class="xl-h2"><th>(ราย)</th><th>(บาท)</th></tr>
      </thead>
      <tbody id="pInvItems"></tbody>
      <tfoot><tr class="xl-total"><td></td><td class="xl-left">รวมเป็นเงินทั้งสิ้น</td><td colspan="4" class="xl-words" id="pInvBahtText"></td><td class="xl-center" id="pInvGrand"></td></tr></tfoot>
    </table>
    <div id="pInvCompletionNote"></div>
    <div class="xl-close-1">จึงเรียนมาเพื่อโปรดทราบและดำเนินการต่อไปด้วย</div>
    <div class="xl-close-2">ขอแสดงความนับถือ</div>
    <div class="xl-sign-name">(นายอธิคม&nbsp;&nbsp;บางเจริญวงศ์)</div>
    <div class="xl-sign-role">กรรมการ</div>
    ${footerSrc?`<img class="xl-foot-image" src="${esc(footerSrc)}" alt="Divergent Corporation address">`:''}
    <div class="xl-hidden" id="pInvCustomer"></div><div class="xl-hidden" id="pInvTax"></div><div class="xl-hidden" id="pInvAddress"></div>
  `;
}

function ensureTemplate(){
  const p=byId(PAPER_ID);if(!p)return false;
  captureImages();installStyle();
  if(!p.classList.contains('invoice-excel-exact')){p.innerHTML=template();p.classList.add('invoice-excel-exact')}
  return true;
}

function readInputRows(){
  const trs=[...document.querySelectorAll('#invItemInputs tr')];
  return trs.map((tr,i)=>{
    const sel=tr.querySelector('.invoice-master-item-select');
    let area=String(sel?.selectedOptions?.[0]?.textContent||'').split('·')[0].trim();
    const qty=n(tr.querySelector('.invoice-monthly-qty')?.value);
    const nums=[...tr.querySelectorAll('input[type="number"]')];
    const price=n(nums.find(x=>!x.classList.contains('invoice-monthly-qty'))?.value);
    return {area,qty,price,index:i+1};
  }).filter(r=>r.area||r.qty||r.price);
}

function fallbackRowsFromPreview(){
  const rows=[];
  document.querySelectorAll('#pInvItems tr').forEach((tr,i)=>{
    const td=[...tr.children].map(x=>x.textContent.trim());
    if(td.length>=7)rows.push({index:i+1,area:td[1].split(/\n|ประจำเดือน/).pop().trim(),qty:n(td[2]),price:n(td[3])});
  });
  return rows;
}

function renderRows(rows,period){
  const body=byId('pInvItems');if(!body)return {grand:0};
  const use=(rows.length?rows:fallbackRowsFromPreview()).slice(0,4);
  let sub=0,vat=0,grand=0;
  const out=[];
  out.push(`<tr class="xl-desc"><td></td><td>${esc(period)}</td><td></td><td></td><td></td><td></td><td></td></tr>`);
  for(let i=0;i<4;i++){
    const r=use[i];
    if(r){const amt=r.qty*r.price,rowVat=amt*.07,rowTotal=amt+rowVat;sub+=amt;vat+=rowVat;grand+=rowTotal;out.push(`<tr class="${i===0?'xl-data-first':'xl-data'}"><td class="xl-center">${i+1}</td><td class="xl-left">${esc(r.area)}</td><td class="xl-center">${integer(r.qty)}</td><td class="xl-center">${money(r.price)}</td><td class="xl-center">${money(amt)}</td><td class="xl-center">${money(rowVat)}</td><td class="xl-center">${money(rowTotal)}</td></tr>`)}
    else out.push(`<tr class="${i===0?'xl-data-first':'xl-data'}"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`);
  }
  body.innerHTML=out.join('');
  return {sub,vat,grand};
}

function syncExact(){
  if(!ensureTemplate())return;
  const no=byId('invNo')?.value||byId('pInvNo')?.textContent||'';
  const dt=byId('invDateText')?.value||byId('pInvDate')?.textContent||'';
  const bill=byId('invBillMonth')?.value||'';
  const sd=thaiShortDate(byId('invStartDate')?.value);
  const ed=thaiShortDate(byId('invEndDate')?.value);
  const period=`ส่งบิลแจ้งเตือนค่าไฟฟ้าด้วยระบบ INSX ประจำเดือน ${thaiMonth(bill)} ( ${sd} - ${ed} )`;
  const originalWords=byId('pInvBahtText')?.textContent||'';
  const rows=readInputRows();
  const totals=renderRows(rows,period);
  byId('pInvNo').textContent=no;
  byId('pInvDate').textContent=dt;
  byId('xlInvSubject').textContent=currentSubject();
  byId('xlInvRecipient').textContent=currentRecipient();
  byId('pInvContractLine').textContent=currentReference();
  byId('xlInvCompany').textContent=currentCompanyLine();
  byId('pInvCompletionNote').textContent=completionText();
  byId('pInvGrand').textContent=money(totals.grand);
  if(originalWords)byId('pInvBahtText').textContent=originalWords;
  const c=byId('pInvCustomer');if(c)c.textContent=selectedCustomer();
}

function printExact(){
  syncExact();
  const p=byId(PAPER_ID);if(!p)return;
  const w=window.open('','_blank');
  if(!w){alert('เบราว์เซอร์บล็อกหน้าต่างพิมพ์');return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ใบตั้งหนี้</title><style>@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;background:#fff}${EXACT_CSS}</style></head><body>${p.outerHTML}</body></html>`);
  w.document.close();
  setTimeout(()=>{w.focus();w.print()},350);
}

function patch(){
  if(patched)return true;
  if(typeof window.renderInvoicePreview!=='function'||!byId(PAPER_ID))return false;
  captureImages();
  const oldRender=window.renderInvoicePreview;
  window.renderInvoicePreview=function(){const wasExact=byId(PAPER_ID)?.classList.contains('invoice-excel-exact');const r=oldRender.apply(this,arguments);ensureTemplate();if(!wasExact)oldRender.apply(this,arguments);syncExact();return r};
  if(typeof window.printInvoiceA4==='function')window.printInvoiceA4=printExact;
  if(typeof window.downloadInvoicePdf==='function'){
    const oldPdf=window.downloadInvoicePdf;window.downloadInvoicePdf=async function(){syncExact();return await oldPdf.apply(this,arguments)};
  }
  if(typeof window.shareInvoiceToLine==='function'){
    const oldShare=window.shareInvoiceToLine;window.shareInvoiceToLine=async function(){syncExact();return await oldShare.apply(this,arguments)};
  }
  patched=true;
  try{window.renderInvoicePreview()}catch(e){console.warn('invoice exact first render',e)}
  document.addEventListener('input',e=>{if(e.target?.closest?.('#invoiceWorkspace'))requestAnimationFrame(syncExact)},true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('#invoiceWorkspace'))requestAnimationFrame(syncExact)},true);
  return true;
}

function boot(){
  if(patch())return;
  let tries=0;
  patchTimer=setInterval(()=>{tries++;if(patch()||tries>80){clearInterval(patchTimer);patchTimer=0}},125);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);

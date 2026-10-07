(function(){
'use strict';

const STYLE_ID='receipt-final-layout-v2';
const EXTRA_BLANK_ROWS=5;
const CUSTOMER_COLOR='#6d35d4';
const ACCOUNTING_COLOR='#198754';

const CSS=`
#receiptTaxV1 .rt-paper.${STYLE_ID}{font-size:15pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-company b{font-size:17pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-company .en{font-size:15pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-company div{font-size:12pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-copybox,#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-copyfor{font-size:12pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-title b{font-size:19pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-title span{font-size:13pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-info{font-size:13.5pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-info-line,#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-info-line *{font-size:13.5pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-table,#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-table th,#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-table td{font-size:13pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-table th,#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-table td{height:27px!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-pay{font-size:12pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-words{font-size:12pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-total-row{font-size:12.8pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID} .rt-sign{font-size:11.5pt!important}
#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-customer .rt-table th{background:${CUSTOMER_COLOR}!important;color:#fff!important}
#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-customer .rt-title,#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-customer .rt-copybox{border-color:${CUSTOMER_COLOR}!important}
#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-customer .rt-title b,#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-customer .rt-copybox{color:#4f239d!important}
#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-accounting .rt-table th{background:${ACCOUNTING_COLOR}!important;color:#fff!important}
#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-accounting .rt-title,#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-accounting .rt-copybox{border-color:${ACCOUNTING_COLOR}!important}
#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-accounting .rt-title b,#receiptTaxV1 .rt-paper.${STYLE_ID}.rt-theme-accounting .rt-copybox{color:#146c43!important}
`;

const FRAME_CSS=`
.rt-paper.${STYLE_ID}{font-size:15pt!important}
.rt-paper.${STYLE_ID} .rt-company b{font-size:17pt!important}
.rt-paper.${STYLE_ID} .rt-company .en{font-size:15pt!important}
.rt-paper.${STYLE_ID} .rt-company div{font-size:12pt!important}
.rt-paper.${STYLE_ID} .rt-copybox,.rt-paper.${STYLE_ID} .rt-copyfor{font-size:12pt!important}
.rt-paper.${STYLE_ID} .rt-title b{font-size:19pt!important}
.rt-paper.${STYLE_ID} .rt-title span{font-size:13pt!important}
.rt-paper.${STYLE_ID} .rt-info{font-size:13.5pt!important}
.rt-paper.${STYLE_ID} .rt-info-line,.rt-paper.${STYLE_ID} .rt-info-line *{font-size:13.5pt!important}
.rt-paper.${STYLE_ID} .rt-table,.rt-paper.${STYLE_ID} .rt-table th,.rt-paper.${STYLE_ID} .rt-table td{font-size:13pt!important}
.rt-paper.${STYLE_ID} .rt-table th,.rt-paper.${STYLE_ID} .rt-table td{height:5.6mm!important;padding:.5mm 1mm!important;line-height:1.06!important}
.rt-paper.${STYLE_ID} .rt-pay{font-size:11.5pt!important}
.rt-paper.${STYLE_ID} .rt-words{font-size:12pt!important}
.rt-paper.${STYLE_ID} .rt-total-row{font-size:12.8pt!important}
.rt-paper.${STYLE_ID} .rt-sign{font-size:11.5pt!important}
.rt-paper.${STYLE_ID}.rt-theme-customer .rt-table th{background:${CUSTOMER_COLOR}!important;color:#fff!important}
.rt-paper.${STYLE_ID}.rt-theme-customer .rt-title,.rt-paper.${STYLE_ID}.rt-theme-customer .rt-copybox{border-color:${CUSTOMER_COLOR}!important}
.rt-paper.${STYLE_ID}.rt-theme-customer .rt-title b,.rt-paper.${STYLE_ID}.rt-theme-customer .rt-copybox{color:#4f239d!important}
.rt-paper.${STYLE_ID}.rt-theme-accounting .rt-table th{background:${ACCOUNTING_COLOR}!important;color:#fff!important}
.rt-paper.${STYLE_ID}.rt-theme-accounting .rt-title,.rt-paper.${STYLE_ID}.rt-theme-accounting .rt-copybox{border-color:${ACCOUNTING_COLOR}!important}
.rt-paper.${STYLE_ID}.rt-theme-accounting .rt-title b,.rt-paper.${STYLE_ID}.rt-theme-accounting .rt-copybox{color:#146c43!important}
`;

function installPreviewStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=CSS;
  document.head.appendChild(style);
}

function themePaper(paper){
  const copyFor=(paper.querySelector('.rt-copyfor')?.textContent||'').trim();
  const accounting=copyFor.includes('บัญชี');
  paper.classList.toggle('rt-theme-accounting',accounting);
  paper.classList.toggle('rt-theme-customer',!accounting);
}

function parseMoney(v){
  const n=Number(String(v||'').replace(/,/g,'').trim());
  return Number.isFinite(n)?n:0;
}

function money(v){
  return parseMoney(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function thaiInteger(n){
  const d=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const p=['','สิบ','ร้อย','พัน','หมื่น','แสน'];
  n=Math.floor(Math.abs(n));
  if(n===0)return '';
  function six(x){
    let out='';
    const a=String(x).padStart(6,'0');
    for(let i=0;i<6;i++){
      const v=Number(a[i]);
      if(!v)continue;
      const pos=5-i;
      if(pos===1){
        if(v===1)out+='สิบ';
        else if(v===2)out+='ยี่สิบ';
        else out+=d[v]+'สิบ';
      }else if(pos===0){
        if(v===1&&out)out+='เอ็ด';
        else out+=d[v];
      }else out+=d[v]+p[pos];
    }
    return out;
  }
  if(n>=1000000)return thaiInteger(Math.floor(n/1000000))+'ล้าน'+six(n%1000000);
  return six(n);
}

function bahtText(v){
  const n=Math.round(parseMoney(v)*100)/100;
  const baht=Math.floor(n);
  const sat=Math.round((n-baht)*100);
  return (baht?thaiInteger(baht):'ศูนย์')+'บาท'+(sat?thaiInteger(sat)+'สตางค์':'ถ้วน');
}

function fixTotals(paper){
  let grossRow=null;
  let withholdingRow=null;
  let finalRow=null;
  paper.querySelectorAll('.rt-total-row').forEach(row=>{
    const label=(row.querySelector('b')?.textContent||'').replace(/\s+/g,' ').trim();
    if(label==='รวมเงินทั้งสิ้น')grossRow=row;
    else if(label==='หัก ณ ที่จ่าย 1%')withholdingRow=row;
    else if(label==='จำนวนเงินทั้งสิ้น')finalRow=row;
  });

  if(grossRow&&finalRow){
    const grossText=(grossRow.querySelector('.r')?.textContent||grossRow.querySelector('span')?.textContent||'').trim();
    const gross=parseMoney(grossText);
    const finalValue=finalRow.querySelector('.r')||finalRow.querySelector('span');
    if(finalValue)finalValue.textContent=grossText;
    const words=paper.querySelector('.rt-words');
    if(words&&gross>0)words.innerHTML='<b>ตัวอักษร.</b>&nbsp; ('+bahtText(gross)+')';
  }

  if(grossRow)grossRow.remove();
  if(withholdingRow)withholdingRow.remove();
}

function patchLegacyTransfer(root){
  if(!root)return;
  const transfer=root.querySelector('input[name="transfer"]');
  if(!transfer)return;
  const subtotal=[...root.querySelectorAll('.rt-item-editor input[name="amount"]')]
    .reduce((sum,input)=>sum+parseMoney(input.value),0);
  if(!(subtotal>0))return;
  const gross=Math.round(subtotal*1.07*100)/100;
  const legacyNet=Math.round(subtotal*1.06*100)/100;
  const current=Math.round(parseMoney(transfer.value)*100)/100;
  if(Math.abs(current-legacyNet)<0.011)transfer.value=gross.toFixed(2);
}

function addBlankRows(paper){
  const tbody=paper.querySelector('.rt-table tbody');
  if(!tbody)return;
  let count=tbody.querySelectorAll('tr.rt-final-extra-blank').length;
  while(count<EXTRA_BLANK_ROWS){
    const tr=document.createElement('tr');
    tr.className='rt-final-extra-blank';
    tr.innerHTML='<td>&nbsp;</td><td></td><td></td><td></td><td></td>';
    tbody.appendChild(tr);
    count++;
  }
}

// Every item row holds one line of text, so all rows keep the same height and size.
// A description too long for its cell continues on the next row (split on Thai word breaks),
// and an empty filler row is dropped so the table keeps its size.
const SEGMENTER=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('th',{granularity:'word'}):null;
function lineCount(td){
  const r=td.ownerDocument.createRange();r.selectNodeContents(td);
  const tops=new Set();[...r.getClientRects()].forEach(x=>{if(x.width>0.5)tops.add(Math.round(x.top))});
  return tops.size;
}
function fitItemRows(paper){
  const tbody=paper.querySelector('.rt-table tbody');
  if(!tbody)return;
  let splits=0;
  for(let i=0;i<tbody.rows.length&&splits<30;i++){
    const tr=tbody.rows[i],td=tr.cells[1];
    if(!td||td.children.length)continue;
    const text=td.textContent;
    if(!text.trim()||lineCount(td)<=1)continue;
    const raw=SEGMENTER?[...SEGMENTER.segment(text)].map(s=>s.segment):text.split(/(\s+)/);
    // keep abbreviations such as "มิ.ย." / "พ.ค." in one piece
    const parts=[];
    raw.forEach(p=>{const last=parts.length?parts[parts.length-1]:'';if(last&&!/\s$/.test(last)&&!/^\s/.test(p)&&(/\.$/.test(last)||/^\./.test(p)))parts[parts.length-1]=last+p;else parts.push(p)});
    const fits=n=>{td.textContent=parts.slice(0,n).join('');return lineCount(td)<=1};
    let lo=1,hi=parts.length-1,best=0;
    while(lo<=hi){const mid=(lo+hi)>>1;if(fits(mid)){best=mid;lo=mid+1}else hi=mid-1}
    if(!best){td.textContent=text;continue}
    // prefer breaking at a space when one is close to the end of the line
    for(let k=best;k>Math.max(0,best-6);k--){if(/^\s/.test(parts[k]||'')||/\s$/.test(parts[k-1]||'')){best=k;break}}
    td.textContent=parts.slice(0,best).join('').trimEnd();
    const nr=tr.ownerDocument.createElement('tr');
    nr.className='rt-wrap-row';
    nr.innerHTML='<td></td><td></td><td></td><td></td><td></td>';
    nr.cells[1].textContent=parts.slice(best).join('').trim();
    tr.after(nr);
    splits++;
    const rows=[...tbody.rows];
    for(let k=rows.length-1;k>i+1;k--){
      if(!rows[k].classList.contains('rt-final-extra-blank')&&!rows[k].textContent.trim()){rows[k].remove();break;}
    }
  }
}

function patchPaper(paper){
  if(!paper)return;
  paper.classList.remove('receipt-final-layout-v1');
  paper.classList.add(STYLE_ID);
  themePaper(paper);
  fixTotals(paper);
  addBlankRows(paper);
  try{fitItemRows(paper)}catch(e){console.warn('receipt rows',e)}
}

function patchPreview(){
  const root=document.getElementById('receiptTaxV1');
  if(!root)return;
  patchLegacyTransfer(root);
  root.querySelectorAll('.rt-paper').forEach(patchPaper);
}

function injectFrameStyle(doc){
  if(!doc||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');
  style.id=STYLE_ID;
  style.textContent=FRAME_CSS;
  (doc.head||doc.documentElement).appendChild(style);
}

function patchFrame(frame){
  if(!frame)return;
  const tryPatch=()=>{
    try{
      const doc=frame.contentDocument;
      if(!doc||!doc.documentElement)return false;
      const papers=[...doc.querySelectorAll('.rt-paper')];
      if(!papers.length)return false;
      injectFrameStyle(doc);
      papers.forEach(patchPaper);
      return true;
    }catch(_){return false}
  };
  [0,20,50,90,140,220,300].forEach(ms=>setTimeout(tryPatch,ms));
  frame.addEventListener('load',()=>[0,20,60,120,200].forEach(ms=>setTimeout(tryPatch,ms)),{once:true});
}

let queued=false;
function schedulePreview(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;patchPreview()});
}

function boot(){
  installPreviewStyle();
  patchPreview();
  document.querySelectorAll('iframe').forEach(patchFrame);
  new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type!=='childList'||!m.addedNodes.length)continue;
      for(const n of m.addedNodes){
        if(n.nodeType!==1)continue;
        if(n.tagName==='IFRAME')patchFrame(n);
        else n.querySelectorAll?.('iframe').forEach(patchFrame);
        if(n.id==='receiptTaxV1'||n.classList?.contains('rt-paper')||n.querySelector?.('.rt-paper'))schedulePreview();
      }
    }
  }).observe(document.body,{childList:true,subtree:true});
  [120,350,800,1500].forEach(ms=>setTimeout(patchPreview,ms));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

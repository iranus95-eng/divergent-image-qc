(function(){
'use strict';

const STYLE_ID='receipt-final-layout-v1';
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

function removeTotals(paper){
  paper.querySelectorAll('.rt-total-row').forEach(row=>{
    const label=(row.querySelector('b')?.textContent||'').replace(/\s+/g,' ').trim();
    if(label==='รวมเงินทั้งสิ้น'||label==='หัก ณ ที่จ่าย 1%')row.remove();
  });
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

function patchPaper(paper){
  if(!paper)return;
  paper.classList.add(STYLE_ID);
  themePaper(paper);
  removeTotals(paper);
  addBlankRows(paper);
}

function patchPreview(){
  const root=document.getElementById('receiptTaxV1');
  if(!root)return;
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

(function(){
'use strict';
const MARK='bi-final-layout-v2';
const COMPANY='บริษัท ไดเวอร์เจนท์ คอร์ปอเรชั่น จำกัด';
const EXTRA_BLANK_ROWS=5;

function ensureFontStyle(paper){
  if(paper.querySelector('style[data-bi-final-font]'))return;
  const s=document.createElement('style');
  s.setAttribute('data-bi-final-font','1');
  s.textContent=`
.bi-paper.${MARK}{font-size:15pt!important}
.bi-paper.${MARK} .bi-company b{font-size:17pt!important}
.bi-paper.${MARK} .bi-company .en{font-size:15pt!important}
.bi-paper.${MARK} .bi-company div{font-size:12pt!important}
.bi-paper.${MARK} .bi-taxnote,.bi-paper.${MARK} .bi-customer-copy{font-size:12pt!important}
.bi-paper.${MARK} .bi-title b{font-size:19pt!important}
.bi-paper.${MARK} .bi-title span{font-size:13pt!important}
.bi-paper.${MARK} .bi-info{font-size:13.5pt!important}
.bi-paper.${MARK} .bi-doc-table{font-size:13pt!important}
.bi-paper.${MARK} .bi-doc-table th,.bi-paper.${MARK} .bi-doc-table td{font-size:13pt!important}
.bi-paper.${MARK} .bi-notes{font-size:11.3pt!important}
.bi-paper.${MARK} .bi-amount-words{font-size:12pt!important}
.bi-paper.${MARK} .bi-total-row{font-size:12.8pt!important}
.bi-paper.${MARK} .bi-sign{font-size:11.5pt!important}
.bi-paper.${MARK} .bi-tax-options,.bi-paper.${MARK} .bi-tax-options *{font-size:15pt!important}
.bi-paper.${MARK} .bi-info-line span>span{font-size:15pt!important}
/* Right signature box only: give the company name more breathing room. */
.bi-paper.${MARK} .bi-signs .bi-sign:last-child{
  height:22.8mm!important;
  padding:2.8mm 1.5mm 1.5mm!important;
  justify-content:space-between!important;
  align-self:end!important;
}
.bi-paper.${MARK} .bi-signs .bi-sign:last-child>*:first-child{
  display:block!important;
  line-height:1.2!important;
  margin:0!important;
  padding:0!important;
}
.bi-paper.${MARK} .bi-signs .bi-sign:last-child>*:last-child{
  line-height:1.15!important;
  margin:0!important;
}
`;
  paper.appendChild(s);
}

function fixNotes(paper){
  const notes=paper.querySelector('.bi-notes');
  if(!notes)return;
  const target='017-0-53651-3';
  const replacement=target+' '+COMPANY;
  if(notes.innerHTML.includes(replacement))return;
  if(notes.innerHTML.includes(target))notes.innerHTML=notes.innerHTML.replace(target,replacement);
}

function fixTotals(paper){
  paper.querySelectorAll('.bi-total-row').forEach(row=>{
    const label=(row.querySelector('b')?.textContent||'').trim();
    if(label==='รวมเงินทั้งสิ้น'||label==='หัก ณ ที่จ่าย 1%')row.remove();
  });
}

function addBlankRows(paper){
  const tbody=paper.querySelector('.bi-doc-table tbody');
  if(!tbody)return;
  let count=tbody.querySelectorAll('tr.bi-final-extra-blank').length;
  while(count<EXTRA_BLANK_ROWS){
    const tr=document.createElement('tr');
    tr.className='bi-blank-row bi-final-extra-blank';
    tr.innerHTML='<td>&nbsp;</td><td></td><td></td><td></td><td></td>';
    tbody.appendChild(tr);
    count++;
  }
}

function patchPaper(paper){
  if(!paper)return;
  paper.classList.add(MARK);
  ensureFontStyle(paper);
  fixNotes(paper);
  fixTotals(paper);
  addBlankRows(paper);
}

function patchRoot(){
  const root=document.getElementById('billingInvoiceV1');
  if(!root)return;
  const paper=root.querySelector('#billingPaper');
  if(paper)patchPaper(paper);
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;patchRoot()});
}

function boot(){
  patchRoot();
  const obs=new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type!=='childList'||!m.addedNodes.length)continue;
      for(const n of m.addedNodes){
        if(n.nodeType!==1)continue;
        if(n.id==='billingInvoiceV1'||n.id==='billingPaper'||n.querySelector?.('#billingPaper')){schedule();return;}
      }
    }
  });
  obs.observe(document.body,{childList:true,subtree:true});
  [120,350,800,1600].forEach(ms=>setTimeout(patchRoot,ms));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

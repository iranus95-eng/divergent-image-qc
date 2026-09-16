(function(){
'use strict';
const MARK='bi-final-layout-v3';
const COMPANY='บริษัท ไดเวอร์เจนท์ คอร์ปอเรชั่น จำกัด';
const EXTRA_BLANK_ROWS=5;

function ensureFontStyle(paper){
  let s=paper.querySelector('style[data-bi-final-font]');
  if(!s){
    s=document.createElement('style');
    s.setAttribute('data-bi-final-font','1');
    paper.appendChild(s);
  }
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

/* Signature section: all three boxes use the same size and baseline. */
.bi-paper.${MARK} .bi-signs{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:2mm!important;
  align-items:stretch!important;
}
.bi-paper.${MARK} .bi-signs .bi-sign{
  width:100%!important;
  height:24mm!important;
  min-height:24mm!important;
  max-height:24mm!important;
  padding:2mm 2.2mm!important;
  box-sizing:border-box!important;
  display:flex!important;
  flex-direction:column!important;
  overflow:hidden!important;
  line-height:1.15!important;
  border:1px solid #111!important;
}
.bi-paper.${MARK} .bi-signs .bi-sign.bi-sign-party{
  justify-content:flex-end!important;
  align-items:stretch!important;
  text-align:left!important;
  gap:1.5mm!important;
  padding-bottom:2.2mm!important;
}
.bi-paper.${MARK} .bi-sign-entry{
  width:100%!important;
  display:grid!important;
  grid-template-columns:max-content minmax(0,1fr)!important;
  align-items:end!important;
  column-gap:1.5mm!important;
  min-height:4.2mm!important;
  white-space:nowrap!important;
}
.bi-paper.${MARK} .bi-sign-entry-label{
  display:block!important;
  line-height:1.1!important;
}
.bi-paper.${MARK} .bi-sign-fill-line{
  display:block!important;
  min-width:0!important;
  height:3.6mm!important;
  border-bottom:1px solid #111!important;
}
.bi-paper.${MARK} .bi-signs .bi-sign.bi-sign-company{
  justify-content:space-between!important;
  align-items:center!important;
  text-align:center!important;
  padding:1.8mm 2mm 2mm!important;
}
.bi-paper.${MARK} .bi-sign-company-name{
  width:100%!important;
  display:block!important;
  text-align:center!important;
  font-size:10.5pt!important;
  line-height:1.15!important;
  white-space:nowrap!important;
  margin:0!important;
  padding:0!important;
}
.bi-paper.${MARK} .bi-sign-authority{
  width:74%!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  gap:1mm!important;
  margin:0 auto!important;
}
.bi-paper.${MARK} .bi-sign-authority-line{
  display:block!important;
  width:100%!important;
  height:1px!important;
  border-bottom:1px solid #111!important;
}
.bi-paper.${MARK} .bi-sign-authority-role{
  display:block!important;
  width:100%!important;
  text-align:center!important;
  font-size:11.5pt!important;
  line-height:1.1!important;
  margin:0!important;
}
`;
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

function patchSignatures(paper){
  const signs=paper.querySelectorAll('.bi-signs .bi-sign');
  if(signs.length<3)return;

  const left=signs[0];
  const middle=signs[1];
  const right=signs[2];

  left.classList.remove('center','bi-sign-company');
  left.classList.add('bi-sign-party');
  left.innerHTML='<div class="bi-sign-entry"><span class="bi-sign-entry-label">ผู้รับใบแจ้งหนี้</span><span class="bi-sign-fill-line"></span></div><div class="bi-sign-entry"><span class="bi-sign-entry-label">วันที่</span><span class="bi-sign-fill-line"></span></div>';

  middle.classList.remove('center','bi-sign-company');
  middle.classList.add('bi-sign-party');
  middle.innerHTML='<div class="bi-sign-entry"><span class="bi-sign-entry-label">ผู้ส่งใบแจ้งหนี้</span><span class="bi-sign-fill-line"></span></div><div class="bi-sign-entry"><span class="bi-sign-entry-label">วันที่</span><span class="bi-sign-fill-line"></span></div>';

  right.classList.remove('bi-sign-party');
  right.classList.add('center','bi-sign-company');
  right.innerHTML='<div class="bi-sign-company-name">'+COMPANY+'</div><div class="bi-sign-authority"><span class="bi-sign-authority-line"></span><span class="bi-sign-authority-role">ผู้มีอำนาจลงนาม</span></div>';
}

function patchPaper(paper){
  if(!paper)return;
  paper.classList.remove('bi-final-layout-v1','bi-final-layout-v2');
  paper.classList.add(MARK);
  ensureFontStyle(paper);
  fixNotes(paper);
  fixTotals(paper);
  addBlankRows(paper);
  patchSignatures(paper);
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

(function(){
'use strict';

const MARK='rt-header-aligned-v1';
const STYLE_ID='receipt-header-align-v1';

const PREVIEW_CSS=`
#receiptTaxV1 .rt-paper.${MARK} .rt-doc-head{
  display:grid!important;
  grid-template-columns:145px 1fr 150px!important;
  gap:12px!important;
  align-items:start!important;
  min-height:0!important;
}
#receiptTaxV1 .rt-paper.${MARK} .rt-doc-head>div:first-child{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:flex-start!important;
  min-width:0!important;
}
#receiptTaxV1 .rt-paper.${MARK} .rt-logo{
  display:block!important;
  max-width:140px!important;
  max-height:76px!important;
  width:auto!important;
  height:auto!important;
  object-fit:contain!important;
  margin:0!important;
}
#receiptTaxV1 .rt-paper.${MARK} .rt-company{
  padding-top:0!important;
  margin-top:0!important;
}
#receiptTaxV1 .rt-paper.${MARK} .rt-company b,
#receiptTaxV1 .rt-paper.${MARK} .rt-company .en,
#receiptTaxV1 .rt-paper.${MARK} .rt-company div{
  line-height:1.08!important;
  margin-top:0!important;
}
#receiptTaxV1 .rt-paper.${MARK} .rt-copybox{margin-top:0!important}
#receiptTaxV1 .rt-paper.${MARK} .rt-copyfor{margin-top:6px!important}
#receiptTaxV1 .rt-paper.${MARK} .rt-title{
  margin:12px auto 14px!important;
  padding:7px!important;
}
`;

const FRAME_CSS=`
.rt-paper.${MARK} .rt-doc-head{
  display:grid!important;
  grid-template-columns:38mm 1fr 40mm!important;
  gap:3mm!important;
  align-items:start!important;
  min-height:0!important;
}
.rt-paper.${MARK} .rt-doc-head>div:first-child{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:flex-start!important;
  min-width:0!important;
}
.rt-paper.${MARK} .rt-logo{
  display:block!important;
  width:37mm!important;
  height:17mm!important;
  max-width:37mm!important;
  max-height:17mm!important;
  object-fit:contain!important;
  margin:0!important;
}
.rt-paper.${MARK} .rt-company{
  padding-top:0!important;
  margin-top:0!important;
}
.rt-paper.${MARK} .rt-company b,
.rt-paper.${MARK} .rt-company .en,
.rt-paper.${MARK} .rt-company div{
  line-height:1.08!important;
  margin-top:0!important;
}
.rt-paper.${MARK} .rt-copybox{margin-top:0!important}
.rt-paper.${MARK} .rt-copyfor{margin-top:1.5mm!important}
.rt-paper.${MARK} .rt-title{
  margin:2.8mm auto 3.5mm!important;
  padding:1.6mm!important;
}
`;

function ensureStyle(doc,css){
  if(!doc||doc.getElementById(STYLE_ID))return;
  const s=doc.createElement('style');
  s.id=STYLE_ID;
  s.textContent=css;
  (doc.head||doc.documentElement).appendChild(s);
}

function patchPaper(paper){
  if(!paper)return false;
  const head=paper.querySelector('.rt-doc-head');
  const logo=paper.querySelector('.rt-logo');
  if(!head||!logo)return false;
  const slot=head.children[0];
  if(slot&&logo.parentElement!==slot)slot.appendChild(logo);
  paper.classList.add(MARK);
  return true;
}

function patchPreview(){
  const root=document.getElementById('receiptTaxV1');
  if(!root)return;
  ensureStyle(document,PREVIEW_CSS);
  root.querySelectorAll('.rt-paper').forEach(patchPaper);
}

function patchFrame(frame){
  if(!frame)return;
  const run=()=>{
    try{
      const doc=frame.contentDocument;
      if(!doc||!doc.documentElement)return false;
      const papers=[...doc.querySelectorAll('.rt-paper')];
      if(!papers.length)return false;
      ensureStyle(doc,FRAME_CSS);
      papers.forEach(patchPaper);
      return true;
    }catch(_){return false}
  };
  [0,20,50,90,140,220,300].forEach(ms=>setTimeout(run,ms));
  frame.addEventListener('load',()=>[0,20,60,120,200].forEach(ms=>setTimeout(run,ms)),{once:true});
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;patchPreview()});
}

function boot(){
  ensureStyle(document,PREVIEW_CSS);
  patchPreview();
  document.querySelectorAll('iframe').forEach(patchFrame);
  new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type!=='childList'||!m.addedNodes.length)continue;
      for(const n of m.addedNodes){
        if(n.nodeType!==1)continue;
        if(n.tagName==='IFRAME')patchFrame(n);
        else n.querySelectorAll?.('iframe').forEach(patchFrame);
        if(n.id==='receiptTaxV1'||n.classList?.contains('rt-paper')||n.querySelector?.('.rt-paper'))schedule();
      }
    }
  }).observe(document.body,{childList:true,subtree:true});
  [100,300,700,1400].forEach(ms=>setTimeout(patchPreview,ms));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

(function(){
'use strict';
const LABEL='เลขประจำตัวผู้เสียภาษี';
const TAX_ID='0105567212151';

function patchPaper(paper){
  if(!paper)return false;
  const company=paper.querySelector('.rt-company');
  if(!company)return false;
  const lines=[...company.querySelectorAll('div')];
  let line=lines.find(el=>(el.textContent||'').trim().includes(TAX_ID));
  if(!line)return false;
  const wanted=`${LABEL} ${TAX_ID}`;
  if((line.textContent||'').trim()!==wanted)line.textContent=wanted;
  return true;
}

function patchPreview(){
  const root=document.getElementById('receiptTaxV1');
  if(!root)return;
  root.querySelectorAll('.rt-paper').forEach(patchPaper);
}

function patchFrame(frame){
  if(!frame)return;
  const tryPatch=()=>{
    try{
      const doc=frame.contentDocument;
      if(!doc)return false;
      const papers=[...doc.querySelectorAll('.rt-paper')];
      if(!papers.length)return false;
      papers.forEach(patchPaper);
      return true;
    }catch(_){return false}
  };
  [0,20,50,100,180,300].forEach(ms=>setTimeout(tryPatch,ms));
  frame.addEventListener('load',()=>[0,30,80,150,250].forEach(ms=>setTimeout(tryPatch,ms)),{once:true});
}

let queued=false;
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;patchPreview()});
}

function boot(){
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

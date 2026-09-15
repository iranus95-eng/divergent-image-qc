(function(){
'use strict';
const STYLE_ID='receipt-signature-fit-v1';
const CSS=`
#receiptTaxV1 .rt-sign.center{
  justify-content:flex-start!important;
  align-items:center!important;
  padding:8px 7px 6px!important;
}
#receiptTaxV1 .rt-sign.center>span:first-child{
  display:block!important;
  width:100%!important;
  text-align:center!important;
  white-space:nowrap!important;
  font-size:9.5pt!important;
  line-height:1.05!important;
  margin:0 0 auto!important;
}
#receiptTaxV1 .rt-sign.center>span:nth-child(2){
  display:block!important;
  width:100%!important;
  text-align:center!important;
  line-height:1!important;
  margin:0 0 4px!important;
}
#receiptTaxV1 .rt-sign.center>span:nth-child(3){
  display:block!important;
  width:100%!important;
  text-align:center!important;
  font-size:10.5pt!important;
  line-height:1.05!important;
  margin:0!important;
}
`;
const PDF_CSS=`
.rt-sign.center{
  justify-content:flex-start!important;
  align-items:center!important;
  padding:1.8mm 1.4mm 1.4mm!important;
}
.rt-sign.center>span:first-child{
  display:block!important;
  width:100%!important;
  text-align:center!important;
  white-space:nowrap!important;
  font-size:8.8pt!important;
  line-height:1.05!important;
  margin:0 0 auto!important;
}
.rt-sign.center>span:nth-child(2){
  display:block!important;
  width:100%!important;
  text-align:center!important;
  line-height:1!important;
  margin:0 0 1.1mm!important;
}
.rt-sign.center>span:nth-child(3){
  display:block!important;
  width:100%!important;
  text-align:center!important;
  font-size:9.5pt!important;
  line-height:1.05!important;
  margin:0!important;
}
`;
function installPreviewStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=CSS;
  document.head.appendChild(style);
}
function patchFrame(frame){
  if(!frame||frame.dataset.receiptSignaturePatched==='1')return;
  const tryPatch=()=>{
    try{
      const doc=frame.contentDocument;
      if(!doc||!doc.documentElement||!doc.querySelector('.rt-paper'))return false;
      if(doc.getElementById(STYLE_ID))return true;
      const style=doc.createElement('style');
      style.id=STYLE_ID;
      style.textContent=PDF_CSS;
      (doc.head||doc.documentElement).appendChild(style);
      frame.dataset.receiptSignaturePatched='1';
      return true;
    }catch(_){return false}
  };
  if(tryPatch())return;
  frame.addEventListener('load',()=>{
    [0,25,75,150].forEach(ms=>setTimeout(tryPatch,ms));
  },{once:true});
  [20,60,120,220,320].forEach(ms=>setTimeout(tryPatch,ms));
}
function scanFrames(){document.querySelectorAll('iframe').forEach(patchFrame)}
function boot(){
  installPreviewStyle();
  scanFrames();
  new MutationObserver(muts=>{
    for(const m of muts){
      for(const n of m.addedNodes){
        if(n.nodeType!==1)continue;
        if(n.tagName==='IFRAME')patchFrame(n);
        else n.querySelectorAll?.('iframe').forEach(patchFrame);
      }
    }
  }).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

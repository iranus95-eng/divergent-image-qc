(function(){
'use strict';
const FIX_STYLE='billing-a4-fix-v1-style';
const LOGO='data:image/jpeg;base64,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';

const A4_SCREEN_CSS=`
#billingPaper.bi-paper{position:relative!important;width:794px!important;height:1123px!important;min-height:0!important;max-height:1123px!important;overflow:hidden!important;padding:26px 24px 22px!important;box-sizing:border-box!important;background:#fff!important;font-family:'Cordia New','CordiaUPC',Tahoma,sans-serif!important;font-size:14pt!important;line-height:1.08!important;color:#000!important}
#billingPaper.bi-paper *{box-sizing:border-box!important}
#billingPaper>.bi-logo{position:absolute!important;left:24px!important;top:24px!important;width:148px!important;height:68px!important;max-width:none!important;max-height:none!important;object-fit:contain!important;z-index:2!important}
#billingPaper .bi-doc-head{display:grid!important;grid-template-columns:154px 1fr 145px!important;gap:12px!important;align-items:start!important;min-height:86px!important}
#billingPaper .bi-company b{display:block!important;font-size:16pt!important;line-height:1.05!important}
#billingPaper .bi-company .en{font-size:14pt!important;font-weight:800!important;line-height:1.05!important}
#billingPaper .bi-company div{font-size:11pt!important;line-height:1.12!important}
#billingPaper .bi-taxnote{font-size:11pt!important;padding:5px 4px!important;border-width:1.5px!important}
#billingPaper .bi-customer-copy{font-size:11pt!important;margin-top:6px!important}
#billingPaper .bi-title{margin:12px auto 10px!important;width:286px!important;padding:5px!important;border-width:1.5px!important}
#billingPaper .bi-title b{font-size:18pt!important;line-height:1!important}
#billingPaper .bi-title span{font-size:12pt!important;line-height:1.05!important}
#billingPaper .bi-info{grid-template-columns:1fr 205px!important;gap:12px!important;margin-bottom:8px!important;font-size:12.5pt!important}
#billingPaper .bi-info-line{grid-template-columns:98px 1fr!important;gap:5px!important;line-height:1.18!important}
#billingPaper .bi-doc-table{font-size:12pt!important}
#billingPaper .bi-doc-table th,#billingPaper .bi-doc-table td{height:22px!important;padding:2px 4px!important;line-height:1.08!important}
#billingPaper .bi-doc-table tbody tr:first-child td{height:42px!important;vertical-align:top!important;padding-top:4px!important}
#billingPaper .bi-bottom{grid-template-columns:1fr 225px!important;gap:10px!important;margin-top:8px!important;align-items:start!important}
#billingPaper .bi-notes{font-size:10.5pt!important;line-height:1.25!important;margin-top:0!important}
#billingPaper .bi-total-row{grid-template-columns:1fr 88px!important;padding:2px 5px!important;font-size:11pt!important;line-height:1.2!important}
#billingPaper .bi-signs{gap:8px!important;margin-top:10px!important}
#billingPaper .bi-sign{height:78px!important;padding:6px!important;font-size:10.5pt!important;line-height:1.2!important}
`;

const PRINT_CSS=`
@page{size:A4 portrait;margin:0!important}
html,body{margin:0!important;padding:0!important;width:210mm!important;height:297mm!important;overflow:hidden!important;background:#fff!important}
body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.bi-paper{position:relative!important;width:210mm!important;height:297mm!important;min-height:0!important;max-height:297mm!important;margin:0!important;padding:6.8mm 6.35mm 5.8mm!important;overflow:hidden!important;box-sizing:border-box!important;background:#fff!important;font-family:'Cordia New','CordiaUPC',Tahoma,sans-serif!important;font-size:14pt!important;line-height:1.08!important;color:#000!important;page-break-after:avoid!important;break-after:avoid-page!important}
.bi-paper *{box-sizing:border-box!important}
.bi-paper>.bi-logo{position:absolute!important;left:6.35mm!important;top:6.35mm!important;width:39mm!important;height:18mm!important;max-width:none!important;max-height:none!important;object-fit:contain!important;z-index:2!important}
.bi-doc-head{display:grid!important;grid-template-columns:40.5mm 1fr 38mm!important;gap:3mm!important;align-items:start!important;min-height:22.5mm!important}
.bi-company b{display:block!important;font-size:16pt!important;line-height:1.05!important}.bi-company .en{font-size:14pt!important;font-weight:800!important;line-height:1.05!important}.bi-company div{font-size:11pt!important;line-height:1.12!important}
.bi-taxnote{font-size:11pt!important;padding:1.3mm 1mm!important;border:1.5px solid #96362d!important;border-radius:2mm!important;text-align:center!important}.bi-customer-copy{text-align:center!important;font-size:11pt!important;margin-top:1.6mm!important}
.bi-title{margin:3mm auto 2.5mm!important;width:75.5mm!important;padding:1.3mm!important;border:1.5px solid #97362e!important;border-radius:2mm!important;text-align:center!important}.bi-title b{font-size:18pt!important;line-height:1!important}.bi-title span{display:block!important;font-size:12pt!important;font-weight:800!important;line-height:1.05!important}
.bi-info{display:grid!important;grid-template-columns:1fr 54mm!important;gap:3mm!important;margin-bottom:2mm!important;font-size:12.5pt!important}.bi-info-line{display:grid!important;grid-template-columns:26mm 1fr!important;gap:1.3mm!important;line-height:1.18!important}
.bi-doc-table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:12pt!important}.bi-doc-table th,.bi-doc-table td{border:1px solid #111!important;height:5.8mm!important;padding:.55mm 1mm!important;line-height:1.08!important}.bi-doc-table th{background:#9c3a00!important;color:#fff!important;text-align:center!important}.bi-doc-table tbody tr:first-child td{height:11mm!important;vertical-align:top!important;padding-top:1mm!important}.c{text-align:center!important}.r{text-align:right!important}
.bi-bottom{display:grid!important;grid-template-columns:1fr 59.5mm!important;gap:2.5mm!important;margin-top:2mm!important;align-items:start!important}.bi-notes{font-size:10.5pt!important;line-height:1.25!important;margin-top:0!important}.bi-totals{border:1px solid #111!important}.bi-total-row{display:grid!important;grid-template-columns:1fr 23mm!important;padding:.55mm 1.3mm!important;font-size:11pt!important;line-height:1.2!important}
.bi-signs{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:2mm!important;margin-top:2.5mm!important}.bi-sign{border:1px solid #111!important;height:20.5mm!important;padding:1.5mm!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;font-size:10.5pt!important;line-height:1.2!important}.center{text-align:center!important}
`;

function installFixStyle(){
  if(document.getElementById(FIX_STYLE))return;
  const s=document.createElement('style');s.id=FIX_STYLE;s.textContent=A4_SCREEN_CSS;document.head.appendChild(s);
}
function fixLogo(scope=document){
  scope.querySelectorAll?.('#billingPaper>.bi-logo').forEach(img=>{if(img.src!==LOGO)img.src=LOGO;img.alt='Divergent Corporation';});
}
function fitPreview(root){
  const wrap=root?.querySelector('.bi-preview-wrap'),paper=root?.querySelector('#billingPaper');
  if(!wrap||!paper)return;
  const scale=Math.min(1,Math.max(.52,(wrap.clientWidth-24)/794));
  paper.style.zoom=String(scale);
}
function printOneA4(root){
  const paper=root?.querySelector('#billingPaper');if(!paper)return;
  fixLogo(root);
  const clone=paper.cloneNode(true);clone.style.zoom='1';clone.style.transform='none';clone.style.margin='0';
  const w=window.open('','_blank','width=900,height=1100');
  if(!w){alert('กรุณาอนุญาต Pop-up เพื่อพิมพ์เอกสาร');return;}
  w.document.open();
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบแจ้งหนี้-ใบวางบิล</title><style>${PRINT_CSS}</style></head><body>${clone.outerHTML}<script>window.onload=function(){setTimeout(function(){window.print()},180)}<\/script></body></html>`);
  w.document.close();
}
function patchRoot(){
  installFixStyle();
  const root=document.getElementById('billingInvoiceV1');if(!root)return;
  fixLogo(root);fitPreview(root);
  const print=root.querySelector('#biPrint');
  if(print&&!print.dataset.a4fix){print.dataset.a4fix='1';print.onclick=function(e){e.preventDefault();printOneA4(root)};}
  if(!root.dataset.a4observer){
    root.dataset.a4observer='1';
    new MutationObserver(()=>{fixLogo(root);fitPreview(root);}).observe(root,{childList:true,subtree:true});
    window.addEventListener('resize',()=>fitPreview(root));
  }
}
function hookOpen(){
  if(typeof window.openBillingManagement!=='function')return false;
  if(window.openBillingManagement.__a4fixed)return true;
  const original=window.openBillingManagement;
  const wrapped=function(){const r=original.apply(this,arguments);setTimeout(patchRoot,0);setTimeout(patchRoot,120);return r;};
  wrapped.__a4fixed=true;window.openBillingManagement=wrapped;window.openBillingInvoiceManagement=wrapped;return true;
}
installFixStyle();
let tries=0;const timer=setInterval(()=>{tries++;if(hookOpen()||tries>80){clearInterval(timer);patchRoot();}},50);
new MutationObserver(patchRoot).observe(document.documentElement,{childList:true,subtree:true});
})();
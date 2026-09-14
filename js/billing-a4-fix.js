(function(){
'use strict';
/* Print-only fix for ใบแจ้งหนี้-ใบวางบิล.
   Do not alter preview, logo, data, calculations, table content, or other menus. */
const PRINT_CSS=`
@page{size:A4 portrait;margin:0!important}
html,body{margin:0!important;padding:0!important;width:210mm!important;height:297mm!important;min-width:210mm!important;max-width:210mm!important;min-height:297mm!important;max-height:297mm!important;overflow:hidden!important;background:#fff!important;writing-mode:horizontal-tb!important}
body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.bi-paper{position:relative!important;width:210mm!important;height:297mm!important;min-width:210mm!important;max-width:210mm!important;min-height:297mm!important;max-height:297mm!important;margin:0!important;padding:6.8mm 6.35mm 30mm!important;overflow:hidden!important;box-sizing:border-box!important;background:#fff!important;font-family:'Cordia New','CordiaUPC',Tahoma,sans-serif!important;font-size:14pt!important;line-height:1.08!important;color:#000!important;transform:none!important;zoom:1!important;page-break-after:avoid!important;break-after:avoid-page!important}
.bi-paper *{box-sizing:border-box!important}
.bi-paper>.bi-logo-original,.bi-paper>.bi-logo{position:absolute!important;left:6.35mm!important;top:6.35mm!important;width:48.4mm!important;height:16.1mm!important;max-width:48.4mm!important;max-height:16.1mm!important;object-fit:contain!important;display:block!important;z-index:50!important}
.bi-doc-head{display:grid!important;grid-template-columns:50mm 1fr 38mm!important;gap:3mm!important;align-items:start!important;min-height:23mm!important}
.bi-company b{display:block!important;font-size:16pt!important;line-height:1.05!important}.bi-company .en{font-size:14pt!important;font-weight:800!important;line-height:1.05!important}.bi-company div{font-size:11pt!important;line-height:1.12!important}
.bi-taxnote{font-size:11pt!important;padding:1.3mm 1mm!important;border:1.5px solid #96362d!important;border-radius:2mm!important;text-align:center!important}.bi-customer-copy{text-align:center!important;font-size:11pt!important;margin-top:1.6mm!important}
.bi-title{margin:3mm auto 2.5mm!important;width:75.5mm!important;padding:1.3mm!important;border:1.5px solid #97362e!important;border-radius:2mm!important;text-align:center!important}.bi-title b{font-size:18pt!important;line-height:1!important}.bi-title span{display:block!important;font-size:12pt!important;font-weight:800!important;line-height:1.05!important}
.bi-info{display:grid!important;grid-template-columns:1fr 54mm!important;gap:3mm!important;margin-bottom:2mm!important;font-size:12.5pt!important}.bi-info-line{display:grid!important;grid-template-columns:26mm 1fr!important;gap:1.3mm!important;line-height:1.18!important}
.bi-doc-table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:12pt!important}.bi-doc-table th,.bi-doc-table td{border:1px solid #111!important;height:5.6mm!important;padding:.5mm 1mm!important;line-height:1.06!important}.bi-doc-table th{background:#9c3a00!important;color:#fff!important;text-align:center!important}.bi-doc-table tbody tr:first-child td{height:10.5mm!important;vertical-align:top!important;padding-top:.8mm!important}.c{text-align:center!important}.r{text-align:right!important}
.bi-bottom{display:grid!important;grid-template-columns:1fr 59.5mm!important;gap:2.5mm!important;margin-top:1.8mm!important;align-items:start!important}.bi-notes{font-size:10.3pt!important;line-height:1.2!important;margin-top:0!important}.bi-totals{border:1px solid #111!important}.bi-total-row{display:grid!important;grid-template-columns:1fr 23mm!important;padding:.45mm 1.3mm!important;font-size:10.8pt!important;line-height:1.15!important}
.bi-signs{position:absolute!important;left:6.35mm!important;right:6.35mm!important;bottom:6mm!important;display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:2mm!important;margin:0!important}.bi-sign{border:1px solid #111!important;height:20.5mm!important;padding:1.5mm!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;font-size:10.5pt!important;line-height:1.2!important}.center{text-align:center!important}
@media print{html,body,.bi-paper{width:210mm!important;height:297mm!important;transform:none!important;zoom:1!important}}
`;
function printPortrait(root){
  const paper=root&&root.querySelector('#billingPaper');
  if(!paper)return;
  const clone=paper.cloneNode(true);
  clone.style.zoom='1';
  clone.style.transform='none';
  clone.style.margin='0';
  const w=window.open('','_blank','width=850,height=1100');
  if(!w){alert('กรุณาอนุญาต Pop-up เพื่อพิมพ์เอกสาร');return;}
  w.document.open();
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบแจ้งหนี้-ใบวางบิล</title><style>${PRINT_CSS}</style></head><body>${clone.outerHTML}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
}
function patchPrint(){
  const root=document.getElementById('billingInvoiceV1');
  if(!root)return false;
  const btn=root.querySelector('#biPrint');
  if(!btn)return false;
  btn.onclick=function(e){e.preventDefault();e.stopPropagation();printPortrait(root);};
  return true;
}
function hookOpen(){
  if(typeof window.openBillingManagement!=='function')return false;
  if(window.openBillingManagement.__printPortraitOnly)return true;
  const original=window.openBillingManagement;
  const wrapped=function(){
    const r=original.apply(this,arguments);
    setTimeout(patchPrint,0);
    setTimeout(patchPrint,120);
    setTimeout(patchPrint,350);
    return r;
  };
  wrapped.__printPortraitOnly=true;
  window.openBillingManagement=wrapped;
  window.openBillingInvoiceManagement=wrapped;
  return true;
}
patchPrint();
let tries=0;
const timer=setInterval(function(){
  tries++;
  if(hookOpen()||tries>100){clearInterval(timer);setTimeout(patchPrint,0);}
},50);
})();
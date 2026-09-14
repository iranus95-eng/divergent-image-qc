(function(){
'use strict';
const STYLE_ID='billing-a4-fix-v4-style';
const LOGO_URL=location.origin+'/images/divergent-logo-original.jpg?v=20260914-2015';
const SCREEN_CSS=`
#billingPaper.bi-paper{position:relative!important;width:794px!important;height:1123px!important;min-height:0!important;max-height:1123px!important;overflow:hidden!important;padding:26px 24px 22px!important;box-sizing:border-box!important;background:#fff!important;font-family:'Cordia New','CordiaUPC',Tahoma,sans-serif!important;font-size:14pt!important;line-height:1.08!important;color:#000!important}
#billingPaper.bi-paper *{box-sizing:border-box!important}
#billingPaper>.bi-logo,#billingPaper>.bi-logo-original{position:absolute!important;left:24px!important;top:24px!important;width:183px!important;height:61px!important;max-width:none!important;max-height:none!important;object-fit:contain!important;display:block!important;z-index:50!important}
#billingPaper .bi-doc-head{display:grid!important;grid-template-columns:190px 1fr 145px!important;gap:12px!important;align-items:start!important;min-height:88px!important}
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
@page{size:A4 portrait;margin:0!important}html,body{margin:0!important;padding:0!important;width:210mm!important;height:297mm!important;overflow:hidden!important;background:#fff!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.bi-paper{position:relative!important;width:210mm!important;height:297mm!important;min-height:0!important;max-height:297mm!important;margin:0!important;padding:6.8mm 6.35mm 5.8mm!important;overflow:hidden!important;box-sizing:border-box!important;background:#fff!important;font-family:'Cordia New','CordiaUPC',Tahoma,sans-serif!important;font-size:14pt!important;line-height:1.08!important;color:#000!important;page-break-after:avoid!important;break-after:avoid-page!important}.bi-paper *{box-sizing:border-box!important}
.bi-paper>.bi-logo,.bi-paper>.bi-logo-original{position:absolute!important;left:6.35mm!important;top:6.35mm!important;width:48.4mm!important;height:16.1mm!important;object-fit:contain!important;display:block!important;z-index:50!important}
.bi-doc-head{display:grid!important;grid-template-columns:50mm 1fr 38mm!important;gap:3mm!important;align-items:start!important;min-height:23mm!important}.bi-company b{display:block!important;font-size:16pt!important;line-height:1.05!important}.bi-company .en{font-size:14pt!important;font-weight:800!important;line-height:1.05!important}.bi-company div{font-size:11pt!important;line-height:1.12!important}.bi-taxnote{font-size:11pt!important;padding:1.3mm 1mm!important;border:1.5px solid #96362d!important;border-radius:2mm!important;text-align:center!important}.bi-customer-copy{text-align:center!important;font-size:11pt!important;margin-top:1.6mm!important}.bi-title{margin:3mm auto 2.5mm!important;width:75.5mm!important;padding:1.3mm!important;border:1.5px solid #97362e!important;border-radius:2mm!important;text-align:center!important}.bi-title b{font-size:18pt!important;line-height:1!important}.bi-title span{display:block!important;font-size:12pt!important;font-weight:800!important;line-height:1.05!important}.bi-info{display:grid!important;grid-template-columns:1fr 54mm!important;gap:3mm!important;margin-bottom:2mm!important;font-size:12.5pt!important}.bi-info-line{display:grid!important;grid-template-columns:26mm 1fr!important;gap:1.3mm!important;line-height:1.18!important}.bi-doc-table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:12pt!important}.bi-doc-table th,.bi-doc-table td{border:1px solid #111!important;height:5.8mm!important;padding:.55mm 1mm!important;line-height:1.08!important}.bi-doc-table th{background:#9c3a00!important;color:#fff!important;text-align:center!important}.bi-doc-table tbody tr:first-child td{height:11mm!important;vertical-align:top!important;padding-top:1mm!important}.c{text-align:center!important}.r{text-align:right!important}.bi-bottom{display:grid!important;grid-template-columns:1fr 59.5mm!important;gap:2.5mm!important;margin-top:2mm!important;align-items:start!important}.bi-notes{font-size:10.5pt!important;line-height:1.25!important;margin-top:0!important}.bi-totals{border:1px solid #111!important}.bi-total-row{display:grid!important;grid-template-columns:1fr 23mm!important;padding:.55mm 1.3mm!important;font-size:11pt!important;line-height:1.2!important}.bi-signs{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:2mm!important;margin-top:2.5mm!important}.bi-sign{border:1px solid #111!important;height:20.5mm!important;padding:1.5mm!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;font-size:10.5pt!important;line-height:1.2!important}.center{text-align:center!important}
`;
function installStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=SCREEN_CSS;document.head.appendChild(s)}
function replaceLogo(scope=document){
  const paper=scope.querySelector?.('#billingPaper');if(!paper)return;
  paper.querySelectorAll(':scope > .bi-logo,:scope > .bi-logo-svg,:scope > .bi-logo-original,:scope > .bi-logo-fallback').forEach(el=>el.remove());
  const img=document.createElement('img');img.className='bi-logo-original';img.src=LOGO_URL;img.alt='';img.width=183;img.height=61;
  img.style.cssText='position:absolute!important;left:24px!important;top:24px!important;width:183px!important;height:61px!important;object-fit:contain!important;display:block!important;z-index:50!important;';
  paper.prepend(img);
}
function fitPreview(root){const wrap=root?.querySelector('.bi-preview-wrap'),paper=root?.querySelector('#billingPaper');if(!wrap||!paper)return;paper.style.zoom=String(Math.min(1,Math.max(.5,(wrap.clientWidth-24)/794)))}
function printOnePage(root){
  const paper=root?.querySelector('#billingPaper');if(!paper)return;replaceLogo(root);
  const clone=paper.cloneNode(true);clone.style.zoom='1';clone.style.transform='none';clone.style.margin='0';
  const logo=clone.querySelector(':scope > .bi-logo-original');if(logo){logo.src=LOGO_URL;logo.style.cssText='position:absolute!important;left:6.35mm!important;top:6.35mm!important;width:48.4mm!important;height:16.1mm!important;object-fit:contain!important;display:block!important;z-index:50!important;'}
  const w=window.open('','_blank','width=900,height=1100');if(!w){alert('กรุณาอนุญาต Pop-up เพื่อพิมพ์เอกสาร');return}
  w.document.open();w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><base href="${location.origin}/"><title>ใบแจ้งหนี้-ใบวางบิล</title><style>${PRINT_CSS}</style></head><body>${clone.outerHTML}<script>window.onload=function(){setTimeout(function(){window.print()},220)}<\/script></body></html>`);w.document.close();
}
function patchRoot(){installStyle();const root=document.getElementById('billingInvoiceV1');if(!root)return;replaceLogo(root);fitPreview(root);const btn=root.querySelector('#biPrint');if(btn&&!btn.dataset.a4v4){btn.dataset.a4v4='1';btn.onclick=e=>{e.preventDefault();printOnePage(root)}}if(!root.dataset.a4v4observer){root.dataset.a4v4observer='1';new MutationObserver(()=>{replaceLogo(root);fitPreview(root)}).observe(root,{childList:true,subtree:true});window.addEventListener('resize',()=>fitPreview(root))}}
function hookOpen(){if(typeof window.openBillingManagement!=='function')return false;if(window.openBillingManagement.__a4v4)return true;const original=window.openBillingManagement;const wrapped=function(){const r=original.apply(this,arguments);setTimeout(patchRoot,0);setTimeout(patchRoot,150);return r};wrapped.__a4v4=true;window.openBillingManagement=wrapped;window.openBillingInvoiceManagement=wrapped;return true}
installStyle();let tries=0;const timer=setInterval(()=>{tries++;if(hookOpen()||tries>100){clearInterval(timer);patchRoot()}},50);new MutationObserver(patchRoot).observe(document.documentElement,{childList:true,subtree:true});
})();
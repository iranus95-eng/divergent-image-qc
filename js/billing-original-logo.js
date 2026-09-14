(function(){
'use strict';
/* Stable billing logo loader. Uses the exact repository image directly and
   patches only the billing paper. No MutationObserver is used. */
const RAW_LOGO='https://raw.githubusercontent.com/iranus95-eng/divergent-image-qc/main/images/divergent-logo-original.jpg?v=20260915-0513';
const LOCAL_FALLBACK='/images/divergent-logo-original.jpg?v=20260915-0513';
const STYLE_ID='billing-original-logo-stable-v7';
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#billingPaper{position:relative!important}
#billingPaper>.bi-logo-original{position:absolute!important;left:24px!important;top:24px!important;width:183px!important;height:61px!important;max-width:183px!important;max-height:61px!important;object-fit:contain!important;display:block!important;z-index:60!important}
#billingPaper>.bi-logo-fallback{display:none!important}
`;
  document.head.appendChild(s);
}
function fixLogo(){
  installStyle();
  const root=document.getElementById('billingInvoiceV1');
  const paper=root&&root.querySelector('#billingPaper');
  if(!paper)return false;
  paper.querySelectorAll(':scope > .bi-logo-fallback,:scope > .bi-logo-svg').forEach(el=>el.remove());
  let img=paper.querySelector(':scope > .bi-logo-original,:scope > .bi-logo');
  if(!img){
    img=document.createElement('img');
    paper.prepend(img);
  }
  img.className='bi-logo-original';
  img.alt='';
  img.width=183;
  img.height=61;
  img.referrerPolicy='no-referrer';
  img.style.cssText='position:absolute!important;left:24px!important;top:24px!important;width:183px!important;height:61px!important;max-width:183px!important;max-height:61px!important;object-fit:contain!important;display:block!important;z-index:60!important;';
  if(!img.dataset.logoFallbackBound){
    img.dataset.logoFallbackBound='1';
    img.addEventListener('error',()=>{
      if(img.dataset.localTried==='1')return;
      img.dataset.localTried='1';
      img.src=LOCAL_FALLBACK;
    });
  }
  if(img.src!==RAW_LOGO && img.dataset.localTried!=='1')img.src=RAW_LOGO;
  return true;
}
function burst(){
  let n=0;
  const t=setInterval(()=>{n++;fixLogo();if(n>=32)clearInterval(t)},250);
}
function hookOpen(){
  if(typeof window.openBillingManagement!=='function')return false;
  if(window.openBillingManagement.__logoStableV7)return true;
  const original=window.openBillingManagement;
  const wrapped=function(){
    const r=original.apply(this,arguments);
    setTimeout(burst,0);
    return r;
  };
  wrapped.__logoStableV7=true;
  window.openBillingManagement=wrapped;
  window.openBillingInvoiceManagement=wrapped;
  return true;
}
installStyle();
fixLogo();
burst();
let tries=0;
const hookTimer=setInterval(()=>{tries++;if(hookOpen()||tries>100)clearInterval(hookTimer)},50);
document.addEventListener('click',e=>{
  const el=e.target&&e.target.closest&&e.target.closest('#navBilling,[data-v2-page="billing"]');
  if(el)setTimeout(burst,0);
},true);
window.addEventListener('load',burst,{once:true});
})();

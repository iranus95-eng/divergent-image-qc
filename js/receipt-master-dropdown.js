(function(){
'use strict';
function loadOnce(attr,src){
  if(document.querySelector(`script[${attr}]`))return;
  const s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(attr,'1');document.head.appendChild(s);
}
function boot(){
  loadOnce('data-claim-legacy-persist','./js/claim-legacy-persist.js?v=20260915-0954');
  loadOnce('data-billing-smart-dropdowns','./js/billing-smart-dropdowns.js?v=20260915-1532');
  loadOnce('data-billing-multi-item','./js/billing-multi-item.js?v=20260915-1540');
  loadOnce('data-receipt-smart-dropdowns','./js/receipt-smart-dropdowns.js?v=20260915-1532');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
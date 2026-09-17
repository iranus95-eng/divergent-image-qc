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
  loadOnce('data-billing-final-layout','./js/billing-final-layout.js?v=20260916-0947');
  loadOnce('data-receipt-smart-dropdowns','./js/receipt-smart-dropdowns.js?v=20260916-1144');
  loadOnce('data-home-menu-dedupe','./js/home-menu-dedupe.js?v=20260915-1635');
  loadOnce('data-receipt-signature-fix','./js/receipt-signature-fix.js?v=20260915-1647');
  loadOnce('data-receipt-final-layout','./js/receipt-final-layout.js?v=20260916-0950');
  loadOnce('data-receipt-header-align','./js/receipt-header-align.js?v=20260916-1238');
  loadOnce('data-receipt-company-tax-label','./js/receipt-company-tax-label.js?v=20260916-1137');
  loadOnce('data-customer-import','./js/customer-import.js?v=20260917-1040');
  loadOnce('data-paper-order','./js/paper-order.js?v=20260917-1745');
  loadOnce('data-paper-order-next-cycle','./js/paper-order-next-cycle.js?v=20260917-1802');
  loadOnce('data-home-menu-order','./js/home-menu-order.js?v=20260917-1745');
  loadOnce('data-expense-report-v2','./js/expense-report-v2.js?v=20260917-1415');
  loadOnce('data-expense-cycle-status-fix','./js/expense-cycle-status-fix.js?v=20260917-1405');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
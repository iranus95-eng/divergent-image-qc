(function(){
'use strict';
function loadOnce(attr,src){
  if(document.querySelector(`script[${attr}]`))return;
  const s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(attr,'1');document.head.appendChild(s);
}
function boot(){
  loadOnce('data-claim-legacy-persist','./js/claim-legacy-persist.js?v=20260915-0954');
  loadOnce('data-claim-pending-live','./js/claim-pending-live.js?v=20260930-2029');
  loadOnce('data-claim-date-display-fix','./js/claim-date-display-fix.js?v=20260930-2037');
  loadOnce('data-qc-coordinate-display-restore','./js/qc-coordinate-display-restore.js?v=20261002-1530');
  loadOnce('data-billing-smart-dropdowns','./js/billing-smart-dropdowns.js?v=20260915-1532');
  loadOnce('data-billing-multi-item','./js/billing-multi-item.js?v=20260915-1540');
  loadOnce('data-billing-final-layout','./js/billing-final-layout.js?v=20261002-1105');
  loadOnce('data-receipt-smart-dropdowns','./js/receipt-smart-dropdowns.js?v=20260916-1144');
  loadOnce('data-home-menu-dedupe','./js/home-menu-dedupe.js?v=20260915-1635');
  loadOnce('data-receipt-signature-fix','./js/receipt-signature-fix.js?v=20260915-1647');
  loadOnce('data-receipt-final-layout','./js/receipt-final-layout.js?v=20261002-1402');
  loadOnce('data-receipt-header-align','./js/receipt-header-align.js?v=20260916-1238');
  loadOnce('data-receipt-company-tax-label','./js/receipt-company-tax-label.js?v=20260916-1137');
  loadOnce('data-customer-import','./js/customer-import.js?v=20260917-1040');
  loadOnce('data-paper-order','./js/paper-order.js?v=20260917-1745');
  loadOnce('data-paper-order-next-cycle','./js/paper-order-next-cycle.js?v=20260917-1945');
  loadOnce('data-home-menu-order','./js/home-menu-order.js?v=20260917-1745');
  loadOnce('data-expense-report-v2','./js/expense-report-v2.js?v=20260926-1421');
  loadOnce('data-staff-expense-history','./js/staff-expense-history.js?v=20261001-1705');
  loadOnce('data-staff-expense-history-detail-report','./js/staff-expense-history-detail-report.js?v=20261001-1945');
  loadOnce('data-payroll-report-id-fix','./js/payroll-report-id-fix.js?v=20260928-0725');
  loadOnce('data-payroll-binding-admin','./js/payroll-binding-admin.js?v=20260928-1656');
  loadOnce('data-expense-cycle-status-fix','./js/expense-cycle-status-fix.js?v=20260917-1405');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
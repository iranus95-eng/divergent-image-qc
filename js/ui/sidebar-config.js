/* Divergent V3 - declarative sidebar configuration */
(function (window) {
  'use strict';

  const ITEMS = Object.freeze([
    { id: 'navHome', key: null, always: true },
    { id: 'navClaim', key: 'claim' },
    { id: 'navClaimPending', key: 'claim_pending' },
    { id: 'navPayroll', key: 'payroll' },
    { id: 'navStaffExpense', key: 'staff_expenses' },
    { id: 'navQc', key: 'qc' },
    { id: 'navSearch', key: 'search' },
    { id: 'navUsers', key: 'user_management' },
    { id: 'navInvoice', key: 'invoice' },
    { id: 'navBilling', key: 'billing' },
    { id: 'navPnl', key: 'pnl' }
  ]);

  window.DivergentSidebarConfigV3 = Object.freeze({ ITEMS });
})(window);

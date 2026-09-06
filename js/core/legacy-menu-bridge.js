/* Divergent V3 - temporary compatibility bridge for legacy index.html */
(function (window) {
  'use strict';

  function toLegacy(access) {
    const a = window.DivergentPermissions ? window.DivergentPermissions.normalize(access) : (access || {});
    return {
      qc: !!a.qc,
      claim: !!a.claim,
      claim_pending: !!a.claim_pending,
      search: !!a.search,
      staff_payroll: !!a.payroll,
      payroll: !!a.payroll,
      staff_expense: !!a.staff_expenses,
      staff_expenses: !!a.staff_expenses,
      user_management: !!a.user_management,
      invoice: !!a.invoice,
      billing: !!a.billing,
      pnl: !!a.pnl
    };
  }

  function apply(state) {
    if (!state || !state.confirmed) return false;
    const legacy = toLegacy(state.access);

    // Preferred handoff: reuse the legacy page's existing immutable sidebar commit function.
    if (typeof window.commitMenuAccess === 'function') {
      return !!window.commitMenuAccess(legacy, state.user || null, state.authMode || 'session');
    }

    // Fallback only for migration/testing pages where the legacy function is not exported.
    window.menuAccess = { ...legacy };
    window.authoritativeMenuAccess = Object.freeze({ ...legacy });
    window.authoritativeAuthMode = state.authMode || 'session';
    window.currentMenuUser = state.user || null;
    window.menuAccessConfirmed = true;
    if (typeof window.applyMenuAccess === 'function') window.applyMenuAccess();
    return true;
  }

  window.DivergentLegacyMenuBridge = Object.freeze({ toLegacy, apply });
})(window);

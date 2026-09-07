/* Divergent V3 - temporary compatibility bridge for legacy index.html */
(function (window) {
  'use strict';

  const LEGACY_WEB_SESSION_KEY = 'divergent_web_session_token_v1';

  function toLegacy(access, user) {
    const a = window.DivergentPermissions ? window.DivergentPermissions.normalize(access, user) : (access || {});
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

  function keepLegacySessionGuard(state) {
    if (!state || state.authMode !== 'session' || !window.DivergentAuthV3) return;
    try {
      const token = window.DivergentAuthV3.readToken();
      if (token) localStorage.setItem(LEGACY_WEB_SESSION_KEY, token);
    } catch (_) {}
  }

  function apply(state) {
    if (!state || !state.confirmed) return false;
    keepLegacySessionGuard(state);
    const legacy = toLegacy(state.access, state.user);

    if (typeof window.commitMenuAccess === 'function') {
      return !!window.commitMenuAccess(legacy, state.user || null, state.authMode || 'session');
    }

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

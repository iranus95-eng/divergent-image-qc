/* Divergent V3 - canonical permission contract */
(function (window) {
  'use strict';

  const KEYS = Object.freeze([
    'qc',
    'claim',
    'claim_pending',
    'search',
    'payroll',
    'staff_expenses',
    'user_management',
    'invoice',
    'billing',
    'pnl'
  ]);

  const EMPTY = Object.freeze(KEYS.reduce((out, key) => {
    out[key] = false;
    return out;
  }, {}));

  const LEGACY_ALIASES = Object.freeze({
    staff_expense: 'staff_expenses',
    staff_payroll: 'payroll'
  });

  // Business rule: operational staff must always be able to work on payroll
  // and staff expenses. These are core duties, not optional menu grants.
  const STAFF_CORE_ROLES = Object.freeze(['staff', 'user_creator']);
  const STAFF_CORE_PERMISSIONS = Object.freeze(['payroll', 'staff_expenses']);

  function normalize(raw, user) {
    raw = raw || {};
    const out = { ...EMPTY };

    for (const key of KEYS) out[key] = raw[key] === true;

    for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_ALIASES)) {
      if (raw[canonicalKey] !== true && raw[legacyKey] === true) {
        out[canonicalKey] = true;
      }
    }

    const role = String(user && user.role || '').toLowerCase();
    if (STAFF_CORE_ROLES.includes(role)) {
      for (const key of STAFF_CORE_PERMISSIONS) out[key] = true;
    }

    if (role === 'admin') {
      for (const key of KEYS) out[key] = true;
    }

    return out;
  }

  function has(access, key, user) {
    if (!KEYS.includes(key)) return false;
    return normalize(access, user)[key] === true;
  }

  window.DivergentPermissions = Object.freeze({
    KEYS,
    EMPTY,
    LEGACY_ALIASES,
    STAFF_CORE_ROLES,
    STAFF_CORE_PERMISSIONS,
    normalize,
    has
  });
})(window);

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

  // Temporary compatibility aliases used only while legacy APIs are migrated.
  // New code must emit canonical keys only.
  const LEGACY_ALIASES = Object.freeze({
    staff_expense: 'staff_expenses',
    staff_payroll: 'payroll'
  });

  function normalize(raw) {
    raw = raw || {};
    const out = { ...EMPTY };

    for (const key of KEYS) out[key] = raw[key] === true;

    for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_ALIASES)) {
      if (raw[canonicalKey] !== true && raw[legacyKey] === true) {
        out[canonicalKey] = true;
      }
    }

    return out;
  }

  function has(access, key) {
    if (!KEYS.includes(key)) return false;
    return normalize(access)[key] === true;
  }

  window.DivergentPermissions = Object.freeze({
    KEYS,
    EMPTY,
    LEGACY_ALIASES,
    normalize,
    has
  });
})(window);

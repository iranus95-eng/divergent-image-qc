/* Divergent Field Tools - clean auth/permission kernel
 * Branch: rebuild-clean-v2
 * Goal: one authenticated identity -> one permission snapshot -> one sidebar render.
 * This module intentionally does not merge permissions from cache, LINE and app sessions.
 */
(function (window) {
  'use strict';

  const FALLBACK_SESSION_KEY = 'divergent_fallback_session_token';
  const MENU_ACCESS_CACHE_KEY = 'divergent_menu_access_cache_v2';
  const MENU_ACCESS_API_URL = 'https://neauzvqroaszvqffahkv.functions.supabase.co/menu-access-api';

  const EMPTY_ACCESS = Object.freeze({
    qc: false,
    claim: false,
    claim_pending: false,
    search: false,
    payroll: false,
    staff_expenses: false,
    user_management: false,
    invoice: false,
    billing: false,
    pnl: false
  });

  let state = {
    status: 'idle',
    authMode: '',
    token: '',
    user: null,
    access: { ...EMPTY_ACCESS },
    confirmed: false,
    error: ''
  };

  function getSessionToken() {
    try { return localStorage.getItem(FALLBACK_SESSION_KEY) || ''; }
    catch (_) { return ''; }
  }

  function clearSessionToken() {
    try { localStorage.removeItem(FALLBACK_SESSION_KEY); } catch (_) {}
  }

  function normalizeAccess(raw) {
    raw = raw || {};
    return {
      qc: !!raw.qc,
      claim: !!raw.claim,
      claim_pending: !!raw.claim_pending,
      search: !!raw.search,
      payroll: !!raw.payroll,
      staff_expenses: !!raw.staff_expenses,
      user_management: !!raw.user_management,
      invoice: !!raw.invoice,
      billing: !!raw.billing,
      pnl: !!raw.pnl
    };
  }

  function snapshot(raw, user, authMode, token) {
    state = {
      status: 'ready',
      authMode: authMode || '',
      token: token || '',
      user: user || null,
      access: normalizeAccess(raw),
      confirmed: true,
      error: ''
    };
    try {
      localStorage.setItem(MENU_ACCESS_CACHE_KEY, JSON.stringify({
        user: state.user,
        access: state.access,
        auth_mode: state.authMode,
        saved_at: Date.now()
      }));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('divergent:permissions', { detail: getState() }));
    return getState();
  }

  function reset(reason) {
    state = {
      status: reason ? 'error' : 'idle',
      authMode: '', token: '', user: null,
      access: { ...EMPTY_ACCESS }, confirmed: false,
      error: reason || ''
    };
    window.dispatchEvent(new CustomEvent('divergent:permissions', { detail: getState() }));
  }

  function getState() {
    return {
      status: state.status,
      authMode: state.authMode,
      user: state.user ? { ...state.user } : null,
      access: { ...state.access },
      confirmed: state.confirmed,
      error: state.error
    };
  }

  async function getLineToken() {
    try {
      if (!window.liff || !liff.isLoggedIn || !liff.isLoggedIn()) return '';
      if (typeof window.getLineAccessToken === 'function') {
        return (await window.getLineAccessToken()) || '';
      }
      return (liff.getAccessToken && liff.getAccessToken()) || '';
    } catch (_) { return ''; }
  }

  async function fetchAccess(token) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(MENU_ACCESS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: '{}',
        signal: ctl.signal
      });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data: j };
    } finally { clearTimeout(timer); }
  }

  async function refresh() {
    state.status = 'loading';
    state.error = '';

    const sessionToken = getSessionToken();
    if (sessionToken) {
      try {
        const result = await fetchAccess(sessionToken);
        if (result.ok && result.data && result.data.access) {
          return snapshot(result.data.access, result.data.user, 'session', sessionToken);
        }
        if (['AUTH_INVALID', 'AUTH_REQUIRED'].includes(result.data && result.data.error)) {
          clearSessionToken();
        } else {
          reset((result.data && result.data.error) || 'SESSION_ACCESS_FAILED');
          return getState();
        }
      } catch (e) {
        reset(e && e.name === 'AbortError' ? 'SESSION_TIMEOUT' : 'SESSION_ACCESS_FAILED');
        return getState();
      }
    }

    const lineToken = await getLineToken();
    if (lineToken) {
      try {
        const result = await fetchAccess(lineToken);
        if (result.ok && result.data && result.data.access) {
          return snapshot(result.data.access, result.data.user, 'line', lineToken);
        }
        reset((result.data && result.data.error) || 'LINE_ACCESS_FAILED');
        return getState();
      } catch (e) {
        reset(e && e.name === 'AbortError' ? 'LINE_TIMEOUT' : 'LINE_ACCESS_FAILED');
        return getState();
      }
    }

    reset('AUTH_REQUIRED');
    return getState();
  }

  function can(key) {
    return !!(state.confirmed && state.access[key]);
  }

  function requireAccess(key, label) {
    if (can(key)) return true;
    if (!state.confirmed) {
      alert('ยังไม่สามารถยืนยันสิทธิ์ผู้ใช้งานได้ กรุณาเข้าสู่ระบบใหม่');
      return false;
    }
    alert('บัญชีนี้ยังไม่ได้รับสิทธิ์เข้า ' + (label || key));
    return false;
  }

  function clearAll() {
    clearSessionToken();
    try { localStorage.removeItem(MENU_ACCESS_CACHE_KEY); } catch (_) {}
    reset('');
  }

  window.DivergentAuth = Object.freeze({
    refresh,
    getState,
    can,
    requireAccess,
    clearAll,
    normalizeAccess
  });
})(window);

(function(){
  function loadEmployeeAdvanceModule(){
    if(document.querySelector('script[data-divergent-employee-advance]'))return;
    const s=document.createElement('script');
    s.src='js/employee-advance.js?v=20260908-1';
    s.async=false;
    s.setAttribute('data-divergent-employee-advance','1');
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadEmployeeAdvanceModule,{once:true});
  else loadEmployeeAdvanceModule();
})();

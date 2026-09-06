/* Divergent V3 - single-source auth/session kernel */
(function (window) {
  'use strict';

  const SESSION_KEY = 'divergent_session_token_v3';
  const LEGACY_SESSION_KEYS = Object.freeze([
    'divergent_web_session_token_v1',
    'divergent_fallback_session_token'
  ]);
  const ACCESS_URL = 'https://neauzvqroaszvqffahkv.functions.supabase.co/menu-access-v3';

  let state = {
    status: 'idle',
    authMode: '',
    token: '',
    user: null,
    access: null,
    confirmed: false,
    error: ''
  };

  function cloneState() {
    return {
      status: state.status,
      authMode: state.authMode,
      user: state.user ? { ...state.user } : null,
      access: state.access ? { ...state.access } : null,
      confirmed: state.confirmed,
      error: state.error
    };
  }

  function emit() {
    if (window.DivergentEvents) window.DivergentEvents.emit('auth:changed', cloneState());
    window.dispatchEvent(new CustomEvent('divergent:v3:auth', { detail: cloneState() }));
  }

  function writeToken(token) {
    try {
      if (token) localStorage.setItem(SESSION_KEY, token);
      else localStorage.removeItem(SESSION_KEY);
      for (const key of LEGACY_SESSION_KEYS) localStorage.removeItem(key);
    } catch (_) {}
  }

  function readToken() {
    try {
      const canonical = localStorage.getItem(SESSION_KEY) || '';
      if (canonical) return canonical;

      for (const key of LEGACY_SESSION_KEYS) {
        const legacy = localStorage.getItem(key) || '';
        if (legacy) {
          localStorage.setItem(SESSION_KEY, legacy);
          for (const other of LEGACY_SESSION_KEYS) localStorage.removeItem(other);
          return legacy;
        }
      }
    } catch (_) {}
    return '';
  }

  async function getLineToken() {
    try {
      if (!window.liff || !liff.isLoggedIn || !liff.isLoggedIn()) return '';
      if (typeof window.getLineAccessToken === 'function') {
        return (await window.getLineAccessToken()) || '';
      }
      return (liff.getAccessToken && liff.getAccessToken()) || '';
    } catch (_) {
      return '';
    }
  }

  function setReady(payload, authMode, token) {
    const normalizer = window.DivergentPermissions && window.DivergentPermissions.normalize;
    state = {
      status: 'ready',
      authMode: authMode || '',
      token: token || '',
      user: payload && payload.user ? payload.user : null,
      access: normalizer ? normalizer(payload && payload.access) : (payload && payload.access ? payload.access : {}),
      confirmed: true,
      error: ''
    };
    if (authMode === 'session' && token) writeToken(token);
    emit();
    return cloneState();
  }

  function setError(error) {
    state = {
      status: 'error',
      authMode: '',
      token: '',
      user: null,
      access: window.DivergentPermissions ? { ...window.DivergentPermissions.EMPTY } : {},
      confirmed: false,
      error: error || 'AUTH_ERROR'
    };
    emit();
    return cloneState();
  }

  async function fetchAccess(token) {
    if (!window.DivergentApi) throw new Error('API_CLIENT_NOT_LOADED');
    return window.DivergentApi.request(ACCESS_URL, {
      method: 'POST',
      token,
      json: {},
      timeoutMs: 8000
    });
  }

  async function refresh() {
    state.status = 'loading';
    state.error = '';
    emit();

    const sessionToken = readToken();
    if (sessionToken) {
      const result = await fetchAccess(sessionToken);
      if (result.ok && result.data && result.data.access) {
        return setReady(result.data, 'session', sessionToken);
      }

      const code = result.data && result.data.error;
      if (code === 'AUTH_INVALID' || code === 'AUTH_REQUIRED') {
        writeToken('');
      } else {
        return setError(code || result.error || 'SESSION_ACCESS_FAILED');
      }
    }

    const lineToken = await getLineToken();
    if (lineToken) {
      const result = await fetchAccess(lineToken);
      if (result.ok && result.data && result.data.access) {
        return setReady(result.data, 'line', lineToken);
      }
      return setError((result.data && result.data.error) || result.error || 'LINE_ACCESS_FAILED');
    }

    return setError('AUTH_REQUIRED');
  }

  function getState() {
    return cloneState();
  }

  function can(permissionKey) {
    if (!state.confirmed) return false;
    if (window.DivergentPermissions) return window.DivergentPermissions.has(state.access, permissionKey);
    return !!(state.access && state.access[permissionKey]);
  }

  function clear() {
    writeToken('');
    state = {
      status: 'idle',
      authMode: '',
      token: '',
      user: null,
      access: window.DivergentPermissions ? { ...window.DivergentPermissions.EMPTY } : {},
      confirmed: false,
      error: ''
    };
    emit();
  }

  window.DivergentAuthV3 = Object.freeze({
    SESSION_KEY,
    LEGACY_SESSION_KEYS,
    refresh,
    getState,
    can,
    clear,
    readToken
  });
})(window);

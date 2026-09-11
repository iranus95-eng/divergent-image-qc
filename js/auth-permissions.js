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

/* UI shell v2: wide responsive desktop layout + safe in-app navigation.
 * Authentication and permission logic above is intentionally unchanged.
 */
(function(){
  'use strict';

  const STYLE_ID='divergent-ui-shell-v2';
  const NAV_ID='divergentPageNavV2';
  const navStack=['navHome'];
  let replaying=false;

  function installCss(){
    const old=document.getElementById('divergent-layout-stability-v1');
    if(old) old.remove();
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .main-shell .container,
      body.home-grid5-mode .main-shell .container{
        width:min(1500px,calc(100vw - 48px))!important;
        max-width:1500px!important;
        margin-left:auto!important;
        margin-right:auto!important;
        padding-left:24px!important;
        padding-right:24px!important;
        transform:none!important;
        zoom:1!important;
      }
      #${NAV_ID}{
        position:fixed;left:18px;top:92px;z-index:11050;
        display:flex;gap:8px;align-items:center;
        padding:7px;background:rgba(255,255,255,.94);
        border:1px solid #e2d7f2;border-radius:13px;
        box-shadow:0 7px 22px rgba(49,24,82,.13);
        backdrop-filter:blur(6px);
      }
      #${NAV_ID} button{
        border:1px solid #d9c9ed;background:#fff;color:#4c237b;
        border-radius:9px;padding:9px 12px;font-size:14px;
        font-weight:800;line-height:1;cursor:pointer;white-space:nowrap;
        box-shadow:none;
      }
      #${NAV_ID} button:hover{background:#f5effd;border-color:#bfa3e5}
      @media(max-width:700px){
        .main-shell .container,
        body.home-grid5-mode .main-shell .container{
          width:100%!important;max-width:none!important;
          padding-left:12px!important;padding-right:12px!important;
        }
        #${NAV_ID}{left:8px;right:8px;top:auto;bottom:10px;justify-content:center}
        #${NAV_ID} button{flex:1;padding:11px 8px}
      }
    `;
    document.head.appendChild(style);
  }

  function isHomeVisible(){
    const home=document.getElementById('homeWorkspace');
    if(!home) return false;
    const cs=getComputedStyle(home);
    return cs.display!=='none' && cs.visibility!=='hidden' && !home.hidden;
  }

  function syncHomeScope(){
    if(!document.body) return;
    document.body.classList.toggle('home-grid5-mode',isHomeVisible());
  }

  function triggerNav(id){
    const el=document.getElementById(id);
    if(!el) return false;
    const cs=getComputedStyle(el);
    if(cs.display==='none' || cs.visibility==='hidden') return false;
    replaying=true;
    try{el.click();}finally{setTimeout(function(){replaying=false;syncHomeScope();},0);}
    return true;
  }

  function goHome(){
    navStack.length=1;
    navStack[0]='navHome';
    if(triggerNav('navHome')) return;
    if(typeof window.showHome==='function'){
      try{window.showHome();syncHomeScope();return;}catch(_){}
    }
    const candidate=document.querySelector('.nav-item[data-page="home"],[data-workspace="home"]');
    if(candidate){candidate.click();return;}
    location.replace(location.origin+location.pathname);
  }

  function goBack(){
    if(navStack.length>1){
      navStack.pop();
      const previous=navStack[navStack.length-1];
      if(previous && triggerNav(previous)) return;
    }
    goHome();
  }

  function installNav(){
    if(document.getElementById(NAV_ID)) return;
    const box=document.createElement('div');
    box.id=NAV_ID;
    box.setAttribute('aria-label','การนำทางภายในระบบ');
    box.innerHTML='<button type="button" data-dv-back>← ย้อนกลับ</button><button type="button" data-dv-home>⌂ กลับสู่เมนูหลัก</button>';
    box.querySelector('[data-dv-back]').addEventListener('click',goBack);
    box.querySelector('[data-dv-home]').addEventListener('click',goHome);
    document.body.appendChild(box);
  }

  function trackNavigation(event){
    if(replaying) return;
    const nav=event.target && event.target.closest ? event.target.closest('.nav-item[id]') : null;
    if(!nav || !nav.id || nav.closest('#'+NAV_ID)) return;
    if(nav.id==='navHome'){
      navStack.length=1;
      navStack[0]='navHome';
    }else if(navStack[navStack.length-1]!==nav.id){
      navStack.push(nav.id);
      if(navStack.length>20) navStack.splice(1,navStack.length-20);
    }
    setTimeout(syncHomeScope,0);
  }

  function boot(){
    installCss();
    installNav();
    syncHomeScope();
    document.addEventListener('click',trackNavigation,true);

    const home=document.getElementById('homeWorkspace');
    if(home){
      new MutationObserver(syncHomeScope).observe(home,{attributes:true,attributeFilter:['style','class','hidden']});
    }
    new MutationObserver(function(){
      if(!isHomeVisible() && document.body.classList.contains('home-grid5-mode')){
        document.body.classList.remove('home-grid5-mode');
      }
    }).observe(document.body,{attributes:true,attributeFilter:['class']});

    window.addEventListener('hashchange',syncHomeScope);
    window.addEventListener('popstate',syncHomeScope);
    window.addEventListener('divergent:permissions',function(){setTimeout(syncHomeScope,0);});
    setTimeout(syncHomeScope,100);
    setTimeout(syncHomeScope,900);
    setTimeout(syncHomeScope,2100);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

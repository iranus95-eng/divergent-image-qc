/* System cost calculator: shares the existing admin session; data is loaded by the protected API. */
(function () {
  'use strict';
  function isAdmin() {
    var user = window.currentMenuUser;
    if (!user) {
      try {
        user = JSON.parse(
          localStorage.getItem('divergent_web_session_user') || 'null',
        );
      } catch (_) {
        user = null;
      }
    }
    return String((user && user.role) || '').toLowerCase() === 'admin';
  }
  function sync() {
    var side = document.querySelector('.side-nav');
    if (!side) return;
    var nav = document.getElementById('navSystemCost');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'navSystemCost';
      nav.className = 'nav-item';
      nav.innerHTML =
        '<span class="nav-ico">▦</span><span>คำนวนต้นทุนระบบงาน</span>';
      nav.style.display = 'none';
      nav.addEventListener('click', function () {
        if (isAdmin()) window.location.assign('/system-cost/');
      });
      side.appendChild(nav);
    }
    var display = isAdmin() ? '' : 'none';
    if (nav.style.display !== display) nav.style.display = display;
  }
  function boot() {
    sync();
    var timer;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(sync, 100);
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

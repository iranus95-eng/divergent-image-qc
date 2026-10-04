/* Divergent Image Rescue — Shell A (2026-10-04)
 *
 * One navigation, rendered ONCE after menu permissions settle.
 * - The legacy .side-nav items stay in the DOM and remain the source of truth:
 *   page code keeps showing/hiding them (applyMenuAccess, module scripts) and
 *   their onclick handlers still open each page. This shell only mirrors them.
 * - Nothing here moves or restyles legacy nodes, so no observer can feed back
 *   into another observer (the cause of the old 8-second menu flicker).
 */
(function () {
  'use strict';
  if (window.__shellA) return;
  window.__shellA = true;

  var GROUPS = [
    ['field', 'งานภาคสนาม'],
    ['finance', 'การเงิน'],
    ['docs', 'เอกสาร'],
    ['system', 'ระบบ'],
    ['other', 'อื่น ๆ']
  ];
  // legacy nav id, group, label, description, icon
  var MENU = [
    ['navHome', 'field', 'หน้าหลัก', 'ภาพรวมและเมนูทั้งหมด', 'home'],
    ['navQc', 'field', 'ตรวจสอบงาน', 'ตรวจรูปภาพทีละ Batch', 'qc'],
    ['navSearch', 'field', 'ค้นหาข้อมูล', 'รูปและข้อมูลลูกค้าจากเลข CA', 'search'],
    ['navLocation', 'field', 'ค้นหาพิกัดตำแหน่ง', 'เทียบพิกัดงานกับพิกัดมิเตอร์', 'pin'],
    ['navClaim', 'finance', 'ตั้งเบิกค่าตอบแทน', 'ยอดตั้งเบิก รับแล้ว และค้างรับ', 'claim'],
    ['navClaimPending', 'finance', 'การไฟฟ้าที่ยังเบิกไม่ได้', 'ข้อมูลตั้งเบิกยังไม่ครบ', 'alert'],
    ['navPayroll', 'finance', 'จัดการเงินเดือน', 'ข้อมูลพนักงานและไฟล์ธนาคาร', 'payroll'],
    ['navStaffPayroll', 'finance', 'เงินเดือนสตาฟ', 'ฐานเงินเดือนและประกันสังคม', 'staff'],
    ['navEmployeeAdvance', 'finance', 'พนักงานเบิกเงินล่วงหน้า', 'คำขอและการอนุมัติ', 'advance'],
    ['navStaffExpense', 'finance', 'ค่าใช้จ่าย', 'รอบเบิกวันที่ 3 / 7 / รอบพิเศษ', 'expense'],
    ['navPnL', 'finance', 'กำไร–ขาดทุนรายเดือน', 'รายงานสำหรับผู้บริหาร', 'pl'],
    ['navInvoice', 'docs', 'จัดทำใบตั้งหนี้', 'ใบแจ้งหนี้จากต้นฉบับบริษัท', 'invoice'],
    ['navBilling', 'docs', 'ใบแจ้งหนี้-ใบวางบิล', 'ต้นฉบับและสำเนาพร้อมกัน', 'bill'],
    ['navReceiptTax', 'docs', 'ใบเสร็จรับเงิน-ใบกำกับภาษี', 'ใบเสร็จและใบกำกับภาษี', 'receipt'],
    ['navDocArchive', 'docs', 'เอกสารย้อนหลัง', 'ค้นหา ดู และพิมพ์เอกสารที่บันทึกไว้', 'archive'],
    ['navPaperOrder', 'docs', 'สรุปและสั่งกระดาษ', 'สรุปการใช้และสั่งรอบถัดไป', 'paper'],
    ['navUsers', 'system', 'จัดการผู้ใช้งาน', 'บัญชี บทบาท สิทธิ์ และวันหมดอายุ', 'users'],
    ['navCustomerImport', 'system', 'นำเข้าข้อมูลลูกค้า', 'นำเข้า Excel เข้าฐานลูกค้า', 'import']
  ];
  var TABS = [['navHome', 'หน้าหลัก', 'home'], ['navQc', 'ตรวจงาน', 'qc'], ['navSearch', 'ค้นหา', 'search'], ['navLocation', 'พิกัด', 'pin']];

  var ICON = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    qc: 'M9 12l2 2 4-4M5 3h14v18H5z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
    pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    claim: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
    alert: 'M12 3l10 18H2zM12 10v4M12 17v1',
    payroll: 'M3 7h18v12H3zM3 11h18M7 15h3',
    staff: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M17 8h5M19.5 5.5v5',
    advance: 'M12 3v18M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7',
    expense: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    pl: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
    invoice: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
    bill: 'M5 3h14v18l-2-1-2 1-2-1-2 1-2-1-2 1zM9 9h6M9 13h4',
    receipt: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16l2 1.5L15 14',
    archive: 'M3 7h18v13H3zM3 7l2-4h14l2 4M9 12h6',
    paper: 'M7 3h10v6H7zM5 9h14v8H5zM8 17h8v4H8z',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 3a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5',
    import: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    other: 'M5 12h.01M12 12h.01M19 12h.01',
    menu: 'M4 7h16M4 12h16M4 17h16'
  };

  function svg(name, size) {
    return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICON[name] || ICON.other) + '"></path></svg>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------------------------------------------------------------- state
  var root = document.documentElement;
  var startedAt = Date.now();
  var confirmedAt = 0;      // first time page code committed permissions
  var lastChangeAt = 0;     // last time the visible menu set changed
  var revealed = false;
  var signature = '';
  var active = 'navHome';
  var timer = 0;

  function legacy(id) { return document.getElementById(id); }
  function isShown(el) {
    if (!el) return false;
    if (el.hidden || el.getAttribute('aria-hidden') === 'true' || el.classList.contains('muted')) return false;
    return getComputedStyle(el).display !== 'none';
  }
  function label(el) {
    var spans = el.querySelectorAll('span');
    var t = spans.length ? spans[spans.length - 1].textContent : el.textContent;
    return String(t || '').replace(/\s+/g, ' ').trim();
  }

  // Current visible menu, grouped. Unknown legacy items fall into "อื่น ๆ".
  function collect() {
    var known = {};
    var items = [];
    MENU.forEach(function (m) {
      known[m[0]] = true;
      if (isShown(legacy(m[0]))) items.push({ id: m[0], group: m[1], label: m[2], desc: m[3], icon: m[4] });
    });
    var side = document.querySelector('.side-nav');
    if (side) {
      [].forEach.call(side.querySelectorAll('.nav-item[id]'), function (el) {
        if (known[el.id] || !isShown(el)) return;
        items.push({ id: el.id, group: 'other', label: label(el), desc: '', icon: 'other' });
      });
    }
    return items;
  }

  // ---------------------------------------------------------------- dom
  function userInfo() {
    var u = window.currentMenuUser || null;
    if (!u) { try { u = JSON.parse(localStorage.getItem('divergent_web_session_user') || 'null'); } catch (_) { u = null; } }
    u = u || {};
    var name = u.display_name || u.username || u.line_display_name || '';
    var roleMap = { admin: 'ผู้ดูแลระบบ', user_creator: 'ผู้สร้างผู้ใช้', staff: 'พนักงาน' };
    return { name: name || 'ผู้ใช้งาน', role: roleMap[u.role] || u.role || '' };
  }

  function build() {
    if (document.getElementById('saTop')) return;
    var bar = document.createElement('div');
    bar.id = 'saBar';
    bar.innerHTML = '<button type="button" class="sa-bar-btn" id="saBack">← ย้อนกลับ</button>' +
      '<button type="button" class="sa-bar-btn" id="saHomeBtn">⌂ หน้าหลัก</button>' +
      '<span class="sa-bar-title" id="saBarTitle"></span>';
    bar.querySelector('#saBack').addEventListener('click', goBack);
    bar.querySelector('#saHomeBtn').addEventListener('click', function () { open('navHome'); });
    document.body.appendChild(bar);
    var top = document.createElement('header');
    top.id = 'saTop';
    top.innerHTML =
      '<button type="button" class="sa-btn sa-icon-btn" id="saMenuBtn" aria-label="เปิดเมนู" aria-controls="saSide" aria-expanded="false">' + svg('menu', 20) + '</button>' +
      '<div class="sa-mark" aria-hidden="true">D</div>' +
      '<div class="sa-title"><b>Divergent<span class="sa-hide-xs"> Image Rescue</span></b><span>QC Center</span></div>' +
      '<div class="sa-gap"></div>' +
      '<button type="button" class="sa-btn sa-hide-sm" id="saLineBtn" hidden></button>' +
      '<div class="sa-user"><div class="sa-avatar" id="saAvatar"></div><div class="sa-who"><b id="saName"></b><span id="saRole"></span></div></div>' +
      '<button type="button" class="sa-btn" id="saLogout">ออกจากระบบ</button>';

    var side = document.createElement('nav');
    side.id = 'saSide';
    side.setAttribute('aria-label', 'เมนูหลัก');
    side.innerHTML = '<div class="sa-side-sk" aria-hidden="true">' +
      '<div class="sa-sk" style="height:12px;width:40%"></div><div class="sa-sk" style="height:40px"></div><div class="sa-sk" style="height:40px"></div><div class="sa-sk" style="height:40px"></div>' +
      '<div class="sa-sk" style="height:12px;width:40%;margin-top:12px"></div><div class="sa-sk" style="height:40px"></div><div class="sa-sk" style="height:40px"></div></div>' +
      '<div id="saGroups"></div>';

    var scrim = document.createElement('button');
    scrim.id = 'saScrim';
    scrim.type = 'button';
    scrim.setAttribute('aria-label', 'ปิดเมนู');

    var bottom = document.createElement('nav');
    bottom.id = 'saBottom';
    bottom.setAttribute('aria-label', 'เมนูด่วน');

    var sk = document.createElement('div');
    sk.id = 'saSkeleton';
    sk.setAttribute('aria-live', 'polite');
    sk.innerHTML = '<div class="sa-sk" style="height:28px;width:260px"></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px"><div class="sa-sk" style="height:84px"></div><div class="sa-sk" style="height:84px"></div><div class="sa-sk" style="height:84px"></div><div class="sa-sk" style="height:84px"></div></div>' +
      '<p>กำลังตรวจสิทธิ์การใช้งาน…</p>';

    document.body.appendChild(top);
    document.body.appendChild(side);
    document.body.appendChild(scrim);
    document.body.appendChild(bottom);
    var main = document.querySelector('.main-shell');
    if (main) main.insertBefore(sk, main.firstChild); else document.body.appendChild(sk);

    var home = document.getElementById('homeWorkspace');
    if (home && !document.getElementById('saHome')) {
      var h = document.createElement('div');
      h.id = 'saHome';
      home.insertBefore(h, home.firstChild);
    }

    document.getElementById('saMenuBtn').addEventListener('click', function () { drawer(!root.classList.contains('sa-drawer')); });
    scrim.addEventListener('click', function () { drawer(false); });
    document.getElementById('saLogout').addEventListener('click', function () {
      if (typeof window.logoutFromSystem === 'function') window.logoutFromSystem();
    });
    document.getElementById('saLineBtn').addEventListener('click', function () {
      var b = document.getElementById('topLoginButton');
      if (b) b.click();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('sa-drawer')) drawer(false); });
    // Delegated clicks for every shell button that opens a page.
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-nav]') : null;
      if (!b || !(b.closest('#saSide') || b.closest('#saBottom') || b.closest('#saHome'))) return;
      e.preventDefault();
      open(b.getAttribute('data-nav'));
    });
  }

  function drawer(on) {
    root.classList.toggle('sa-drawer', !!on);
    var btn = document.getElementById('saMenuBtn');
    if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  // Top-level page sections. Some module scripts show their own section but
  // never hide the others, so an old page used to stay visible under the new one.
  function pages() {
    return [].filter.call(document.querySelectorAll('.main-shell [id$="Workspace"]'), function (ws) {
      return !(ws.parentElement && ws.parentElement.closest('[id$="Workspace"]'));
    });
  }
  function visiblePages() {
    return pages().filter(function (ws) { return getComputedStyle(ws).display !== 'none'; });
  }

  // Menus that open as a full-screen overlay instead of a page section.
  var OVERLAYS = ['billingInvoiceV1', 'receiptTaxV1', 'customerImportV1'];
  function closeOverlays() {
    OVERLAYS.forEach(function (i) { var e = document.getElementById(i); if (e) e.remove(); });
  }

  var backStack = [];
  function goBack() {
    var overlayOpen = OVERLAYS.some(function (i) { return document.getElementById(i); });
    var prev = backStack.pop();
    while (prev && prev === active && !overlayOpen) prev = backStack.pop();
    open(prev || 'navHome', true);
  }
  function open(id, fromBack) {
    var el = legacy(id);
    drawer(false);
    if (!el) return;
    if (!fromBack && active && (active !== id || OVERLAYS.some(function (i) { return document.getElementById(i); }))) {
      if (id === 'navHome') backStack = [];
      else { backStack.push(active); if (backStack.length > 30) backStack.shift(); }
    }
    closeOverlays();
    var before = visiblePages();
    setActive(id);
    el.click();               // legacy handler: permission check + show its page (may be async)
    window.scrollTo(0, 0);
    // Once the new page (or overlay) is up, hide whatever the previous menu left visible.
    // Nothing is hidden if the menu refuses to open, so the user never sees a blank page.
    var t0 = Date.now();
    (function check() {
      var fresh = visiblePages().filter(function (ws) { return before.indexOf(ws) < 0; });
      if (fresh.length) {
        before.forEach(function (ws) { if (fresh.indexOf(ws) < 0) ws.style.display = 'none'; });
        return;
      }
      if (OVERLAYS.some(function (i) { return document.getElementById(i); })) return;
      if (Date.now() - t0 < 3000) setTimeout(check, 100);
    })();
  }

  function setActive(id) {
    active = id;
    var item = MENU.filter(function (m) { return m[0] === id; })[0];
    var t = document.getElementById('saBarTitle'); if (t) t.textContent = item ? item[2] : '';
    root.classList.toggle('sa-has-bar', id !== 'navHome');
    [].forEach.call(document.querySelectorAll('#saSide [data-nav], #saBottom [data-nav]'), function (b) {
      if (b.getAttribute('data-nav') === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    var tabMenu = document.getElementById('saTabMenu');
    if (tabMenu) {
      var inTabs = TABS.some(function (t) { return t[0] === id; });
      if (inTabs) tabMenu.removeAttribute('aria-current'); else tabMenu.setAttribute('aria-current', 'page');
    }
  }

  function renderUser() {
    var u = userInfo();
    var n = document.getElementById('saName'); if (n) n.textContent = u.name;
    var r = document.getElementById('saRole'); if (r) r.textContent = u.role;
    var a = document.getElementById('saAvatar'); if (a) a.textContent = (u.name || '?').slice(0, 2).toUpperCase();
    var lb = document.getElementById('topLoginButton');
    var mine = document.getElementById('saLineBtn');
    if (mine) {
      var txt = lb ? String(lb.textContent || '').trim() : '';
      mine.hidden = !txt;
      mine.textContent = txt;
    }
  }

  function render(items) {
    var groups = document.getElementById('saGroups');
    if (!groups) return;
    var html = '';
    GROUPS.forEach(function (g) {
      var list = items.filter(function (i) { return i.group === g[0]; });
      if (!list.length) return;
      html += '<div class="sa-group"><div class="sa-group-label">' + esc(g[1]) + '</div>';
      list.forEach(function (i) {
        html += '<button type="button" class="sa-nav" data-nav="' + esc(i.id) + '">' + svg(i.icon) + '<span>' + esc(i.label) + '</span></button>';
      });
      html += '</div>';
    });
    groups.innerHTML = html;

    var shown = {};
    items.forEach(function (i) { shown[i.id] = true; });
    var tabs = TABS.filter(function (t) { return shown[t[0]]; }).map(function (t) {
      return '<button type="button" class="sa-tab" data-nav="' + t[0] + '">' + svg(t[2], 22) + '<span>' + esc(t[1]) + '</span></button>';
    }).join('');
    tabs += '<button type="button" class="sa-tab" id="saTabMenu" aria-controls="saSide">' + svg('menu', 22) + '<span>เมนูทั้งหมด</span></button>';
    var bottom = document.getElementById('saBottom');
    bottom.innerHTML = tabs;
    document.getElementById('saTabMenu').addEventListener('click', function () { drawer(!root.classList.contains('sa-drawer')); });

    var home = document.getElementById('saHome');
    if (home) {
      var u = userInfo();
      var cards = '';
      GROUPS.forEach(function (g) {
        var list = items.filter(function (i) { return i.group === g[0] && i.id !== 'navHome'; });
        if (!list.length) return;
        cards += '<section><h2>' + esc(g[1]) + '</h2><div class="sa-cards">';
        list.forEach(function (i) {
          cards += '<button type="button" class="sa-card" data-nav="' + esc(i.id) + '"><span class="sa-card-ico">' + svg(i.icon, 22) + '</span><span><b>' + esc(i.label) + '</b>' + (i.desc ? '<span>' + esc(i.desc) + '</span>' : '') + '</span></button>';
        });
        cards += '</div></section>';
      });
      home.innerHTML = '<div><h1>สวัสดี ' + esc(u.name) + '</h1><p class="sa-sub">เลือกเมนูที่ต้องการทำงาน</p></div>' + cards;
    }
    renderUser();
    setActive(active);
  }

  // ---------------------------------------------------------------- settle & reveal
  // Reveal once: after page code has committed permissions AND the visible set
  // has been quiet for QUIET ms (late module scripts add their own nav items),
  // capped at MAX_WAIT ms after the commit. HARD_TIMEOUT covers offline/errors.
  var QUIET = 350, MAX_WAIT = 2500, HARD_TIMEOUT = 7000;

  function confirmed() {
    if (confirmedAt) return true;
    try { if (typeof menuAccessConfirmed !== 'undefined' && menuAccessConfirmed) { confirmedAt = Date.now(); return true; } } catch (_) {}
    return false;
  }

  function tick() {
    timer = 0;
    var items = collect();
    var sig = items.map(function (i) { return i.id; }).join('|');
    var now = Date.now();
    if (sig !== signature) { signature = sig; lastChangeAt = now; if (revealed) render(items); }
    if (!revealed) {
      var ready = confirmed() && ((now - lastChangeAt >= QUIET) || (now - confirmedAt >= MAX_WAIT));
      if (ready || now - startedAt >= HARD_TIMEOUT) {
        render(items);
        revealed = true;
        root.classList.remove('shell-pending');
        root.setAttribute('data-shell', 'ready');
      } else {
        schedule(100);
      }
    }
  }
  function schedule(ms) { if (!timer) timer = setTimeout(tick, ms || 0); }

  // Hook the page's own permission functions (global function declarations).
  function wrap(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__shellA) return;
    var w = function () {
      var r = orig.apply(this, arguments);
      if (name === 'commitMenuAccess' && r !== false && !confirmedAt) confirmedAt = Date.now();
      schedule(30);
      return r;
    };
    w.__shellA = true;
    window[name] = w;
  }

  // Legacy pop-ups (history, KBank, confirm dialogs...) use z-index ~10000-20000, below the shell bars.
  // Lift any visible fixed full-screen layer above the shell. Billing/receipt/import are pages, not pop-ups.
  var PAGE_OVERLAYS = { billingInvoiceV1: 1, receiptTaxV1: 1, customerImportV1: 1 };
  var liftTimer = 0;
  function liftOverlays() {
    liftTimer = 0;
    var vw = window.innerWidth, vh = window.innerHeight;
    var cands = document.querySelectorAll('body > *, [class*="overlay"], [class*="modal"], [id$="Overlay"], [id$="Modal"]');
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (PAGE_OVERLAYS[el.id] || /^sa/.test(el.id || '') || el.id === 'daViewer' || el.id === 'daToast') continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (r.width < vw * 0.9 || r.height < vh * 0.9) continue;
      if ((parseInt(cs.zIndex, 10) || 0) < 2147482500) el.style.setProperty('z-index', '2147482500', 'important');
    }
  }
  function scheduleLift() { if (!liftTimer) liftTimer = setTimeout(liftOverlays, 30); }

  function watch() {
    new MutationObserver(scheduleLift).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'open'] });
    var side = document.querySelector('.side-nav');
    if (side) {
      // Legacy nav: items added/removed or shown/hidden -> recheck (we never write to it).
      new MutationObserver(function (muts) {
        var activeMoved = false;
        muts.forEach(function (m) { if (m.type === 'attributes' && m.attributeName === 'class') activeMoved = true; });
        if (activeMoved) {
          var a = side.querySelector('.nav-item.active[id]');
          if (a && a.id !== active) setActive(a.id);
        }
        schedule(30);
      }).observe(side, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'] });
    }
    var lb = document.getElementById('topLoginButton');
    if (lb) new MutationObserver(renderUser).observe(lb, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', function () { if (window.innerWidth > 860) drawer(false); });
  }

  // ---- readable text: legacy module pages use 9–13px. Tag on-screen text under 14px with .sa-fz (15px).
  // Only ever enlarges; skips document papers / PDF pages so invoices and receipts render exactly as before.
  var PAPER = /paper|pdf|a4|print-?page|preview/i;
  var fzOk = typeof WeakSet === 'function' ? new WeakSet() : { has: function () { return false; }, add: function () {} };
  var FZ_SCOPES = '.main-shell .container, .main-shell > [id$="Workspace"], #billingInvoiceV1, #receiptTaxV1, #customerImportV1';
  function inPaper(el, root) {
    for (var n = el; n && n !== root; n = n.parentElement) {
      var c = typeof n.className === 'string' ? n.className : '';
      if (c && PAPER.test(c)) return true;
      if (n.id && PAPER.test(n.id)) return true;
    }
    return false;
  }
  function hasOwnText(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && /\S/.test(c.nodeValue)) return true;
    return false;
  }
  function readable() {
    fzTimer = 0;
    var roots = document.querySelectorAll(FZ_SCOPES);
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r];
      if (!root.getClientRects().length) continue;
      var els = root.querySelectorAll('*:not(.sa-fz)');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], tag = el.tagName;
        if (fzOk.has(el)) continue;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION' || el.closest('svg')) continue;
        if (!(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || hasOwnText(el))) continue;
        if (!el.getClientRects().length) continue;
        if (parseFloat(getComputedStyle(el).fontSize) >= 14 || inPaper(el, root)) { fzOk.add(el); continue; }
        el.classList.add('sa-fz');
        // inline !important: legacy rules use !important with id selectors, a class cannot win
        el.style.setProperty('font-size', el.tagName === 'TH' ? '14px' : '15px', 'important');
      }
    }
  }
  var fzTimer = 0;
  function scheduleReadable() {
    if (fzTimer) return;
    fzTimer = setTimeout(function () {
      (window.requestIdleCallback || function (f) { f(); })(readable, { timeout: 400 });
    }, 200);
  }

  function boot() {
    build();
    wrap('applyMenuAccess');
    wrap('commitMenuAccess');
    watch();
    schedule(0);
    new MutationObserver(scheduleReadable).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    scheduleReadable();
    // printing uses the legacy print styles untouched
    window.addEventListener('beforeprint', function () {
      var t = document.querySelectorAll('.sa-fz');
      for (var i = 0; i < t.length; i++) { t[i].classList.remove('sa-fz'); t[i].style.removeProperty('font-size'); }
    });
    window.addEventListener('afterprint', scheduleReadable);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

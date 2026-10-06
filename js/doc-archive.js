/* Divergent document archive (2026-10-04)
 * - Saves every ใบตั้งหนี้ / ใบแจ้งหนี้-ใบวางบิล / ใบเสร็จ-ใบกำกับภาษี to Supabase (document-archive-api)
 *   when the user presses บันทึก, พิมพ์, บันทึก PDF or LINE in that menu.
 * - "เอกสารย้อนหลัง" page: search, view/print the saved copy, reopen it for editing, delete.
 * The saved copy is a snapshot of the preview paper plus the CSS rules that style it, so it looks
 * exactly as it did when it was printed, even if the form or template changes later.
 */
(function () {
  'use strict';
  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/document-archive-api';
  var TYPE_LABEL = { invoice: 'ใบตั้งหนี้', billing: 'ใบแจ้งหนี้-ใบวางบิล', receipt: 'ใบเสร็จรับเงิน-ใบกำกับภาษี' };
  var TYPE_NAV = { invoice: 'navInvoice', billing: 'navBilling', receipt: 'navReceiptTax' };
  var numbersCache = { invoice: [], billing: [], receipt: [] };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function money(v) { return Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function val(el) { return el ? String(el.value || '').trim() : ''; }
  function thDate(iso) {
    if (!iso) return '-';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d) ? String(iso) : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // "30 มกราคม 2568" / "1 ก.ค. 69" / "2026-07-01" -> "2026-07-01"
  var TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var TH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function isoDate(text) {
    var s = String(text || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var m = s.match(/^(\d{1,2})\s*([^\s\d]+)\s*(\d{2,4})$/);
    if (!m) return null;
    var mon = TH_MONTHS.indexOf(m[2]); if (mon < 0) mon = TH_SHORT.indexOf(m[2]); if (mon < 0) mon = TH_SHORT.indexOf(m[2] + '.');
    if (mon < 0) return null;
    var y = Number(m[3]); if (y < 100) y += 2500; if (y > 2400) y -= 543;
    var d = Number(m[1]);
    return y + '-' + String(mon + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  async function token() {
    try { if (typeof window.getBestDataToken === 'function') { var t = await window.getBestDataToken(); if (t) return t; } } catch (_) {}
    try { return localStorage.getItem('divergent_web_session_token_v1') || localStorage.getItem('divergent_fallback_session_token') || ''; } catch (_) { return ''; }
  }
  async function call(body) {
    var t = await token();
    if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.code = j.error; e.status = r.status; throw e; }
    return j;
  }

  // ---------- snapshot: paper html + only the CSS rules that style it ----------
  function stripPseudo(sel) { return sel.replace(/::?(before|after|first-line|first-letter|placeholder|marker|selection|-webkit-[a-z-]+)/g, ''); }
  function cssFor(papers) {
    var out = [], links = [];
    function hits(sel) {
      try { sel = stripPseudo(sel); return papers.some(function (p) { return p.matches(sel) || p.querySelector(sel); }); } catch (_) { return false; }
    }
    function walk(rules) {
      var acc = [];
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.type === 1) { if (hits(r.selectorText)) acc.push(r.cssText); }
        else if (r.type === 4) { var inner = walk(r.cssRules); if (inner.length) acc.push('@media ' + r.conditionText + '{' + inner.join('\n') + '}'); }
        else if (r.type === 12) { var sup = walk(r.cssRules); if (sup.length) acc.push('@supports ' + r.conditionText + '{' + sup.join('\n') + '}'); }
        else if (r.type === 5 || r.type === 6) acc.push(r.cssText); // @font-face, @page
      }
      return acc;
    }
    for (var s = 0; s < document.styleSheets.length; s++) {
      var sheet = document.styleSheets[s], rules = null;
      try { rules = sheet.cssRules; } catch (_) { if (sheet.href) links.push(sheet.href); continue; }
      if (rules) out = out.concat(walk(rules));
    }
    return { css: out.join('\n'), links: links };
  }
  function snapshot(papers, title) {
    papers = papers.filter(Boolean);
    if (!papers.length) throw new Error('ไม่พบตัวอย่างเอกสาร');
    var c = cssFor(papers);
    // recreate the ancestor chain (id + class only) so selectors like "#billingInvoiceV1 .bi-paper" still apply
    var chain = [], a = papers[0].parentElement;
    while (a && a !== document.body && a !== document.documentElement) { chain.unshift(a); a = a.parentElement; }
    var cs = getComputedStyle(papers[0].parentElement || papers[0]);
    var open = chain.map(function (el, i) {
      var style = i === chain.length - 1 ? ' style="font-family:' + esc(cs.fontFamily) + ';color:' + esc(cs.color) + ';font-size:' + esc(cs.fontSize) + ';line-height:' + esc(cs.lineHeight) + '"' : '';
      return '<' + el.tagName.toLowerCase() + (el.id ? ' id="' + esc(el.id) + '"' : '') + (el.className && typeof el.className === 'string' ? ' class="' + esc(el.className) + '"' : '') + style + '>';
    }).join('');
    var close = chain.slice().reverse().map(function (el) { return '</' + el.tagName.toLowerCase() + '>'; }).join('');
    var body = papers.map(function (p) {
      var k = p.cloneNode(true);
      k.style.transform = ''; k.style.zoom = ''; k.style.transformOrigin = ''; k.classList.remove('sa-fz');
      k.querySelectorAll('.sa-fz').forEach(function (x) { x.classList.remove('sa-fz'); x.style.removeProperty('font-size'); });
      return k.outerHTML;
    }).join('');
    return '<!doctype html><html lang="th"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<base href="' + esc(location.origin + location.pathname.replace(/[^/]*$/, '')) + '">' +
      c.links.map(function (h) { return '<link rel="stylesheet" href="' + esc(h) + '">'; }).join('') +
      '<style>' + c.css.replace(/<\/style/gi, '<\\/style') + '</style>' +
      '<style>html,body{margin:0;background:#e9e6f0}.arch-stage{padding:24px 0;display:flex;justify-content:center}' +
      '.arch-stage>*{display:flex!important;flex-direction:column!important;align-items:center!important;gap:24px!important;position:static!important;inset:auto!important;width:auto!important;height:auto!important;overflow:visible!important;transform:none!important;background:transparent!important;padding:0!important;margin:0!important;box-shadow:none!important;border:0!important}' +
      '@media print{html,body{background:#fff}body *{visibility:visible!important}.arch-stage{padding:0}.arch-stage>*{gap:0!important}}</style>' +
      '</head><body><div class="arch-stage">' + open + body + close + '</div></body></html>';
  }

  // ---------- adapters for the three document menus ----------
  function sumItems(items, field) { return (items || []).reduce(function (s, x) { return s + (field === 'amount' ? num(x.amount) : num(x.qty) * num(x.rate)); }, 0); }
  var ADAPTERS = {
    invoice: {
      root: function () { return document.getElementById('invoiceWorkspace'); },
      papers: function (root) { return [root.querySelector('#invoicePaper')]; },
      meta: function (root) {
        var fields = {};
        root.querySelectorAll('input[id],select[id],textarea[id]').forEach(function (el) { if (!el.closest('#invItemInputs')) fields[el.id] = el.value; });
        var items = null; try { if (typeof invoiceItems !== 'undefined') items = JSON.parse(JSON.stringify(invoiceItems)); } catch (_) {} // eslint-disable-line no-undef
        var cust = document.getElementById('invCustomer');
        return {
          doc_no: val(document.getElementById('invNo')),
          doc_date: isoDate(val(document.getElementById('invDateText'))),
          customer_name: (document.getElementById('pInvCustomer') || {}).textContent || (cust && cust.selectedOptions[0] ? cust.selectedOptions[0].textContent : ''),
          total_amount: num((document.getElementById('pInvGrand') || {}).textContent),
          state: { fields: fields, items: items, customer_text: cust && cust.selectedOptions[0] ? cust.selectedOptions[0].textContent : '' }
        };
      },
      bar: function (root) { return root.querySelector('.invoice-actions'); },
      triggers: function (root) { return [].slice.call(root.querySelectorAll('.invoice-actions button')).filter(function (b) { return /printInvoiceA4|downloadInvoicePdf|shareInvoiceToLine/.test(b.getAttribute('onclick') || ''); }); }
    },
    billing: {
      root: function () { return document.getElementById('billingInvoiceV1'); },
      papers: function (root) { return [].slice.call(root.querySelectorAll('.bi-preview-wrap .bi-paper')); },
      meta: function (root) {
        var s = readJSON('divergent_billing_invoice_v1') || {};
        var q = function (n) { return val(root.querySelector('[name="' + n + '"]')); };
        var sub = sumItems(s.items && s.items.length ? s.items : [s]);
        return { doc_no: q('docNo') || s.docNo, doc_date: q('date') || s.date, customer_name: q('customer') || s.customer, total_amount: Math.round(sub * 1.07 * 100) / 100, state: s };
      },
      bar: function (root) { return root.querySelector('.bi-actions'); },
      triggers: function (root) { return [root.querySelector('#biSave'), root.querySelector('#biPrint')].filter(Boolean); },
      manual: '#biSave'
    },
    receipt: {
      root: function () { return document.getElementById('receiptTaxV1'); },
      papers: function (root) { return [].slice.call(root.querySelectorAll('.rt-preview-wrap .rt-paper')); },
      meta: function (root) {
        var s = readJSON('divergent_receipt_tax_invoice_v1') || {};
        var q = function (n) { return val(root.querySelector('[name="' + n + '"]')); };
        var sub = sumItems(s.items, 'amount');
        return { doc_no: q('receiptNo') || s.receiptNo, doc_date: q('receiptDate') || s.receiptDate, customer_name: q('customer') || s.customer, total_amount: Math.round(sub * 1.07 * 100) / 100, state: s };
      },
      bar: function (root) { return root.querySelector('.rt-actions'); },
      triggers: function (root) { return [root.querySelector('#rtSave'), root.querySelector('#rtPrint')].filter(Boolean); },
      manual: '#rtSave'
    }
  };

  // ---------- toast ----------
  function toast(msg, kind) {
    var t = document.getElementById('daToast');
    if (!t) { t = document.createElement('div'); t.id = 'daToast'; document.body.appendChild(t); }
    t.className = 'da-toast ' + (kind || ''); t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, kind === 'err' ? 6000 : 3500);
  }

  // ---------- save ----------
  // mode 'print': overwrite silently (the printed copy is the final one); 'manual': ask before replacing
  async function archive(type, html, mode) {
    var a = ADAPTERS[type], root = a.root();
    if (!root) return;
    var m = a.meta(root);
    if (!m.doc_no) { toast('ยังไม่ได้บันทึกเข้าระบบ: กรุณากรอกเลขที่เอกสาร', 'err'); return; }
    var payload = { action: 'save', doc_type: type, doc_no: m.doc_no, doc_date: m.doc_date, customer_name: m.customer_name, total_amount: m.total_amount, state: m.state, html: html, overwrite: mode === 'print' };
    try {
      var r;
      try { r = await call(payload); }
      catch (e) {
        if (e.code !== 'DOC_NO_EXISTS') throw e;
        if (!confirm(TYPE_LABEL[type] + ' เลขที่ ' + m.doc_no + ' มีในระบบแล้ว\n\nต้องการบันทึกทับฉบับเดิมหรือไม่?')) { toast('ยังไม่ได้บันทึกเข้าระบบ'); return; }
        payload.overwrite = true; r = await call(payload);
      }
      if (numbersCache[type].indexOf(m.doc_no) < 0) numbersCache[type].unshift(m.doc_no);
      toast((r.replaced ? 'อัปเดต' : 'บันทึก') + TYPE_LABEL[type] + ' เลขที่ ' + m.doc_no + ' เข้าระบบแล้ว ✓', 'ok');
    } catch (e) {
      toast('บันทึกเอกสารเข้าระบบไม่สำเร็จ: ' + (e.message || e), 'err');
    }
  }
  function capture(type) {
    var a = ADAPTERS[type], root = a.root();
    if (!root) return null;
    var m = a.meta(root);
    return snapshot(a.papers(root), TYPE_LABEL[type] + ' ' + (m.doc_no || ''));
  }
  function bind(type) {
    var a = ADAPTERS[type], root = a.root();
    if (!root || !a.bar(root)) return;
    a.triggers(root).forEach(function (b) {
      if (b.dataset.daBound) return;
      b.dataset.daBound = '1';
      // capture phase: take the snapshot before the module's own handler (PDF export may rescale the paper)
      b.addEventListener('click', function () {
        var html; try { html = capture(type); } catch (e) { toast('บันทึกเอกสารเข้าระบบไม่สำเร็จ: ' + e.message, 'err'); return; }
        var mode = a.manual && b.matches(a.manual) ? 'manual' : 'print';
        // let the module save its own state first
        setTimeout(function () { archive(type, html, mode); }, 50);
      }, true);
    });
    var bar = a.bar(root);
    if (type === 'invoice' && !bar.querySelector('.da-save')) {
      var sv = document.createElement('button');
      sv.type = 'button'; sv.className = 'invoice-small-btn da-save'; sv.textContent = '💾 บันทึกเข้าระบบ';
      sv.addEventListener('click', function () { var html; try { html = capture('invoice'); } catch (e) { toast(e.message, 'err'); return; } archive('invoice', html, 'manual'); });
      bar.insertBefore(sv, bar.firstChild);
    }
    if (!bar.querySelector('.da-open')) {
      var ob = document.createElement('button');
      ob.type = 'button';
      ob.className = (type === 'billing' ? 'bi-btn secondary' : type === 'receipt' ? 'rt-btn secondary' : 'invoice-small-btn') + ' da-open';
      ob.textContent = '📂 เอกสารย้อนหลัง';
      ob.addEventListener('click', function () {
        if (type !== 'invoice') { var r = a.root(); if (r) r.remove(); }
        go(type);
      });
      bar.insertBefore(ob, bar.firstChild);
    }
  }
  function scan() { bind('invoice'); bind('billing'); bind('receipt'); }

  // ---------- archive page ----------
  var pageState = { type: '', search: '', from: '', to: '', docs: [], loading: false };
  function ensureNav() {
    var side = document.querySelector('.side-nav');
    if (!side || document.getElementById('navDocArchive')) return;
    var nav = document.createElement('div');
    nav.className = 'nav-item'; nav.id = 'navDocArchive'; nav.style.display = 'none';
    nav.innerHTML = '<span class="nav-ico">📂</span><span>เอกสารย้อนหลัง</span>';
    nav.addEventListener('click', function () { showPage(); });
    var ref = document.getElementById('navReceiptTax') || document.getElementById('navBilling') || document.getElementById('navInvoice');
    if (ref) ref.insertAdjacentElement('afterend', nav); else side.appendChild(nav);
    syncNav();
    var mo = new MutationObserver(syncNav);
    ['navInvoice', 'navBilling', 'navReceiptTax'].forEach(function (id) { var el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] }); });
  }
  function shown(id) { var el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none' && !el.hidden; }
  function syncNav() {
    var nav = document.getElementById('navDocArchive'); if (!nav) return;
    var on = shown('navInvoice') || shown('navBilling') || shown('navReceiptTax');
    var want = on ? '' : 'none';
    if (nav.style.display !== want) nav.style.display = want;
  }
  function go(type) {
    pageState.type = type || pageState.type;
    var shellItem = document.querySelector('#saSide [data-nav="navDocArchive"]');
    if (shellItem) shellItem.click(); else showPage();
  }
  function page() {
    var w = document.getElementById('docArchiveWorkspace');
    if (w) return w;
    w = document.createElement('section');
    w.id = 'docArchiveWorkspace'; w.className = 'da-workspace'; w.style.display = 'none';
    w.innerHTML =
      '<div class="da-head"><div><h2>เอกสารย้อนหลัง</h2><p>ใบตั้งหนี้ ใบแจ้งหนี้-ใบวางบิล และใบเสร็จ-ใบกำกับภาษี ที่บันทึกหรือพิมพ์แล้ว</p></div>' +
      '<button type="button" class="da-btn" data-da="reload">↻ รีเฟรช</button></div>' +
      '<div class="da-tabs" role="tablist">' +
      '<button type="button" data-type="">ทั้งหมด</button><button type="button" data-type="invoice">ใบตั้งหนี้</button>' +
      '<button type="button" data-type="billing">ใบแจ้งหนี้-ใบวางบิล</button><button type="button" data-type="receipt">ใบเสร็จ-ใบกำกับภาษี</button></div>' +
      '<div class="da-filters"><input type="search" data-da="search" placeholder="ค้นหาเลขที่เอกสาร หรือชื่อลูกค้า">' +
      '<label>ตั้งแต่ <input type="date" data-da="from"></label><label>ถึง <input type="date" data-da="to"></label></div>' +
      '<div class="da-list" data-da="list"></div>';
    var main = document.querySelector('main.main-shell') || document.querySelector('main') || document.body;
    main.appendChild(w);
    w.addEventListener('click', onPageClick);
    var timer = 0;
    w.querySelector('[data-da="search"]').addEventListener('input', function (e) { pageState.search = e.target.value; clearTimeout(timer); timer = setTimeout(load, 350); });
    w.querySelector('[data-da="from"]').addEventListener('change', function (e) { pageState.from = e.target.value; load(); });
    w.querySelector('[data-da="to"]').addEventListener('change', function (e) { pageState.to = e.target.value; load(); });
    return w;
  }
  function showPage() {
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navDocArchive'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    document.documentElement.classList.add('sa-wide');
    window.scrollTo(0, 0);
    load();
  }
  async function load() {
    var w = page(), list = w.querySelector('[data-da="list"]');
    w.querySelectorAll('.da-tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.type === pageState.type); b.setAttribute('aria-selected', b.dataset.type === pageState.type ? 'true' : 'false'); });
    list.innerHTML = '<div class="da-empty">กำลังโหลด...</div>';
    var reqId = (pageState.req = (pageState.req || 0) + 1);
    try {
      var body = { action: 'list', search: pageState.search, from: pageState.from, to: pageState.to };
      if (pageState.type) body.doc_type = pageState.type;
      var j = await call(body);
      if (reqId !== pageState.req) return;
      pageState.docs = j.documents || [];
      pageState.docs.forEach(function (d) { var c = numbersCache[d.doc_type]; if (c && c.indexOf(d.doc_no) < 0) c.push(d.doc_no); });
      renderList();
    } catch (e) {
      if (reqId !== pageState.req) return;
      list.innerHTML = '<div class="da-empty da-err">โหลดเอกสารไม่สำเร็จ: ' + esc(e.message || e) + '</div>';
    }
  }
  function renderList() {
    var list = page().querySelector('[data-da="list"]'), docs = pageState.docs;
    if (!docs.length) {
      list.innerHTML = '<div class="da-empty">' + (pageState.search || pageState.from || pageState.to ? 'ไม่พบเอกสารตามเงื่อนไข' : 'ยังไม่มีเอกสารที่บันทึกไว้<br><small>เอกสารจะถูกเก็บอัตโนมัติเมื่อกด บันทึก / พิมพ์ / บันทึก PDF ในเมนูเอกสาร</small>') + '</div>';
      return;
    }
    list.innerHTML = '<div class="da-count">' + docs.length + ' เอกสาร</div><div class="da-table-wrap"><table class="da-table"><thead><tr>' +
      '<th>เลขที่</th><th>ประเภท</th><th>วันที่เอกสาร</th><th>ลูกค้า</th><th class="da-r">ยอดรวม</th><th>บันทึกล่าสุด</th><th class="da-actions-h">จัดการ</th></tr></thead><tbody>' +
      docs.map(function (d) {
        return '<tr><td><b>' + esc(d.doc_no) + '</b></td><td><span class="da-tag da-' + esc(d.doc_type) + '">' + esc(TYPE_LABEL[d.doc_type] || d.doc_type) + '</span></td>' +
          '<td>' + esc(thDate(d.doc_date)) + '</td><td class="da-cust">' + esc(d.customer_name || '-') + '</td>' +
          '<td class="da-r">' + (d.total_amount == null ? '-' : money(d.total_amount)) + '</td>' +
          '<td class="da-when">' + esc(new Date(d.updated_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })) + (d.updated_by_name ? '<br><small>' + esc(d.updated_by_name) + '</small>' : '') + '</td>' +
          '<td><div class="da-actions"><button type="button" class="da-btn" data-da="view" data-id="' + d.id + '">ดู / พิมพ์</button>' +
          '<button type="button" class="da-btn ghost" data-da="edit" data-id="' + d.id + '">เปิดแก้ไข</button>' +
          '<button type="button" class="da-btn danger" data-da="del" data-id="' + d.id + '">ลบ</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function onPageClick(e) {
    var tab = e.target.closest('.da-tabs button');
    if (tab) { pageState.type = tab.dataset.type || ''; load(); return; }
    var b = e.target.closest('[data-da]'); if (!b) return;
    var act = b.dataset.da, id = Number(b.dataset.id);
    if (act === 'reload') load();
    else if (act === 'view') view(id);
    else if (act === 'edit') edit(id);
    else if (act === 'del') del(id);
  }
  async function getDoc(id) { var j = await call({ action: 'get', id: id }); return j.document; }

  // ---------- viewer ----------
  async function view(id) {
    var v = document.getElementById('daViewer');
    if (!v) {
      v = document.createElement('div'); v.id = 'daViewer';
      v.innerHTML = '<div class="da-v-bar"><b data-dv="title"></b><span class="da-v-gap"></span>' +
        '<button type="button" class="da-btn" data-dv="print">🖨 พิมพ์ / บันทึก PDF</button>' +
        '<button type="button" class="da-btn ghost" data-dv="edit">เปิดแก้ไข</button>' +
        '<button type="button" class="da-btn ghost" data-dv="close">✕ ปิด</button></div><iframe title="เอกสาร" data-dv="frame"></iframe>';
      document.body.appendChild(v);
      v.querySelector('[data-dv="close"]').onclick = function () { v.style.display = 'none'; v.querySelector('iframe').srcdoc = ''; };
      v.querySelector('[data-dv="print"]').onclick = function () { printViewer(v, this); };
      v.querySelector('[data-dv="edit"]').onclick = function () { var d = v._doc; v.style.display = 'none'; if (d) restore(d); };
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && v.style.display === 'flex') v.querySelector('[data-dv="close"]').click(); });
    }
    v.querySelector('[data-dv="title"]').textContent = 'กำลังโหลด...';
    v.style.display = 'flex';
    try {
      var d = await getDoc(id);
      v._doc = d;
      v.querySelector('[data-dv="title"]').textContent = (TYPE_LABEL[d.doc_type] || '') + ' เลขที่ ' + d.doc_no;
      var fr = v.querySelector('iframe');
      // Saved snapshots carry the app's print CSS (`body *{visibility:hidden}` + rules that only re-show the
      // active menu), which makes the archived copy print blank. Override it inside the viewer frame.
      fr.onload = function () {
        try {
          var doc = fr.contentDocument; if (!doc || doc.getElementById('daPrintFix')) return;
          var st = doc.createElement('style'); st.id = 'daPrintFix';
          st.textContent = '@media print{html,body{background:#fff!important;margin:0!important}body *{visibility:visible!important}.no-print,[data-no-print]{display:none!important}}';
          (doc.head || doc.documentElement).appendChild(st);
        } catch (_) {}
      };
      fr.srcdoc = d.html;
    } catch (e) {
      v.style.display = 'none';
      alert('เปิดเอกสารไม่สำเร็จ: ' + (e.message || e));
    }
  }

  // ---------- print: render each page as it looks in the viewer into an A4 PDF ----------
  // Browser printing of the snapshot drops background colours (table header bands) and lets
  // the text reflow past the page, so do what the document menus do: capture each paper
  // with html2canvas and place it on its own A4 page with jsPDF.
  function loadScript(doc, src) {
    return new Promise(function (res, rej) {
      var s = doc.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('โหลดตัวสร้าง PDF ไม่สำเร็จ')); };
      (doc.head || doc.documentElement).appendChild(s);
    });
  }
  function findPapers(doc) {
    var list = doc.querySelectorAll('.bi-paper,.rt-paper,.invoice-paper');
    if (!list.length) { var st = doc.querySelector('.arch-stage'); list = st ? st.firstElementChild.children : []; }
    return Array.prototype.filter.call(list, function (el) {
      return el.getBoundingClientRect().height > 50 && !el.parentElement.closest('.bi-paper,.rt-paper,.invoice-paper');
    });
  }
  async function printViewer(v, btn) {
    var fr = v.querySelector('iframe'), d = v._doc, w = fr.contentWindow, doc = fr.contentDocument;
    if (!doc || !d) return;
    var label = btn.textContent, out = window.open('', '_blank');
    if (out) out.document.write('<p style="font-family:Tahoma,sans-serif;text-align:center;padding:48px">กำลังสร้าง PDF...</p>');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง PDF...';
    try {
      if (!w.html2canvas) await loadScript(doc, 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      if (!w.jspdf) await loadScript(doc, 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
      // ใบแจ้งหนี้-ใบวางบิล snapshots keep the on-screen layout, which runs taller than A4.
      // Apply the billing menu's own A4 print layout while capturing so the PDF matches it.
      var a4 = null;
      if (doc.querySelector('.bi-paper')) {
        var bcss = await billingPrintCss();
        if (bcss) { a4 = doc.createElement('style'); a4.setAttribute('data-da-a4', ''); a4.textContent = bcss; (doc.head || doc.documentElement).appendChild(a4); }
      }
      var papers = findPapers(doc);
      if (!papers.length) throw new Error('ไม่พบหน้าเอกสาร');
      var pdf = new w.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (var i = 0; i < papers.length; i++) {
        var p = papers[i], shadow = p.style.boxShadow;
        p.style.boxShadow = 'none';
        var c = await w.html2canvas(p, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        p.style.boxShadow = shadow;
        // fit the captured page inside A4 (210 x 297 mm), keeping its proportions
        var ratio = c.height / c.width, wmm = 210, hmm = wmm * ratio;
        if (hmm > 297) { hmm = 297; wmm = hmm / ratio; }
        if (i) pdf.addPage('a4', 'portrait');
        pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', (210 - wmm) / 2, 0, wmm, hmm);
      }
      if (a4) a4.remove();
      var url = URL.createObjectURL(pdf.output('blob'));
      if (out) { try { out.location.replace(url); } catch (_) { out.location.href = url; } }
      else { var a = document.createElement('a'); a.href = url; a.download = (d.doc_no || 'document') + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    } catch (e) {
      if (out) out.close();
      alert('สร้าง PDF ไม่สำเร็จ: ' + (e.message || e));
    } finally {
      doc.querySelectorAll('style[data-da-a4]').forEach(function (s) { s.remove(); });
      btn.disabled = false; btn.textContent = label;
    }
  }
  var billingCssCache = null;
  async function billingPrintCss() {
    if (billingCssCache !== null) return billingCssCache;
    try {
      var t = await (await fetch('js/billing-a4-fix.js', { cache: 'no-store' })).text();
      var m = t.match(/const PRINT_CSS=`([\s\S]*?)`;/);
      // drop the page-level html/body sizing: only the paper itself should take the A4 box
      billingCssCache = m ? m[1].replace(/@media print\{[\s\S]*$/, '').replace(/(^|\n)\s*html,body\{[^}]*\}/g, '\n').replace(/(^|\n)\s*body\{[^}]*\}/g, '\n') : '';
      // print in TH SarabunPSK 14pt (headings scaled to match)
      if (billingCssCache) billingCssCache += "\n.bi-paper,.bi-paper *{font-family:'TH SarabunPSK','TH Sarabun New','Sarabun',Tahoma,sans-serif!important}" +
        '.bi-paper,.bi-info,.bi-info-line,.bi-info-line *,.bi-doc-table,.bi-doc-table th,.bi-doc-table td,.bi-total-row,.bi-total-row *{font-size:14pt!important}' +
        '.bi-company b{font-size:18pt!important}.bi-company .en{font-size:16pt!important}.bi-company div,.bi-taxnote,.bi-customer-copy,.bi-title span{font-size:13pt!important}' +
        '.bi-title b{font-size:22pt!important}.bi-notes,.bi-sign,.bi-sign *{font-size:13pt!important}';
    } catch (_) { billingCssCache = ''; }
    return billingCssCache;
  }

  // ---------- reopen in its menu for editing / reprinting ----------
  async function edit(id) {
    try { restore(await getDoc(id)); } catch (e) { alert('เปิดเอกสารไม่สำเร็จ: ' + (e.message || e)); }
  }
  function openMenu(type) {
    var shellItem = document.querySelector('#saSide [data-nav="' + TYPE_NAV[type] + '"]');
    if (shellItem) shellItem.click(); else { var n = document.getElementById(TYPE_NAV[type]); if (n) n.click(); }
  }
  function restore(d) {
    var s = d.state || {};
    if (d.doc_type === 'receipt') {
      try { localStorage.setItem('divergent_receipt_tax_invoice_v1', JSON.stringify(s)); } catch (_) {}
      if (typeof window.openReceiptTaxManagement === 'function') window.openReceiptTaxManagement(s); else openMenu('receipt');
    } else if (d.doc_type === 'billing') {
      try { localStorage.setItem('divergent_billing_invoice_v1', JSON.stringify(s)); } catch (_) {}
      // the billing form pulls customer/number/date from the ใบตั้งหนี้ form when it opens: blank those for a moment
      var ids = ['invAddress', 'invTaxId', 'invNo', 'invDate'], saved = {};
      ids.forEach(function (i) { var el = document.getElementById(i); if (el) { saved[i] = el.value; el.value = ''; } });
      var cust = document.getElementById('invCustomer'), ci = cust ? cust.selectedIndex : -1;
      if (cust) cust.selectedIndex = -1;
      try { if (typeof window.openBillingInvoiceManagement === 'function') window.openBillingInvoiceManagement(); else openMenu('billing'); }
      finally {
        ids.forEach(function (i) { var el = document.getElementById(i); if (el && i in saved) el.value = saved[i]; });
        if (cust) cust.selectedIndex = ci;
      }
    } else if (d.doc_type === 'invoice') {
      openMenu('invoice');
      setTimeout(function () {
        var f = s.fields || {};
        Object.keys(f).forEach(function (k) { var el = document.getElementById(k); if (el && el.closest('#invoiceWorkspace')) el.value = f[k]; });
        try {
          if (Array.isArray(s.items) && typeof invoiceItems !== 'undefined') { invoiceItems.splice.apply(invoiceItems, [0, invoiceItems.length].concat(s.items)); } // eslint-disable-line no-undef
          if (typeof window.renderInvoiceInputs === 'function') window.renderInvoiceInputs();
          if (typeof window.renderInvoicePreview === 'function') window.renderInvoicePreview();
        } catch (e) { console.error('restore invoice', e); }
        toast('เปิดใบตั้งหนี้เลขที่ ' + d.doc_no + ' แล้ว', 'ok');
      }, 400);
    }
  }
  async function del(id) {
    var d = pageState.docs.find(function (x) { return x.id === id; });
    if (!d || !confirm('ลบ' + (TYPE_LABEL[d.doc_type] || 'เอกสาร') + ' เลขที่ ' + d.doc_no + ' ออกจากระบบ?\n\nลบแล้วกู้คืนไม่ได้')) return;
    try { await call({ action: 'delete', id: id }); toast('ลบเอกสารเลขที่ ' + d.doc_no + ' แล้ว', 'ok'); load(); }
    catch (e) { alert('ลบไม่สำเร็จ: ' + (e.message || e)); }
  }

  function style() {
    if (document.getElementById('docArchiveStyle')) return;
    var st = document.createElement('style'); st.id = 'docArchiveStyle';
    st.textContent =
      '#docArchiveWorkspace{max-width:1480px!important;background:#fff;border:1px solid #E4E0EC;border-radius:18px;color:#1C1730}' +
      '.da-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px}.da-head h2{margin:0;font-size:26px}.da-head p{margin:6px 0 0;color:#5F5875;font-size:15px}' +
      '.da-btn{min-height:38px;padding:0 14px!important;border:1px solid #4B2A8C!important;border-radius:10px!important;background:#4B2A8C!important;color:#fff!important;font:inherit;font-size:14px!important;font-weight:600;cursor:pointer;white-space:nowrap;box-shadow:none!important;background-image:none!important;transform:none!important}' +
      '.da-btn.ghost{background:#fff!important;color:#4B2A8C!important;border-color:#D8CFEA!important}.da-btn.danger{background:#fff!important;color:#b91c1c!important;border-color:#fca5a5!important}' +
      '.da-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.da-tabs button{min-height:38px;padding:0 14px!important;border:1px solid #E4E0EC!important;border-radius:999px!important;background:#fff!important;color:#3D3654!important;font:inherit;font-size:14px!important;cursor:pointer;box-shadow:none!important;background-image:none!important;transform:none!important}' +
      '.da-tabs button.active{background:#4B2A8C!important;border-color:#4B2A8C!important;color:#fff!important;font-weight:600}' +
      '.da-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}.da-filters input[type=search]{flex:1 1 280px;min-height:42px;border:1px solid #D8CFEA;border-radius:10px;padding:0 12px;font:inherit;font-size:15px}' +
      '.da-filters label{display:flex;align-items:center;gap:6px;color:#5F5875;font-size:14px}.da-filters input[type=date]{min-height:42px;border:1px solid #D8CFEA;border-radius:10px;padding:0 10px;font:inherit}' +
      '.da-count{color:#5F5875;font-size:14px;margin:0 0 8px}.da-table-wrap{overflow-x:auto;border:1px solid #E4E0EC;border-radius:12px}' +
      '.da-table{width:100%;border-collapse:collapse;min-width:760px}.da-table th,.da-table td{padding:11px 12px;border-bottom:1px solid #EFEBF5;text-align:left;font-size:15px;vertical-align:middle}' +
      '.da-table th{background:#FAF9FC;color:#5F5875;font-size:14px;font-weight:600}.da-table tr:last-child td{border-bottom:0}.da-r{text-align:right!important;white-space:nowrap}' +
      '.da-cust{min-width:200px;max-width:360px}.da-table td:first-child{white-space:normal;max-width:190px;word-break:break-word}.da-table th,.da-table td:nth-child(3){white-space:nowrap}.da-when{white-space:nowrap;color:#5F5875;font-size:13px!important;min-width:96px}.da-actions{display:flex;gap:6px;flex-wrap:nowrap}' +
      '.da-tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:13px;font-weight:600;white-space:nowrap;background:#ECE8F4;color:#4B2A8C}.da-billing{background:#E3F0FF;color:#1d4ed8}.da-receipt{background:#DDF5E6;color:#166534}' +
      '.da-empty{padding:32px;text-align:center;color:#5F5875;border:1px dashed #D8CFEA;border-radius:12px;font-size:15px;line-height:1.6}.da-err{color:#b91c1c}' +
      '#daViewer{position:fixed;inset:0;z-index:2147483000;background:rgba(28,23,48,.6);display:none;flex-direction:column}' +
      '#daViewer .da-v-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;background:#fff;border-bottom:1px solid #E4E0EC;font-family:inherit}#daViewer .da-v-bar b{font-size:16px}.da-v-gap{flex:1}' +
      '#daViewer iframe{flex:1;width:100%;border:0;background:#e9e6f0}' +
      '.da-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483600;background:#1C1730;color:#fff;padding:12px 18px;border-radius:12px;font-size:15px;max-width:min(92vw,560px);box-shadow:0 10px 30px rgba(0,0,0,.25);display:none}' +
      '.da-toast.ok{background:#166534}.da-toast.err{background:#9f1239}' +
      '@media (max-width:860px){.da-toast{bottom:84px}.da-head h2{font-size:22px}}' +
      '@media print{#daViewer,.da-toast{display:none!important}}';
    document.head.appendChild(st);
  }

  window.DocArchive = { open: go, numbers: function (type) { return (numbersCache[type] || []).slice(); }, refreshNumbers: function () { return call({ action: 'list', limit: 300 }).then(function (j) { (j.documents || []).forEach(function (d) { var c = numbersCache[d.doc_type]; if (c && c.indexOf(d.doc_no) < 0) c.push(d.doc_no); }); }).catch(function () {}); } };

  function boot() {
    style(); ensureNav(); scan();
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); scan(); }, 120); }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('divergent:permissions', syncNav);
    setTimeout(function () { window.DocArchive.refreshNumbers(); }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

/* ค้ำประกันสัญญา (2026-11-20)
 * The sites won in ตารางประมูลแจ้งเตือน (notice_bids.status "ชนะประมูล", the 🏆 mark) with the contract
 * guarantee each one needs: หลักประกันสัญญา = 5% of the contract value (the budget, VAT included).
 *  - No data of its own: rows come from notice-bid-api (admin only), so marking 🏆 there adds the site here.
 *  - Main "admin" account only, like ตารางประมูลแจ้งเตือน.
 */
(function () {
  'use strict';
  if (window.__contractGuarantee) return;
  window.__contractGuarantee = true;

  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api';
  var RATE = 0.05;   // หลักประกันสัญญา 5% ของวงเงินตามสัญญา
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var st = { rows: null, err: '', zone: '', q: '' };

  // ---------------------------------------------------------------- pure helpers (also used by tests/contract-guarantee.cjs)
  function lost(r) { return /ไม่ชนะ|แพ้/.test(String(r.status || '')); }
  function won(r) { return String(r.status || '').indexOf('ชนะ') >= 0 && !lost(r); }
  function guarantee(budget) { return budget == null || budget === '' || !isFinite(+budget) ? null : Math.round(+budget * RATE * 100) / 100; }
  function wonRows(rows) {
    return (rows || []).filter(won).sort(function (a, b) {
      return String(a.zone || '~').localeCompare(String(b.zone || '~'), 'th') || ((a.seq == null ? 1e9 : a.seq) - (b.seq == null ? 1e9 : b.seq)) || (a.id - b.id);
    });
  }
  function totals(rows) {
    return rows.reduce(function (t, r) { t.count++; t.budget += +r.budget || 0; t.guarantee += guarantee(r.budget) || 0; return t; }, { count: 0, budget: 0, guarantee: 0 });
  }
  window.ContractGuarantee = { won: won, guarantee: guarantee, wonRows: wonRows, totals: totals };

  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var baht = function (v) { return v == null || v === '' ? '—' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var thDate = function (v) { if (!v) return '—'; var p = String(v).split('-').map(Number); return p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + String(p[0] + 543).slice(-2); };

  // ---------------------------------------------------------------- server
  async function token() {
    try { if (typeof window.getBestDataToken === 'function') { var t = await window.getBestDataToken(); if (t) return t; } } catch (_) {}
    try { return localStorage.getItem('divergent_web_session_token_v1') || localStorage.getItem('divergent_fallback_session_token') || ''; } catch (_) { return ''; }
  }
  async function load() {
    try {
      var t = await token();
      if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ action: 'list' }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error === 'ADMIN_ONLY' ? 'เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)' : (j.error || ('HTTP ' + r.status)));
      st.rows = wonRows(j.items); st.err = '';
    } catch (e) { st.rows = []; st.err = e.message || String(e); }
    render();
  }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('cgStyle')) return;
    var s = document.createElement('style'); s.id = 'cgStyle';
    s.textContent = '.cg-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;flex-wrap:wrap}.cg-head h2{margin:0 0 4px}.cg-head p{margin:0;color:#6b5d7a}' +
      '.cg-btn{border:1px solid #d9cbe8;background:#fff;color:#5a2787;border-radius:9px;padding:8px 12px;font-weight:700;cursor:pointer}.cg-btn:hover{background:#f5effa}' +
      '.cg-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}' +
      '.cg-kpi{background:#fff;border:1px solid #e5dced;border-radius:12px;padding:12px 14px}.cg-kpi span{display:block;font-size:13px;color:#6b5d7a}.cg-kpi b{display:block;font-size:22px;color:#3b2252;font-variant-numeric:tabular-nums}.cg-kpi small{color:#8a7d98;font-size:12px}' +
      '.cg-kpi.gold{background:#fffaf0;border-color:#f0dca0}.cg-kpi.gold b{color:#8a5b00}' +
      '.cg-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.cg-tools select,.cg-tools input{border:1px solid #d9cbe8;border-radius:9px;padding:8px 10px;font:inherit;background:#fff}.cg-tools input{flex:1;min-width:160px}' +
      '.cg-card{background:#fff;border:1px solid #e5dced;border-radius:14px;overflow:hidden}.cg-scroll{overflow:auto}' +
      '.cg-table{width:100%;border-collapse:collapse;font-size:14px;min-width:760px}.cg-table th{background:#f5effa;color:#5a2787;text-align:left;padding:9px 10px;white-space:nowrap;position:sticky;top:0}' +
      '.cg-table td{padding:9px 10px;border-top:1px solid #f0eaf5;vertical-align:top}.cg-table .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.cg-table tfoot td{background:#fbf8fd;font-weight:800;border-top:2px solid #d9cbe8}' +
      '.cg-site{font-weight:700;color:#3b2252}.cg-meta{display:block;font-size:12px;color:#8a7d98;font-weight:400}.cg-g{color:#8a5b00;font-weight:800}' +
      '.cg-note{margin-top:10px;font-size:13px;color:#6b5d7a}.cg-empty{padding:30px;text-align:center;color:#776a86}.cg-err{padding:12px;color:#a13428}' +
      '@media(max-width:640px){.cg-kpis{grid-template-columns:1fr}.cg-kpi b{font-size:19px}}';
    document.head.appendChild(s);
  }
  function page() {
    var w = document.getElementById('contractGuaranteeWorkspace');
    if (w) return w;
    w = document.createElement('section');
    w.id = 'contractGuaranteeWorkspace'; w.style.display = 'none';
    (document.querySelector('main.main-shell') || document.querySelector('main') || document.body).appendChild(w);
    w.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cg]'); if (!b) return;
      var a = b.getAttribute('data-cg');
      if (a === 'reload') { st.rows = null; render(); load(); }
      if (a === 'bids' && typeof window.openNoticeBids === 'function') window.openNoticeBids();
    });
    w.addEventListener('change', function (e) { if (e.target.id === 'cgZone') { st.zone = e.target.value; renderTable(); } });
    w.addEventListener('input', function (e) { if (e.target.id === 'cgQ') { st.q = e.target.value; renderTable(); } });
    return w;
  }
  function visible() {
    var q = st.q.trim().toLowerCase();
    return (st.rows || []).filter(function (r) {
      return (!st.zone || (r.zone || '') === st.zone) && (!q || [r.site, r.office, r.project_no].join(' ').toLowerCase().indexOf(q) >= 0);
    });
  }
  function render() {
    var w = page();
    var zones = Array.from(new Set((st.rows || []).map(function (r) { return r.zone || ''; }))).filter(Boolean).sort();
    w.innerHTML = '<div class="cg-head"><div><h2>🏆 ค้ำประกันสัญญา</h2><p>ไซด์ที่ชนะประมูล ปี 2570 และหลักประกันสัญญาที่ต้องวาง</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cg-btn" data-cg="bids">📊 ตารางประมูลแจ้งเตือน</button><button class="cg-btn" data-cg="reload">↻ รีเฟรช</button></div></div>' +
      '<div class="cg-kpis" id="cgKpis"></div>' +
      '<div class="cg-tools"><select id="cgZone"><option value="">ทุกเขต</option>' + zones.map(function (z) { return '<option' + (z === st.zone ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select>' +
      '<input id="cgQ" placeholder="ค้นหาไซด์ / การไฟฟ้า / เลขที่โครงการ" value="' + esc(st.q) + '"></div>' +
      '<div class="cg-card"><div class="cg-scroll"><table class="cg-table"><thead><tr><th class="n">#</th><th>ไซด์งาน / การไฟฟ้า</th><th>เขต</th><th>วันประมูล</th><th class="n">ราคาที่ชนะ</th><th class="n">วงเงินตามสัญญา</th><th class="n">หลักประกันสัญญา 5%</th></tr></thead>' +
      '<tbody id="cgBody"></tbody><tfoot id="cgFoot"></tfoot></table></div></div>' +
      '<div class="cg-note">ข้อมูลมาจากเมนูตารางประมูลแจ้งเตือน: ไซด์ที่ทำเครื่องหมาย 🏆 ชนะประมูลจะขึ้นที่นี่เอง · หลักประกันสัญญาคิด 5% ของวงเงิน (รวม VAT) เป็นยอดประมาณ ยอดจริงดูตามสัญญาแต่ละฉบับ · วางได้เป็นเงินสด แคชเชียร์เช็ค หรือหนังสือค้ำประกันธนาคาร</div>';
    renderTable();
  }
  function renderTable() {
    var w = page(), body = w.querySelector('#cgBody'); if (!body) return;
    var rows = visible(), t = totals(rows);
    w.querySelector('#cgKpis').innerHTML =
      '<div class="cg-kpi"><span>ไซด์ที่ชนะประมูล</span><b>' + (st.rows == null ? '…' : t.count) + '</b><small>ตามตัวกรอง</small></div>' +
      '<div class="cg-kpi"><span>วงเงินตามสัญญารวม</span><b>' + (st.rows == null ? '…' : baht(t.budget)) + '</b><small>บาท · รวม VAT</small></div>' +
      '<div class="cg-kpi gold"><span>หลักประกันสัญญารวม (5%)</span><b>' + (st.rows == null ? '…' : baht(t.guarantee)) + '</b><small>บาท · เงินที่ต้องเตรียมวางค้ำ</small></div>';
    if (st.rows == null) { body.innerHTML = '<tr><td colspan="7" class="cg-empty">กำลังโหลด…</td></tr>'; w.querySelector('#cgFoot').innerHTML = ''; return; }
    if (st.err) { body.innerHTML = '<tr><td colspan="7" class="cg-err">โหลดไม่สำเร็จ: ' + esc(st.err) + '</td></tr>'; w.querySelector('#cgFoot').innerHTML = ''; return; }
    body.innerHTML = rows.length ? rows.map(function (r, i) {
      var meta = [r.office, r.project_no ? 'โครงการ ' + r.project_no : '', r.doc_no].filter(Boolean).join(' · ');
      return '<tr><td class="n">' + (i + 1) + '</td><td><span class="cg-site">' + esc(r.site || '—') + '</span>' + (meta ? '<span class="cg-meta">' + esc(meta) + '</span>' : '') + (r.note ? '<span class="cg-meta">' + esc(r.note) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.zone || '—') + '</td><td>' + esc(thDate(r.bid_date)) + '</td>' +
        '<td class="n">' + (r.price_bid == null ? '—' : Number(r.price_bid).toFixed(2)) + '</td><td class="n">' + baht(r.budget) + '</td><td class="n cg-g">' + baht(guarantee(r.budget)) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="cg-empty">' + ((st.rows || []).length ? 'ไม่มีไซด์ตามตัวกรองนี้' : 'ยังไม่มีไซด์ที่ทำเครื่องหมาย 🏆 ชนะประมูล') + '</td></tr>';
    w.querySelector('#cgFoot').innerHTML = rows.length ? '<tr><td colspan="5">รวม ' + t.count + ' ไซด์</td><td class="n">' + baht(t.budget) + '</td><td class="n">' + baht(t.guarantee) + '</td></tr>' : '';
  }

  // ---------------------------------------------------------------- menu (main admin account only, like ตารางประมูลแจ้งเตือน)
  function isAdmin() {
    var u = window.currentMenuUser || null;
    if (!u) { try { u = JSON.parse(localStorage.getItem('divergent_web_session_user') || 'null'); } catch (_) { u = null; } }
    var role = (u && u.role) || (window.qcAuthorizedUser && window.qcAuthorizedUser.user_role) || '';
    return String(role).toLowerCase() === 'admin' && String((u && u.username) || '').toLowerCase() === 'admin';
  }
  function syncNav() {
    var nav = document.getElementById('navContractGuarantee'); if (!nav) return;
    var want = isAdmin() ? '' : 'none';
    if (nav.style.display !== want) nav.style.display = want;
  }
  function ensureNav() {
    var side = document.querySelector('.side-nav');
    if (!side || document.getElementById('navContractGuarantee')) return;
    var nav = document.createElement('div');
    nav.className = 'nav-item'; nav.id = 'navContractGuarantee'; nav.style.display = 'none';
    nav.innerHTML = '<span class="nav-ico">🏆</span><span>ค้ำประกันสัญญา</span>';
    nav.addEventListener('click', showPage);
    var ref = document.getElementById('navPaperOrder') || document.getElementById('navNoticeBids');
    if (ref) ref.insertAdjacentElement('afterend', nav); else side.appendChild(nav);
    syncNav();
  }
  function showPage() {
    if (!isAdmin()) { alert('เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    style();
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navContractGuarantee'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    document.documentElement.classList.add('sa-wide');
    window.scrollTo(0, 0);
    st.rows = null; render(); load();   // always fresh: a 🏆 mark may have just changed in ตารางประมูลแจ้งเตือน
  }
  window.openContractGuarantee = showPage;

  function boot() {
    ensureNav();
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); syncNav(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

/* ค้ำประกันสัญญา (2026-11-20)
 * สัญญาจ้างกับการไฟฟ้าส่วนภูมิภาคแต่ละ กฟฟ.: เลขที่สัญญา ลว. ค่าจ้าง เงินค้ำประกัน ระยะเวลา
 * พร้อมสถานะ LG (หนังสือค้ำประกัน) และตราสาร (อากรแสตมป์) — เพิ่ม แก้ไข ซ่อนรายการ และส่งออก Excel ได้
 * ข้อมูลตั้งต้นจากไฟล์ "LG ปี 2570.xlsx" (db/contract-guarantees-seed-2570.sql)
 * ใช้ contract-guarantee-api; เมนูเห็นเฉพาะบัญชี admin หลัก เหมือนเมนูผู้ดูแลอื่น ๆ
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- pure helpers (also used by tests/contract-guarantee.cjs)
  var VAT = 0.07, RATE = 0.05;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // "2027-01-01" -> "1/1/2570" (แบบในไฟล์ Excel)
  function thDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? (+m[3]) + '/' + (+m[2]) + '/' + (+m[1] + 543) : '';
  }
  function period(r) {
    if (!r.period_start && !r.period_end) return '';
    return thDate(r.period_start) + '-' + thDate(r.period_end);
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function money(v) {
    if (v === null || v === undefined || v === '') return '';
    return num(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  // เงินค้ำประกัน 5% ของค่าจ้างรวม VAT ปัดขึ้นเป็นบาท (ตรงกับไฟล์: 302,400 -> 16,179 / 409,200 -> 21,893 / 834,000 -> 44,619)
  function calcGuarantee(wage) {
    var w = num(wage);
    if (!w) return null;
    return Math.ceil(Math.round(w * (1 + VAT) * RATE * 100) / 100 - 1e-9);
  }
  function status(r) {
    if (r.lg_done && r.stamp_done) return 'done';
    return !r.lg_done ? 'nolg' : 'nostamp';
  }
  function matches(r, f) {
    f = f || {};
    if (f.year && String(r.contract_year) !== String(f.year)) return false;
    if (f.state === 'nolg' && r.lg_done) return false;
    if (f.state === 'nostamp' && r.stamp_done) return false;
    if (f.state === 'done' && !(r.lg_done && r.stamp_done)) return false;
    var q = String(f.q || '').trim().toLowerCase();
    if (!q) return true;
    return [r.pea_office, r.contract_no, r.tax_id, r.branch_no, r.address, r.lg_no, r.lg_bank, r.note].join(' ').toLowerCase().indexOf(q) >= 0;
  }
  function totals(list) {
    var t = { count: list.length, guarantee: 0, wage: 0, noLg: 0, noLgAmt: 0, noStamp: 0 };
    list.forEach(function (r) {
      t.guarantee += num(r.guarantee_amount); t.wage += num(r.wage_ex_vat);
      if (!r.lg_done) { t.noLg++; t.noLgAmt += num(r.guarantee_amount); }
      if (!r.stamp_done) t.noStamp++;
    });
    return t;
  }
  var CSV_HEAD = ['ลำดับ', 'ชื่อการไฟฟ้า', 'เลขผู้เสียภาษี', 'สาขาที่', 'ที่อยู่', 'เลขที่สัญญา', 'ลว', 'ค่าจ้าง(ไม่รวมVAT)', 'เงินค้ำประกัน', 'ระยะเวลา', 'LG', 'เลขที่ LG', 'ธนาคาร', 'วันที่ LG', 'ตราสาร', 'วันที่ตราสาร', 'หมายเหตุ'];
  // long digit strings (tax id 0994000165501, branch 00602) are written as ="..." so Excel keeps the leading zeros
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^0\d+$/.test(s) || /^\d{11,}$/.test(s)) return '="' + s + '"';
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(list) {
    var lines = [CSV_HEAD.join(',')];
    list.forEach(function (r, i) {
      lines.push([r.seq || i + 1, r.pea_office, r.tax_id, r.branch_no, r.address, r.contract_no, thDate(r.contract_date), r.wage_ex_vat, r.guarantee_amount, period(r),
        r.lg_done ? 'ได้แล้ว' : 'ยังไม่ได้', r.lg_no, r.lg_bank, thDate(r.lg_date), r.stamp_done ? 'ได้แล้ว' : 'ยังไม่ได้', thDate(r.stamp_date), r.note].map(csvCell).join(','));
    });
    var t = totals(list);
    lines.push(['', 'รวม', '', '', '', '', '', t.wage, t.guarantee].map(csvCell).join(','));
    return '﻿' + lines.join('\r\n');
  }

  var api = { thDate: thDate, period: period, money: money, calcGuarantee: calcGuarantee, status: status, matches: matches, totals: totals, toCsv: toCsv, esc: esc };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  if (window.__contractGuarantee) return;
  window.__contractGuarantee = true;
  window.ContractGuarantee = api;

  // ---------------------------------------------------------------- server
  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/contract-guarantee-api';
  var ERR = { ADMIN_ONLY: 'เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ', SESSION_INVALID: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', SESSION_REQUIRED: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', OFFICE_REQUIRED: 'กรุณากรอกชื่อการไฟฟ้า', YEAR_INVALID: 'ปีสัญญาไม่ถูกต้อง (พ.ศ.)', AMOUNT_INVALID: 'จำนวนเงินไม่ถูกต้อง', NOT_FOUND: 'ไม่พบรายการนี้แล้ว' };
  async function token() {
    try { if (typeof window.getBestDataToken === 'function') { var t = await window.getBestDataToken(); if (t) return t; } } catch (_) {}
    try { return localStorage.getItem('divergent_web_session_token_v1') || localStorage.getItem('divergent_fallback_session_token') || ''; } catch (_) { return ''; }
  }
  async function call(body) {
    var t = await token();
    if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(ERR[j.error] || j.error || ('HTTP ' + r.status));
    return j;
  }

  // ---------------------------------------------------------------- state
  var st = { items: null, err: '', q: '', year: '', state: '', edit: null, busy: false };
  function today() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function thisBE() { return new Date(Date.now() + 7 * 3600e3).getUTCFullYear() + 543; }
  function years() {
    var ys = {}; (st.items || []).forEach(function (r) { ys[r.contract_year] = 1; });
    return Object.keys(ys).map(Number).sort(function (a, b) { return b - a; });
  }
  async function load() {
    try {
      var j = await call({ action: 'list' });
      st.items = j.items || []; st.err = '';
      if (!st.year) st.year = String(years()[0] || '');
    } catch (e) { st.items = st.items || []; st.err = e.message || String(e); }
    render();
  }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('cgStyle')) return;
    var s = document.createElement('style'); s.id = 'cgStyle';
    s.textContent =
      '#contractGuaranteeWorkspace{padding:18px;color:#2f2140}#contractGuaranteeWorkspace h2{margin:0 0 4px;color:#4d2376}.cg-sub{color:#776a86;font-size:13px;margin-bottom:12px}' +
      '.cg-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.cg-bar input,.cg-bar select,.cg-form input,.cg-form select,.cg-form textarea{border:1px solid #d9cfdf;border-radius:9px;padding:8px 10px;font:inherit;background:#fff}' +
      '.cg-btn{border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer;background:#4b2378;color:#fff}.cg-btn.soft{background:#f2ebfa;color:#5a2787}.cg-btn.red{background:#fde8e8;color:#a61b1b}.cg-btn.sm{padding:5px 10px;font-size:13px}.cg-btn:disabled{opacity:.5;cursor:default}' +
      '.cg-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px}.cg-kpi{background:#fff;border:1px solid #e5dced;border-radius:12px;padding:10px 14px}.cg-kpi small{display:block;color:#776a86;font-size:12px}.cg-kpi b{font-size:20px;color:#4d2376}.cg-kpi.warn b{color:#a35a00}' +
      '.cg-wrap{overflow-x:auto;background:#fff;border-radius:12px;border:1px solid #eee7f4}.cg-table{width:100%;border-collapse:collapse;font-size:14px}.cg-table th,.cg-table td{border-bottom:1px solid #eee7f4;padding:8px 10px;text-align:left;vertical-align:top}.cg-table th{background:#f8f5fb;color:#4d2376;font-size:13px;white-space:nowrap}' +
      '.cg-table td.n,.cg-table th.n{text-align:right;white-space:nowrap}.cg-table tr:hover td{background:#fbf9fd}.cg-table tfoot td{font-weight:800;background:#f8f5fb}.cg-small{font-size:12px;color:#776a86}' +
      '.cg-tag{display:inline-block;border-radius:6px;padding:1px 7px;font-size:12px;font-weight:700;white-space:nowrap;border:0;cursor:pointer;font-family:inherit}.cg-ok{background:#e5f6ea;color:#1d6b35}.cg-no{background:#fff1dc;color:#9a5600}' +
      '.cg-form{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:14px;max-width:900px}.cg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 14px}.cg-form label{display:block;font-weight:800;font-size:13px;color:#49345a;margin-top:9px}.cg-form input,.cg-form select,.cg-form textarea{width:100%;box-sizing:border-box;margin-top:3px}.cg-full{grid-column:1/-1}' +
      '.cg-form h4{grid-column:1/-1;margin:14px 0 0;color:#4d2376;font-size:14px;border-top:1px solid #eee7f4;padding-top:10px}.cg-hint{font-size:12px;color:#776a86;font-weight:400}.cg-check{display:flex!important;gap:8px;align-items:center}.cg-check input{width:auto;margin:0}.cg-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}' +
      '.cg-err{border:1px solid #f0c36d;background:#fff8e6;color:#8a5b00;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-weight:700}' +
      '@media(max-width:900px){.cg-grid{grid-template-columns:1fr}.cg-table .cg-hide{display:none}}';
    document.head.appendChild(s);
  }
  function page() {
    var w = document.getElementById('contractGuaranteeWorkspace');
    if (w) return w;
    w = document.createElement('section'); w.id = 'contractGuaranteeWorkspace'; w.style.display = 'none';
    (document.querySelector('main.main-shell') || document.querySelector('main') || document.body).appendChild(w);
    w.addEventListener('click', onClick);
    w.addEventListener('input', onInput);
    w.addEventListener('change', onChange);
    return w;
  }
  function shown() { return (st.items || []).filter(function (r) { return matches(r, { year: st.year, state: st.state, q: st.q }); }); }
  function tag(done, label, a, id) {
    return '<button class="cg-tag ' + (done ? 'cg-ok' : 'cg-no') + '" data-cg="' + a + '" data-id="' + id + '" title="คลิกเพื่อเปลี่ยนสถานะ">' + (done ? '✓ ' : '') + label + (done ? ' แล้ว' : ' ยังไม่ได้') + '</button>';
  }
  function render() {
    var w = page();
    if (st.edit) return renderEdit(w);
    if (st.items == null) { w.innerHTML = '<h2>ค้ำประกันสัญญา</h2><div class="cg-sub">กำลังโหลด…</div>'; return; }
    var list = shown(), all = (st.items || []).filter(function (r) { return matches(r, { year: st.year }); }), t = totals(all), tl = totals(list);
    var ys = years(); if (st.year && ys.indexOf(+st.year) < 0) ys.unshift(+st.year);
    w.innerHTML = '<h2>ค้ำประกันสัญญา</h2><div class="cg-sub">สัญญาจ้างกับการไฟฟ้าส่วนภูมิภาค • เงินค้ำประกัน (LG) และตราสาร (อากรแสตมป์) • คลิกป้ายสถานะเพื่อเปลี่ยน หรือกดแก้ไขเพื่อแก้ทุกช่อง</div>' +
      (st.err ? '<div class="cg-err">' + esc(st.err) + '</div>' : '') +
      '<div class="cg-kpis">' +
      '<div class="cg-kpi"><small>สัญญาปี ' + esc(st.year || 'ทั้งหมด') + '</small><b>' + t.count + '</b> รายการ</div>' +
      '<div class="cg-kpi"><small>เงินค้ำประกันรวม</small><b>' + money(t.guarantee) + '</b> บาท</div>' +
      '<div class="cg-kpi warn"><small>ยังไม่ได้ LG</small><b>' + t.noLg + '</b> รายการ · ' + money(t.noLgAmt) + ' บาท</div>' +
      '<div class="cg-kpi warn"><small>ยังไม่ได้ตราสาร</small><b>' + t.noStamp + '</b> รายการ</div></div>' +
      '<div class="cg-bar">' +
      '<select data-cg="year"><option value="">ทุกปี</option>' + ys.map(function (y) { return '<option value="' + y + '"' + (String(y) === String(st.year) ? ' selected' : '') + '>ปีสัญญา ' + y + '</option>'; }).join('') + '</select>' +
      '<select data-cg="state">' + [['', 'ทุกสถานะ'], ['nolg', 'ยังไม่ได้ LG'], ['nostamp', 'ยังไม่ได้ตราสาร'], ['done', 'ครบแล้ว']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === st.state ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<input type="search" data-cg="q" placeholder="ค้นหา การไฟฟ้า / เลขที่สัญญา" value="' + esc(st.q) + '">' +
      '<button class="cg-btn" data-cg="add">➕ เพิ่มสัญญา</button>' +
      '<button class="cg-btn soft" data-cg="csv"' + (list.length ? '' : ' disabled') + '>⬇ ส่งออก Excel</button></div>' +
      '<div class="cg-wrap"><table class="cg-table"><thead><tr><th>ลำดับ</th><th>ชื่อการไฟฟ้า</th><th>เลขที่สัญญา</th><th>ลว</th><th class="n cg-hide">ค่าจ้าง (ไม่รวม VAT)</th><th class="n">เงินค้ำประกัน</th><th class="cg-hide">ระยะเวลา</th><th>LG</th><th>ตราสาร</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) {
        return '<tr><td>' + esc(r.seq || '') + '</td>' +
          '<td>' + esc(r.pea_office) + (r.branch_no || r.tax_id ? '<div class="cg-small">' + (r.tax_id ? 'เลขผู้เสียภาษี ' + esc(r.tax_id) : '') + (r.branch_no ? ' สาขา ' + esc(r.branch_no) : '') + '</div>' : '') + (r.note ? '<div class="cg-small">📝 ' + esc(r.note) + '</div>' : '') + '</td>' +
          '<td>' + (esc(r.contract_no) || '<span class="cg-small">—</span>') + '</td><td>' + (thDate(r.contract_date) || '<span class="cg-small">—</span>') + '</td>' +
          '<td class="n cg-hide">' + money(r.wage_ex_vat) + '</td><td class="n">' + money(r.guarantee_amount) + '</td><td class="cg-hide">' + esc(period(r)) + '</td>' +
          '<td>' + tag(r.lg_done, 'LG', 'toglg', r.id) + (r.lg_no ? '<div class="cg-small">' + esc(r.lg_no) + '</div>' : '') + '</td>' +
          '<td>' + tag(r.stamp_done, 'ตราสาร', 'togstamp', r.id) + '</td>' +
          '<td><button class="cg-btn soft sm" data-cg="open" data-id="' + r.id + '">แก้ไข</button></td></tr>';
      }).join('') : '<tr><td colspan="10" style="text-align:center;color:#776a86;padding:24px">ไม่มีรายการ</td></tr>') +
      '</tbody>' + (list.length ? '<tfoot><tr><td></td><td>รวม ' + tl.count + ' รายการ</td><td></td><td></td><td class="n cg-hide">' + money(tl.wage) + '</td><td class="n">' + money(tl.guarantee) + '</td><td class="cg-hide"></td><td></td><td></td><td></td></tr></tfoot>' : '') +
      '</table></div>';
  }

  // ---------------------------------------------------------------- editor
  function blank() {
    var y = +st.year || thisBE() + 1, g = y - 543;
    return { contract_year: y, seq: '', pea_office: 'การไฟฟ้าส่วนภูมิภาค', tax_id: '0994000165501', branch_no: '', address: '', contract_no: '', contract_date: '', wage_ex_vat: '', guarantee_amount: '',
      period_start: g + '-01-01', period_end: g + '-12-31', lg_done: false, lg_no: '', lg_bank: '', lg_date: '', stamp_done: false, stamp_date: '', note: '' };
  }
  function f(label, k, type, hint, cls) {
    var v = st.edit[k] == null ? '' : st.edit[k];
    var inp = type === 'textarea' ? '<textarea data-f="' + k + '" rows="2">' + esc(v) + '</textarea>'
      : '<input data-f="' + k + '" type="' + (type || 'text') + '"' + (type === 'number' ? ' step="any" inputmode="decimal"' : '') + ' value="' + esc(v) + '">';
    return '<label class="' + (cls || '') + '">' + label + (hint ? ' <span class="cg-hint">' + hint + '</span>' : '') + inp + '</label>';
  }
  function chk(label, k) { return '<label class="cg-check"><input type="checkbox" data-f="' + k + '"' + (st.edit[k] ? ' checked' : '') + '> ' + label + '</label>'; }
  function renderEdit(w) {
    var e = st.edit, sug = calcGuarantee(e.wage_ex_vat);
    w.innerHTML = '<div class="cg-bar"><button class="cg-btn soft" data-cg="back">← กลับไปตาราง</button><h2 style="margin:0">' + (e.id ? 'แก้ไขสัญญา' : 'เพิ่มสัญญา') + '</h2></div>' +
      (st.err ? '<div class="cg-err">' + esc(st.err) + '</div>' : '') +
      '<div class="cg-form"><div class="cg-grid">' +
      f('ปีสัญญา (พ.ศ.)', 'contract_year', 'number') + f('ลำดับ', 'seq', 'number', 'เว้นว่าง = ต่อท้าย') +
      f('ชื่อการไฟฟ้า *', 'pea_office', 'text', '', 'cg-full') +
      f('เลขผู้เสียภาษี', 'tax_id') + f('สาขาที่', 'branch_no', 'text', 'เช่น 00602') +
      f('ที่อยู่', 'address', 'textarea', '', 'cg-full') +
      f('เลขที่สัญญา', 'contract_no') + f('ลว (วันที่สัญญา)', 'contract_date', 'date') +
      f('ค่าจ้าง (ไม่รวม VAT)', 'wage_ex_vat', 'number') +
      '<label>เงินค้ำประกัน' + (sug ? ' <span class="cg-hint">5% ของค่าจ้างรวม VAT = ' + money(sug) + ' <button class="cg-btn soft sm" data-cg="usecalc" type="button">ใช้ค่านี้</button></span>' : '') +
      '<input data-f="guarantee_amount" type="number" step="any" inputmode="decimal" value="' + esc(e.guarantee_amount == null ? '' : e.guarantee_amount) + '"></label>' +
      f('ระยะเวลา เริ่ม', 'period_start', 'date') + f('ระยะเวลา สิ้นสุด', 'period_end', 'date') +
      '<h4>หนังสือค้ำประกัน (LG)</h4>' + chk('ได้ LG แล้ว', 'lg_done') + '<span></span>' +
      f('เลขที่ LG', 'lg_no') + f('ธนาคาร', 'lg_bank') + f('วันที่ LG', 'lg_date', 'date') + '<span></span>' +
      '<h4>ตราสาร (อากรแสตมป์)</h4>' + chk('ได้ตราสารแล้ว', 'stamp_done') + f('วันที่ตราสาร', 'stamp_date', 'date') +
      f('หมายเหตุ', 'note', 'textarea', '', 'cg-full') +
      '</div><div class="cg-acts"><button class="cg-btn" data-cg="save"' + (st.busy ? ' disabled' : '') + '>💾 บันทึก</button>' +
      '<button class="cg-btn soft" data-cg="back">ยกเลิก</button>' +
      (e.id ? '<button class="cg-btn red" data-cg="del">ลบรายการ</button>' : '') + '</div></div>';
  }
  async function save() {
    var e = st.edit;
    if (!String(e.pea_office || '').trim()) { alert('กรุณากรอกชื่อการไฟฟ้า'); return; }
    st.busy = true; render();
    try {
      var j = await call({ action: 'save', item: e });
      upsertLocal(j.item);
      st.edit = null; st.err = ''; st.year = String(j.item.contract_year);
    } catch (er) { st.err = 'บันทึกไม่สำเร็จ: ' + (er.message || er); }
    st.busy = false; render();
  }
  function upsertLocal(it) {
    var i = st.items.findIndex(function (x) { return x.id === it.id; });
    if (i >= 0) st.items[i] = it; else st.items.push(it);
    st.items.sort(function (a, b) { return b.contract_year - a.contract_year || (a.seq || 1e9) - (b.seq || 1e9) || a.id - b.id; });
  }
  // quick status toggle from the table (fills the date with today when turning on)
  async function toggle(id, which) {
    var r = st.items.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var item = Object.assign({}, r);
    if (which === 'lg') { item.lg_done = !r.lg_done; if (item.lg_done && !item.lg_date) item.lg_date = today(); }
    else { item.stamp_done = !r.stamp_done; if (item.stamp_done && !item.stamp_date) item.stamp_date = today(); }
    try { var j = await call({ action: 'save', item: item }); upsertLocal(j.item); st.err = ''; }
    catch (er) { st.err = 'เปลี่ยนสถานะไม่สำเร็จ: ' + (er.message || er); }
    render();
  }
  function exportCsv() {
    var blob = new Blob([toCsv(shown())], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'ค้ำประกันสัญญา_' + (st.year || 'ทุกปี') + (st.state ? '_' + { nolg: 'ยังไม่ได้LG', nostamp: 'ยังไม่ได้ตราสาร', done: 'ครบแล้ว' }[st.state] : '') + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------------------------------------------------------------- events
  function onClick(ev) {
    var b = ev.target.closest('[data-cg]'); if (!b) return;
    var a = b.getAttribute('data-cg'), id = +b.getAttribute('data-id');
    if (a === 'add') { st.err = ''; st.edit = blank(); render(); window.scrollTo(0, 0); }
    if (a === 'open') { var r = st.items.filter(function (x) { return x.id === id; })[0]; if (r) { st.err = ''; st.edit = Object.assign({}, r); render(); window.scrollTo(0, 0); } }
    if (a === 'back') { st.edit = null; st.err = ''; render(); }
    if (a === 'save') save();
    if (a === 'usecalc') { ev.preventDefault(); st.edit.guarantee_amount = calcGuarantee(st.edit.wage_ex_vat); render(); }
    if (a === 'toglg') toggle(id, 'lg');
    if (a === 'togstamp') toggle(id, 'stamp');
    if (a === 'csv') exportCsv();
    if (a === 'del' && confirm('ลบสัญญา ' + (st.edit.pea_office || '') + ' ออกจากตาราง?')) {
      var did = st.edit.id;
      call({ action: 'delete', id: did }).then(function () { st.items = st.items.filter(function (x) { return x.id !== did; }); st.edit = null; render(); }, function (er) { alert('ลบไม่สำเร็จ: ' + (er.message || er)); });
    }
  }
  function onInput(ev) {
    var t = ev.target;
    if (t.getAttribute('data-cg') === 'q') { st.q = t.value; var pos = t.selectionStart; render(); var q = document.querySelector('[data-cg="q"]'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (_) {} } return; }
    var k = t.getAttribute('data-f');
    if (k && st.edit && t.type !== 'checkbox') {
      st.edit[k] = t.value;
      if (k === 'wage_ex_vat') {   // refresh only the suggestion, keep focus in the field
        var lab = t.closest('.cg-grid').querySelector('[data-f="guarantee_amount"]').parentNode, sug = calcGuarantee(t.value), h = lab.querySelector('.cg-hint');
        if (h) h.remove();
        if (sug) { var span = document.createElement('span'); span.className = 'cg-hint'; span.innerHTML = ' 5% ของค่าจ้างรวม VAT = ' + money(sug) + ' <button class="cg-btn soft sm" data-cg="usecalc" type="button">ใช้ค่านี้</button>'; lab.insertBefore(span, lab.querySelector('input')); }
      }
    }
  }
  function onChange(ev) {
    var t = ev.target, a = t.getAttribute('data-cg'), k = t.getAttribute('data-f');
    if (a === 'year') { st.year = t.value; render(); }
    if (a === 'state') { st.state = t.value; render(); }
    if (k && st.edit && t.type === 'checkbox') {
      st.edit[k] = t.checked;
      if (t.checked && k === 'lg_done' && !st.edit.lg_date) st.edit.lg_date = today();
      if (t.checked && k === 'stamp_done' && !st.edit.stamp_date) st.edit.stamp_date = today();
      render();
    }
  }

  // ---------------------------------------------------------------- menu (main admin account only)
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
    nav.innerHTML = '<span class="nav-ico">📑</span><span>ค้ำประกันสัญญา</span>';
    nav.addEventListener('click', showPage);
    side.appendChild(nav);
    syncNav();
  }
  function showPage() {
    if (!isAdmin()) { alert('เมนูค้ำประกันสัญญาเปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    style();
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navContractGuarantee'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    document.documentElement.classList.add('sa-wide');
    st.edit = null;
    window.scrollTo(0, 0);
    render();
    load();
  }
  window.openContractGuarantee = showPage;

  function boot() {
    ensureNav();
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); syncNav(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

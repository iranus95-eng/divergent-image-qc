/* ค้ำประกันสัญญา (2026-11-20)
 * Data of the user's LG-ตราสาร2570.xlsx, shown as one table with two lines per site (LG, then ตราสาร);
 * the Excel export keeps the file's two sheets:
 *  - LG2570      : ลำดับ, ชื่อการไฟฟ้า, เลขที่สัญญา, ลว, เงินค้ำประกัน, ระยะเวลา + "รายการที่ยังไม่ได้ LG"
 *  - ตราสาร2570  : ลำดับ, ชื่อการไฟฟ้า, เลขผู้เสียภาษี, สาขาที่, ที่อยู่, เลขที่สัญญา, ลว, ค่าจ้าง(ไม่รวมVAT), เงินค้ำประกัน, ระยะเวลา
 *                  + "รายการที่ยังไม่ได้ตราสาร"
 * Sites are the won ones (🏆) of ตารางประมูลแจ้งเตือน; the contract data lives in contract_guarantees through
 * the edge function contract-guarantee-api (admin only). เงินค้ำประกัน = ค่าจ้าง × 1.07 × 5% rounded up to the baht
 * (the file: 302,400 → 16,179), editable.
 */
(function () {
  'use strict';
  if (window.__contractGuarantee) return;
  window.__contractGuarantee = true;

  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/contract-guarantee-api';
  var XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  var YEAR = 2570, VAT = 0.07, RATE = 0.05;
  var DEF = { tax_id: '0994000165501', period: '1/1/' + YEAR + '-31/12/' + YEAR };
  var FIELDS = ['pea_name', 'tax_id', 'branch_no', 'address', 'contract_no', 'contract_date', 'wage_ex_vat', 'guarantee', 'period', 'lg_done', 'stamp_done', 'note'];
  var st = { rows: null, err: '', tab: 'all', edit: null, busy: false };

  // ---------------------------------------------------------------- pure helpers
  function guaranteeOf(wage) { if (wage == null || wage === '' || !isFinite(+wage)) return null; return Math.ceil(Math.round(+wage * (1 + VAT) * RATE * 100) / 100); }
  function wageOf(b) { return b && b.qty != null && b.price_bid != null ? Math.round(+b.qty * +b.price_bid * 100) / 100 : null; }
  function peaName(b) {
    var o = String((b && b.office) || '').split(',')[0].trim();
    if (/^กฟจ\./.test(o)) return 'การไฟฟ้าส่วนภูมิภาคจังหวัด' + o.slice(4).trim();
    if (/^กฟส\./.test(o) && o.length < 40) return 'การไฟฟ้าส่วนภูมิภาคสาขา' + o.slice(4).trim();
    return 'การไฟฟ้าส่วนภูมิภาคสาขา' + String((b && b.site) || '').trim();
  }
  // one row per won site: the bid (b) and its contract data (c, may be {})
  function merge(items, contracts) {
    var by = {}; (contracts || []).forEach(function (c) { by[c.notice_bid_id] = c; });
    return (items || []).map(function (b) { return { b: b, c: by[b.id] || {} }; });
  }
  function doneKey(tab) { return tab === 'lg' ? 'lg_done' : 'stamp_done'; }
  function split(rows, tab) {
    var k = doneKey(tab), done = [], todo = [];
    rows.forEach(function (r) { (r.c[k] ? done : todo).push(r); });
    var n = function (r) { return r.c.list_no == null ? 1e9 : +r.c.list_no; };   // ลำดับ = order first saved in, like the Excel file
    done.sort(function (a, b) { return n(a) - n(b) || a.b.id - b.b.id; });
    return { done: done, todo: todo };
  }
  function beDate(v) { if (!v) return ''; var p = String(v).split('-').map(Number); return p[2] + '/' + p[1] + '/' + (p[0] + 543); }
  window.ContractGuarantee = { guaranteeOf: guaranteeOf, wageOf: wageOf, peaName: peaName, merge: merge, split: split, beDate: beDate };
  if (typeof document === 'undefined') return;

  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var baht = function (v, d) { return v == null || v === '' ? '' : Number(v).toLocaleString('th-TH', { minimumFractionDigits: d || 0, maximumFractionDigits: 2 }); };

  // ---------------------------------------------------------------- server
  async function token() {
    try { if (typeof window.getBestDataToken === 'function') { var t = await window.getBestDataToken(); if (t) return t; } } catch (_) {}
    try { return localStorage.getItem('divergent_web_session_token_v1') || localStorage.getItem('divergent_fallback_session_token') || ''; } catch (_) { return ''; }
  }
  var ERR = { ADMIN_ONLY: 'เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)', INVALID_AMOUNT: 'จำนวนเงินไม่ถูกต้อง', INVALID_DATE: 'วันที่ไม่ถูกต้อง', SESSION_INVALID: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', SESSION_REQUIRED: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' };
  async function call(body) {
    var t = await token();
    if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.ok) throw new Error(ERR[j.error] || j.error || ('HTTP ' + r.status));
    return j;
  }
  async function load() {
    try { var j = await call({ action: 'list', fiscal_year: YEAR }); st.rows = merge(j.items, j.contracts); st.err = ''; }
    catch (e) { st.rows = []; st.err = e.message || String(e); }
    render();
  }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('cgStyle')) return;
    var s = document.createElement('style'); s.id = 'cgStyle';
    s.textContent = '.cg-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;flex-wrap:wrap}.cg-head h2{margin:0 0 4px}.cg-head p{margin:0;color:#6b5d7a}' +
      '.cg-btn{border:1px solid #d9cbe8;background:#fff;color:#5a2787;border-radius:9px;padding:8px 12px;font-weight:700;cursor:pointer;font:inherit}.cg-btn:hover{background:#f5effa}.cg-btn.pri{background:#5a2787;color:#fff;border-color:#5a2787}.cg-btn.sm{padding:4px 9px;font-size:13px}' +
      '.cg-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}' +
      '.cg-kpi{background:#fff;border:1px solid #e5dced;border-radius:12px;padding:12px 14px}.cg-kpi span{display:block;font-size:13px;color:#6b5d7a}.cg-kpi b{display:block;font-size:22px;color:#3b2252;font-variant-numeric:tabular-nums}' +
      '.cg-kpi.gold{background:#fffaf0;border-color:#f0dca0}.cg-kpi.gold b{color:#8a5b00}' +
      '.cg-tabs{display:flex;gap:6px;margin-bottom:10px;border-bottom:1px solid #e5dced}.cg-tab{border:0;background:none;padding:9px 14px;font:inherit;font-weight:700;color:#8a7d98;border-bottom:3px solid transparent;cursor:pointer}.cg-tab[aria-pressed=true]{color:#5a2787;border-color:#5a2787}' +
      '.cg-two .cg-l1 td{border-top:2px solid #e5dced}.cg-two .cg-l2 td{border-top:1px dashed #efe8f5}.cg-sub{font-size:12px;color:#8a7d98}.cg-badge{display:inline-block;border-radius:6px;padding:2px 8px;font-size:13px;font-weight:700;white-space:nowrap}.cg-badge.ok{background:#e3f0e9;color:#236347}.cg-badge.todo{background:#fff1d4;color:#975b0e}' +
      '.cg-card{background:#fff;border:1px solid #e5dced;border-radius:14px;overflow:hidden;margin-bottom:14px}.cg-scroll{overflow:auto}' +
      '.cg-table{width:100%;border-collapse:collapse;font-size:14px}.cg-table th{background:#f5effa;color:#5a2787;text-align:left;padding:9px 10px;white-space:nowrap}' +
      '.cg-table td{padding:8px 10px;border-top:1px solid #f0eaf5;vertical-align:top}.cg-table .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.cg-table tfoot td{background:#fbf8fd;font-weight:800;border-top:2px solid #d9cbe8}' +
      '.cg-table .addr{min-width:220px;max-width:320px}.cg-miss{color:#b0a5bd}.cg-sec{padding:10px 12px;background:#fff8e6;color:#8a5b00;font-weight:800;border-top:1px solid #f0dca0}' +
      '.cg-meta{display:block;font-size:12px;color:#8a7d98}.cg-empty{padding:24px;text-align:center;color:#776a86}.cg-err{padding:12px;color:#a13428}.cg-note{font-size:13px;color:#6b5d7a}' +
      '.cg-modal{position:fixed;inset:0;background:#1d102b66;display:flex;align-items:center;justify-content:center;z-index:2147483000;padding:12px}.cg-dlg{background:#fff;border-radius:14px;width:min(720px,100%);max-height:92vh;overflow:auto;padding:18px}' +
      '.cg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cg-grid label{display:block;font-size:13px;color:#5d4f6d;font-weight:700}.cg-grid input,.cg-grid textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #d9cbe8;border-radius:8px;padding:8px 10px;font:inherit}.cg-grid .full{grid-column:1/-1}' +
      '.cg-checks{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px}.cg-checks label{display:flex;gap:6px;align-items:center;font-weight:700;color:#3b2252}.cg-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}' +
      '@media(max-width:640px){.cg-kpis{grid-template-columns:1fr}.cg-grid{grid-template-columns:1fr}}';
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
      if (a === 'tab') { st.tab = b.getAttribute('data-tab'); render(); }
      if (a === 'edit') openEdit(+b.getAttribute('data-id'));
      if (a === 'xlsx') exportExcel().catch(function (er) { alert('ส่งออก Excel ไม่สำเร็จ: ' + (er.message || er)); });
    });
    return w;
  }
  function cell(v, cls) { return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + (v === '' || v == null ? '<span class="cg-miss">—</span>' : esc(v)) + '</td>'; }
  // one table, two lines per site: line 1 = LG (หนังสือค้ำประกัน), line 2 = ตราสาร (user 2026-11-20)
  function ordered(rows) {
    var n = function (r) { return r.c.list_no == null ? 1e9 : +r.c.list_no; };
    return rows.slice().sort(function (a, b) { return n(a) - n(b) || ((a.b.seq == null ? 1e9 : a.b.seq) - (b.b.seq == null ? 1e9 : b.b.seq)) || a.b.id - b.b.id; });
  }
  function render() {
    var w = page(), rows = st.rows || [];
    var sLg = split(rows, 'lg'), sSt = split(rows, 'stamp');
    var sumLg = sLg.done.reduce(function (t, r) { return t + (+r.c.guarantee || 0); }, 0);
    var html = '<div class="cg-head"><div><h2>🏆 ค้ำประกันสัญญา</h2><p>ไซด์ที่ชนะประมูล ปี ' + YEAR + ' · หนังสือค้ำประกัน (LG) และตราสาร ไซด์ละ 2 บรรทัด</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cg-btn" data-cg="xlsx">⬇ ส่งออก Excel</button><button class="cg-btn" data-cg="bids">📊 ตารางประมูลแจ้งเตือน</button><button class="cg-btn" data-cg="reload">↻ รีเฟรช</button></div></div>';
    html += '<div class="cg-kpis"><div class="cg-kpi gold"><span>เงินค้ำประกันที่ออก LG แล้ว</span><b>' + (st.rows ? baht(sumLg) : '…') + '</b></div>' +
      '<div class="cg-kpi"><span>ยังไม่ได้ LG</span><b>' + (st.rows ? sLg.todo.length + ' / ' + rows.length : '…') + '</b></div>' +
      '<div class="cg-kpi"><span>ยังไม่ได้ตราสาร</span><b>' + (st.rows ? sSt.todo.length + ' / ' + rows.length : '…') + '</b></div></div>';
    html += '<div class="cg-tabs" role="group" aria-label="แสดง">' + [['all', 'ทั้งหมด ' + rows.length], ['lg', 'ยังไม่ได้ LG ' + sLg.todo.length], ['stamp', 'ยังไม่ได้ตราสาร ' + sSt.todo.length]].map(function (t) {
      return '<button class="cg-tab" data-cg="tab" data-tab="' + t[0] + '" aria-pressed="' + (st.tab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';
    if (st.rows == null) html += '<div class="cg-card"><div class="cg-empty">กำลังโหลด…</div></div>';
    else if (st.err) html += '<div class="cg-card"><div class="cg-err">โหลดไม่สำเร็จ: ' + esc(st.err) + '</div></div>';
    else {
      var list = ordered(rows).filter(function (r) { return st.tab === 'all' || !r.c[doneKey(st.tab)]; });
      var head = ['ลำดับ', 'ชื่อการไฟฟ้า', 'เลขที่สัญญา', 'ลว', 'ระยะเวลา', 'เอกสาร', 'จำนวนเงิน', 'เลขผู้เสียภาษี', 'สาขาที่', 'ที่อยู่', ''];
      html += '<div class="cg-card"><div class="cg-scroll"><table class="cg-table cg-two" style="min-width:1250px"><thead><tr>' + head.map(function (h) { return '<th' + (/ลำดับ|จำนวนเงิน/.test(h) ? ' class="n"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
      html += list.length ? list.map(function (r, i) {
        var c = r.c, wage = c.wage_ex_vat != null ? +c.wage_ex_vat : wageOf(r.b), g = c.guarantee != null ? +c.guarantee : guaranteeOf(wage), est = function (has) { return has ? '' : ' <span class="cg-meta">(ประมาณ)</span>'; };
        var badge = function (done, label) { return '<span class="cg-badge ' + (done ? 'ok' : 'todo') + '">' + (done ? '✓ ' : '') + label + (done ? '' : ' · ยังไม่ได้') + '</span>'; };
        var rs = ' rowspan="2"';
        return '<tr class="cg-l1"><td class="n"' + rs + '>' + (i + 1) + '</td><td' + rs + '><b>' + esc(c.pea_name || peaName(r.b)) + '</b><span class="cg-meta">ไซด์ ' + esc(r.b.site) + (r.b.zone ? ' · ' + esc(r.b.zone) : '') + '</span></td>' +
          cell(c.contract_no).replace('<td', '<td' + rs) + cell(beDate(c.contract_date)).replace('<td', '<td' + rs) + cell(c.period).replace('<td', '<td' + rs) +
          '<td>' + badge(c.lg_done, 'LG') + '</td><td class="n">' + (g == null ? '<span class="cg-miss">—</span>' : 'เงินค้ำ ' + baht(g) + est(c.guarantee != null)) + '</td><td colspan="3" class="cg-sub">หนังสือค้ำประกันสัญญา</td>' +
          '<td' + rs + '><button class="cg-btn sm' + (c.lg_done && c.stamp_done ? '' : ' pri') + '" data-cg="edit" data-id="' + r.b.id + '">' + (c.notice_bid_id ? 'แก้ไข' : 'กรอกข้อมูล') + '</button></td></tr>' +
          '<tr class="cg-l2"><td>' + badge(c.stamp_done, 'ตราสาร') + '</td><td class="n">' + (wage == null ? '<span class="cg-miss">ยังไม่มีค่าจ้าง</span>' : 'ค่าจ้าง ' + baht(wage) + est(c.wage_ex_vat != null)) + '</td>' +
          cell(c.tax_id) + cell(c.branch_no) + cell(c.address, 'addr') + '</tr>';
      }).join('') : '<tr><td colspan="' + head.length + '" class="cg-empty">ไม่มีรายการ</td></tr>';
      html += '</tbody><tfoot><tr><td colspan="6">รวมเงินค้ำประกันที่ออก LG แล้ว ' + sLg.done.length + ' ไซด์</td><td class="n">' + baht(sumLg) + '</td><td colspan="4"></td></tr></tfoot></table></div></div>';
      html += '<div class="cg-note">ไซด์ที่ทำเครื่องหมาย 🏆 ชนะประมูลในตารางประมูลแจ้งเตือนจะขึ้นที่นี่เอง · เงินค้ำประกัน = ค่าจ้าง (ไม่รวม VAT) × 1.07 × 5% ปัดขึ้นเป็นบาท แก้เองได้ · ส่งออก Excel ได้ 2 ชีต LG' + YEAR + ' / ตราสาร' + YEAR + ' เหมือนไฟล์เดิม</div>';
    }
    w.innerHTML = html;
  }

  // ---------------------------------------------------------------- edit
  function openEdit(id) {
    var r = (st.rows || []).filter(function (x) { return x.b.id === id; })[0]; if (!r) return;
    var c = r.c, wage = c.wage_ex_vat != null ? c.wage_ex_vat : wageOf(r.b);
    var v = {
      pea_name: c.pea_name || peaName(r.b), tax_id: c.tax_id || DEF.tax_id, branch_no: c.branch_no || '', address: c.address || '',
      contract_no: c.contract_no || '', contract_date: c.contract_date || '', wage_ex_vat: wage == null ? '' : wage,
      guarantee: c.guarantee != null ? c.guarantee : (guaranteeOf(wage) == null ? '' : guaranteeOf(wage)), period: c.period || DEF.period, note: c.note || ''
    };
    var inp = function (k, label, type, full) { return '<label' + (full ? ' class="full"' : '') + '>' + label + '<input name="' + k + '"' + (type ? ' type="' + type + '"' : '') + (type === 'number' ? ' step="0.01" min="0"' : '') + ' value="' + esc(v[k]) + '"></label>'; };
    var m = document.createElement('div'); m.className = 'cg-modal'; m.id = 'cgModal';
    m.innerHTML = '<form class="cg-dlg"><h3 style="margin:0 0 4px">' + esc(r.b.site) + '</h3><div class="cg-meta" style="margin-bottom:12px">' + esc([r.b.zone, r.b.project_no ? 'โครงการ ' + r.b.project_no : '', r.b.qty != null && r.b.price_bid != null ? baht(r.b.qty) + ' ราย × ' + Number(r.b.price_bid).toFixed(2) + ' บาท' : ''].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="cg-grid">' + inp('pea_name', 'ชื่อการไฟฟ้า', '', true) + inp('tax_id', 'เลขผู้เสียภาษี') + inp('branch_no', 'สาขาที่') + inp('address', 'ที่อยู่', '', true) +
      inp('contract_no', 'เลขที่สัญญา') + inp('contract_date', 'ลว (วันที่สัญญา)', 'date') + inp('wage_ex_vat', 'ค่าจ้าง (ไม่รวม VAT)', 'number') + inp('guarantee', 'เงินค้ำประกัน', 'number') +
      inp('period', 'ระยะเวลา', '', true) + '<label class="full">หมายเหตุ<textarea name="note" rows="2">' + esc(v.note) + '</textarea></label></div>' +
      '<div class="cg-checks"><label><input type="checkbox" name="lg_done"' + (c.lg_done ? ' checked' : '') + '> ออกหนังสือค้ำประกัน (LG) แล้ว</label><label><input type="checkbox" name="stamp_done"' + (c.stamp_done ? ' checked' : '') + '> ทำตราสารแล้ว</label></div>' +
      '<div class="cg-err" id="cgErr" role="alert"></div><div class="cg-foot"><button type="button" class="cg-btn" data-x="close">ยกเลิก</button><button type="submit" class="cg-btn pri">บันทึก</button></div></form>';
    document.body.appendChild(m);
    var f = m.querySelector('form'), auto = c.guarantee == null || +c.guarantee === guaranteeOf(wage);
    f.wage_ex_vat.addEventListener('input', function () { if (auto) { var g = guaranteeOf(f.wage_ex_vat.value); f.guarantee.value = g == null ? '' : g; } });
    f.guarantee.addEventListener('input', function () { auto = false; });
    m.addEventListener('click', function (e) { if (e.target === m || (e.target.getAttribute && e.target.getAttribute('data-x') === 'close')) m.remove(); });
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); if (st.busy) return; st.busy = true;
      var btn = f.querySelector('[type=submit]'); btn.disabled = true;
      var row = {}; FIELDS.forEach(function (k) { var el = f.elements[k]; row[k] = el.type === 'checkbox' ? el.checked : el.value; });
      try {
        var j = await call({ action: 'save', notice_bid_id: r.b.id, row: row });
        r.c = j.item || r.c; m.remove(); render();
      } catch (er) { f.querySelector('#cgErr').textContent = 'บันทึกไม่สำเร็จ: ' + (er.message || er); }
      finally { st.busy = false; btn.disabled = false; }
    });
    f.pea_name.focus();
  }

  // ---------------------------------------------------------------- Excel, same two sheets as LG-ตราสาร2570.xlsx
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('โหลดไลบรารีไม่สำเร็จ')); }; document.head.appendChild(s); }); }
  async function exportExcel() {
    if (!st.rows || st.err) return;
    if (!window.XLSX) await loadScript(XLSX_SRC);
    var X = window.XLSX, wb = X.utils.book_new();
    [['lg', 'LG' + YEAR, ['ลำดับ', 'ชื่อการไฟฟ้า', 'เลขที่สัญญา', 'ลว', 'เงินค้ำประกัน', 'ระยะเวลา'], [6, 46, 22, 12, 14, 22]],
     ['stamp', 'ตราสาร' + YEAR, ['ลำดับ', 'ชื่อการไฟฟ้า', 'เลขผู้เสียภาษี', 'สาขาที่', 'ที่อยู่', 'เลขที่สัญญา', 'ลว', 'ค่าจ้าง(ไม่รวมVAT)', 'เงินค้ำประกัน', 'ระยะเวลา'], [6, 46, 16, 8, 50, 22, 12, 16, 14, 22]]
    ].forEach(function (sh) {
      var lg = sh[0] === 'lg', s = split(st.rows, sh[0]);
      var data = [sh[2]].concat(s.done.map(function (r, i) {
        var c = r.c, d = beDate(c.contract_date);
        return lg ? [i + 1, c.pea_name || '', c.contract_no || '', d, c.guarantee == null ? null : +c.guarantee, c.period || '']
          : [i + 1, c.pea_name || '', c.tax_id || '', c.branch_no || '', c.address || '', c.contract_no || '', d, c.wage_ex_vat == null ? null : +c.wage_ex_vat, c.guarantee == null ? null : +c.guarantee, c.period || ''];
      }));
      var gi = lg ? 4 : 8, total = new Array(sh[2].length).fill(null);
      total[1] = 'รวม'; total[gi] = s.done.reduce(function (t, r) { return t + (+r.c.guarantee || 0); }, 0);
      data.push(total, [], [null, 'รายการที่ยังไม่ได้' + (lg ? ' LG' : 'ตราสาร')]);
      s.todo.forEach(function (r, i) { var row = new Array(sh[2].length).fill(null); row[0] = i + 1; row[1] = r.c.pea_name || peaName(r.b); data.push(row); });
      var ws = X.utils.aoa_to_sheet(data);
      ws['!cols'] = sh[3].map(function (n) { return { wch: n }; });
      X.utils.book_append_sheet(wb, ws, sh[1]);
    });
    var d = new Date();
    X.writeFile(wb, 'LG-ตราสาร' + YEAR + '_' + ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + (d.getFullYear() + 543) + '.xlsx');
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

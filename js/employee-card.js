/* ทำบัตรพนักงาน (2026-11-12)
 * บัตรประจำตัวผู้รับจ้างการไฟฟ้าส่วนภูมิภาค ปฏิบัติงานเกี่ยวกับมิเตอร์ ตามแบบ TOR ข้อ 4.1 (7):
 *  - บัตรสีขาว ตัวหนังสือสีดำ ขนาด 9 x 6 ซม., รูปถ่าย 1 นิ้ว มุมขวาบน (ประทับตรา กฟภ. ทับภายหลัง)
 *  - ชื่อ/นามสกุล, เลขที่ XXX/ปี, ผู้รับจ้างเหมา, ประจำ กฟฟ., วันที่ออกบัตร, วันที่บัตรหมดอายุ (31 ธ.ค.),
 *    ผู้ลงนาม (ผจก.กฟฟ.คู่สัญญา), กฟ. … โทร …; ด้านหลังเป็นข้อปฏิบัติในการใช้บัตร 7 ข้อ
 *  - รายชื่อจากข้อมูลเงินเดือน (employee-card-api), พิมพ์ลง A4 แผ่นละ 8 ใบ หน้า-หลัง (หลังสลับซ้าย-ขวา สำหรับพิมพ์สองหน้า)
 * Admin only (บัญชี admin หลัก) เหมือนเมนูผู้ดูแลอื่น ๆ
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- pure helpers (also used by tests/employee-card.cjs)
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var COMPANY = 'บริษัท ไดเวอร์เจนท์ คอร์ปอเรชั่น จำกัด';
  var RULES = [
    'บัตรนี้ใช้สำหรับแสดงตัวในขณะปฏิบัติงานเกี่ยวกับมิเตอร์',
    'แสดงบัตรนี้ตลอดเวลาที่อยู่ในสถานที่ปฏิบัติงาน',
    'กรณีชำรุด สูญหาย ให้แจ้ง กฟฟ. คู่สัญญา เพื่อเปลี่ยน หรือ ออกบัตรใหม่',
    'กรณีชำรุด ให้นำบัตรแสดงตัวฉบับเดิมที่ชำรุด มาใช้เป็นหลักฐานในการขอเปลี่ยน',
    'กรณีสูญหาย ให้นำใบแจ้งความมาเป็นหลักฐานในการออกบัตรใหม่',
    'บัตรนี้เป็นทรัพย์สินของ กฟภ. เมื่อพ้นสภาพจากผู้รับจ้างจะต้องคืนบัตรทันที',
    'บัตรนี้ไม่สามารถนำไปใช้ทางด้านการเงินหรืออื่นๆ ที่ไม่เกี่ยวข้องกับงานตามสัญญาจ้าง'
  ];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // "2026-11-12" -> "12 พ.ย. 2569"
  function thDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? (+m[3]) + ' ' + TH_MONTHS[+m[2] - 1] + ' ' + (+m[1] + 543) : '';
  }
  // "นายสมชาย ใจดี" -> ['นายสมชาย', 'ใจดี']; the surname is the last word
  function splitName(full) {
    var w = String(full || '').trim().replace(/\s+/g, ' ').split(' ');
    if (w.length < 2) return [w[0] || '', ''];
    return [w.slice(0, -1).join(' '), w[w.length - 1]];
  }
  function cardNo(c) { return c && c.card_no ? String(c.card_no).padStart(3, '0') + '/' + c.card_year : ''; }
  // typos in the payroll sheet (same as employee-card-api): ชุุมพวง, ภููเขียว, หนองบุัวระเหว
  function fixThai(s) { return String(s == null ? '' : s).trim().replace(/ุั/g, 'ั').replace(/([ั-ฺ็-๎])\1+/g, '$1'); }
  // the PEA office a payroll site works for ("สตาฟ" / "QC ไฟฟ้า" have none)
  function officeOf(site) { site = fixThai(site); return /^(สตาร์?ฟ|QC)/i.test(site) ? '' : site; }
  function v(s) { return s ? '<b>' + esc(s) + '</b>' : '<i></i>'; }   // value, or a dotted blank to fill by hand

  function front(c, o) {
    c = c || {}; o = o || {};
    var n = splitName(c.full_name), off = c.pea_office || '';
    return '<div class="ec-card ec-front">' +
      '<div class="ec-photo">' + (c.photo ? '<img src="' + esc(c.photo) + '" alt="">' : '<span>รูปถ่าย "1"<br>ประทับตรา<br>กฟภ.</span>') + '</div>' +
      '<div class="ec-title">บัตรประจำตัวผู้รับจ้างการไฟฟ้าส่วนภูมิภาค<br>ปฏิบัติงานเกี่ยวกับมิเตอร์</div>' +
      '<div class="ec-no">เลขที่ ' + v(cardNo(c)) + '</div>' +
      '<div class="ec-ln">ชื่อ ' + v(n[0]) + ' นามสกุล ' + v(n[1]) + '</div>' +
      '<div class="ec-ln ec-co">ผู้รับจ้างเหมา ' + v(c.contractor || COMPANY) + '</div>' +
      '<div class="ec-ln ec-wide">ประจำ กฟฟ.' + v(off) + '</div>' +
      '<div class="ec-ln ec-wide ec-two"><span>วันที่ออกบัตร ' + v(thDate(c.issue_date)) + '</span><span>วันที่บัตรหมดอายุ ' + v(thDate(c.expire_date)) + '</span></div>' +
      '<div class="ec-sign"><div>ผู้ลงนาม<i class="ec-sig"></i></div><div>(' + (o.signer_name ? esc(o.signer_name) : '<i class="ec-sig"></i>') + ')</div></div>' +
      '<div class="ec-foot"><span>กฟฟ.' + v(off) + ' โทร ' + v(o.phone) + '</span><span>ผจก.กฟฟ.คู่สัญญา ฯ</span></div>' +
      '</div>';
  }
  function back() {
    return '<div class="ec-card ec-back"><div class="ec-rules"><b>ข้อปฏิบัติในการใช้บัตร</b><ol>' +
      RULES.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol></div></div>';
  }
  // A4 sheets of 2 x 4 cards: the fronts, then the backs with each row's columns swapped
  // so that a long-edge duplex print puts every back behind its own front
  function sheets(cards, offices) {
    var out = [], per = 8;
    for (var i = 0; i < cards.length; i += per) {
      var chunk = cards.slice(i, i + per), f = '', b = '';
      for (var k = 0; k < per; k++) {
        var c = chunk[k];
        f += c ? front(c, offices[c.pea_office] || {}) : '<div class="ec-slot"></div>';
        var m = chunk[k % 2 ? k - 1 : k + 1];   // mirrored partner in the same row
        b += m ? back() : '<div class="ec-slot"></div>';
      }
      out.push('<section class="ec-sheet">' + f + '</section>', '<section class="ec-sheet">' + b + '</section>');
    }
    return out.join('');
  }
  var CARD_CSS =
    '.ec-card{position:relative;width:90mm;height:60mm;box-sizing:border-box;background:#fff;color:#000;border:.25mm solid #9a9a9a;border-radius:2.5mm;padding:2.6mm 3mm 2.2mm;font-family:Sarabun,"TH Sarabun New",Tahoma,sans-serif;font-size:8pt;line-height:1.3;overflow:hidden}' +
    '.ec-card *{box-sizing:border-box}.ec-card b{font-weight:700}.ec-card i{display:inline-block;min-width:14mm;border-bottom:.2mm dotted #000;height:.9em;vertical-align:baseline}' +
    '.ec-photo{position:absolute;top:2.6mm;right:3mm;width:20mm;height:24mm;border:.25mm solid #000;display:flex;align-items:center;justify-content:center;text-align:center;font-size:6.5pt;line-height:1.5;overflow:hidden}' +
    '.ec-photo img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.ec-title{margin-right:22mm;text-align:center;font-weight:700;font-size:8pt;line-height:1.35}' +
    '.ec-no{margin:.8mm 22mm 0 0;text-align:center}.ec-ln{margin:.9mm 22mm 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ec-wide{margin-right:0}.ec-co{font-size:7.4pt}' +
    '.ec-front .ec-no+.ec-ln{margin-top:1.6mm}.ec-two{display:flex;justify-content:space-between;gap:2mm}' +
    '.ec-sign{margin:3mm 0 0 40mm;text-align:center;line-height:1.6}.ec-sign .ec-sig{min-width:32mm}' +
    '.ec-foot{position:absolute;left:3mm;right:3mm;bottom:2.2mm;display:flex;justify-content:space-between;align-items:flex-end}.ec-foot span{white-space:nowrap}.ec-foot span:last-child{width:40mm;text-align:center}' +
    '.ec-back{padding:3mm 4mm}.ec-rules b{display:block;text-align:center;font-size:8pt;margin-bottom:.8mm}.ec-rules b{font-size:8.6pt}.ec-rules ol{margin:0;padding-left:4mm;font-size:7.3pt;line-height:1.45}.ec-rules li{margin-top:.5mm}' +
    '.ec-slot{width:90mm;height:60mm}' +
    '.ec-sheet{width:210mm;height:297mm;box-sizing:border-box;padding:24.5mm 13mm;display:grid;grid-template-columns:90mm 90mm;grid-auto-rows:60mm;gap:2mm 4mm;justify-content:center;page-break-after:always;break-after:page}' +
    '.ec-sheet:last-child{page-break-after:auto;break-after:auto}';

  var api = { front: front, back: back, sheets: sheets, thDate: thDate, splitName: splitName, cardNo: cardNo, fixThai: fixThai, officeOf: officeOf, CARD_CSS: CARD_CSS, RULES: RULES };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  if (window.__employeeCard) return;
  window.__employeeCard = true;
  window.EmployeeCard = api;

  // ---------------------------------------------------------------- server
  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/employee-card-api';
  var ERR = { ADMIN_ONLY: 'เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ', SESSION_INVALID: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', SESSION_REQUIRED: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', PHOTO_INVALID: 'รูปใหญ่เกินไปหรือไม่ใช่รูปภาพ', NAME_REQUIRED: 'กรุณากรอกชื่อ' };
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
  var st = { people: null, cards: [], offices: {}, photos: {}, err: '', q: '', site: '', sel: {}, edit: null };
  function today() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  async function load() {
    try {
      var j = await call({ action: 'list' });
      st.people = j.people || []; st.cards = j.cards || []; st.err = '';
      st.offices = {}; (j.offices || []).forEach(function (o) { st.offices[o.office] = o; });
    } catch (e) { st.people = []; st.err = e.message || String(e); }
    render();
  }
  // the latest card of each person (highest year, then number)
  function cardOf(key) {
    var best = null;
    st.cards.forEach(function (c) { if (c.person_key === key && (!best || c.card_year > best.card_year || (c.card_year === best.card_year && c.card_no > best.card_no))) best = c; });
    return best;
  }
  // everyone on the payroll + people added by hand (cards whose key is not a payroll person)
  function rows() {
    var list = (st.people || []).slice(), known = {};
    list.forEach(function (p) { known[p.key] = 1; });
    st.cards.forEach(function (c) { if (!known[c.person_key]) { known[c.person_key] = 1; list.push({ key: c.person_key, name: c.full_name, site: c.pea_office || 'เพิ่มเอง', kind: 'manual' }); } });
    return list;
  }
  async function photosFor(ids) {
    var need = ids.filter(function (id) { return !(id in st.photos); });
    if (need.length) {
      var j = await call({ action: 'photos', ids: need });
      need.forEach(function (id) { st.photos[id] = (j.photos || {})[id] ? 'data:image/jpeg;base64,' + j.photos[id] : ''; });
    }
  }
  function withPhoto(c) { var x = Object.assign({}, c); x.photo = st.photos[c.id] || ''; return x; }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('ecStyle')) return;
    var s = document.createElement('style'); s.id = 'ecStyle';
    s.textContent = CARD_CSS +
      '#employeeCardWorkspace{padding:18px;color:#2f2140}#employeeCardWorkspace h2{margin:0 0 4px;color:#4d2376}.ec-sub{color:#776a86;font-size:13px;margin-bottom:12px}' +
      '.ec-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.ec-bar input,.ec-bar select,.ec-form input{border:1px solid #d9cfdf;border-radius:9px;padding:8px 10px;font:inherit;background:#fff}' +
      '.ec-btn{border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer;background:#4b2378;color:#fff}.ec-btn.soft{background:#f2ebfa;color:#5a2787}.ec-btn.red{background:#fde8e8;color:#a61b1b}.ec-btn:disabled{opacity:.5;cursor:default}' +
      '.ec-table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;font-size:14px}.ec-table th,.ec-table td{border-bottom:1px solid #eee7f4;padding:8px 10px;text-align:left;vertical-align:middle}.ec-table th{background:#f8f5fb;color:#4d2376;font-size:13px}' +
      '.ec-table tr:hover td{background:#fbf9fd}.ec-tag{display:inline-block;border-radius:6px;padding:1px 7px;font-size:12px;font-weight:700}.ec-ok{background:#e5f6ea;color:#1d6b35}.ec-exp{background:#fde8e8;color:#a61b1b}.ec-none{background:#f1eef4;color:#776a86}' +
      '.ec-edit{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:18px;align-items:start}.ec-form{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:14px}.ec-form label{display:block;font-weight:800;font-size:13px;color:#49345a;margin-top:9px}.ec-form input{width:100%;box-sizing:border-box;margin-top:3px}' +
      '.ec-form h4{margin:16px 0 0;color:#4d2376;font-size:14px;border-top:1px solid #eee7f4;padding-top:10px}.ec-hint{font-size:12px;color:#776a86;font-weight:400}.ec-drop{border:2px dashed #d9cfe6;border-radius:10px;padding:10px}.ec-drop.over{border-color:#5b2d91;background:#f5f0fb}.ec-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}' +
      '.ec-prev{display:flex;flex-wrap:wrap;gap:16px;background:#f3f1f5;border-radius:12px;padding:16px;justify-content:center}.ec-prev .ec-card{box-shadow:0 2px 10px rgba(0,0,0,.12);zoom:1.5}' +
      '.ec-err{border:1px solid #f0c36d;background:#fff8e6;color:#8a5b00;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-weight:700}' +
      '@media(max-width:900px){.ec-edit{grid-template-columns:1fr}.ec-prev .ec-card{zoom:1}.ec-table .ec-hide{display:none}}';
    document.head.appendChild(s);
  }
  function page() {
    var w = document.getElementById('employeeCardWorkspace');
    if (w) return w;
    w = document.createElement('section'); w.id = 'employeeCardWorkspace'; w.style.display = 'none';
    (document.querySelector('main.main-shell') || document.querySelector('main') || document.body).appendChild(w);
    w.addEventListener('click', onClick);
    w.addEventListener('input', onInput);
    w.addEventListener('change', onChange);
    // drop a photo anywhere on a card's editor
    w.addEventListener('dragover', function (e) { if (st.edit) { e.preventDefault(); var d = w.querySelector('.ec-drop'); if (d) d.classList.add('over'); } });
    w.addEventListener('dragleave', function (e) { var d = w.querySelector('.ec-drop'); if (d && !w.contains(e.relatedTarget)) d.classList.remove('over'); });
    w.addEventListener('drop', function (e) {
      if (!st.edit) return; e.preventDefault();
      var d = w.querySelector('.ec-drop'); if (d) d.classList.remove('over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) takePhoto(f);
    });
    return w;
  }
  function status(c) {
    if (!c) return '<span class="ec-tag ec-none">ยังไม่มีบัตร</span>';
    var exp = c.expire_date && c.expire_date < today();
    return '<span class="ec-tag ' + (exp ? 'ec-exp' : 'ec-ok') + '">' + esc(cardNo(c)) + (exp ? ' · หมดอายุแล้ว' : '') + '</span>';
  }
  function filtered() {
    var q = st.q.trim().toLowerCase();
    return rows().filter(function (p) {
      if (st.site && p.site !== st.site) return false;
      return !q || (p.name + ' ' + p.site).toLowerCase().indexOf(q) >= 0;
    });
  }
  function render() {
    var w = page();
    if (st.edit) return renderEdit(w);
    if (st.people == null) { w.innerHTML = '<h2>ทำบัตรพนักงาน</h2><div class="ec-sub">กำลังโหลดรายชื่อ…</div>'; return; }
    var sites = []; rows().forEach(function (p) { if (sites.indexOf(p.site) < 0) sites.push(p.site); }); sites.sort();
    var list = filtered(), nSel = Object.keys(st.sel).filter(function (k) { return st.sel[k]; }).length;
    w.innerHTML = '<h2>ทำบัตรพนักงาน</h2><div class="ec-sub">บัตรประจำตัวผู้รับจ้างการไฟฟ้าส่วนภูมิภาค ปฏิบัติงานเกี่ยวกับมิเตอร์ (แบบ TOR ข้อ 4.1) • บัตรขาว 9 × 6 ซม. • พิมพ์ A4 แผ่นละ 8 ใบ หน้า-หลัง</div>' +
      (st.err ? '<div class="ec-err">' + esc(st.err) + '</div>' : '') +
      '<div class="ec-bar"><input type="search" data-ec="q" placeholder="ค้นหาชื่อ / ไซต์" value="' + esc(st.q) + '">' +
      '<select data-ec="site"><option value="">ทุกไซต์ (' + rows().length + ' คน)</option>' + sites.map(function (s) { return '<option' + (s === st.site ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      '<button class="ec-btn" data-ec="print" ' + (nSel ? '' : 'disabled') + '>🖨 พิมพ์บัตรที่เลือก (' + nSel + ')</button>' +
      '<button class="ec-btn soft" data-ec="add">➕ เพิ่มคนที่ไม่มีในรายชื่อ</button></div>' +
      '<table class="ec-table"><thead><tr><th><input type="checkbox" data-ec="all" title="เลือกทั้งหมดที่แสดง"></th><th>ชื่อ - นามสกุล</th><th class="ec-hide">ไซต์</th><th>บัตร</th><th class="ec-hide">หมดอายุ</th><th class="ec-hide">รูป</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (p) {
        var c = cardOf(p.key);
        return '<tr><td><input type="checkbox" data-ec="sel" data-k="' + esc(p.key) + '"' + (st.sel[p.key] ? ' checked' : '') + '></td><td>' + esc(p.name) + '</td><td class="ec-hide">' + esc(p.site) + '</td><td>' + status(c) + '</td>' +
          '<td class="ec-hide">' + (c ? esc(thDate(c.expire_date)) : '') + '</td><td class="ec-hide">' + (c && c.has_photo ? '✅' : '—') + '</td>' +
          '<td><button class="ec-btn soft" data-ec="open" data-k="' + esc(p.key) + '">' + (c ? 'แก้ไข / พิมพ์' : 'ทำบัตร') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="7" style="text-align:center;color:#776a86;padding:24px">ไม่พบรายชื่อ</td></tr>') +
      '</tbody></table>';
  }
  // the editor: one person's card, saved to the server, previewed front and back
  function openEdit(key) {
    var p = rows().filter(function (x) { return x.key === key; })[0] || { key: key, name: '', site: '' };
    var c = cardOf(key);
    st.edit = c ? Object.assign({}, c, { photo: st.photos[c.id] || '' })
      : { person_key: key, full_name: p.name, contractor: COMPANY, pea_office: officeOf(p.site), issue_date: today(), expire_date: today().slice(0, 4) + '-12-31', photo: '' };
    st.editOffice = Object.assign({}, st.offices[st.edit.pea_office] || {});
    render(); window.scrollTo(0, 0);
    if (c && c.has_photo && !(c.id in st.photos)) photosFor([c.id]).then(function () { if (st.edit && st.edit.id === c.id) { st.edit.photo = st.photos[c.id]; preview(); } }).catch(function () {});
  }
  function field(label, k, val, type, hint) { return '<label>' + label + (hint ? ' <span class="ec-hint">' + hint + '</span>' : '') + '<input data-f="' + k + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '"></label>'; }
  function renderEdit(w) {
    var c = st.edit, o = st.editOffice || {};
    w.innerHTML = '<div class="ec-bar"><button class="ec-btn soft" data-ec="back">← กลับไปรายชื่อ</button><h2 style="margin:0">' + (c.id ? 'บัตรเลขที่ ' + esc(cardNo(c)) : 'ทำบัตรใหม่') + '</h2></div>' +
      (st.err ? '<div class="ec-err">' + esc(st.err) + '</div>' : '') +
      '<div class="ec-edit"><div class="ec-form">' +
      field('ชื่อ - นามสกุล', 'full_name', c.full_name, 'text', 'คำสุดท้ายคือนามสกุล') +
      field('ผู้รับจ้างเหมา', 'contractor', c.contractor) +
      field('ประจำ กฟฟ.', 'pea_office', c.pea_office, 'text', 'เช่น ภูเขียว') +
      field('วันที่ออกบัตร', 'issue_date', c.issue_date, 'date') +
      field('วันที่บัตรหมดอายุ', 'expire_date', c.expire_date, 'date', 'TOR: 31 ธ.ค. ของปี หรือตามสัญญาจ้าง') +
      '<label class="ec-drop" data-ec="drop">รูปถ่าย 1 นิ้ว <span class="ec-hint">เลือกหรือลากรูปมาวางตรงนี้ แล้วจัดรูปให้ใส่เสื้อฟอร์มบริษัท</span><input type="file" accept="image/*" data-ec="photo"></label>' +
      (c.photo ? '<button class="ec-btn soft" style="margin-top:6px" data-ec="nophoto">ลบรูป</button>' : '') +
      '<h4>ข้อมูล กฟฟ.' + esc(c.pea_office || '') + ' <span class="ec-hint">ใช้กับทุกบัตรของ กฟฟ. นี้</span></h4>' +
      '<label>ชื่อผู้ลงนาม (ผจก.กฟฟ.คู่สัญญา)<input data-o="signer_name" value="' + esc(o.signer_name || '') + '" placeholder="เว้นว่างเพื่อเขียนเอง"></label>' +
      '<label>เบอร์โทร กฟฟ.<input data-o="phone" value="' + esc(o.phone || '') + '"></label>' +
      '<div class="ec-acts"><button class="ec-btn" data-ec="save">💾 ' + (c.id ? 'บันทึก' : 'บันทึกและออกเลขที่บัตร') + '</button>' +
      (c.id ? '<button class="ec-btn" data-ec="print1">🖨 พิมพ์บัตรนี้</button><button class="ec-btn soft" data-ec="renew" title="บัตรชำรุด / สูญหาย / ต่ออายุปีใหม่: ออกเลขที่ใหม่ บัตรเดิมยกเลิก">🔁 ออกบัตรใหม่ (เลขใหม่)</button><button class="ec-btn red" data-ec="del">ยกเลิกบัตร</button>' : '') +
      '</div></div><div class="ec-prev" id="ecPrev"></div></div>';
    preview();
  }
  function preview() {
    var p = document.getElementById('ecPrev'); if (!p || !st.edit) return;
    p.innerHTML = front(st.edit, st.editOffice) + back();
  }
  // a photo, centre-cropped to 4:5 (1 inch photo) and shrunk to 300 x 375 JPEG
  function readPhoto(file) {
    return new Promise(function (ok, bad) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var W = 300, H = 375, r = Math.max(W / img.width, H / img.height), sw = W / r, sh = H / r;
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
        URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('อ่านรูปไม่ได้')); };
      img.src = url;
    });
  }
  // the photo editor (js/uniform-photo.js) puts the person into the company jacket; without it, a plain crop
  function takePhoto(file) {
    if (!file || !/^image\//.test(file.type || '')) { alert('กรุณาเลือกไฟล์รูปภาพ'); return; }
    var p = window.UniformPhoto ? window.UniformPhoto.open(file, { width: 300, height: 375 }) : readPhoto(file);
    p.then(function (d) { if (d && st.edit) { st.edit.photo = d; st.edit.photoChanged = true; render(); } }, function (er) { alert(er.message || er); });
  }
  async function save(renew) {
    var c = st.edit, o = st.editOffice || {};
    if (!String(c.full_name || '').trim()) { alert('กรุณากรอกชื่อ'); return; }
    var body = { person_key: c.person_key, full_name: c.full_name, contractor: c.contractor, pea_office: c.pea_office, issue_date: c.issue_date, expire_date: c.expire_date };
    if (c.id && !renew) body.id = c.id;
    if (renew) { body.issue_date = today(); body.expire_date = today().slice(0, 4) + '-12-31'; }
    if (c.photoChanged || renew || !c.id) body.photo_b64 = c.photo || null;
    st.busy = true;
    try {
      if (c.pea_office) {
        var prev = st.offices[c.pea_office] || {};
        if ((prev.signer_name || '') !== (o.signer_name || '') || (prev.phone || '') !== (o.phone || '')) {
          var oj = await call({ action: 'save_office', office: c.pea_office, signer_name: o.signer_name, phone: o.phone });
          st.offices[c.pea_office] = oj.item;
        }
      }
      if (renew) await call({ action: 'delete_card', id: c.id });
      var j = await call({ action: 'save_card', card: body });
      var it = j.item;
      st.cards = st.cards.filter(function (x) { return x.id !== it.id && !(renew && x.id === c.id); });
      st.cards.push(it);
      st.photos[it.id] = c.photo || '';
      st.edit = Object.assign({}, it, { photo: c.photo || '' });
      st.err = '';
      render();
      if (j.created) alert('ออกบัตรเลขที่ ' + cardNo(it) + ' แล้ว');
    } catch (e) { st.err = 'บันทึกไม่สำเร็จ: ' + (e.message || e); render(); }
    finally { st.busy = false; }
  }

  // ---------------------------------------------------------------- print
  async function printCards(cards) {
    var win = window.open('', '_blank');   // opened first, inside the click, so pop-up blockers allow it
    if (!win) { alert('กรุณาอนุญาต Pop-up เพื่อพิมพ์บัตร'); return; }
    win.document.write('<p style="font-family:sans-serif;padding:20px">กำลังเตรียมบัตร…</p>');
    try {
      await photosFor(cards.filter(function (c) { return c.has_photo; }).map(function (c) { return c.id; }));
      var base = location.origin + '/fonts/';
      var title = cards.length === 1 ? 'บัตรพนักงาน_' + cards[0].full_name + '_' + cardNo(cards[0]).replace('/', '-') : 'บัตรพนักงาน_' + cards.length + 'ใบ_' + today();
      var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
        '@font-face{font-family:Sarabun;src:url(' + base + 'Sarabun-Regular.ttf)}@font-face{font-family:Sarabun;font-weight:700;src:url(' + base + 'Sarabun-Bold.ttf)}' +
        '@page{size:A4 portrait;margin:0}html,body{margin:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' + CARD_CSS +
        '@media screen{body{background:#888}.ec-sheet{background:#fff;margin:10px auto}}' +
        '</style></head><body>' + sheets(cards.map(withPhoto), st.offices) +
        '<script>(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},300)})<\/script></body></html>';
      win.document.open(); win.document.write(html); win.document.close();
    } catch (e) { win.close(); alert('เตรียมบัตรไม่สำเร็จ: ' + (e.message || e)); }
  }
  // selected people: those without a card get one now (next number, no photo: a 1-inch photo can be glued on)
  async function printSelected(btn) {
    var keys = Object.keys(st.sel).filter(function (k) { return st.sel[k]; });
    var missing = keys.filter(function (k) { return !cardOf(k); });
    if (missing.length && !confirm(missing.length + ' คนยังไม่มีบัตร จะออกเลขที่บัตรให้เลย (ยังไม่มีรูป เว้นช่องไว้ติดรูป) ต่อไหม?')) return;
    btn.disabled = true;
    try {
      for (var i = 0; i < missing.length; i++) {
        var p = rows().filter(function (x) { return x.key === missing[i]; })[0];
        var j = await call({ action: 'save_card', card: { person_key: p.key, full_name: p.name, pea_office: officeOf(p.site), issue_date: today(), expire_date: today().slice(0, 4) + '-12-31' } });
        st.cards.push(j.item);
      }
    } catch (e) { alert('ออกบัตรไม่สำเร็จ: ' + (e.message || e)); render(); return; }
    render();
    var cards = keys.map(cardOf).filter(Boolean);
    await printCards(cards);
  }

  // ---------------------------------------------------------------- events
  function onClick(e) {
    var b = e.target.closest('[data-ec]'); if (!b) return;
    var a = b.getAttribute('data-ec'), k = b.getAttribute('data-k');
    if (a === 'open') openEdit(k);
    if (a === 'back') { st.edit = null; st.err = ''; render(); }
    if (a === 'add') { var n = prompt('ชื่อ - นามสกุล ของผู้ถือบัตร'); if (n && n.trim()) { var key = 'm:' + n.trim(); st.edit = null; openEdit(key); st.edit.full_name = n.trim(); render(); } }
    if (a === 'save') save(false);
    if (a === 'renew' && confirm('ออกบัตรใหม่เลขที่ใหม่ (วันที่ออกบัตรวันนี้) และยกเลิกบัตรเลขที่ ' + cardNo(st.edit) + '?')) save(true);
    if (a === 'del' && confirm('ยกเลิกบัตรเลขที่ ' + cardNo(st.edit) + '?')) {
      var id = st.edit.id;
      call({ action: 'delete_card', id: id }).then(function () { st.cards = st.cards.filter(function (x) { return x.id !== id; }); st.edit = null; render(); }, function (er) { alert('ยกเลิกไม่สำเร็จ: ' + (er.message || er)); });
    }
    if (a === 'print1') printCards([st.cards.filter(function (x) { return x.id === st.edit.id; })[0] || st.edit]);
    if (a === 'print') printSelected(b);
    if (a === 'nophoto') { st.edit.photo = ''; st.edit.photoChanged = true; render(); }
  }
  function onInput(e) {
    var t = e.target;
    if (t.getAttribute('data-ec') === 'q') { st.q = t.value; var pos = t.selectionStart; render(); var q = document.querySelector('[data-ec="q"]'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (_) {} } return; }
    var f = t.getAttribute('data-f'), o = t.getAttribute('data-o');
    if (f && st.edit) {
      st.edit[f] = t.value;
      if (f === 'pea_office') st.editOffice = Object.assign({}, st.offices[t.value] || {});
      preview();
    }
    if (o && st.editOffice) { st.editOffice[o] = t.value; preview(); }
  }
  function onChange(e) {
    var t = e.target, a = t.getAttribute('data-ec');
    if (a === 'site') { st.site = t.value; render(); }
    if (a === 'sel') { st.sel[t.getAttribute('data-k')] = t.checked; render(); }
    if (a === 'all') { filtered().forEach(function (p) { st.sel[p.key] = t.checked; }); render(); }
    if (t.getAttribute('data-f') === 'pea_office' && st.edit) render();   // refresh the office block's fields
    if (a === 'photo' && t.files && t.files[0]) {
      takePhoto(t.files[0]); t.value = '';
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
    var nav = document.getElementById('navEmployeeCard'); if (!nav) return;
    var want = isAdmin() ? '' : 'none';
    if (nav.style.display !== want) nav.style.display = want;
  }
  function ensureNav() {
    var side = document.querySelector('.side-nav');
    if (!side || document.getElementById('navEmployeeCard')) return;
    var nav = document.createElement('div');
    nav.className = 'nav-item'; nav.id = 'navEmployeeCard'; nav.style.display = 'none';
    nav.innerHTML = '<span class="nav-ico">🪪</span><span>ทำบัตรพนักงาน</span>';
    nav.addEventListener('click', showPage);
    side.appendChild(nav);
    syncNav();
  }
  function showPage() {
    if (!isAdmin()) { alert('เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    style();
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navEmployeeCard'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    document.documentElement.classList.add('sa-wide');
    st.edit = null;
    window.scrollTo(0, 0);
    render();
    load();
  }
  window.openEmployeeCard = showPage;

  function boot() {
    ensureNav();
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); syncNav(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

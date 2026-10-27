/* ตารางประมูลแจ้งเตือน (2026-10-26)
 * One table of the PEA notice-delivery jobs of the year (the old "70" sheet of ประมูลงานแจ้งเตือน70.xlsx).
 *  - Upload the office's two PDFs, the announcement (ประกาศ…ประกวดราคา) and the TOR (รายละเอียดประกอบใบเสนอราคา):
 *    pdf.js reads their text and fills เขต, ไซด์งาน, วงเงิน, จำนวนราย, วันที่/เวลาเสนอราคา, วิธี, เลขที่เอกสาร.
 *  - เลขที่โครงการ and ราคากลาง are typed (pre-filled when the file name / TOR gives them), like every other cell.
 *  - The menu lists the sites by name; clicking one opens all of its fields (editable, saved automatically).
 *  - Rows live in Supabase (notice_bids) through the edge function notice-bid-api; admin only, like เสนอราคาแจ้งเตือน.
 */
(function () {
  'use strict';
  if (window.__noticeBids) return;
  window.__noticeBids = true;

  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api';
  var VAT = 0.07;
  var st = { rows: null, err: '', busy: '', pending: [], zone: '', q: '', open: null };   // open: id of the site whose details are shown

  // ---------------------------------------------------------------- server
  async function token() {
    try { if (typeof window.getBestDataToken === 'function') { var t = await window.getBestDataToken(); if (t) return t; } } catch (_) {}
    try { return localStorage.getItem('divergent_web_session_token_v1') || localStorage.getItem('divergent_fallback_session_token') || ''; } catch (_) { return ''; }
  }
  async function call(body) {
    var t = await token();
    if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  async function load() {
    try { var j = await call({ action: 'list' }); st.rows = j.items || []; st.err = ''; }
    catch (e) { st.rows = []; st.err = e.message || String(e); }
    render();
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v, d) { return v == null || v === '' || !isFinite(v) ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 2 : d }); }

  // ---------------------------------------------------------------- PDF text → fields
  // Thai fonts in PDFs often store tone marks as Windows "private use" glyphs (U+F700–F71A): map them back
  var PUA = { 0xF700: 0x0E10, 0xF701: 0x0E34, 0xF702: 0x0E35, 0xF703: 0x0E36, 0xF704: 0x0E37, 0xF705: 0x0E48, 0xF706: 0x0E49,
    0xF707: 0x0E4A, 0xF708: 0x0E4B, 0xF709: 0x0E4C, 0xF70A: 0x0E48, 0xF70B: 0x0E49, 0xF70C: 0x0E4A, 0xF70D: 0x0E4B, 0xF70E: 0x0E4C,
    0xF70F: 0x0E0D, 0xF710: 0x0E31, 0xF711: 0x0E4D, 0xF712: 0x0E47, 0xF713: 0x0E48, 0xF714: 0x0E49, 0xF715: 0x0E4A, 0xF716: 0x0E4B,
    0xF717: 0x0E4C, 0xF718: 0x0E38, 0xF719: 0x0E39, 0xF71A: 0x0E3A };
  function thaiText(s) {
    return String(s || '').replace(/[-]/g, function (c) { var m = PUA[c.charCodeAt(0)]; return m ? String.fromCharCode(m) : ''; })
      .replace(/ํา/g, 'ำ')    // ํ + า = ำ
      .replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); });   // Thai digits ๐–๙
  }
  // pdf.js gives pieces in drawing order: put them back into lines (top to bottom, left to right)
  function toLines(items) {
    var list = items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
      return { str: thaiText(i.str), x: i.x, y: i.y, w: i.w, h: i.h || 12, p: i.p || 0 };
    }).sort(function (a, b) { return a.p - b.p || a.y - b.y || a.x - b.x; });
    var lines = [];
    list.forEach(function (i) {
      var L = lines.filter(function (l) { return l.p === i.p && Math.abs(l.y - i.y) <= Math.max(3, i.h * 0.3); })[0];
      if (L) L.items.push(i); else lines.push({ p: i.p, y: i.y, items: [i] });
    });
    return lines.sort(function (a, b) { return a.p - b.p || a.y - b.y; }).map(function (l) {
      var s = '', end = null;
      l.items.sort(function (a, b) { return a.x - b.x; }).forEach(function (i) {
        if (end != null && i.x - end > Math.max(1.5, i.h * 0.2)) s += ' ';
        s += i.str; end = i.x + i.w;
      });
      return s.replace(/\s+/g, ' ').trim();
    });
  }
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var MONTH_RE = '(' + MONTHS.join('|') + '|' + MONTHS_SHORT.map(function (m) { return m.replace(/\./g, '\\.'); }).join('|') + ')';
  var DATE_RE = '(\\d{1,2})\\s*' + MONTH_RE + '\\s*(?:พ\\.\\s*ศ\\.\\s*)?(\\d{4})';
  function isoDate(d, m, y) {
    var mi = MONTHS.indexOf(m); if (mi < 0) mi = MONTHS_SHORT.indexOf(m);
    var yr = Number(y); if (yr > 2400) yr -= 543;
    if (mi < 0 || !yr) return null;
    return yr + '-' + ('0' + (mi + 1)).slice(-2) + '-' + ('0' + Number(d)).slice(-2);
  }
  function amount(s) { var n = Number(String(s || '').replace(/[,\s]/g, '').replace(/\.-?$/, '')); return isFinite(n) && n > 0 ? n : null; }
  // tone marks get lost in some PDFs ("การไฟฟาสวนภูมิภาค"): compare names without them
  function nameKey(s) { return String(s || '').replace(/[ัิ-ฺ็-๎\s.]/g, '').replace(/^(กฟส|กฟจ|กฟอ)/, ''); }

  function extract(items, fileName) {
    var lines = toLines(items), T = lines.join('\n'), F = lines.join(' ').replace(/\s+/g, ' ');
    var out = { file: fileName || '' };
    var head = lines.slice(0, 8).join(' ');
    out.kind = /ระหว่างเวลา|ประกาศ\s*ณ\s*วันที่/.test(F) || /^\(?สำเนา\)?$|^ประกาศ/.test(lines[0] || '') || /^ประกาศ/.test(lines[1] || '') ? 'announce'
      : (/รายละเอียดประกอบ|ปริมาณงาน|ขอบเขตของงาน|ราคากลาง\s*\(/.test(F) ? 'tor' : 'other');
    // office: "การไฟฟ้าส่วนภูมิภาคสาขาพุทไธสง" (marks may be missing), or the short "กฟส.พุทไธสง"
    var m = (head + ' ' + F).match(/การไฟฟ\S{0,2}า\s*ส\S{0,2}วนภูมิภาค\s*(สาขา|จังหวัด|อำเภอ|อ\S{0,2}เภอ)?\s*([ก-๎]+(?:\s?\d)?)/);
    if (m) { out.site = m[2].replace(/(และ|ขอ|มี|จะ)$/, ''); out.office = (/จังหวัด/.test(m[1] || '') ? 'กฟจ.' : 'กฟส.') + out.site; }
    else if ((m = F.match(/กฟ([สจ])\.\s*([ก-๎]+)/))) { out.site = m[2]; out.office = 'กฟ' + m[1] + '.' + m[2]; }
    // project number: 11 digits in the e-GP file name (annoudoc_S50631000002_69099738828.pdf) or in the text
    // (the file name also holds the office code "S50631000002": the project number is the last 11-digit group)
    var ids = String(fileName || '').match(/\d{11}(?!\d)/g) || [];
    m = ids.length ? [0, ids[ids.length - 1]] : F.match(/เลขที่โครงการ\s*:?\s*(\d{11})/);
    if (m) out.project_no = m[1];
    // document no. "ฉ.๓ พธ.(พ.)๐๓๐/๒๕๖๙" → zone ฉ.3
    m = F.match(/เลขที่\s*(ฉ\.\s*\d\s*\S+?\/\d{4})/);
    if (m) out.doc_no = m[1].replace(/\s+/g, ' ').replace(/^ฉ\. /, 'ฉ.');
    m = (out.doc_no || '').match(/ฉ\.\s*(\d)/) || F.match(/(?:กฟฉ|ฉ)\.\s*(\d)(?!\d)/);
    if (m) out.zone = 'ฉ.' + m[1];
    if (/เฉพาะเจาะจง/.test(F)) out.method = 'เฉพาะเจาะจง';
    else if (/e-?\s?bidding|ประกวดราคาอิเล็กทรอนิกส์/i.test(F)) out.method = 'e-bidding';
    else if (/e-?\s?market|ตลาดอิเล็กทรอนิกส์/i.test(F)) out.method = 'e-market';
    // money: "ราคากลางของงานจ้าง … เป็นเงินทั้งสิ้น 616,320.00 บาท", TOR "วงเงินประมาณ รวมภาษีมูลค่าเพิ่ม 616,320.- บาท"
    m = F.match(/ราคากลาง[\s\S]{0,160}?เป็นเงิน(?:ทั้งสิ้น)?\s*([\d,]+(?:\.\d+)?)/) || F.match(/วงเงิน[\s\S]{0,60}?([\d]{1,3}(?:,\d{3})+(?:\.\d+)?)\.?-?\s*บาท/) ||
      F.match(/รวมทั้งสิ้น\s*([\d]{1,3}(?:,\s?\d{3})+(?:\.\d*)?)/);
    if (m) out.budget = amount(m[1]);
    // the day and hours the price is offered
    var re = new RegExp('(?:เสนอราคา|ยื่นข้อเสนอ)[\\s\\S]{0,120}?ในวันที่\\s*' + DATE_RE);
    m = F.match(re);
    if (m) out.bid_date = isoDate(m[1], m[2], m[3]);
    m = F.match(/เวลา\s*(\d{1,2}[.:]\d{2})\s*(?:น\.?)?\s*(?:ถึง|-|–)\s*(?:เวลา\s*)?(\d{1,2}[.:]\d{2})/);
    if (m) out.bid_time = m[1].replace(':', '.') + '-' + m[2].replace(':', '.');
    m = F.match(new RegExp('ประกาศ\\s*ณ\\s*วันที่\\s*' + DATE_RE));
    if (m) out.announce_date = isoDate(m[1], m[2], m[3]);
    // TOR: "ขออนุมัติปริมาณงาน 72,000 ราย"
    m = F.match(/ปริมาณงาน\s*(?:จ\S{0,3}นวน\s*)?([\d]{1,3}(?:,\d{3})+|\d{4,})/) || F.match(/([\d]{1,3}(?:,\d{3})+)\s*ราย/);
    if (m) out.qty = amount(m[1]);
    // ราคากลาง per notice: the budget is qty × price + VAT, so it falls out exactly ("8.-" in the table)
    if (out.qty && out.budget) {
      var p = out.budget / (1 + VAT) / out.qty, r = Math.round(p * 100) / 100;
      if (Math.abs(p - r) < 0.0005 && r > 0 && r < 100) out.mid_price = r;
    }
    out.text = T;
    return out;
  }
  // announcement + TOR of the same office become one row; announcement wins for dates/money, TOR for quantities
  function mergeDocs(docs) {
    var groups = [];
    docs.forEach(function (d) {
      var k = nameKey(d.site);
      var g = groups.filter(function (x) { return (k && x.key === k) || (d.project_no && x.project_no === d.project_no); })[0];
      if (!g) { g = { key: k, project_no: d.project_no, docs: [] }; groups.push(g); }
      g.docs.push(d);
    });
    // two files where one could not be named: still one job
    if (groups.length === 2 && docs.length === 2 && (!groups[0].key || !groups[1].key)) { groups[0].docs = groups[0].docs.concat(groups[1].docs); groups.length = 1; }
    return groups.map(function (g) {
      var ann = g.docs.filter(function (d) { return d.kind === 'announce'; }), tor = g.docs.filter(function (d) { return d.kind !== 'announce'; });
      var order = ann.concat(tor), torFirst = tor.concat(ann), row = { files: g.docs.map(function (d) { return d.file; }) };
      ['site', 'office', 'zone', 'project_no', 'doc_no', 'method', 'budget', 'bid_date', 'bid_time', 'announce_date'].forEach(function (k) {
        var d = order.filter(function (x) { return x[k] != null && x[k] !== ''; })[0]; if (d) row[k] = d[k];
      });
      ['qty', 'mid_price'].forEach(function (k) { var d = torFirst.filter(function (x) { return x[k] != null; })[0]; if (d) row[k] = d[k]; });
      if (!row.mid_price && row.qty && row.budget) {
        var p = row.budget / (1 + VAT) / row.qty, r = Math.round(p * 100) / 100; if (Math.abs(p - r) < 0.0005) row.mid_price = r;
      }
      row.has_announce = ann.length > 0; row.has_tor = tor.length > 0;
      return row;
    });
  }
  // ---------------------------------------------------------------- end of extraction

  // ---------------------------------------------------------------- pdf.js
  var pdfjsReady = null;
  function loadPdfJs() {
    if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.GlobalWorkerOptions.workerSrc || PDFJS_WORKER; return Promise.resolve(window.pdfjsLib); }
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = loadScript(PDFJS).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return window.pdfjsLib; });
    return pdfjsReady;
  }
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = ok; s.onerror = function () { fail(new Error('โหลดไลบรารีไม่สำเร็จ: ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function readPdf(file) {
    var lib = await loadPdfJs();
    var pdf = await lib.getDocument({ data: file.bytes }).promise;
    var items = [];
    for (var n = 1; n <= Math.min(pdf.numPages, 6); n++) {
      var page = await pdf.getPage(n), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
      tc.items.forEach(function (i) {
        var t = lib.Util.transform(vp.transform, i.transform);
        items.push({ p: n - 1, str: i.str, x: t[4], y: t[5], w: i.width, h: Math.hypot(t[2], t[3]) });
      });
    }
    return extract(items, file.name);
  }
  // The bytes are copied the moment the files are picked or dropped, before the page is redrawn and the
  // file input is cleared (like เสนอราคาแจ้งเตือน), so nothing can reach pdf.js empty.
  async function openFiles(list) {
    list = [].filter.call(list || [], function (f) { return /pdf$/i.test(f.type || f.name); });
    if (!list.length) return;
    var files = await Promise.all(list.map(function (f) {
      return f.arrayBuffer().then(function (b) { return { name: f.name, bytes: new Uint8Array(b) }; }, function (e) { return { name: f.name, bytes: new Uint8Array(0), err: e }; });
    }));
    var empty = files.filter(function (f) { return !f.bytes.length; });
    if (empty.length) alert('ไฟล์ ' + empty.map(function (f) { return f.name; }).join(', ') + ' ว่างเปล่า (0 ไบต์) อ่านไม่ได้\n' +
      'มักเกิดจากไฟล์ยังดาวน์โหลดไม่เสร็จ หรือไฟล์อยู่บน OneDrive แต่ยังไม่ได้ดาวน์โหลดลงเครื่อง\nให้เปิดไฟล์ในเครื่องหนึ่งครั้ง หรือดาวน์โหลดจาก e-GP ใหม่ แล้ววางอีกครั้ง');
    files = files.filter(function (f) { return f.bytes.length; });
    if (!files.length) return;
    st.busy = 'กำลังอ่านไฟล์ ' + files.length + ' ไฟล์…'; render();
    var docs = [];
    for (var i = 0; i < files.length; i++) {
      try { docs.push(await readPdf(files[i])); }
      catch (e) { console.error('notice-bids', e); alert('อ่านไฟล์ ' + files[i].name + ' ไม่สำเร็จ: ' + (e.message || e)); }
    }
    st.busy = '';
    mergeDocs(docs).forEach(function (r) { r.target = matchRow(r); st.pending.push(r); });
    if (docs.length && !docs.some(function (d) { return d.site || d.budget || d.qty; }))
      alert('ไม่พบข้อมูลในไฟล์ (ไฟล์อาจเป็นภาพสแกน) กรุณากรอกเอง');
    render();
  }
  function matchRow(r) {
    var rows = st.rows || [], k = nameKey(r.site);
    var hit = rows.filter(function (x) { return r.project_no && x.project_no === r.project_no; })[0] ||
      rows.filter(function (x) { return k && nameKey(x.site) === k; })[0];
    return hit ? hit.id : 0;
  }

  // ---------------------------------------------------------------- numbers shown in the table
  function derived(r) {
    var qty = Number(r.qty) || null, est = false;
    if (!qty && r.budget && r.mid_price) { qty = Math.round(r.budget / (1 + VAT) / r.mid_price); est = true; }
    return {
      qty: qty, est: est,
      budgetMonth: r.budget ? r.budget / 12 : null,
      qtyMonth: qty ? qty / 12 : null,
      value: qty && r.price_bid ? qty * r.price_bid * (1 + VAT) : null
    };
  }
  function thaiDate(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return Number(p[2]) + '/' + Number(p[1]) + '/' + (Number(p[0]) + 543); }
  function parseThaiDate(s) {
    s = String(s || '').trim(); if (!s) return null;
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (!m) return undefined;
    var y = Number(m[3]); if (y < 100) y += 2500; if (y > 2400) y -= 543;
    var d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    if (d.getUTCDate() !== Number(m[1])) return undefined;
    return d.toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------- saving
  var FIELDS = ['zone', 'site', 'office', 'project_no', 'budget', 'qty', 'mid_price', 'price_prev', 'price_bid', 'bid_date', 'bid_time', 'method', 'doc_no', 'announce_date', 'status', 'note'];
  var NUMS = { budget: 1, qty: 1, mid_price: 1, price_prev: 1, price_bid: 1 };
  async function saveRow(row) {
    var body = { action: 'save', id: row.id || undefined, row: {} };
    FIELDS.forEach(function (k) { if (k in row) body.row[k] = row[k]; });
    if (row.files) body.row.source = { files: row.files, read_at: new Date().toISOString() };
    var j = await call(body);
    return j.item;
  }
  async function confirmPending(i) {
    var r = st.pending[i]; if (!r) return;
    var base = r.target ? (st.rows || []).filter(function (x) { return x.id === r.target; })[0] : null;
    var row = { id: r.target || undefined, files: r.files };
    // values read from the PDFs replace the row's; what the PDFs did not give stays as typed
    FIELDS.forEach(function (k) { if (r[k] != null && r[k] !== '') row[k] = r[k]; });
    if (base && base.project_no && !r.project_no) delete row.project_no;
    try {
      st.busy = 'กำลังบันทึก…'; render();
      var item = await saveRow(row);
      st.pending.splice(i, 1);
      upsertLocal(item);
    } catch (e) { alert('บันทึกไม่สำเร็จ: ' + (e.message || e)); }
    st.busy = ''; render();
  }
  function upsertLocal(item) {
    if (!item) return;
    st.rows = st.rows || [];
    var i = st.rows.findIndex(function (x) { return x.id === item.id; });
    if (i >= 0) st.rows[i] = item; else st.rows.push(item);
  }
  var cellTimers = {};
  function cellChanged(id, key, raw) {
    var row = (st.rows || []).filter(function (x) { return x.id === id; })[0]; if (!row) return;
    var v = raw.trim();
    if (key === 'bid_date' || key === 'announce_date') { v = parseThaiDate(v); if (v === undefined) { flash(id, key, 'รูปแบบวันที่ วว/ดด/ปปปป'); return; } }
    else if (NUMS[key]) {
      if (v === '') v = null;
      else if (!isFinite(Number(v.replace(/,/g, '')))) {
        // a word in a price cell ("ยกเลิก") is a status, as in the old sheet
        if (key === 'price_bid' || key === 'price_prev') { row.status = v; v = null; } else { flash(id, key, 'ต้องเป็นตัวเลข'); return; }
      } else v = Number(v.replace(/,/g, ''));
    } else if (v === '') v = null;
    row[key] = v;
    updateDerived(row);
    clearTimeout(cellTimers[id]);
    setRowState(id, 'saving');
    cellTimers[id] = setTimeout(async function () {
      try {
        var item = await saveRow(row);
        Object.keys(item).forEach(function (k) { if (k === 'updated_at' || k === 'id') row[k] = item[k]; });
        setRowState(id, 'ok');
      } catch (e) { setRowState(id, 'err'); console.error('notice-bids save', e); alert('บันทึกไม่สำเร็จ: ' + (e.message || e)); }
    }, 700);
  }
  function flash(id, key, msg) { var el = page().querySelector('[data-id="' + id + '"][data-k="' + key + '"]'); if (el) { el.classList.add('nb-bad'); el.title = msg; } }
  function setRowState(id, s) { var tr = page().querySelector('[data-row="' + id + '"]'); if (tr) tr.setAttribute('data-state', s); }
  function updateDerived(row) {
    var tr = page().querySelector('[data-row="' + row.id + '"]'); if (!tr) return;
    var d = derived(row);
    var set = function (k, v) { var el = tr.querySelector('[data-d="' + k + '"]'); if (el) el.innerHTML = v; };
    set('bm', fmt(d.budgetMonth, 2)); set('qm', fmt(d.qtyMonth, 0)); set('val', fmt(d.value, 2));
    var q = tr.querySelector('[data-k="qty"]'); if (q) q.placeholder = d.est ? fmt(d.qty) : '';
    var s = tr.querySelector('[data-k="status"]'); if (s && document.activeElement !== s) s.value = row.status || '';
    var h = tr.querySelector('[data-d="name"]'); if (h) h.textContent = row.site || '(ไม่มีชื่อไซด์)';
  }
  async function addRow() {
    try { var item = await saveRow({ zone: st.zone || null, site: 'ไซด์ใหม่' }); upsertLocal(item); st.open = item.id; render(); }
    catch (e) { alert('เพิ่มแถวไม่สำเร็จ: ' + (e.message || e)); }
  }
  async function deleteRow(id) {
    var row = (st.rows || []).filter(function (x) { return x.id === id; })[0];
    if (!row || !confirm('ลบแถว "' + (row.site || '') + '" ออกจากตาราง?')) return;
    try { await call({ action: 'delete', id: id }); st.rows = st.rows.filter(function (x) { return x.id !== id; }); st.open = null; render(); }
    catch (e) { alert('ลบไม่สำเร็จ: ' + (e.message || e)); }
  }

  // ---------------------------------------------------------------- Excel
  async function exportExcel() {
    if (!window.XLSX) await loadScript(XLSX_SRC);
    var head = ['ลำดับ', 'เขต', 'ไซด์งาน', 'เลขที่โครงการ', 'วงเงิน', 'วงเงิน/เดือน', 'จำนวนราย/ปี', 'จำนวนราย/เดือน', 'ราคากลาง', 'ราคาปี69', 'ราคาปี70', 'มูลค่าที่ราคาปี70 (รวม VAT)', 'วันที่', 'เวลา', 'วิธี', 'เลขที่เอกสาร', 'สถานะ', 'หมายเหตุ'];
    var data = [head].concat(visibleRows().map(function (r, i) {
      var d = derived(r);
      return [i + 1, r.zone || '', r.site || '', r.project_no || '', r.budget, d.budgetMonth, d.qty, d.qtyMonth == null ? null : Math.round(d.qtyMonth), r.mid_price, r.price_prev, r.price_bid,
        d.value == null ? null : Math.round(d.value * 100) / 100, thaiDate(r.bid_date), r.bid_time || '', r.method || '', r.doc_no || '', r.status || '', r.note || ''];
    }));
    var ws = window.XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = head.map(function (h, i) { return { wch: [6, 6, 16, 14, 13, 12, 12, 12, 9, 9, 9, 16, 11, 12, 12, 20, 10, 24][i] }; });
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, '70');
    var d = new Date();
    window.XLSX.writeFile(wb, 'ประมูลงานแจ้งเตือน70_' + ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + (d.getFullYear() + 543) + '.xlsx');
  }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('nbStyle')) return;
    var s = document.createElement('style'); s.id = 'nbStyle';
    s.textContent = '.nb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;flex-wrap:wrap}.nb-head h2{margin:0 0 4px}.nb-head p{margin:0;color:#6b5d7a}' +
      '.nb-card{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:14px;margin-bottom:14px}' +
      '.nb-drop{border:2px dashed #cdbce0;border-radius:12px;padding:16px;text-align:center;color:#5a2787;cursor:pointer;background:#faf8fc}.nb-drop.drag{background:#efe6f8}' +
      '.nb-btn{border:0;border-radius:9px;padding:8px 13px;font-weight:800;cursor:pointer;background:#4b2378;color:#fff;font:inherit}.nb-btn.soft{background:#f2ebfa;color:#5a2787}.nb-btn:disabled{opacity:.45}' +
      '.nb-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.nb-bar select,.nb-bar input{border:1px solid #d9cfdf;border-radius:8px;padding:7px 8px;font:inherit}' +
      '.nb-pend{border:1px solid #e3d5f1;background:#fbf8fe;border-radius:12px;padding:12px;margin-top:12px}.nb-pend h4{margin:0 0 8px;color:#4d2376}.nb-pend small{color:#776a86}' +
      '.nb-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px 12px;margin:8px 0}.nb-form label{display:flex;flex-direction:column;font-size:12px;color:#5f5070;gap:3px}' +
      '.nb-form input,.nb-form select{border:1px solid #d9cfdf;border-radius:8px;padding:6px 8px;font:inherit;font-size:14px}.nb-form .miss input{border-color:#e0a24a;background:#fff8ec}' +
      '.nb-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}' +
      '.nb-site{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #e5dced;border-radius:10px;background:#fff;padding:10px 12px;font:inherit;font-weight:700;color:#3b2252;cursor:pointer}' +
      '.nb-site:hover{border-color:#7b4bab;background:#faf6fd}.nb-site .no{min-width:26px;color:#8a7a9a;font-weight:600;font-size:12px}.nb-site .go{margin-left:auto;color:#a08cb6}' +
      '.nb-site .nm{display:flex;flex-direction:column;gap:2px}.nb-site small{font-weight:600;font-size:12px;color:#6b5d7a}.nb-site.today{border-color:#3a9a5b;background:#f2fbf5}.nb-site.today small{color:#2d7a47}' +
      '.nb-site.past{opacity:.6}' +
      '.nb-count{margin-top:10px;color:#6b5d7a;font-weight:700}' +
      '.nb-detail{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:16px}.nb-detail h3{margin:6px 0 2px;color:#4b2378;font-size:20px}' +
      '.nb-detail[data-state=saving]{box-shadow:inset 4px 0 #e0a24a}.nb-detail[data-state=err]{box-shadow:inset 4px 0 #d33}.nb-detail[data-state=ok]{box-shadow:inset 4px 0 #3a9a5b}' +
      '.nb-detail .nb-form input.r{text-align:right}.nb-detail .nb-form input.nb-bad{border-color:#d33;background:#fff0f0}' +
      '.nb-ro{border:1px solid #eee7f4;border-radius:8px;padding:6px 8px;background:#f8f5fb;min-height:20px;text-align:right;font-size:14px;color:#3b2252}' +
      '.nb-empty{color:#776a86;padding:30px;text-align:center}' +
      '.nb-tag{display:inline-block;border-radius:6px;padding:1px 6px;font-size:11px;background:#efe6f8;color:#5a2787;margin-left:4px}';
    document.head.appendChild(s);
  }
  function page() {
    var w = document.getElementById('noticeBidsWorkspace');
    if (w) return w;
    w = document.createElement('section');
    w.id = 'noticeBidsWorkspace'; w.style.display = 'none';
    (document.querySelector('main.main-shell') || document.querySelector('main') || document.body).appendChild(w);
    w.addEventListener('click', function (e) {
      var b = e.target.closest('[data-nb]'); if (!b) return;
      var a = b.getAttribute('data-nb'), i = +b.getAttribute('data-i');
      if (a === 'pick') w.querySelector('#nbFile').click();
      if (a === 'add') addRow();
      if (a === 'xlsx') exportExcel().catch(function (er) { alert('ส่งออก Excel ไม่สำเร็จ: ' + (er.message || er)); });
      if (a === 'del') deleteRow(i);
      if (a === 'open') { st.open = i; render(); window.scrollTo(0, 0); }
      if (a === 'back') { st.open = null; render(); }
      if (a === 'ok') confirmPending(i);
      if (a === 'drop') { st.pending.splice(i, 1); render(); }
      if (a === 'reload') { st.rows = null; render(); load(); }
    });
    w.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'nbFile') { openFiles(t.files).finally(function () { t.value = ''; }); return; }
      if (t.id === 'nbZone') { st.zone = t.value; render(); return; }
      var pi = t.getAttribute('data-p');
      if (pi != null) {
        var r = st.pending[+pi], k = t.getAttribute('data-k'), v = t.value.trim();
        if (k === 'target') r.target = +v;
        else if (k === 'bid_date' || k === 'announce_date') r[k] = parseThaiDate(v) || null;
        else if (NUMS[k]) r[k] = v === '' ? null : Number(v.replace(/,/g, '')) || null;
        else r[k] = v || null;
        return;
      }
      var id = t.getAttribute('data-id'); if (id != null) cellChanged(+id, t.getAttribute('data-k'), t.value);
    });
    w.addEventListener('input', function (e) { if (e.target.id === 'nbQ') { st.q = e.target.value; clearTimeout(w._q); w._q = setTimeout(function () { renderTable(); }, 200); } else e.target.classList.remove('nb-bad'); });
    w.addEventListener('dragover', function (e) { e.preventDefault(); var d = w.querySelector('.nb-drop'); if (d) d.classList.add('drag'); });
    w.addEventListener('dragleave', function () { var d = w.querySelector('.nb-drop'); if (d) d.classList.remove('drag'); });
    w.addEventListener('drop', function (e) { e.preventDefault(); var d = w.querySelector('.nb-drop'); if (d) d.classList.remove('drag'); openFiles(e.dataTransfer.files); });
    return w;
  }
  function visibleRows() {
    var q = nameKey(st.q);
    return (st.rows || []).filter(function (r) {
      if (st.zone && (r.zone || '') !== (st.zone === '-' ? '' : st.zone)) return false;
      return !q || nameKey(r.site).indexOf(q) >= 0 || String(r.project_no || '').indexOf(st.q.trim()) >= 0;
    }).sort(function (a, b) { return (a.seq || 1e9) - (b.seq || 1e9) || a.id - b.id; });
  }
  // the site list: auctions from today on first (soonest first), then sites without a date, then auctions already past
  function todayIso() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }   // Bangkok calendar day
  function byAuction(rows) {
    var today = todayIso();
    var group = function (r) { return !r.bid_date ? 1 : (String(r.bid_date).slice(0, 10) >= today ? 0 : 2); };
    return rows.slice().sort(function (a, b) {
      return group(a) - group(b) || String(a.bid_date || '').localeCompare(String(b.bid_date || '')) ||
        String(a.bid_time || '').localeCompare(String(b.bid_time || '')) || (a.seq || 1e9) - (b.seq || 1e9) || a.id - b.id;
    });
  }
  function pendingHtml() {
    if (!st.pending.length) return '';
    var opts = function (sel) {
      return '<option value="0"' + (sel ? '' : ' selected') + '>➕ เพิ่มเป็นแถวใหม่</option>' + (st.rows || []).slice().sort(function (a, b) { return String(a.site).localeCompare(String(b.site), 'th'); })
        .map(function (x) { return '<option value="' + x.id + '"' + (x.id === sel ? ' selected' : '') + '>แทนแถว: ' + esc((x.zone ? x.zone + ' ' : '') + x.site) + '</option>'; }).join('');
    };
    var F = [['zone', 'เขต'], ['site', 'ไซด์งาน'], ['project_no', 'เลขที่โครงการ (กรอกเอง)'], ['mid_price', 'ราคากลาง/ราย (กรอกเอง)'], ['budget', 'วงเงิน (รวม VAT)'], ['qty', 'จำนวนราย/ปี'],
      ['bid_date', 'วันที่เสนอราคา (วว/ดด/ปปปป)'], ['bid_time', 'เวลา'], ['method', 'วิธี'], ['doc_no', 'เลขที่เอกสาร'], ['announce_date', 'วันที่ประกาศ']];
    return st.pending.map(function (r, i) {
      var miss = [];
      if (!r.has_announce) miss.push('ประกาศ'); if (!r.has_tor) miss.push('TOR');
      return '<div class="nb-pend"><h4>ข้อมูลจาก PDF: ' + esc(r.office || r.site || 'ไม่ทราบสาขา') + '</h4><small>' + esc(r.files.join(' • ')) +
        (miss.length ? ' — ยังไม่มีไฟล์' + miss.join('/') + ' (ช่องที่ขาดกรอกเองได้)' : '') + '</small><div class="nb-form">' +
        F.map(function (f) {
          var v = r[f[0]]; if (f[0] === 'bid_date' || f[0] === 'announce_date') v = thaiDate(v);
          var empty = v == null || v === '';
          return '<label class="' + (empty ? 'miss' : '') + '">' + f[1] + '<input data-p="' + i + '" data-k="' + f[0] + '" value="' + esc(empty ? '' : v) + '"></label>';
        }).join('') +
        '<label>บันทึกลง<select data-p="' + i + '" data-k="target">' + opts(r.target) + '</select></label></div>' +
        '<div class="nb-bar"><button class="nb-btn" data-nb="ok" data-i="' + i + '">✔ บันทึกลงตาราง</button><button class="nb-btn soft" data-nb="drop" data-i="' + i + '">ยกเลิก</button></div></div>';
    }).join('');
  }
  // the menu lists the sites by name only; a site's details open when its name is clicked
  function renderTable() {
    var box = document.getElementById('nbTable'); if (!box) return;
    if (st.rows == null) { box.innerHTML = '<div class="nb-empty">กำลังโหลด…</div>'; return; }
    if (st.err) { box.innerHTML = '<div class="nb-empty">โหลดตารางไม่สำเร็จ: ' + esc(st.err) + ' <button class="nb-btn soft" data-nb="reload">ลองใหม่</button></div>'; return; }
    var open = st.open != null ? (st.rows || []).filter(function (x) { return x.id === st.open; })[0] : null;
    if (open) { box.innerHTML = detailHtml(open); return; }
    st.open = null;
    var rows = byAuction(visibleRows()), today = todayIso();
    box.innerHTML = rows.length ? '<div class="nb-list">' + rows.map(function (r, i) {
      var day = r.bid_date ? String(r.bid_date).slice(0, 10) : '';
      var when = day ? (day === today ? '<b>วันนี้</b> ' : '') + thaiDate(day) + (r.bid_time ? ' · ' + esc(r.bid_time) + ' น.' : '') + (day < today ? ' · ประมูลไปแล้ว' : '') : 'ยังไม่มีวันประมูล';
      return '<button class="nb-site' + (day && day < today ? ' past' : '') + (day === today ? ' today' : '') + '" data-nb="open" data-i="' + r.id + '"><span class="no">' + (i + 1) + '</span>' +
        '<span class="nm">' + esc(r.site || '(ไม่มีชื่อไซด์)') + '<small>' + when + '</small></span><span class="go">›</span></button>';
    }).join('') + '</div><div class="nb-count">รวม ' + rows.length + ' ไซด์</div>' : '<div class="nb-empty">ยังไม่มีข้อมูล</div>';
  }
  function field(r, k, label, cls) {
    var v = r[k]; if (k === 'bid_date' || k === 'announce_date') v = thaiDate(v);
    if (k === 'budget' && v != null) v = fmt(v, 2);
    return '<label>' + label + '<input class="' + (cls || '') + '" data-id="' + r.id + '" data-k="' + k + '" value="' + esc(v == null ? '' : v) + '"></label>';
  }
  function shown(label, key, v) { return '<label>' + label + '<div class="nb-ro" data-d="' + key + '">' + v + '</div></label>'; }
  function detailHtml(r) {
    var d = derived(r);
    return '<div class="nb-bar"><button class="nb-btn soft" data-nb="back">← กลับไปรายชื่อไซด์</button></div>' +
      '<div class="nb-detail" data-row="' + r.id + '"><h3 data-d="name">' + esc(r.site || '(ไม่มีชื่อไซด์)') + '</h3><small>แก้ไขได้ทุกช่อง บันทึกอัตโนมัติ</small><div class="nb-form">' +
      field(r, 'zone', 'เขต') + field(r, 'site', 'ไซด์งาน') + field(r, 'office', 'สาขา') + field(r, 'project_no', 'เลขที่โครงการ') +
      field(r, 'budget', 'วงเงิน (รวม VAT)', 'r') + shown('วงเงิน/เดือน', 'bm', fmt(d.budgetMonth, 2)) +
      '<label>จำนวนราย/ปี<input class="r" data-id="' + r.id + '" data-k="qty" value="' + esc(r.qty == null ? '' : fmt(r.qty)) + '" placeholder="' + (d.est ? fmt(d.qty) : '') + '" title="ว่าง = คำนวณจากวงเงิน ÷ 1.07 ÷ ราคากลาง"></label>' +
      shown('จำนวนราย/เดือน', 'qm', fmt(d.qtyMonth, 0)) +
      field(r, 'mid_price', 'ราคากลาง', 'r') + field(r, 'price_prev', 'ราคาปี69', 'r') + field(r, 'price_bid', 'ราคาปี70', 'r') + shown('มูลค่าที่ราคาปี70 (รวม VAT)', 'val', fmt(d.value, 2)) +
      field(r, 'bid_date', 'วันที่เสนอราคา (วว/ดด/ปปปป)') + field(r, 'bid_time', 'เวลา') + field(r, 'method', 'วิธี') + field(r, 'doc_no', 'เลขที่เอกสาร') +
      field(r, 'announce_date', 'วันที่ประกาศ (วว/ดด/ปปปป)') + field(r, 'status', 'สถานะ') + field(r, 'note', 'หมายเหตุ') +
      '</div><div class="nb-bar"><button class="nb-btn soft" data-nb="del" data-i="' + r.id + '">🗑 ลบไซด์นี้</button></div></div>';
  }
  function render() {
    var w = page();
    var zones = {}; (st.rows || []).forEach(function (r) { zones[r.zone || '-'] = 1; });
    w.innerHTML = '<div class="nb-head"><div><h2>ตารางประมูลแจ้งเตือน ปี 2570</h2><p>วางไฟล์ PDF ประกาศ + TOR ระบบอ่านข้อมูลเข้าตาราง • กดชื่อไซด์เพื่อดูและแก้รายละเอียด บันทึกอัตโนมัติ</p></div></div>' +
      '<div class="nb-card"><input type="file" id="nbFile" accept="application/pdf,.pdf" multiple hidden>' +
      '<div class="nb-drop" data-nb="pick">' + (st.busy ? esc(st.busy) : '📄 กดเพื่อเลือกไฟล์ PDF ประกาศ และ TOR (เลือกหลายไฟล์พร้อมกันได้)<br><small>หรือลากไฟล์มาวางที่นี่</small>') + '</div>' + pendingHtml() + '</div>' +
      '<div class="nb-bar"' + (st.open != null ? ' style="display:none"' : '') + '><select id="nbZone"><option value="">ทุกเขต</option>' + Object.keys(zones).sort().map(function (z) { return '<option value="' + esc(z) + '"' + (z === st.zone ? ' selected' : '') + '>' + (z === '-' ? 'ไม่ระบุเขต' : esc(z)) + '</option>'; }).join('') + '</select>' +
      '<input id="nbQ" placeholder="ค้นหาไซด์งาน / เลขที่โครงการ" value="' + esc(st.q) + '">' +
      '<button class="nb-btn soft" data-nb="add">➕ เพิ่มแถว</button><button class="nb-btn soft" data-nb="xlsx">⬇ Excel</button></div>' +
      '<div id="nbTable"></div>';
    renderTable();
  }

  // ---------------------------------------------------------------- menu (admin only, like เสนอราคาแจ้งเตือน)
  function isAdmin() {
    var u = window.currentMenuUser || null;
    if (!u) { try { u = JSON.parse(localStorage.getItem('divergent_web_session_user') || 'null'); } catch (_) { u = null; } }
    var role = (u && u.role) || (window.qcAuthorizedUser && window.qcAuthorizedUser.user_role) || '';
    return String(role).toLowerCase() === 'admin';
  }
  function syncNav() {
    var nav = document.getElementById('navNoticeBids'); if (!nav) return;
    var want = isAdmin() ? '' : 'none';
    if (nav.style.display !== want) nav.style.display = want;
  }
  function ensureNav() {
    var side = document.querySelector('.side-nav');
    if (!side || document.getElementById('navNoticeBids')) return;
    var nav = document.createElement('div');
    nav.className = 'nav-item'; nav.id = 'navNoticeBids'; nav.style.display = 'none';
    nav.innerHTML = '<span class="nav-ico">📊</span><span>ตารางประมูลแจ้งเตือน</span>';
    nav.addEventListener('click', showPage);
    var ref = document.getElementById('navQuoteNotice');
    if (ref) ref.insertAdjacentElement('afterend', nav); else side.appendChild(nav);
    syncNav();
  }
  function showPage() {
    if (!isAdmin()) { alert('เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navNoticeBids'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    st.open = null;
    document.documentElement.classList.add('sa-wide');
    window.scrollTo(0, 0);
    render();
    if (st.rows == null || st.err) load();
    loadPdfJs().catch(function () {});
  }
  window.openNoticeBids = showPage;

  function boot() {
    style(); ensureNav();
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); syncNav(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

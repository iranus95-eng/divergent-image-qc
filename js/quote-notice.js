/* เสนอราคาแจ้งเตือน (2026-10-15)
 * Upload the PEA quotation PDF as it is (every office's form differs), type the unit price, and the
 * same PDF file is saved / printed with the numbers filled in — it goes into the PEA system, so the
 * original file is kept 100%: pdf-lib adds only the digits on top of its pages (nothing re-drawn).
 *  - pdf.js reads the text positions and renders the on-screen preview.
 *  - Tables are found from their column headers (ราคา/หน่วย, จำนวนเงิน, ภาษีมูลค่าเพิ่ม, รวมเป็นเงินทั้งสิ้น)
 *    and every quantity under "จำนวน" becomes a row: amount = qty × unit price, VAT 7%, total.
 *  - Only the unit price is typed; everything else is calculated.
 */
(function () {
  'use strict';
  if (window.__quoteNotice) return;
  window.__quoteNotice = true;

  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var RENDER_SCALE = 3;          // page pixels per PDF point for printing (≈216 dpi)
  var VAT = 0.07;
  var PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  // Digits are written as outlines of Sarabun ExtraLight (SIL Open Font License, Cadson Demak / Google Fonts),
  // the same design and stroke as the TH SarabunPSK digits in the PEA forms. Units: 1000 per em, y down, baseline 0.
  var UPM = 1000;
  var GLYPHS = {"0":[540,"M47 -350Q47 -528 104 -619Q162 -710 270 -710Q378 -710 436 -619Q493 -528 493 -350Q493 -172 436 -81Q378 10 270 10Q162 10 104 -81Q47 -172 47 -350ZM437 -350Q437 -503 394 -583Q350 -663 270 -663Q190 -663 146 -584Q103 -504 103 -350Q103 -197 146 -117Q190 -37 270 -37Q350 -37 394 -117Q437 -197 437 -350Z"],"1":[540,"M138 -50H262V-630L119 -546V-599L284 -700H318V-50H441V0H138Z"],"2":[540,"M70 -58Q145 -114 219 -192Q293 -270 344 -357Q394 -444 394 -520Q394 -585 356 -623Q319 -661 254 -661Q201 -661 154 -637Q107 -613 82 -575L53 -612Q82 -657 136 -684Q190 -710 255 -710Q345 -710 398 -659Q451 -608 451 -523Q451 -402 356 -277Q262 -152 140 -50H487V0H70Z"],"3":[540,"M52 -89 82 -126Q107 -85 156 -62Q205 -39 262 -39Q338 -39 384 -80Q431 -120 431 -185Q431 -258 372 -300Q313 -341 212 -341H194V-393H212Q270 -393 314 -412Q357 -432 380 -467Q404 -502 404 -545Q404 -600 368 -630Q332 -661 270 -661Q214 -661 167 -638Q120 -614 94 -574L64 -611Q93 -657 148 -684Q203 -710 270 -710Q357 -710 408 -667Q460 -624 460 -552Q460 -487 420 -438Q379 -388 310 -369Q394 -355 441 -306Q488 -258 488 -184Q488 -127 460 -83Q432 -39 381 -14Q330 10 263 10Q193 10 136 -16Q80 -43 52 -89Z"],"4":[540,"M365 -129H30V-178L346 -700H421V-177H504V-129H421V0H365ZM365 -177V-641L84 -177Z"],"5":[540,"M52 -89 82 -126Q107 -86 154 -62Q200 -39 256 -39Q336 -39 382 -88Q429 -138 429 -224Q429 -306 386 -355Q343 -404 270 -404Q224 -404 185 -385Q146 -366 124 -334H77L109 -700H464V-651H160L140 -405Q163 -427 202 -440Q241 -452 283 -452Q377 -452 432 -391Q488 -330 488 -226Q488 -118 426 -54Q364 10 258 10Q189 10 134 -16Q79 -43 52 -89Z"],"6":[540,"M51 -248Q51 -356 101 -454Q151 -553 238 -621Q324 -689 428 -710L435 -666Q360 -647 296 -602Q231 -557 186 -495Q141 -433 123 -363Q146 -398 186 -419Q227 -440 283 -440Q348 -440 394 -410Q441 -379 466 -328Q490 -276 490 -214Q490 -150 464 -100Q439 -49 390 -20Q342 10 276 10Q207 10 156 -22Q106 -53 78 -112Q51 -170 51 -248ZM435 -215Q435 -294 391 -342Q347 -391 274 -391Q202 -391 158 -342Q113 -294 113 -215Q113 -136 158 -88Q202 -39 274 -39Q347 -39 391 -88Q435 -136 435 -215Z"],"7":[540,"M423 -651H60V-700H481V-640Q370 -515 312 -358Q254 -200 254 0H197Q201 -121 218 -222Q235 -323 284 -432Q332 -542 423 -651Z"],"8":[540,"M44 -189Q44 -254 75 -302Q106 -350 170 -374Q122 -393 96 -438Q69 -482 69 -537Q69 -617 123 -664Q177 -710 270 -710Q363 -710 417 -664Q471 -617 471 -537Q471 -481 444 -437Q418 -393 371 -374Q434 -350 465 -302Q496 -254 496 -189Q496 -97 436 -44Q376 10 270 10Q164 10 104 -44Q44 -97 44 -189ZM415 -530Q415 -591 378 -626Q340 -661 270 -661Q200 -661 162 -626Q125 -591 125 -530Q125 -468 164 -432Q202 -396 270 -396Q338 -396 376 -432Q415 -468 415 -530ZM440 -196Q440 -268 395 -309Q350 -350 270 -350Q191 -350 146 -309Q100 -268 100 -196Q100 -123 145 -81Q190 -39 270 -39Q350 -39 395 -80Q440 -122 440 -196Z"],"9":[540,"M106 -35Q184 -53 250 -98Q317 -142 361 -204Q405 -266 417 -335Q396 -302 354 -282Q313 -261 262 -261Q200 -261 152 -290Q104 -319 78 -370Q51 -421 51 -486Q51 -551 78 -602Q104 -653 152 -682Q201 -710 265 -710Q372 -710 431 -638Q490 -566 490 -444Q490 -332 442 -236Q394 -139 308 -74Q222 -10 113 10ZM428 -485Q428 -564 384 -612Q339 -661 266 -661Q194 -661 150 -612Q106 -564 106 -485Q106 -406 150 -358Q194 -309 265 -309Q338 -309 383 -358Q428 -406 428 -485Z"],",":[223,"M170 -27Q170 19 146 72Q121 126 82 162L61 138Q84 112 100 76Q117 40 122 6L107 7Q86 7 72 -8Q59 -22 59 -45Q59 -70 74 -86Q89 -101 113 -101Q138 -101 154 -81Q170 -61 170 -27Z"],".":[223,"M62 -41Q62 -64 76 -78Q89 -92 111 -92Q133 -92 147 -78Q161 -63 161 -41Q161 -19 147 -4Q133 10 111 10Q89 10 76 -4Q62 -18 62 -41Z"],"-":[340,"M40 -288H300V-244H40Z"]};

  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/quote-notice-api';
  var st = { name: '', pages: [], rows: [], pdf: null, busy: false, id: null, saveState: '', history: null, histErr: '' };

  // ---------------------------------------------------------------- saved work (Supabase: quote_notices)
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
  function toB64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function fromB64(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function grandTotal() { return allTables().reduce(function (sum, t) { return sum + tableTotals(t).total; }, 0); }
  function snapshot() { return { rows: st.rows.map(function (r) { return { page: r.page, y: Math.round(r.y * 10) / 10, qty: r.qtyEdit ? r.qty : null, price: r.price }; }) }; }
  function applySnapshot(state) {
    var saved = (state && state.rows) || [];
    st.rows.forEach(function (r, i) {
      var m = saved.filter(function (x) { return x.page === r.page && Math.abs(x.y - r.y) < 2; })[0] || saved[i];
      if (!m) return;
      r.price = Number(m.price) || 0;
      if (r.qtyEdit && m.qty != null) r.qty = Number(m.qty) || 0;
    });
  }
  function setSaveState(v) { st.saveState = v; var el = document.getElementById('qnSaveState'); if (el) el.textContent = v; }
  var saveTimer = 0, saving = null;
  function scheduleSave() { clearTimeout(saveTimer); setSaveState('กำลังบันทึก…'); saveTimer = setTimeout(saveNow, 1200); }
  // Writes any pending edit before another file replaces the current one, so nothing typed is lost
  async function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; await saveNow(); }
    else if (saving) { await saving.catch(function () {}); }
  }
  async function saveNow(first) {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!st.bytes || !st.pages.length) return;
    if (saving) { await saving.catch(function () {}); }
    var body = { action: 'save', id: st.id || undefined, title: st.name, state: snapshot(), total_amount: grandTotal() };
    if (!st.id) { body.pdf_b64 = toB64(st.bytes); body.file_name = st.name + '.pdf'; }
    saving = call(body);
    try {
      var j = await saving; st.id = j.item.id;
      var d = new Date(j.item.updated_at || Date.now());
      setSaveState('บันทึกแล้ว ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
      loadHistory();
    } catch (e) { console.error('quote-notice save', e); setSaveState('บันทึกไม่สำเร็จ: ' + (e.message || e)); }
    finally { saving = null; }
  }
  async function loadHistory() {
    try { var j = await call({ action: 'list' }); st.history = j.items || []; st.histErr = ''; }
    catch (e) { st.history = []; st.histErr = e.message || String(e); }
    renderHistory();
  }
  async function openSaved(id) {
    if (st.busy) return;
    await flushSave();
    try {
      st.busy = true; render();
      var j = await call({ action: 'get', id: id });
      st.busy = false;
      await openBytes(fromB64(j.item.pdf_b64), j.item.title || (j.item.file_name || '').replace(/\.pdf$/i, ''), j.item.id, j.item.state);
      setSaveState('เปิดงานที่บันทึกไว้');
    } catch (e) { st.busy = false; render(); alert('เปิดงานไม่สำเร็จ: ' + (e.message || e)); }
  }
  async function deleteSaved(id) {
    if (!confirm('ลบงานนี้ออกจากรายการ?')) return;
    try { await call({ action: 'delete', id: id }); if (st.id === id) st.id = null; await loadHistory(); }
    catch (e) { alert('ลบไม่สำเร็จ: ' + (e.message || e)); }
  }
  function renderHistory() {
    var box = document.getElementById('qnHistory'); if (!box) return;
    if (st.history == null) { box.innerHTML = '<div class="qn-h-empty">กำลังโหลด…</div>'; return; }
    if (st.histErr) { box.innerHTML = '<div class="qn-h-empty">โหลดรายการไม่สำเร็จ: ' + esc(st.histErr) + '</div>'; return; }
    if (!st.history.length) { box.innerHTML = '<div class="qn-h-empty">ยังไม่มีงานที่บันทึกไว้</div>'; return; }
    box.innerHTML = st.history.map(function (h) {
      var d = new Date(h.updated_at);
      return '<div class="qn-h' + (h.id === st.id ? ' on' : '') + '"><div class="qn-h-main" data-open="' + h.id + '"><b>' + esc(h.title) + '</b><small>' +
        d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) +
        (h.updated_by_name ? ' • ' + esc(h.updated_by_name) : '') + '</small></div><span class="qn-h-total">' + (h.total_amount ? money(h.total_amount) : '-') + '</span>' +
        '<button class="qn-h-del" data-del="' + h.id + '" title="ลบ">🗑</button></div>';
    }).join('');
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(s) { var n = Number(String(s == null ? '' : s).replace(/,/g, '').trim()); return isFinite(n) ? n : 0; }
  function calc(r) { var a = r.qty * r.price; var v = Math.round(a * VAT * 100) / 100; return { amount: a, vat: v, total: a + v }; }

  // ---------------------------------------------------------------- pdf.js loading
  var pdfjsReady = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = PDFJS; s.async = true;
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); };
      s.onerror = function () { pdfjsReady = null; fail(new Error('โหลดตัวอ่าน PDF ไม่สำเร็จ')); };
      document.head.appendChild(s);
    });
    return pdfjsReady;
  }

  // ---------------------------------------------------------------- table detection
  // Thai marks are often lost in PDF text, so headers are matched loosely.
  var RE = {
    price: /ราคา/,
    amount: /นวนเงิน/,
    vat: /ภาษี/,
    total: /รวม.*(เงิน|สิ้น)|ทั้งสิ้น/,
    qty: /^จ\S{0,3}นวน$/,
    number: /^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/
  };
  function center(it) { return it.x + it.w / 2; }
  // Thai fonts in PDFs often store tone marks as Windows "private use" glyphs (U+F700–F71A): map them back
  var PUA = { 0xF700: 0x0E10, 0xF701: 0x0E34, 0xF702: 0x0E35, 0xF703: 0x0E36, 0xF704: 0x0E37, 0xF705: 0x0E48, 0xF706: 0x0E49,
    0xF707: 0x0E4A, 0xF708: 0x0E4B, 0xF709: 0x0E4C, 0xF70A: 0x0E48, 0xF70B: 0x0E49, 0xF70C: 0x0E4A, 0xF70D: 0x0E4B, 0xF70E: 0x0E4C,
    0xF70F: 0x0E0D, 0xF710: 0x0E31, 0xF711: 0x0E4D, 0xF712: 0x0E47, 0xF713: 0x0E48, 0xF714: 0x0E49, 0xF715: 0x0E4A, 0xF716: 0x0E4B,
    0xF717: 0x0E4C, 0xF718: 0x0E38, 0xF719: 0x0E39, 0xF71A: 0x0E3A };
  function thaiText(s) {
    return String(s || '').replace(/[\uE000-\uF8FF]/g, function (c) { var m = PUA[c.charCodeAt(0)]; return m ? String.fromCharCode(m) : ''; })
      .replace(/\u0E4D\u0E32/g, '\u0E33')    // ํ + า = ำ
      .replace(/[\u0E50-\u0E59]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); });   // Thai digits ๐–๙
  }

  // Column headers differ per office. Known variants:
  //  A) ที่ | รายการ | จำนวน | ราคา/หน่วย | จำนวนเงิน | ภาษีมูลค่าเพิ่ม 7% | รวมเป็นเงินทั้งสิ้น   (quantity printed, all per row)
  //  B) รายการที่ | กิจกรรม | จำนวนกิจกรรม (ราย) | ราคาที่เสนอ: ต่อหน่วย | รวม(ไม่รวมภาษี) | หมายเหตุ
  //     with รวม / ภาษี VAT 7% / รวมทั้งสิ้น as rows under the table and the quantity left blank.
  var COL = {
    unit: /ต\S{0,2}อ\s*ห\S{0,2}น\S{0,2}วย/,
    amount: /นวนเงิน|ไม\S{0,2}รวมภาษี|^เป็นเงิน/,
    vat: /ภาษี|VAT/i,
    total: /ทั้งสิ้น/
  };
  //  C) รายการที่ | กิจกรรม | จำนวน/ปริมาณงาน (ราย) | ราคากลาง: ต่อหน่วย | รวม | ราคาที่เสนอ: ต่อหน่วย | รวม
  //     the offered columns are blank; รวม / VAT 7% / รวมทั้งสิ้น rows below are filled in the offered รวม column.
  var SUM = { total: /ทั้งสิ้น/, vat: /ภาษี|VAT/i, amount: /^\d?\s*รวม|ไม\S{0,2}รวมภาษี/ };
  function sumKey(str) {
    if (SUM.total.test(str)) return 'total';
    if (/ไม\S{0,2}รวมภาษี/.test(str)) return 'amount';
    if (SUM.vat.test(str)) return 'vat';
    if (SUM.amount.test(str)) return 'amount';
    return null;
  }
  // layout C: the "ราคาที่เสนอ" (offered price) group header sits next to the reference-price group
  function offerColumns(near) {
    var offer = near.filter(function (i) { return /ราคาท\S{0,3}เสนอ/.test(i.str); })[0];
    if (!offer) return null;
    var right = function (i) { return center(i) > offer.x - 40; };
    var unit = near.filter(function (i) { return COL.unit.test(i.str) && right(i); }).sort(function (a, b) { return a.x - b.x; })[0];
    if (!unit) {
      // narrow column: "ต่อ" on one line and "หน่วย" wrapped onto the next line (e.g. กฟส.สังขะ)
      var per = near.filter(function (i) { return /^ต\S{0,2}อ$/.test(i.str.trim()) && right(i); }).sort(function (a, b) { return a.x - b.x; })[0];
      if (per) {
        var under = near.filter(function (i) {
          return /^ห\S{0,2}น\S{0,2}วย$/.test(i.str.trim()) && i.y > per.y && i.y - per.y < 30 && Math.abs(center(i) - center(per)) < 25;
        })[0];
        var x0 = under ? Math.min(per.x, under.x) : per.x, x1 = under ? Math.max(per.x + per.w, under.x + under.w) : per.x + per.w;
        unit = { str: 'ต่อหน่วย', x: x0, w: x1 - x0, y: under ? under.y : per.y, h: per.h };
      }
    }
    var sum = near.filter(function (i) { return /^รวม$/.test(i.str.trim()) && right(i); }).sort(function (a, b) { return a.x - b.x; })[0];
    var qty = near.filter(function (i) { return /\(?\s*ราย\s*\)?$/.test(i.str.trim()) && i.str.trim().length <= 7 && center(i) < offer.x; })[0] ||
      near.filter(function (i) { return /ปริมาณ|เฟส|^จ\S{0,3}นวน$/.test(i.str.trim()) && center(i) < offer.x; }).sort(function (a, b) { return b.x - a.x; })[0];
    if (!qty) return null;
    if (!unit && !sum) {
      // layout D: no headings under "ราคาที่เสนอ" (e.g. กฟส.พุทไธสง) although the cell is divided in two like the
      // reference group: the left half is ต่อหน่วย and the right half รวม; snapCells finds the real cell lines
      var refUnit = near.filter(function (i) { return COL.unit.test(i.str) && center(i) < offer.x; })[0];
      if (!refUnit) return null;
      var y = refUnit.y, h = refUnit.h;
      return { qty: qty, price: { x: offer.x, w: offer.w / 2, y: y, h: h }, amount: { x: offer.x + offer.w / 2, w: offer.w / 2, y: y, h: h } };
    }
    if (!unit || !sum || center(sum) <= center(unit)) return null;
    return { qty: qty, price: unit, amount: sum };
  }

  // Some PDFs split one word or number into touching pieces ("(" "ราย" ")", "66" ",000"): join them back
  function mergeRuns(items) {
    var out = [];
    items.slice().sort(function (a, b) { return Math.abs(a.y - b.y) > 1.5 ? a.y - b.y : a.x - b.x; }).forEach(function (i) {
      var last = out[out.length - 1];
      if (last && Math.abs(last.y - i.y) <= 1.5 && i.x - (last.x + last.w) <= 1.5 && i.x >= last.x) {
        last.str += i.str; last.thai = last.thai || i.thai; last.w = Math.max(last.w, i.x + i.w - last.x); last.h = Math.max(last.h, i.h);
      } else out.push({ str: i.str, x: i.x, y: i.y, w: i.w, h: i.h, thai: i.thai });
    });
    return out;
  }
  var HEAD = 60;
  function detectTables(items, pageNo) {
    var tables = [];
    items.filter(function (i) { return RE.price.test(i.str); }).forEach(function (p) {
      if (tables.some(function (t) { return p.y - t.y > -45 && p.y - t.y < HEAD; })) return;
      // header rows can be tall: sub headings may sit up to HEAD points under the "ราคา" line (e.g. กฟส.ศีขรภูมิ)
      var near = items.filter(function (i) { return i.y - p.y > -45 && i.y - p.y < HEAD; });
      function pick(re, not) { return near.filter(function (i) { return re.test(i.str) && !(not && not(i)); }).sort(function (a, b) { return a.y - b.y; })[0]; }
      var cols = offerColumns(near), bounds = {}, order, cx;
      if (cols) {
        order = ['qty', 'price', 'amount'];
        cx = order.map(function (k) { return center(cols[k]); });
        // columns are not side by side here (the reference price sits between qty and offer): use half widths
        var half = Math.min(28, (cx[2] - cx[1]) / 2);
        bounds.qty = [cx[0] - 26, cx[0] + 26]; bounds.price = [cx[1] - half, cx[1] + half]; bounds.amount = [cx[2] - half, cx[2] + Math.max(half, 34)];
      } else {
        var qty = pick(RE.qty);
        if (!qty) return;
        var total = pick(COL.total);
        var amount = pick(COL.amount, function (i) { return i === total; });
        var vat = pick(COL.vat, function (i) { return i === total || i === amount; });
        var unit = pick(COL.unit) || p;
        if (!amount || center(amount) <= center(unit)) return;
        cols = { qty: qty, price: unit, amount: amount };
        if (vat && center(vat) > center(amount)) cols.vat = vat;
        if (total && center(total) > center(cols.vat || amount)) cols.total = total;
        order = ['qty', 'price', 'amount', 'vat', 'total'].filter(function (k) { return cols[k]; });
        cx = order.map(function (k) { return center(cols[k]); });
        order.forEach(function (key, i) {
          var L = i ? (cx[i - 1] + cx[i]) / 2 : cx[0] - ((cx[1] - cx[0]) / 2);
          var R = i < cx.length - 1 ? (cx[i] + cx[i + 1]) / 2 : cx[i] + (cx[i] - cx[i - 1]) / 2;
          bounds[key] = [L, R];
        });
      }
      // the header ends at the lowest header word sitting in one of our columns ("(ราย)", "(บาท)", "เครื่อง")
      var headTop = Math.max.apply(null, order.map(function (k) { return cols[k].y; }));
      // a heading word never sits on or below the first quantity of the table
      var firstQty = Math.min.apply(null, items.filter(function (i) {
        var c = center(i); return i.y > headTop + 2 && RE.number.test(i.str.trim()) && c > bounds.qty[0] && c < bounds.qty[1];
      }).map(function (i) { return i.y; }).concat([Infinity]));
      var headerBottom = Math.max.apply(null, [headTop].concat(near.filter(function (i) {
        // values already printed in the row ("8.-", "576,000.-") are not headings
        var c = center(i); return i.y >= p.y && i.y < Math.min(p.y + HEAD, firstQty - 2) && c > bounds.qty[0] && c < bounds[order[order.length - 1]][1] && !/^[\d,.\-–]+$/.test(i.str.trim());
      }).map(function (i) { return i.y; })));
      var title = items.filter(function (i) { return i.y < p.y - 5 && i.y > p.y - 70 && i.x < cx[0] && /การไฟฟ้า|การไฟฟา|พื้นที่/.test(i.str); })
        .sort(function (a, b) { return b.y - a.y; })[0];
      tables.push({ page: pageNo, y: p.y, headerBottom: headerBottom, bounds: bounds, cols: order, sums: [],
        title: title ? title.str.replace(/^\d+\.\s*/, '') : 'ตารางที่ ' + (tables.length + 1) });
    });
    tables.sort(function (a, b) { return a.y - b.y; });
    var rows = [];
    tables.forEach(function (t, ti) {
      var limit = ti + 1 < tables.length ? tables[ti + 1].y - 40 : Infinity;
      var body = items.filter(function (i) { return i.y > t.headerBottom + 2 && i.y < limit; });
      var amtL = t.bounds.amount[0];
      // summary lines (รวม / ภาษี / รวมทั้งสิ้น) written left of the amount column
      var sums = [];
      body.forEach(function (i) {
        if (center(i) >= amtL || i.x + i.w < t.bounds.qty[0] - 40) return;
        var key = sumKey(i.str.trim());
        if (key && !sums.some(function (s) { return s.key === key; })) sums.push({ key: key, y: i.y, h: i.h });
      });
      // the sum before VAT may be a row without any words, only the reference amount (e.g. กฟส.ศีขรภูมิ)
      var vatSum = sums.filter(function (s) { return s.key === 'vat'; })[0];
      if (vatSum && !sums.some(function (s) { return s.key === 'amount'; })) {
        var isNum = function (i) { return RE.number.test(i.str.trim().replace(/\.?-$/, '')); };
        var itemLines = body.filter(function (i) { var c = center(i); return isNum(i) && c > t.bounds.qty[0] && c < t.bounds.qty[1]; }).map(function (i) { return i.y; });
        var bare = body.filter(function (i) {
          if (!isNum(i) || i.y >= vatSum.y - 4 || center(i) >= amtL || center(i) <= t.bounds.qty[1]) return false;
          if (itemLines.some(function (y) { return i.y <= y + 4; })) return false;
          return !body.some(function (o) { return o !== i && Math.abs(o.y - i.y) < 4 && !isNum(o); });
        }).sort(function (a, b) { return b.y - a.y; })[0];
        if (bare) sums.push({ key: 'amount', y: bare.y, h: bare.h });
      }
      sums.sort(function (a, b) { return a.y - b.y; });
      var end = sums.length ? sums[0].y - 4 : limit;
      function label(y) {
        var one = items.filter(function (o) { return Math.abs(o.y - y) < 4 && o.x < t.bounds.qty[0] && !/^\d+$/.test(o.str.trim()); });
        if (!one.length) one = body.filter(function (o) { return o.y < end && Math.abs(o.y - y) < 26 && o.x > 80 && o.x + o.w <= t.bounds.qty[0] + 4; });
        return one.sort(function (a, b) { return Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x; }).map(function (o) { return o.str; }).join(' ');
      }
      var qtys = body.filter(function (i) { var c = center(i); return i.y < end && RE.number.test(i.str.trim()) && c > t.bounds.qty[0] && c < t.bounds.qty[1]; });
      qtys.forEach(function (i) {
        rows.push({ page: pageNo, table: t, y: i.y, h: i.h, refStr: i.str.trim(), refW: i.thai ? 0 : i.w, qty: num(i.str), qtyEdit: false, label: label(i.y), price: 0 });
      });
      if (!qtys.length) {
        // quantity left blank: one row per item number in the first column ("1", "2" …); quantity is typed too
        body.filter(function (i) { return i.y < end && /^\d{1,3}\.?$/.test(i.str.trim()) && i.x + i.w < t.bounds.qty[0] - 20; }).forEach(function (i) {
          var lines = body.filter(function (o) { return o.y < end && o.x > i.x + i.w && o.x + o.w <= t.bounds.qty[0] + 4 && Math.abs(o.y - i.y) < 60; })
            .sort(function (a, b) { return a.y - b.y; }).map(function (o) { return o.str; }).join(' ');
          rows.push({ page: pageNo, table: t, y: i.y, h: i.h, refStr: i.str.trim(), refW: i.w, qty: 0, qtyEdit: true, label: lines, price: 0 });
        });
      }
      // placeholder marks ("-") already printed in the summary cells are blanked before writing
      t.sums = sums.map(function (s) {
        s.blank = body.filter(function (i) { return Math.abs(i.y - s.y) < 4 && center(i) > amtL && center(i) < t.bounds.amount[1] + 20 && /^[-–—.]+$/.test(i.str.trim()); });
        return s;
      });
      var firstRow = rows.filter(function (r) { return r.table === t; })[0];
      if (firstRow) { t.refStr = firstRow.refStr; t.refW = firstRow.refW; t.refH = firstRow.h; }
    });
    return rows;
  }

  // Header text only gives column centres: move each cell edge onto the real table line drawn on the
  // page, so numbers sit inside their cell exactly like typed in the original form.
  function snapCells(y, h, keys, table, canvas) {
    var b = {};
    try {
      var g = canvas.getContext('2d'), S = RENDER_SCALE;
      var ys = [y - h * 0.8, y - h * 0.4, y + h * 0.05].map(function (v) { return Math.round(v * S); });
      var rows = ys.map(function (v) { return g.getImageData(0, v, canvas.width, 1).data; });
      var dark = function (x) { return rows.every(function (d) { var i = x * 4; return d[i] + d[i + 1] + d[i + 2] < 300; }); };
      var lineNear = function (x0, dir) {
        for (var dx = 0; dx < 60 * S; dx++) { var x = Math.round(x0 * S + dir * dx); if (x < 0 || x >= canvas.width) break; if (dark(x)) return x / S; }
        return null;
      };
      keys.forEach(function (k) {
        var c = (table.bounds[k][0] + table.bounds[k][1]) / 2;
        var L = lineNear(c, -1), R = lineNear(c, 1);
        b[k] = [L == null ? table.bounds[k][0] : L, R == null ? table.bounds[k][1] : R];
      });
    } catch (e) { keys.forEach(function (k) { b[k] = table.bounds[k]; }); }
    return b;
  }

  function tableTotals(t) {
    var s = { amount: 0, vat: 0, total: 0 };
    st.rows.forEach(function (r) { if (r.table !== t) return; var v = calc(r); s.amount += v.amount; s.vat += v.vat; });
    if (t.sums.length) s.vat = Math.round(s.amount * VAT * 100) / 100;   // VAT once on the table sum
    s.total = s.amount + s.vat;
    return s;
  }
  function allTables() { var out = []; st.rows.forEach(function (r) { if (out.indexOf(r.table) < 0) out.push(r.table); }); return out; }

  async function openFile(file) {
    await flushSave();
    var data = new Uint8Array(await file.arrayBuffer());
    await openBytes(data, file.name.replace(/\.pdf$/i, ''), null, null);
  }
  async function openBytes(data, name, savedId, savedState) {
    st.busy = true; render();
    var ok = false;
    try {
      var lib = await loadPdfJs();
      st.bytes = data.slice();          // pdf.js hands its copy to the worker; the original file is kept untouched here
      var pdf = await lib.getDocument({ data: data }).promise;
      st.pdf = pdf; st.name = name; st.pages = []; st.rows = []; st.id = savedId || null; st.saveState = '';
      for (var n = 1; n <= pdf.numPages; n++) {
        var page = await pdf.getPage(n);
        var vp = page.getViewport({ scale: 1 });
        var canvas = document.createElement('canvas');
        var big = page.getViewport({ scale: RENDER_SCALE });
        canvas.width = Math.round(big.width); canvas.height = Math.round(big.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: big }).promise;
        var tc = await page.getTextContent();
        var items = tc.items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
          var t = lib.Util.transform(vp.transform, i.transform);
          var h = Math.hypot(t[2], t[3]);
          return { str: thaiText(i.str).trim(), x: t[4], y: t[5], w: i.width, h: h, thai: /[\u0E50-\u0E59]/.test(i.str) };
        });
        items = mergeRuns(items);
        // fonts with a broken map write every "า" as "ำ" ("รำคำกลำง"): read such a page with า restored
        if (items.some(function (i) { return /รำคำ|รำยกำร/.test(i.str); })) items.forEach(function (i) { i.str = i.str.replace(/ำ/g, 'า').replace(/จ\s+า/g, 'จำ'); });
        st.pages.push({ w: vp.width, h: vp.height, bg: canvas });
        var found = detectTables(items, n - 1);
        found.forEach(function (r) {
          r.cells = snapCells(r.y, r.h, r.table.cols, r.table, canvas);
          r.table.sums.forEach(function (sm) { if (!sm.cell) sm.cell = snapCells(sm.y, sm.h, ['amount'], r.table, canvas).amount; });
        });
        st.rows = st.rows.concat(found);
      }
      if (savedState) applySnapshot(savedState);
      if (!st.rows.length) alert('ไม่พบตารางราคาในไฟล์นี้ (ต้องมีคอลัมน์ จำนวน, ราคาต่อหน่วย และจำนวนเงิน/รวม) กรุณาส่งไฟล์ให้ผู้ดูแลปรับรูปแบบ');
      ok = true;
    } catch (e) {
      console.error('quote-notice', e);
      alert('เปิดไฟล์ไม่สำเร็จ: ' + (e.message || e));
    } finally { st.busy = false; render(); }
    if (ok && !savedId && st.rows.length) saveNow();     // a new file goes into the list straight away
  }

  // ---------------------------------------------------------------- drawing
  function glyphWidth(str) { var w = 0; for (var i = 0; i < str.length; i++) w += (GLYPHS[str[i]] || GLYPHS['0'])[0]; return w; }
  var paths = {};
  function path2d(ch) { if (!paths[ch]) paths[ch] = new Path2D(GLYPHS[ch][1]); return paths[ch]; }

  // Everything that goes on the paper, in PDF points measured from the page's top-left corner:
  //  marks: numbers right-aligned at x on baseline y;  blanks: small boxes over placeholder "-" to clear.
  function layout() {
    var out = { marks: [], blanks: [] };
    // digits as big as the ones printed in the PDF: size so a printed number ("237,000", or the item no. "1") has the same width
    function sizeFor(refStr, refW, h) {
      var u = glyphWidth(String(refStr || '0').replace(/[^0-9,.\-]/g, '') || '0');
      var size = refW > 0 ? refW * UPM / u : h * 0.67;
      return Math.min(size, h * 0.9);
    }
    function put(page, text, cell, y, size, t) {
      var pad = 3, room = cell[1] - cell[0] - pad * 2, w = glyphWidth(text) * size / UPM;
      if (w > room) size = size * room / w;
      out.marks.push({ page: page, text: text, x: cell[1] - pad, y: y, size: size, t: t });
    }
    st.rows.forEach(function (r) {
      if (!(r.price > 0)) return;
      var v = calc(r), b = r.cells || r.table.bounds;
      var size = sizeFor(r.refStr, r.refW, r.h);
      var vals = { price: r.price, amount: v.amount, vat: v.vat, total: v.total };
      if (r.qtyEdit && r.qty > 0) put(r.page, r.qty.toLocaleString('en-US'), b.qty, r.y, size, r.table);
      r.table.cols.forEach(function (k) { if (k !== 'qty') put(r.page, money(vals[k]), b[k], r.y, size, r.table); });
    });
    allTables().forEach(function (t) {
      if (!t.sums.length || !st.rows.some(function (r) { return r.table === t && r.price > 0; })) return;
      var tot = tableTotals(t), size = sizeFor(t.refStr, t.refW, t.refH || 15);
      t.sums.forEach(function (sm) {
        sm.blank.forEach(function (i) { out.blanks.push({ page: t.page, x: i.x - 0.6, y: i.y - i.h * 0.62, w: i.w + 1.2, h: i.h * 0.62 + 1 }); });
        put(t.page, money(tot[sm.key]), sm.cell || t.bounds.amount, sm.y, size, t);
      });
    });
    // one digit size per table: if a long amount had to shrink to fit its cell, the other numbers follow
    allTables().forEach(function (t) {
      var ms = out.marks.filter(function (m) { return m.t === t; });
      var min = Math.min.apply(null, ms.map(function (m) { return m.size; }));
      ms.forEach(function (m) { m.size = min; });
    });
    return out;
  }

  // on-screen preview: the page picture with the same outlines drawn on top
  function drawPage(pi, scale) {
    var pg = st.pages[pi], L = layout();
    var c = document.createElement('canvas');
    c.width = Math.round(pg.w * scale); c.height = Math.round(pg.h * scale);
    var g = c.getContext('2d');
    g.drawImage(pg.bg, 0, 0, c.width, c.height);
    g.fillStyle = '#fff';
    L.blanks.forEach(function (b) { if (b.page === pi) g.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale); });
    g.fillStyle = '#000';
    L.marks.forEach(function (m) {
      if (m.page !== pi) return;
      var k = m.size / UPM, x = m.x - glyphWidth(m.text) * k;
      for (var i = 0; i < m.text.length; i++) {
        var ch = GLYPHS[m.text[i]] ? m.text[i] : '0';
        g.setTransform(k * scale, 0, 0, k * scale, x * scale, m.y * scale);
        g.fill(path2d(ch));
        x += GLYPHS[ch][0] * k;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
    return c;
  }

  function redrawPreview() {
    var box = document.getElementById('qnPages'); if (!box) return;
    box.innerHTML = '';
    st.pages.forEach(function (pg, i) {
      var c = drawPage(i, 1.6);
      c.className = 'qn-page';
      box.appendChild(c);
    });
  }

  var pdfLibReady = null;
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (pdfLibReady) return pdfLibReady;
    pdfLibReady = new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = PDFLIB; s.async = true;
      s.onload = function () { ok(window.PDFLib); };
      s.onerror = function () { pdfLibReady = null; fail(new Error('โหลดตัวแก้ไข PDF ไม่สำเร็จ')); };
      document.head.appendChild(s);
    });
    return pdfLibReady;
  }

  // The original PDF itself is opened and only the numbers are added (as vector outlines) on top of
  // each page; text, fonts, logo, page size and every other detail stay exactly as in the file sent.
  async function buildPdf() {
    var P = await loadPdfLib();
    var doc = await P.PDFDocument.load(st.bytes, { updateMetadata: false });
    var pages = doc.getPages(), L = layout();
    function box(pi) {
      var pg = pages[pi], cb = pg.getCropBox ? pg.getCropBox() : pg.getMediaBox();
      return { pg: pg, x: cb.x, top: cb.y + cb.height, rot: (pg.getRotation().angle || 0) % 360 };
    }
    for (var i = 0; i < pages.length; i++) if (box(i).rot) throw new Error('หน้าที่ ' + (i + 1) + ' ถูกหมุนไว้ ยังไม่รองรับ');
    L.blanks.forEach(function (b) {
      var B = box(b.page);
      B.pg.drawRectangle({ x: B.x + b.x, y: B.top - b.y - b.h, width: b.w, height: b.h, color: P.rgb(1, 1, 1), borderWidth: 0 });
    });
    L.marks.forEach(function (m) {
      var B = box(m.page), k = m.size / UPM, x = m.x - glyphWidth(m.text) * k;
      for (var i = 0; i < m.text.length; i++) {
        var ch = GLYPHS[m.text[i]] ? m.text[i] : '0';
        B.pg.drawSvgPath(GLYPHS[ch][1], { x: B.x + x, y: B.top - m.y, scale: k, color: P.rgb(0, 0, 0), borderWidth: 0 });
        x += GLYPHS[ch][0] * k;
      }
    });
    return doc.save({ useObjectStreams: false });
  }

  function fileName() {
    var d = new Date(); var stamp = ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + (d.getFullYear() + 543);
    return 'เสนอราคาแจ้งเตือน_' + (st.name || 'เอกสาร') + '_' + stamp + '.pdf';
  }

  async function savePdf() {
    if (!st.pages.length) return;
    saveNow();
    try {
      var bytes = await buildPdf();
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      var a = document.createElement('a'); a.href = url; a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      window.__qnSaved = { name: a.download, bytes: bytes };
    } catch (e) { console.error('quote-notice', e); alert('สร้าง PDF ไม่สำเร็จ: ' + (e.message || e)); }
  }

  async function printPages() {
    if (!st.pages.length) return;
    var w = window.open('', '_blank');
    if (!w) { alert('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป'); return; }
    saveNow();
    try {
      var bytes = await buildPdf();
      w.location.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));   // the browser's PDF viewer prints it as is
    } catch (e) { w.close(); alert('สร้าง PDF ไม่สำเร็จ: ' + (e.message || e)); }
  }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('qnStyle')) return;
    var s = document.createElement('style'); s.id = 'qnStyle';
    s.textContent = '.qn-workspace{display:none}.qn-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.qn-head h2{margin:0 0 4px}.qn-head p{margin:0;color:#6b5d7a}' +
      '.qn-grid{display:grid;grid-template-columns:minmax(330px,420px) 1fr;gap:16px;align-items:start}.qn-card{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:14px}' +
      '.qn-drop{border:2px dashed #cdbce0;border-radius:12px;padding:18px;text-align:center;color:#5a2787;cursor:pointer;background:#faf8fc}.qn-drop.drag{background:#efe6f8}' +
      '.qn-btn{border:0;border-radius:9px;padding:9px 14px;font-weight:800;cursor:pointer;background:#4b2378;color:#fff}.qn-btn.soft{background:#f2ebfa;color:#5a2787}.qn-btn:disabled{opacity:.45;cursor:default}' +
      '.qn-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.qn-all{display:flex;gap:8px;align-items:center;margin:10px 0}.qn-all-box{border:1px solid #e5dced;border-radius:10px;padding:9px 10px;margin:10px 0;background:#faf8fc}.qn-all-box b{color:#4d2376;font-size:13px}.qn-all input,.qn-all-box input,.qn-row input{width:110px;border:1px solid #d9cfdf;border-radius:8px;padding:7px 8px;text-align:right;font:inherit}' +
      '.qn-row{border:1px solid #eee7f4;border-radius:10px;padding:9px 10px;margin:8px 0;background:#fcfbfe}.qn-row b{display:block;color:#4d2376;font-size:13px}.qn-row small{color:#776a86}' +
      '.qn-line{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-top:4px}.qn-sum{border-top:2px solid #e5dced;margin-top:10px;padding-top:8px;font-weight:800}' +
      '.qn-pages{background:#eeeaf2;border-radius:12px;padding:12px;overflow:auto;max-height:calc(100vh - 170px)}.qn-page{display:block;width:100%;max-width:820px;margin:0 auto 12px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.12)}' +
      '.qn-state{align-self:center;font-size:12px;color:#776a86}.qn-h-head{margin:18px 0 6px;font-weight:800;color:#4d2376;border-top:2px solid #e5dced;padding-top:12px}.qn-h-head small{font-weight:400;color:#776a86}' +
      '#qnHistory{max-height:230px;overflow:auto}.qn-h{display:flex;align-items:center;gap:8px;border:1px solid #eee7f4;border-radius:10px;padding:8px 10px;margin:6px 0;background:#fff}.qn-h.on{border-color:#7b4bab;background:#f7f1fc}.qn-h-main{flex:1;min-width:0;cursor:pointer}.qn-h-main b{display:block;font-size:13px;color:#3b2252;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.qn-h-main small{color:#776a86;font-size:12px}' +
      '.qn-h-total{font-weight:800;font-size:13px;white-space:nowrap}.qn-h-del{border:0;background:none;cursor:pointer;font-size:15px;opacity:.6}.qn-h-del:hover{opacity:1}.qn-h-empty{color:#776a86;font-size:13px;padding:6px 2px}' +
      '.qn-empty{color:#776a86;text-align:center;padding:60px 10px}@media(max-width:1000px){.qn-grid{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }

  function page() {
    var w = document.getElementById('quoteNoticeWorkspace');
    if (w) return w;
    w = document.createElement('section');
    w.id = 'quoteNoticeWorkspace'; w.className = 'qn-workspace'; w.style.display = 'none';
    var main = document.querySelector('main.main-shell') || document.querySelector('main') || document.body;
    main.appendChild(w);
    w.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]'); if (o) { openSaved(+o.getAttribute('data-open')); return; }
      var dl = e.target.closest('[data-del]'); if (dl) { deleteSaved(+dl.getAttribute('data-del')); return; }
      var b = e.target.closest('[data-qn]'); if (!b) return;
      var a = b.getAttribute('data-qn');
      if (a === 'pick') w.querySelector('#qnFile').click();
      if (a === 'pdf') savePdf();
      if (a === 'save') { setSaveState('กำลังบันทึก…'); saveNow(); }
      if (a === 'print') printPages();
      if (a === 'all') {
        var pv = w.querySelector('#qnAll').value.trim(); if (pv) { var v = num(pv); st.rows.forEach(function (r) { r.price = v; }); }
        var q = w.querySelector('#qnAllQty'); if (q && q.value.trim()) { var n = num(q.value); st.rows.forEach(function (r) { if (r.qtyEdit) r.qty = n; }); }
        render(); scheduleSave();
      }
    });
    w.addEventListener('change', function (e) { if (e.target.id === 'qnFile' && e.target.files[0]) { openFile(e.target.files[0]); e.target.value = ''; } });
    w.addEventListener('input', function (e) {
      if (e.target.id === 'qnName') { st.name = e.target.value.trim() || st.name; scheduleSave(); return; }
      var i = e.target.getAttribute('data-row'), q = e.target.getAttribute('data-qty');
      if (q != null) st.rows[+q].qty = num(e.target.value);
      else if (i != null) st.rows[+i].price = num(e.target.value);
      else return;
      updateNumbers(); redrawPreview(); scheduleSave();
    });
    w.addEventListener('dragover', function (e) { e.preventDefault(); var d = w.querySelector('.qn-drop'); if (d) d.classList.add('drag'); });
    w.addEventListener('dragleave', function () { var d = w.querySelector('.qn-drop'); if (d) d.classList.remove('drag'); });
    w.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer.files[0]; if (f && /pdf$/i.test(f.type || f.name)) openFile(f); });
    return w;
  }

  function updateNumbers() {
    var w = page(); var sum = { amount: 0, vat: 0, total: 0 };
    allTables().forEach(function (t) { var x = tableTotals(t); sum.amount += x.amount; sum.vat += x.vat; sum.total += x.total; });
    st.rows.forEach(function (r, i) {
      var v = calc(r);
      var el = w.querySelector('[data-out="' + i + '"]');
      if (el) el.innerHTML = '<span>จำนวนเงิน ' + money(v.amount) + '</span><span>VAT ' + money(v.vat) + '</span><span>รวม ' + money(v.total) + '</span>';
    });
    var s = w.querySelector('#qnSum');
    if (s) s.innerHTML = '<div class="qn-line"><span>รวมจำนวนเงิน</span><span>' + money(sum.amount) + '</span></div><div class="qn-line"><span>รวมภาษีมูลค่าเพิ่ม 7%</span><span>' + money(sum.vat) + '</span></div><div class="qn-line"><span>รวมเป็นเงินทั้งสิ้น</span><span>' + money(sum.total) + '</span></div>';
  }

  function render() {
    var w = page(); var has = st.pages.length > 0;
    w.innerHTML =
      '<div class="qn-head"><div><h2>เสนอราคาแจ้งเตือน</h2><p>นำไฟล์ใบเสนอราคาของการไฟฟ้าเข้ามา กรอกราคาต่อหน่วย ระบบคำนวณช่องที่เหลือและพิมพ์ออกเป็น PDF หน้าตาเดิม</p></div></div>' +
      '<div class="qn-grid"><div class="qn-card">' +
      '<input type="file" id="qnFile" accept="application/pdf,.pdf" hidden>' +
      '<div class="qn-drop" data-qn="pick">' + (st.busy ? 'กำลังอ่านไฟล์…' : (has ? '📄 ' + esc(st.name) + '<br><small>กดหรือวางไฟล์ใหม่เพื่อเปลี่ยน</small>' : '📄 กดเพื่อเลือกไฟล์ PDF ใบเสนอราคา<br><small>หรือลากไฟล์มาวางที่นี่</small>')) + '</div>' +
      '<div class="qn-h-head" style="margin-top:12px">งานที่ทำแล้ว <small>(บันทึกอัตโนมัติ)</small></div><div id="qnHistory"></div>' +
      (has ? '<div class="qn-line" style="margin-top:12px"><span>ชื่องาน</span><input id="qnName" style="flex:1;width:auto;text-align:left;border:1px solid #d9cfdf;border-radius:8px;padding:7px 8px;font:inherit" value="' + esc(st.name) + '"></div>' +
        '<div class="qn-actions"><button class="qn-btn" data-qn="save">💾 บันทึกงาน</button><button class="qn-btn soft" data-qn="pdf">📄 บันทึก PDF</button><button class="qn-btn soft" data-qn="print">🖨 พิมพ์</button><span class="qn-state" id="qnSaveState">' + esc(st.saveState) + '</span></div>' +
        (function () {
          var askQty = st.rows.some(function (r) { return r.qtyEdit; });
          return '<div class="qn-all-box"><b>ใช้ค่าเดียวกันทุกพื้นที่</b>' +
            (askQty ? '<div class="qn-line"><span>จำนวน</span><input id="qnAllQty" inputmode="numeric" placeholder="ไม่เปลี่ยน"></div>' : '') +
            '<div class="qn-line"><span>ราคา/หน่วย (บาท)</span><input id="qnAll" inputmode="decimal" placeholder="0.00"></div>' +
            '<div class="qn-line" style="justify-content:flex-end"><button class="qn-btn soft" data-qn="all">ใช้กับทุกแถว</button></div></div>';
        })() +
        st.rows.map(function (r, i) {
          var label = r.label || 'รายการ'; if (label.length > 70) label = label.slice(0, 68) + '…';
          return '<div class="qn-row"><b>' + esc(r.table.title) + '</b><small>' + esc(label) + (r.qtyEdit ? '' : ' • จำนวน ' + r.qty.toLocaleString('th-TH')) + ' (หน้า ' + (r.page + 1) + ')</small>' +
            (r.qtyEdit ? '<div class="qn-line"><span>จำนวน</span><input data-qty="' + i + '" inputmode="numeric" value="' + (r.qty ? r.qty : '') + '" placeholder="0"></div>' : '') +
            '<div class="qn-line"><span>ราคา/หน่วย (บาท)</span><input data-row="' + i + '" inputmode="decimal" value="' + (r.price ? r.price : '') + '" placeholder="0.00"></div>' +
            '<div class="qn-line" data-out="' + i + '"></div></div>';
        }).join('') + '<div class="qn-sum" id="qnSum"></div>' : '') +
      '</div><div class="qn-pages" id="qnPages">' + (has ? '' : '<div class="qn-empty">ตัวอย่างเอกสารจะแสดงที่นี่</div>') + '</div></div>';
    if (has) { updateNumbers(); redrawPreview(); }
    if (st.history == null) loadHistory(); else renderHistory();
  }

  // ---------------------------------------------------------------- menu
  function shown(id) { var el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none' && !el.hidden; }
  // For now only administrators see this menu
  function isAdmin() {
    var u = window.currentMenuUser || null;
    if (!u) { try { u = JSON.parse(localStorage.getItem('divergent_web_session_user') || 'null'); } catch (_) { u = null; } }
    var role = (u && u.role) || (window.qcAuthorizedUser && window.qcAuthorizedUser.user_role) || '';
    return String(role).toLowerCase() === 'admin';
  }
  function syncNav() {
    var nav = document.getElementById('navQuoteNotice'); if (!nav) return;
    var want = isAdmin() ? '' : 'none';
    if (nav.style.display !== want) nav.style.display = want;
  }
  function ensureNav() {
    var side = document.querySelector('.side-nav');
    if (!side || document.getElementById('navQuoteNotice')) return;
    var nav = document.createElement('div');
    nav.className = 'nav-item'; nav.id = 'navQuoteNotice'; nav.style.display = 'none';
    nav.innerHTML = '<span class="nav-ico">🧾</span><span>เสนอราคาแจ้งเตือน</span>';
    nav.addEventListener('click', showPage);
    var ref = document.getElementById('navDocArchive') || document.getElementById('navReceiptTax');
    if (ref) ref.insertAdjacentElement('afterend', nav); else side.appendChild(nav);
    syncNav();
    var mo = new MutationObserver(syncNav);
    ['navInvoice', 'navBilling', 'navReceiptTax'].forEach(function (id) { var el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] }); });
  }
  function showPage() {
    if (!isAdmin()) { alert('เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navQuoteNotice'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    document.documentElement.classList.add('sa-wide');
    window.scrollTo(0, 0);
    render();
    loadPdfJs().catch(function () {}); loadPdfLib().catch(function () {});
  }
  window.openQuoteNotice = showPage;

  function boot() {
    style(); ensureNav();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && saveTimer) flushSave(); });
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); syncNav(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

/* เสนอราคาแจ้งเตือน (2026-10-15)
 * Upload the PEA quotation PDF as it is (every office's form differs), type the unit price, and the
 * same PDF file is saved / printed with the numbers filled in — it goes into the PEA system, so the
 * original file is kept 100%: pdf-lib adds only the digits on top of its pages (nothing re-drawn).
 *  - pdf.js reads the text positions and renders the on-screen preview.
 *  - Tables are found from their column headers (ราคา/หน่วย, จำนวนเงิน, ภาษีมูลค่าเพิ่ม, รวมเป็นเงินทั้งสิ้น)
 *    and every quantity under "จำนวน" becomes a row: amount = qty × unit price, VAT 7%, total.
 *  - Only the unit price is typed; everything else is calculated.
 *  - The menu lists the saved jobs by site with the auction day/time from ตารางประมูลแจ้งเตือน (upcoming first, past last);
 *    clicking one opens it. A new job is named after the site read from the PDF.
 *  - A site whose TOR has no quotation form gets one drawn (📝 ใช้แบบฟอร์มเปล่า): figures from the site's row or its TOR PDF.
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
  var GLYPHS = {"0":[540,"M47 -350Q47 -528 104 -619Q162 -710 270 -710Q378 -710 436 -619Q493 -528 493 -350Q493 -172 436 -81Q378 10 270 10Q162 10 104 -81Q47 -172 47 -350ZM437 -350Q437 -503 394 -583Q350 -663 270 -663Q190 -663 146 -584Q103 -504 103 -350Q103 -197 146 -117Q190 -37 270 -37Q350 -37 394 -117Q437 -197 437 -350Z"],"1":[540,"M138 -50H262V-630L119 -546V-599L284 -700H318V-50H441V0H138Z"],"2":[540,"M70 -58Q145 -114 219 -192Q293 -270 344 -357Q394 -444 394 -520Q394 -585 356 -623Q319 -661 254 -661Q201 -661 154 -637Q107 -613 82 -575L53 -612Q82 -657 136 -684Q190 -710 255 -710Q345 -710 398 -659Q451 -608 451 -523Q451 -402 356 -277Q262 -152 140 -50H487V0H70Z"],"3":[540,"M52 -89 82 -126Q107 -85 156 -62Q205 -39 262 -39Q338 -39 384 -80Q431 -120 431 -185Q431 -258 372 -300Q313 -341 212 -341H194V-393H212Q270 -393 314 -412Q357 -432 380 -467Q404 -502 404 -545Q404 -600 368 -630Q332 -661 270 -661Q214 -661 167 -638Q120 -614 94 -574L64 -611Q93 -657 148 -684Q203 -710 270 -710Q357 -710 408 -667Q460 -624 460 -552Q460 -487 420 -438Q379 -388 310 -369Q394 -355 441 -306Q488 -258 488 -184Q488 -127 460 -83Q432 -39 381 -14Q330 10 263 10Q193 10 136 -16Q80 -43 52 -89Z"],"4":[540,"M365 -129H30V-178L346 -700H421V-177H504V-129H421V0H365ZM365 -177V-641L84 -177Z"],"5":[540,"M52 -89 82 -126Q107 -86 154 -62Q200 -39 256 -39Q336 -39 382 -88Q429 -138 429 -224Q429 -306 386 -355Q343 -404 270 -404Q224 -404 185 -385Q146 -366 124 -334H77L109 -700H464V-651H160L140 -405Q163 -427 202 -440Q241 -452 283 -452Q377 -452 432 -391Q488 -330 488 -226Q488 -118 426 -54Q364 10 258 10Q189 10 134 -16Q79 -43 52 -89Z"],"6":[540,"M51 -248Q51 -356 101 -454Q151 -553 238 -621Q324 -689 428 -710L435 -666Q360 -647 296 -602Q231 -557 186 -495Q141 -433 123 -363Q146 -398 186 -419Q227 -440 283 -440Q348 -440 394 -410Q441 -379 466 -328Q490 -276 490 -214Q490 -150 464 -100Q439 -49 390 -20Q342 10 276 10Q207 10 156 -22Q106 -53 78 -112Q51 -170 51 -248ZM435 -215Q435 -294 391 -342Q347 -391 274 -391Q202 -391 158 -342Q113 -294 113 -215Q113 -136 158 -88Q202 -39 274 -39Q347 -39 391 -88Q435 -136 435 -215Z"],"7":[540,"M423 -651H60V-700H481V-640Q370 -515 312 -358Q254 -200 254 0H197Q201 -121 218 -222Q235 -323 284 -432Q332 -542 423 -651Z"],"8":[540,"M44 -189Q44 -254 75 -302Q106 -350 170 -374Q122 -393 96 -438Q69 -482 69 -537Q69 -617 123 -664Q177 -710 270 -710Q363 -710 417 -664Q471 -617 471 -537Q471 -481 444 -437Q418 -393 371 -374Q434 -350 465 -302Q496 -254 496 -189Q496 -97 436 -44Q376 10 270 10Q164 10 104 -44Q44 -97 44 -189ZM415 -530Q415 -591 378 -626Q340 -661 270 -661Q200 -661 162 -626Q125 -591 125 -530Q125 -468 164 -432Q202 -396 270 -396Q338 -396 376 -432Q415 -468 415 -530ZM440 -196Q440 -268 395 -309Q350 -350 270 -350Q191 -350 146 -309Q100 -268 100 -196Q100 -123 145 -81Q190 -39 270 -39Q350 -39 395 -80Q440 -122 440 -196Z"],"9":[540,"M106 -35Q184 -53 250 -98Q317 -142 361 -204Q405 -266 417 -335Q396 -302 354 -282Q313 -261 262 -261Q200 -261 152 -290Q104 -319 78 -370Q51 -421 51 -486Q51 -551 78 -602Q104 -653 152 -682Q201 -710 265 -710Q372 -710 431 -638Q490 -566 490 -444Q490 -332 442 -236Q394 -139 308 -74Q222 -10 113 10ZM428 -485Q428 -564 384 -612Q339 -661 266 -661Q194 -661 150 -612Q106 -564 106 -485Q106 -406 150 -358Q194 -309 265 -309Q338 -309 383 -358Q428 -406 428 -485Z"],",":[223,"M170 -27Q170 19 146 72Q121 126 82 162L61 138Q84 112 100 76Q117 40 122 6L107 7Q86 7 72 -8Q59 -22 59 -45Q59 -70 74 -86Q89 -101 113 -101Q138 -101 154 -81Q170 -61 170 -27Z"],".":[223,"M62 -41Q62 -64 76 -78Q89 -92 111 -92Q133 -92 147 -78Q161 -63 161 -41Q161 -19 147 -4Q133 10 111 10Q89 10 76 -4Q62 -18 62 -41Z"],"-":[340,"M40 -288H300V-244H40Z"],"%":[857,"M50 -518Q50 -606 89 -658Q128 -710 194 -710Q261 -710 300 -658Q339 -606 339 -518Q339 -429 300 -377Q261 -325 194 -325Q128 -325 89 -377Q50 -429 50 -518ZM613 -700H667L238 13H184ZM291 -518Q291 -587 265 -627.5Q239 -668 194 -668Q149 -668 123 -627.5Q97 -587 97 -518Q97 -447 123 -406.5Q149 -366 194 -366Q239 -366 265 -406.5Q291 -447 291 -518ZM519 -182Q519 -271 557.5 -323.5Q596 -376 662 -376Q729 -376 768 -323.5Q807 -271 807 -182Q807 -94 768 -42Q729 10 662 10Q596 10 557.5 -41.5Q519 -93 519 -182ZM760 -182Q760 -253 734 -293.5Q708 -334 662 -334Q617 -334 591 -293.5Q565 -253 565 -182Q565 -113 591 -72.5Q617 -32 662 -32Q708 -32 734 -72.5Q760 -113 760 -182Z"],"(":[293,"M40 -344Q40 -468 80.5 -578Q121 -688 189 -750H248Q178 -694 136 -583.5Q94 -473 94 -344Q94 -215 136 -104.5Q178 6 248 62H189Q121 0 80.5 -110Q40 -220 40 -344Z"],")":[293,"M199 -344Q199 -473 156.5 -584Q114 -695 44 -750H104Q172 -688 212.5 -578Q253 -468 253 -344Q253 -220 212.5 -110Q172 0 104 62H44Q114 7 156.5 -104Q199 -215 199 -344Z"]};

  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/quote-notice-api';
  var BIDS_API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api';   // auction day/time of each site (ตารางประมูลแจ้งเตือน)
  var st = { name: '', pages: [], rows: [], pdf: null, busy: false, id: null, saveState: '', history: null, histErr: '', bids: null };

  // ---------------------------------------------------------------- saved work (Supabase: quote_notices)
  async function token() {
    try { if (typeof window.getBestDataToken === 'function') { var t = await window.getBestDataToken(); if (t) return t; } } catch (_) {}
    try { return localStorage.getItem('divergent_web_session_token_v1') || localStorage.getItem('divergent_fallback_session_token') || ''; } catch (_) { return ''; }
  }
  async function call(body, url) {
    var t = await token();
    if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    var r = await fetch(url || API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) });
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
  // the site list always comes fresh from ตารางประมูลแจ้งเตือน, so sites added, deleted or renamed there show up here
  async function loadHistory() {
    var bids = call({ action: 'list' }, BIDS_API).then(function (j) { st.bids = j.items || []; }, function (e) { console.warn('quote-notice bids', e); st.bids = []; });
    try { var j = await call({ action: 'list' }); st.history = j.items || []; st.histErr = ''; }
    catch (e) { st.history = []; st.histErr = e.message || String(e); }
    if (bids) await bids;
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
    try { await call({ action: 'delete', id: id }); if (st.id === id) closeJob(); await loadHistory(); }
    catch (e) { alert('ลบไม่สำเร็จ: ' + (e.message || e)); }
  }
  // The menu lists the saved jobs by site name with the site's auction day/time from ตารางประมูลแจ้งเตือน:
  // auctions from today on first (soonest first), then jobs without a date, then auctions already past
  function nameKey(v) { return String(v || '').replace(/[ัิ-ฺ็-๎\s.]/g, '').replace(/^(กฟส|กฟจ|กฟอ)/, ''); }
  // the bid row a saved job belongs to: same site name, else the longest site name inside the title (older jobs named after the file)
  function bidFor(title) {
    var k = nameKey(title);
    return (st.bids || []).filter(function (b) { return nameKey(b.site) === k; })[0] ||
      (st.bids || []).filter(function (b) { var bk = nameKey(b.site); return bk && k.indexOf(bk) >= 0; })
        .sort(function (a, b) { return nameKey(b.site).length - nameKey(a.site).length; })[0] ||
      // a site of several offices ("ลำปลายมาศ + หนองหงส์"): a job named after its first office
      (st.bids || []).filter(function (b) { return /\+/.test(b.site || '') && nameKey(String(b.site).split('+')[0]) === k; })[0] || null;   // "นครราชสีมา 2" before "นครราชสีมา"
  }
  function todayIso() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }   // Bangkok calendar day
  function thaiDate(iso) { var p = String(iso).slice(0, 10).split('-'); return Number(p[2]) + '/' + Number(p[1]) + '/' + (Number(p[0]) + 543); }
  // Every site of ตารางประมูลแจ้งเตือน, auctions from today on first (soonest first), then sites without a date, then past auctions.
  // A site opens its saved quotation; a site without one asks for its PDF. Jobs whose site is no longer in the table are listed below.
  function renderHistory() {
    var box = document.getElementById('qnHistory'); if (!box) return;
    if (st.history == null || st.bids == null) { box.innerHTML = '<div class="qn-h-empty">กำลังโหลด…</div>'; return; }
    if (st.histErr) { box.innerHTML = '<div class="qn-h-empty">โหลดรายการไม่สำเร็จ: ' + esc(st.histErr) + '</div>'; return; }
    var today = todayIso(), jobs = {}, orphans = [];
    st.history.forEach(function (h) { var b = bidFor(h.title); if (b) (jobs[b.id] = jobs[b.id] || []).push(h); else orphans.push(h); });   // newest first, as listed
    var dayOf = function (b) { return b.bid_date ? String(b.bid_date).slice(0, 10) : ''; };
    var group = function (b) { var d = dayOf(b); return !d ? 1 : (d >= today ? 0 : 2); };
    var list = st.bids.slice().sort(function (x, y) {
      return group(x) - group(y) || dayOf(x).localeCompare(dayOf(y)) || String(x.bid_time || '').localeCompare(String(y.bid_time || '')) ||
        (x.seq || 1e9) - (y.seq || 1e9) || x.id - y.id;
    });
    var card = function (i, cls, attr, name, sub) {
      return '<button class="qn-site' + cls + '" ' + attr + '><span class="no">' + i + '</span><span class="nm">' + esc(name) + '<small>' + sub + '</small></span><span class="go">›</span></button>';
    };
    var html = list.length ? '<div class="qn-list">' + list.map(function (b, i) {
      var d = dayOf(b), js = jobs[b.id] || [];
      var when = d ? (d === today ? '<b>วันนี้</b> ' : '') + thaiDate(d) + (b.bid_time ? ' · ' + esc(b.bid_time) + ' น.' : '') + (d < today ? ' · ประมูลไปแล้ว' : '') : 'ยังไม่มีวันประมูล';
      var state = js.length ? '<span class="qn-tag ok">มีใบเสนอราคา' + (js.length > 1 ? ' ' + js.length + ' งาน' : '') + (js[0].total_amount ? ' · ' + money(js[0].total_amount) : '') + '</span>' : '<span class="qn-tag">ยังไม่มีใบเสนอราคา</span>';
      return card(i + 1, (d && d < today ? ' past' : '') + (d === today ? ' today' : ''), js.length ? 'data-open="' + js[0].id + '"' : 'data-new="' + b.id + '"',
        b.site || '(ไม่มีชื่อไซด์)', when + '<br>' + state);
    }).join('') + '</div><div class="qn-count">รวม ' + list.length + ' ไซด์ (จากตารางประมูลแจ้งเตือน)</div>'
      : '<div class="qn-h-empty">ยังไม่มีไซด์ในตารางประมูลแจ้งเตือน</div>';
    if (orphans.length) html += '<div class="qn-h-head">งานที่ไม่มีไซด์ในตารางประมูล <small>(ไซด์ถูกลบหรือชื่องานไม่ตรงกับชื่อไซด์)</small></div><div class="qn-list">' +
      orphans.map(function (h, i) { return card(i + 1, '', 'data-open="' + h.id + '"', h.title, h.total_amount ? money(h.total_amount) : 'ยังไม่กรอกราคา'); }).join('') + '</div>';
    box.innerHTML = html;
  }
  function closeJob() { st.blank = null; st.blankMsg = ''; st.pages = []; st.rows = []; st.pdf = null; st.bytes = null; st.id = null; st.name = ''; st.saveState = ''; }

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

  // A scanned form has its quantity only as a picture ("168,000"): read that one cell with Tesseract (digits only),
  // loaded on demand for scanned files. The value stays editable; the ตารางประมูล quantity is the next fallback.
  var TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var TESS_OPTS = { workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js', corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int' };
  var tessReady = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessReady) return tessReady;
    tessReady = new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = TESS; s.async = true;
      s.onload = function () { ok(window.Tesseract); };
      s.onerror = function () { tessReady = null; fail(new Error('โหลดตัวอ่านตัวเลขไม่สำเร็จ')); };
      document.head.appendChild(s);
    });
    return tessReady;
  }
  function printedNumber(text) {
    var t = String(text || '').replace(/\s+/g, '').replace(/[.,]-?$/, '');
    if (!/^\d{1,3}([,.]\d{3})+$|^\d{1,7}$/.test(t)) return 0;
    return Number(t.replace(/[,.]/g, ''));
  }
  async function readPrintedQty() {
    var rows = st.rows.filter(function (r) { return r.qtyPrinted && !(r.qty > 0); });
    if (!rows.length) return;
    var worker = null;
    try {
      var T = await loadTesseract();
      worker = await T.createWorker('eng', 1, TESS_OPTS);
      await worker.setParameters({ tessedit_char_whitelist: '0123456789,.', tessedit_pageseg_mode: '7' });
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i], pg = st.pages[r.page], S = RENDER_SCALE, size = r.h * 0.67, c = r.cells.qty;
        var x0 = Math.round((c[0] + 2) * S), x1 = Math.round((c[1] - 2) * S), y0 = Math.round((r.y - size * 1.15) * S), y1 = Math.round((r.y + size * 0.4) * S);
        var cut = document.createElement('canvas'), pad = 20;
        cut.width = x1 - x0 + pad * 2; cut.height = y1 - y0 + pad * 2;
        var g = cut.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cut.width, cut.height);
        g.drawImage(pg.bg, x0, y0, x1 - x0, y1 - y0, pad, pad, x1 - x0, y1 - y0);
        var res = await worker.recognize(cut);
        var q = printedNumber(res.data.text);
        if (q > 0) { r.qty = q; r.qtyOcr = true; }
      }
    } catch (e) { console.warn('quote-notice ocr', e); }
    finally { if (worker) worker.terminate().catch(function () {}); }
  }

  // ---------------------------------------------------------------- table detection
  // Thai marks are often lost in PDF text, so headers are matched loosely.
  var RE = {
    price: /ราคา/,
    amount: /นวนเงิน/,
    vat: /ภาษี/,
    total: /รวม.*(เงิน|สิ\S{0,2}น)|ทั\S{0,2}งสิ\S{0,2}น/,
    qty: /^จ\s?\S{0,3}นวน$/,   // "จ านวน": ำ lost to a space (TH SarabunIT๙ Word forms, e.g. กฟส.โนนสูง)
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
      // some fonts store ่ / ้ as "É" / "Ê" (e.g. กฟส.น้ำพอง): only as a lone glyph or right after a Thai letter
      .replace(/(^|[\u0E01-\u0E4E])([\u00C9\u00CA])/g, function (m, a, c) { return a + (c === '\u00C9' ? '\u0E48' : '\u0E49'); })
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
    total: /ทั\S{0,2}งสิ\S{0,2}น/
  };
  //  C) รายการที่ | กิจกรรม | จำนวน/ปริมาณงาน (ราย) | ราคากลาง: ต่อหน่วย | รวม | ราคาที่เสนอ: ต่อหน่วย | รวม
  //     the offered columns are blank; รวม / VAT 7% / รวมทั้งสิ้น rows below are filled in the offered รวม column.
  var SUM = { total: /ทั\S{0,2}งสิ\S{0,2}น/, vat: /ภาษี|VAT/i, amount: /^\d?\s*รวม|ไม\S{0,2}รวมภาษี/ };
  function sumKey(str) {
    if (SUM.total.test(str)) return 'total';
    if (/ไม\S{0,2}รวมภาษี|ก\S{0,2}อนภาษี/.test(str)) return 'amount';   // "ราคารวมก่อนภาษีมูลค่าเพิ่ม" is the sum before VAT
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
    // "รวม", or "รวม(ไม่รวม" with "ภาษีมูลค่าเพิ่ม)" wrapped onto the next line (e.g. กฟส.ด่านขุนทด)
    var sum = near.filter(function (i) { return /^รวม(\s*\(\s*ไม\S{0,2}\s*รวม.*)?$/.test(i.str.trim()) && right(i); }).sort(function (a, b) { return a.x - b.x; })[0];
    // "(ราย)" under the quantity header; a bare "ราย" can also be a split piece of "รายการ" in the first
    // columns (e.g. กฟส.เสิงสาง), so prefer the bracketed one, then the right-most (closest to the prices)
    var qty = near.filter(function (i) { return /\(?\s*ราย\s*\)?$/.test(i.str.trim()) && i.str.trim().length <= 7 && center(i) < offer.x; })
        .sort(function (a, b) { return (/\(/.test(b.str) - /\(/.test(a.str)) || (b.x - a.x); })[0] ||
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
      // a number stays apart from Thai words it touches ("108,000" | ".ราย", "924,480" | "บาท"), so its digits can be redrawn
      // in their own place without covering the word (e.g. กฟส.โนนสูง)
      var numWord = last && ((/\d$/.test(last.str) && /[\u0E01-\u0E4E]/.test(i.str)) || (/[\u0E01-\u0E4E]/.test(last.str) && /^\d/.test(i.str)));
      if (last && !numWord && Math.abs(last.y - i.y) <= 1.5 && i.x - (last.x + last.w) <= 1.5 && i.x >= last.x) {
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
      // "จำนวน (ราย/เดือน)": the quantity is per month (e.g. กฟส.เมืองนครราชสีมา 2)
      var perMonth = near.some(function (i) { var c = center(i); return /เดือน/.test(i.str) && i.y >= cols.qty.y - 2 && c > bounds.qty[0] && c < bounds.qty[1]; });
      tables.push({ page: pageNo, y: p.y, headerBottom: headerBottom, bounds: bounds, cols: order, sums: [], perMonth: perMonth,
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
      var dash = function (o) { return /^[-–—]+$/.test(o.str.trim()) && center(o) > amtL; };
      body.forEach(function (i) {
        if (center(i) >= amtL) return;
        // judge the whole label of the line: "ราคารวมก่อน" + "ภาษีมูลค่าเพิ่ม" may come as separate pieces
        var line = body.filter(function (o) { return Math.abs(o.y - i.y) < 4 && center(o) < amtL && !RE.number.test(o.str.trim()); })
          .sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.str.trim(); }).join('');
        var key = sumKey(line) || sumKey(i.str.trim());
        if (sums.some(function (s) { return Math.abs(s.y - i.y) < 4; })) return;
        // a label far left (a merged "รวม" cell under ที่/รายการ) only counts when its row has "-" placeholders in the money columns
        if (i.x + i.w < t.bounds.qty[0] - 40 && !(key && body.some(function (o) { return Math.abs(o.y - i.y) < 4 && dash(o); }))) return;
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
      // layout A: one "รวม" row with เป็นเงิน / ภาษี / รวมทั้งสิ้น side by side (placeholders "-" in each) instead of one row per figure
      var across = sums.length === 1 && sums[0].key === 'amount' && t.cols.indexOf('vat') >= 0 && t.cols.indexOf('total') >= 0;
      var right = t.bounds[t.cols[t.cols.length - 1]][1];
      t.sums = sums.map(function (s) {
        s.across = across;
        s.blank = body.filter(function (i) { return Math.abs(i.y - s.y) < 4 && center(i) > amtL && center(i) < (across ? right : t.bounds.amount[1]) + 20 && /^[-–—.]+$/.test(i.str.trim()); });
        return s;
      });
      var firstRow = rows.filter(function (r) { return r.table === t; })[0];
      if (firstRow) { t.refStr = firstRow.refStr; t.refW = firstRow.refW; t.refH = firstRow.h; }
    });
    return rows;
  }

  // Scanned forms (a picture with no text layer, e.g. กฟจ.บุรีรัมย์ "Attach_TOR_3.pdf") have nothing for detectTables to
  // read, so the price table is found from the ruling lines drawn on the page:
  //   ลำดับ | รายการ | ปริมาณ (ราย) | ราคา/หน่วย | รวมเป็นเงิน   — header row(s) on top,
  //   รวมราคาไม่รวมภาษี / ภาษีมูลค่าเพิ่ม / รวมทั้งสิ้น   — rows below whose only inner line is the one before the last column.
  // The last three body columns are quantity, unit price and amount. The quantity printed in the picture stays as it is;
  // it is taken from ตารางประมูล (or typed) for the calculation only.
  // ink: one byte per pixel (1 = dark), W × H pixels at S pixels per PDF point.
  // A scanned page is often turned a little (≈1°): the slope t that makes the most rows of ink line up (lines and text).
  function scanSkew(ink, W, H) {
    var px = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x += 2) if (ink[y * W + x]) px.push(x, y);   // every row: skipping rows biases t = 0
    var best = 0, bestT = 0, pad = Math.ceil(W * 0.04) + 2, hist = new Float64Array(H + pad * 2);
    for (var t = -0.035; t <= 0.0351; t += 0.0005) {
      hist.fill(0);
      for (var i = 0; i < px.length; i += 2) hist[Math.round(px[i + 1] + px[i] * t) + pad]++;
      var score = 0; for (var j = 0; j < hist.length; j++) score += hist[j] * hist[j];
      if (score > best) { best = score; bestT = t; }
    }
    return Math.abs(bestT) < 0.0004 ? 0 : bestT;
  }
  function gridTables(ink0, W, H, S, pageNo) {
    // straighten the page: deskewed (X, Y) = (x − y·t, y + x·t), so a page point is (X + Y·t, Y − X·t)
    var t0 = scanSkew(ink0, W, H), ink = ink0;
    if (t0) {
      ink = new Uint8Array(W * H);
      for (var Y = 0; Y < H; Y++) for (var X = 0; X < W; X++) {
        var sx = Math.round(X + Y * t0), sy = Math.round(Y - X * t0);
        if (sx >= 0 && sy >= 0 && sx < W && sy < H) ink[Y * W + X] = ink0[sy * W + sx];
      }
    }
    var GAP = Math.max(2, Math.round(S)), TOL = 4 * S;
    function dark(x, y) { return x >= 0 && y >= 0 && x < W && y < H && ink[y * W + x] === 1; }
    // a line pixel: dark here or one pixel across (slightly skewed or thin scanned lines)
    function hDark(x, y) { return dark(x, y) || dark(x, y - 1) || dark(x, y + 1); }
    function vDark(x, y) { return dark(x, y) || dark(x - 1, y) || dark(x + 1, y); }
    function merge(list, along, a0, a1) {   // join segments found on neighbouring pixel rows/columns
      var out = [];
      list.forEach(function (s) {
        var last = out.filter(function (o) { return s[along] - o.end <= 2 && s[a0] < o[a1] && s[a1] > o[a0]; })[0];
        if (last) { last.end = s[along]; last.sum += s[along]; last.n++; last[a0] = Math.min(last[a0], s[a0]); last[a1] = Math.max(last[a1], s[a1]); }
        else { var c = { end: s[along], sum: s[along], n: 1 }; c[a0] = s[a0]; c[a1] = s[a1]; out.push(c); }
      });
      out.forEach(function (o) { o[along] = o.sum / o.n / S; o[a0] /= S; o[a1] /= S; });
      return out;
    }
    var hs = [], minH = 150 * S;
    for (var y = 0; y < H; y++) {
      for (var x = 0, start = -1, gap = 0; x <= W; x++) {
        if (x < W && hDark(x, y)) { if (start < 0) start = x; gap = 0; continue; }
        if (start >= 0 && x < W && ++gap <= GAP) continue;
        if (start >= 0 && x - gap - start >= minH) hs.push({ y: y, x0: start, x1: x - gap });
        start = -1; gap = 0;
      }
    }
    var vs = [], minV = 10 * S;
    for (var x2 = 0; x2 < W; x2++) {
      for (var y2 = 0, top = -1, g2 = 0; y2 <= H; y2++) {
        if (y2 < H && vDark(x2, y2)) { if (top < 0) top = y2; g2 = 0; continue; }
        if (top >= 0 && y2 < H && ++g2 <= GAP) continue;
        if (top >= 0 && y2 - g2 - top >= minV) vs.push({ x: x2, y0: top, y1: y2 - g2 });
        top = -1; g2 = 0;
      }
    }
    hs = merge(hs, 'y', 'x0', 'x1'); vs = merge(vs, 'x', 'y0', 'y1');
    if (!hs.length) return [];
    // the table's full-width lines
    var R = Math.max.apply(null, hs.map(function (h) { return h.x1; }));
    var L = Math.min.apply(null, hs.filter(function (h) { return h.x1 > R - TOL; }).map(function (h) { return h.x0; }));
    var full = hs.filter(function (h) { return h.x0 < L + TOL && h.x1 > R - TOL; }).sort(function (a, b) { return a.y - b.y; });
    var bands = [];
    for (var i = 0; i + 1 < full.length; i++) {
      var ya = full[i].y, yb = full[i + 1].y;
      if (yb - ya < 8) continue;
      var xs = [];
      vs.filter(function (v) { return v.y0 <= ya + 2 && v.y1 >= yb - 2 && v.x > L - TOL && v.x < R + TOL; })
        .sort(function (a, b) { return a.x - b.x; })
        .forEach(function (v) { if (!xs.length || v.x - xs[xs.length - 1] > TOL) xs.push(v.x); });
      bands.push({ y0: ya, y1: yb, xs: xs });
    }
    var most = Math.max.apply(null, bands.map(function (b) { return b.xs.length; }).concat([0]));
    if (most < 5) return [];                                   // at least: item | quantity | price | amount
    var bodyIdx = bands.map(function (b, k) { return b.xs.length === most ? k : -1; }).filter(function (k) { return k >= 0; });
    var first = bodyIdx[0], lastBody = bodyIdx[bodyIdx.length - 1];
    if (first < 1) return [];                                  // no header above the items
    var xs0 = bands[first].xs, n = xs0.length - 1, line = 0.8;
    var cell = function (k) { return [xs0[k] + line, xs0[k + 1] - line]; };
    var cols = { qty: cell(n - 3), price: cell(n - 2), amount: cell(n - 1) };
    var sumBands = [];
    for (var k = lastBody + 1; k < bands.length; k++) {
      var b = bands[k];
      // the amount cell keeps both its lines and nothing inside; the line between quantity and price is gone
      // (tall letters of the label on the left may look like short lines, so only these columns are judged)
      var has = function (x) { return b.xs.some(function (v) { return Math.abs(v - x) <= TOL; }); };
      if (!has(xs0[n - 1]) || !has(xs0[n]) || has(xs0[n - 2]) || b.xs.some(function (v) { return v > xs0[n - 1] + TOL && v < xs0[n] - TOL; })) break;
      sumBands.push(b);
    }
    if (!sumBands.length || sumBands.length > 3) return [];
    function inkRows(x0, x1, y0, y1) {          // pixel rows (in points) of the cell that carry ink, borders left out
      var out = [];
      for (var yy = Math.round((y0 + 2) * S); yy < Math.round((y1 - 2) * S); yy++) {
        for (var xx = Math.round((x0 + 2) * S); xx < Math.round((x1 - 2) * S); xx++) if (dark(xx, yy)) { out.push(yy / S); break; }
      }
      return out;
    }
    function firstLine(rows) {                   // top and bottom of the first text line in the cell
      if (!rows.length) return null;
      var top = rows[0], bot = rows[0];
      for (var j = 1; j < rows.length && rows[j] - bot <= 2; j++) bot = rows[j];
      return { top: top, bottom: bot };
    }
    var t = { page: pageNo, y: bands[first - 1].y0, headerBottom: bands[first].y0, bounds: cols, cols: ['qty', 'price', 'amount'], sums: [],
      perMonth: false, title: 'ตารางที่ 1', refStr: '', refW: 0, scanned: true };
    var rows = [], size = 0;
    bodyIdx.forEach(function (k) {
      var b = bands[k];
      var q = firstLine(inkRows(cols.qty[0], cols.qty[1], b.y0, b.y1));
      var lab = firstLine(inkRows(xs0[n - 4], xs0[n - 3], b.y0, b.y1));   // the รายการ cell
      if (!q && !lab) return;                                  // empty spacer row
      if (q && !size) size = Math.min(22, Math.max(10, (q.bottom - q.top) / 0.72));
      rows.push({ band: b, q: q, lab: lab });
    });
    if (!rows.length) return [];
    size = size || 16;
    var h = size / 0.67, cap = size * 0.7;
    t.refH = h;
    var out = rows.map(function (r, idx) {
      var y = r.q ? r.q.bottom : r.lab ? Math.min(r.lab.bottom, r.band.y0 + 4 + cap * 1.4) : r.band.y0 + 4 + cap;
      return { page: pageNo, table: t, y: y, h: h, refStr: '', refW: 0, qty: 0, qtyEdit: true, qtyPrinted: !!r.q,
        label: 'รายการที่ ' + (idx + 1) + ' (ไฟล์สแกน)', price: 0, cells: { qty: cols.qty, price: cols.price, amount: cols.amount } };
    });
    // back to page positions: cells move sideways with their row, a row's line height is taken over the money columns
    var mid = (cols.price[0] + cols.amount[1]) / 2;
    var shift = function (c, y) { return [c[0] + y * t0, c[1] + y * t0]; };
    out.forEach(function (r) {
      r.cells = { qty: shift(cols.qty, r.y), price: shift(cols.price, r.y), amount: shift(cols.amount, r.y) };
      r.y -= mid * t0;
    });
    t.bounds = out[0].cells;
    var keys = sumBands.length === 3 ? ['amount', 'vat', 'total'] : sumBands.length === 2 ? ['amount', 'total'] : ['amount'];
    t.sums = sumBands.map(function (b, k) {
      var c = [xs0[n - 1] + line, xs0[n] - line], y = (b.y0 + b.y1) / 2 + cap / 2;
      return { key: keys[k], y: y - (c[0] + c[1]) / 2 * t0, h: h, across: false, blank: [], cell: shift(c, y) };
    });
    return out;
  }
  function scanTables(canvas, pageNo) {
    var W = canvas.width, H = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, W, H).data, ink = new Uint8Array(W * H);
    for (var i = 0, p = 0; i < ink.length; i++, p += 4) ink[i] = d[p] + d[p + 1] + d[p + 2] < 384 ? 1 : 0;
    return gridTables(ink, W, H, RENDER_SCALE, pageNo);
  }

  // Thai digits printed in the form (๑๒๐,๐๐๐ / ๘.๐๐ / VAT ๗% / ปี ๒๕๗๐) are rewritten as Arabic digits, so every number on
  // the page looks the same as the filled prices (e.g. กฟส.ปราสาท). A whole number item keeps its own place; a number at the
  // start or end of a phrase is measured from the digit width of the page's number items. Numbers in mid-phrase stay as printed.
  function thaiDigitRuns(items) {
    var PURE = /^[\d,.\-%()]+$/;
    function units(s) { var d = 0, p = 0; s.replace(/[\d%]/g, function (c) { d += c === '%' ? 1.6 : 1; return c; }); p = s.replace(/[\d%]/g, '').length; return { d: d, p: p }; }
    var pure = items.filter(function (i) { return i.thai && PURE.test(i.str) && /\d/.test(i.str); });
    var ratios = pure.map(function (i) { var u = units(i.str); return (i.w - u.p * 0.25 * i.h) / (u.d * i.h); })
      .filter(function (r) { return r > 0.25 && r < 0.9; }).sort(function (a, b) { return a - b; });
    var dw = ratios.length ? ratios[ratios.length >> 1] : 0.5;
    function est(s, i) { var u = units(s); return Math.min(i.w, (u.d * dw + u.p * 0.25) * i.h); }
    var out = [];
    items.forEach(function (i) {
      if (!i.thai) return;
      if (pure.indexOf(i) >= 0) { out.push({ x: i.x, w: i.w, y: i.y, h: i.h, text: i.str, align: 'center' }); return; }
      var lead = i.str.match(/^(\d[\d,.]*%?)(?![\d,.%])/), trail = i.str.match(/(?:^|[^\d,.])(\d[\d,.]*%?)$/);
      if (lead) out.push({ x: i.x, w: est(lead[1], i), y: i.y, h: i.h, text: lead[1], align: 'left' });
      if (trail) { var w = est(trail[1], i); out.push({ x: i.x + i.w - w, w: w, y: i.y, h: i.h, text: trail[1], align: 'right' }); }
    });
    return out;
  }

  // "การไฟฟ้าส่วนภูมิภาคสาขาพุทไธสง" (tone marks may be missing) → "พุทไธสง"
  function officeSite(text) {
    var m = String(text || '').match(/การไฟฟ\S{0,2}า\s*ส\S{0,2}วนภูมิภาค\s*(?:สาขา|จังหวัด|อำเภอ)\s*([ก-๎]+(?:\s?\d(?!\d))?)/);
    return m ? m[1].replace(/(และ|ขอ|มี|จะ|ปร)$/, '').trim() : '';
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
  // A form whose quantity is left blank (one item) gets the site's quantity from ตารางประมูลแจ้งเตือน:
  // ราย/ปี = จำนวน, else วงเงิน ÷ 1.07 ÷ ราคากลาง; ÷ 12 when the column is ราย/เดือน. Still editable.
  async function qtyFromBids() {
    var blank = st.rows.filter(function (r) { return r.qtyEdit; });
    if (blank.length !== 1 || blank[0].qty > 0) return false;
    if (!st.bids) await call({ action: 'list' }, BIDS_API).then(function (j) { st.bids = j.items || []; }, function () { st.bids = []; });
    var b = (st.fromBids && (st.bids || []).filter(function (x) { return x.id === st.fromBids.id; })[0]) || bidFor(st.name);
    if (!b) return false;
    var year = num(b.qty) || (num(b.budget) && num(b.mid_price) ? Math.round(num(b.budget) / (1 + VAT) / num(b.mid_price)) : 0);
    var q = blank[0].table.perMonth ? Math.round(year / 12) : year;
    if (!(q > 0)) return false;
    blank[0].qty = q; blank[0].qtyAuto = b.site;
    return true;
  }
  function allTables() { var out = []; st.rows.forEach(function (r) { if (out.indexOf(r.table) < 0) out.push(r.table); }); return out; }

  async function openFile(file) {
    await flushSave();
    var data = new Uint8Array(await file.arrayBuffer());
    var site = st.forSite; st.forSite = '';
    await openBytes(data, file.name.replace(/\.pdf$/i, ''), null, null, site);
  }
  var itFonts = {};
  function itFont(page, id) {
    if (!(id in itFonts)) {
      var n = '';
      try { if (page.commonObjs.has(id)) n = page.commonObjs.get(id).name || ''; } catch (e) { }
      itFonts[id] = /Sarabun\s*IT/i.test(n);
    }
    return itFonts[id];
  }
  async function openBytes(data, name, savedId, savedState, site) {
    itFonts = {};      // font ids (g_d0_f1 …) are per document
    st.busy = true; render();
    var ok = false, filled = false;
    try {
      var lib = await loadPdfJs();
      st.bytes = data.slice();          // pdf.js hands its copy to the worker; the original file is kept untouched here
      var pdf = await lib.getDocument({ data: data }).promise;
      var text = '';
      st.pdf = pdf; st.name = name; st.pages = []; st.rows = []; st.id = savedId || null; st.saveState = '';
      for (var n = 1; n <= pdf.numPages; n++) {
        var page = await pdf.getPage(n);
        var vp = page.getViewport({ scale: 1 });
        var canvas = document.createElement('canvas');
        var big = page.getViewport({ scale: RENDER_SCALE });
        canvas.width = Math.round(big.width); canvas.height = Math.round(big.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: big }).promise;
        var tc = await page.getTextContent();
        // TH SarabunIT๙ draws the Arabic digits 0–9 as Thai digits (๐–๙): the text says "120,000" but the page shows ๑๒๐,๐๐๐
        // (e.g. กฟส.ปราสาท, typed in Word), so numbers in that font count as Thai digits too
        var items = tc.items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
          var t = lib.Util.transform(vp.transform, i.transform);
          var h = Math.hypot(t[2], t[3]);
          return { str: thaiText(i.str).trim(), x: t[4], y: t[5], w: i.width, h: h, thai: /[\u0E50-\u0E59]/.test(i.str) || (/\d/.test(i.str) && itFont(page, i.fontName)) };
        });
        items = mergeRuns(items);
        text += ' ' + items.map(function (i) { return i.str; }).join(' ');
        // fonts with a broken map write every "า" as "ำ" ("รำคำกลำง"): read such a page with า restored
        if (items.some(function (i) { return /รำคำ|รำยกำร/.test(i.str); })) items.forEach(function (i) { i.str = i.str.replace(/ำ/g, 'า').replace(/จ\s+า/g, 'จำ'); });
        st.pages.push({ w: vp.width, h: vp.height, bg: canvas, nums: thaiDigitRuns(items) });
        // a scanned page (only a picture, no text) is read from the table lines drawn on it
        var found = items.length ? detectTables(items, n - 1) : scanTables(canvas, n - 1);
        found.forEach(function (r) {
          if (!r.cells) r.cells = snapCells(r.y, r.h, r.table.cols, r.table, canvas);
          r.table.sums.forEach(function (sm) {
            if (sm.cell) return;
            if (sm.across) { sm.cells = snapCells(sm.y, sm.h, ['amount', 'vat', 'total'], r.table, canvas); sm.cell = sm.cells.amount; }
            else sm.cell = snapCells(sm.y, sm.h, ['amount'], r.table, canvas).amount;
          });
        });
        st.rows = st.rows.concat(found);
      }
      if (savedState) applySnapshot(savedState);
      if (!savedId) st.name = site || officeSite(text) || name;      // a new job is named after its site, so it sits under that site in the list
      await readPrintedQty();
      filled = await qtyFromBids() || st.rows.some(function (r) { return r.qtyOcr; });
      if (!st.rows.length && !savedId && isTorText(text)) {
        // only the TOR's บก.06 (e.g. กฟส.ขุขันธ์): open แบบฟอร์มเปล่า filled from it instead of a job without a table
        if (!st.bids) await call({ action: 'list' }, BIDS_API).then(function (j) { st.bids = j.items || []; }, function () { st.bids = []; });
        var tb = (st.fromBids && (st.bids || []).filter(function (x) { return x.id === st.fromBids.id; })[0]) || bidFor(st.name);
        var bd = blankFromTor(text, tb || (st.fromBids || (site ? { site: site } : null)));
        closeJob();
        st.blank = bd;
        st.blankMsg = 'ไฟล์ ' + name + ' เป็นตารางราคากลาง (บก.06) ไม่มีแบบฟอร์มใบเสนอราคา ระบบจึงใช้แบบฟอร์มเปล่าและนำข้อมูลจาก TOR มาให้แล้ว' +
          (num(bd.qty) > 0 && num(bd.mid) > 0 ? (bd.midGuess ? ' • ' + guessNote(bd) : ' กรุณาตรวจทานก่อนสร้างแบบฟอร์ม') :
            bd.torBudget ? ' • TOR บอกเฉพาะวงเงิน ' + money(num(bd.torBudget)) + ' บาท กรุณากรอกราคากลางต่อหน่วย ระบบจะคำนวณจำนวน (ราย) ให้' : ' • กรุณากรอกจำนวน (ราย) และราคากลางต่อหน่วย');
        return;
      }
      if (!st.rows.length) alert('ไม่พบตารางราคาในไฟล์นี้ (ต้องมีคอลัมน์ จำนวน, ราคาต่อหน่วย และจำนวนเงิน/รวม) กรุณาส่งไฟล์ให้ผู้ดูแลปรับรูปแบบ');
      ok = true;
    } catch (e) {
      console.error('quote-notice', e);
      alert('เปิดไฟล์ไม่สำเร็จ: ' + (e.message || e));
    } finally { st.busy = false; render(); }
    if (ok && (!savedId || filled) && st.rows.length) saveNow();     // a new file goes into the list straight away
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
      if (r.qtyEdit && r.qty > 0 && !r.qtyPrinted) put(r.page, r.qty.toLocaleString('en-US'), b.qty, r.y, size, r.table);
      r.table.cols.forEach(function (k) { if (k !== 'qty') put(r.page, money(vals[k]), b[k], r.y, size, r.table); });
    });
    allTables().forEach(function (t) {
      if (!t.sums.length || !st.rows.some(function (r) { return r.table === t && r.price > 0; })) return;
      var tot = tableTotals(t), size = sizeFor(t.refStr, t.refW, t.refH || 15);
      t.sums.forEach(function (sm) {
        sm.blank.forEach(function (i) { out.blanks.push({ page: t.page, x: i.x - 0.6, y: i.y - i.h * 0.62, w: i.w + 1.2, h: i.h * 0.62 + 1 }); });
        if (sm.across) ['amount', 'vat', 'total'].forEach(function (k) { put(t.page, money(tot[k]), (sm.cells && sm.cells[k]) || t.bounds[k], sm.y, size, t); });
        else put(t.page, money(tot[sm.key]), sm.cell || t.bounds.amount, sm.y, size, t);
      });
    });
    // Thai digits of the form itself → the same Arabic digits; inside a table they join its digit size below
    st.pages.forEach(function (pg, pi) {
      (pg.nums || []).forEach(function (n) {
        out.blanks.push({ page: pi, x: n.x - 0.8, y: n.y - n.h * 0.72, w: n.w + 1.6, h: n.h * 0.87 });
        var t = allTables().filter(function (t) {
          var r = st.rows.filter(function (r) { return r.table === t; }), last = Math.max.apply(null, r.map(function (r) { return r.y; }).concat(t.sums.map(function (s) { return s.y; })));
          return t.page === pi && n.y > t.y - 10 && n.y < last + 10;
        })[0];
        out.marks.push({ page: pi, text: n.text, x: n.x + n.w, y: n.y, size: n.h * 0.67, t: t || null, align: n.align, box: n });
      });
    });
    // one digit size per table: if a long amount had to shrink to fit its cell, the other numbers follow
    allTables().forEach(function (t) {
      var ms = out.marks.filter(function (m) { return m.t === t; });
      var min = Math.min.apply(null, ms.map(function (m) { return m.size; }));
      ms.forEach(function (m) { m.size = min; });
    });
    out.marks.forEach(function (m) {
      if (!m.box) return;
      var w = glyphWidth(m.text) * m.size / UPM;
      m.x = m.align === 'center' ? m.box.x + (m.box.w + w) / 2 : m.align === 'left' ? m.box.x + w : m.box.x + m.box.w;
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
      dqShowPdf(w, new Blob([bytes], { type: 'application/pdf' }), fileName());   // the browser's PDF viewer prints it as is
    } catch (e) { w.close(); alert('สร้าง PDF ไม่สำเร็จ: ' + (e.message || e)); }
  }

  // ---------------------------------------------------------------- blank form
  // Some offices' TOR has no quotation form, only the price table (บก.06). "ใช้แบบฟอร์มเปล่า" draws one in the layout
  // of กฟส.ครบุรี (layout C above: ราคากลาง ต่อหน่วย/รวม | ราคาที่เสนอ ต่อหน่วย/รวม, then รวม / VAT 7% / รวมทั้งสิ้น)
  // from the site's figures or its TOR, and opens it like any office PDF so the offered columns are filled in the same way.
  var FONTKIT = 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';
  var BLANK_FILES = { regular: './fonts/Sarabun-Regular.ttf', bold: './fonts/Sarabun-Bold.ttf', logo: './images/pea-logo.png' };
  var BLANK_KEYS = ['work', 'office', 'year', 'area', 'areaList', 'activity', 'qty', 'mid'];
  function fmtNum(n) { n = Number(n) || 0; return n.toLocaleString('en-US', Math.round(n) === n ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function blankBudget(d) { return Math.round(num(d.qty) * num(d.mid) * (1 + VAT) * 100) / 100; }
  // ปีงบประมาณ starts in October: offices auction the year's job from mid-year on, so a bid from July names the next year
  function fiscalYear(iso) { var d = iso ? new Date(String(iso).slice(0, 10)) : new Date(); if (isNaN(d)) d = new Date(); return d.getFullYear() + 543 + (d.getMonth() >= 6 ? 1 : 0); }
  // a site from ตารางประมูลแจ้งเตือน already carries its quantity and ราคากลาง (read from its TOR there)
  function blankDefaults(bid) {
    var b = bid || {}, site = String(b.site || '').replace(/^(กฟส|กฟจ|กฟอ)\.?\s*/, '');
    return { work: 'งานจ้างเหมาบุคคลภายนอกปฏิบัติเกี่ยวกับงานงดจ่ายไฟ', office: site ? 'การไฟฟ้าส่วนภูมิภาคสาขา' + site : '', year: String(fiscalYear(b.bid_date)),
      area: b.office || (site ? 'กฟส.' + site : ''), areaList: '', activity: 'งานวางใบแจ้งเตือน', qty: b.qty ? String(b.qty) : '', mid: b.mid_price ? String(b.mid_price) : '' };
  }
  // TOR text → form fields. The บก.06 table is "ชื่อโครงการ … วงเงินงบประมาณที่ได้รับจัดสรร 1,027,200 บาท … 120,000 8 960,000.00 …
  // สถานที่ปฏิบัติงาน การไฟฟ้าส่วนภูมิภาคสาขาภูเขียว …"; marks are often lost ("ประจาปี", "จานวน")
  function torFields(text) {
    var F = String(text || '').replace(/\s+/g, ' ').replace(/ประจ\s*า\s*ปี/g, 'ประจำปี').replace(/จ\s*านวน/g, 'จำนวน')
      .replace(/([ก-๎])\s*\.\s*(?=[ก-๎])/g, '$1.'), out = {}, m;     // "กฟส . ภูเขียว" → "กฟส.ภูเขียว"
    m = F.match(/วงเงิน[\s\S]{0,60}?(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/);
    var budget = m ? num(m[1]) : 0;
    // quantity and price per notice: the pair whose quantity × price + VAT is the budget
    var nums = (F.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) || []).map(num);
    if (budget) nums.some(function (q) {
      return q >= 1000 && nums.some(function (p) {
        if (!(p > 0 && p < 100) || Math.abs(q * p * (1 + VAT) - budget) > 0.5) return false;
        out.qty = String(q); out.mid = String(p); return true;
      });
    });
    // a บก.06 cover page alone (e.g. กฟส.ขุขันธ์ 2570) has no table: only วงเงิน 806,245 and "ราคากลาง … เป็นเงิน 806,238.58".
    // The ราคากลาง is จำนวน × ราคาต่อหน่วย + VAT to the satang, so the pair is the one price that gives it exactly
    // (107,642 × 7.00); marked as an estimate, and typing another price recomputes จำนวน
    if (budget && !out.qty) {
      out.budget = String(budget);
      m = F.match(/ราคากลาง[\s\S]{0,120}?เป็นเงิน\s*(\d{1,3}(?:,\d{3})+\.\d\d)/);
      if (m && num(m[1]) <= budget) out.ref = String(num(m[1]));
      var g = guessPair(out.ref) || guessPair(budget);
      if (g) { out.qty = String(g[0]); out.mid = String(g[1]); out.guess = '1'; }
    }
    m = F.match(/(?:ประจำปี|ปีงบประมาณ)\s*(?:พ\.\s*ศ\.\s*)?(25\d\d)/);
    if (m) out.year = m[1];
    var sites = [], full = {}, re = /การไฟฟ\S{0,2}า\s*ส\S{0,2}วนภูมิภาค\s*สาขา\s*([ก-๎]+)/g;
    while ((m = re.exec(F))) { var s = m[1].replace(/(และ|ขอ|มี|จะ|ปร)$/, ''), s0 = s;
      s = s.replace(/^อำเภอ(?=[ก-๎]{2})/, '');      // "สาขาอำเภอขุขันธ์": the office's full name, the site is ขุขันธ์
      if (sites.indexOf(s) < 0) { sites.push(s); full[s] = s0; } }
    m = F.match(/ช\S{0,3}\s*โครงการ\s*(.+?)\s+(?:หน\S{0,2}วยงานเจ\S{0,2}าของ|\d\s*วงเงิน|วงเงิน)/);
    var project = m ? m[1].trim() : '';
    var main = (project.match(/กฟ[สจ]\.\s*([ก-๎]+?)(?:และ|\s|$)/) || [])[1] || sites[0];
    // "ประกวดราคาจ้างจ้างเหมา…จัดส่งหนังสือแจ้งเตือนค่าไฟฟ้า ด้วยโปรแกรม Invoice Notification SystemINSx ของ กฟส.ขข." → "งานจ้างเหมา…ค่าไฟฟ้า"
    if (project) out.work = project.replace(/^(?:ประกวดราคา|ประกาศ)\s*(?:จ้าง\s*)?(?=จ้าง)/, '')
      .split(/\s*(?:กฟ[สจ]\.|การไฟฟ\S{0,2}า\s*ส\S{0,2}วนภูมิภาค|ในเขต|ประจำปี|ด้วยโปรแกรม|ด้วยวิธี|\sของ\s)/)[0].trim();
    if (out.work && !/^งาน/.test(out.work)) out.work = 'งาน' + out.work;
    if (/จัดส่งหนังสือแจ้งเตือน/.test(project)) out.activity = 'จัดส่งหนังสือแจ้งเตือน';     // INSx jobs: letters, not notices on the meter
    if (main) {
      out.office = 'การไฟฟ้าส่วนภูมิภาคสาขา' + (full[main] || main) + (/กฟฟ\.\s*ในสังกัด/.test(project) ? ' และ กฟฟ.ในสังกัด' : '');
      out.area = 'กฟส.' + main;
    }
    if (sites.length > 1) out.areaList = sites.map(function (s) { return 'กฟส.' + s; }).join(' ');
    return out;
  }
  // จำนวน (ราย) from the TOR's วงเงิน and ราคากลางต่อหน่วย, only when they agree to the baht (806,245 ÷ 1.07 ÷ 5 = 150,700)
  function budgetQty(budget, mid, tol) {
    budget = num(budget); mid = num(mid);
    if (!(budget > 0 && mid > 0)) return '';
    var q = Math.round(budget / (1 + VAT) / mid);
    return q >= 1000 && Math.abs(Math.round(q * mid * (1 + VAT) * 100) / 100 - budget) <= (tol == null ? 1 : tol) ? String(q) : '';
  }
  // the blank form's จำนวน for a typed price: the one that gives the TOR's ราคากลาง to the satang, else its วงเงิน to the satang,
  // else the nearest whole number under the ราคากลาง (or วงเงิน)
  function torQty(d, mid) {
    var r = (d.torRef && budgetQty(d.torRef, mid, 0.011)) || budgetQty(d.torBudget, mid, 0.011);
    if (r) return r;
    var base = num(d.torRef) || num(d.torBudget), q = base > 0 && num(mid) > 0 ? Math.round(base / (1 + VAT) / num(mid)) : 0;
    return q >= 1000 ? String(q) : '';
  }
  // จำนวน × ราคาต่อหน่วย + VAT = amount exactly. Offices' ราคากลาง are mostly 8 or 7 บาท, so those go first, then other
  // whole bahts, .50, .25/.75 and any 5 satang (3–12 บาท)
  var GUESS_BAHT = [8, 7, 6, 5, 9, 10, 4, 11, 12, 3];
  function guessPair(amount) {
    amount = num(amount);
    if (!(amount > 0)) return null;
    var tiers = [[0], [50], [25, 75], [5, 10, 15, 20, 30, 35, 40, 45, 55, 60, 65, 70, 80, 85, 90, 95]], hit = null;
    tiers.some(function (cents) {
      GUESS_BAHT.forEach(function (b) {
        cents.forEach(function (c) {
          var p = b + c / 100, q = !hit && p <= 12 && budgetQty(amount, p, 0.011);
          if (q) hit = [num(q), p];
        });
      });
      return !!hit;
    });
    return hit;
  }
  var TOR_KEYS = { budget: 'torBudget', ref: 'torRef', guess: 'midGuess' };
  function applyTor(d, got) { Object.keys(got).forEach(function (k) { d[TOR_KEYS[k] || k] = got[k]; }); return d; }
  function guessNote(d) {
    return d.midGuess && num(d.qty) > 0 ? 'TOR ไม่มีตารางรายละเอียด: จำนวน ' + fmtNum(num(d.qty)) + ' ราย × ราคากลาง ' + money(num(d.mid)) + ' บาท คำนวณย้อนจาก' +
      (d.torRef ? 'ราคากลาง ' + money(num(d.torRef)) : 'วงเงิน ' + money(num(d.torBudget))) + ' บาท (เป็นค่าประมาณ) ถ้าราคากลางต่อหน่วยไม่ใช่ค่านี้ แก้ช่องราคากลางแล้วระบบคำนวณจำนวนใหม่ให้' : '';
  }
  // the blank form's fields: the site's figures from ตารางประมูลแจ้งเตือน, overwritten by what the TOR says
  function blankFromTor(text, bid) {
    var d = blankDefaults(bid), got = torFields(text);
    applyTor(d, got);
    if (got.guess) d.qtyAuto = true;
    if (!num(d.qty) && d.torBudget && num(d.mid)) { d.qty = torQty(d, d.mid); d.qtyAuto = !!d.qty; }
    return d;
  }
  // a file with no price table whose text is a บก.06 (ตารางแสดงวงเงินงบประมาณ … ราคากลาง) is a TOR, not a quotation form
  function isTorText(text) { var t = String(text || '').replace(/\s+/g, ''); return /วงเงินงบประมาณ/.test(t) && /ราคากลาง|ราคาอ้างอิง/.test(t); }
  var MARK = /[ัิ-ฺ็-๎]/;
  // lines no wider than maxW: break at spaces; a run longer than the line (Thai has no spaces) breaks between letters, never before a mark
  function wrapText(s, font, size, maxW) {
    var out = [], cur = '';
    var fits = function (t) { return font.widthOfTextAtSize(t, size) <= maxW; };
    String(s || '').split(/(\s+)/).forEach(function (tok) {
      if (!tok) return;
      if (fits(cur + tok)) { cur += tok; return; }
      if (/^\s+$/.test(tok)) { out.push(cur); cur = ''; return; }
      if (cur.trim()) { out.push(cur); cur = ''; }
      for (var i = 0; i < tok.length; i++) {
        if (cur && !MARK.test(tok[i]) && !fits(cur + tok[i])) { out.push(cur); cur = ''; }
        cur += tok[i];
      }
    });
    out.push(cur);
    return out.map(function (l) { return l.trim(); }).filter(Boolean);
  }
  // A4 in PDF points; "top" values are baselines measured from the top edge.
  // pdf-lib places Thai marks with their own advance width (no GPOS), which breaks the words apart, so the letters are drawn
  // as outlines from fontkit's shaped layout, with the same text written invisibly on top for pdf.js to read (table detection).
  async function blankFormPdf(P, fontkit, files, d) {
    var doc = await P.PDFDocument.create();
    doc.registerFontkit(fontkit);
    var shape = { regular: fontkit.create(files.regular), bold: fontkit.create(files.bold) };
    // marks are kept as their own characters in the hidden text: no ligatures / composed forms ("ำ" stays one letter)
    var hidden = await doc.embedFont(files.regular, { subset: true, features: { ccmp: false, liga: false, locl: false, calt: false, rlig: false, clig: false, kern: false } });
    var logo = files.logo ? await doc.embedPng(files.logo) : null;
    var W = 595.28, H = 841.89, L = 51, RM = W - 51, S = 12, LH = 20, black = P.rgb(0, 0, 0);
    var pg = doc.addPage([W, H]);
    function run(s, f, z) {
      var lay = f.layout(s), k = z / f.unitsPerEm, x = 0, out = [];
      lay.glyphs.forEach(function (g, i) {
        var p = lay.positions[i];
        out.push({ path: g.path, x: (x + p.xOffset) * k, y: p.yOffset * k });
        x += p.xAdvance;
      });
      return { glyphs: out, w: x * k, k: k };
    }
    var measure = { widthOfTextAtSize: function (s, z) { return run(s, shape.regular, z).w; } };
    function text(s, x, top, o) {
      o = o || {}; s = String(s); if (!s.trim()) return;
      var z = o.size || S, r = run(s, o.bold ? shape.bold : shape.regular, z);
      if (o.align === 'center') x -= r.w / 2; else if (o.align === 'right') x -= r.w;
      r.glyphs.forEach(function (g) {
        if (!g.path.commands.length) return;
        pg.drawSvgPath(g.path.scale(1, -1).toSVG(), { x: x + g.x, y: H - top + g.y, scale: r.k, color: black, borderWidth: 0 });
      });
      // the hidden copy sits centred on the drawn words, so header centres read back where they are drawn
      var hw = hidden.widthOfTextAtSize(s, z);
      pg.drawText(s, { x: x + (r.w - hw) / 2, y: H - top, size: z, font: hidden, opacity: 0 });
    }
    function line(x1, t1, x2, t2, dots) {
      pg.drawLine({ start: { x: x1, y: H - t1 }, end: { x: x2, y: H - t2 }, thickness: dots ? 0.6 : 0.8, color: black, dashArray: dots ? [1, 1.5] : undefined });
    }
    var qty = num(d.qty), mid = num(d.mid), amount = Math.round(qty * mid * 100) / 100, vat = Math.round(amount * VAT * 100) / 100;
    var y = 34;
    if (logo) { var lh = 62, lw = logo.width * lh / logo.height; pg.drawImage(logo, { x: (W - lw) / 2, y: H - y - lh, width: lw, height: lh }); y += lh + 10; }
    y += S + 4;
    text('รายละเอียดประกอบใบเสนอราคา', W / 2, y, { align: 'center' });
    var title = [d.work, d.office ? 'ในเขตพื้นที่ระบบจำหน่ายของ' + d.office : '', d.year ? 'ประจำปีงบประมาณ ปี ' + d.year : ''].filter(Boolean).join(' ');
    wrapText(title, measure, S, RM - L - 40).forEach(function (ln) { y += LH; text(ln, W / 2, y, { align: 'center' }); });
    y += LH + 8; text('พื้นที่ ' + (d.area || ''), L, y, { bold: true, size: 13 });
    var para = 'พื้นที่ระบบจำหน่ายไฟฟ้าในเขต ' + (d.area || '') + (d.areaList ? ' (' + d.areaList + ')' : '') + ' ขออนุมัติ ปริมาณงาน จำนวน ' + fmtNum(qty) +
      '.- ราย จำนวน 1 กิจกรรม วงเงินงบประมาณ รวมภาษีมูลค่าเพิ่ม ' + fmtNum(amount + vat) + '.- บาท รายละเอียดดังนี้';
    wrapText(para, measure, S, RM - L).forEach(function (ln) { y += LH; text(ln, L, y); });
    // the table: 7 columns, a two-line header, the item row, then รวม / VAT 7% / รวมทั้งสิ้น
    var xs = [L];
    [10, 26, 11, 12, 13, 12, 16].forEach(function (p) { xs.push(xs[xs.length - 1] + (RM - L) * p / 100); });
    var cx = function (a, b) { return (xs[a] + xs[b == null ? a + 1 : b]) / 2; }, B = { bold: true, align: 'center' }, C = { align: 'center' };
    var t0 = y + 14, hm = t0 + 22, hb = hm + 22, rh = 24, rb = hb + rh, end = rb + rh * 3, base = 16.5;
    text('รายการ', cx(0), t0 + 17, B); text('ที่', cx(0), t0 + 32, B); text('กิจกรรมงานงดจ่ายไฟ', cx(1), t0 + 26, B);
    text('จำนวน', cx(2), t0 + base, B); text('ราคากลาง(บาท)', cx(3, 5), t0 + base, B); text('ราคาที่เสนอ (บาท)', cx(5, 7), t0 + base, B);
    text('(ราย)', cx(2), hm + base, B); text('ต่อหน่วย', cx(3), hm + base, B); text('รวม', cx(4), hm + base, B); text('ต่อหน่วย', cx(5), hm + base, B); text('รวม', cx(6), hm + base, B);
    text('1', cx(0), hb + base, C); text(d.activity || '', xs[1] + 5, hb + base);
    text(fmtNum(qty), cx(2), hb + base, C); text(fmtNum(mid), cx(3), hb + base, C); text(fmtNum(amount), xs[5] - 6, hb + base, { align: 'right' });
    [['รวม', amount], ['VAT 7%', vat], ['รวมทั้งสิ้น', amount + vat, true]].forEach(function (s, i) {
      var top = rb + rh * i + base;
      text(s[0], xs[4] - 6, top, { align: 'right', bold: s[2] }); text(fmtNum(s[1]), xs[5] - 6, top, { align: 'right', bold: s[2] });
    });
    [t0, hb, rb, rb + rh, rb + rh * 2, end].forEach(function (t) { line(L, t, RM, t); });
    line(xs[2], hm, RM, hm);
    xs.forEach(function (x, i) {
      if (i === 0 || i === 7) return line(x, t0, x, end);
      var top = (i === 4 || i === 6) ? hm : t0;
      line(x, top, x, (i >= 4) ? end : rb);
    });
    // signature
    var sx = 330, sy = end + 60;
    text('ลงชื่อ', sx, sy); line(sx + 32, sy + 3, RM - 62, sy + 3, true); text('ผู้เสนอราคา', RM, sy, { align: 'right' });
    text('(', sx, sy + 26); line(sx + 10, sy + 29, RM - 10, sy + 29, true); text(')', RM, sy + 26, { align: 'right' });
    text('วันที่', sx, sy + 52); line(sx + 28, sy + 55, RM, sy + 55, true);
    doc.setTitle('รายละเอียดประกอบใบเสนอราคา ' + (d.area || ''));
    return doc.save({ useObjectStreams: false });
  }
  // ---------------------------------------------------------------- end of blank form

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
      '.qn-h{display:flex;align-items:center;gap:8px;border:1px solid #eee7f4;border-radius:10px;padding:8px 10px;margin:6px 0;background:#fff}.qn-h.on{border-color:#7b4bab;background:#f7f1fc}.qn-h-main{flex:1;min-width:0;cursor:pointer}.qn-h-main b{display:block;font-size:13px;color:#3b2252;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.qn-h-main small{color:#776a86;font-size:12px}' +
      '.qn-h-total{font-weight:800;font-size:13px;white-space:nowrap}.qn-h-del{border:0;background:none;cursor:pointer;font-size:15px;opacity:.6}.qn-h-del:hover{opacity:1}.qn-h-empty{color:#776a86;font-size:13px;padding:6px 2px}' +
      '.qn-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}.qn-count{margin-top:10px;color:#6b5d7a;font-weight:700}' +
      '.qn-site{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #e5dced;border-radius:10px;background:#fff;padding:10px 12px;font:inherit;font-weight:700;color:#3b2252;cursor:pointer}' +
      '.qn-site:hover{border-color:#7b4bab;background:#faf6fd}.qn-site .no{min-width:26px;color:#8a7a9a;font-weight:600;font-size:12px}.qn-site .go{margin-left:auto;color:#a08cb6}' +
      '.qn-site .nm{display:flex;flex-direction:column;gap:2px}.qn-site small{font-weight:600;font-size:12px;color:#6b5d7a}.qn-site.today{border-color:#3a9a5b;background:#f2fbf5}.qn-site.today small{color:#2d7a47}.qn-site.past{opacity:.6}.qn-tag{display:inline-block;margin-top:3px;border-radius:6px;padding:1px 6px;font-size:11px;background:#f1edf5;color:#776a86}.qn-tag.ok{background:#e9f7ee;color:#2d7a47}' +
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
      var nw = e.target.closest('[data-new]');
      if (nw) {   // a site without a quotation yet: its PDF becomes the site's job
        var bid = (st.bids || []).filter(function (x) { return x.id === +nw.getAttribute('data-new'); })[0];
        st.forSite = bid ? bid.site : ''; w.querySelector('#qnFile').click(); return;
      }
      var dl = e.target.closest('[data-del]'); if (dl) { deleteSaved(+dl.getAttribute('data-del')); return; }
      var b = e.target.closest('[data-qn]'); if (!b) return;
      var a = b.getAttribute('data-qn');
      if (a === 'pick') { st.forSite = st.fromBids ? st.fromBids.site || '' : ''; w.querySelector('#qnFile').click(); }
      if (a === 'back') {
        flushSave().then(function () {
          closeJob();
          if (st.fromBids && typeof window.openNoticeBids === 'function') { st.fromBids = null; window.openNoticeBids(); return; }
          render(); loadHistory(); window.scrollTo(0, 0);
        });
      }
      if (a === 'blank') { var bb = st.fromBids ? (st.bids || []).filter(function (x) { return x.id === st.fromBids.id; })[0] : null; st.blank = blankDefaults(bb || st.fromBids); st.blankMsg = ''; render(); }
      if (a === 'blankTor') w.querySelector('#qnTor').click();
      if (a === 'blankMake') makeBlank();
      if (a === 'delete' && st.id) deleteSaved(st.id).then(render);
      if (a === 'pdf') savePdf();
      if (a === 'save') { setSaveState('กำลังบันทึก…'); saveNow(); }
      if (a === 'print') printPages();
      if (a === 'all') {
        var pv = w.querySelector('#qnAll').value.trim(); if (pv) { var v = num(pv); st.rows.forEach(function (r) { r.price = v; }); }
        var q = w.querySelector('#qnAllQty'); if (q && q.value.trim()) { var n = num(q.value); st.rows.forEach(function (r) { if (r.qtyEdit) r.qty = n; }); }
        render(); scheduleSave();
      }
    });
    w.addEventListener('change', function (e) {
      if (e.target.id === 'qnFile' && e.target.files[0]) { openFile(e.target.files[0]); e.target.value = ''; }
      if (e.target.id === 'qnTor' && e.target.files[0]) { importTor(e.target.files[0]); e.target.value = ''; }
    });
    w.addEventListener('input', function (e) {
      var bf = e.target.getAttribute('data-bf');
      if (bf && st.blank) {
        st.blank[bf] = e.target.value;
        if (bf === 'qty') st.blank.qtyAuto = false;
        if (bf === 'mid') st.blank.midGuess = '';
        // TOR gave only วงเงิน: typing ราคากลางต่อหน่วย fills จำนวน (ราย) while it is empty or was filled this way
        if (bf === 'mid' && st.blank.torBudget && (st.blank.qtyAuto || !num(st.blank.qty))) {
          var aq = torQty(st.blank, st.blank.mid), qi = w.querySelector('[data-bf="qty"]');
          st.blank.qty = aq; st.blank.qtyAuto = true; if (qi) qi.value = aq;
        }
        var bo = document.getElementById('qnBfBudget'); if (bo) bo.textContent = money(blankBudget(st.blank)) + ' บาท'; return; }
      if (e.target.id === 'qnName') { st.name = e.target.value.trim() || st.name; scheduleSave(); return; }
      var i = e.target.getAttribute('data-row'), q = e.target.getAttribute('data-qty');
      if (q != null) st.rows[+q].qty = num(e.target.value);
      else if (i != null) st.rows[+i].price = num(e.target.value);
      else return;
      updateNumbers(); redrawPreview(); scheduleSave();
    });
    w.addEventListener('dragover', function (e) { e.preventDefault(); var d = w.querySelector('.qn-drop'); if (d) d.classList.add('drag'); });
    w.addEventListener('dragleave', function () { var d = w.querySelector('.qn-drop'); if (d) d.classList.remove('drag'); });
    w.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer.files[0]; if (f && /pdf$/i.test(f.type || f.name)) { st.forSite = st.fromBids ? st.fromBids.site || '' : ''; openFile(f); } });
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
    if (!has && st.blank) { renderBlank(w); return; }
    // no job open: the list of sites; clicking one opens its quotation
    if (!has && st.fromBids) {
      // opened from ตารางประมูลแจ้งเตือน for a site that has no quotation yet: its PDF becomes the site's job
      w.innerHTML =
        '<div class="qn-head"><div><h2>ใบเสนอราคา · ' + esc(st.fromBids.site || '') + '</h2><p>ไซด์นี้ยังไม่มีใบเสนอราคา • เลือกไฟล์ PDF ใบเสนอราคาของการไฟฟ้า แล้วกรอกราคาต่อหน่วย</p></div></div>' +
        '<div class="qn-actions" style="margin-top:0"><button class="qn-btn soft" data-qn="back">← กลับไปตารางประมูล</button></div>' +
        '<div class="qn-card"><input type="file" id="qnFile" accept="application/pdf,.pdf" hidden>' +
        '<div class="qn-drop" data-qn="pick">' + (st.busy ? 'กำลังโหลด…' : '📄 กดเพื่อเลือกไฟล์ PDF ใบเสนอราคาของไซด์ ' + esc(st.fromBids.site || '') + '<br><small>หรือลากไฟล์มาวางที่นี่</small>') + '</div>' +
        '<div class="qn-actions" style="margin-bottom:0"><button class="qn-btn soft" data-qn="blank">📝 ใช้แบบฟอร์มเปล่า</button><span class="qn-state">TOR ไม่มีแบบฟอร์มใบเสนอราคา: สร้างจากข้อมูลไซด์หรือไฟล์ TOR</span></div></div>';
      return;
    }
    if (!has) {
      w.innerHTML =
        '<div class="qn-head"><div><h2>เสนอราคาแจ้งเตือน</h2><p>รายชื่อไซด์มาจากตารางประมูลแจ้งเตือน • กดไซด์ที่มีใบเสนอราคาเพื่อเปิด หรือกดไซด์ที่ยังไม่มีเพื่อเลือกไฟล์ PDF ของไซด์นั้น</p></div></div>' +
        '<div class="qn-card" style="margin-bottom:14px"><input type="file" id="qnFile" accept="application/pdf,.pdf" hidden>' +
        '<div class="qn-drop" data-qn="pick">' + (st.busy ? 'กำลังอ่านไฟล์…' : '📄 กดเพื่อเลือกไฟล์ PDF ใบเสนอราคา (งานใหม่)<br><small>หรือลากไฟล์มาวางที่นี่</small>') + '</div></div>' +
        '<div id="qnHistory"></div>';
      if (st.history == null) loadHistory(); else renderHistory();
      return;
    }
    w.innerHTML =
      '<div class="qn-head"><div><h2>' + (st.fromBids ? 'ใบเสนอราคา · ' + esc(st.fromBids.site || '') : 'เสนอราคาแจ้งเตือน') + '</h2><p>นำไฟล์ใบเสนอราคาของการไฟฟ้าเข้ามา กรอกราคาต่อหน่วย ระบบคำนวณช่องที่เหลือและพิมพ์ออกเป็น PDF หน้าตาเดิม</p></div></div>' +
      '<div class="qn-actions" style="margin-top:0"><button class="qn-btn soft" data-qn="back">' + (st.fromBids ? '← กลับไปตารางประมูล' : '← กลับไปรายชื่อไซด์') + '</button></div>' +
      '<div class="qn-grid"><div class="qn-card">' +
      '<input type="file" id="qnFile" accept="application/pdf,.pdf" hidden>' +
      '<div class="qn-drop" data-qn="pick">' + (st.busy ? 'กำลังอ่านไฟล์…' : (has ? '📄 ' + esc(st.name) + '<br><small>กดหรือวางไฟล์ใหม่เพื่อเปลี่ยน</small>' : '📄 กดเพื่อเลือกไฟล์ PDF ใบเสนอราคา<br><small>หรือลากไฟล์มาวางที่นี่</small>')) + '</div>' +
      (has ? '<div class="qn-line" style="margin-top:12px"><span>ชื่องาน</span><input id="qnName" style="flex:1;width:auto;text-align:left;border:1px solid #d9cfdf;border-radius:8px;padding:7px 8px;font:inherit" value="' + esc(st.name) + '"></div>' +
        '<div class="qn-actions"><button class="qn-btn" data-qn="save">💾 บันทึกงาน</button><button class="qn-btn soft" data-qn="pdf">📄 บันทึก PDF</button><button class="qn-btn soft" data-qn="print">🖨 พิมพ์</button><button class="qn-btn soft" data-qn="delete"' + (st.id ? '' : ' disabled') + '>🗑 ลบงาน</button><span class="qn-state" id="qnSaveState">' + esc(st.saveState) + '</span></div>' +
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
            (r.qtyEdit ? '<div class="qn-line"><span>จำนวน' + (r.table.perMonth ? ' (ราย/เดือน)' : '') + '</span><input data-qty="' + i + '" inputmode="numeric" value="' + (r.qty ? r.qty : '') + '" placeholder="0"></div>' +
              (r.qtyAuto ? '<small>จำนวนจากตารางประมูล (' + esc(r.qtyAuto) + ') แก้ได้ถ้าไม่ตรง</small>' : '') +
              (r.qtyPrinted ? '<small>' + (r.qtyOcr ? 'ไฟล์สแกน: อ่านจำนวนจากภาพแล้ว ตรวจให้ตรงกับฟอร์ม' : r.qty > 0 ? 'ไฟล์สแกน: ตรวจจำนวนให้ตรงกับฟอร์ม' : '<b style="color:#b42318">ไฟล์สแกน: กรุณาใส่จำนวนตามที่พิมพ์ในฟอร์ม ระบบจึงจะคำนวณได้</b>') + ' (ใช้คำนวณเท่านั้น ไม่พิมพ์ทับ)</small>' : '') : '') +
            '<div class="qn-line"><span>ราคา/หน่วย (บาท)</span><input data-row="' + i + '" inputmode="decimal" value="' + (r.price ? r.price : '') + '" placeholder="0.00"></div>' +
            '<div class="qn-line" data-out="' + i + '"></div></div>';
        }).join('') + '<div class="qn-sum" id="qnSum"></div>' : '') +
      '</div><div class="qn-pages" id="qnPages">' + (has ? '' : '<div class="qn-empty">ตัวอย่างเอกสารจะแสดงที่นี่</div>') + '</div></div>';
    updateNumbers(); redrawPreview();
  }

  // ---------------------------------------------------------------- menu
  function shown(id) { var el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none' && !el.hidden; }
  // For now only administrators see this menu
  function isAdmin() {
    var u = window.currentMenuUser || null;
    if (!u) { try { u = JSON.parse(localStorage.getItem('divergent_web_session_user') || 'null'); } catch (_) { u = null; } }
    var role = (u && u.role) || (window.qcAuthorizedUser && window.qcAuthorizedUser.user_role) || '';
    // only the main "admin" account, not every user whose role is admin
    return String(role).toLowerCase() === 'admin' && String((u && u.username) || '').toLowerCase() === 'admin';
  }
  function syncNav() {
    var nav = document.getElementById('navQuoteNotice'); if (!nav) return;
    var want = 'none';   // merged into ตารางประมูลแจ้งเตือน (📄 ใบเสนอราคา on every site); the page still opens from there
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
    st.fromBids = null;
    showWorkspace('navQuoteNotice');
    st.history = null; st.bids = null;
    render();
  }
  function showWorkspace(navId) {
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === navId); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    document.documentElement.classList.add('sa-wide');
    window.scrollTo(0, 0);
    loadPdfJs().catch(function () {}); loadPdfLib().catch(function () {});
  }
  window.openQuoteNotice = showPage;
  // ตารางประมูลแจ้งเตือน → 📄 ใบเสนอราคา of one site: open its saved quotation, or ask for its PDF when it has none
  window.openQuoteNoticeForSite = async function (bid) {
    if (!isAdmin()) { alert('เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    await flushSave();
    closeJob();
    st.fromBids = { id: bid.id, site: bid.site || '' };
    showWorkspace('navNoticeBids');
    st.busy = true; st.history = null; st.bids = null; render();
    await loadHistory();
    st.busy = false;
    var job = st.histErr ? null : (st.history || []).filter(function (h) { var b = bidFor(h.title); return b && b.id === bid.id; })[0];
    if (job) await openSaved(job.id); else render();
  };

  var fontkitReady = null;
  function loadFontkit() {
    if (window.fontkit) return Promise.resolve(window.fontkit);
    if (fontkitReady) return fontkitReady;
    fontkitReady = new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = FONTKIT; s.async = true;
      s.onload = function () { ok(window.fontkit); };
      s.onerror = function () { fontkitReady = null; fail(new Error('โหลดตัวอ่านฟอนต์ไม่สำเร็จ')); };
      document.head.appendChild(s);
    });
    return fontkitReady;
  }
  async function fileBytes(url) {
    var r = await fetch(url); if (!r.ok) throw new Error('โหลด ' + url + ' ไม่สำเร็จ');
    return new Uint8Array(await r.arrayBuffer());
  }
  // TOR PDF → its text, read the same way as an office form
  async function importTor(file) {
    try {
      st.blankMsg = 'กำลังอ่านไฟล์ TOR…'; render();
      var lib = await loadPdfJs(), pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, text = '';
      for (var n = 1; n <= Math.min(pdf.numPages, 6); n++) {
        var tc = await (await pdf.getPage(n)).getTextContent();
        text += ' ' + tc.items.map(function (i) { return thaiText(i.str); }).join(' ');
      }
      var got = torFields(text), keys = Object.keys(got);
      applyTor(st.blank, got);
      if (got.guess) st.blank.qtyAuto = true;
      else { st.blank.midGuess = ''; if (got.budget && !got.qty && num(st.blank.mid)) { var bq = torQty(st.blank, st.blank.mid); if (bq) { st.blank.qty = bq; st.blank.qtyAuto = true; } } }
      keys = keys.filter(function (k) { return !TOR_KEYS[k]; });
      st.blankMsg = keys.length ? 'นำเข้าจาก ' + file.name + ' แล้ว ' + keys.length + ' ช่อง ' + (guessNote(st.blank) || 'กรุณาตรวจทานก่อนสร้างแบบฟอร์ม') : 'ไม่พบข้อมูลในไฟล์ ' + file.name + ' กรุณากรอกเอง';
    } catch (e) { console.error('quote-notice tor', e); st.blankMsg = 'อ่านไฟล์ TOR ไม่สำเร็จ: ' + (e.message || e); }
    render();
  }
  async function makeBlank() {
    var d = st.blank;
    if (!(num(d.qty) > 0) || !(num(d.mid) > 0)) { alert('กรุณากรอกจำนวน (ราย) และราคากลางต่อหน่วย'); return; }
    try {
      st.blankMsg = 'กำลังสร้างแบบฟอร์ม…'; render();
      var libs = await Promise.all([loadPdfLib(), loadFontkit(), fileBytes(BLANK_FILES.regular), fileBytes(BLANK_FILES.bold), fileBytes(BLANK_FILES.logo).catch(function () { return null; })]);
      var bytes = await blankFormPdf(libs[0], libs[1], { regular: libs[2], bold: libs[3], logo: libs[4] }, d);
      var site = (st.fromBids && st.fromBids.site) || String(d.area || '').replace(/^(กฟส|กฟจ|กฟอ)\.?\s*/, '');
      st.blank = null; st.blankMsg = '';
      await openBytes(new Uint8Array(bytes), site || 'แบบฟอร์มเปล่า', null, null, site);
    } catch (e) { console.error('quote-notice blank', e); st.blankMsg = 'สร้างแบบฟอร์มไม่สำเร็จ: ' + (e.message || e); render(); }
  }
  function renderBlank(w) {
    var d = st.blank, F = [['work', 'ชื่องาน'], ['office', 'ในเขตพื้นที่ระบบจำหน่ายของ'], ['year', 'ปีงบประมาณ'], ['area', 'พื้นที่'],
      ['areaList', 'กฟส. ในพื้นที่ (ถ้ามี)'], ['activity', 'กิจกรรม'], ['qty', 'จำนวน (ราย)'], ['mid', 'ราคากลางต่อหน่วย (บาท)']];
    w.innerHTML =
      '<div class="qn-head"><div><h2>แบบฟอร์มเปล่า' + (st.fromBids ? ' · ' + esc(st.fromBids.site || '') : '') + '</h2><p>สำหรับไซด์ที่ TOR ไม่มีแบบฟอร์มใบเสนอราคา • ระบบสร้าง "รายละเอียดประกอบใบเสนอราคา" แบบเดียวกับ กฟส.ครบุรี (มีโลโก้การไฟฟ้า) แล้วเปิดให้กรอกราคาที่เสนอเหมือนฟอร์มของการไฟฟ้า</p></div></div>' +
      '<div class="qn-actions" style="margin-top:0"><button class="qn-btn soft" data-qn="back">' + (st.fromBids ? '← กลับไปตารางประมูล' : '← กลับไปรายชื่อไซด์') + '</button></div>' +
      '<div class="qn-card" style="max-width:720px"><input type="file" id="qnTor" accept="application/pdf,.pdf" hidden>' +
      '<div class="qn-actions" style="margin-top:0"><button class="qn-btn soft" data-qn="blankTor">📥 นำเข้าข้อมูลจากไฟล์ TOR (ตารางราคากลาง)</button></div>' +
      (st.blankMsg ? '<div class="qn-state" style="margin:-4px 0 8px">' + esc(st.blankMsg) + '</div>' : '') +
      F.map(function (f) {
        return '<div class="qn-line" style="align-items:center"><span style="min-width:190px">' + f[1] + (d.midGuess && (f[0] === 'qty' || f[0] === 'mid') ? '<small style="display:block;color:#b26a00">ประมาณจาก TOR</small>' : '') + '</span><input data-bf="' + f[0] + '" value="' + esc(d[f[0]] || '') + '"' +
          (f[0] === 'qty' || f[0] === 'mid' ? ' inputmode="decimal" style="flex:1;width:auto;text-align:right"' : ' style="flex:1;width:auto;text-align:left"') + '></div>';
      }).join('') +
      (d.torBudget ? '<div class="qn-line"><span>วงเงินงบประมาณตาม TOR</span><span>' + money(num(d.torBudget)) + ' บาท</span></div>' : '') +
      (d.torRef ? '<div class="qn-line"><span>ราคากลางตาม TOR</span><span>' + money(num(d.torRef)) + ' บาท</span></div>' : '') +
      '<div class="qn-sum qn-line"><span>วงเงินงบประมาณ รวมภาษีมูลค่าเพิ่ม</span><span id="qnBfBudget">' + money(blankBudget(d)) + ' บาท</span></div>' +
      '<div class="qn-actions"><button class="qn-btn" data-qn="blankMake">✔ สร้างแบบฟอร์มและกรอกราคา</button></div></div>';
    w.querySelectorAll('[data-bf]').forEach(function (el) { el.style.border = '1px solid #d9cfdf'; el.style.borderRadius = '8px'; el.style.padding = '7px 8px'; el.style.font = 'inherit'; el.style.margin = '3px 0'; });
  }
  // ตารางประมูลแจ้งเตือน → 📝 ใช้แบบฟอร์มเปล่า of one site
  window.openQuoteNoticeBlank = async function (bid) {
    if (!isAdmin()) { alert('เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    await flushSave();
    closeJob();
    st.fromBids = { id: bid.id, site: bid.site || '' };
    st.blank = blankDefaults(bid); st.blankMsg = '';
    showWorkspace('navNoticeBids');
    render();
  };

  function boot() {
    style(); ensureNav();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && saveTimer) flushSave(); });
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); syncNav(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

/* เสนอราคาแจ้งเตือน (2026-10-15)
 * Upload the PEA quotation PDF as it is (every office's form differs), type the unit price, and the
 * page is printed / saved back as PDF looking exactly like the original with the numbers filled in.
 *  - The original page is drawn as the background (pdf.js), so layout, logo and fonts stay untouched.
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
  var FONT = "'TH Sarabun New','TH SarabunPSK',Sarabun,'Leelawadee UI',Tahoma,sans-serif";

  var st = { name: '', pages: [], rows: [], pdf: null, busy: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { return (Math.round(v * 100) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
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
      .replace(/\u0E4D\u0E32/g, '\u0E33');   // ํ + า = ำ
  }

  function detectTables(items, pageNo) {
    var tables = [];
    items.filter(function (i) { return RE.price.test(i.str); }).forEach(function (p) {
      if (tables.some(function (t) { return Math.abs(t.y - p.y) < 30; })) return;
      var near = items.filter(function (i) { return Math.abs(i.y - p.y) < 45; });
      function pick(re) { return near.filter(function (i) { return re.test(i.str); }).sort(function (a, b) { return a.y - b.y; })[0]; }
      var cols = { qty: pick(RE.qty), price: p, amount: pick(RE.amount), vat: pick(RE.vat), total: pick(RE.total) };
      if (!cols.qty || !cols.amount || !cols.vat || !cols.total) return;
      var order = ['qty', 'price', 'amount', 'vat', 'total'];
      var cx = order.map(function (k) { return center(cols[k]); });
      var edges = [];
      for (var k = 0; k < cx.length - 1; k++) edges.push((cx[k] + cx[k + 1]) / 2);
      var left0 = cx[0] - (edges[0] - cx[0]);
      var rightN = cx[4] + (cx[4] - edges[3]);
      var bounds = {};
      order.forEach(function (key, i) { bounds[key] = [i === 0 ? left0 : edges[i - 1], i === 4 ? rightN : edges[i]]; });
      var headerBottom = Math.max.apply(null, near.map(function (i) { return i.y; }));
      var title = items.filter(function (i) { return i.y < p.y - 5 && i.y > p.y - 70 && i.x < cx[0] && /การไฟฟ้า|การไฟฟา|พื้นที่/.test(i.str); })
        .sort(function (a, b) { return b.y - a.y; })[0];
      tables.push({ page: pageNo, y: p.y, headerBottom: headerBottom, bounds: bounds, title: title ? title.str : 'ตารางที่ ' + (tables.length + 1) });
    });
    tables.sort(function (a, b) { return a.y - b.y; });
    var rows = [];
    tables.forEach(function (t, ti) {
      var limit = ti + 1 < tables.length ? tables[ti + 1].y - 40 : Infinity;
      items.filter(function (i) {
        var c = center(i);
        return RE.number.test(i.str.trim()) && i.y > t.headerBottom + 2 && i.y < limit && c > t.bounds.qty[0] && c < t.bounds.qty[1];
      }).forEach(function (i) {
        var label = items.filter(function (o) { return Math.abs(o.y - i.y) < 4 && o.x < t.bounds.qty[0] && !/^\d+$/.test(o.str.trim()); })
          .sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.str; }).join(' ');
        rows.push({ page: pageNo, table: t, y: i.y, h: i.h, qtyStr: i.str.trim(), qtyW: i.w, qty: num(i.str), label: label, price: 0 });
      });
    });
    return rows;
  }

  // Header text only gives column centres: move each cell edge onto the real table line drawn on the
  // page, so numbers sit inside their cell exactly like typed in the original form.
  function snapToLines(r, canvas) {
    try {
      var g = canvas.getContext('2d'), S = RENDER_SCALE;
      var ys = [r.y - r.h * 0.8, r.y - r.h * 0.4, r.y + r.h * 0.05].map(function (y) { return Math.round(y * S); });
      var rows = ys.map(function (y) { return g.getImageData(0, y, canvas.width, 1).data; });
      function dark(x) { return rows.every(function (d) { var i = x * 4; return d[i] + d[i + 1] + d[i + 2] < 300; }); }
      function lineNear(x0, dir) {
        for (var dx = 0; dx < 60 * S; dx++) { var x = Math.round(x0 * S + dir * dx); if (x < 0 || x >= canvas.width) break; if (dark(x)) return x / S; }
        return null;
      }
      var b = {};
      ['qty', 'price', 'amount', 'vat', 'total'].forEach(function (k) {
        var c = (r.table.bounds[k][0] + r.table.bounds[k][1]) / 2;
        var L = lineNear(c, -1), R = lineNear(c, 1);
        b[k] = [L == null ? r.table.bounds[k][0] : L, R == null ? r.table.bounds[k][1] : R];
      });
      r.cells = b;
    } catch (e) { r.cells = null; }
  }

  async function openFile(file) {
    st.busy = true; render();
    try {
      var lib = await loadPdfJs();
      var data = new Uint8Array(await file.arrayBuffer());
      var pdf = await lib.getDocument({ data: data }).promise;
      st.pdf = pdf; st.name = file.name.replace(/\.pdf$/i, ''); st.pages = []; st.rows = [];
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
          return { str: thaiText(i.str).trim(), x: t[4], y: t[5], w: i.width, h: h };
        });
        st.pages.push({ w: vp.width, h: vp.height, bg: canvas });
        var found = detectTables(items, n - 1);
        found.forEach(function (r) { snapToLines(r, canvas); });
        st.rows = st.rows.concat(found);
      }
      if (!st.rows.length) alert('ไม่พบตารางที่มีคอลัมน์ ราคา/หน่วย, จำนวนเงิน, ภาษีมูลค่าเพิ่ม และ รวมเป็นเงินทั้งสิ้น ในไฟล์นี้');
    } catch (e) {
      console.error('quote-notice', e);
      alert('เปิดไฟล์ไม่สำเร็จ: ' + (e.message || e));
    } finally { st.busy = false; render(); }
  }

  // ---------------------------------------------------------------- drawing
  function drawPage(pi, scale) {
    var pg = st.pages[pi];
    var c = document.createElement('canvas');
    c.width = Math.round(pg.w * scale); c.height = Math.round(pg.h * scale);
    var g = c.getContext('2d');
    g.drawImage(pg.bg, 0, 0, c.width, c.height);
    g.fillStyle = '#000'; g.textBaseline = 'alphabetic'; g.textAlign = 'right';
    st.rows.forEach(function (r) {
      if (r.page !== pi || !(r.price > 0)) return;
      var v = calc(r), b = r.cells || r.table.bounds, pad = 3;
      // same digit size as the quantity printed in the PDF: scale our font until "237,000" is as wide as there
      var size = r.h * scale;
      g.font = size + 'px ' + FONT;
      var w0 = g.measureText(r.qtyStr).width;
      if (w0 > 0 && r.qtyW > 0) size = size * (r.qtyW * scale) / w0;
      [['price', r.price], ['amount', v.amount], ['vat', v.vat], ['total', v.total]].forEach(function (cell) {
        var text = money(cell[1]), room = (b[cell[0]][1] - b[cell[0]][0] - pad * 2) * scale, fs = size;
        g.font = fs + 'px ' + FONT;
        var tw = g.measureText(text).width;
        if (tw > room) { fs = fs * room / tw; g.font = fs + 'px ' + FONT; }
        g.fillText(text, (b[cell[0]][1] - pad) * scale, r.y * scale);
      });
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

  function savePdf() {
    if (!st.pages.length) return;
    var J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { alert('ตัวสร้าง PDF ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง'); return; }
    var first = st.pages[0];
    var doc = new J({ unit: 'pt', format: [first.w, first.h], orientation: first.w > first.h ? 'l' : 'p', compress: true });
    st.pages.forEach(function (pg, i) {
      if (i) doc.addPage([pg.w, pg.h], pg.w > pg.h ? 'l' : 'p');
      doc.addImage(drawPage(i, RENDER_SCALE).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pg.w, pg.h);
    });
    var d = new Date(); var stamp = ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + (d.getFullYear() + 543);
    doc.save('เสนอราคาแจ้งเตือน_' + (st.name || 'เอกสาร') + '_' + stamp + '.pdf');
  }

  function printPages() {
    if (!st.pages.length) return;
    var w = window.open('', '_blank');
    if (!w) { alert('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป'); return; }
    var imgs = st.pages.map(function (pg, i) { return '<img src="' + drawPage(i, RENDER_SCALE).toDataURL('image/png') + '">'; }).join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>เสนอราคาแจ้งเตือน</title><style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm;page-break-after:always}</style></head><body>' + imgs + '<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>');
    w.document.close();
  }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('qnStyle')) return;
    var s = document.createElement('style'); s.id = 'qnStyle';
    s.textContent = '.qn-workspace{display:none}.qn-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.qn-head h2{margin:0 0 4px}.qn-head p{margin:0;color:#6b5d7a}' +
      '.qn-grid{display:grid;grid-template-columns:minmax(330px,420px) 1fr;gap:16px;align-items:start}.qn-card{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:14px}' +
      '.qn-drop{border:2px dashed #cdbce0;border-radius:12px;padding:18px;text-align:center;color:#5a2787;cursor:pointer;background:#faf8fc}.qn-drop.drag{background:#efe6f8}' +
      '.qn-btn{border:0;border-radius:9px;padding:9px 14px;font-weight:800;cursor:pointer;background:#4b2378;color:#fff}.qn-btn.soft{background:#f2ebfa;color:#5a2787}.qn-btn:disabled{opacity:.45;cursor:default}' +
      '.qn-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.qn-all{display:flex;gap:8px;align-items:center;margin:10px 0}.qn-all input,.qn-row input{width:110px;border:1px solid #d9cfdf;border-radius:8px;padding:7px 8px;text-align:right;font:inherit}' +
      '.qn-row{border:1px solid #eee7f4;border-radius:10px;padding:9px 10px;margin:8px 0;background:#fcfbfe}.qn-row b{display:block;color:#4d2376;font-size:13px}.qn-row small{color:#776a86}' +
      '.qn-line{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-top:4px}.qn-sum{border-top:2px solid #e5dced;margin-top:10px;padding-top:8px;font-weight:800}' +
      '.qn-pages{background:#eeeaf2;border-radius:12px;padding:12px;overflow:auto;max-height:calc(100vh - 170px)}.qn-page{display:block;width:100%;max-width:820px;margin:0 auto 12px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.12)}' +
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
      var b = e.target.closest('[data-qn]'); if (!b) return;
      var a = b.getAttribute('data-qn');
      if (a === 'pick') w.querySelector('#qnFile').click();
      if (a === 'pdf') savePdf();
      if (a === 'print') printPages();
      if (a === 'all') { var v = num(w.querySelector('#qnAll').value); st.rows.forEach(function (r) { r.price = v; }); render(); }
    });
    w.addEventListener('change', function (e) { if (e.target.id === 'qnFile' && e.target.files[0]) { openFile(e.target.files[0]); e.target.value = ''; } });
    w.addEventListener('input', function (e) {
      var i = e.target.getAttribute('data-row'); if (i == null) return;
      st.rows[+i].price = num(e.target.value);
      updateNumbers(); redrawPreview();
    });
    w.addEventListener('dragover', function (e) { e.preventDefault(); var d = w.querySelector('.qn-drop'); if (d) d.classList.add('drag'); });
    w.addEventListener('dragleave', function () { var d = w.querySelector('.qn-drop'); if (d) d.classList.remove('drag'); });
    w.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer.files[0]; if (f && /pdf$/i.test(f.type || f.name)) openFile(f); });
    return w;
  }

  function updateNumbers() {
    var w = page(); var sum = { amount: 0, vat: 0, total: 0 };
    st.rows.forEach(function (r, i) {
      var v = calc(r); sum.amount += v.amount; sum.vat += v.vat; sum.total += v.total;
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
      (has ? '<div class="qn-actions"><button class="qn-btn" data-qn="pdf">📄 บันทึก PDF</button><button class="qn-btn soft" data-qn="print">🖨 พิมพ์</button></div>' +
        '<div class="qn-all"><label>ราคาต่อหน่วยทุกพื้นที่</label><input id="qnAll" inputmode="decimal" placeholder="0.00"><button class="qn-btn soft" data-qn="all">ใช้กับทุกแถว</button></div>' +
        st.rows.map(function (r, i) {
          return '<div class="qn-row"><b>' + esc(r.table.title) + '</b><small>' + esc(r.label || 'รายการ') + ' • จำนวน ' + r.qty.toLocaleString('th-TH') + ' (หน้า ' + (r.page + 1) + ')</small>' +
            '<div class="qn-line"><span>ราคา/หน่วย (บาท)</span><input data-row="' + i + '" inputmode="decimal" value="' + (r.price ? r.price : '') + '" placeholder="0.00"></div>' +
            '<div class="qn-line" data-out="' + i + '"></div></div>';
        }).join('') + '<div class="qn-sum" id="qnSum"></div>' : '') +
      '</div><div class="qn-pages" id="qnPages">' + (has ? '' : '<div class="qn-empty">ตัวอย่างเอกสารจะแสดงที่นี่</div>') + '</div></div>';
    if (has) { updateNumbers(); redrawPreview(); }
  }

  // ---------------------------------------------------------------- menu
  function shown(id) { var el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none' && !el.hidden; }
  function syncNav() {
    var nav = document.getElementById('navQuoteNotice'); if (!nav) return;
    var want = (shown('navInvoice') || shown('navBilling') || shown('navReceiptTax')) ? '' : 'none';
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
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navQuoteNotice'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    document.documentElement.classList.add('sa-wide');
    window.scrollTo(0, 0);
    render();
    loadPdfJs().catch(function () {});
  }
  window.openQuoteNotice = showPage;

  function boot() {
    style(); ensureNav();
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(ensureNav, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

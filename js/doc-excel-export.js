/* ส่งออก Excel ในเมนูเอกสาร
 * ใบตั้งหนี้, ใบแจ้งหนี้-ใบวางบิล, ใบเสร็จรับเงิน-ใบกำกับภาษี, เอกสารย้อนหลัง (รายการ + หน้าดูเอกสาร), สรุปและสั่งกระดาษ
 * ชื่อไฟล์ตั้งต้น: <ชื่อเอกสาร>_<เลขที่>_<วันที่บันทึก วว-ดด-ปปปป (พ.ศ.)>.xlsx  แก้ชื่อได้ก่อนบันทึก
 */
(function () {
  'use strict';
  var XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  var loading = null;
  var SKIP = { IMG: 1, SCRIPT: 1, STYLE: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, SVG: 1, svg: 1, IFRAME: 1, CANVAS: 1, TEMPLATE: 1 };

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = XLSX_SRC; s.async = true;
      s.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(Error('XLSX_NOT_LOADED')); };
      s.onerror = function () { loading = null; reject(Error('XLSX_LOAD_FAILED')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function clean(t) { return String(t == null ? '' : t).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim(); }
  function cellValue(t) {
    t = clean(t);
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) || /^-?\d+\.\d+$/.test(t) || /^-?[1-9]\d{0,8}$/.test(t) || t === '0') return Number(t.replace(/,/g, ''));
    return t;
  }
  function hidden(el) {
    var w = el.ownerDocument.defaultView, cs = w.getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden';
  }

  // table → rows with merged cells kept
  function tableRows(table, out, merges, dropLastCol) {
    var occupied = {}, start = out.length;
    [].forEach.call(table.rows, function (tr, ri) {
      if (hidden(tr)) return;
      var r = start + ri, row = out[r] || (out[r] = []), c = 0, any = false;
      var cells = [].slice.call(tr.cells);
      if (dropLastCol && cells.length > 1) cells.pop();
      cells.forEach(function (td) {
        while (occupied[r + ':' + c]) c++;
        var v = cellValue(td.innerText);
        if (v !== '') any = true;
        row[c] = v;
        var cs = Math.max(1, td.colSpan || 1), rs = Math.max(1, td.rowSpan || 1);
        for (var i = 0; i < rs; i++) for (var j = 0; j < cs; j++) if (i || j) occupied[(r + i) + ':' + (c + j)] = 1;
        if (cs > 1 || rs > 1) merges.push({ s: { r: r, c: c }, e: { r: r + rs - 1, c: c + cs - 1 } });
        c += cs;
      });
      row._blank = !any;
    });
    // drop the empty filler rows printed forms use to pad the table (and their merges)
    for (var r = out.length - 1; r >= start; r--) {
      if (out[r] && out[r]._blank) {
        out.splice(r, 1);
        for (var m = merges.length - 1; m >= 0; m--) {
          var g = merges[m];
          if (g.s.r === r && g.e.r === r) merges.splice(m, 1);
          else { if (g.s.r > r) g.s.r--; if (g.e.r >= r) g.e.r--; }
        }
      }
    }
  }

  // document page → rows: tables as tables, side-by-side blocks as cells, other text as one cell per line
  function walk(node, out, merges) {
    [].forEach.call(node.children, function (el) {
      if (SKIP[el.tagName] || hidden(el)) return;
      if (el.tagName === 'TABLE') { tableRows(el, out, merges, false); return; }
      // containers holding tables or controls (buttons, inputs) are opened up so control labels stay out of the sheet
      if (el.querySelector('table,button,input,select,textarea')) { walk(el, out, merges); return; }
      var text = clean(el.innerText);
      if (!text) return;
      var d = el.ownerDocument.defaultView.getComputedStyle(el).display;
      var kids = [].filter.call(el.children, function (k) { return !SKIP[k.tagName] && !hidden(k) && clean(k.innerText); });
      if ((d.indexOf('flex') >= 0 || d.indexOf('grid') >= 0) && kids.length > 1) {
        // side-by-side blocks: one column each, their lines laid out down the rows (label / value under each other)
        var cols = kids.map(function (k) { return clean(k.innerText).split('\n'); });
        var n = Math.max.apply(null, cols.map(function (c) { return c.length; }));
        for (var i = 0; i < n; i++) out.push(cols.map(function (c) { return c[i] === undefined ? '' : cellValue(c[i]); }));
      } else {
        text.split('\n').forEach(function (line) { out.push([cellValue(line)]); });
      }
    });
  }

  function sheetFrom(XLSX, rows, merges) {
    rows = rows.map(function (r) { var a = []; for (var i = 0; i < r.length; i++) a[i] = r[i] === undefined ? '' : r[i]; return a; });
    var ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]);
    if (merges && merges.length) ws['!merges'] = merges;
    var widths = [];
    rows.forEach(function (r) {
      r.forEach(function (v, i) {
        var len = String(v).split('\n').reduce(function (m, l) { return Math.max(m, l.length); }, 0);
        widths[i] = Math.min(60, Math.max(widths[i] || 6, len + 2));
      });
    });
    ws['!cols'] = widths.map(function (w) { return { wch: w || 8 }; });
    return ws;
  }

  function thaiDateStamp(d) {
    d = d || new Date();
    return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + (d.getFullYear() + 543);
  }
  function docNoFrom(text) {
    var m = String(text || '').match(/เลขที่(?:เอกสาร)?\s*[:：]?\s*([A-Za-z]{1,6}[0-9][A-Za-z0-9\/\-._]*)/);
    return m ? m[1] : '';
  }
  function safeName(s) { return String(s).replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120); }

  async function exportBook(title, sheets, docNo, btn) {
    var stamp = thaiDateStamp();
    var def = safeName([title, docNo, stamp].filter(Boolean).join('_'));
    var name = window.prompt('ตั้งชื่อไฟล์ Excel', def);
    if (name === null) return;
    name = safeName(name) || def;
    if (!/\.xlsx$/i.test(name)) name += '.xlsx';
    var label = btn ? btn.textContent : '';
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังสร้าง Excel...'; }
      var XLSX = await loadXlsx();
      var wb = XLSX.utils.book_new(), used = {};
      sheets.forEach(function (s, i) {
        var n = safeName(s.name || ('หน้า ' + (i + 1))).replace(/[\[\]]/g, '').slice(0, 28) || ('หน้า ' + (i + 1));
        var base = n, k = 2; while (used[n]) n = base.slice(0, 25) + ' ' + (k++); used[n] = 1;
        XLSX.utils.book_append_sheet(wb, sheetFrom(XLSX, s.rows, s.merges), n);
      });
      wb.Props = { Title: title, CreatedDate: new Date() };
      XLSX.writeFile(wb, name, { compression: true });
    } catch (e) {
      console.error('doc-excel-export', e);
      alert('ส่งออก Excel ไม่สำเร็จ: ' + (e && e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  function pagesToSheets(pages, title) {
    return pages.map(function (p, i) {
      var rows = [], merges = []; walk(p, rows, merges);
      var copy = /สำเนา/.test(clean(p.innerText).slice(0, 400)) && pages.length > 1 ? 'สำเนา' : '';
      return { name: pages.length > 1 ? (copy || ('หน้า ' + (i + 1))) : title, rows: rows, merges: merges };
    });
  }
  function visible(list) { return [].filter.call(list, function (el) { return el.offsetParent !== null || el.getClientRects().length; }); }

  // ---- each menu ----
  var TARGETS = [
    { // ใบตั้งหนี้
      id: 'invExcelBtn', anchor: function () { return document.querySelector('#invoiceWorkspace .invoice-actions'); }, mode: 'append', cls: 'invoice-small-btn',
      run: function (btn) {
        var p = document.getElementById('invoicePaper'); if (!p) return alert('ไม่พบตัวอย่างเอกสาร');
        exportBook('ใบตั้งหนี้', pagesToSheets([p], 'ใบตั้งหนี้'), docNoFrom(p.innerText), btn);
      }
    },
    { // ใบแจ้งหนี้-ใบวางบิล
      id: 'biExcelBtn', anchor: function () { return document.getElementById('biPrint'); }, mode: 'after', cls: 'bi-btn',
      run: function (btn) {
        var pages = visible(document.querySelectorAll('.bi-paper')); if (!pages.length) return alert('ไม่พบตัวอย่างเอกสาร');
        exportBook('ใบแจ้งหนี้-ใบวางบิล', pagesToSheets(pages, 'ใบแจ้งหนี้-ใบวางบิล'), docNoFrom(pages[0].innerText), btn);
      }
    },
    { // ใบเสร็จรับเงิน-ใบกำกับภาษี
      id: 'rtExcelBtn', anchor: function () { return document.getElementById('rtPrint'); }, mode: 'after', cls: 'rt-btn',
      run: function (btn) {
        var pages = visible(document.querySelectorAll('.rt-paper')); if (!pages.length) return alert('ไม่พบตัวอย่างเอกสาร');
        exportBook('ใบเสร็จรับเงิน-ใบกำกับภาษี', pagesToSheets(pages, 'ใบเสร็จรับเงิน'), docNoFrom(pages[0].innerText), btn);
      }
    },
    { // เอกสารย้อนหลัง: หน้าดูเอกสาร
      id: 'daViewerExcelBtn', anchor: function () { return document.querySelector('#daViewer [data-dv="print"]'); }, mode: 'after', cls: 'da-btn',
      run: function (btn) {
        var v = document.getElementById('daViewer'), f = v && v.querySelector('iframe'), d = f && f.contentDocument;
        if (!d || !d.body) return alert('ไม่พบเอกสาร');
        var pages = visible(d.querySelectorAll('.bi-paper,.rt-paper,.invoice-paper,.page,[class*="paper"]'));
        pages = pages.filter(function (p) { return !pages.some(function (o) { return o !== p && o.contains(p); }); });
        if (!pages.length) pages = [d.body];
        var title = clean((v.querySelector('[data-dv="title"]') || {}).innerText) || 'เอกสารย้อนหลัง';
        var parts = title.split(/\s*เลขที่\s*/), kind = clean(parts[0]) || 'เอกสาร', no = clean(parts[1] || '') || docNoFrom(pages[0].innerText);
        exportBook(kind, pagesToSheets(pages, kind), no, btn);
      }
    },
    { // เอกสารย้อนหลัง: รายการเอกสาร
      id: 'daListExcelBtn', anchor: function () { return document.querySelector('[data-da="list"] .da-count'); }, mode: 'append', cls: 'da-btn',
      run: function (btn) {
        var t = document.querySelector('[data-da="list"] .da-table'); if (!t) return alert('ไม่มีรายการเอกสาร');
        var rows = [], merges = []; tableRows(t, rows, merges, true);
        exportBook('รายการเอกสารย้อนหลัง', [{ name: 'รายการเอกสาร', rows: rows, merges: merges }], '', btn);
      }
    },
    { // สรุปและสั่งกระดาษ
      id: 'poExcelBtn', anchor: function () { return document.querySelector('#paperOrderWorkspace .po-actions'); }, mode: 'append', cls: 'po-btn soft',
      run: function (btn) {
        var ws = document.getElementById('paperOrderWorkspace'); if (!ws) return;
        var rows = [], merges = []; walk(ws.querySelector('.po-wrap') || ws, rows, merges);
        exportBook('สรุปและสั่งกระดาษ', [{ name: 'สรุปการใช้กระดาษ', rows: rows, merges: merges }], '', btn);
      }
    }
  ];

  function install() {
    TARGETS.forEach(function (t) {
      var a = t.anchor(); if (!a) return;
      var root = a.ownerDocument;
      if (root.getElementById(t.id)) return;
      var b = root.createElement('button');
      b.type = 'button'; b.id = t.id; b.className = t.cls + ' doc-excel-btn'; b.textContent = 'ส่งออก Excel';
      b.title = 'บันทึกเป็นไฟล์ Excel ชื่อไฟล์ตามเอกสารและวันที่บันทึก';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); t.run(b); });
      if (t.mode === 'after') a.insertAdjacentElement('afterend', b); else a.appendChild(b);
    });
  }

  var style = document.createElement('style');
  // colours come from the PEA theme, which styles Excel buttons light green like the other Excel/LINE buttons
  style.textContent = '.doc-excel-btn[disabled]{opacity:.6!important;cursor:wait!important}' +
    '.da-count .doc-excel-btn{margin-left:10px;padding:4px 10px!important;font-size:12px!important}';
  document.head.appendChild(style);

  var queued = false;
  function schedule() { if (queued) return; queued = true; setTimeout(function () { queued = false; install(); }, 150); }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  install();
  window.exportDocumentExcel = function (id) { var t = TARGETS.filter(function (x) { return x.id === id; })[0]; if (t) t.run(document.getElementById(id)); };
})();

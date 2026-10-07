/* ส่งออก Excel ในเมนูเอกสาร
 * ใบตั้งหนี้, ใบแจ้งหนี้-ใบวางบิล, ใบเสร็จรับเงิน-ใบกำกับภาษี, เอกสารย้อนหลัง (รายการ + หน้าดูเอกสาร), สรุปและสั่งกระดาษ
 * ไฟล์ Excel มีหน้าตาเหมือนที่พิมพ์เป็น PDF: ใช้หน้าชุดเดียวกับ PDF (ต้นฉบับ/สำเนา) หนึ่งหน้า = หนึ่งชีต
 * ตำแหน่ง ตัวอักษร เส้น สี และโลโก้ ถูกวัดจากหน้า A4 จริง (js/doc-excel-layout.js)
 * ชื่อไฟล์ตั้งต้น: <ชื่อเอกสาร>_<เลขที่>_<วันที่บันทึก วว-ดด-ปปปป (พ.ศ.)>.xlsx  แก้ชื่อได้ก่อนบันทึก
 */
(function () {
  'use strict';
  function L() { if (!window.DocExcelLayout) throw Error('EXCEL_LAYOUT_NOT_LOADED'); return window.DocExcelLayout; }
  function clean(t) { return String(t == null ? '' : t).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function thaiDateStamp(d) {
    d = d || new Date();
    return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + (d.getFullYear() + 543);
  }
  function docNoFrom(text) {
    var m = String(text || '').match(/เลขที่(?:เอกสาร)?\s*[:：]?\s*([A-Za-z]{1,6}[0-9][A-Za-z0-9\/\-._]*)/);
    return m ? m[1] : '';
  }
  function safeName(s) { return String(s).replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function visible(list) { return [].filter.call(list, function (el) { return el.getClientRects().length > 0; }); }

  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // getPages() → Promise<{pages:[{el,name}], dispose?}>
  async function exportBook(title, getPages, docNoHint, btn) {
    var label = btn ? btn.textContent : '';
    var got = null;
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังสร้าง Excel...'; }
      got = await getPages();
      if (!got || !got.pages.length) { alert('ไม่พบเอกสารที่จะส่งออก'); return; }
      var docNo = docNoHint || docNoFrom(got.pages[0].el.innerText);
      var def = safeName([title, docNo, thaiDateStamp()].filter(Boolean).join('_'));
      var sheets = [];
      for (var i = 0; i < got.pages.length; i++) {
        var sh = await L().pageToSheet(got.pages[i].el);
        sh.name = got.pages[i].name || (got.pages.length > 1 ? 'หน้า ' + (i + 1) : title);
        sheets.push(sh);
      }
      if (got.dispose) { got.dispose(); got = null; }
      if (btn) { btn.disabled = false; btn.textContent = label; }
      var name = window.prompt('ตั้งชื่อไฟล์ Excel', def);
      if (name === null) return;
      name = safeName(name) || def;
      if (!/\.xlsx$/i.test(name)) name += '.xlsx';
      download(L().writeXlsx(sheets, { title: title }), name);
    } catch (e) {
      console.error('doc-excel-export', e);
      alert('ส่งออก Excel ไม่สำเร็จ: ' + (e && e.message || e));
    } finally {
      if (got && got.dispose) got.dispose();
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  // pages exactly as the PDF prints them, rendered off-screen from the menu's own print HTML
  function printPages(builderName, selector, nameOf, fallbackSelector) {
    return async function () {
      var fn = window[builderName], html = typeof fn === 'function' ? fn() : '';
      if (html) {
        var r = await L().renderPrintDoc(html, selector);
        return { pages: r.pages.map(function (p, i) { return { el: p, name: nameOf(p, i) }; }), dispose: r.dispose };
      }
      return { pages: visible(document.querySelectorAll(fallbackSelector)).map(function (p, i) { return { el: p, name: nameOf(p, i) }; }) };
    };
  }
  function copyName(p, i, fallback) {
    var t = clean((p.querySelector('.bi-customer-copy,.rt-copy-label,.rt-audience') || {}).textContent);
    if (!t) { var m = clean(p.innerText).slice(0, 300).match(/(ต้นฉบับ|สำเนา)[^\s]*\s*(?:\/\s*\w+)?/); t = m ? m[0] : ''; }
    return (t || fallback + ' ' + (i + 1)).slice(0, 28);
  }

  var TARGETS = [
    { // ใบตั้งหนี้: one page, measured on the live preview (the PDF is captured from it too)
      id: 'invExcelBtn', label: '📗 Excel', anchor: function () { return document.querySelector('#invoiceWorkspace .invoice-actions'); }, mode: 'append', cls: 'invoice-small-btn',
      run: function (btn) {
        exportBook('ใบตั้งหนี้', async function () {
          var p = document.getElementById('invoicePaper');
          return { pages: p ? [{ el: p, name: 'ใบตั้งหนี้' }] : [] };
        }, clean((document.getElementById('invNo') || {}).value), btn);
      }
    },
    { // ใบแจ้งหนี้-ใบวางบิล: the PDF's 3 pages
      id: 'biExcelBtn', anchor: function () { return document.getElementById('biPrint'); }, mode: 'after', cls: 'bi-btn',
      run: function (btn) {
        exportBook('ใบแจ้งหนี้-ใบวางบิล', printPages('billingPrintDocumentHTML', '.bi-pdf-page', function (p, i) { return ['ต้นฉบับ-ลูกค้า', 'สำเนา-บริษัท 1', 'สำเนา-บริษัท 2'][i] || copyName(p, i, 'หน้า'); }, '.bi-paper'), '', btn);
      }
    },
    { // ใบเสร็จรับเงิน-ใบกำกับภาษี: the PDF's 2 pages (ต้นฉบับ + สำเนา)
      id: 'rtExcelBtn', anchor: function () { return document.getElementById('rtPrint'); }, mode: 'after', cls: 'rt-btn',
      run: function (btn) {
        exportBook('ใบเสร็จรับเงิน-ใบกำกับภาษี', printPages('receiptPrintDocumentHTML', '.rt-paper', function (p, i) { return i === 0 ? 'ต้นฉบับ' : 'สำเนา'; }, '.rt-paper'), '', btn);
      }
    },
    { // เอกสารย้อนหลัง: the saved document shown in the viewer
      id: 'daViewerExcelBtn', anchor: function () { return document.querySelector('#daViewer [data-dv="print"]'); }, mode: 'after', cls: 'da-btn',
      run: function (btn) {
        var v = document.getElementById('daViewer'), f = v && v.querySelector('iframe'), d = f && f.contentDocument;
        if (!d || !d.body) return alert('ไม่พบเอกสาร');
        var title = clean((v.querySelector('[data-dv="title"]') || {}).innerText) || 'เอกสาร';
        var parts = title.split(/\s*เลขที่\s*/), kind = clean(parts[0]) || 'เอกสาร', no = clean(parts[1] || '');
        exportBook(kind, async function () {
          var pages = visible(d.querySelectorAll('.bi-pdf-page,.rt-paper,.invoice-paper,.bi-paper,.da-page,.page'));
          pages = pages.filter(function (p) { return !pages.some(function (o) { return o !== p && o.contains(p); }); });
          if (!pages.length) pages = [d.body];
          return { pages: pages.map(function (p, i) { return { el: p, name: pages.length > 1 ? copyName(p, i, 'หน้า') : kind }; }) };
        }, no, btn);
      }
    },
    { // เอกสารย้อนหลัง: list of documents, as shown
      id: 'daListExcelBtn', anchor: function () { return document.querySelector('[data-da="list"] .da-count'); }, mode: 'append', cls: 'da-btn',
      run: function (btn) {
        exportBook('รายการเอกสารย้อนหลัง', async function () {
          var t = document.querySelector('[data-da="list"] .da-table');
          return { pages: t ? [{ el: t, name: 'รายการเอกสาร' }] : [] };
        }, '', btn);
      }
    },
    { // สรุปและสั่งกระดาษ: the summary as shown
      id: 'poExcelBtn', anchor: function () { return document.querySelector('#paperOrderWorkspace .po-actions'); }, mode: 'append', cls: 'po-btn soft',
      run: function (btn) {
        exportBook('สรุปและสั่งกระดาษ', async function () {
          var ws = document.getElementById('paperOrderWorkspace'), el = ws && (ws.querySelector('.po-wrap') || ws);
          return { pages: el ? [{ el: el, name: 'สรุปการใช้กระดาษ' }] : [] };
        }, '', btn);
      }
    }
  ];

  function install() {
    TARGETS.forEach(function (t) {
      var a = t.anchor(); if (!a) return;
      if (document.getElementById(t.id)) return;
      var b = document.createElement('button');
      b.type = 'button'; b.id = t.id; b.className = t.cls + ' doc-excel-btn'; b.textContent = t.label || 'ส่งออก Excel';
      b.title = 'บันทึกเป็นไฟล์ Excel หน้าตาเหมือน PDF ชื่อไฟล์ตามเอกสารและวันที่บันทึก';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); t.run(b); });
      if (t.mode === 'after') a.insertAdjacentElement('afterend', b); else a.appendChild(b);
    });
  }

  // colours come from the PEA theme, which styles Excel buttons light green like the other Excel/LINE buttons
  var style = document.createElement('style');
  style.textContent = '.doc-excel-btn[disabled]{opacity:.6!important;cursor:wait!important}' +
    '.da-count .doc-excel-btn{margin-left:10px;padding:4px 10px!important;font-size:12px!important}';
  document.head.appendChild(style);

  var queued = false;
  function schedule() { if (queued) return; queued = true; setTimeout(function () { queued = false; install(); }, 150); }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  install();
  window.exportDocumentExcel = function (id) { var t = TARGETS.filter(function (x) { return x.id === id; })[0]; if (t) t.run(document.getElementById(id)); };
})();

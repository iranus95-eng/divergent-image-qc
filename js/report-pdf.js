/* A4 portrait PDF from a report's HTML (2026-10-04)
 * Printing through the browser lets the printer driver rotate the page (e.g. "Microsoft Print to PDF"
 * set to landscape turns a portrait report sideways). For reports we build the PDF ourselves instead:
 * the report HTML is laid out in a hidden 794x1123px frame (A4 at 96dpi), split into pages
 * (blocks kept whole where possible, long tables split by rows with the header repeated),
 * rendered with html2canvas and saved with jsPDF in portrait.
 *   window.DivergentPdf.fromHtml(html, {padding:'34px 38px'}) -> Promise<Blob>
 *   window.DivergentPdf.download(blob, fileName)
 * Used by: รายงานเบิกค่าใช้จ่าย / รายงานเงินเดือน (money report "PDF") and รายงานค่าใช้จ่ายย้อนหลังแบบละเอียด.
 */
(function () {
  'use strict';
  var PAGE_W = 794, PAGE_H = 1123;

  function progress(show, text) {
    try { if (typeof window.pnlPdfProgress === 'function') window.pnlPdfProgress(show, 'กำลังสร้าง PDF แนวตั้ง', text || ''); } catch (_) {}
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function fromHtml(html, opt) {
    opt = opt || {};
    if (typeof window.html2canvas !== 'function' || !window.jspdf || !window.jspdf.jsPDF) throw new Error('PDF_LIBRARY_NOT_READY');
    var padding = opt.padding || '34px 38px';
    var extra = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap">' +
      '<style>html,body{width:auto!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important}' +
      '.pdf-page{width:' + PAGE_W + 'px!important;height:' + PAGE_H + 'px!important;box-sizing:border-box!important;padding:' + padding + '!important;overflow:hidden!important;background:#fff!important;position:relative!important;margin:0!important}' +
      '.pdf-page>.pdf-root{width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;box-sizing:border-box!important}</style>';
    var doc0 = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, extra + '</head>') : extra + html;

    var frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;border:0;visibility:hidden';
    document.body.appendChild(frame);
    try {
      await new Promise(function (resolve) { frame.onload = resolve; frame.srcdoc = doc0; setTimeout(resolve, 4000); });
      var doc = frame.contentDocument;
      try { await Promise.race([doc.fonts.ready, wait(3000)]); } catch (_) {}
      await wait(60);

      var root = doc.querySelector('main') || doc.body;
      var blocks = [].slice.call(root.children);
      var rootShell = root === doc.body ? doc.createElement('div') : root.cloneNode(false);
      blocks.forEach(function (b) { b.remove(); });
      if (root !== doc.body) root.remove();
      [].slice.call(doc.body.children).forEach(function (c) { if (c.tagName !== 'SCRIPT') c.remove(); });

      var pages = [], page, inner, avail;
      function newPage() {
        page = doc.createElement('div'); page.className = 'pdf-page';
        inner = rootShell.cloneNode(false); inner.classList.add('pdf-root');
        page.appendChild(inner); doc.body.appendChild(page); pages.push(page);
        var cs = frame.contentWindow.getComputedStyle(page);
        avail = PAGE_H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 1;
      }
      function fits() { return inner.scrollHeight <= avail && inner.getBoundingClientRect().height <= avail; }
      function empty() { return !inner.firstElementChild; }

      function splitTable(t) {
        var colgroup = t.querySelector(':scope > colgroup'), thead = t.tHead, tfoot = t.tFoot;
        var rows = [];
        [].slice.call(t.tBodies).forEach(function (b) { rows = rows.concat([].slice.call(b.rows)); });
        function shell() {
          var c = t.cloneNode(false);
          if (colgroup) c.appendChild(colgroup.cloneNode(true));
          if (thead) c.appendChild(thead.cloneNode(true));
          var tb = doc.createElement('tbody'); c.appendChild(tb);
          inner.appendChild(c);
          return { t: c, tb: tb };
        }
        var cur = shell();
        rows.forEach(function (r) {
          cur.tb.appendChild(r);
          if (fits()) return;
          cur.tb.removeChild(r);
          if (!cur.tb.rows.length) cur.t.remove();
          newPage(); cur = shell(); cur.tb.appendChild(r);
        });
        if (tfoot) {
          var f = tfoot.cloneNode(true); cur.t.appendChild(f);
          if (!fits()) { f.remove(); newPage(); cur = shell(); cur.t.appendChild(f); }
        }
      }
      function place(el, depth) {
        inner.appendChild(el);
        if (fits()) return;
        el.remove();
        if (el.tagName === 'TABLE' && el.tBodies.length) { splitTable(el); return; }
        if (!empty()) {               // keep the block whole on a fresh page when it fits there
          newPage(); inner.appendChild(el);
          if (fits()) return;
          el.remove();
        }
        var kids = [].slice.call(el.children);
        if (kids.length && depth < 5) { kids.forEach(function (k) { place(k, depth + 1); }); return; }
        inner.appendChild(el);        // taller than a page and cannot be split: let it clip
      }

      newPage();
      blocks.forEach(function (b) { place(b, 0); });
      pages = pages.filter(function (p) { var i = p.firstElementChild; return i && i.firstElementChild; });

      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (var i = 0; i < pages.length; i++) {
        progress(true, 'หน้า ' + (i + 1) + ' จาก ' + pages.length);
        var canvas = await window.html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: PAGE_W, windowHeight: PAGE_H });
        if (i) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        if (pages.length > 1) { pdf.setFontSize(8); pdf.setTextColor(120); pdf.text((i + 1) + ' / ' + pages.length, 200, 292, { align: 'right' }); }
      }
      return pdf.output('blob');
    } finally {
      progress(false);
      frame.remove();
    }
  }

  function download(blob, fileName) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName || 'report.pdf';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  window.DivergentPdf = { fromHtml: fromHtml, download: download };

  // ---- money report (รายงานเบิกค่าใช้จ่าย / รายงานเงินเดือน): "PDF" now saves a portrait PDF file ----
  function hook() {
    var orig = window.createMoneyReport;
    if (typeof orig !== 'function' || orig.__portraitPdf) return false;
    var wrapped = async function () {
      var fmt = (document.getElementById('moneyReportFormat') || {}).value || 'PDF';
      if (fmt !== 'PDF') return orig.apply(this, arguments);
      var type = ''; try { type = moneyReportType; } catch (_) {} // eslint-disable-line no-undef
      try {
        var html = window.buildMoneyPrintHtml();
        var blob = await fromHtml(html, { padding: type === 'payroll' ? '23px 19px' : '34px 38px' });
        var name = 'report.pdf';
        try { name = moneyReportFilename('pdf'); } catch (_) {} // eslint-disable-line no-undef
        try { moneyReportLastFile = new File([blob], name, { type: 'application/pdf' }); } catch (_) {} // eslint-disable-line no-undef
        download(blob, name);
      } catch (e) {
        console.error('portrait pdf', e);
        alert('สร้าง PDF ไม่สำเร็จ (' + (e.message || e) + ')\nจะเปิดหน้าพิมพ์แทน — กรุณาเลือก "แนวตั้ง / Portrait" ในหน้าต่างพิมพ์');
        return orig.apply(this, arguments);
      }
    };
    wrapped.__portraitPdf = true;
    window.createMoneyReport = wrapped;
    return true;
  }
  if (!hook()) {
    var tries = 0, t = setInterval(function () { if (hook() || ++tries > 40) clearInterval(t); }, 250);
  }
})();

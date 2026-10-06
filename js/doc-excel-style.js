/* ใบแจ้งหนี้-ใบวางบิล (.bi-paper) + ใบเสร็จรับเงิน/ใบกำกับภาษี (.rt-paper)
 * Font, text sizes and spacing taken from the company's Excel templates
 * (ใบแจ้งหนี้-วางบิล / ใบเสร็จรับเงิน-ใบกำกับภาษี .xls):
 *   font Leelawadee, printed at 85% → every Excel size below is x0.85,
 *   Excel row heights (pt) x0.85 give the spacing in mm.
 * Loaded last; wins over the older layout patches and is also injected into the
 * PDF frames and the archive viewer so screen, PDF and archive look the same. */
(function () {
  'use strict';
  if (window.__docExcelStyle) return;
  window.__docExcelStyle = true;

  var FONT = "'Leelawadee','Leelawadee UI','Noto Sans Thai',Tahoma,sans-serif";
  var IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700&display=swap');";
  // :is(html,#a#a#a) matches <html> but counts as 3 ids, so it outranks the older patches
  var H = ':is(html,#dx#dx#dx) ';
  var B = H + '.bi-paper', R = H + '.rt-paper';
  function both(sel) { return sel.split(',').map(function (s) { return B + s + ',' + R + s.replace(/\.bi-/g, '.rt-'); }).join(','); }

  var CSS = IMPORT + [
    // ---- common: font + body text 11pt (x0.85) ----
    B + ',' + R + '{font-family:' + FONT + '!important;font-size:9.35pt!important;line-height:1.3!important;color:#000!important}',
    B + ' *,' + R + ' *{font-family:' + FONT + '!important;font-size:inherit;line-height:inherit;letter-spacing:0!important}',
    B + '{position:relative!important;padding:8.5mm 4mm 6mm 8mm!important}',
    R + '{padding:8.5mm 11mm 6mm 8mm!important}',

    // ---- logo (Excel: B3:E7) ----
    B + '>.bi-logo,' + B + '>.bi-logo-original,' + B + '>.bi-logo-direct{position:absolute!important;display:block!important;object-fit:contain!important;margin:0!important;z-index:5!important;left:8mm!important;top:9.5mm!important;width:41mm!important;height:13mm!important;max-width:41mm!important;max-height:13mm!important}',
    R + ' .rt-logo{width:41mm!important;height:13mm!important;max-width:41mm!important;max-height:13mm!important;object-fit:contain!important;margin-top:1mm!important}',

    // ---- header rows 3-9 ----
    B + ' .bi-doc-head{grid-template-columns:44mm minmax(0,1fr) 36mm!important;gap:0!important;height:37.8mm!important;min-height:37.8mm!important;max-height:37.8mm!important;margin:0!important;overflow:visible!important}',
    R + ' .rt-doc-head{grid-template-columns:44mm minmax(0,1fr) 36mm!important;gap:0!important;height:36.4mm!important;min-height:36.4mm!important;max-height:36.4mm!important;margin:0!important;overflow:visible!important}',
    // company name / English name: receipt 18pt bold, billing 16pt bold
    R + ' .rt-company b,' + R + ' .rt-company .en{display:block!important;font-size:15.3pt!important;font-weight:700!important;line-height:7mm!important;margin:0!important;white-space:nowrap!important}',
    B + ' .bi-company b,' + B + ' .bi-company .en{display:block!important;font-size:13.6pt!important;font-weight:700!important;line-height:7.6mm!important;margin:0!important;white-space:nowrap!important}',
    // address lines 9pt, dark grey
    both(' .bi-company div:not(.en)') + '{font-size:7.65pt!important;line-height:4.5mm!important;color:#333!important;margin:0!important;white-space:nowrap!important}',
    // ต้นฉบับ / (ไม่ใช่ใบกำกับภาษี) box 8pt, สำหรับลูกค้า 10pt
    B + ' .bi-taxnote,' + R + ' .rt-copybox{font-size:6.8pt!important;line-height:1.2!important;padding:1.2mm 1mm!important;width:32mm!important;margin:1mm 0 0 auto!important;box-sizing:border-box!important}',
    B + ' .bi-customer-copy,' + R + ' .rt-copyfor{font-size:8.5pt!important;line-height:1.3!important;margin:1.2mm 0 0 auto!important;width:32mm!important;text-align:center!important}',

    // ---- title rows 10-11 (15pt bold / 11pt bold), row 12 gap ----
    both(' .bi-title') + '{width:77mm!important;height:11.7mm!important;min-height:0!important;margin:0 auto 4.7mm!important;padding:0.4mm 2mm!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important}',
    both(' .bi-title b') + '{font-size:12.75pt!important;font-weight:700!important;line-height:1.2!important}',
    both(' .bi-title span') + '{display:block!important;font-size:9.35pt!important;font-weight:700!important;line-height:1.2!important}',

    // ---- customer block rows 13-19 ----
    both(' .bi-info') + '{grid-template-columns:minmax(0,1fr) 47mm!important;gap:3mm!important;margin:0 0 6.5mm!important;font-size:9.35pt!important}',
    R + ' .rt-info-line{grid-template-columns:20mm minmax(0,1fr)!important;gap:0!important;line-height:4.5mm!important;min-height:4.5mm!important}',
    B + ' .bi-info-line{grid-template-columns:20mm minmax(0,1fr)!important;gap:0!important;line-height:5.4mm!important;min-height:5.4mm!important}',
    both(' .bi-info>div:last-child .bi-info-line') + '{grid-template-columns:12mm minmax(0,1fr)!important}',
    both(' .bi-info-line b') + '{font-weight:400!important;white-space:nowrap!important}',
    both(' .bi-info-line *') + '{font-size:9.35pt!important}',
    R + ' .rt-taxline,' + B + ' .bi-info>div:first-child .bi-info-line:last-child{grid-template-columns:max-content minmax(0,1fr)!important;column-gap:4mm!important;margin-top:1mm!important}',
    R + ' .rt-taxline{line-height:4mm!important}',

    // ---- item table: header row 25.5pt, body rows 18pt, header text 11pt (not bold) ----
    both(' .bi-doc-table') + '{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;font-size:9.35pt!important;margin:0!important}',
    both(' .bi-doc-table th') + '{height:7.65mm!important;padding:0 1mm!important;font-size:9.35pt!important;font-weight:400!important;line-height:1.15!important;vertical-align:middle!important}',
    both(' .bi-doc-table td') + '{height:5.4mm!important;padding:0 1.2mm!important;font-size:9.35pt!important;line-height:5.2mm!important;vertical-align:top!important;box-sizing:border-box!important}',
    R + ' .rt-table th,' + R + ' .rt-table td{font-size:9.35pt!important}',
    R + ' .rt-table th{height:7.65mm!important;padding:0 1mm!important;font-weight:400!important;line-height:1.15!important;vertical-align:middle!important}',
    R + ' .rt-table td{height:5.4mm!important;padding:0 1.2mm!important;line-height:5.2mm!important;vertical-align:top!important}',
    // column widths from the Excel columns
    B + ' .bi-doc-table col:nth-child(1){width:8.3%!important}' + B + ' .bi-doc-table col:nth-child(2){width:42.6%!important}' + B + ' .bi-doc-table col:nth-child(3){width:11.3%!important}' + B + ' .bi-doc-table col:nth-child(4){width:23.2%!important}' + B + ' .bi-doc-table col:nth-child(5){width:14.6%!important}',
    R + ' .rt-table col:nth-child(1){width:9.5%!important}' + R + ' .rt-table col:nth-child(2){width:40%!important}' + R + ' .rt-table col:nth-child(3){width:15.6%!important}' + R + ' .rt-table col:nth-child(4){width:16%!important}' + R + ' .rt-table col:nth-child(5){width:18.9%!important}',

    // ---- billing bottom: notes 8pt, totals rows 20.25pt ----
    B + ' .bi-bottom{grid-template-columns:minmax(0,1fr) 62mm!important;gap:3mm!important;margin-top:1.5mm!important}',
    B + ' .bi-notes,' + B + ' .bi-notes *{font-size:6.8pt!important;line-height:5mm!important;margin:0!important}',
    B + ' .bi-amount-words{font-size:9.35pt!important;line-height:1.3!important;min-height:9mm!important;padding:1.5mm 2mm!important;display:flex!important;align-items:center!important}',
    B + ' .bi-amount-words *{font-size:9.35pt!important}',
    B + ' .bi-total-row{min-height:6.1mm!important;line-height:6.1mm!important;padding:0 2mm!important;font-size:9.35pt!important}',
    B + ' .bi-total-row *{font-size:9.35pt!important;font-weight:400!important}',
    // signature boxes rows 46-49, right under the totals (row 45 gap)
    B + ' .bi-signs{position:static!important;margin:6.5mm 0 0!important}',
    B + ' .bi-signs .bi-sign{height:28mm!important;min-height:28mm!important;max-height:28mm!important;font-size:9.35pt!important;line-height:1.3!important}',
    B + ' .bi-sign *{font-size:9.35pt!important;line-height:1.3!important}',
    B + ' .bi-sign-company-name{font-size:8.5pt!important}',

    // ---- receipt bottom rows 41-48 ----
    R + ' .rt-bottom{margin-top:1mm!important;gap:3mm!important}',
    R + ' .rt-bottom *{font-size:9.35pt!important}',
    R + ' .rt-words{min-height:7mm!important;line-height:1.3!important;padding:1.2mm 2mm!important;display:flex!important;align-items:center!important}',
    R + ' .rt-payline{line-height:6.2mm!important;min-height:6.2mm!important}',
    R + ' .rt-total-row{min-height:6.6mm!important;line-height:6.6mm!important;padding:0 2mm!important}',
    R + ' .rt-total-row b{font-weight:400!important}',
    // signature boxes rows 50-53, right under the payment lines (row 49 gap)
    R + ' .rt-signs{position:static!important;margin:5.2mm 0 0!important}',
    R + ' .rt-signs .rt-sign{height:30.4mm!important;min-height:30.4mm!important;max-height:30.4mm!important}',
    R + ' .rt-sign,' + R + ' .rt-sign *{font-size:9.35pt!important;line-height:1.35!important}',
    R + ' .rt-sign.center span:first-child{font-size:7.65pt!important}'
  ].join('\n');

  window.__DOC_EXCEL_CSS = CSS;

  // Excel item grids: billing 18 rows (rows 21-38), receipt 19 rows (rows 21-39)
  var ROWS = { bi: 18, rt: 19 };
  function fitRows(paper, kind) {
    var tbody = paper.querySelector(kind === 'bi' ? '.bi-doc-table tbody' : '.rt-table tbody');
    if (!tbody || !tbody.rows.length) return;
    var cols = tbody.rows[0].cells.length, blanks = [], filled = [];
    Array.prototype.forEach.call(tbody.rows, function (tr) { (/^\s*$/.test(tr.textContent) ? blanks : filled).push(tr); });
    function add() {
      var tr = document.createElement('tr');
      tr.className = kind === 'bi' ? 'bi-blank-row bi-final-extra-blank' : 'rt-blank-row';
      tr.innerHTML = new Array(cols + 1).join('<td>&nbsp;</td>');
      tbody.appendChild(tr); return tr;
    }
    // how many Excel rows the filled rows take: measured (wrapped text counts), else by line breaks
    var probe = blanks[0] || add(), unit = probe.getBoundingClientRect().height, used = 0;
    if (!blanks.length) blanks.push(probe);
    filled.forEach(function (tr) {
      var h = tr.getBoundingClientRect().height, n = 1;
      if (unit > 0 && h > 0) n = Math.max(1, Math.round(h / unit));
      else Array.prototype.forEach.call(tr.cells, function (td) { n = Math.max(n, td.querySelectorAll('br').length + 1); });
      used += n;
    });
    var want = Math.max(0, ROWS[kind] - used);
    while (blanks.length > want) blanks.pop().remove();
    while (blanks.length < want) blanks.push(add());
  }
  function clean(paper) {
    // inline font sizes/families set by older patches would override the stylesheet
    paper.querySelectorAll('[style]').forEach(function (el) {
      ['font-size', 'font-family', 'line-height'].forEach(function (p) { el.style.removeProperty(p); });
    });
    var kind = paper.classList.contains('bi-paper') ? 'bi' : 'rt';
    fitRows(paper, kind);
    var tag = paper.querySelector(':scope>style[data-doc-excel]');
    if (!tag) { tag = document.createElement('style'); tag.setAttribute('data-doc-excel', ''); }
    if (tag.textContent !== CSS) tag.textContent = CSS;
    if (paper.lastElementChild !== tag) paper.appendChild(tag); // travels with the paper into PDFs / archive
  }

  function install(doc) {
    if (!doc || doc.getElementById('docExcelStyle')) return;
    var st = doc.createElement('style'); st.id = 'docExcelStyle'; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }
  window.__docExcelInstall = install;

  // PDF frames are written with document.write: add the stylesheet at the end of their <head>.
  function inject(html) {
    if (typeof html !== 'string' || html.indexOf('docExcelStyle') >= 0 || !/(bi|rt)-paper/.test(html)) return html;
    var tag = '<style id="docExcelStyle">' + CSS + '</style>';
    return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, tag + '</head>') : html.replace(/<body/i, tag + '<body');
  }
  function hookDoc(d) {
    if (!d || d.__docExcelHook) return d;
    try {
      var w = d.write;
      d.write = function () { var a = Array.prototype.slice.call(arguments); if (a.length) a[0] = inject(a[0]); return w.apply(this, a); };
      d.__docExcelHook = true;
    } catch (_) {}
    return d;
  }
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');
    if (desc && desc.get) Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
      configurable: true, enumerable: desc.enumerable, get: function () { return hookDoc(desc.get.call(this)); }
    });
  } catch (_) {}

  var queued = false;
  function scan() {
    queued = false;
    install(document);
    document.querySelectorAll('.bi-paper,.rt-paper').forEach(function (p) { try { clean(p); } catch (e) { console.warn('doc-excel-style', e); } });
  }
  function schedule() { if (!queued) { queued = true; setTimeout(scan, 30); } } // not rAF: it stalls in background tabs
  function boot() {
    scan();
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t.nodeType === 1 && t.closest && t.closest('[data-doc-excel]')) continue;
        if (t.nodeType === 1 && (t.closest && t.closest('.bi-paper,.rt-paper') || t.querySelector && t.querySelector('.bi-paper,.rt-paper'))) { schedule(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

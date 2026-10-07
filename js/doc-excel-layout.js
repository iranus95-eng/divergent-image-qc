/* Document page → Excel sheet that looks like the printed page.
 * Every text block, table cell, border, background and image on the A4 page is measured and placed on a cell
 * grid built from the real edges, so the sheet keeps the PDF layout (fonts, sizes, bold, colours, merged cells,
 * borders, logos). Writes .xlsx itself (Office Open XML + a stored zip), no library needed.
 * window.DocExcelLayout = { pageToSheet(pageEl) → Promise<sheet>, writeXlsx(sheets) → Blob }
 */
(function () {
  'use strict';
  var PX_EMU = 9525;
  var SKIP = { SCRIPT: 1, STYLE: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, TEMPLATE: 1, NOSCRIPT: 1, IFRAME: 1, CANVAS: 1 };

  function win(el) { return el.ownerDocument.defaultView; }
  function css(el) { return win(el).getComputedStyle(el); }
  function isHidden(el, cs) { cs = cs || css(el); return cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0; }
  function cleanText(t) { return String(t == null ? '' : t).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim(); }
  function hasDirectText(el) { for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true; return false; }
  function textOf(el) {
    // items of a flex row sit on one line on paper, but innerText puts each on its own line
    var cs = css(el);
    if (/flex/.test(cs.display) && !/column/.test(cs.flexDirection) && cs.flexWrap === 'nowrap') {
      var row = [];
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (/\S/.test(c.nodeValue)) row.push(cleanText(c.nodeValue)); }
        else if (c.nodeType === 1 && !SKIP[c.tagName] && !isHidden(c)) { var tt = textOf(c); if (tt) row.push(tt); }
      }
      return cleanText(row.join(' '));
    }
    if (!el.querySelector('button,input,select,textarea,script,style')) return cleanText(el.innerText);
    var parts = [];
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) parts.push(n.nodeValue);
      else if (n.nodeType === 1 && !SKIP[n.tagName] && !isHidden(n)) { var t = textOf(n); if (t) parts.push(/^(block|flex|grid|table|list-item)/.test(css(n).display) ? '\n' + t + '\n' : t); }
    }
    return cleanText(parts.join(''));
  }
  function rgba(c) {
    var m = String(c || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/);
    if (!m) return null;
    var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    if (a < 0.05) return null;
    // blend translucent colours over white, as they appear on paper
    var ch = [m[1], m[2], m[3]].map(function (v) { return Math.round(255 - (255 - Number(v)) * a); });
    return 'FF' + ch.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('').toUpperCase();
  }
  function fontName(ff) {
    var first = String(ff || '').split(',')[0].replace(/["']/g, '').trim();
    if (/sarabun/i.test(first)) return 'TH SarabunPSK';
    return first || 'Tahoma';
  }
  function borderSide(cs, side) {
    var w = parseFloat(cs['border' + side + 'Width']) || 0, st = cs['border' + side + 'Style'];
    if (w < 0.4 || st === 'none' || st === 'hidden') return null;
    var color = rgba(cs['border' + side + 'Color']); if (!color) return null;
    var style = st === 'dashed' ? 'dashed' : st === 'dotted' ? 'dotted' : st === 'double' ? 'double' : w >= 2.6 ? 'thick' : w >= 1.6 ? 'medium' : 'thin';
    return { style: style, color: color };
  }

  // ---------- measure ----------
  function measure(page) {
    var P = page.getBoundingClientRect();
    var f = page.offsetWidth ? P.width / page.offsetWidth : 1; if (!(f > 0)) f = 1;
    var W = page.offsetWidth || P.width / f, H = page.offsetHeight || P.height / f;
    function box(el) {
      var r = el.getBoundingClientRect();
      var x1 = (r.left - P.left) / f, y1 = (r.top - P.top) / f, x2 = (r.right - P.left) / f, y2 = (r.bottom - P.top) / f;
      return { x1: Math.max(0, x1), y1: Math.max(0, y1), x2: Math.min(W, x2), y2: Math.min(H, y2) };
    }
    var leaves = [], decos = [], images = [];
    function deco(el, cs, b) {
      var sides = { top: borderSide(cs, 'Top'), right: borderSide(cs, 'Right'), bottom: borderSide(cs, 'Bottom'), left: borderSide(cs, 'Left') };
      var fill = rgba(cs.backgroundColor);
      if (fill === 'FFFFFFFF') fill = null;
      if (fill || sides.top || sides.right || sides.bottom || sides.left) decos.push({ b: b, fill: fill, sides: sides });
    }
    function leaf(el, cs, b) {
      var text = textOf(el); if (!text) return;
      var fs = parseFloat(cs.fontSize) || 14, lh = parseFloat(cs.lineHeight) || fs * 1.25;
      var ta = cs.textAlign, va = cs.verticalAlign;
      leaves.push({
        b: b, text: text, lines: Math.max(text.split('\n').length, Math.round((b.y2 - b.y1) / lh)), pb: /^T[DH]$/.test(el.tagName) || !el.parentElement ? null : box(el.parentElement),
        font: { name: fontName(cs.fontFamily), size: Math.round(fs * 0.75 * 2) / 2, bold: (parseInt(cs.fontWeight, 10) || 400) >= 600, italic: cs.fontStyle === 'italic', underline: /underline/.test(cs.textDecorationLine || cs.textDecoration || ''), color: rgba(cs.color) || 'FF000000' },
        align: {
          h: ta === 'center' ? 'center' : (ta === 'right' || ta === 'end') ? 'right' : 'left',
          v: /^T[DH]$/.test(el.tagName) ? (va === 'top' ? 'top' : va === 'bottom' ? 'bottom' : 'center') : 'center',
          wrap: /\n/.test(text) || (b.y2 - b.y1) > lh * 1.6
        }
      });
    }
    function walk(el) {
      if (SKIP[el.tagName]) return;
      var cs = css(el); if (isHidden(el, cs)) return;
      if (el.tagName === 'IMG') { var bi = box(el); if (bi.x2 - bi.x1 > 2 && bi.y2 - bi.y1 > 2) images.push({ el: el, b: bi }); return; }
      if (el.tagName === 'svg' || el.tagName === 'SVG') return;
      var b = box(el);
      if (b.x2 - b.x1 < 0.5 && b.y2 - b.y1 < 0.5) return;
      if (el !== page) deco(el, cs, b);
      var cell = /^T[DH]$/.test(el.tagName);
      if (cell || hasDirectText(el)) {
        leaf(el, cs, b);
        [].forEach.call(el.querySelectorAll('img'), function (img) { if (!isHidden(img)) { var bi = box(img); if (bi.x2 - bi.x1 > 2) images.push({ el: img, b: bi }); } });
        // bordered boxes nested in a text block (e.g. tick boxes) keep their outline
        [].forEach.call(el.querySelectorAll('*'), function (k) { if (!SKIP[k.tagName] && k.tagName !== 'IMG') { var kc = css(k); if (!isHidden(k, kc)) deco(k, kc, box(k)); } });
        return;
      }
      [].forEach.call(el.children, walk);
    }
    walk(page);
    return { W: W, H: H, leaves: leaves, decos: decos, images: images };
  }

  // ---------- grid ----------
  function edges(vals, max) {
    vals.push(0, max);
    vals = vals.map(function (v) { return Math.round(Math.min(max, Math.max(0, v)) * 2) / 2; }).sort(function (a, b) { return a - b; });
    var out = [];
    vals.forEach(function (v) { if (!out.length || v - out[out.length - 1] > 2) out.push(v); });
    if (max - out[out.length - 1] > 0.5) out.push(max); else out[out.length - 1] = max;
    return out;
  }
  function nearest(list, v) { var best = 0, d = 1e9; for (var i = 0; i < list.length; i++) { var dd = Math.abs(list[i] - v); if (dd < d) { d = dd; best = i; } } return best; }

  async function imageData(img) {
    try {
      var src = img.currentSrc || img.src; if (!src) return null;
      var res = await fetch(src); var blob = await res.blob();
      var type = /png/.test(blob.type) ? 'png' : /jpe?g/.test(blob.type) ? 'jpeg' : '';
      if (!type) { // other formats: redraw to PNG
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0); blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); }); type = 'png';
      }
      return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: type === 'png' ? 'png' : 'jpeg' };
    } catch (e) { console.warn('excel image skipped', e); return null; }
  }

  async function pageToSheet(page) {
    var m = measure(page);
    var xs = [], ys = [];
    function add(b) { xs.push(b.x1, b.x2); ys.push(b.y1, b.y2); }
    m.leaves.forEach(function (l) { add(l.b); });
    m.decos.forEach(function (d) { add(d.b); });
    var X = edges(xs, m.W), Y = edges(ys, m.H);
    var cols = [], rows = [];
    for (var i = 1; i < X.length; i++) cols.push(X[i] - X[i - 1]);
    for (var j = 1; j < Y.length; j++) rows.push(Y[j] - Y[j - 1]);
    function rng(b) {
      var c1 = nearest(X, b.x1), c2 = nearest(X, b.x2) - 1, r1 = nearest(Y, b.y1), r2 = nearest(Y, b.y2) - 1;
      return { c1: c1, c2: Math.max(c1, c2), r1: r1, r2: Math.max(r1, r2), flatY: r2 < r1, flatX: c2 < c1 };
    }
    var cells = {}; // "r,c" → {v, font, fill, border:{top..}, align}
    function cell(r, c) { var k = r + ',' + c; return cells[k] || (cells[k] = { border: {} }); }
    // backgrounds and borders, outer boxes first so inner ones win
    m.decos.forEach(function (d) {
      var g = rng(d.b), r, c;
      if (d.fill && !g.flatX && !g.flatY) for (r = g.r1; r <= g.r2; r++) for (c = g.c1; c <= g.c2; c++) cell(r, c).fill = d.fill;
      var s = d.sides;
      if (g.flatY) { // a line element (height ~0): draw it on the row edge where it sits
        var line = s.top || s.bottom; if (!line) return;
        var ry = nearest(Y, d.b.y1);
        for (c = g.c1; c <= g.c2; c++) { if (ry < rows.length) cell(ry, c).border.top = line; else cell(ry - 1, c).border.bottom = line; }
        return;
      }
      for (c = g.c1; c <= g.c2; c++) { if (s.top) cell(g.r1, c).border.top = s.top; if (s.bottom) cell(g.r2, c).border.bottom = s.bottom; }
      for (r = g.r1; r <= g.r2; r++) { if (s.left) cell(r, g.c1).border.left = s.left; if (s.right) cell(r, g.c2).border.right = s.right; }
    });
    var owner = {}, merges = [], placed = [];
    m.leaves.forEach(function (l, li) {
      var g = rng(l.b);
      var free = true, r, c;
      for (r = g.r1; r <= g.r2 && free; r++) for (c = g.c1; c <= g.c2; c++) if (owner[r + ',' + c] != null) { free = false; break; }
      var target = cell(g.r1, g.c1);
      if (target.v != null && target.v !== '') { target.v = String(target.v) + '\n' + l.text; target.align = Object.assign({}, target.align, { wrap: true }); return; }
      target.v = l.text; target.font = l.font; target.align = l.align;
      if (free) {
        for (r = g.r1; r <= g.r2; r++) for (c = g.c1; c <= g.c2; c++) owner[r + ',' + c] = li;
        placed.push({ g: g, l: l, li: li });
      }
    });
    // Excel's fonts often run a little wider than the browser's: let one-line text use the empty space
    // beside it inside its own box (never across a border or another text), so it does not get shrunk
    function edge(r1, r2, c, side) { for (var r = r1; r <= r2; r++) { var k = cells[r + ',' + c]; if (k && k.border[side]) return true; } return false; }
    function taken(r1, r2, c, side) {
      for (var r = r1; r <= r2; r++) {
        if (owner[r + ',' + c] != null) return true;
        var k = cells[r + ',' + c]; if (k && (k.border[side] || (k.v != null && k.v !== ''))) return true;
      }
      return false;
    }
    placed.forEach(function (p) {
      var g = p.g, l = p.l, r;
      if (l.pb && !l.align.wrap) {
        if (l.align.h === 'left') {
          var lim = Math.min(cols.length - 1, nearest(X, l.pb.x2) - 1);
          while (g.c2 < lim && !edge(g.r1, g.r2, g.c2, 'right') && !taken(g.r1, g.r2, g.c2 + 1, 'left')) { g.c2++; for (r = g.r1; r <= g.r2; r++) owner[r + ',' + g.c2] = p.li; }
        } else if (l.align.h === 'right') {
          var lo = Math.max(0, nearest(X, l.pb.x1));
          while (g.c1 > lo && !edge(g.r1, g.r2, g.c1, 'left') && !taken(g.r1, g.r2, g.c1 - 1, 'right')) {
            var from = cell(g.r1, g.c1), keep = { v: from.v, font: from.font, align: from.align };
            from.v = null; from.font = null; from.align = null; // a merged cell shows its top-left value
            g.c1--; for (r = g.r1; r <= g.r2; r++) owner[r + ',' + g.c1] = p.li;
            var to = cell(g.r1, g.c1); to.v = keep.v; to.font = keep.font; to.align = keep.align;
          }
        }
      }
      if (g.r2 > g.r1 || g.c2 > g.c1) merges.push(g);
    });
    // Excel draws Thai text with taller lines than the browser: grow the last row of a text block
    // until every line fits (only ever grows, so nothing else moves out of place)
    placed.forEach(function (p) {
      var g = p.g, l = p.l, need = l.lines * l.font.size * (l.lines > 1 ? 1.45 : 1.3) + 2, have = 0;
      for (var r = g.r1; r <= g.r2; r++) have += rows[r] * 0.75;
      if (need > have + 0.5) rows[g.r2] += (need - have) / 0.75;
    });
    // rows of a table that differ only by pixel rounding get one common height
    for (var ri = 0; ri < rows.length;) {
      var rj = ri;
      while (rj + 1 < rows.length && rows[ri] >= 12 && Math.abs(rows[rj + 1] - rows[ri]) <= 1.2) rj++;
      if (rj > ri) { var hi = 0; for (var q = ri; q <= rj; q++) hi = Math.max(hi, rows[q]); for (q = ri; q <= rj; q++) rows[q] = hi; }
      ri = rj + 1;
    }
    var imgs = [];
    for (var k = 0; k < m.images.length; k++) {
      var im = m.images[k], data = await imageData(im.el); if (!data) continue;
      var b = im.b, ca = Math.max(0, nearest(X, b.x1) - (X[nearest(X, b.x1)] > b.x1 ? 1 : 0)), ra = Math.max(0, nearest(Y, b.y1) - (Y[nearest(Y, b.y1)] > b.y1 ? 1 : 0));
      var cb = Math.max(0, nearest(X, b.x2) - (X[nearest(X, b.x2)] > b.x2 ? 1 : 0)), rb = Math.max(0, nearest(Y, b.y2) - (Y[nearest(Y, b.y2)] > b.y2 ? 1 : 0));
      ca = Math.min(ca, cols.length - 1); cb = Math.min(cb, cols.length - 1); ra = Math.min(ra, rows.length - 1); rb = Math.min(rb, rows.length - 1);
      imgs.push({ data: data, from: { c: ca, cOff: Math.max(0, b.x1 - X[ca]), r: ra, rOff: Math.max(0, b.y1 - Y[ra]) }, to: { c: cb, cOff: Math.max(0, b.x2 - X[cb]), r: rb, rOff: Math.max(0, b.y2 - Y[rb]) } });
    }
    return { cols: cols, rows: rows, cells: cells, merges: merges, images: imgs, widthPx: m.W, heightPx: m.H };
  }

  // ---------- xlsx writer ----------
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  function colName(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function ref(r, c) { return colName(c) + (r + 1); }
  function numberOf(t) {
    if (/^-?\d{1,3}(,\d{3})*\.\d{2}$/.test(t) || /^-?\d+\.\d{2}$/.test(t)) return { n: Number(t.replace(/,/g, '')), fmt: '#,##0.00' };
    if (/^-?\d{1,3}(,\d{3})+$/.test(t)) return { n: Number(t.replace(/,/g, '')), fmt: '#,##0' };
    return null;
  }

  function Styles() {
    this.fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = []; this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.map = {};
  }
  Styles.prototype.idx = function (list, xml) { var i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; };
  Styles.prototype.xf = function (cl, fmt) {
    var fo = cl.font, fontXml = fo ? '<font>' + (fo.bold ? '<b/>' : '') + (fo.italic ? '<i/>' : '') + (fo.underline ? '<u/>' : '') + '<sz val="' + fo.size + '"/><color rgb="' + fo.color + '"/><name val="' + esc(fo.name) + '"/></font>' : null;
    var fontId = fontXml ? this.idx(this.fonts, fontXml) : 0;
    var fillId = cl.fill ? this.idx(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="' + cl.fill + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
    var bd = cl.border || {}, side = function (n) { var s = bd[n]; return s ? '<' + n + ' style="' + s.style + '"><color rgb="' + s.color + '"/></' + n + '>' : '<' + n + '/>'; };
    var bXml = '<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>';
    var borderId = bXml === this.borders[0] ? 0 : this.idx(this.borders, bXml);
    var numFmtId = 0;
    if (fmt === '#,##0.00') numFmtId = 4; else if (fmt === '#,##0') numFmtId = 3;
    var al = cl.align, aXml = al ? '<alignment horizontal="' + al.h + '" vertical="' + al.v + '"' + (al.wrap ? ' wrapText="1"' : ' shrinkToFit="1"') + '/>' : ''; // one-line text shrinks rather than clipping when Excel's font runs wider
    var xml = '<xf numFmtId="' + numFmtId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0"' + (numFmtId ? ' applyNumberFormat="1"' : '') + (fontId ? ' applyFont="1"' : '') + (fillId ? ' applyFill="1"' : '') + (borderId ? ' applyBorder="1"' : '') + (aXml ? ' applyAlignment="1">' + aXml + '</xf>' : '/>');
    return this.idx(this.xfs, xml);
  };
  Styles.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  function colWidth(px) { return px >= 12 ? (px - 5) / 7 : Math.max(0.08, px / 12); }

  function sheetXml(sh, st, drawingRid) {
    var colsXml = '<cols>' + sh.cols.map(function (px, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + colWidth(px).toFixed(3) + '" customWidth="1"/>'; }).join('') + '</cols>';
    var byRow = {};
    Object.keys(sh.cells).forEach(function (k) { var p = k.split(','), r = +p[0], c = +p[1]; (byRow[r] || (byRow[r] = [])).push(c); });
    var rowsXml = '';
    for (var r = 0; r < sh.rows.length; r++) {
      var cs = (byRow[r] || []).sort(function (a, b) { return a - b; });
      var inner = cs.map(function (c) {
        var cl = sh.cells[r + ',' + c], v = cl.v, num = v != null && v !== '' ? numberOf(String(v)) : null;
        var s = st.xf(cl, num && num.fmt);
        if (v == null || v === '') return '<c r="' + ref(r, c) + '" s="' + s + '"/>';
        if (num) return '<c r="' + ref(r, c) + '" s="' + s + '"><v>' + num.n + '</v></c>';
        return '<c r="' + ref(r, c) + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }).join('');
      rowsXml += '<row r="' + (r + 1) + '" ht="' + Math.max(0.75, sh.rows[r] * 0.75).toFixed(2) + '" customHeight="1">' + inner + '</row>';
    }
    var merges = sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (g) { return '<mergeCell ref="' + ref(g.r1, g.c1) + ':' + ref(g.r2, g.c2) + '"/>'; }).join('') + '</mergeCells>' : '';
    var lastRef = ref(sh.rows.length - 1, sh.cols.length - 1);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:' + lastRef + '"/>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="100"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
      colsXml + '<sheetData>' + rowsXml + '</sheetData>' + merges +
      '<printOptions horizontalCentered="1"/><pageMargins left="0" right="0" top="0" bottom="0" header="0" footer="0"/>' +
      '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>' +
      (drawingRid ? '<drawing r:id="' + drawingRid + '"/>' : '') + '</worksheet>';
  }

  function drawingXml(sh, firstImage) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      sh.images.map(function (im, i) {
        var e = function (px) { return Math.round(px * PX_EMU); };
        return '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>' + im.from.c + '</xdr:col><xdr:colOff>' + e(im.from.cOff) + '</xdr:colOff><xdr:row>' + im.from.r + '</xdr:row><xdr:rowOff>' + e(im.from.rOff) + '</xdr:rowOff></xdr:from>' +
          '<xdr:to><xdr:col>' + im.to.c + '</xdr:col><xdr:colOff>' + e(im.to.cOff) + '</xdr:colOff><xdr:row>' + im.to.r + '</xdr:row><xdr:rowOff>' + e(im.to.rOff) + '</xdr:rowOff></xdr:to>' +
          '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (i + 2) + '" name="Picture ' + (i + 1) + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
          '<xdr:blipFill><a:blip r:embed="rId' + (i + 1) + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
          '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>';
      }).join('') + '</xdr:wsDr>';
  }

  // ---------- zip (stored) ----------
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), chunks = [], central = [], offset = 0;
    var now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      chunks.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cSize = central.reduce(function (s, a) { return s + a.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function writeXlsx(sheets, props) {
    var st = new Styles(), files = [], ct = [], wbSheets = [], wbRels = [], used = {}, imgNo = 0;
    sheets.forEach(function (sh, i) {
      var n = String(sh.name || ('Sheet' + (i + 1))).replace(/[\\\/?*\[\]:]/g, '-').slice(0, 31) || ('Sheet' + (i + 1)), base = n, k = 2;
      while (used[n.toLowerCase()]) n = base.slice(0, 27) + ' ' + (k++); used[n.toLowerCase()] = 1;
      var id = i + 1, drawing = sh.images && sh.images.length;
      files.push({ name: 'xl/worksheets/sheet' + id + '.xml', data: sheetXml(sh, st, drawing ? 'rId1' : null) });
      ct.push('<Override PartName="/xl/worksheets/sheet' + id + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      wbSheets.push('<sheet name="' + esc(n) + '" sheetId="' + id + '" r:id="rId' + id + '"/>');
      wbRels.push('<Relationship Id="rId' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + id + '.xml"/>');
      if (drawing) {
        files.push({ name: 'xl/worksheets/_rels/sheet' + id + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + id + '.xml"/></Relationships>' });
        files.push({ name: 'xl/drawings/drawing' + id + '.xml', data: drawingXml(sh) });
        ct.push('<Override PartName="/xl/drawings/drawing' + id + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
        var rels = sh.images.map(function (im, j) {
          imgNo++; var fname = 'image' + imgNo + '.' + im.data.ext;
          files.push({ name: 'xl/media/' + fname, data: im.data.bytes });
          return '<Relationship Id="rId' + (j + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + fname + '"/>';
        }).join('');
        files.push({ name: 'xl/drawings/_rels/drawing' + id + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>' });
      }
    });
    var nSheets = sheets.length;
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' + wbSheets.join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + wbRels.join('') + '<Relationship Id="rId' + (nSheets + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: st.xml() });
    var title = esc((props && props.title) || '');
    files.push({ name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + title + '</dc:title><dc:creator>Divergent Corporation</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>' });
    var hasPng = files.some(function (f) { return /\.png$/.test(f.name); }), hasJpg = files.some(function (f) { return /\.jpeg$/.test(f.name); });
    files.unshift({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      (hasPng ? '<Default Extension="png" ContentType="image/png"/>' : '') + (hasJpg ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : '') +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' + ct.join('') + '</Types>' });
    files.splice(1, 0, { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' });
    return zip(files);
  }

  // Render print HTML (the same HTML the PDF is made from) off-screen at A4 width and return its pages.
  function renderPrintDoc(html, pageSelector) {
    return new Promise(function (resolve, reject) {
      var fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true');
      fr.style.cssText = 'position:fixed;left:-12000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden';
      document.body.appendChild(fr);
      var d = fr.contentDocument;
      d.open(); d.write(String(html).replace(/<script[\s\S]*?<\/script>/gi, '')); d.close();
      var done = false;
      var finish = async function () {
        if (done) return; done = true;
        try {
          await Promise.all([].map.call(d.images, function (img) { return img.complete ? 0 : new Promise(function (r) { img.onload = img.onerror = r; }); }));
          if (d.fonts && d.fonts.ready) await Promise.race([d.fonts.ready, new Promise(function (r) { setTimeout(r, 2500); })]);
          await new Promise(function (r) { setTimeout(r, 800); }); // layout patches that hook print frames run in the first ~300 ms
          var pages = [].slice.call(d.querySelectorAll(pageSelector));
          resolve({ pages: pages, dispose: function () { fr.remove(); } });
        } catch (e) { fr.remove(); reject(e); }
      };
      fr.onload = finish; setTimeout(finish, 1500);
    });
  }

  window.DocExcelLayout = { pageToSheet: pageToSheet, writeXlsx: writeXlsx, renderPrintDoc: renderPrintDoc };
})();

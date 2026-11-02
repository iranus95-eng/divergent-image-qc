/* แผนที่ตารางประมูลแจ้งเตือน (2026-11-02)
 * The district map of the 5 provinces (ขอนแก่น ชัยภูมิ นครราชสีมา บุรีรัมย์ สุรินทร์), drawn from the rows of ตารางประมูลแจ้งเตือน,
 * so it follows the table every time a result changes:
 *  - ✓ green  : a site we won (status "ชนะประมูล"), plus the districts its office also serves (COVER, from the map we used before)
 *  - 📍 orange : a site still waiting for its auction or result (no status yet)
 *  - ✕ grey   : a site we did not win (status "ไม่ชนะประมูล"), when nothing else is marked there
 * Boundaries: js/notice-map-data.js (window.NOTICE_MAP_DATA). Used by js/notice-bids.js: NoticeMap.html(rows).
 */
(function () {
  'use strict';
  if (window.NoticeMap) return;

  // districts an office serves besides its own, as the old map (แผนที่รวม-ตัวหนังสือใหญ่.png) showed them; "จังหวัด/อำเภอ"
  // keyed by the site's own district. Marked only when the site is won.
  var COVER = {
    'ขอนแก่น/ชุมแพ': ['ขอนแก่น/ภูผาม่าน', 'ขอนแก่น/สีชมพู'],
    'ขอนแก่น/ภูเวียง': ['ขอนแก่น/เวียงเก่า', 'ขอนแก่น/หนองนาคำ'],
    'ขอนแก่น/เมืองขอนแก่น': ['ขอนแก่น/พระยืน'],
    'ขอนแก่น/มัญจาคีรี': ['ขอนแก่น/โคกโพธิ์ไชย', 'ขอนแก่น/ชนบท'],
    'ขอนแก่น/บ้านไผ่': ['ขอนแก่น/บ้านแฮด', 'ขอนแก่น/โนนศิลา', 'ขอนแก่น/เปือยน้อย'],
    'ขอนแก่น/พล': ['ขอนแก่น/แวงใหญ่', 'ขอนแก่น/แวงน้อย'],
    'นครราชสีมา/เมืองนครราชสีมา': ['นครราชสีมา/ขามทะเลสอ', 'นครราชสีมา/เฉลิมพระเกียรติ']
  };
  // a site named after a tambon, not a district
  var ALIAS = { 'จอหอ': 'เมืองนครราชสีมา', 'หมูสี': 'ปากช่อง' };
  var FILL = { 'ขอนแก่น': '#fdf1f1', 'ชัยภูมิ': '#eff6ec', 'นครราชสีมา': '#fdf7ee', 'บุรีรัมย์': '#ecf3fc', 'สุรินทร์': '#f3effb' };
  var W = 1000;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(r) { var t = String(r.status || ''); return t.indexOf('ชนะ') >= 0 && !lost(r); }
  function lost(r) { return /ไม่ชนะ|แพ้/.test(String(r.status || '')); }
  function cancelled(r) { return String(r.status || '').indexOf('ยกเลิก') >= 0; }
  function key(d) { return d.p + '/' + d.n; }
  // "กฟส.เมืองนครราชสีมา 3" → "เมืองนครราชสีมา", "นม1" → "นครราชสีมา"
  function clean(s) {
    return String(s || '').replace(/^\s*(กฟส|กฟจ|กฟอ)\.?\s*/, '').replace(/[\s\d]+$/, '').replace(/^นม$/, 'นครราชสีมา').replace(/\s+/g, '');
  }

  var geo = null;
  function data() {
    if (geo) return geo;
    var D = window.NOTICE_MAP_DATA; if (!D) return null;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cos = Math.cos(15.3 * Math.PI / 180);
    D.districts.forEach(function (d) { d.g.forEach(function (r) { r.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }); }); });
    var pad = 20, k = (W - 2 * pad) / ((maxX - minX) * cos);
    var pt = function (p) { return [pad + (p[0] - minX) * cos * k, pad + (maxY - p[1]) * k]; };
    var byName = {}, byKey = {};
    D.districts.forEach(function (d) {
      d.path = d.g.map(function (r) { return 'M' + r.map(function (p) { var q = pt(p); return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z'; }).join('');
      d.xy = pt(d.c); d.key = key(d);
      (byName[d.n] = byName[d.n] || []).push(d); byKey[d.key] = d;
    });
    var prov = {};
    D.districts.forEach(function (d) { var a = prov[d.p] = prov[d.p] || { x: 0, y: 0, n: 0 }; a.x += d.xy[0]; a.y += d.xy[1]; a.n++; });
    geo = { list: D.districts, byName: byName, byKey: byKey, prov: prov, H: Math.ceil(pad * 2 + (maxY - minY) * k) };
    return geo;
  }

  // the districts of one row: each name of "ลำปลายมาศ + หนองหงส์", the district itself or เมือง… for a province town
  function districtsOf(row) {
    var g = data(); if (!g) return [];
    var out = [];
    String(row.site || '').split('+').forEach(function (part) {
      var n = clean(part); if (!n) return;
      var hit = g.byName[n] || g.byName['เมือง' + n] || g.byName[ALIAS[n]] || [];
      hit.forEach(function (d) { if (out.indexOf(d) < 0) out.push(d); });
    });
    return out;
  }

  // district key → { won: [sites], wait: [sites], lost: [sites], cover: [sites] }
  function marks(rows) {
    var g = data(), m = {}, off = [];
    var add = function (d, kind, site) { var e = m[d.key] = m[d.key] || { won: [], wait: [], lost: [], cover: [] }; if (e[kind].indexOf(site) < 0) e[kind].push(site); };
    (rows || []).forEach(function (r) {
      if (cancelled(r)) return;
      var ds = districtsOf(r), site = r.site || '';
      if (!ds.length) { off.push(r); return; }
      var kind = won(r) ? 'won' : lost(r) ? 'lost' : 'wait';
      ds.forEach(function (d) {
        add(d, kind, site);
        if (kind === 'won') (COVER[d.key] || []).forEach(function (k) { if (g.byKey[k]) add(g.byKey[k], 'cover', site); });
      });
    });
    return { m: m, off: off };
  }
  function state(e) { return !e ? '' : e.won.length || e.cover.length ? 'won' : e.wait.length ? 'wait' : e.lost.length ? 'lost' : ''; }

  function check(x, y) { return '<path class="nm-ck" d="M' + (x - 8) + ' ' + y + 'l5.5 5.5 11-11"/>'; }
  function cross(x, y) { return '<path class="nm-x" d="M' + (x - 5) + ' ' + (y - 5) + 'l10 10M' + (x + 5) + ' ' + (y - 5) + 'l-10 10"/>'; }
  function pin(x, y) {
    return '<g class="nm-pin" transform="translate(' + x + ' ' + y + ')"><path d="M0 0c-2-6-8-9-8-15a8 8 0 0 1 16 0c0 6-6 9-8 15z"/><circle cx="0" cy="-15" r="3.2"/></g>';
  }

  // the map itself (shapes, outlines, names, marks) and the counts of the legend
  function draw(rows) {
    var g = data(); if (!g) return null;
    var mk = marks(rows), m = mk.m;
    var shapes = '', labels = '', signs = '';
    g.list.forEach(function (d) {
      var e = m[d.key], s = state(e), x = Math.round(d.xy[0]), y = Math.round(d.xy[1]);
      var tip = d.n + ' (' + d.p + ')' + (e ? [['won', '✓ ชนะประมูล'], ['cover', '✓ ในเขตของ'], ['wait', '📍 รอประมูล/รอผล'], ['lost', '✕ ไม่ชนะ']]
        .filter(function (k) { return e[k[0]].length; }).map(function (k) { return '\n' + k[1] + ': ' + e[k[0]].join(', '); }).join('') : '');
      shapes += '<path class="nm-d' + (s === 'won' ? ' won' : '') + '" fill="' + (s === 'won' ? '#e3f4e6' : FILL[d.p] || '#fff') + '" d="' + d.path + '"><title>' + esc(tip) + '</title></path>';
      labels += '<text class="nm-l" x="' + x + '" y="' + y + '">' + esc(d.n) + '</text>';
      if (s === 'won') signs += check(x, y + 13);
      else if (s === 'wait') signs += pin(x, y - 9);
      else if (s === 'lost') signs += cross(x, y + 12);
    });
    // won districts drawn again on top, so their red outline is not hidden under the neighbours' grey edges
    var tops = g.list.filter(function (d) { return state(m[d.key]) === 'won'; }).map(function (d) { return '<path class="nm-wo" d="' + d.path + '"/>'; }).join('');
    var prov = Object.keys(g.prov).map(function (p) { var a = g.prov[p]; return '<text class="nm-p" x="' + Math.round(a.x / a.n) + '" y="' + Math.round(a.y / a.n) + '">' + esc(p) + '</text>'; }).join('');
    // ราย/ปี of every site we won (also one off the map), the same sum as the 🏆 button: จำนวนราย, else วงเงิน ÷ 1.07 ÷ ราคากลาง
    var units = (rows || []).filter(won).reduce(function (t, r) {
      var q = Number(r.qty) || (r.budget && r.mid_price ? Math.round(r.budget / 1.07 / r.mid_price) : 0);
      return t + (q || 0);
    }, 0);
    var count = function (f) { return (rows || []).filter(function (r) { return !cancelled(r) && f(r) && districtsOf(r).length; }).length; };
    return {
      body: shapes + tops + '<g class="nm-prov">' + prov + '</g><g>' + labels + '</g>' + signs, H: g.H, off: mk.off.length,
      won: count(won), units: units, lost: count(lost), wait: count(function (r) { return !won(r) && !lost(r); })
    };
  }

  function n0(v) { return Math.round(v).toLocaleString('en-US'); }
  function unitsText(u) { return u ? ' · ' + n0(u) + ' ราย/ปี (' + n0(u / 12) + ' ราย/เดือน)' : ''; }
  var lastRows = null;
  function html(rows) {
    var d = draw(rows);
    if (!d) return '<div class="nm-empty">โหลดข้อมูลแผนที่ไม่สำเร็จ</div>';
    lastRows = rows;
    return '<div class="nm-wrap"><div class="nm-top"><button type="button" class="nm-dl" data-nm="dl" title="บันทึกแผนที่ตามสถานะตอนนี้เป็นรูป PNG">⬇ ดาวน์โหลดแผนที่ (PNG)</button></div>' +
      '<div class="nm-scroll"><svg class="nm-svg" viewBox="0 0 ' + W + ' ' + d.H + '" role="img" aria-label="แผนที่ไซด์ประมูล 5 จังหวัด">' + d.body + '</svg></div>' +
      '<div class="nm-legend"><span><svg viewBox="-10 -10 20 20">' + check(0, 1) + '</svg> ชนะประมูล ' + d.won + ' ไซด์' + unitsText(d.units) + '</span>' +
      '<span><svg viewBox="-10 -24 20 26">' + pin(0, 0) + '</svg> รอประมูล / รอผล ' + d.wait + ' ไซด์</span>' +
      '<span><svg viewBox="-10 -10 20 20">' + cross(0, 0) + '</svg> ไม่ชนะ ' + d.lost + ' ไซด์</span>' +
      '<small>อัปเดตตามตารางทุกครั้งที่สถานะเปลี่ยน • ✓ ในอำเภอข้างเคียง = อำเภอในเขตของสาขาที่ชนะ (ตามแผนที่เดิม) • ชี้หรือแตะอำเภอเพื่อดูไซด์' +
      (d.off ? ' • ไซด์นอก 5 จังหวัดนี้ ' + d.off + ' ไซด์ไม่อยู่บนแผนที่' : '') +
      ' • ขอบเขตอำเภอ: OpenGISData-Thailand (CC BY 4.0)</small></div></div>';
  }

  // ---------------------------------------------------------------- download: the map as it is now, with a title and the legend, as a PNG
  var MAP_CSS = '.nm-d{stroke:#8f8f8f;stroke-width:.6}.nm-wo{fill:none;stroke:#d62828;stroke-width:1.6}' +
    '.nm-l{font-size:10.5px;font-weight:700;fill:#222;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}' +
    '.nm-p{font-size:30px;font-weight:800;fill:#4b2378;opacity:.15;text-anchor:middle;dominant-baseline:middle}' +
    '.nm-ck{fill:none;stroke:#14852b;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}' +
    '.nm-x{fill:none;stroke:#9a9a9a;stroke-width:2.6;stroke-linecap:round}' +
    '.nm-pin path{fill:#f2581c;stroke:#f6c84c;stroke-width:1.6}.nm-pin circle{fill:#fff}';
  var fontP = null;
  // Sarabun from the app's own fonts folder, put inside the picture: an SVG drawn as an image cannot use the page's fonts
  function fontCss() {
    if (!fontP) {
      fontP = fetch('./fonts/Sarabun-Bold.ttf').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (buf) {
        var b = new Uint8Array(buf), bin = '';
        for (var i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        return '@font-face{font-family:NmSarabun;src:url(data:font/ttf;base64,' + btoa(bin) + ') format("truetype");font-weight:100 900}';
      }).catch(function (e) { console.warn('notice-map font', e); fontP = null; return ''; });
    }
    return fontP;
  }
  function thaiToday() {
    var t = new Date(Date.now() + 7 * 3600e3), M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return { iso: t.toISOString().slice(0, 10), th: t.getUTCDate() + ' ' + M[t.getUTCMonth()] + ' ' + (t.getUTCFullYear() + 543) };
  }
  // the whole picture as one SVG document: title on top, the map, the legend under it
  function pictureSvg(rows, font) {
    var d = draw(rows); if (!d) return null;
    var day = thaiToday(), top = 70, foot = 98, H = top + d.H + foot, y = top + d.H + 30;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<style>' + font + 'text{font-family:NmSarabun,Sarabun,Tahoma,sans-serif}' + MAP_CSS +
      '.nm-t{font-size:24px;font-weight:800;fill:#222}.nm-s{font-size:13px;fill:#555}.nm-g{font-size:15px;font-weight:700;fill:#222}.nm-n{font-size:11px;fill:#777}</style>' +
      '<rect width="100%" height="100%" fill="#fff"/>' +
      '<text class="nm-t" x="24" y="36">แผนที่ไซด์ประมูลแจ้งเตือน 5 จังหวัด</text>' +
      '<text class="nm-s" x="24" y="58">ขอนแก่น • ชัยภูมิ • นครราชสีมา • บุรีรัมย์ • สุรินทร์ | ข้อมูล ณ ' + day.th + '</text>' +
      '<g transform="translate(0 ' + top + ')">' + d.body + '</g>' +
      check(32, y) + '<text class="nm-g" x="48" y="' + (y + 5) + '">ชนะประมูล ' + d.won + ' ไซด์' + unitsText(d.units) + '</text>' +
      pin(32, y + 37) + '<text class="nm-g" x="48" y="' + (y + 33) + '">รอประมูล / รอผล ' + d.wait + ' ไซด์</text>' +
      cross(292, y + 28) + '<text class="nm-g" x="308" y="' + (y + 33) + '">ไม่ชนะ ' + d.lost + ' ไซด์</text>' +
      '<text class="nm-n" x="24" y="' + (y + 58) + '">✓ ในอำเภอข้างเคียง = อำเภอในเขตของสาขาที่ชนะ (ตามแผนที่เดิม) • ขอบเขตอำเภอ: OpenGISData-Thailand (CC BY 4.0)</text></svg>';
    // ASCII file name: some browsers drop a Thai download name and save the file as "download"
    return { svg: svg, W: W, H: H, name: 'notice-bid-map-' + day.iso + '.png' };
  }
  function download(rows, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังสร้างรูป…'; }
    var done = function () { if (btn) { btn.disabled = false; btn.textContent = '⬇ ดาวน์โหลดแผนที่ (PNG)'; } };
    return fontCss().then(function (font) {
      var p = pictureSvg(rows, font); if (!p) throw new Error('ไม่มีข้อมูลแผนที่');
      return new Promise(function (ok, fail) {
        var img = new Image(), url = URL.createObjectURL(new Blob([p.svg], { type: 'image/svg+xml;charset=utf-8' }));
        img.onload = function () {
          var k = 3, c = document.createElement('canvas'); c.width = p.W * k; c.height = p.H * k;
          var x = c.getContext('2d'); x.scale(k, k); x.drawImage(img, 0, 0, p.W, p.H); URL.revokeObjectURL(url);
          c.toBlob(function (b) {
            if (!b) { fail(new Error('สร้างรูปไม่สำเร็จ')); return; }
            var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = p.name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000); ok(p.name);
          }, 'image/png');
        };
        img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('วาดแผนที่ไม่สำเร็จ')); };
        img.src = url;
      });
    }).then(function (n) { done(); return n; }, function (e) { done(); alert('ดาวน์โหลดแผนที่ไม่สำเร็จ: ' + (e.message || e)); });
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-nm="dl"]');
    if (b && lastRows) download(lastRows, b);
  });

  function style() {
    if (typeof document === 'undefined' || document.getElementById('nmStyle')) return;
    var s = document.createElement('style'); s.id = 'nmStyle';
    s.textContent = '.nm-wrap{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:10px;margin-bottom:14px}' +
      '.nm-scroll{overflow:auto;-webkit-overflow-scrolling:touch}.nm-svg{display:block;width:100%;min-width:760px;height:auto}' +
      '.nm-d{stroke:#8f8f8f;stroke-width:.6}.nm-d:hover{filter:brightness(.95)}.nm-wo{fill:none;stroke:#d62828;stroke-width:1.6;pointer-events:none}' +
      '.nm-l{font-size:10.5px;font-weight:700;fill:#222;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;pointer-events:none}' +
      '.nm-p{font-size:30px;font-weight:800;fill:#4b2378;opacity:.15;text-anchor:middle;dominant-baseline:middle;pointer-events:none}' +
      '.nm-ck{fill:none;stroke:#14852b;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}' +
      '.nm-x{fill:none;stroke:#9a9a9a;stroke-width:2.6;stroke-linecap:round;pointer-events:none}' +
      '.nm-pin{pointer-events:none}.nm-pin path{fill:#f2581c;stroke:#f6c84c;stroke-width:1.6}.nm-pin circle{fill:#fff}' +
      '.nm-legend{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;margin-top:8px;font-size:13px;color:#3b2252}.nm-legend span{display:inline-flex;align-items:center;gap:6px;font-weight:700}' +
      '.nm-top{display:flex;justify-content:flex-end;margin-bottom:6px}.nm-dl{border:0;border-radius:9px;padding:8px 13px;font:inherit;font-weight:800;cursor:pointer;background:#4b2378;color:#fff}.nm-dl:disabled{opacity:.5}' +
      '.nm-legend svg{width:18px;height:18px}.nm-legend small{flex-basis:100%;color:#776a86}.nm-empty{padding:16px;color:#776a86}';
    document.head.appendChild(s);
  }

  window.NoticeMap = { html: function (rows) { style(); return html(rows); }, download: download, pictureSvg: pictureSvg, districtsOf: districtsOf, marks: marks, state: state, COVER: COVER };
})();

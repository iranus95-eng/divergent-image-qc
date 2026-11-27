/* แผนที่ตารางประมูลแจ้งเตือน (2026-11-02; 12 จังหวัด from 2026-11-26)
 * The district map of the 12 provinces (ขอนแก่น ชัยภูมิ นครราชสีมา บุรีรัมย์ สุรินทร์ กาฬสินธุ์ มหาสารคาม ร้อยเอ็ด ยโสธร อำนาจเจริญ
 * ศรีสะเกษ อุบลราชธานี), drawn from the rows of ตารางประมูลแจ้งเตือน, in the look of the user's map of 21 พ.ย. 69
 * (each province its own colour and name badge, a won district keeps its colour with a red outline),
 * so it follows the table every time a result changes:
 *  - 🏆 gold   : a site we won (status "ชนะประมูล"), plus the districts its office also serves (COVER, from the map we used before)
 *  - 📍 orange : only the sites picked with their "📍 เป้าหมาย" buttons (several at once) in the site list (NoticeMap.setFocus); the other sites
 *                 still waiting for their auction or result are not marked (user, 3 พ.ย. 69), only named in the tooltip
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
  // offices staff confirmed belong to a site, ticked with it when won even if its quotation does not name them
  // (พลับพลาชัย is part of ประโคนชัย: LINE ใบแจ้งเตือน, 2 พ.ย. 69; นาโพธิ์ and บ้านใหม่ไชยพจน์ are part of พุทไธสง, ชุมพลบุรี of ท่าตูม, แคนดง of สตึก: user, 3 พ.ย. 69)
  var ALSO = {
    // ละหานทราย, โนนดินแดง and เฉลิมพระเกียรติ are worked together with ประโคนชัย and นางรอง (user, 3 พ.ย. 69): ticked with either
    'บุรีรัมย์/ประโคนชัย': ['บุรีรัมย์/พลับพลาชัย', 'บุรีรัมย์/ละหานทราย', 'บุรีรัมย์/โนนดินแดง', 'บุรีรัมย์/เฉลิมพระเกียรติ'],
    'บุรีรัมย์/นางรอง': ['บุรีรัมย์/ละหานทราย', 'บุรีรัมย์/โนนดินแดง', 'บุรีรัมย์/เฉลิมพระเกียรติ', 'บุรีรัมย์/ชำนิ'],   // ชำนิ: part of นางรอง (user, 3 พ.ย. 69)
    'บุรีรัมย์/พุทไธสง': ['บุรีรัมย์/นาโพธิ์', 'บุรีรัมย์/บ้านใหม่ไชยพจน์'],
    'สุรินทร์/ท่าตูม': ['สุรินทร์/ชุมพลบุรี'],
    'บุรีรัมย์/สตึก': ['บุรีรัมย์/แคนดง'],
    'นครราชสีมา/พิมาย': ['นครราชสีมา/ห้วยแถลง'],   // ห้วยแถลง goes with พิมาย (user, 9 พ.ย. 69)
    // one job: บัวใหญ่ with บัวลาย, สีดา and แก้งสนามนาง (user, 10 พ.ย. 69)
    'นครราชสีมา/บัวใหญ่': ['นครราชสีมา/บัวลาย', 'นครราชสีมา/สีดา', 'นครราชสีมา/แก้งสนามนาง']
  };
  // a site named after a tambon, not a district
  var ALIAS = { 'จอหอ': 'เมืองนครราชสีมา', 'หมูสี': 'ปากช่อง' };
  // [district fill, name badge] of each province, as the map of 21 พ.ย. 69 has them
  var COLOR = {
    'ขอนแก่น': ['#d8e8f8', '#235b96'], 'ชัยภูมิ': ['#ddebd3', '#46733a'], 'นครราชสีมา': ['#f9e4c5', '#a66420'],
    'บุรีรัมย์': ['#d5ebe8', '#167c78'], 'สุรินทร์': ['#e6ddf5', '#694a97'], 'กาฬสินธุ์': ['#f6dce5', '#b8456a'],
    'มหาสารคาม': ['#f5e9b9', '#8e7514'], 'ร้อยเอ็ด': ['#e1def8', '#5362a7'], 'ยโสธร': ['#f6d8bd', '#b65c36'],
    'อำนาจเจริญ': ['#d8ecbb', '#537e16'], 'ศรีสะเกษ': ['#c9e8f2', '#176782'], 'อุบลราชธานี': ['#f0d6e9', '#934476']
  };
  function fill(p) { return (COLOR[p] || ['#fff'])[0]; }
  function provinces() { var D = window.NOTICE_MAP_DATA; return D && D.provinces || []; }
  // the province names in a rounded badge of its colour; the width counts only the letters that take room (not ั ิ ่ ้ …)
  function badgeW(p) { return Math.round(String(p).replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').length * 10.2 + 18); }
  function inside(q, d) {
    if (q[0] < d.bb[0] || q[0] > d.bb[2] || q[1] < d.bb[1] || q[1] > d.bb[3]) return false;
    var c = false, rings = d.rings;
    rings.forEach(function (r) {
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        if ((r[i][1] > q[1]) !== (r[j][1] > q[1]) && q[0] < (r[j][0] - r[i][0]) * (q[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
      }
    });
    return c;
  }
  function overlap(a, b) { return Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])); }
  // where each province's name badge goes: near the middle of the province, inside it, never over a 🏆 / ✕ / 📍
  // (user, 27 พ.ย. 69: "ชื่อจังหวัดบังถ้วยรางวัล"), as little as it can over district names and the other badges
  var spotCache = {};
  function placeBadges(g, signs, names) {
    var ck = signs.map(function (b) { return b.join(','); }).join(';');
    if (spotCache[ck]) return spotCache[ck];
    var placed = [], out = {};
    // the spots a badge fits inside its province do not change with the marks: found once (g.spots)
    if (!g.spots) {
      g.spots = {};
      Object.keys(g.prov).forEach(function (p) {
        var a = g.prov[p], cx = a.x / a.n, cy = a.y / a.n, w = badgeW(p), list = g.spots[p] = [];
        var mine = g.list.filter(function (d) { return d.p === p; });
        for (var dy = -120; dy <= 120; dy += 8) for (var dx = -160; dx <= 160; dx += 10) {
          var x = cx + dx, y = cy + dy, box = [x - w / 2 - 3, y - 16, x + w / 2 + 3, y + 16];
          if ([[x, y], [box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].every(function (q) { return mine.some(function (d) { return inside(q, d); }); }))
            list.push({ x: x, y: y, box: box, far: (dx * dx + dy * dy) * 0.08 });
        }
      });
    }
    Object.keys(g.prov).forEach(function (p) {
      var a = g.prov[p], cx = a.x / a.n, cy = a.y / a.n, w = badgeW(p), best = null;
      g.spots[p].forEach(function (c) {
        var box = c.box, hit = 0, near = 0;
        signs.forEach(function (b) { hit += overlap(box, b); });
        placed.forEach(function (b) { hit += overlap(box, b); });
        names.forEach(function (b) { near += overlap(box, b); });
        var score = hit * 100 + near + c.far;
        if (!best || score < best.s) best = { s: score, x: c.x, y: c.y, box: box };
      });
      if (!best) best = { x: cx, y: cy, box: [cx - w / 2, cy - 13, cx + w / 2, cy + 13] };
      placed.push(best.box); out[p] = [Math.round(best.x), Math.round(best.y)];
    });
    return (spotCache = {})[ck] = out;
  }
  function badge(p, x, y) {
    var w = badgeW(p);
    return '<g class="nm-pb"><rect x="' + (x - w / 2) + '" y="' + (y - 13) + '" width="' + w + '" height="26" rx="5" fill="' + ((COLOR[p] || [])[1] || '#4b2378') + '"/>' +
      '<text x="' + x + '" y="' + (y + 1) + '">' + esc(p) + '</text></g>';
  }
  var W = 1000;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(r) { var t = String(r.status || ''); return t.indexOf('ชนะ') >= 0 && !lost(r); }
  function lost(r) { return /ไม่ชนะ|แพ้/.test(String(r.status || '')); }
  // ยกเลิก holds only until the site is announced again: an auction day still to come shows it as waiting (พิมาย)
  function cancelled(r) {
    if (String(r.status || '').indexOf('ยกเลิก') < 0) return false;
    var today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // Bangkok calendar day
    return !(r.bid_date && String(r.bid_date).slice(0, 10) >= today);
  }
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
      d.rings = d.g.map(function (r) { return r.map(pt); });
      d.bb = [1e9, 1e9, -1e9, -1e9];
      d.rings.forEach(function (r) { r.forEach(function (q) { d.bb[0] = Math.min(d.bb[0], q[0]); d.bb[1] = Math.min(d.bb[1], q[1]); d.bb[2] = Math.max(d.bb[2], q[0]); d.bb[3] = Math.max(d.bb[3], q[1]); }); });
      d.path = d.rings.map(function (r) { return 'M' + r.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z'; }).join('');
      d.xy = pt(d.c); d.key = key(d);
      (byName[d.n] = byName[d.n] || []).push(d); byKey[d.key] = d;
    });
    // tambons drawn inside their district (หมูสี in ปากช่อง): same marks as the district, a dashed edge and their own name
    var tams = (D.tambons || []).filter(function (t) { return byKey[t.p + '/' + t.a]; });
    tams.forEach(function (t) {
      t.path = t.g.map(function (r) { return 'M' + r.map(function (p) { var q = pt(p); return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z'; }).join('');
      t.xy = pt(t.c); t.d = byKey[t.p + '/' + t.a];
      (t.d.tams = t.d.tams || []).push(t.n);
    });
    var prov = {};
    D.districts.forEach(function (d) { var a = prov[d.p] = prov[d.p] || { x: 0, y: 0, n: 0 }; a.x += d.xy[0]; a.y += d.xy[1]; a.n++; });
    geo = { list: D.districts, tams: tams, byName: byName, byKey: byKey, prov: prov, H: Math.ceil(pad * 2 + (maxY - minY) * k) };
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

  // ---------------------------------------------------------------- sub-branches named in our quotation
  // "กฟส.นําพอง", "กฟย.ภูผาม่าน", "กฟฟ.เขาสวนกวาง": the offices a quotation covers, read from its PDF text by js/notice-bids.js.
  // PDF fonts drop, reorder or replace tone marks (นําพอง for น้ำพอง, "É"/"Ê" in place of ่/้) and pdf.js cuts words into pieces,
  // so each name is taken as the Thai letters after "กฟ?." with everything else dropped, then compared without marks.
  function bare(s) { return String(s || '').replace(/\u0E4D\u0E32/g, '\u0E33').replace(/\u0E33/g, '\u0E32').replace(/[^\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46]/g, ''); }
  function branchNames(text) {
    var out = [], re = /กฟ[สยฟจอ]\s*\./g, t = String(text || ''), m;
    while ((m = re.exec(t))) {
      var n = bare(t.slice(m.index + m[0].length, m.index + m[0].length + 40)).slice(0, 20);
      if (n.length >= 2 && out.indexOf(n) < 0) out.push(n);
    }
    return out;
  }
  // the districts those names start with (the longest: พลับพลาชัย, not พล); a name found in two provinces
  // (เฉลิมพระเกียรติ) goes to the province of the site
  function districtsOfNames(names, prov) {
    var g = data(); if (!g) return [];
    if (!g.bare) {
      g.bare = g.list.map(function (d) { return { b: bare(d.n), d: d }; });
      Object.keys(ALIAS).forEach(function (k) { (g.byName[ALIAS[k]] || []).forEach(function (d) { g.bare.push({ b: bare(k), d: d }); }); });
    }
    var out = [];
    (names || []).forEach(function (n) {
      var b = bare(n), best = 0, hit = [];
      [b, bare('เมือง') + b].forEach(function (s) {
        g.bare.forEach(function (x) {
          if (x.b.length < 2 || s.indexOf(x.b) !== 0) return;
          if (x.b.length > best) { best = x.b.length; hit = [x.d]; } else if (x.b.length === best && hit.indexOf(x.d) < 0) hit.push(x.d);
        });
      });
      if (hit.length > 1 && prov) hit = hit.filter(function (d) { return d.p === prov; });
      hit.forEach(function (d) { if (out.indexOf(d) < 0) out.push(d); });
    });
    return out;
  }
  var QTY = null;      // row → ราย/ปี (NoticeMap.setQty), from the site's quotation when it has one
  var BRANCHES = {};   // row id → sub-branch names from the site's quotation (NoticeMap.setBranches)
  var FOCUS = [];      // ids of the waiting sites picked with "📍 เป้าหมาย" in the list (NoticeMap.setFocus): the only ones pinned

  // district key → { won: [sites], wait: [sites], lost: [sites], cover: [sites] }
  function marks(rows) {
    var g = data(), m = {}, off = [];
    var add = function (d, kind, site) { var e = m[d.key] = m[d.key] || { won: [], wait: [], lost: [], cover: [] }; if (e[kind].indexOf(site) < 0) e[kind].push(site); };
    (rows || []).forEach(function (r) {
      if (cancelled(r)) return;
      var ds = districtsOf(r), site = r.site || '';
      if (!ds.length) { off.push(r); return; }
      var kind = won(r) ? 'won' : lost(r) ? 'lost' : 'wait';
      ds.forEach(function (d) { add(d, kind, site); });
      if (kind !== 'won') return;
      // a won site's other offices: the sub-branches in its quotation, else the districts the old map showed (COVER)
      var sub = districtsOfNames(BRANCHES[r.id], ds[0].p).filter(function (d) { return ds.indexOf(d) < 0; });
      if (sub.length) sub.forEach(function (d) { add(d, 'cover', site); });
      else ds.forEach(function (d) { (COVER[d.key] || []).forEach(function (k) { if (g.byKey[k]) add(g.byKey[k], 'cover', site); }); });
      ds.forEach(function (d) { (ALSO[d.key] || []).forEach(function (k) { if (g.byKey[k]) add(g.byKey[k], 'cover', site); }); });
    });
    return { m: m, off: off };
  }
  function state(e) { return !e ? '' : e.won.length || e.cover.length ? 'won' : e.wait.length ? 'wait' : e.lost.length ? 'lost' : ''; }

  // a won site: a gold trophy drawn as shapes (an emoji would not show in the PNG download on every computer) (user, 6 พ.ย. 69)
  function check(x, y) {
    return '<g class="nm-ck" transform="translate(' + x + ' ' + y + ')">' +
      '<path class="h" d="M-5.5-6.5h-3.2a3.6 3.6 0 0 0 4.4 5.6M5.5-6.5h3.2a3.6 3.6 0 0 1-4.4 5.6"/>' +
      '<path d="M-6-8.5h12v3.2a6 6 0 0 1-12 0z"/><path d="M-1.6 2.6h3.2v3h-3.2z"/><path d="M-5.2 5.6h10.4v3.2h-10.4z"/></g>';
  }
  function cross(x, y) { return '<path class="nm-x" d="M' + (x - 5) + ' ' + (y - 5) + 'l10 10M' + (x + 5) + ' ' + (y - 5) + 'l-10 10"/>'; }
  function pin(x, y) {
    return '<g class="nm-pin" transform="translate(' + x + ' ' + y + ')"><path d="M0 0c-2-6-8-9-8-15a8 8 0 0 1 16 0c0 6-6 9-8 15z"/><circle cx="0" cy="-15" r="3.2"/></g>';
  }

  // the map itself (shapes, outlines, names, marks) and the counts of the legend
  function draw(rows) {
    var g = data(); if (!g) return null;
    var mk = marks(rows), m = mk.m;
    var focus = {}, aim = [];
    (rows || []).forEach(function (r) {
      if (FOCUS.indexOf(r.id) < 0 || cancelled(r) || won(r) || lost(r)) return;
      var ds = districtsOf(r); if (ds.length) aim.push(r.site || '');
      ds.forEach(function (d) { focus[d.key] = 1; });
    });
    var shapes = '', labels = '', signs = '', signBox = [], nameBox = [];
    g.list.forEach(function (d) {
      var e = m[d.key], s = state(e), x = Math.round(d.xy[0]), y = Math.round(d.xy[1]);
      var tip = d.n + ' (' + d.p + ')' + (d.tams ? '\nรวม ' + d.tams.map(function (n) { return 'ต.' + n; }).join(', ') : '') + (e ? [['won', '🏆 ชนะประมูล'], ['cover', '🏆 สาขาย่อยของ'], ['wait', '📍 รอประมูล/รอผล'], ['lost', '✕ ไม่ชนะ']]
        .filter(function (k) { return e[k[0]].length; }).map(function (k) { return '\n' + k[1] + ': ' + e[k[0]].join(', '); }).join('') : '');
      shapes += '<path class="nm-d' + (s === 'won' ? ' won' : '') + '" fill="' + fill(d.p) + '" d="' + d.path + '"><title>' + esc(tip) + '</title></path>';
      labels += '<text class="nm-l" x="' + x + '" y="' + y + '">' + esc(d.n) + '</text>';
      var lw = d.n.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').length * 5.6;
      nameBox.push([x - lw / 2, y - 7, x + lw / 2, y + 7]);
      if (s === 'won') { signs += check(x, y + 13); signBox.push([x - 10, y + 3, x + 10, y + 23]); }
      else if (s === 'wait' && focus[d.key]) { signs += pin(x, y - 9); signBox.push([x - 9, y - 33, x + 9, y - 9]); }
      else if (s === 'lost') { signs += cross(x, y + 12); signBox.push([x - 7, y + 5, x + 7, y + 19]); }
    });
    g.tams.forEach(function (t) {
      var e = m[t.d.key], s = state(e);
      shapes += '<path class="nm-tb' + (s === 'won' ? ' won' : '') + '" fill="' + fill(t.p) + '" d="' + t.path + '"><title>' +
        esc('ต.' + t.n + ' (อ.' + t.a + ' ' + t.p + ')' + (e ? ' — ' + ['won', 'cover', 'wait', 'lost'].map(function (k) { return e[k].join(', '); }).filter(Boolean).join(', ') : '')) + '</title></path>';
      labels += '<text class="nm-tl" x="' + Math.round(t.xy[0]) + '" y="' + Math.round(t.xy[1]) + '">ต.' + esc(t.n) + '</text>';
    });
    // won districts drawn again on top, so their red outline is not hidden under the neighbours' grey edges
    var tops = g.list.filter(function (d) { return state(m[d.key]) === 'won'; }).map(function (d) { return '<path class="nm-wo" d="' + d.path + '"/>'; }).join('');
    var spot = placeBadges(g, signBox, nameBox);
    var prov = Object.keys(g.prov).map(function (p) { return badge(p, spot[p][0], spot[p][1]); }).join('');
    // ราย/ปี of every site we won (also one off the map), the same sum as the 🏆 button: the quotation's จำนวนราย
    // (set by the bid table with setQty), else จำนวนราย, else วงเงิน ÷ 1.07 ÷ ราคากลาง
    var units = (rows || []).filter(won).reduce(function (t, r) {
      var q = (QTY && QTY(r)) || Number(r.qty) || (r.budget && r.mid_price ? Math.round(r.budget / 1.07 / r.mid_price) : 0);
      return t + (q || 0);
    }, 0);
    var count = function (f) { return (rows || []).filter(function (r) { return !cancelled(r) && f(r) && districtsOf(r).length; }).length; };
    return {
      body: shapes + tops + '<g>' + labels + '</g>' + signs + '<g class="nm-prov">' + prov + '</g>', H: g.H, off: mk.off.length,
      won: count(won), units: units, aim: aim, lost: count(lost), wait: count(function (r) { return !won(r) && !lost(r); })
    };
  }

  function short(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function n0(v) { return Math.round(v).toLocaleString('en-US'); }
  // per month, like the 🏆 button (units is ราย/ปี)
  function unitsText(u) { return u ? ' • ' + n0(u / 12) + ' ราย/เดือน' : ''; }
  var lastRows = null;
  function html(rows) {
    var d = draw(rows);
    if (!d) return '<div class="nm-empty">โหลดข้อมูลแผนที่ไม่สำเร็จ</div>';
    lastRows = rows;
    return '<div class="nm-wrap"><div class="nm-top"><button type="button" class="nm-dl" data-nm="dl" title="บันทึกแผนที่ตามสถานะตอนนี้เป็นรูป PNG">⬇ ดาวน์โหลดแผนที่ (PNG)</button></div>' +
      '<div class="nm-scroll"><svg class="nm-svg" viewBox="0 0 ' + W + ' ' + d.H + '" role="img" aria-label="แผนที่ไซด์ประมูล ' + provinces().length + ' จังหวัด">' + d.body + '</svg></div>' +
      '<div class="nm-legend"><span><svg viewBox="-10 -10 20 20">' + check(0, 1) + '</svg> ชนะประมูล ' + d.won + ' ไซด์' + unitsText(d.units) + '</span>' +
      '<span>รอประมูล / รอผล ' + d.wait + ' ไซด์</span>' +
      (d.aim.length ? '<span><svg viewBox="-10 -24 20 26">' + pin(0, 0) + '</svg> เป้าหมาย ' + d.aim.length + ' ไซด์: ' + esc(d.aim.join(', ')) +
        ' <button type="button" class="nm-clr" data-nb="aimclear" title="เอาหมุดเป้าหมายออกทั้งหมด">ล้าง</button></span>' : '') +
      '<span><svg viewBox="-10 -10 20 20">' + cross(0, 0) + '</svg> ไม่ชนะ ' + d.lost + ' ไซด์</span>' +
      '<small>อัปเดตตามตารางทุกครั้งที่สถานะเปลี่ยน • กด 📍 เป้าหมาย ที่ไซด์รอประมูลในรายการเพื่อปักหมุดบนแผนที่ (เลือกได้หลายไซด์) • 🏆 ในอำเภอข้างเคียง = สาขาย่อยของไซด์ที่ชนะ (จากใบเสนอราคา) • ชี้หรือแตะอำเภอเพื่อดูไซด์' +
      (d.off ? ' • ไซด์นอก ' + provinces().length + ' จังหวัดนี้ ' + d.off + ' ไซด์ไม่อยู่บนแผนที่' : '') +
      ' • ขอบเขตอำเภอ: OpenGISData-Thailand (CC BY 4.0)</small></div></div>';
  }

  // ---------------------------------------------------------------- download: the map as it is now, with a title and the legend, as a PNG
  var MAP_CSS = '.nm-d{stroke:#8f8f8f;stroke-width:.6}.nm-tb{stroke:#8f8f8f;stroke-width:.6;stroke-dasharray:3 2}.nm-tl{font-size:9px;font-weight:700;fill:#555;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fff;stroke-width:2.5px;stroke-linejoin:round}.nm-wo{fill:none;stroke:#d62828;stroke-width:1.6}' +
    '.nm-l{font-size:10.5px;font-weight:700;fill:#222;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}' +
    '.nm-pb text{font-size:17px;font-weight:800;fill:#fff;text-anchor:middle;dominant-baseline:middle}.nm-pb rect{stroke:#fff;stroke-width:1.5}' +
    '.nm-ck path{fill:#f5b800;stroke:#9a6a00;stroke-width:1.1;stroke-linejoin:round}.nm-ck .h{fill:none;stroke:#c98f00;stroke-width:1.8}' +
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
    var day = thaiToday(), top = 86, foot = 98, H = top + d.H + foot, y = top + d.H + 30;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<style>' + font + 'text{font-family:NmSarabun,Sarabun,Tahoma,sans-serif}' + MAP_CSS +
      '.nm-t{font-size:24px;font-weight:800;fill:#222}.nm-s{font-size:13px;fill:#555}.nm-g{font-size:15px;font-weight:700;fill:#222}.nm-n{font-size:11px;fill:#777}</style>' +
      '<rect width="100%" height="100%" fill="#fff"/>' +
      '<text class="nm-t" x="24" y="36">แผนที่ไซด์ประมูลแจ้งเตือน ' + provinces().length + ' จังหวัด</text>' +
      '<text class="nm-s" x="24" y="58">' + esc(provinces().join(' • ')) + '</text>' +
      '<text class="nm-s" x="24" y="76">ข้อมูลผลประมูล ณ ' + day.th + '</text>' +
      '<g transform="translate(0 ' + top + ')">' + d.body + '</g>' +
      check(32, y) + '<text class="nm-g" x="48" y="' + (y + 5) + '">ชนะประมูล ' + d.won + ' ไซด์' + unitsText(d.units) + '</text>' +
      '<text class="nm-g" x="24" y="' + (y + 33) + '">รอประมูล / รอผล ' + d.wait + ' ไซด์</text>' +
      (d.aim.length ? pin(522, y + 37) + '<text class="nm-g" x="538" y="' + (y + 33) + '">เป้าหมาย ' + d.aim.length + ' ไซด์: ' + esc(short(d.aim.join(', '), 44)) + '</text>' : '') +
      cross(292, y + 28) + '<text class="nm-g" x="308" y="' + (y + 33) + '">ไม่ชนะ ' + d.lost + ' ไซด์</text>' +
      '<text class="nm-n" x="24" y="' + (y + 58) + '">🏆 ในอำเภอข้างเคียง = สาขาย่อยของไซด์ที่ชนะ (จากใบเสนอราคา) • ขอบเขตอำเภอ: OpenGISData-Thailand (CC BY 4.0)</text></svg>';
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
      '.nm-scroll{overflow:auto;-webkit-overflow-scrolling:touch}.nm-svg{display:block;width:100%;min-width:900px;height:auto}' +
      '.nm-d{stroke:#8f8f8f;stroke-width:.6}.nm-d:hover,.nm-tb:hover{filter:brightness(.95)}.nm-tb{stroke:#8f8f8f;stroke-width:.6;stroke-dasharray:3 2}.nm-tl{font-size:9px;font-weight:700;fill:#555;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fff;stroke-width:2.5px;stroke-linejoin:round;pointer-events:none}.nm-wo{fill:none;stroke:#d62828;stroke-width:1.6;pointer-events:none}' +
      '.nm-l{font-size:10.5px;font-weight:700;fill:#222;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;pointer-events:none}' +
      '.nm-pb{pointer-events:none}.nm-pb text{font-size:17px;font-weight:800;fill:#fff;text-anchor:middle;dominant-baseline:middle}.nm-pb rect{stroke:#fff;stroke-width:1.5}' +
      '.nm-ck path{fill:#f5b800;stroke:#9a6a00;stroke-width:1.1;stroke-linejoin:round;pointer-events:none}.nm-ck .h{fill:none;stroke:#c98f00;stroke-width:1.8}' +
      '.nm-x{fill:none;stroke:#9a9a9a;stroke-width:2.6;stroke-linecap:round;pointer-events:none}' +
      '.nm-pin{pointer-events:none}.nm-pin path{fill:#f2581c;stroke:#f6c84c;stroke-width:1.6}.nm-pin circle{fill:#fff}' +
      '.nm-legend{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;margin-top:8px;font-size:13px;color:#3b2252}.nm-legend span{display:inline-flex;align-items:center;gap:6px;font-weight:700}' +
      '.nm-top{display:flex;justify-content:flex-end;margin-bottom:6px}.nm-dl{border:0;border-radius:9px;padding:8px 13px;font:inherit;font-weight:800;cursor:pointer;background:#4b2378;color:#fff}.nm-dl:disabled{opacity:.5}' +
      '.nm-legend svg{width:18px;height:18px}.nm-legend small{flex-basis:100%;color:#776a86}.nm-clr{border:1px solid #e5dced;border-radius:8px;background:#fff;color:#5a2787;font:inherit;font-size:12px;font-weight:700;padding:1px 8px;cursor:pointer}.nm-empty{padding:16px;color:#776a86}';
    document.head.appendChild(s);
  }

  window.NoticeMap = { html: function (rows) { style(); return html(rows); }, setBranches: function (b) { BRANCHES = b || {}; }, setQty: function (f) { QTY = typeof f === 'function' ? f : null; }, setFocus: function (ids) { FOCUS = ids == null ? [] : [].concat(ids); }, branchNames: branchNames, districtsOfNames: districtsOfNames, download: download, pictureSvg: pictureSvg, districtsOf: districtsOf, marks: marks, state: state, COVER: COVER, ALSO: ALSO };
})();

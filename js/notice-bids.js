/* ตารางประมูลแจ้งเตือน (2026-10-26)
 * One table of the PEA notice-delivery jobs of the year (the old "70" sheet of ประมูลงานแจ้งเตือน70.xlsx).
 *  - Upload the office's two PDFs, the announcement (ประกาศ…ประกวดราคา) and the TOR (รายละเอียดประกอบใบเสนอราคา):
 *    pdf.js reads their text and fills เขต, ไซด์งาน, วงเงิน, จำนวนราย, วันที่/เวลาเสนอราคา, วิธี, เลขที่เอกสาร.
 *  - เลขที่โครงการ and ราคากลาง are typed (pre-filled when the file name / TOR gives them), like every other cell.
 *  - The menu lists the sites by name; clicking one opens all of its fields (editable, saved automatically).
 *  - Rows live in Supabase (notice_bids) through the edge function notice-bid-api; admin only, like เสนอราคาแจ้งเตือน.
 */
(function () {
  'use strict';
  if (window.__noticeBids) return;
  window.__noticeBids = true;

  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api';
  var QUOTE_API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/quote-notice-api';   // เสนอราคาแจ้งเตือน jobs are named after these sites
  var VAT = 0.07;
  var st = { rows: null, err: '', busy: '', pending: [], zone: '', q: '', wonOnly: false, map: false, aim: loadAim(), open: null, quotes: null };   // aim: ids of the waiting sites pinned on the map (📍 เป้าหมาย), kept in this browser   // quotes: saved เสนอราคาแจ้งเตือน jobs   // open: id of the site whose details are shown

  // the sites picked with 📍 เป้าหมาย, remembered in this browser only (a convenience, not shared data)
  function loadAim() { try { var a = JSON.parse(localStorage.getItem('nb_aim_v1') || '[]'); return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'number'; }) : []; } catch (_) { return []; } }
  function saveAim() { try { localStorage.setItem('nb_aim_v1', JSON.stringify(st.aim)); } catch (_) {} }

  // ---------------------------------------------------------------- server
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
  async function load() {
    try { var j = await call({ action: 'list' }); st.rows = j.items || []; st.err = ''; }
    catch (e) { st.rows = []; st.err = e.message || String(e); }
    render();
  }

  // today's auctions, the same summary pg_cron pushes on auction days, sent now to the admin set in notice-bid-api (ALERT_USERNAMES)
  var LINE_ERR = { NO_ADMIN_LINKED_LINE: 'แอดมินผู้รับยังไม่ได้ผูก LINE', LINE_CHANNEL_ACCESS_TOKEN_MISSING: 'ยังไม่ได้ตั้งค่า LINE OA', LINE_PUSH_FAILED: 'LINE ไม่รับข้อความ (โควตาเต็มหรือแอดมินบล็อก OA)' };
  async function sendLine(b) {
    if (!confirm('ส่งไซด์ที่เคาะราคาวันนี้เข้า LINE แอดมินตอนนี้?')) return;
    b.disabled = true;
    try {
      var j = await call({ action: 'line_alert' });
      alert(j.ok ? 'ส่งเข้า LINE แอดมินแล้ว ' + j.sent + ' คน' : 'ส่งไม่สำเร็จ: ' + (LINE_ERR[j.reason] || j.reason));
    } catch (e) { alert('ส่งไม่สำเร็จ: ' + (e.message || e)); }
    finally { b.disabled = false; }
  }

  // the saved quotations (เสนอราคาแจ้งเตือน), shown on each site; refreshed every time the page opens
  async function loadQuotes() {
    try {
      var qs = (await call({ action: 'list' }, QUOTE_API)).items || [];
      // the unit prices typed in each priced job (the list leaves the rows out, so open those jobs)
      await Promise.all(qs.filter(function (h) { return Number(h.total_amount) > 0; }).map(function (h) {
        return call({ action: 'get', id: h.id }, QUOTE_API).then(function (j) {
          var ps = [];
          var rs = (j.item && j.item.state && j.item.state.rows) || [];
          rs.forEach(function (r) { var v = Number(r.price); if (v > 0 && ps.indexOf(v) < 0) ps.push(v); });
          h.prices = ps;
          // ราย the quotation was priced on: the typed quantities, else total ÷ 1.07 ÷ price when every row has the same price
          // (the same reading as หน้าคำนวนต้นทุน, cost-calculator/src/cloud.ts)
          var typed = rs.map(function (r) { return Number(r.qty); }), t = Number(h.total_amount) || 0;
          var q = rs.length && typed.every(function (v) { return v > 0; }) ? typed.reduce(function (a, v) { return a + v; }, 0)
            : rs.length && ps.length === 1 && rs.every(function (r) { return Number(r.price) === ps[0]; }) ? Math.round(t / (1 + VAT) / ps[0]) : 0;
          if (q > 0) h.qty = q;
          if (j.item && j.item.pdf_b64) h.pdf = j.item.pdf_b64;   // read again for the sub-branches it names (map)
        }, function (e) { console.warn('notice-bids quote', h.id, e); });
      }));
      st.quotes = qs;
    } catch (e) { console.warn('notice-bids quotes', e); st.quotes = []; }
    if (st.rows) {
      syncPrices(); renderTable();
      var wb = document.querySelector('[data-nb="won"]'); if (wb) wb.textContent = '🏆 ชนะประมูล ' + wonSummary();   // units now from the quotations
    }
    if (st.map) syncBranches();
  }
  // the map ticks the sub-branches of a won site: "กฟส./กฟย./กฟฟ.…" named in the text of its quotation PDF (js/notice-map.js)
  async function quoteBranches(h) {
    if (h.branches) return h.branches;
    if (!h.pdf || !window.NoticeMap) return [];
    var lib = await loadPdfJs(), bin = atob(h.pdf), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var pdf = await lib.getDocument({ data: bytes }).promise, text = '';
    for (var n = 1; n <= Math.min(pdf.numPages, 8); n++) text += (await (await pdf.getPage(n)).getTextContent()).items.map(function (x) { return x.str; }).join('') + '\n';
    h.branches = window.NoticeMap.branchNames((h.title || '') + '\n' + thaiText(text));   // the job title can name them too (นางรอง / ปะคำ)
    return h.branches;
  }
  var branchesBusy = false;
  async function syncBranches() {
    if (branchesBusy || !st.quotes || !st.rows || !window.NoticeMap) return;
    branchesBusy = true;
    try {
      var map = {};
      for (var r of st.rows.filter(won)) {
        var names = [];
        for (var h of quotesOf(r)) {
          try { (await quoteBranches(h)).forEach(function (x) { if (names.indexOf(x) < 0) names.push(x); }); }
          catch (e) { console.warn('notice-bids branches', h.id, e); h.branches = []; }
        }
        if (names.length) map[r.id] = names;
      }
      var key = JSON.stringify(map);
      if (key !== st.branchKey) { st.branchKey = key; window.NoticeMap.setBranches(map); drawMap(); }
    } finally { branchesBusy = false; }
  }
  // ราคาปี70 follows the unit price in the site's quotation (the first one when the rows differ)
  function syncPrices() {
    (st.rows || []).forEach(function (r) {
      // a site we lost keeps the winner's price read from the result file (สังขะ 4.67), not our quoted 4.97
      if (lost(r)) return;
      var q = quotesOf(r).filter(function (h) { return h.prices && h.prices.length; })[0];
      if (!q || Number(r.price_bid) === q.prices[0]) return;
      r.price_bid = q.prices[0];
      call({ action: 'save', id: r.id, row: { price_bid: r.price_bid } }).catch(function (e) { console.error('notice-bids price from quote', e); });
    });
  }
  // the jobs of one site: same site name, else the longest site name inside the job title (older jobs named after the file)
  function quotesOf(row) {
    var rows = st.rows || [];
    return (st.quotes || []).filter(function (h) {
      var k = nameKey(h.title);
      var b = rows.filter(function (x) { return nameKey(x.site) === k; })[0] ||
        rows.filter(function (x) { var bk = nameKey(x.site); return bk && k.indexOf(bk) >= 0; })
          .sort(function (a, b) { return nameKey(b.site).length - nameKey(a.site).length; })[0] ||
        rows.filter(function (x) { return /\+/.test(x.site || '') && nameKey(String(x.site).split('+')[0]) === k; })[0];   // "ลำปลายมาศ + หนองหงส์"
      return b && b.id === row.id;
    });
  }
  function quoteBtn(r, big) {
    var js = st.quotes == null ? null : quotesOf(r);
    var txt = js == null ? '📄 ใบเสนอราคา' : js.length ? '📄 ใบเสนอราคา' + (Number(js[0].total_amount) ? ' · ' + fmt(js[0].total_amount, 2) : ' · ยังไม่กรอก') : '📄 ทำใบเสนอราคา';
    var ps = js && js.length && js[0].prices && js[0].prices.length ? js[0].prices : null;
    return '<button class="nb-q' + (js && js.length ? ' ok' : '') + (big ? ' big' : '') + '" data-nb="quote" data-i="' + r.id + '"><span class="nb-q1">' + txt + '</span>' +
      (ps ? '<span class="nb-up">ราคา/หน่วย ' + ps.map(function (p) { return fmt(p, 2); }).join(' / ') + ' บาท</span>' : '') + '</button>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v, d) { return v == null || v === '' || !isFinite(v) ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 2 : d }); }

  // ---------------------------------------------------------------- PDF text → fields
  // Thai fonts in PDFs often store tone marks as Windows "private use" glyphs (U+F700–F71A): map them back
  var PUA = { 0xF700: 0x0E10, 0xF701: 0x0E34, 0xF702: 0x0E35, 0xF703: 0x0E36, 0xF704: 0x0E37, 0xF705: 0x0E48, 0xF706: 0x0E49,
    0xF707: 0x0E4A, 0xF708: 0x0E4B, 0xF709: 0x0E4C, 0xF70A: 0x0E48, 0xF70B: 0x0E49, 0xF70C: 0x0E4A, 0xF70D: 0x0E4B, 0xF70E: 0x0E4C,
    0xF70F: 0x0E0D, 0xF710: 0x0E31, 0xF711: 0x0E4D, 0xF712: 0x0E47, 0xF713: 0x0E48, 0xF714: 0x0E49, 0xF715: 0x0E4A, 0xF716: 0x0E4B,
    0xF717: 0x0E4C, 0xF718: 0x0E38, 0xF719: 0x0E39, 0xF71A: 0x0E3A };
  function thaiText(s) {
    return String(s || '').replace(/[-]/g, function (c) { var m = PUA[c.charCodeAt(0)]; return m ? String.fromCharCode(m) : ''; })
      .replace(/ํา/g, 'ำ')    // ํ + า = ำ
      .replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); });   // Thai digits ๐–๙
  }
  // pdf.js gives pieces in drawing order: put them back into lines (top to bottom, left to right)
  function toLines(items) {
    var list = items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
      return { str: thaiText(i.str), x: i.x, y: i.y, w: i.w, h: i.h || 12, p: i.p || 0 };
    }).sort(function (a, b) { return a.p - b.p || a.y - b.y || a.x - b.x; });
    var lines = [];
    list.forEach(function (i) {
      var L = lines.filter(function (l) { return l.p === i.p && Math.abs(l.y - i.y) <= Math.max(3, i.h * 0.3); })[0];
      if (L) L.items.push(i); else lines.push({ p: i.p, y: i.y, items: [i] });
    });
    return lines.sort(function (a, b) { return a.p - b.p || a.y - b.y; }).map(function (l) {
      var s = '', end = null;
      l.items.sort(function (a, b) { return a.x - b.x; }).forEach(function (i) {
        if (end != null && i.x - end > Math.max(1.5, i.h * 0.2)) s += ' ';
        s += i.str; end = i.x + i.w;
      });
      return s.replace(/\s+/g, ' ').trim();
    });
  }
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var MONTH_RE = '(' + MONTHS.join('|') + '|' + MONTHS_SHORT.map(function (m) { return m.replace(/\./g, '\\.'); }).join('|') + ')';
  var DATE_RE = '(\\d{1,2})\\s*' + MONTH_RE + '\\s*(?:พ\\.\\s*ศ\\.\\s*)?(\\d{4})';
  function isoDate(d, m, y) {
    var mi = MONTHS.indexOf(m); if (mi < 0) mi = MONTHS_SHORT.indexOf(m);
    var yr = Number(y); if (yr > 2400) yr -= 543;
    if (mi < 0 || !yr) return null;
    return yr + '-' + ('0' + (mi + 1)).slice(-2) + '-' + ('0' + Number(d)).slice(-2);
  }
  function amount(s) { var n = Number(String(s || '').replace(/[,\s]/g, '').replace(/\.-?$/, '')); return isFinite(n) && n > 0 ? n : null; }
  // the text with every mark dropped (tone marks, vowels above/below, and the junk some fonts give in their place: "É"/"Ê")
  // and ำ read as า, for reading words whose marks a PDF got wrong ("ข้อมูล" → "ขอมล", "ต่ำสุด" → "ตาสด")
  function bareText(s) {
    return String(s || '').replace(/\u0E4D\u0E32/g, '\u0E32').replace(/\u0E33/g, '\u0E32')
      .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').replace(/[^\x20-\x7E\u0E01-\u0E30\u0E32\u0E40-\u0E46\u0E50-\u0E59\s]/g, '');
  }
  // tone marks get lost in some PDFs ("การไฟฟาสวนภูมิภาค"): compare names without them
  function nameKey(s) { return String(s || '').replace(/[ัิ-ฺ็-๎\s.]/g, '').replace(/^(กฟส|กฟจ|กฟอ)/, ''); }

  function extract(items, fileName) {
    var lines = toLines(items), T = lines.join('\n'), F = lines.join(' ').replace(/\s+/g, ' ');
    var out = { file: fileName || '' };
    var head = lines.slice(0, 8).join(' ');
    out.kind = /ระหว่างเวลา|ประกาศ\s*ณ\s*วันที่/.test(F) || /^\(?สำเนา\)?$|^ประกาศ/.test(lines[0] || '') || /^ประกาศ/.test(lines[1] || '') ? 'announce'
      : (/รายละเอียดประกอบ|ปริมาณงาน|ขอบเขตของงาน|ราคากลาง\s*\(/.test(F) ? 'tor' : 'other');
    // office: "การไฟฟ้าส่วนภูมิภาคสาขาพุทไธสง" (marks may be missing), or the short "กฟส.พุทไธสง"
    // the heading "ประกาศการไฟฟ้าส่วนภูมิภาค เรื่อง ประกวดราคา…" names no office: skip words that are not a name
    // nor the sentence "การไฟฟ้าส่วนภูมิภาค มีความประสงค์จะประกวดราคา… / จะชี้แจง…" (กฟจ.บุรีรัมย์ names its office only in the signature)
    var NOT_NAME = /^(เรื่อง|ประกาศ|ประกวด|ว่าด้วย|โดย|เขต|มีความ|จะ|ชื่อ)/;   // e-GP result: "หน่วยงาน : การไฟฟ้าส่วนภูมิภาค / ชื่อโครงการ : …"
    var re = /การไฟฟ\S{0,2}า\s*ส\S{0,2}วนภูมิภาค\s*(สาขา|จังหวัด|อำเภอ|อ\S{0,2}เภอ)?\s*([ก-๎]+(?:\s?\d)?)/g, m, all = head + ' ' + F;
    while ((m = re.exec(all)) && NOT_NAME.test(m[2]) && !m[1]) {}
    if (m) { out.site = m[2].replace(/(และ|ขอ|มี|จะ)$/, ''); out.office = (/จังหวัด/.test(m[1] || '') ? 'กฟจ.' : 'กฟส.') + out.site; }
    else if ((m = F.match(/กฟ([สจ])\.\s*([ก-๎]+)/))) { out.site = m[2]; out.office = 'กฟ' + m[1] + '.' + m[2]; }
    // project number: 11 digits in the e-GP file name (annoudoc_S50631000002_69099738828.pdf) or in the text
    // (the file name also holds the office code "S50631000002": the project number is the last 11-digit group)
    var ids = String(fileName || '').match(/\d{11}(?!\d)/g) || [];
    m = ids.length ? [0, ids[ids.length - 1]] : F.match(/เลขที่โครงการ\s*:?\s*(\d{11})/);
    if (m) out.project_no = m[1];
    // e-GP "สรุปข้อมูลการเสนอราคาเบื้องต้น": the lowest price offered (VAT included) of each รายการพิจารณา
    // Some browsers get this file's tone marks wrong ("É"/"Ê" for ่/้, or none: พุทไธสง 2026-11-03 was read as a plain
    // document, so no 🏆/❌): the file is also recognised, and read, on its text without marks (B: "สรปขอมลการเสนอราคา")
    var B = bareText(F), B0 = B.replace(/\s+/g, '');
    if (/สรุปข้อมูลการเสนอราคา|ราคาต่ำสุดที่เสนอ/.test(F) || /สรปขอมลการเสนอราคา|ราคาตาสดทเสนอ|การเสนอราคาเบองตน/.test(B0)) {
      out.kind = 'result';
      m = F.match(/เลขที่โครงการ\s*:?\s*(\d{11})/) || B.match(/เลขท\s*โครงการ\s*:?\s*(\d{11})/) || F.match(/(?:^|\D)(\d{11})(?!\d)/); if (m) out.project_no = m[1];
      // the office of the project title ("…รับผิดชอบของ กฟส.พุทไธสง และกฟย.ในสังกัด"), without marks when they are damaged
      m = F.match(/กฟ([สจ])\.\s*([ก-๎]+)/);
      var mb = B.match(/กฟ([สจ])\s*\.\s*([ก-ฮะาเ-ๆ]+)/);
      if (m && mb && bareText(m[2]) === mb[2]) { out.site = m[2]; out.office = 'กฟ' + m[1] + '.' + m[2]; }
      else if (mb && mb[2].length >= 2) { out.site = mb[2]; out.office = 'กฟ' + mb[1] + '.' + mb[2]; }
      // the item may carry a description before its price ("รายการพิจารณาที่ 1 เหมาบุคคลภายนอก… 49,434.00")
      out.lowest = []; out.items = []; var re0 = /รายการพิจารณาที่\s*\d+\s*([\s\S]{0,200}?)\s*(\d{1,3}(?:,\d{3})*\.\d{2})/g;
      while ((m = re0.exec(F))) { var v0 = amount(m[2]); if (v0) { out.lowest.push(v0); out.items.push({ name: m[1].trim(), lowest: v0 }); } }
      if (!out.lowest.length) {
        re0 = /รายการพจารณาท\s*\d+\s*([\s\S]{0,200}?)\s*(\d{1,3}(?:,\d{3})*\.\d{2})/g;
        while ((m = re0.exec(B))) { var v1 = amount(m[2]); if (v1) { out.lowest.push(v1); out.items.push({ name: m[1].trim(), lowest: v1 }); } }
      }
      return out;
    }
    // the office's "ประกาศผู้ชนะการเสนอราคา": names the winner and its total (VAT included). Read as a result file of one
    // รายการพิจารณา, so it gives 🏆/❌ and the winning price like "สรุปข้อมูลการเสนอราคาเบื้องต้น" (หนองกี่ 2026-11-03 was
    // read as an announcement and changed nothing). It carries no project number: the site is found by its office.
    if (/ประกาศผู้ชนะการเสนอราคา/.test(F) || /ประกาศผชนะการเสนอราคา/.test(B0)) {
      // "ได้แก่ บริษัท … จำกัด ซึ่งเป็นผู้ชนะการเสนอราคาตามกฎกระทรวง…" (โชคชัย 2026-11-05) as well as "ซึ่งเป็นผู้เสนอราคา…"
      var mw = F.match(/ได้แก่\s*(.{2,80}?)\s*(?:ซึ่งเป็นผู้(?:ชนะการ)?เสนอราคา|ซึ่งเป็นผู้|โดยเสนอราคา|เสนอราคาเป็นเงิน)/);
      var mt = F.match(/(?:เป็นเงินทั้งสิ้น|ราคาทั้งสิ้น|เป็นเงิน)\s*(\d{1,3}(?:,\d{3})*\.\d{2})/);
      if (mt) {
        out.kind = 'result'; out.winner_announce = true;
        if (mw) out.winner = mw[1].replace(/\s+/g, ' ').trim();
        // the day of the award, kept with the winner's name as the site's history
        var md = F.match(new RegExp('ประกาศ\\s*ณ\\s*วันที่\\s*' + DATE_RE));
        if (md) out.award_date = isoDate(md[1], md[2], md[3]);
        out.lowest = [amount(mt[1])]; out.items = [{ name: '', lowest: out.lowest[0] }];
        if (!ids.length) delete out.project_no;   // an 11-digit number in the text is not the project's
        return out;
      }
    }
    // document no. "ฉ.๓ พธ.(พ.)๐๓๐/๒๕๖๙" → zone ฉ.3
    m = F.match(/เลขที่\s*(ฉ\.\s*\d\s*\S+?\/\d{4})/);
    if (m) out.doc_no = m[1].replace(/\s+/g, ' ').replace(/^ฉ\. /, 'ฉ.');
    m = (out.doc_no || '').match(/ฉ\.\s*(\d)/) || F.match(/(?:กฟฉ|ฉ)\.\s*(\d)(?!\d)/);
    if (m) out.zone = 'ฉ.' + m[1];
    if (/เฉพาะเจาะจง/.test(F)) out.method = 'เฉพาะเจาะจง';
    else if (/e-?\s?bidding|ประกวดราคาอิเล็กทรอนิกส์/i.test(F)) out.method = 'e-bidding';
    else if (/e-?\s?market|ตลาดอิเล็กทรอนิกส์/i.test(F)) out.method = 'e-market';
    // money: "ราคากลางของงานจ้าง … เป็นเงินทั้งสิ้น 616,320.00 บาท", TOR "วงเงินประมาณ รวมภาษีมูลค่าเพิ่ม 616,320.- บาท"
    m = F.match(/ราคากลาง[\s\S]{0,160}?เป็นเงิน(?:ทั้งสิ้น)?\s*([\d,]+(?:\.\d+)?)/) || F.match(/วงเงิน[\s\S]{0,60}?([\d]{1,3}(?:,\d{3})+(?:\.\d+)?)\.?-?\s*บาท/) ||
      F.match(/รวมทั้งสิ้น\s*([\d]{1,3}(?:,\s?\d{3})+(?:\.\d*)?)/);
    if (m) out.budget = amount(m[1]);
    // the day and hours the price is offered
    var re = new RegExp('(?:เสนอราคา|ยื่นข้อเสนอ)[\\s\\S]{0,120}?ในวันที่\\s*' + DATE_RE);
    m = F.match(re);
    if (m) out.bid_date = isoDate(m[1], m[2], m[3]);
    m = F.match(/เวลา\s*(\d{1,2}[.:]\d{2})\s*(?:น\.?)?\s*(?:ถึง|-|–)\s*(?:เวลา\s*)?(\d{1,2}[.:]\d{2})/);
    if (m) out.bid_time = m[1].replace(':', '.') + '-' + m[2].replace(':', '.');
    m = F.match(new RegExp('ประกาศ\\s*ณ\\s*วันที่\\s*' + DATE_RE));
    if (m) out.announce_date = isoDate(m[1], m[2], m[3]);
    // TOR: "ขออนุมัติปริมาณงาน 72,000 ราย"
    m = F.match(/ปริมาณงาน\s*(?:จ\S{0,3}นวน\s*)?([\d]{1,3}(?:,\d{3})+|\d{4,})/) || F.match(/([\d]{1,3}(?:,\d{3})+)\s*ราย/);
    if (m) out.qty = amount(m[1]);
    // ราคากลาง per notice: the budget is qty × price + VAT, so it falls out exactly ("8.-" in the table)
    if (out.qty && out.budget) {
      var p = out.budget / (1 + VAT) / out.qty, r = Math.round(p * 100) / 100;
      if (Math.abs(p - r) < 0.0005 && r > 0 && r < 100) out.mid_price = r;
    }
    // TOR with a monthly table only ("ราคากลาง | ราย / เดือน | … 8.00 10,000 …", กฟส.นม.2 หัวทะเล): no yearly quantity in words,
    // so take the price per notice that divides the budget into whole notices (budget ÷ 1.07 ÷ price) and the year's quantity from it
    // one project for several offices (บก.06 "รายการที่ 1 พื้นที่ …สาขาลำปลายมาศ … รายการที่ 2 พื้นที่ …สาขาหนองหงส์"):
    // name every office and add up the quantities of all the areas
    var parts = F.split(/รายการที่\s*\d+\s*พื้นที่/).slice(1);
    if (parts.length > 1) {
      var names = [], total = 0;
      parts.forEach(function (sec) {
        var n = sec.match(/^\s*(?:การไฟฟ\S{0,2}า\s*ส\S{0,2}วนภูมิภาค\s*(?:สาขา|จังหวัด|อำเภอ)?|กฟ[สจ]\.)\s*([ก-๎]+(?:\s?\d)?)/);
        if (n && names.indexOf(n[1]) < 0) names.push(n[1]);
        var q = sec.match(/(\d{1,3}(?:,\d{3})+)/);
        if (q) total += amount(q[1]) || 0;
      });
      if (names.length > 1) { out.site = names.join(' + '); out.office = names.map(function (x) { return 'กฟส.' + x; }).join(', '); }
      if (total) { out.qty = total; delete out.mid_price; }
      if (out.qty && out.budget) {
        var pp = out.budget / (1 + VAT) / out.qty, rr = Math.round(pp * 100) / 100;
        if (Math.abs(pp - rr) < 0.0005 && rr > 0 && rr < 100) out.mid_price = rr;
      }
    }
    // an announcement never states the price per notice: "12.00" there is the closing hour ("09.00 น. ถึง 12.00 น."), not a price
    if (!out.qty && out.budget && /ราคากลาง/.test(F) && out.kind !== 'announce') {
      var cands = F.match(/(?:^|[^\d,.])(\d{1,2}\.\d{2})(?![\d,])/g) || [];
      cands.some(function (c) {
        var pr = Number(c.replace(/[^\d.]/g, '')); if (!(pr > 0 && pr < 100)) return false;
        var q = out.budget / (1 + VAT) / pr;
        if (Math.abs(q - Math.round(q)) > 0.01 || q < 1000) return false;
        out.qty = Math.round(q); out.mid_price = pr; return true;
      });
    }
    out.text = T;
    return out;
  }
  // the price per notice won in a result file. lowest: the lowest offer (VAT included) of each รายการพิจารณา; qty: ราย/ปี of
  // the row; mid: its ราคากลาง; site: its name. The price must divide the money into whole notices:
  //  1. all items together over the row's quantity (one office, or the TOR quantity covers every area)
  //  2. the same, per month (นม.2: 49,434 = 10,000 ราย/เดือน × 4.62 + VAT)
  //  3. one item alone over the row's quantity (สว่างแดนดิน: the TOR row holds พื้นที่ A only, 77,760 ราย; the file has
  //     A สว่างแดนดิน + B เจริญศิลป์ + C ส่องดาว): the item named like the row first; the other areas' quantities follow
  //     from the same price when they come out whole
  //  4. otherwise all items over the row's quantity, flagged as not exact
  //  0. (before all) a row without its own quantity has it estimated as budget ÷ 1.07 ÷ ราคากลาง, and a wrong ราคากลาง
  //     (จักราช: 10 in the sheet, 8 in the TOR) still divides exactly (410,623.20 ÷ 1.07 ÷ 62,400 = 6.15). When the price
  //     typed in the site's quotation splits the money into whole notices that also give a clean ราคากลาง from the budget
  //     (÷ 4.92 = 78,000 ราย; 667,680 ÷ 1.07 ÷ 78,000 = 8.00), that quantity is the real one.
  //     The same when the lowest offer is our own quotation (its total is the same money, ours: true): the row's quantity
  //     may be wrong too (ท่าตูม: 50,800 ราย at ราคากลาง 12 in the row; 406,039.32 ÷ 1.07 ÷ 4.98 = 76,200 ราย at 8.00).
  // opt: { est: qty is estimated, ours: the lowest offer is our quotation's total, budget, quotePrices: unit prices in the site's quotations }
  function resultPrice(lowest, qty, mid, site, names, opt) {
    var exactOf = function (money, n) { var e = money / (1 + VAT) / n, r = Math.round(e * 100) / 100; return { exact: e, price: r, ok: Math.abs(e - r) < 0.0005 && r > 0 }; };
    var total = lowest.reduce(function (s, v) { return s + v; }, 0), mid0 = Number(mid) || 8;
    var res = { total: total, per: qty, monthly: false, item: -1, areas: null };
    opt = opt || {};
    if ((opt.est || opt.ours) && opt.budget) {
      var fix = (opt.quotePrices || []).map(function (qp) {
        var q = total / (1 + VAT) / qp, qr = Math.round(q);
        if (!(qp > 0) || Math.abs(q - qr) > 0.01 || qr < 1000 || qr === qty) return null;
        var m = exactOf(opt.budget, qr);
        return m.ok && m.price < 100 ? { price: qp, exact: qp, ok: true, per: qr, qty: qr, mid: m.price, src: 'price' } : null;
      }).filter(Boolean)[0];
      if (fix) return Object.assign(res, fix);
    }
    // the quantity our own quotation was priced on (its total ÷ 1.07 ÷ its unit price, whole notices): the lowest offer
    // divides exactly over it when the row's quantity is wrong (บ้านดุง: 68,000 in the row at ราคากลาง 9 → 4.905;
    // the quotation 340,516.80 at 5.20 = 61,200 ราย → 356,887.80 ÷ 1.07 ÷ 61,200 = 5.45, ราคากลาง 10.00)
    var byQuote = function () {
      return (opt.quoteQtys || []).map(function (qq) {
        if (!(qq >= 1000) || qq === qty) return null;
        var w = exactOf(total, qq); if (!w.ok || w.price > mid0 * 2) return null;
        var m = opt.budget ? exactOf(opt.budget, qq) : null;
        return Object.assign(w, { per: qq, qty: qq, mid: m && m.ok && m.price < 100 ? m.price : undefined, src: 'qty' });
      }).filter(Boolean)[0];
    };
    var bq = opt.est && byQuote(); if (bq) return Object.assign(res, bq);
    var all = exactOf(total, qty);
    // our quoted price itself: the row's ราคากลาง can be per notice per year (นครราชสีมา 2: 10,000 ราย/เดือน, ราคากลาง 96 =
    // 8 × 12), which would make 4.62 look "too low" and send the reading to a monthly 55.44
    if (all.ok && (opt.quotePrices || []).some(function (p) { return Math.abs(p - all.price) < 0.005; })) return Object.assign(res, all);
    // the row's quantity can be wrong while its budget, quantity and ราคากลาง still agree (จอหอ: 48,000 ราย at 16.00 in the
    // row, the TOR is 96,000 ราย at 8.00): 482,784 ÷ 1.07 ÷ 48,000 = 9.40 divides exactly but is twice our quoted 4.78.
    // The quantity our quotation was priced on (491,001.60 ÷ 1.07 ÷ 4.78 = 96,000) gives 4.70, near what we quoted: it wins
    if (all.ok && (opt.quotePrices || []).length) {
      var off = function (v) { return Math.min.apply(null, opt.quotePrices.map(function (p) { return Math.abs(v - p) / p; })); };
      var bq0 = byQuote();
      if (bq0 && off(all.price) > 0.3 && off(bq0.price) <= 0.3) return Object.assign(res, bq0);
    }
    if (all.ok && all.price >= mid0 / 4) return Object.assign(res, all);
    var mon = exactOf(total, qty / 12);
    if (all.exact < mid0 / 4 && mon.exact <= mid0) return Object.assign(res, mon, { per: qty / 12, monthly: true });
    if (lowest.length > 1) {
      var k = nameKey(site), order = lowest.map(function (_, i) { return i; });
      order.sort(function (a, b) { return named(b) - named(a); });
      for (var j = 0; j < order.length; j++) {
        var i = order[j], one = exactOf(lowest[i], qty);
        if (!one.ok || one.price > mid0 * 1.5 || one.price < mid0 / 4) continue;
        var areas = lowest.map(function (v) { var q = v / (1 + VAT) / one.price; return Math.abs(q - Math.round(q)) < 0.01 ? Math.round(q) : null; });
        return Object.assign(res, one, { item: i, areas: areas });
      }
    }
    bq = byQuote(); if (bq) return Object.assign(res, bq);
    return Object.assign(res, all);
    function named(i) { var n = nameKey((names || [])[i] || ''); return k && n.indexOf(k) >= 0 ? 1 : 0; }
  }
  // the quantity each quotation of the site was priced on: total ÷ 1.07 ÷ unit price, when that is a whole number of notices
  function quoteQtys(row) {
    var out = [];
    quotesOf(row).forEach(function (h) {
      var t = Number(h.total_amount) || 0;
      (h.prices || []).forEach(function (p) { var q = t / (1 + VAT) / p, r = Math.round(q); if (t > 0 && p > 0 && Math.abs(q - r) < 0.01 && out.indexOf(r) < 0) out.push(r); });
    });
    return out;
  }
  // did we win? The lowest offer in the result file is our own quotation: its total (VAT included) is the same money,
  // for the whole project or for one รายการพิจารณา (ท่าตูม: 406,039.32 = the ท่าตูม quotation, 1 bidder). Without a total
  // in the quotation, its unit price equal to the winning price per notice is enough.
  function isOurWin(lowest, quoteTotals, quotePrices, price) {
    var total = lowest.reduce(function (s, v) { return s + v; }, 0), near = function (a, b) { return Math.abs(a - b) < 0.015; };
    var byTotal = (quoteTotals || []).some(function (t) { return t > 0 && (near(t, total) || lowest.some(function (v) { return near(t, v); })); });
    if (byTotal) return true;
    if ((quoteTotals || []).some(function (t) { return t > 0; })) return false;
    return price > 0 && (quotePrices || []).some(function (q) { return near(q, price); });
  }
  // announcement + TOR of the same office become one row; announcement wins for dates/money, TOR for quantities
  function mergeDocs(docs) {
    var groups = [];
    docs.forEach(function (d) {
      var k = nameKey(d.site);
      var g = groups.filter(function (x) { return (k && x.key === k) || (d.project_no && x.project_no === d.project_no); })[0];
      if (!g) { g = { key: k, project_no: d.project_no, docs: [] }; groups.push(g); }
      g.docs.push(d);
    });
    // two files where one could not be named: still one job
    if (groups.length === 2 && docs.length === 2 && (!groups[0].key || !groups[1].key)) { groups[0].docs = groups[0].docs.concat(groups[1].docs); groups.length = 1; }
    return groups.map(function (g) {
      var ann = g.docs.filter(function (d) { return d.kind === 'announce'; }), tor = g.docs.filter(function (d) { return d.kind !== 'announce'; });
      var order = ann.concat(tor), torFirst = tor.concat(ann), row = { files: g.docs.map(function (d) { return d.file; }) };
      ['site', 'office', 'zone', 'project_no', 'doc_no', 'method', 'budget', 'bid_date', 'bid_time', 'announce_date'].forEach(function (k) {
        var d = order.filter(function (x) { return x[k] != null && x[k] !== ''; })[0]; if (d) row[k] = d[k];
      });
      ['qty', 'mid_price'].forEach(function (k) { var d = torFirst.filter(function (x) { return x[k] != null; })[0]; if (d) row[k] = d[k]; });
      if (!row.mid_price && row.qty && row.budget) {
        var p = row.budget / (1 + VAT) / row.qty, r = Math.round(p * 100) / 100; if (Math.abs(p - r) < 0.0005) row.mid_price = r;
      }
      row.has_announce = ann.length > 0; row.has_tor = tor.length > 0;
      return row;
    });
  }
  // ---------------------------------------------------------------- end of extraction

  // ---------------------------------------------------------------- pdf.js
  var pdfjsReady = null;
  function loadPdfJs() {
    if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.GlobalWorkerOptions.workerSrc || PDFJS_WORKER; return Promise.resolve(window.pdfjsLib); }
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = loadScript(PDFJS).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return window.pdfjsLib; });
    return pdfjsReady;
  }
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = ok; s.onerror = function () { fail(new Error('โหลดไลบรารีไม่สำเร็จ: ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function readPdf(file) {
    var lib = await loadPdfJs();
    var pdf = await lib.getDocument({ data: file.bytes }).promise;
    var items = [];
    for (var n = 1; n <= Math.min(pdf.numPages, 6); n++) {
      var page = await pdf.getPage(n), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
      tc.items.forEach(function (i) {
        var t = lib.Util.transform(vp.transform, i.transform);
        items.push({ p: n - 1, str: i.str, x: t[4], y: t[5], w: i.width, h: Math.hypot(t[2], t[3]) });
      });
    }
    return extract(items, file.name);
  }
  // The bytes are copied the moment the files are picked or dropped, before the page is redrawn and the
  // file input is cleared (like เสนอราคาแจ้งเตือน), so nothing can reach pdf.js empty.
  async function openFiles(list) {
    list = [].filter.call(list || [], function (f) { return /pdf$/i.test(f.type || f.name); });
    if (!list.length) return;
    var files = await Promise.all(list.map(function (f) {
      return f.arrayBuffer().then(function (b) { return { name: f.name, bytes: new Uint8Array(b) }; }, function (e) { return { name: f.name, bytes: new Uint8Array(0), err: e }; });
    }));
    var empty = files.filter(function (f) { return !f.bytes.length; });
    if (empty.length) alert('ไฟล์ ' + empty.map(function (f) { return f.name; }).join(', ') + ' ว่างเปล่า (0 ไบต์) อ่านไม่ได้\n' +
      'มักเกิดจากไฟล์ยังดาวน์โหลดไม่เสร็จ หรือไฟล์อยู่บน OneDrive แต่ยังไม่ได้ดาวน์โหลดลงเครื่อง\nให้เปิดไฟล์ในเครื่องหนึ่งครั้ง หรือดาวน์โหลดจาก e-GP ใหม่ แล้ววางอีกครั้ง');
    files = files.filter(function (f) { return f.bytes.length; });
    if (!files.length) return;
    st.busy = 'กำลังอ่านไฟล์ ' + files.length + ' ไฟล์…'; render();
    var docs = [];
    for (var i = 0; i < files.length; i++) {
      try { docs.push(await readPdf(files[i])); }
      catch (e) { console.error('notice-bids', e); alert('อ่านไฟล์ ' + files[i].name + ' ไม่สำเร็จ: ' + (e.message || e)); }
    }
    st.busy = '';
    var results = docs.filter(function (d) { return d.kind === 'result'; });
    docs = docs.filter(function (d) { return d.kind !== 'result'; });
    for (var k = 0; k < results.length; k++) await applyResult(results[k]);
    if (!docs.length) { render(); return; }
    // a site already in the table is updated in place at once (บัวใหญ่ from the sheet + its announcement and TOR):
    // no review card, no second row. Only a site not in the table waits on a card to be added.
    if (st.rows == null || st.err) await load();
    var notes = [];
    var merged = mergeDocs(docs), kindOf = {};
    docs.forEach(function (d) { kindOf[d.file] = d.kind; });
    for (var n = 0; n < merged.length; n++) {
      var r = merged[n];
      r.target = st.err ? 0 : matchRow(r);
      st.pending.push(r);
      if (!r.target) continue;
      var before = Object.assign({}, (st.rows || []).filter(function (x) { return x.id === r.target; })[0]);
      if (!(await confirmPending(st.pending.length - 1, true))) continue;
      var txt = changesText(before, (st.rows || []).filter(function (x) { return x.id === r.target; })[0] || {});
      // a file that is neither announcement, TOR nor a result file the reader knows, and changed nothing: say so, instead of
      // a bare "ข้อมูลตรงกับที่มีอยู่แล้ว" that leaves the user waiting for 🏆/❌ (พุทไธสง 2026-11-03)
      if (r.files.every(function (f) { return kindOf[f] === 'other'; }) && !/\n•/.test(txt))
        txt += '\n⚠ ไฟล์ ' + r.files.join(', ') + ' ไม่ใช่ไฟล์ "สรุปข้อมูลการเสนอราคาเบื้องต้น" ที่ระบบอ่านออก จึงยังไม่ได้บอกผลชนะ/แพ้' +
          '\nถ้าเป็นไฟล์ผลประมูล ให้ดาวน์โหลดจาก e-GP ใหม่ (อย่าสั่งพิมพ์/บันทึกจากหน้าดู PDF) แล้ววางอีกครั้ง หรือกด 🏆 ในแถวเอง';
      notes.push(txt);
    }
    if (notes.length) alert('อัปเดตไซด์ที่มีอยู่แล้ว (ไม่เพิ่มแถวใหม่)\n\n' + notes.join('\n\n'));
    if (docs.length && !docs.some(function (d) { return d.site || d.budget || d.qty; }))
      alert('ไม่พบข้อมูลในไฟล์ (ไฟล์อาจเป็นภาพสแกน) กรุณากรอกเอง');
    render();
  }
  // the result file of an auction: lowest price ÷ 1.07 ÷ ราย/ปี = the winning price per notice before VAT → ราคาปี70
  async function applyResult(d) {
    // our quotations decide 🏆 / ❌ and the winning price: a file dropped right after the menu opens must wait for them
    // (they load in the background; ท่าตูม was once read as 50,800 ราย → 7.47 with no 🏆 because they were not in yet)
    if (!st.quotes) { st.busy = 'กำลังโหลดใบเสนอราคา…'; render(); await (st.quotesP || (st.quotesP = loadQuotes())); st.busy = ''; }
    var name = d.file + (d.project_no ? ' (เลขที่โครงการ ' + d.project_no + ')' : '');
    // ประกาศผู้ชนะ has no project number in its text (only in the e-GP file name): it is matched by its office
    if (!d.project_no && !(d.winner_announce && d.site)) { alert('ไฟล์ ' + d.file + ': ไม่พบเลขที่โครงการในไฟล์'); return; }
    if (!d.lowest || !d.lowest.length) { alert('ไฟล์ ' + name + ': ไม่พบราคาต่ำสุดที่เสนอ (ไฟล์อาจเป็นภาพสแกน)'); return; }
    var row = d.project_no ? (st.rows || []).filter(function (x) { return String(x.project_no || '').trim() === d.project_no; })[0] : null;
    // a row without its project number yet (เมืองนครราชสีมา 3): the office named in the project title, and the number is saved
    var named = null;
    if (!row && d.site) {
      var mid = matchRow({ site: d.site });
      named = (st.rows || []).filter(function (x) { return x.id === mid && (!d.project_no || !String(x.project_no || '').trim()); })[0] || null;
      row = named;
    }
    if (!row) { alert('ไฟล์ ' + name + ': ไม่พบไซด์ที่มีเลขที่โครงการนี้ในตาราง'); return; }
    var qty = derived(row).qty;
    if (!qty) { alert(row.site + ': ยังไม่มีจำนวนราย/ปี (หรือวงเงิน + ราคากลาง) จึงคำนวณราคาต่อรายไม่ได้'); return; }
    var names = (d.items || []).map(function (x) { return x.name; });
    var dv = derived(row), qps = [];
    quotesOf(row).forEach(function (h) { (h.prices || []).forEach(function (v) { if (qps.indexOf(v) < 0) qps.push(v); }); });
    var qts = quotesOf(row).map(function (h) { return Number(h.total_amount) || 0; });
    var byTotal = isOurWin(d.lowest, qts, [], 0);
    var r = resultPrice(d.lowest, qty, row.mid_price, row.site, names, { est: dv.est, ours: byTotal, budget: Number(row.budget) || 0, quotePrices: qps, quoteQtys: quoteQtys(row) }), price = r.price, total = r.total;
    var patch = { price_bid: price };
    if (named && d.project_no && !String(named.project_no || '').trim()) patch.project_no = d.project_no;
    var ours = byTotal || isOurWin(d.lowest, qts, qps, price);
    // only a site with a quotation of ours can be called lost: without one there is nothing to compare
    // ประกาศผู้ชนะ names the winner: an offer that is not our quotation is someone else's win, quotation or not (หนองกี่)
    var quoted = qts.some(function (t) { return t > 0; }) || qps.length > 0 || !!d.winner_announce;
    if (ours && !won(row)) patch.status = 'ชนะประมูล';
    // a site already marked 🏆 that the file says someone else underbid is kept as it is: the lowest bidder can be
    // disqualified and the job awarded at our quotation (โชคชัย: lowest 4.60 had bad documents, we won at 5.02),
    // so a re-import must not flip it back to ❌ or overwrite our price
    // ประกาศผู้ชนะ is the final award, so it is not kept that way
    var keep = !ours && quoted && won(row) && !d.winner_announce;
    if (!ours && quoted && !lost(row) && !keep) patch.status = 'ไม่ชนะประมูล';
    // ประกาศผู้ชนะ: the winner's name is kept with the site as its history (โชคชัย 2026-11-06), shown in the list and details
    if (d.winner) {
      var w = { name: d.winner, total: total, price: price, date: d.award_date || null, file: d.file, read_at: new Date().toISOString() };
      var past = ((row.source || {}).winners || []).filter(function (x) { return !(x.name === w.name && x.date === w.date); });
      patch.source = Object.assign({}, row.source || {}, { winner: w, winners: past.concat([w]) });
      patch.winner_set = true;
    }
    var msg = row.site + (d.project_no
        ? ' (เลขที่โครงการ ' + d.project_no + (patch.project_no ? ' — ไซด์นี้ยังไม่มีเลขที่โครงการ หาจากชื่อสาขาในไฟล์ และจะบันทึกเลขนี้ให้' : named ? ' — หาจากชื่อสาขาในไฟล์' : '') + ')'
        : ' (ประกาศผู้ชนะ: หาไซด์จากชื่อสาขาในไฟล์)') + '\n' +
      (d.winner ? 'ผู้ชนะ: ' + d.winner + (d.award_date ? ' (ประกาศ ' + thaiDate(d.award_date) + ')' : '') + ' — จะบันทึกชื่อผู้ชนะไว้เป็นประวัติของไซด์นี้\n' : '') +
      (d.winner_announce ? 'ราคาที่ชนะ ' : 'ราคาต่ำสุดที่เสนอ ') + fmt(total, 2) + ' บาท (รวม VAT)' + (d.lowest.length > 1 ? ' รวม ' + d.lowest.length + ' รายการพิจารณา' : '') + (r.monthly ? ' เป็นราคาต่อเดือน' : '') + '\n';
    if (r.qty && !keep) {
      patch.qty = r.qty; if (r.mid) patch.mid_price = r.mid;
      msg += (r.src === 'price'
        ? '÷ 1.07 ÷ ' + fmt(price, 2) + ' (ราคาในใบเสนอราคาของไซด์นี้) = ' + fmt(r.qty) + ' ราย/ปี\n'
        : '÷ 1.07 ÷ ' + fmt(r.qty) + ' ราย (จำนวนที่ใบเสนอราคาของไซด์นี้ใช้) = ' + fmt(price, 2) + ' บาท/ราย ก่อน VAT\n') +
        '⚠ จำนวนรายเดิม' + (dv.est ? 'ประมาณจากราคากลาง ' + fmt(row.mid_price, 2) + ' ได้ ' : 'ในตาราง ') + fmt(qty) + ' ราย ซึ่งไม่ตรง' +
        (r.mid ? ': วงเงิน ' + fmt(row.budget, 2) + ' ÷ 1.07 ÷ ' + fmt(r.qty) + ' = ราคากลาง ' + fmt(r.mid, 2) : '') +
        '\nจะบันทึกจำนวน ' + fmt(r.qty) + ' ราย' + (r.mid ? ' และราคากลาง ' + fmt(r.mid, 2) : '') + ' ด้วย';
    } else if (r.item >= 0) {
      msg += d.lowest.map(function (v, i) {
        return (i === r.item ? '▶ ' : '   ') + (names[i] || 'รายการพิจารณาที่ ' + (i + 1)) + ' ' + fmt(v, 2) + ' บาท' +
          (r.areas[i] ? ' = ' + fmt(r.areas[i]) + ' ราย × ' + fmt(price, 2) : '');
      }).join('\n') + '\n' +
        fmt(d.lowest[r.item], 2) + ' ÷ 1.07 ÷ ' + fmt(qty) + ' ราย = ' + fmt(price, 2) + ' บาท/ราย ก่อน VAT' +
        '\n(จำนวนรายในตารางตรงกับรายการพิจารณาที่ ' + (r.item + 1) + ' เท่านั้น' +
        (r.areas.every(Boolean) ? ' ทั้งโครงการ ' + fmt(r.areas.reduce(function (s, v) { return s + v; }, 0)) + ' ราย' : '') + ')';
    } else {
      msg += '÷ 1.07 ÷ ' + fmt(r.per) + (r.monthly ? ' ราย/เดือน' : ' ราย') + ' = ' + fmt(price, 2) + ' บาท/ราย ก่อน VAT' +
        (Math.abs(r.exact - price) >= 0.0005 ? '\n⚠ หารไม่ลงตัว (' + r.exact.toFixed(4) + ') จำนวนรายในตารางอาจไม่ตรงกับ TOR' : '');
    }
    if (ours) msg += '\n\n🏆 ราคาต่ำสุดตรงกับใบเสนอราคาของเรา: ' + (won(row) ? 'ไซด์นี้ทำเครื่องหมายชนะประมูลไว้แล้ว' : 'จะทำเครื่องหมายว่าชนะประมูล');
    else if (quoted) msg += '\n\n❌ ' + (d.winner_announce ? 'ผู้ชนะไม่ใช่เรา: ราคาที่ชนะไม่ตรงกับใบเสนอราคาของเรา' + (qts.some(function (t) { return t > 0; }) ? '' : ' (ไซด์นี้ไม่มีใบเสนอราคาของเรา)') : 'ราคาต่ำสุดไม่ตรงกับใบเสนอราคาของเรา') + (qts.some(function (t) { return t > 0; }) ? ' (' + qts.filter(function (t) { return t > 0; }).map(function (t) { return fmt(t, 2); }).join(' / ') + ' บาท)' : '') +
      (keep ? '' : ': ' + (lost(row) ? 'ไซด์นี้ทำเครื่องหมายไม่ชนะประมูลไว้แล้ว' : 'จะทำเครื่องหมายว่าไม่ชนะประมูล' + (won(row) ? ' (แทนเครื่องหมาย 🏆 เดิม)' : '')));
    if (keep) {
      delete patch.price_bid;
      msg += '\n\n🏆 แต่ไซด์นี้ทำเครื่องหมายชนะประมูลไว้แล้ว (เช่น ผู้เสนอต่ำสุดถูกตัดสิทธิ์ เราได้งานตามใบเสนอราคา) จึงคง 🏆 และราคาปี70 ' +
        fmt(row.price_bid, 2) + ' ไว้ตามเดิม ถ้าจริงๆ ไม่ชนะ ให้แก้สถานะในแถวเอง';
      if (!named) { alert(msg); return; }
      msg += '\n\nบันทึกเลขที่โครงการ ' + d.project_no + ' ให้ไซด์นี้?';
    } else msg += (row.price_bid == null ? '' : Number(row.price_bid) === price ? '\n\nตรงกับราคาปี70 ที่มีอยู่แล้ว' : '\n\nราคาปี70 เดิม ' + fmt(row.price_bid, 2) + ' จะถูกแทนที่') + '\n\nใส่ ' + fmt(price, 2) + ' ในช่องราคาปี70?';
    if (!confirm(msg)) return;
    try { st.busy = 'กำลังบันทึก…'; render(); upsertLocal(await saveRow(Object.assign({}, row, patch))); }
    catch (e) { alert('บันทึกไม่สำเร็จ: ' + (e.message || e)); }
    st.busy = '';
  }
  function matchRow(r) {
    var rows = st.rows || [], k = nameKey(r.site);
    var hit = rows.filter(function (x) { return r.project_no && x.project_no === r.project_no; })[0] ||
      rows.filter(function (x) { return k && nameKey(x.site) === k; })[0] ||
      // "เมืองนครราชสีมา2" from the PDF vs "นครราชสีมา 2" in the table: one name inside the other (the longest wins)
      rows.filter(function (x) { var xk = nameKey(x.site); return k && xk.length >= 4 && (k.indexOf(xk) >= 0 || xk.indexOf(k) >= 0); })
        .sort(function (a, b) { return nameKey(b.site).length - nameKey(a.site).length; })[0];
    return hit ? hit.id : 0;
  }

  // ---------------------------------------------------------------- numbers shown in the table
  // "N ไซด์ · X ราย/เดือน": the ราย we have won (ราย/ปี ÷ 12), summed live from the rows so it follows every status change
  function wonSummary() {
    var w = (st.rows || []).filter(won), qty = w.reduce(function (s, r) { return s + (derived(r).qty || 0); }, 0);
    return w.length + ' ไซด์' + (qty ? ' · ' + fmt(Math.round(qty / 12)) + ' ราย/เดือน' : '');
  }
  // จำนวนราย/ปี of a site: from its quotation first, else จำนวนราย in the table, else วงเงิน ÷ 1.07 ÷ ราคากลาง
  function quoteQty(r) {
    if (!st.quotes || !r.id) return null;
    var h = quotesOf(r).filter(function (x) { return x.qty > 0; })[0];
    if (!h) return null;
    // a quotation priced per month (ราย/เดือน) is taken ×12: when twelve times it is nearer the budget's own estimate
    var est = r.budget && r.mid_price ? r.budget / (1 + VAT) / r.mid_price : Number(r.qty) || 0;
    if (!est) return h.qty;
    var off = function (v) { return Math.abs(Math.log(v / est)); };
    return off(h.qty * 12) < off(h.qty) ? h.qty * 12 : h.qty;
  }
  function derived(r) {
    var qty = quoteQty(r) || Number(r.qty) || null, est = false;
    if (!qty && r.budget && r.mid_price) { qty = Math.round(r.budget / (1 + VAT) / r.mid_price); est = true; }
    return {
      qty: qty, est: est,
      budgetMonth: r.budget ? r.budget / 12 : null,
      qtyMonth: qty ? qty / 12 : null,
      value: qty && r.price_bid ? qty * r.price_bid * (1 + VAT) : null
    };
  }
  function thaiDate(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return Number(p[2]) + '/' + Number(p[1]) + '/' + (Number(p[0]) + 543); }
  function parseThaiDate(s) {
    s = String(s || '').trim(); if (!s) return null;
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (!m) return undefined;
    var y = Number(m[3]); if (y < 100) y += 2500; if (y > 2400) y -= 543;
    var d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    if (d.getUTCDate() !== Number(m[1])) return undefined;
    return d.toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------- saving
  var FIELDS = ['zone', 'site', 'office', 'project_no', 'budget', 'qty', 'mid_price', 'price_prev', 'price_bid', 'bid_date', 'bid_time', 'method', 'doc_no', 'announce_date', 'status', 'note'];
  var NUMS = { budget: 1, qty: 1, mid_price: 1, price_prev: 1, price_bid: 1 };
  async function saveRow(row) {
    var body = { action: 'save', id: row.id || undefined, row: {} };
    FIELDS.forEach(function (k) { if (k in row) body.row[k] = row[k]; });
    // source is saved whole: keep what the row already holds (the winner read from ประกาศผู้ชนะ) when files are read again
    var had = row.id ? ((st.rows || []).filter(function (x) { return x.id === row.id; })[0] || {}).source : null;
    if (row.files) body.row.source = Object.assign({}, had || {}, row.source || {}, { files: row.files, read_at: new Date().toISOString() });
    else if (row.winner_set) body.row.source = Object.assign({}, had || {}, row.source || {});
    var j = await call(body);
    return j.item;
  }
  // another row of the table with the same site or project number (a site is saved once a year)
  function duplicateOf(site, projectNo, exceptId) {
    var k = nameKey(site), pn = String(projectNo || '').trim();
    return (st.rows || []).filter(function (x) {
      return x.id !== exceptId && ((k && nameKey(x.site) === k) || (pn && String(x.project_no || '').trim() === pn));
    })[0] || null;
  }
  function dupText(d) { return '"' + (d.zone ? d.zone + ' ' : '') + (d.site || '') + '"' + (d.project_no ? ' (เลขที่โครงการ ' + d.project_no + ')' : ''); }
  // what an update changed, for the note after an import ("วงเงิน: – → 975,840")
  var LABELS = { zone: 'เขต', office: 'สาขา', project_no: 'เลขที่โครงการ', budget: 'วงเงิน', qty: 'จำนวนราย/ปี', mid_price: 'ราคากลาง', bid_date: 'วันที่เสนอราคา',
    bid_time: 'เวลา', method: 'วิธี', doc_no: 'เลขที่เอกสาร', announce_date: 'วันที่ประกาศ' };
  function changesText(a, b) {
    var show = function (k, v) { return v == null || v === '' ? '–' : /date/.test(k) ? thaiDate(v) : NUMS[k] ? fmt(Number(v), k === 'mid_price' ? 2 : null) : String(v); };
    var lines = Object.keys(LABELS).filter(function (k) { return show(k, a[k]) !== show(k, b[k]); })
      .map(function (k) { return '• ' + LABELS[k] + ': ' + show(k, a[k]) + ' → ' + show(k, b[k]); });
    return (b.site || a.site || '') + (lines.length ? '\n' + lines.join('\n') : ' (ข้อมูลตรงกับที่มีอยู่แล้ว)');
  }
  // quiet: the import updating a site it found in the table (returns true once saved)
  async function confirmPending(i, quiet) {
    var r = st.pending[i]; if (!r) return false;
    // the table did not load: a new row could duplicate a site that is there
    if (!r.target && (st.rows == null || st.err)) { alert('ยังโหลดตารางไม่สำเร็จ จึงยังเช็กไม่ได้ว่าไซด์นี้มีอยู่แล้วหรือไม่ ลองโหลดใหม่ก่อนบันทึก'); return false; }
    var dup = duplicateOf(r.site, r.project_no, r.target || 0);
    if (dup && !r.target && !confirm('ไซด์นี้มีอยู่ในตารางแล้ว: ' + dupText(dup) + '\nถ้าจะอัปเดตแถวเดิม ให้กดยกเลิก แล้วเลือก "แทนแถว" ในช่องบันทึกลง\n\nต้องการเพิ่มเป็นแถวใหม่ซ้ำอีกแถวหรือไม่?')) return;
    if (dup && r.target && !confirm('ข้อมูลนี้ซ้ำกับอีกแถวในตาราง: ' + dupText(dup) + '\nต้องการบันทึกต่อหรือไม่?')) return;
    var base = r.target ? (st.rows || []).filter(function (x) { return x.id === r.target; })[0] : null;
    var row = { id: r.target || undefined, files: r.files };
    // values read from the PDFs replace the row's; what the PDFs did not give stays as typed
    FIELDS.forEach(function (k) { if (r[k] != null && r[k] !== '') row[k] = r[k]; });
    if (base && base.project_no && !r.project_no) delete row.project_no;
    // updating a row: the name already in the table stays (a misread heading once renamed บ้านไผ่ to "เรื่อง")
    if (base && base.site) { row.site = base.site; if (base.office) row.office = base.office; }
    // a cancelled site announced again (a new auction day) is open again: its ยกเลิก goes
    if (base && /ยกเลิก/.test(String(base.status || '')) && r.bid_date && String(r.bid_date).slice(0, 10) !== String(base.bid_date || '').slice(0, 10)) row.status = '';
    try {
      st.busy = 'กำลังบันทึก…'; render();
      var item = await saveRow(row);
      st.pending.splice(i, 1);
      upsertLocal(item);
      st.busy = ''; if (!quiet) render();
      return true;
    } catch (e) { alert('บันทึกไม่สำเร็จ: ' + (e.message || e)); }
    st.busy = ''; render();
    return false;
  }
  function upsertLocal(item) {
    if (!item) return;
    st.rows = st.rows || [];
    var i = st.rows.findIndex(function (x) { return x.id === item.id; });
    if (i >= 0) st.rows[i] = item; else st.rows.push(item);
  }
  var cellTimers = {};
  function cellChanged(id, key, raw) {
    var row = (st.rows || []).filter(function (x) { return x.id === id; })[0]; if (!row) return;
    var v = raw.trim();
    if (key === 'bid_date' || key === 'announce_date') { v = parseThaiDate(v); if (v === undefined) { flash(id, key, 'รูปแบบวันที่ วว/ดด/ปปปป'); return; } }
    else if (NUMS[key]) {
      if (v === '') v = null;
      else if (!isFinite(Number(v.replace(/,/g, '')))) {
        // a word in a price cell ("ยกเลิก") is a status, as in the old sheet
        if (key === 'price_bid' || key === 'price_prev') { row.status = v; v = null; } else { flash(id, key, 'ต้องเป็นตัวเลข'); return; }
      } else v = Number(v.replace(/,/g, ''));
    } else if (v === '') v = null;
    if ((key === 'site' || key === 'project_no') && v) {
      var dup = duplicateOf(key === 'site' ? v : null, key === 'project_no' ? v : null, id);
      if (dup && !confirm((key === 'site' ? 'ชื่อไซด์' : 'เลขที่โครงการ') + ' "' + v + '" มีอยู่แล้วในแถว ' + dupText(dup) + '\nต้องการบันทึกซ้ำหรือไม่?')) {
        var el = page().querySelector('[data-id="' + id + '"][data-k="' + key + '"]'); if (el) el.value = row[key] == null ? '' : row[key];
        return;
      }
    }
    if (key === 'site' && row.site && !row._renamedFrom) row._renamedFrom = row.site;   // kept until the save goes through (edits are batched)
    row[key] = v;
    updateDerived(row);
    clearTimeout(cellTimers[id]);
    setRowState(id, 'saving');
    cellTimers[id] = setTimeout(async function () {
      try {
        var item = await saveRow(row);
        Object.keys(item).forEach(function (k) { if (k === 'updated_at' || k === 'id') row[k] = item[k]; });
        setRowState(id, 'ok');
        var from = row._renamedFrom; delete row._renamedFrom;
        if (from && row.site && nameKey(from) !== nameKey(row.site)) renameQuotes(from, row.site);
      } catch (e) { setRowState(id, 'err'); console.error('notice-bids save', e); alert('บันทึกไม่สำเร็จ: ' + (e.message || e)); }
    }, 700);
  }
  // a renamed site takes its เสนอราคาแจ้งเตือน jobs along (they are matched by name); everything else of the job is kept
  async function renameQuotes(from, to) {
    try {
      var jobs = ((await call({ action: 'list' }, QUOTE_API)).items || []).filter(function (h) { return nameKey(h.title) === nameKey(from); });
      for (var i = 0; i < jobs.length; i++) {
        var it = (await call({ action: 'get', id: jobs[i].id }, QUOTE_API)).item;
        await call({ action: 'save', id: it.id, title: to, state: it.state || {}, total_amount: it.total_amount }, QUOTE_API);
      }
    } catch (e) { console.error('notice-bids rename quotes', e); alert('เปลี่ยนชื่อไซด์แล้ว แต่ปรับชื่องานในเมนูเสนอราคาแจ้งเตือนไม่สำเร็จ: ' + (e.message || e)); }
  }
  function flash(id, key, msg) { var el = page().querySelector('[data-id="' + id + '"][data-k="' + key + '"]'); if (el) { el.classList.add('nb-bad'); el.title = msg; } }
  function setRowState(id, s) { var tr = page().querySelector('[data-row="' + id + '"]'); if (tr) tr.setAttribute('data-state', s); }
  function updateDerived(row) {
    var tr = page().querySelector('[data-row="' + row.id + '"]'); if (!tr) return;
    var d = derived(row);
    var set = function (k, v) { var el = tr.querySelector('[data-d="' + k + '"]'); if (el) el.innerHTML = v; };
    set('bm', fmt(d.budgetMonth, 2)); set('qm', fmt(d.qtyMonth, 0)); set('val', fmt(d.value, 2));
    var q = tr.querySelector('[data-k="qty"]'); if (q) q.placeholder = d.est ? fmt(d.qty) : '';
    var s = tr.querySelector('[data-k="status"]'); if (s && document.activeElement !== s) s.value = row.status || '';
    var h = tr.querySelector('[data-d="name"]'); if (h) h.textContent = row.site || '(ไม่มีชื่อไซด์)';
  }
  async function addRow() {
    var blank = duplicateOf('ไซด์ใหม่', null, 0);
    if (blank) { alert('มีแถว "ไซด์ใหม่" ที่ยังไม่ได้ตั้งชื่ออยู่แล้ว เปิดแถวนั้นให้กรอกต่อ'); st.open = blank.id; render(); return; }
    try { var item = await saveRow({ zone: st.zone || null, site: 'ไซด์ใหม่' }); upsertLocal(item); st.open = item.id; render(); }
    catch (e) { alert('เพิ่มแถวไม่สำเร็จ: ' + (e.message || e)); }
  }
  async function deleteRow(id) {
    var row = (st.rows || []).filter(function (x) { return x.id === id; })[0];
    if (!row || !confirm('ลบแถว "' + (row.site || '') + '" ออกจากตาราง?')) return;
    try { await call({ action: 'delete', id: id }); st.rows = st.rows.filter(function (x) { return x.id !== id; }); st.open = null; render(); }
    catch (e) { alert('ลบไม่สำเร็จ: ' + (e.message || e)); }
  }

  // ---------------------------------------------------------------- Excel
  async function exportExcel() {
    if (!window.XLSX) await loadScript(XLSX_SRC);
    var head = ['ลำดับ', 'เขต', 'ไซด์งาน', 'เลขที่โครงการ', 'วงเงิน', 'วงเงิน/เดือน', 'จำนวนราย/ปี', 'จำนวนราย/เดือน', 'ราคากลาง', 'ราคาปี69', 'ราคาปี70', 'มูลค่าที่ราคาปี70 (รวม VAT)', 'วันที่', 'เวลา', 'วิธี', 'เลขที่เอกสาร', 'สถานะ', 'หมายเหตุ'];
    var data = [head].concat(visibleRows().map(function (r, i) {
      var d = derived(r);
      return [i + 1, r.zone || '', r.site || '', r.project_no || '', r.budget, d.budgetMonth, d.qty, d.qtyMonth == null ? null : Math.round(d.qtyMonth), r.mid_price, r.price_prev, r.price_bid,
        d.value == null ? null : Math.round(d.value * 100) / 100, thaiDate(r.bid_date), r.bid_time || '', r.method || '', r.doc_no || '', r.status || '', r.note || ''];
    }));
    var ws = window.XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = head.map(function (h, i) { return { wch: [6, 6, 16, 14, 13, 12, 12, 12, 9, 9, 9, 16, 11, 12, 12, 20, 10, 24][i] }; });
    var wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, '70');
    var d = new Date();
    window.XLSX.writeFile(wb, 'ประมูลงานแจ้งเตือน70_' + ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + (d.getFullYear() + 543) + '.xlsx');
  }

  // ---------------------------------------------------------------- page
  function style() {
    if (document.getElementById('nbStyle')) return;
    var s = document.createElement('style'); s.id = 'nbStyle';
    s.textContent = '.nb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;flex-wrap:wrap}.nb-head h2{margin:0 0 4px}.nb-head p{margin:0;color:#6b5d7a}' +
      '.nb-card{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:14px;margin-bottom:14px}' +
      '.nb-drop{border:2px dashed #cdbce0;border-radius:12px;padding:16px;text-align:center;color:#5a2787;cursor:pointer;background:#faf8fc}.nb-drop.drag{background:#efe6f8}' +
      '.nb-btn{border:0;border-radius:9px;padding:8px 13px;font-weight:800;cursor:pointer;background:#4b2378;color:#fff;font:inherit}.nb-btn.soft{background:#f2ebfa;color:#5a2787}.nb-btn:disabled{opacity:.45}.nb-btn.won{background:#fff4d6;color:#8a5a00}.nb-btn.won.on{background:#d99a00;color:#fff}' +
      '.nb-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.nb-bar select,.nb-bar input{border:1px solid #d9cfdf;border-radius:8px;padding:7px 8px;font:inherit}' +
      '.nb-pend{border:1px solid #e3d5f1;background:#fbf8fe;border-radius:12px;padding:12px;margin-top:12px}.nb-pend h4{margin:0 0 8px;color:#4d2376}.nb-pend small{color:#776a86}' +
      '.nb-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px 12px;margin:8px 0}.nb-form label{display:flex;flex-direction:column;font-size:12px;color:#5f5070;gap:3px}' +
      '.nb-form input,.nb-form select{border:1px solid #d9cfdf;border-radius:8px;padding:6px 8px;font:inherit;font-size:14px}.nb-form .miss input{border-color:#e0a24a;background:#fff8ec}' +
      '.nb-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}' +
      '.nb-site{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #e5dced;border-radius:10px;background:#fff;padding:10px 12px;font:inherit;font-weight:700;color:#3b2252;cursor:pointer}' +
      '.nb-site:hover{border-color:#7b4bab;background:#faf6fd}.nb-site .no{min-width:26px;color:#8a7a9a;font-weight:600;font-size:12px}.nb-site .go{margin-left:auto;color:#a08cb6}' +
      '.nb-site .nm{display:flex;flex-direction:column;gap:2px}.nb-site small{font-weight:600;font-size:12px;color:#6b5d7a}.nb-site.today{border-color:#3a9a5b;background:#f2fbf5}.nb-site.today small{color:#2d7a47}' +
      '.nb-item.today{border-radius:10px;animation:nbBlink 1s step-end infinite}@keyframes nbBlink{0%{box-shadow:0 0 0 3px #e11d2e}50%{box-shadow:0 0 0 3px transparent}}' +
      '@media (prefers-reduced-motion:reduce){.nb-item.today{animation:none;box-shadow:0 0 0 3px #e11d2e}}' +
      '.nb-site.past{opacity:.6}.nb-site.won{opacity:1;border-color:#d99a00;background:#fffaeb}.nb-site.won small{color:#8a5a00}.nb-site.lost small{color:#b42318}' +
      '.nb-item{position:relative;display:flex;flex-direction:column}.nb-item .nb-site{padding-right:44px;border-radius:10px 10px 0 0}.nb-item .nb-site .go{display:none}' +
      '.nb-q{border:1px solid #e5dced;border-top:0;border-radius:0 0 10px 10px;background:#f7f3fb;color:#5a2787;font:inherit;font-size:12px;font-weight:800;padding:6px 12px;text-align:left;cursor:pointer}.nb-q:hover{background:#efe6f8}' +
      '.nb-q1{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nb-up{display:block;font-weight:600;font-size:11.5px;color:#4d6b57;margin-top:1px}.nb-q.ok{background:#e9f7ee;color:#2d7a47}.nb-q.ok:hover{background:#dcf1e3}.nb-q.big{border:1px solid #e5dced;border-radius:9px;font-size:14px;padding:8px 13px}' +
      '.nb-foot{display:flex}.nb-foot .nb-q{flex:1;min-width:0;border-radius:0 0 0 10px}.nb-aim{flex:none;border:1px solid #e5dced;border-top:0;border-left:1px solid #f6c84c;border-radius:0 0 10px 0;background:#fff7ec;color:#c2410c;font:inherit;font-size:12px;font-weight:800;padding:6px 12px;cursor:pointer;white-space:nowrap}.nb-aim:hover{background:#ffedd5}.nb-aim.on{background:#f2581c;border-color:#f2581c;color:#fff}' +
      '.nb-x{position:absolute;top:24px;right:8px;transform:translateY(-50%);border:0;background:none;cursor:pointer;font-size:15px;opacity:.45;padding:6px;border-radius:8px}.nb-x:hover{opacity:1;background:#fbecec}' +
      '.nb-count{margin-top:10px;color:#6b5d7a;font-weight:700}' +
      '.nb-sum{display:flex;flex-direction:column;border:1px solid #f0c36d;background:#fff8e6;color:#8a5b00;border-radius:9px;padding:5px 12px;font-weight:700;line-height:1.3}.nb-sum small{font-size:12px;font-weight:600}' +
      '.nb-today{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;border:1px solid #d9c5ee;background:#f4ecfb;color:#4b2378;border-radius:10px;padding:8px 12px;margin-bottom:10px;font-weight:600}' +
      '.nb-today.none{background:#faf8fc;border-color:#eee7f4;color:#a497b2}.nb-today .chips{display:flex;gap:6px;flex-wrap:wrap}' +
      '.nb-today .chip{background:#fff;border:1px solid #d9c5ee;border-radius:999px;padding:2px 10px;font-size:13px;font-weight:700}.nb-today .chip.more{background:#e6d6f5}' +
      '.nb-detail{background:#fff;border:1px solid #e5dced;border-radius:14px;padding:16px}.nb-detail h3{margin:6px 0 2px;color:#4b2378;font-size:20px}' +
      '.nb-detail[data-state=saving]{box-shadow:inset 4px 0 #e0a24a}.nb-detail[data-state=err]{box-shadow:inset 4px 0 #d33}.nb-detail[data-state=ok]{box-shadow:inset 4px 0 #3a9a5b}' +
      '.nb-detail .nb-form input.r{text-align:right}.nb-detail .nb-form input.nb-bad{border-color:#d33;background:#fff0f0}' +
      '.nb-winner{margin:10px 0 0;padding:8px 10px;border:1px solid #f0dca0;border-radius:8px;background:#fffaf0;font-size:14px;color:#3b2252;line-height:1.5}' +
      '.nb-winner-past{margin-top:4px;font-size:13px;color:#6b5a7a}' +
      '.nb-ro{border:1px solid #eee7f4;border-radius:8px;padding:6px 8px;background:#f8f5fb;min-height:20px;text-align:right;font-size:14px;color:#3b2252}' +
      '.nb-empty{color:#776a86;padding:30px;text-align:center}.nb-warn{margin-top:8px;border:1px solid #f0c36d;background:#fff8e6;color:#8a5b00;border-radius:8px;padding:7px 10px;font-size:13px;font-weight:700}' +
      '.nb-tag{display:inline-block;border-radius:6px;padding:1px 6px;font-size:11px;background:#efe6f8;color:#5a2787;margin-left:4px}';
    document.head.appendChild(s);
  }
  function page() {
    var w = document.getElementById('noticeBidsWorkspace');
    if (w) return w;
    w = document.createElement('section');
    w.id = 'noticeBidsWorkspace'; w.style.display = 'none';
    (document.querySelector('main.main-shell') || document.querySelector('main') || document.body).appendChild(w);
    w.addEventListener('click', function (e) {
      var b = e.target.closest('[data-nb]'); if (!b) return;
      var a = b.getAttribute('data-nb'), i = +b.getAttribute('data-i');
      if (a === 'pick') w.querySelector('#nbFile').click();
      if (a === 'add') addRow();
      if (a === 'xlsx') exportExcel().catch(function (er) { alert('ส่งออก Excel ไม่สำเร็จ: ' + (er.message || er)); });
      if (a === 'del') deleteRow(i);
      if (a === 'line') sendLine(b);
      if (a === 'quote') {
        var row = (st.rows || []).filter(function (x) { return x.id === i; })[0];
        if (row && typeof window.openQuoteNoticeForSite === 'function') window.openQuoteNoticeForSite(row);
        else alert('ยังเปิดหน้าใบเสนอราคาไม่ได้ ลองรีเฟรชหน้าเว็บ');
      }
      if (a === 'blank') {   // the TOR has no quotation form: draw one from the site's figures (เสนอราคาแจ้งเตือน)
        var br = (st.rows || []).filter(function (x) { return x.id === i; })[0];
        if (br && typeof window.openQuoteNoticeBlank === 'function') window.openQuoteNoticeBlank(br);
        else alert('ยังเปิดหน้าใบเสนอราคาไม่ได้ ลองรีเฟรชหน้าเว็บ');
      }
      if (a === 'open') { st.open = i; render(); window.scrollTo(0, 0); }
      if (a === 'back') { st.open = null; render(); }
      if (a === 'won') { st.wonOnly = !st.wonOnly; render(); }
      if (a === 'map') { st.map = !st.map; render(); }
      // 📍 เป้าหมาย on a waiting site: pins it on the map, together with the other sites picked (pressed again: unpinned)
      if (a === 'aim') {
        var ai = st.aim.indexOf(i), added = ai < 0;
        if (added) st.aim.push(i); else st.aim.splice(ai, 1);
        saveAim();
        if (added) st.map = true;
        render();
        var mb = document.getElementById('nbMap');
        if (added && st.aim.length === 1 && mb && mb.scrollIntoView) mb.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (a === 'aimclear') { st.aim = []; saveAim(); render(); }
      if (a === 'setwon') {
        var wr = (st.rows || []).filter(function (x) { return x.id === i; })[0];
        if (wr) { cellChanged(i, 'status', won(wr) ? '' : 'ชนะประมูล'); render(); }
      }
      if (a === 'ok') confirmPending(i);
      if (a === 'drop') { st.pending.splice(i, 1); render(); }
      if (a === 'reload') { st.rows = null; render(); load(); }
    });
    w.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'nbFile') { openFiles(t.files).finally(function () { t.value = ''; }); return; }
      if (t.id === 'nbZone') { st.zone = t.value; render(); return; }
      var pi = t.getAttribute('data-p');
      if (pi != null) {
        var r = st.pending[+pi], k = t.getAttribute('data-k'), v = t.value.trim();
        if (k === 'target') { r.target = +v; render(); return; }
        else if (k === 'bid_date' || k === 'announce_date') r[k] = parseThaiDate(v) || null;
        else if (NUMS[k]) r[k] = v === '' ? null : Number(v.replace(/,/g, '')) || null;
        else r[k] = v || null;
        return;
      }
      var id = t.getAttribute('data-id'); if (id != null) cellChanged(+id, t.getAttribute('data-k'), t.value);
    });
    w.addEventListener('input', function (e) { if (e.target.id === 'nbQ') { st.q = e.target.value; clearTimeout(w._q); w._q = setTimeout(function () { renderTable(); }, 200); } else e.target.classList.remove('nb-bad'); });
    w.addEventListener('dragover', function (e) { e.preventDefault(); var d = w.querySelector('.nb-drop'); if (d) d.classList.add('drag'); });
    w.addEventListener('dragleave', function () { var d = w.querySelector('.nb-drop'); if (d) d.classList.remove('drag'); });
    w.addEventListener('drop', function (e) { e.preventDefault(); var d = w.querySelector('.nb-drop'); if (d) d.classList.remove('drag'); openFiles(e.dataTransfer.files); });
    return w;
  }
  function visibleRows() {
    var q = nameKey(st.q);
    return (st.rows || []).filter(function (r) {
      if (st.zone && (r.zone || '') !== (st.zone === '-' ? '' : st.zone)) return false;
      if (st.wonOnly && !won(r)) return false;
      return !q || nameKey(r.site).indexOf(q) >= 0 || String(r.project_no || '').indexOf(st.q.trim()) >= 0;
    }).sort(function (a, b) { return (a.seq || 1e9) - (b.seq || 1e9) || a.id - b.id; });
  }
  // a site we won is marked by its status ("ชนะประมูล")
  function won(r) { var t = String(r.status || ''); return t.indexOf('ชนะ') >= 0 && !lost(r); }
  // a result file whose lowest offer is not our quotation marks the site "ไม่ชนะประมูล" (❌)
  function lost(r) { return /ไม่ชนะ|แพ้/.test(String(r.status || '')); }
  // still waiting for its auction or result (the sites the map used to pin): not won, not lost, not cancelled
  // ยกเลิก holds only until the site is announced again: a cancelled row with an auction still to come (พิมาย, cancelled,
  // then re-announced for 9 พ.ย. 69) is waiting again, so it gets its 📍 เป้าหมาย and its pin
  function cancelled(r) { return String(r.status || '').indexOf('ยกเลิก') >= 0 && !(r.bid_date && !ended(r)); }
  function waiting(r) { return !won(r) && !lost(r) && !cancelled(r); }
  // 📍 เป้าหมาย: pins this site on the map; several sites can be picked (the map no longer pins every waiting site)
  function aimBtn(r) {
    if (!waiting(r)) return '';
    var on = st.aim.indexOf(r.id) >= 0;
    return '<button class="nb-aim' + (on ? ' on' : '') + '" data-nb="aim" data-i="' + r.id + '" title="' + (on ? 'เอาหมุดออกจากแผนที่' : 'ปักหมุดไซด์นี้บนแผนที่') + '">📍 เป้าหมาย</button>';
  }
  // the site list: auctions still to come (soonest first) and sites without a date on top, then the sites we won, then auctions over without a win (lost) at the bottom
  function todayIso() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }   // Bangkok calendar day
  // the auction is over once its day is past, or today after the end of its hours ("09.00-12.00 น." ends at 12:00)
  function ended(r) {
    var day = r.bid_date ? String(r.bid_date).slice(0, 10) : '', today = todayIso();
    if (!day || day > today) return false;
    if (day < today) return true;
    var t = String(r.bid_time || '').match(/(\d{1,2})[.:](\d{2})(?!.*\d{1,2}[.:]\d{2})/);
    if (!t) return false;
    var now = new Date(Date.now() + 7 * 3600e3);
    return now.getUTCHours() * 60 + now.getUTCMinutes() >= +t[1] * 60 + +t[2];
  }
  function byAuction(rows) {
    var group = function (r) { return won(r) ? 2 : !r.bid_date ? 1 : ended(r) ? 3 : 0; };
    return rows.slice().sort(function (a, b) {
      return group(a) - group(b) || String(a.bid_date || '').localeCompare(String(b.bid_date || '')) ||
        String(a.bid_time || '').localeCompare(String(b.bid_time || '')) || (a.seq || 1e9) - (b.seq || 1e9) || a.id - b.id;
    });
  }
  function pendingHtml() {
    if (!st.pending.length) return '';
    var opts = function (sel) {
      return '<option value="0"' + (sel ? '' : ' selected') + '>➕ เพิ่มเป็นแถวใหม่</option>' + (st.rows || []).slice().sort(function (a, b) { return String(a.site).localeCompare(String(b.site), 'th'); })
        .map(function (x) { return '<option value="' + x.id + '"' + (x.id === sel ? ' selected' : '') + '>แทนแถว: ' + esc((x.zone ? x.zone + ' ' : '') + x.site) + '</option>'; }).join('');
    };
    var F = [['zone', 'เขต'], ['site', 'ไซด์งาน'], ['project_no', 'เลขที่โครงการ (กรอกเอง)'], ['mid_price', 'ราคากลาง/ราย (กรอกเอง)'], ['budget', 'วงเงิน (รวม VAT)'], ['qty', 'จำนวนราย/ปี'],
      ['bid_date', 'วันที่เสนอราคา (วว/ดด/ปปปป)'], ['bid_time', 'เวลา'], ['method', 'วิธี'], ['doc_no', 'เลขที่เอกสาร'], ['announce_date', 'วันที่ประกาศ']];
    return st.pending.map(function (r, i) {
      var miss = [];
      if (!r.has_announce) miss.push('ประกาศ'); if (!r.has_tor) miss.push('TOR');
      var dup = duplicateOf(r.site, r.project_no, 0);
      return '<div class="nb-pend"><h4>ข้อมูลจาก PDF: ' + esc(r.office || r.site || 'ไม่ทราบสาขา') + '</h4><small>' + esc(r.files.join(' • ')) +
        (miss.length ? ' — ยังไม่มีไฟล์' + miss.join('/') + ' (ช่องที่ขาดกรอกเองได้)' : '') + '</small>' +
        (dup ? '<div class="nb-warn">⚠ ไซด์นี้มีอยู่ในตารางแล้ว: ' + esc(dupText(dup)) + ' — ' + (r.target ? 'จะบันทึกทับแถวที่เลือกในช่อง "บันทึกลง"' : 'ถ้าเพิ่มเป็นแถวใหม่จะซ้ำกัน') + '</div>' : '') +
        '<div class="nb-form">' +
        F.map(function (f) {
          var v = r[f[0]]; if (f[0] === 'bid_date' || f[0] === 'announce_date') v = thaiDate(v);
          var empty = v == null || v === '';
          return '<label class="' + (empty ? 'miss' : '') + '">' + f[1] + '<input data-p="' + i + '" data-k="' + f[0] + '" value="' + esc(empty ? '' : v) + '"></label>';
        }).join('') +
        '<label>บันทึกลง<select data-p="' + i + '" data-k="target">' + opts(r.target) + '</select></label></div>' +
        '<div class="nb-bar"><button class="nb-btn" data-nb="ok" data-i="' + i + '">✔ บันทึกลงตาราง</button><button class="nb-btn soft" data-nb="drop" data-i="' + i + '">ยกเลิก</button></div></div>';
    }).join('');
  }
  // a site whose auction hours end while the list is open drops to the bottom on its own
  function endedKey() { return todayIso() + ':' + (st.rows || []).filter(ended).map(function (r) { return r.id; }).join(','); }
  setInterval(function () {
    var box = document.getElementById('nbTable');
    if (box && box.offsetParent && st.rows && st.open == null && st.endedKey !== endedKey()) renderTable();
  }, 60e3);
  // the two summaries above the list follow the zone picked (not the search box or the 🏆 filter)
  function zoneRows() { return (st.rows || []).filter(function (r) { return !st.zone || (r.zone || '') === (st.zone === '-' ? '' : st.zone); }); }
  function perMonth(rows) { return rows.reduce(function (s, r) { return s + (derived(r).qtyMonth || 0); }, 0); }
  function renderSummary() {
    var rows = zoneRows(), today = todayIso();
    var sum = document.getElementById('nbOpenSum');
    if (sum) {
      // still up for grabs: an auction still to come (not past, not won, not cancelled); sites without a date add no ราย yet
      var ahead = rows.filter(function (r) { return r.bid_date && !ended(r) && !won(r) && !cancelled(r); });
      sum.innerHTML = '<span>ยังไม่ประมูล <b>' + fmt(Math.round(perMonth(ahead))) + '</b> ราย/เดือน</span><small>จาก ' + ahead.length + ' ไซด์ที่ยังไม่ถึงเวลาประมูล</small>';
    }
    var bar = document.getElementById('nbToday');
    if (bar) {
      var todays = rows.filter(function (r) { return r.bid_date && String(r.bid_date).slice(0, 10) === today; });
      var p = today.split('-'), date = p[2] + '/' + p[1] + '/' + (Number(p[0]) + 543);
      bar.classList.toggle('none', !todays.length);
      bar.innerHTML = !todays.length ? 'วันนี้ไม่มีประมูล' :
        '<b>📅 ประมูลวันนี้ ' + date + '</b> · ' + todays.length + ' ไซด์ · ' + fmt(Math.round(perMonth(todays))) + ' ราย/เดือน<span class="chips">' +
        todays.map(function (r) { var m = derived(r).qtyMonth; return '<span class="chip">' + esc(r.site || '(ไม่มีชื่อไซด์)') + (m ? ' · ' + fmt(Math.round(m)) + '/เดือน' : '') + '</span>'; }).join('') +
        '</span>';
    }
  }
  function drawMap(open) {
    var mapBox = document.getElementById('nbMap');
    if (arguments.length === 0) open = st.open != null;   // redrawn on its own (sub-branches read): hidden while a site is open
    if (mapBox) mapBox.innerHTML = st.map && !open && window.NoticeMap ? (window.NoticeMap.setQty(function (r) { return derived(r).qty; }), window.NoticeMap.setFocus && window.NoticeMap.setFocus(st.aim), window.NoticeMap.html(st.rows)) : '';
  }
  // the menu lists the sites by name only; a site's details open when its name is clicked
  function renderTable() {
    var box = document.getElementById('nbTable'); if (!box) return;
    if (st.rows == null) { box.innerHTML = '<div class="nb-empty">กำลังโหลด…</div>'; return; }
    if (st.err) { box.innerHTML = '<div class="nb-empty">โหลดตารางไม่สำเร็จ: ' + esc(st.err) + ' <button class="nb-btn soft" data-nb="reload">ลองใหม่</button></div>'; return; }
    var open = st.open != null ? (st.rows || []).filter(function (x) { return x.id === st.open; })[0] : null;
    // the map of the 5 provinces follows the rows: drawn again with the list every time a status changes (js/notice-map.js)
    drawMap(open);
    if (st.map && !open) syncBranches();   // a site just marked won gets its sub-branches (read once per quotation)
    if (open) { box.innerHTML = detailHtml(open); return; }
    st.open = null; st.endedKey = endedKey();
    renderSummary();
    var rows = byAuction(visibleRows()), today = todayIso();
    box.innerHTML = rows.length ? '<div class="nb-list">' + rows.map(function (r, i) {
      var day = r.bid_date ? String(r.bid_date).slice(0, 10) : '';
      var over = ended(r), now = day === today && !over;
      var when = day ? (now ? '<b>วันนี้</b> ' : '') + thaiDate(day) + (r.bid_time ? ' · ' + esc(r.bid_time) + ' น.' : '') + (won(r) || lost(r) ? '' : over ? ' · ประมูลไปแล้ว' : '') : 'ยังไม่มีวันประมูล';
      if (won(r)) when += ' · 🏆 ชนะประมูล';
      else if (lost(r)) when += ' · ❌ ไม่ชนะประมูล';
      // the winner read from ประกาศผู้ชนะ: shown for a site someone else won (a won site's winner is us)
      var wn = winnerOf(r);
      if (wn && !won(r)) when += '<br>ผู้ชนะ: ' + esc(wn.name) + (wn.price ? ' · ' + fmt(wn.price, 2) + ' บาท/ราย' : '');
      return '<div class="nb-item' + (now ? ' today' : '') + '"><button class="nb-site' + (over ? ' past' : '') + (won(r) ? ' won' : '') + (lost(r) ? ' lost' : '') + (now ? ' today' : '') + '" data-nb="open" data-i="' + r.id + '"><span class="no">' + (i + 1) + '</span>' +
        '<span class="nm">' + esc(r.site || '(ไม่มีชื่อไซด์)') + '<small>' + when + '</small></span><span class="go">›</span></button>' +
        (waiting(r) ? '<div class="nb-foot">' + quoteBtn(r) + aimBtn(r) + '</div>' : quoteBtn(r)) +
        '<button class="nb-x" data-nb="del" data-i="' + r.id + '" title="ลบไซด์นี้" aria-label="ลบ ' + esc(r.site || '') + '">🗑</button></div>';
    }).join('') + '</div><div class="nb-count">รวม ' + rows.length + ' ไซด์</div>' : '<div class="nb-empty">ยังไม่มีข้อมูล</div>';
  }
  function field(r, k, label, cls) {
    var v = r[k]; if (k === 'bid_date' || k === 'announce_date') v = thaiDate(v);
    if (k === 'budget' && v != null) v = fmt(v, 2);
    return '<label>' + label + '<input class="' + (cls || '') + '" data-id="' + r.id + '" data-k="' + k + '" value="' + esc(v == null ? '' : v) + '"></label>';
  }
  // ประกาศผู้ชนะ read into this site: the latest winner, and the ones before it (a re-announced site)
  function winnerOf(r) { var w = (r && r.source && r.source.winner) || null; return w && w.name ? w : null; }
  function winnerHtml(r) {
    var w = winnerOf(r); if (!w) return '';
    var line = function (x) {
      return '<b>' + esc(x.name) + '</b>' + (x.price ? ' · ' + fmt(x.price, 2) + ' บาท/ราย' : '') + (x.total ? ' · รวม ' + fmt(x.total, 2) + ' บาท (รวม VAT)' : '') +
        (x.date ? ' · ประกาศ ' + thaiDate(x.date) : '');
    };
    var past = (r.source.winners || []).filter(function (x) { return x && x.name && !(x.name === w.name && x.date === w.date); });
    return '<div class="nb-winner">🏆 ผู้ชนะการเสนอราคา: ' + line(w) +
      (past.length ? '<div class="nb-winner-past">ประวัติก่อนหน้า: ' + past.map(line).join('<br>') + '</div>' : '') + '</div>';
  }
  function shown(label, key, v) { return '<label>' + label + '<div class="nb-ro" data-d="' + key + '">' + v + '</div></label>'; }
  function detailHtml(r) {
    var d = derived(r);
    return '<div class="nb-bar"><button class="nb-btn soft" data-nb="back">← กลับไปรายชื่อไซด์</button></div>' +
      '<div class="nb-detail" data-row="' + r.id + '"><h3 data-d="name">' + esc(r.site || '(ไม่มีชื่อไซด์)') + '</h3><small>แก้ไขได้ทุกช่อง บันทึกอัตโนมัติ</small><div class="nb-bar" style="margin:10px 0 0">' + quoteBtn(r, true) +
        '<button class="nb-q big" data-nb="blank" data-i="' + r.id + '" title="สำหรับไซด์ที่ TOR ไม่มีแบบฟอร์มใบเสนอราคา"><span class="nb-q1">📝 ใช้แบบฟอร์มเปล่า</span></button>' +
        '<button class="nb-btn won' + (won(r) ? ' on' : '') + '" data-nb="setwon" data-i="' + r.id + '">' + (won(r) ? '🏆 ชนะประมูลแล้ว (กดเพื่อยกเลิก)' : '🏆 ทำเครื่องหมายว่าชนะประมูล') + '</button></div>' + winnerHtml(r) + '<div class="nb-form">' +
      field(r, 'zone', 'เขต') + field(r, 'site', 'ไซด์งาน') + field(r, 'office', 'สาขา') + field(r, 'project_no', 'เลขที่โครงการ') +
      field(r, 'budget', 'วงเงิน (รวม VAT)', 'r') + shown('วงเงิน/เดือน', 'bm', fmt(d.budgetMonth, 2)) +
      '<label>จำนวนราย/ปี<input class="r" data-id="' + r.id + '" data-k="qty" value="' + esc(r.qty == null ? '' : fmt(r.qty)) + '" placeholder="' + (d.est ? fmt(d.qty) : '') + '" title="ว่าง = คำนวณจากวงเงิน ÷ 1.07 ÷ ราคากลาง"></label>' +
      shown('จำนวนราย/เดือน', 'qm', fmt(d.qtyMonth, 0)) +
      field(r, 'mid_price', 'ราคากลาง', 'r') + field(r, 'price_prev', 'ราคาปี69', 'r') + field(r, 'price_bid', 'ราคาปี70', 'r') + shown('มูลค่าที่ราคาปี70 (รวม VAT)', 'val', fmt(d.value, 2)) +
      field(r, 'bid_date', 'วันที่เสนอราคา (วว/ดด/ปปปป)') + field(r, 'bid_time', 'เวลา') + field(r, 'method', 'วิธี') + field(r, 'doc_no', 'เลขที่เอกสาร') +
      field(r, 'announce_date', 'วันที่ประกาศ (วว/ดด/ปปปป)') + field(r, 'status', 'สถานะ') + field(r, 'note', 'หมายเหตุ') +
      '</div><div class="nb-bar"><button class="nb-btn soft" data-nb="del" data-i="' + r.id + '">🗑 ลบไซด์นี้</button></div></div>';
  }
  function render() {
    var w = page();
    var zones = {}; (st.rows || []).forEach(function (r) { zones[r.zone || '-'] = 1; });
    w.innerHTML = '<div class="nb-head"><div><h2>ตารางประมูลแจ้งเตือน ปี 2570</h2><p>วางไฟล์ PDF ประกาศ + TOR ระบบอ่านข้อมูลเข้าตาราง • กดชื่อไซด์เพื่อดูและแก้รายละเอียด • กด 📄 ใต้ชื่อไซด์เพื่อทำ/เปิดใบเสนอราคา บันทึกอัตโนมัติ</p></div></div>' +
      '<div class="nb-card"><input type="file" id="nbFile" accept="application/pdf,.pdf" multiple hidden>' +
      '<div class="nb-drop" data-nb="pick">' + (st.busy ? esc(st.busy) : '📄 กดเพื่อเลือกไฟล์ PDF ประกาศ และ TOR (เลือกหลายไฟล์พร้อมกันได้)<br><small>หรือลากไฟล์มาวางที่นี่ • วางไฟล์ "สรุปข้อมูลการเสนอราคาเบื้องต้น" เพื่อใส่ราคาผู้ชนะ (ก่อน VAT) ในช่องราคาปี70</small>') + '</div>' + pendingHtml() + '</div>' +
      '<div class="nb-bar"' + (st.open != null ? ' style="display:none"' : '') + '><select id="nbZone"><option value="">ทุกเขต</option>' + Object.keys(zones).sort().map(function (z) { return '<option value="' + esc(z) + '"' + (z === st.zone ? ' selected' : '') + '>' + (z === '-' ? 'ไม่ระบุเขต' : esc(z)) + '</option>'; }).join('') + '</select></div>' +
      '<div id="nbToday" class="nb-today"' + (st.open != null ? ' style="display:none"' : '') + '></div>' +
      '<div class="nb-bar"' + (st.open != null ? ' style="display:none"' : '') + '>' +
      '<input id="nbQ" placeholder="ค้นหาไซด์งาน / เลขที่โครงการ" value="' + esc(st.q) + '">' +
      '<button class="nb-btn won' + (st.wonOnly ? ' on' : '') + '" data-nb="won" title="แสดงเฉพาะไซด์ที่ชนะประมูล">🏆 ชนะประมูล ' + wonSummary() + '</button>' +
      '<button class="nb-btn won' + (st.map ? ' on' : '') + '" data-nb="map" title="แผนที่ 5 จังหวัด: 🏆 ไซด์ที่ชนะ • กด 📍 เป้าหมาย ที่ไซด์รอประมูลเพื่อปักหมุด">🗺 แผนที่</button>' +
      '<button class="nb-btn soft" data-nb="add">➕ เพิ่มแถว</button><button class="nb-btn soft" data-nb="xlsx">⬇ Excel</button><button class="nb-btn soft" data-nb="line" title="ส่งไซด์ที่เคาะราคาวันนี้เข้า LINE แอดมิน (วันที่มีประมูล ระบบส่งเอง 07:00 และทุก 30 นาที 09:00-12:00, 13:00-16:00)">📣 ส่งเข้า LINE แอดมิน</button><div id="nbOpenSum" class="nb-sum"></div></div>' +
      '<div id="nbMap"></div><div id="nbTable"></div>';
    renderTable();
  }

  // ---------------------------------------------------------------- menu (admin only, like เสนอราคาแจ้งเตือน)
  function isAdmin() {
    var u = window.currentMenuUser || null;
    if (!u) { try { u = JSON.parse(localStorage.getItem('divergent_web_session_user') || 'null'); } catch (_) { u = null; } }
    var role = (u && u.role) || (window.qcAuthorizedUser && window.qcAuthorizedUser.user_role) || '';
    // only the main "admin" account, not every user whose role is admin
    return String(role).toLowerCase() === 'admin' && String((u && u.username) || '').toLowerCase() === 'admin';
  }
  function syncNav() {
    var nav = document.getElementById('navNoticeBids'); if (!nav) return;
    var want = isAdmin() ? '' : 'none';
    if (nav.style.display !== want) nav.style.display = want;
  }
  function ensureNav() {
    var side = document.querySelector('.side-nav');
    if (!side || document.getElementById('navNoticeBids')) return;
    var nav = document.createElement('div');
    nav.className = 'nav-item'; nav.id = 'navNoticeBids'; nav.style.display = 'none';
    nav.innerHTML = '<span class="nav-ico">📊</span><span>ตารางประมูลแจ้งเตือน</span>';
    nav.addEventListener('click', showPage);
    var ref = document.getElementById('navQuoteNotice');
    if (ref) ref.insertAdjacentElement('afterend', nav); else side.appendChild(nav);
    syncNav();
  }
  function showPage() {
    if (!isAdmin()) { alert('เมนูนี้เปิดให้เฉพาะผู้ดูแลระบบ (admin)'); return; }
    var w = page();
    document.querySelectorAll('.side-nav .nav-item').forEach(function (x) { x.classList.toggle('active', x.id === 'navNoticeBids'); });
    document.querySelectorAll('.main-shell [id$="Workspace"]').forEach(function (el) { if (el !== w && !w.contains(el)) el.style.display = 'none'; });
    w.style.display = 'block';
    st.open = null; st.quotes = null;
    document.documentElement.classList.add('sa-wide');
    window.scrollTo(0, 0);
    render();
    if (st.rows == null || st.err) load();
    st.quotesP = loadQuotes();
    loadPdfJs().catch(function () {});
  }
  window.openNoticeBids = showPage;

  function boot() {
    style(); ensureNav();
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { ensureNav(); syncNav(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

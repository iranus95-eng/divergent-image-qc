/* ชื่อไฟล์ที่ส่งออก/บันทึกทุกเมนู: <ชื่อไฟล์>_<วันที่บันทึก วว-ดด-ปปปป (พ.ศ.)>.<นามสกุล>
 * วันที่ = วันที่กดบันทึก ตามเวลาไทย (Asia/Bangkok)
 *   dqFileName('ใบแจ้งหนี้_INV001', 'pdf') → 'ใบแจ้งหนี้_INV001_26-10-2569.pdf'
 *   dqPrintAs('รายงานกำไรขาดทุน')          → window.print() โดยชื่อไฟล์ PDF ตั้งต้นเป็น 'รายงานกำไรขาดทุน_26-10-2569'
 * กันลืม: ทุกครั้งที่โค้ดตั้ง a.download แล้วชื่อยังไม่มีวันที่ จะเติมวันที่ให้อัตโนมัติ
 */
(function () {
  'use strict';
  var DATED = /\d{2}-\d{2}-\d{4}/;
  function fileDate(d) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.day + '-' + p.month + '-' + (Number(p.year) + 543);
  }
  function clean(s) { return String(s == null ? '' : s).replace(/[\\\/:*?"<>|\r\n\t]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function fileName(name, ext) {
    return (clean(name) || 'ไฟล์') + '_' + fileDate() + (ext ? '.' + String(ext).replace(/^\./, '') : '');
  }
  function stamp(name) {
    var s = String(name == null ? '' : name);
    if (!s || DATED.test(s)) return s;
    var m = s.match(/^(.+?)\.([A-Za-z0-9]{1,5})$/);
    return m ? fileName(m[1], m[2]) : fileName(s);
  }
  function printAs(name, win) {
    win = win || window;
    var doc = win.document, old = doc.title, done = false;
    function restore() { if (!done) { done = true; doc.title = old; } }
    doc.title = DATED.test(name) ? name : fileName(name);
    win.addEventListener('afterprint', restore, { once: true });
    win.print();
    setTimeout(restore, 60000);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  // แสดง PDF ในหน้าต่างที่เปิดไว้ พร้อมชื่อไฟล์และปุ่มดาวน์โหลดที่ใช้ชื่อนั้น
  // (เปิด blob ตรง ๆ เบราว์เซอร์จะตั้งชื่อไฟล์เป็นรหัสสุ่ม) มือถือยังเปิดตัวดู PDF เต็มจอเหมือนเดิม
  function showPdf(win, blob, name) {
    name = stamp(name);
    var url = URL.createObjectURL(blob);
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
      try { win.location.replace(url); } catch (_) { win.location.href = url; }
      return;
    }
    var doc = win.document, n = esc(name);
    doc.open();
    doc.write('<!doctype html><html lang="th"><head><meta charset="utf-8"><title>' + n + '</title><style>' +
      'html,body{margin:0;height:100%}body{display:flex;flex-direction:column;font-family:Tahoma,sans-serif}' +
      '.bar{display:flex;gap:10px;align-items:center;padding:8px 12px;background:#3b2366;color:#fff;font-size:14px}' +
      '.bar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.bar a{background:#fff;color:#3b2366;border-radius:8px;padding:6px 12px;font-weight:700;text-decoration:none;white-space:nowrap}' +
      'iframe{flex:1;border:0;width:100%}</style></head><body><div class="bar"><span>' + n + '</span>' +
      '<a download="' + n + '" href="' + url + '">⬇ ดาวน์โหลด PDF</a></div><iframe src="' + url + '" title="' + n + '"></iframe></body></html>');
    doc.close();
  }
  window.dqFileDate = fileDate;
  window.dqFileName = fileName;
  window.dqStampFileName = stamp;
  window.dqPrintAs = printAs;
  window.dqShowPdf = showPdf;

  var desc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download');
  if (desc && desc.set && desc.configurable) {
    Object.defineProperty(HTMLAnchorElement.prototype, 'download', {
      configurable: true, enumerable: desc.enumerable, get: desc.get,
      set: function (v) { desc.set.call(this, stamp(v)); }
    });
  }
})();

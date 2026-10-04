/* จัดการเงินเดือน: trash button per row (2026-10-04).
 * Soft delete through payroll-delete-api: the employee's rows for that payroll month become inactive
 * (all areas), so they leave the list and reports; data is kept and can be restored. */
(function () {
  'use strict';
  var API = 'https://neauzvqroaszvqffahkv.functions.supabase.co/payroll-delete-api';
  async function token() {
    try { if (typeof window.getBestDataToken === 'function') { var t = await window.getBestDataToken(); if (t) return t; } } catch (_) {}
    try { return localStorage.getItem('divergent_web_session_token_v1') || localStorage.getItem('divergent_fallback_session_token') || ''; } catch (_) { return ''; }
  }
  async function call(body) {
    var t = await token(); if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    var r = await fetch(API, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error === 'PAYROLL_MANAGE_DENIED' ? 'ไม่มีสิทธิ์ลบข้อมูลเงินเดือน' : (j.error || 'HTTP ' + r.status));
    return j;
  }
  window.deletePayrollEmployee = async function (id) {
    var list = []; try { list = payrollEmployees || []; } catch (_) {} // eslint-disable-line no-undef
    var e = list.find(function (x) { return Number(x.id) === Number(id); }) || {};
    var name = e.employee_name || ('รายการ #' + id);
    var areas = Number(e.area_count || 1);
    if (!confirm('ลบ ' + name + ' ออกจากรายการเงินเดือนเดือนนี้?' + (areas > 1 ? '\n(รวมทั้ง ' + areas + ' พื้นที่)' : '') + '\n\nข้อมูลจะไม่ถูกลบถาวร ผู้ดูแลกู้คืนได้')) return;
    try {
      var j = await call({ action: 'delete_employee', id: id });
      try { // drop locally right away, then reload from the server
        var keep = list.filter(function (x) { return Number(x.id) !== Number(id); });
        payrollEmployees = keep; if (typeof filterPayrollEmployees === 'function') filterPayrollEmployees(); // eslint-disable-line no-undef
      } catch (_) {}
      if (typeof window.loadPayrollEmployees === 'function') { try { await window.loadPayrollEmployees(true); } catch (_) {} }
      var st = document.getElementById('payrollStatus');
      if (st) st.textContent = 'ลบ ' + (j.employee_name || name) + ' ออกจากรายการแล้ว (' + (j.removed_rows || 0) + ' แถว)';
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + (err.message || err));
    }
  };
})();

const assert = require('node:assert/strict');
const CG = require('../js/contract-guarantee.js');
// วันที่แบบในไฟล์ LG ปี 2570
assert.equal(CG.thDate('2026-11-19'), '19/11/2569');
assert.equal(CG.thDate(''), '');
assert.equal(CG.period({ period_start: '2027-01-01', period_end: '2027-12-31' }), '1/1/2570-31/12/2570');
assert.equal(CG.period({}), '');
// เงินค้ำประกัน 5% ของค่าจ้างรวม VAT ปัดขึ้น ตรงกับ 3 รายการในชีตตราสาร2570
assert.equal(CG.calcGuarantee(302400), 16179);
assert.equal(CG.calcGuarantee(409200), 21893);
assert.equal(CG.calcGuarantee(834000), 44619);
assert.equal(CG.calcGuarantee(''), null);
assert.equal(CG.money(146447), '146,447');
assert.equal(CG.money(null), '');
const rows = [
  { id: 1, contract_year: 2570, seq: 1, pea_office: 'การไฟฟ้าส่วนภูมิภาคอำเภอหนองบุญมาก', tax_id: '0994000165501', branch_no: '00602', contract_no: '024/2569', wage_ex_vat: 302400, guarantee_amount: 16179, lg_done: false, stamp_done: true },
  { id: 2, contract_year: 2570, seq: 2, pea_office: 'การไฟฟ้าส่วนภูมิภาคสาขาโชคชัย', guarantee_amount: 19338, lg_done: true, stamp_done: true, note: 'a "quoted", note' },
  { id: 3, contract_year: 2569, seq: 1, pea_office: 'การไฟฟ้าส่วนภูมิภาคสาขาพุทไธสง', guarantee_amount: 100, lg_done: false, stamp_done: false },
];
const ids = (f) => rows.filter((r) => CG.matches(r, f)).map((r) => r.id);
assert.deepEqual(ids({ year: '2570' }), [1, 2]);
assert.deepEqual(ids({ state: 'nolg' }), [1, 3]);
assert.deepEqual(ids({ state: 'nostamp' }), [3]);
assert.deepEqual(ids({ state: 'done' }), [2]);
assert.deepEqual(ids({ q: 'โชคชัย' }), [2]);
assert.deepEqual(ids({ q: '024/2569' }), [1]);
const t = CG.totals(rows.slice(0, 2));
assert.deepEqual([t.count, t.guarantee, t.noLg, t.noLgAmt, t.noStamp], [2, 35517, 1, 16179, 0]);
const csv = CG.toCsv(rows.slice(0, 2));
assert.ok(csv.startsWith('﻿ลำดับ,ชื่อการไฟฟ้า,เลขผู้เสียภาษี'));
assert.ok(csv.includes('="0994000165501",="00602"'));
assert.ok(csv.includes('"a ""quoted"", note"'));
assert.ok(csv.trim().endsWith(',รวม,,,,,,302400,35517'));
assert.equal(CG.esc('<b>'), '&lt;b&gt;');
console.log('PASS: contract-guarantee');

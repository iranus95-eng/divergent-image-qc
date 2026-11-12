const assert = require('node:assert/strict');
const EC = require('../js/employee-card.js');
// แบบบัตรตาม TOR ข้อ 4.1 (7)
assert.equal(EC.thDate('2026-11-12'), '12 พ.ย. 2569');
assert.equal(EC.thDate('2026-12-31'), '31 ธ.ค. 2569');
assert.equal(EC.thDate(''), '');
assert.deepEqual(EC.splitName('นายสมชาย  ใจดี'), ['นายสมชาย', 'ใจดี']);
assert.deepEqual(EC.splitName('ว่าที่ ร.ต.สมชาย ใจดี'), ['ว่าที่ ร.ต.สมชาย', 'ใจดี']);
assert.deepEqual(EC.splitName('สมชาย'), ['สมชาย', '']);
assert.equal(EC.cardNo({ card_no: 7, card_year: 2569 }), '007/2569');
assert.equal(EC.fixThai('ชุุมพวง'), 'ชุมพวง');
assert.equal(EC.fixThai('ภููเขียว'), 'ภูเขียว');
assert.equal(EC.fixThai('หนองบุัวระเหว'), 'หนองบัวระเหว');
assert.equal(EC.officeOf('สตาร์ฟ'), '');
assert.equal(EC.officeOf('QC ไฟฟ้า'), '');
assert.equal(EC.officeOf('ภูเขียว'), 'ภูเขียว');
const c = { card_no: 7, card_year: 2569, full_name: 'นายสมชาย <ใจดี>', pea_office: 'ภูเขียว', issue_date: '2026-11-12', expire_date: '2026-12-31' };
const f = EC.front(c, { signer_name: 'นายผู้จัดการ', phone: '044-000000' });
for (const t of ['บัตรประจำตัวผู้รับจ้างการไฟฟ้าส่วนภูมิภาค', 'ปฏิบัติงานเกี่ยวกับมิเตอร์', 'เลขที่ <b>007/2569</b>', 'นามสกุล <b>&lt;ใจดี&gt;</b>',
  'ผู้รับจ้างเหมา <b>บริษัท ไดเวอร์เจนท์ คอร์ปอเรชั่น จำกัด</b>', 'ประจำ กฟฟ.<b>ภูเขียว</b>', 'วันที่ออกบัตร <b>12 พ.ย. 2569</b>',
  'วันที่บัตรหมดอายุ <b>31 ธ.ค. 2569</b>', 'ผู้ลงนาม', '(นายผู้จัดการ)', 'โทร <b>044-000000</b>', 'ผจก.กฟฟ.คู่สัญญา ฯ', 'รูปถ่าย "1"']) assert.ok(f.includes(t), t);
assert.ok(EC.CARD_CSS.includes('width:90mm;height:60mm'));
const b = EC.back();
assert.equal(EC.RULES.length, 7);
assert.ok(b.includes('ข้อปฏิบัติในการใช้บัตร') && b.includes('บัตรนี้เป็นทรัพย์สินของ กฟภ.'));
// duplex (default): 3 cards -> one front sheet + one back sheet; backs mirrored per row (card 3 left on the front, right on the back)
const sh = EC.sheets([c, c, c], {});
const pages = sh.split('<section class="ec-sheet">').slice(1);
assert.equal(pages.length, 2);
const slots = (p) => p.match(/class="ec-(card ec-front|card ec-back|slot)"/g).map((m) => m.includes('slot') ? '-' : 'X');
assert.deepEqual(slots(pages[0]), ['X', 'X', 'X', '-']);
assert.deepEqual(slots(pages[1]), ['X', 'X', '-', 'X']);
assert.equal(EC.sheets(new Array(9).fill(c), {}).split('<section').length - 1, 4);
// pair: 5 cards -> 2 sheets (4 + 1); every card is a front followed by its own back, side by side
const sp = EC.sheets([c, c, c, c, c], {}, 'pair').split('<section class="ec-sheet">').slice(1);
assert.equal(sp.length, 2);
const sides = (p) => p.match(/class="ec-card ec-(front|back)"/g).map((m) => m.includes('front') ? 'F' : 'B');
assert.deepEqual(sides(sp[0]), ['F', 'B', 'F', 'B', 'F', 'B', 'F', 'B']);
assert.deepEqual(sides(sp[1]), ['F', 'B']);
// cards per sheet: 3 cards at 1 per sheet two-sided -> 3 fronts + 3 backs = 6 pages; 2 per sheet -> 4 pages
assert.equal(EC.sheets([c, c, c], {}, 'duplex', 1).split('<section').length - 1, 6);
assert.equal(EC.sheets([c, c, c], {}, 'duplex', 2).split('<section').length - 1, 4);
assert.equal(EC.sheets([c, c, c], {}, 'pair', 1).split('<section').length - 1, 3);
// one card per sheet two-sided: front at the left, its back at the right of the next page
const one = EC.sheets([c], {}, 'duplex', 1).split('<section class="ec-sheet">').slice(1).map(slots);
assert.deepEqual(one, [['X', '-'], ['-', 'X']]);
assert.equal(EC.perSheet('pair', 9), 4); assert.equal(EC.perSheet('duplex', 0), 8); assert.equal(EC.perSheet('duplex', 3), 3);
console.log('PASS: employee-card');

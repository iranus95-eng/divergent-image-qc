const assert=require('node:assert/strict');
const path=require('node:path');
const L=require('../js/location-screenshot-ca.js');
const lines=require('./fixtures/location-screenshot-lines.json');
const items=L.parseCaItems(lines);
assert.deepEqual(items.map(x=>x.ca),['020011110001','020011110002','020011110003','020011110004']);
assert.deepEqual(items.map(x=>x.pea_no),['11223301','11223302','6000000003','5600000004']);
assert.equal(items[0].name,'นางทดสอบ ตัวอย่างหนึ่ง');
assert.match(items[2].address,/3\/1 .*30170$/);
/* เครื่องหมายติ๊กสีเขียวอยู่ที่ y≈510 (รายการที่ 1) */
const w=100,h=1900,px=new Uint8ClampedArray(w*h*4).fill(255);
for(let y=492;y<528;y++)for(let x=2;x<9;x++){const i=(y*w+x)*4;px[i]=30;px[i+1]=130;px[i+2]=80}
for(let y=505;y<509;y++)for(let x=2;x<9;x++){const i=(y*w+x)*4;px[i]=255;px[i+1]=255;px[i+2]=255}
const marks=L.findGreenChecks(px,w,h);
assert.equal(marks.length,1);
assert.deepEqual(L.markChecked(items,marks).map(x=>x.checked),[true,false,false,false]);
/* ข้อความรูปแบบอื่น: เก็บเลข 12 หลักขึ้นต้น 020 */
assert.deepEqual(L.parseCaItems([{text:'ลูกค้า 0200 1327 0461 ค้างชำระ',y0:0,y1:1}]).map(x=>x.ca),['020013270461']);
console.log('PASS: screenshot CA parser, checked-item detection');

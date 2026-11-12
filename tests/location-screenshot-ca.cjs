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
assert.deepEqual(items.map(x=>x.mru),['FSUN0167-187590','FSUN0167-187591','FSUN0167-187700','FSUN0167-188185']);
/* รูปที่ 2: OCR อ่าน ชือ/ทีอยู่ (สระหาย), MRU มี O เกิน, ที่อยู่ขึ้นบรรทัดใหม่ */
const items2=L.parseCaItems(['(1) MRU : DMJK0174-048100','CA: 020011110005','ชือ-นามสกุล : นางทดสอบ สี่','  ทีอยู่ : 88 บ.หนองหัวช้าง ต.หนองแปน อ.มัญจาคีรี จ.ขอนแก่น','40160','Tel No. :','(2) MRU : DMJKO0174-048401','CA: 020011110006','  ทีอยู่ : 137 บ.หนองหัวช้าง ต.หนองแปน อ.มัญจาคีรี','จ.ขอนแก่น 40160','Tel No. : 0800000000'].map((text,i)=>({text,y0:i,y1:i})));
assert.deepEqual(items2.map(x=>x.mru),['DMJK0174-048100','DMJK0174-048401']);
assert.equal(items2[0].name,'นางทดสอบ สี่');
assert.equal(items2[0].address,'88 บ.หนองหัวช้าง ต.หนองแปน อ.มัญจาคีรี จ.ขอนแก่น 40160');
assert.equal(items2[1].address,'137 บ.หนองหัวช้าง ต.หนองแปน อ.มัญจาคีรี จ.ขอนแก่น 40160');
console.log('PASS: screenshot CA parser, checked-item detection');

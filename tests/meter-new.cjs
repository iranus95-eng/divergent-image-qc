const assert=require('node:assert/strict');
const M=require('../js/meter-new.js');
const base={far_m:1000};
/* 1) มีพิกัดมิเตอร์ และใกล้บ้านข้างเคียง → ใช้พิกัดมิเตอร์ */
let r=M.recommend({...base,customer:{lat:16.14638,lng:102.6187},neighbours:{estimate:{lat:16.1465,lng:102.6187},spread_m:120,before:[],after:[]},longdo:{lat:16.1629,lng:102.5948,has_moo:false},checks:{customer_vs_neighbours_m:13,longdo_vs_neighbours_m:3100}});
assert.equal(r.pick.kind,'customer');
assert.ok(r.warns.some(w=>w.includes('ที่อยู่ห่างจากบ้านข้างเคียง 3.1 กม.')));
assert.ok(r.warns.some(w=>w.includes('ไม่มีเลขหมู่')));
/* 2) พิกัดมิเตอร์ผิด (ห่างบ้านข้างเคียง 12 กม.) → ใช้บ้านข้างเคียง */
r=M.recommend({...base,customer:{lat:14.89199,lng:101.91412},neighbours:{estimate:{lat:14.8697,lng:101.8023},spread_m:40,before:[],after:[]},longdo:null,checks:{customer_vs_neighbours_m:12300}});
assert.equal(r.pick.kind,'neighbours');
assert.ok(r.warns.some(w=>w.includes('12.3 กม.')));
/* 3) ลูกค้าใหม่ ไม่อยู่ในฐาน มีบ้านข้างเคียง */
r=M.recommend({...base,customer:null,neighbours:{estimate:{lat:1,lng:2},spread_m:2500,before:[],after:[]},longdo:{lat:1.001,lng:2,has_moo:true},checks:{longdo_vs_neighbours_m:110}});
assert.equal(r.pick.kind,'neighbours');
assert.ok(r.warns[0].includes('ผู้ใช้ไฟรายใหม่'));
assert.ok(r.warns.some(w=>w.includes('2.5 กม.')));
/* 4) ไม่มีอะไรเลยนอกจาก Longdo */
r=M.recommend({...base,customer:null,neighbours:null,longdo:{lat:1,lng:2,has_moo:true},checks:{}});
assert.equal(r.pick.kind,'longdo');
/* 5) ไม่มีข้อมูลเลย */
r=M.recommend({...base,customer:null,neighbours:null,longdo:{error:'LONGDO_NO_RESULT'},checks:{}});
assert.equal(r.pick,null);
assert.equal(M.dist({lat:16.146375,lng:102.618697},{lat:16.14695166,lng:102.6187567}),64);
console.log('PASS: meter-new recommend');

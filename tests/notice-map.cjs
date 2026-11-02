// แผนที่ตารางประมูลแจ้งเตือน (js/notice-map.js): which district each row of the table marks
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/notice-map-data.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(root,'js/notice-map.js'),'utf8'),ctx);
const M=ctx.window.NoticeMap;
const of=site=>JSON.parse(JSON.stringify(M.districtsOf({site}).map(d=>d.p+'/'+d.n)));

assert.equal(ctx.window.NOTICE_MAP_DATA.districts.length,114);
// site names as they are in the table
assert.deepEqual(of('ขอนแก่น'),['ขอนแก่น/เมืองขอนแก่น']);
assert.deepEqual(of('ขอนแก่น 2'),['ขอนแก่น/เมืองขอนแก่น']);
assert.deepEqual(of('นม1'),['นครราชสีมา/เมืองนครราชสีมา']);
assert.deepEqual(of('นครราชสีมา 2'),['นครราชสีมา/เมืองนครราชสีมา']);
assert.deepEqual(of('เมืองนครราชสีมา 3'),['นครราชสีมา/เมืองนครราชสีมา']);
assert.deepEqual(of('ลำปลายมาศ + หนองหงส์'),['บุรีรัมย์/ลำปลายมาศ','บุรีรัมย์/หนองหงส์']);
assert.deepEqual(of('ท่าตูม'),['สุรินทร์/ท่าตูม']);
assert.deepEqual(of('บุรีรัมย์'),['บุรีรัมย์/เมืองบุรีรัมย์']);
assert.deepEqual(of('ชัยภูมิ'),['ชัยภูมิ/เมืองชัยภูมิ']);
assert.deepEqual(of('จอหอ'),['นครราชสีมา/เมืองนครราชสีมา']);
assert.deepEqual(of('อุดรธานี'),[]);   // outside the 5 provinces
assert.deepEqual(of('ร้อยเอ็ด'),[]);
// every district of COVER exists
Object.keys(M.COVER).forEach(k=>{ assert.ok(of(k.split('/')[1]).includes(k),k); M.COVER[k].forEach(c=>assert.ok(of(c.split('/')[1]).includes(c),c)); });

// a win beats a wait or a loss on the same district; the office's other districts are ticked only when won; cancelled rows mark nothing
const rows=[
  {site:'นครราชสีมา 2',status:'ชนะประมูล'},{site:'นม1',status:null},
  {site:'ขอนแก่น 2',status:'ไม่ชนะประมูล'},
  {site:'โชคชัย',status:'ไม่ชนะประมูล'},
  {site:'พล',status:'ไม่ชนะประมูล'},
  {site:'บัวใหญ่',status:null},
  {site:'พิมาย',status:'ยกเลิก'},
  {site:'อุดรธานี',status:null},
];
const mk=M.marks(rows), st=k=>M.state(mk.m[k]);
assert.equal(st('นครราชสีมา/เมืองนครราชสีมา'),'won');
assert.equal(st('นครราชสีมา/ขามทะเลสอ'),'won');
assert.equal(st('ขอนแก่น/เมืองขอนแก่น'),'lost');
assert.equal(st('ขอนแก่น/พระยืน'),'');
assert.equal(st('นครราชสีมา/โชคชัย'),'lost');
assert.equal(st('ขอนแก่น/แวงใหญ่'),'');
assert.equal(st('นครราชสีมา/บัวใหญ่'),'wait');
assert.equal(st('นครราชสีมา/พิมาย'),'');
assert.equal(mk.off.length,1);
assert.ok(M.html(rows).includes('nm-svg'));
console.log('notice-map: ok');

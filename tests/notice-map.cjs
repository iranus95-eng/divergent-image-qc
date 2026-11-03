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
  {site:'นครราชสีมา 2',status:'ชนะประมูล',qty:120000},{site:'นม1',status:null},
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
// the downloaded picture: one SVG document with the title, the date and the legend counts
const pic=M.pictureSvg(rows,'');
assert.ok(pic.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
assert.ok(pic.svg.includes('แผนที่ไซด์ประมูลแจ้งเตือน 5 จังหวัด'));
assert.ok(pic.svg.includes('ชนะประมูล 1 ไซด์ · 10,000 ราย/เดือน'));
// a won row without จำนวนราย: วงเงิน ÷ 1.07 ÷ ราคากลาง
assert.ok(M.pictureSvg([{site:'พล',status:'ชนะประมูล',budget:667680,mid_price:8}],'').svg.includes('6,500 ราย/เดือน'));
// the quotation's จำนวนราย (setQty, from the bid table) wins over the table and the budget (บ้านไผ่: 172,488 ราย/ปี)
M.setQty(r=>r.site==='พล'?172488:null);
assert.ok(M.pictureSvg([{site:'พล',status:'ชนะประมูล',budget:667680,mid_price:8}],'').svg.includes('14,374 ราย/เดือน'));
M.setQty(null);
assert.match(pic.name,/^notice-bid-map-\d{4}-\d{2}-\d{2}\.png$/);
console.log('notice-map picture: ok');

// sub-branches named in a quotation: pdf.js text of the น้ำพอง quotation (marks dropped/replaced, words cut in pieces)
const np='การไฟฟ้า กฟส.|นํ|Ê| |าพอง||พื|Ê|นที|É| |ระบบจําหน่าย ... พื้นที่โซน B กฟส.เขาสวนกวาง พืÊนทีÉ ... โซน C กฟส.อุบลรัตน์ขออนุมัติ กฟฟ.ในสังกัด';
const names=M.branchNames(np);
assert.deepEqual(JSON.parse(JSON.stringify(M.districtsOfNames(names,'ขอนแก่น').map(d=>d.n))),['น้ำพอง','เขาสวนกวาง','อุบลรัตน์']);
// the longest name wins (พลับพลาชัย, not พล); a name in two provinces goes to the site's province; กฟจ.<province> is its เมือง
const dn=(t,p)=>JSON.parse(JSON.stringify(M.districtsOfNames(M.branchNames(t),p).map(d=>d.p+'/'+d.n)));
assert.deepEqual(dn('กฟส.พลับพลาชัย ','บุรีรัมย์'),['บุรีรัมย์/พลับพลาชัย']);
assert.deepEqual(dn('กฟส.เฉลิมพระเกียรติ ','นครราชสีมา'),['นครราชสีมา/เฉลิมพระเกียรติ']);
assert.deepEqual(dn('กฟจ.นครราชสีมา ','นครราชสีมา'),['นครราชสีมา/เมืองนครราชสีมา']);
assert.deepEqual(dn('กฟส.จอหอ','นครราชสีมา'),['นครราชสีมา/เมืองนครราชสีมา']);
// a won site's quotation branches replace the old-map COVER guess; not won → nothing extra
M.setBranches({1:['ปะคำพื้นที่']});
const mb=M.marks([{id:1,site:'นางรอง',status:'ชนะประมูล'},{id:2,site:'ชุมแพ',status:'ชนะประมูล'},{id:3,site:'พล',status:'ไม่ชนะประมูล'}]);
assert.equal(M.state(mb.m['บุรีรัมย์/ปะคำ']),'won');
assert.equal(M.state(mb.m['ขอนแก่น/ภูผาม่าน']),'won');   // ชุมแพ: no branches read → COVER
M.setBranches({2:['ชุมแพ','สีชมพู']});
const mc=M.marks([{id:2,site:'ชุมแพ',status:'ชนะประมูล'}]);
assert.equal(M.state(mc.m['ขอนแก่น/สีชมพู']),'won');
assert.equal(M.state(mc.m['ขอนแก่น/ภูผาม่าน']),'');
M.setBranches({});
// พลับพลาชัย is ticked with ประโคนชัย, also when the quotation names other sub-branches
{ const pk=M.marks([{id:40,site:'ประโคนชัย',status:'ชนะประมูล'}]);
  assert.equal(M.state(pk.m['บุรีรัมย์/พลับพลาชัย']),'won');
  M.setBranches({40:['บ้านกรวด']});
  assert.equal(M.state(M.marks([{id:40,site:'ประโคนชัย',status:'ชนะประมูล'}]).m['บุรีรัมย์/พลับพลาชัย']),'won');
  M.setBranches({});
  assert.equal(M.state(M.marks([{id:40,site:'ประโคนชัย',status:null}]).m['บุรีรัมย์/พลับพลาชัย']),''); }
// นาโพธิ์ and บ้านใหม่ไชยพจน์ are ticked with พุทไธสง
{ const pt=M.marks([{id:31,site:'พุทไธสง',status:'ชนะประมูล'}]);
  assert.equal(M.state(pt.m['บุรีรัมย์/นาโพธิ์']),'won');
  assert.equal(M.state(pt.m['บุรีรัมย์/บ้านใหม่ไชยพจน์']),'won'); }
// ชุมพลบุรี is ticked with ท่าตูม
assert.equal(M.state(M.marks([{id:85,site:'ท่าตูม',status:'ชนะประมูล'}]).m['สุรินทร์/ชุมพลบุรี']),'won');
console.log('notice-map branches: ok');

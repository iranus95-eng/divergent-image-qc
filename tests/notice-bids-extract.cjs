// PDF reading of ตารางประมูลแจ้งเตือน (js/notice-bids.js) on the text pieces pdf.js gives for an office's announcement and TOR
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/notice-bids.js'),'utf8');
const a=src.indexOf('// ---------------------------------------------------------------- PDF text → fields');
const b=src.indexOf('// ---------------------------------------------------------------- end of extraction');
assert.ok(a>0&&b>a,'extraction section not found');
const ctx={};
vm.runInNewContext(`var VAT=0.07;${src.slice(a,b)};this.extract=extract;this.mergeDocs=mergeDocs;this.resultPrice=resultPrice;`,ctx);
const fx=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',n),'utf8'));

// กฟส.พุทไธสง ปี 2570: announcement (e-GP file name carries the project number) + TOR with marks missing ("การไฟฟาสวนภูมิภาค")
const ann=ctx.extract(fx('notice-bids-putthaisong-announce.json'),'annoudoc_S50631000002_69099738828.pdf');
assert.equal(ann.kind,'announce');
assert.equal(ann.site,'พุทไธสง');
assert.equal(ann.project_no,'69099738828');
assert.equal(ann.zone,'ฉ.3');
assert.equal(ann.method,'e-bidding');
assert.equal(ann.budget,616320);
assert.equal(ann.bid_date,'2026-11-03');
assert.equal(ann.bid_time,'09.00-12.00');
assert.equal(ann.announce_date,'2026-10-26');
const tor=ctx.extract(fx('notice-bids-putthaisong-tor.json'),'Attach_TOR_9.pdf');
assert.equal(tor.kind,'tor');
assert.equal(tor.site,'พุทไธสง');
assert.equal(tor.qty,72000);
assert.equal(tor.budget,616320);
assert.equal(tor.mid_price,8);
const rows=ctx.mergeDocs([tor,ann]);
assert.equal(rows.length,1);
const r=rows[0];
assert.deepEqual([r.zone,r.site,r.project_no,r.budget,r.qty,r.mid_price,r.bid_date,r.bid_time,r.method],['ฉ.3','พุทไธสง','69099738828',616320,72000,8,'2026-11-03','09.00-12.00','e-bidding']);
assert.ok(r.has_announce&&r.has_tor);
console.log('PASS: notice bids PDF reading (announcement + TOR → one row)');

// heading without the office ("ประกาศการไฟฟ้าส่วนภูมิภาค" then "เรื่อง ประกวดราคา…"): the name is the office found later,
// never the word "เรื่อง" (บ้านไผ่ ฉ.1 was once renamed "เรื่อง" this way)
const noOffice=ctx.extract([
  {p:0,str:'(สำเนา)',x:272,y:100,w:79,h:16},
  {p:0,str:'ประกาศการไฟฟ้าส่วนภูมิภาค',x:217,y:157,w:189,h:16},
  {p:0,str:'เรื่อง ประกวดราคาจ้างเหมาวางหนังสือแจ้งเตือนก่อนการงดจ่ายกระแสไฟฟ้า ในเขตพื้นที่รับผิดชอบของ',x:88,y:179,w:447,h:16},
  {p:0,str:'การไฟฟ้าส่วนภูมิภาคสาขาบ้านไผ่ ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',x:88,y:201,w:447,h:16},
],'annoudoc_S50640000002_69109275821.pdf');
assert.equal(noOffice.site,'บ้านไผ่');
assert.equal(noOffice.office,'กฟส.บ้านไผ่');
const shortOnly=ctx.extract([
  {p:0,str:'ประกาศการไฟฟ้าส่วนภูมิภาค',x:217,y:157,w:189,h:16},
  {p:0,str:'เรื่อง ประกวดราคาจ้างเหมาวางหนังสือแจ้งเตือน ของ กฟส.ครบุรี',x:88,y:179,w:447,h:16},
],'x.pdf');
assert.equal(shortOnly.site,'ครบุรี');
console.log('PASS: notice bids PDF reading (heading without office is not named "เรื่อง")');

// "การไฟฟ้าส่วนภูมิภาค มีความประสงค์จะประกวดราคา…" is a sentence, not an office; the office is in the heading or signature.
// "12.00" in "ระหว่างเวลา 09.00 น. ถึง 12.00 น." is not a price per notice: an announcement gives no quantity.
for (const [f, file, site, office, no, budget, bid] of [
  ['notice-bids-buriram-announce.json', 'annoudoc_S50631000001_69109012505.pdf', 'บุรีรัมย์', 'กฟจ.บุรีรัมย์', '69109012505', 1438080, '2026-11-09'],
  ['notice-bids-thatum-announce.json', 'annoudoc_S50632000005_69099736484.pdf', 'ท่าตูม', 'กฟส.ท่าตูม', '69099736484', 652272, '2026-11-02'],
]) {
  const d = ctx.extract(fx(f), file);
  assert.equal(d.kind, 'announce');
  assert.equal(d.site, site);
  assert.equal(d.office, office);
  assert.equal(d.project_no, no);
  assert.equal(d.budget, budget);
  assert.equal(d.bid_date, bid);
  assert.equal(d.bid_time, '09.00-12.00');
  assert.equal(d.qty, undefined, f + ': no quantity guessed from the bid hours');
  assert.equal(d.mid_price, undefined, f + ': no price guessed from the bid hours');
}
assert.equal(ctx.extract(fx('notice-bids-thatum-announce.json'), 'x.pdf').zone, 'ฉ.3');
console.log('PASS: notice bids PDF reading (office not taken from "มีความประสงค์จะ…", no price from the bid hours)');

// e-GP "สรุปข้อมูลการเสนอราคาเบื้องต้น" of สว่างแดนดิน: three areas (A สว่างแดนดิน, B เจริญศิลป์, C ส่องดาว) but the row's
// quantity is พื้นที่ A only (77,760 ราย). All items over 77,760 do not divide (9.9167); item A alone gives 5.95 exactly
// and the other areas come out whole at 5.95 (32,400 and 19,440 ราย).
const res=ctx.extract(fx('notice-bids-sawangdaendin-result.json'),'สว่างแดนดิน5.pdf');
assert.equal(res.kind,'result');
assert.equal(res.project_no,'69109227315');
assert.notEqual(res.site,'ชื่อโครงการ');
assert.deepEqual([...res.lowest],[495059.04,206274.6,123764.76]);
assert.equal(res.items.length,3);
assert.match(res.items[0].name,/สว่างแดนดิน/);
assert.match(res.items[2].name,/ส่องดาว/);
const sw=ctx.resultPrice(res.lowest,77760,10,'สว่างแดนดิน',res.items.map(x=>x.name));
assert.equal(sw.price,5.95);
assert.equal(sw.item,0);
assert.deepEqual([...sw.areas],[77760,32400,19440]);
// one office, one item: unchanged
const one=ctx.resultPrice([526676.26],77760,10,'สว่างแดนดิน');
assert.equal(one.price,6.33); assert.equal(one.item,-1); assert.equal(one.monthly,false);
// นม.2 prices the job per month: 49,434 = 10,000 ราย/เดือน × 4.62 + VAT
const nm2=ctx.resultPrice([49434],120000,8,'นครราชสีมา 2');
assert.equal(nm2.price,4.62); assert.equal(nm2.monthly,true);
// nothing divides: total over the row's quantity, not exact
const odd=ctx.resultPrice([100000,50000],77760,10,'x');
assert.equal(odd.item,-1); assert.ok(Math.abs(odd.exact-odd.price)>=0.0005);
console.log('PASS: notice bids result file → price per notice (multi-area result, row quantity of one area)');

// จักราช: no quantity in the row, ราคากลาง 10 in the sheet (8 in the TOR). 410,623.20 ÷ 1.07 ÷ 62,400 (estimated from 10)
// = 6.15 divides too, but the site's quotation says 4.92 → 78,000 ราย, and 667,680 ÷ 1.07 ÷ 78,000 = 8.00
const jk=ctx.extract(fx('notice-bids-chakkarat-result.json'),'จักราจ5.pdf');
assert.equal(jk.kind,'result');
assert.equal(jk.project_no,'69099708279');
assert.deepEqual([...jk.lowest],[410623.2]);
const jkp=ctx.resultPrice(jk.lowest,62400,10,'จักราช',[''],{est:true,budget:667680,quotePrices:[4.92]});
assert.equal(jkp.price,4.92); assert.equal(jkp.qty,78000); assert.equal(jkp.mid,8);
// without a quotation, or with the row's own quantity, the reading is unchanged
assert.equal(ctx.resultPrice(jk.lowest,62400,10,'จักราช',[''],{est:true,budget:667680,quotePrices:[]}).price,6.15);
assert.equal(ctx.resultPrice(jk.lowest,62400,10,'จักราช',[''],{est:false,budget:667680,quotePrices:[4.92]}).price,6.15);
console.log('PASS: notice bids result file → quantity from the site quotation when the ราคากลาง was wrong (จักราช)');

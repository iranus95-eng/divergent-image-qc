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
const w0=src.indexOf('  function won(r)'),w1=src.indexOf('\n',src.indexOf('  function lost(r)'));
const ctx={};
vm.runInNewContext(`var VAT=0.07;${src.slice(w0,w1)}\n${src.slice(a,b)};this.extract=extract;this.mergeDocs=mergeDocs;this.resultPrice=resultPrice;this.isOurWin=isOurWin;this.won=won;this.lost=lost;this.nameKey=nameKey;`,ctx);
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

// the first "สังขะ5.pdf" sent was the result of project 69099736484 (ท่าตูม): its lowest offer 406,039.32 is our ท่าตูม quotation → we won (🏆)
const tt=ctx.extract(fx('notice-bids-thatum-result.json'),'สังขะ5.pdf');
assert.equal(tt.kind,'result');
assert.equal(tt.project_no,'69099736484');
assert.deepEqual([...tt.lowest],[406039.32]);
// the row says 50,800 ราย at ราคากลาง 12 (→ 7.47), but the lowest offer is our quotation at 4.98: 76,200 ราย, ราคากลาง 8.00
assert.equal(ctx.resultPrice(tt.lowest,50800,12,'ท่าตูม',['']).price,7.47);
assert.equal(ctx.isOurWin(tt.lowest,[406039.32],[],0),true);
const ttp=ctx.resultPrice(tt.lowest,50800,12,'ท่าตูม',[''],{ours:true,budget:652272,quotePrices:[4.98]});
assert.equal(ttp.price,4.98); assert.equal(ttp.qty,76200); assert.equal(ttp.mid,8);
assert.equal(ctx.isOurWin(tt.lowest,[542425.80],[4.97],ttp.price),false);   // สังขะ's quotation is other money
// สว่างแดนดิน: our quotation 877,793.76 (6.33) is not the lowest 825,098.40 nor any area → lost
assert.equal(ctx.isOurWin(res.lowest,[877793.76],[6.33],5.95),false);
// a quotation without a total: same unit price as the winning one
assert.equal(ctx.isOurWin([410623.2],[0],[4.92],4.92),true);
assert.equal(ctx.isOurWin([410623.2],[],[5.10],4.92),false);
console.log('PASS: notice bids result file → 🏆 when the lowest offer is our quotation');

// ❌ next to 🏆: "ไม่ชนะประมูล" holds the word "ชนะ" but is not a win
assert.equal(ctx.won({status:'ชนะประมูล'}),true); assert.equal(ctx.lost({status:'ชนะประมูล'}),false);
assert.equal(ctx.won({status:'ไม่ชนะประมูล'}),false); assert.equal(ctx.lost({status:'ไม่ชนะประมูล'}),true);
assert.equal(ctx.won({status:null}),false); assert.equal(ctx.lost({status:'ยกเลิก'}),false);
console.log('PASS: notice bids won / lost status');

// ศีขรภูมิ (+ สำโรงทาบ, one project 69109094653, 4 bidders): lowest 315,144.96 = 62,400 ราย × 4.72 + VAT; our quotation
// "ศีขรภูมื" (typo, same nameKey) is 329,166.24 at 4.93 → ❌ ไม่ชนะประมูล
const sk=ctx.extract(fx('notice-bids-sikhoraphum-result.json'),'ศีขรภูมื5.pdf');
assert.equal(sk.kind,'result');
assert.equal(sk.project_no,'69109094653');
assert.deepEqual([...sk.lowest],[315144.96]);
const skp=ctx.resultPrice(sk.lowest,62400,8,'ศีขรภูมิ',sk.items.map(x=>x.name));
assert.equal(skp.price,4.72); assert.equal(skp.item,-1);
assert.equal(ctx.isOurWin(sk.lowest,[329166.24],[4.93],skp.price),false);
assert.equal(ctx.nameKey('ศีขรภูมื'),ctx.nameKey('ศีขรภูมิ'));
console.log('PASS: notice bids result file → ❌ when the lowest offer is not our quotation (ศีขรภูมิ)');

// the real สังขะ result (69109223982, 5 bidders): a round 510,000.00 against our 542,425.80 at 4.97 → ❌.
// 102,000 ราย (estimated from ราคากลาง 8) → 4.67 per notice, not a whole split: flagged, and no quantity "fix" from 4.97
const sg=ctx.extract(fx('notice-bids-sangkha-result.json'),'สังขะ5.pdf');
assert.equal(sg.project_no,'69109223982');
assert.deepEqual([...sg.lowest],[510000]);
assert.equal(ctx.isOurWin(sg.lowest,[542425.80],[],0),false);
const sgp=ctx.resultPrice(sg.lowest,102000,8,'สังขะ',[''],{est:true,ours:false,budget:873120,quotePrices:[4.97]});
assert.equal(sgp.price,4.67); assert.equal(sgp.qty,undefined); assert.ok(Math.abs(sgp.exact-sgp.price)>=0.0005);
assert.equal(ctx.isOurWin(sg.lowest,[542425.80],[4.97],sgp.price),false);
console.log('PASS: notice bids result file → ❌ สังขะ (round lowest offer, not exact per notice)');

// บัวใหญ่ is already a row (from the sheet, name only): its announcement + TOR update that row, never a second one
{
  const grab=(from,to)=>{const i=src.indexOf(from),j=src.indexOf(to,i);assert.ok(i>0&&j>i,from);return src.slice(i,j);};
  const more=[grab('  function fmt(','\n',),grab('  function thaiDate(','\n'),grab('  function matchRow(r)','  // ----------------------------------------------------------------'),
    grab('  var NUMS =','\n'),grab('  var LABELS =','  // quiet:')].join('\n');
  const c2={st:{rows:[{id:43,site:'หนองบัวแดง'},{id:73,site:'บัวใหญ่'}]}};
  vm.runInNewContext(`var VAT=0.07;${src.slice(a,b)}\n${more};this.extract=extract;this.mergeDocs=mergeDocs;this.matchRow=matchRow;this.changesText=changesText;`,c2);
  const ann=c2.extract(fx('notice-bids-buayai-announce.json'),'annoudoc_S50630000009_69109083561.pdf');
  const tor=c2.extract(fx('notice-bids-buayai-tor.json'),'Attach_TOR_6.pdf');
  const rows=c2.mergeDocs([ann,tor]);
  assert.equal(rows.length,1);
  const r=rows[0];
  assert.deepEqual([r.site,r.zone,r.project_no,r.budget,r.qty,r.mid_price,r.bid_date],['บัวใหญ่','ฉ.3','69109083561',975840,114000,8,'2026-11-10']);
  assert.equal(c2.matchRow(r),73,'บัวใหญ่ goes to the existing row, not หนองบัวแดง, not a new one');
  const note=c2.changesText({site:'บัวใหญ่'},Object.assign({site:'บัวใหญ่'},r));
  assert.match(note,/วงเงิน: – → 975,840/); assert.match(note,/จำนวนราย\/ปี: – → 114,000/); assert.match(note,/วันที่เสนอราคา: – → 10\/11\/2569/);
  assert.match(c2.changesText(r,r),/ข้อมูลตรงกับที่มีอยู่แล้ว/);
  console.log('PASS: notice bids import updates an existing site (บัวใหญ่) instead of adding a row');
}

// "อุดรธานี.pdf" is the result of 69109247390 = บ้านดุง (3 bidders). The row says 68,000 ราย at ราคากลาง 9 → 4.905, not a
// 2-decimal price. Our บ้านดุง quotation 340,516.80 at 5.20 was priced on 61,200 ราย, over which the lowest offer
// divides exactly: 356,887.80 ÷ 1.07 ÷ 61,200 = 5.45, and 654,840 ÷ 1.07 ÷ 61,200 = ราคากลาง 10.00. Not ours → ❌.
{
  const bd=ctx.extract(fx('notice-bids-bandung-result.json'),'อุดรธานี.pdf');
  assert.equal(bd.project_no,'69109247390');
  assert.deepEqual([...bd.lowest],[356887.8]);
  const plain=ctx.resultPrice(bd.lowest,68000,9,'บ้านดุง',['']);
  assert.ok(Math.abs(plain.exact-plain.price)>=0.0005,'68,000 does not divide');
  const p=ctx.resultPrice(bd.lowest,68000,9,'บ้านดุง',[''],{est:false,ours:false,budget:654840,quotePrices:[5.2],quoteQtys:[61200]});
  assert.equal(p.price,5.45); assert.equal(p.qty,61200); assert.equal(p.mid,10); assert.equal(p.src,'qty');
  assert.equal(ctx.isOurWin(bd.lowest,[340516.8],[5.2],p.price),false);
  // a row whose quantity already divides keeps it (จักราช with its own 78,000)
  assert.equal(ctx.resultPrice([410623.2],78000,8,'จักราช',[''],{quoteQtys:[61200]}).qty,undefined);
  console.log('PASS: notice bids result file → quantity of our quotation when the row\'s does not divide (บ้านดุง)');
}

// นครราชสีมา 2 keeps 10,000 ราย/เดือน with ราคากลาง 96 (8 × 12): 49,434 ÷ 1.07 ÷ 10,000 = 4.62 is our quoted price,
// not a "too low" yearly reading to turn into a monthly 55.44
{
  const n2=ctx.extract(fx('notice-bids-nm2-result.json'),'นม2.pdf');
  assert.equal(n2.project_no,'69099737588'); assert.deepEqual([...n2.lowest],[49434]);
  const p=ctx.resultPrice(n2.lowest,10000,96,'นครราชสีมา 2',[''],{est:false,ours:true,budget:1027200,quotePrices:[4.62],quoteQtys:[10000,120000]});
  assert.equal(p.price,4.62); assert.equal(p.monthly,false);
  // เมืองนครราชสีมา 3: the row has no project number; the result names the office in its title
  const n3=ctx.extract(fx('notice-bids-nm3-result.json'),'นม3.pdf');
  assert.equal(n3.project_no,'69109003396'); assert.deepEqual([...n3.lowest],[892380]);
  assert.match(ctx.nameKey(n3.site),/นครราชสมา3/);
  console.log('PASS: notice bids result file → นครราชสีมา 2 per-month row, เมืองนครราชสีมา 3 found by name');
}

// กฟส.พุทไธสง result file (2026-11-03): the lowest offer 372,103.20 is our quotation. Some browsers got this file's tone marks
// wrong, and it was read as a plain document (no 🏆/❌): it must be read as a result file however the marks come out
{
  const items=fx('notice-bids-putthaisong-result.json');
  const damage={
    clean:s=>s,
    'É/Ê for ่/้':s=>s.replace(/่/g,'É').replace(/้/g,'Ê'),
    'tone marks lost':s=>s.replace(/[่้๊๋]/g,''),
    'every mark lost':s=>s.replace(/[ัิ-ฺ็-๎]/g,''),
    'marks cut into spaces':s=>s.replace(/[่้]/g,' '),
  };
  for(const [k,f] of Object.entries(damage)){
    const d=ctx.extract(items.map(i=>({...i,str:f(i.str)})),'พุทไธสง.pdf');
    assert.equal(d.kind,'result',k);
    assert.equal(d.project_no,'69099738828',k);
    assert.deepEqual([...d.lowest],[372103.2],k);
    assert.equal(ctx.nameKey(d.site),ctx.nameKey('พุทไธสง'),k);
    assert.equal(ctx.isOurWin(d.lowest,[372103.2],[4.83],0),true,k);
    const p=ctx.resultPrice(d.lowest,72000,8,d.site,d.items.map(x=>x.name),{});
    assert.equal(p.price,4.83,k);
  }
  console.log('PASS: notice bids result file with damaged tone marks (พุทไธสง) → 🏆 at 4.83');
}

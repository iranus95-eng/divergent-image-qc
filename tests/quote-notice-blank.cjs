// แบบฟอร์มเปล่า of เสนอราคาแจ้งเตือน (js/quote-notice.js): TOR text → form fields, and a site's defaults
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/quote-notice.js'),'utf8');
const cut=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b);assert.ok(i>0&&j>i,'section not found: '+a);return src.slice(i,j);};
const ctx={};
vm.runInNewContext(`var VAT=0.07;function num(s){var n=Number(String(s==null?'':s).replace(/,/g,'').trim());return isFinite(n)?n:0}
${cut('// ---------------------------------------------------------------- table detection','// Header text only gives')}
${cut('// ---------------------------------------------------------------- blank form','// ---------------------------------------------------------------- end of blank form')}
this.torFields=torFields;this.blankFromTor=blankFromTor;this.budgetQty=budgetQty;this.torQty=torQty;this.guessPair=guessPair;this.isTorText=isTorText;this.isBk06=isBk06;this.mergeRuns=mergeRuns;this.blankDefaults=blankDefaults;this.thaiText=thaiText;this.blankBudget=blankBudget;`,ctx);

// กฟส.ภูเขียว ปี 2570: TOR is only the บก.06 price table (no quotation form); marks lost ("ประจาปี"), "กฟส . ภูเขียว"
{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-notice-phukhiao-tor.json'),'utf8'));
  const f=ctx.torFields(raw.map(i=>ctx.thaiText(i.str)).join(' '));
  assert.equal(f.qty,'120000');
  assert.equal(f.mid,'8');
  assert.equal(f.year,'2570');
  assert.equal(f.work,'งานจ้างเหมาบุคคลภายนอก จัดส่งหนังสือแจ้งเตือนก่อนการงดจ่ายไฟฟ้า');
  assert.equal(f.office,'การไฟฟ้าส่วนภูมิภาคสาขาภูเขียว และ กฟฟ.ในสังกัด');
  assert.equal(f.area,'กฟส.ภูเขียว');
  assert.equal(f.areaList,'กฟส.ภูเขียว กฟส.คอนสาร กฟส.บ้านแท่น');
  assert.equal(ctx.blankBudget(f),1027200);
}
// a site of ตารางประมูลแจ้งเตือน: quantity and ราคากลาง from its row, fiscal year from the auction day
{
  const d=ctx.blankDefaults({site:'นครราชสีมา 2',qty:120000,mid_price:8,bid_date:'2026-10-29'});
  assert.equal(d.office,'การไฟฟ้าส่วนภูมิภาคสาขานครราชสีมา 2');
  assert.equal(d.area,'กฟส.นครราชสีมา 2');
  assert.equal(d.year,'2570');
  assert.equal(d.qty,'120000');
  assert.equal(d.mid,'8');
}
// กฟส.อำเภอขุขันธ์ ปี 2570 (pB1.pdf): only the บก.06 cover page, Thai digits, no price table: วงเงิน 806,245 and
// ราคากลาง 806,238.58 = 107,642 ราย × 7.00 + VAT to the satang → both fields filled as an estimate. Uploading it as a
// quotation opens แบบฟอร์มเปล่า; typing another price recomputes จำนวน
{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-notice-khukhan-tor.json'),'utf8'));
  const text=raw.map(i=>ctx.thaiText(i.str)).join(' ');
  assert.equal(ctx.isTorText(text),true);
  const f=ctx.torFields(text);
  assert.equal(f.budget,'806245');
  assert.equal(f.ref,'806238.58');
  assert.equal(f.qty,'107642');
  assert.equal(f.mid,'7');
  assert.equal(f.guess,'1');
  assert.equal(f.year,'2570');
  assert.equal(f.work,'งานจ้างเหมาบุคคลภายนอกจัดส่งหนังสือแจ้งเตือนค่าไฟฟ้า');
  assert.equal(f.office,'การไฟฟ้าส่วนภูมิภาคสาขาอำเภอขุขันธ์ และ กฟฟ.ในสังกัด');
  assert.equal(f.area,'กฟส.ขุขันธ์');
  assert.equal(f.activity,'จัดส่งหนังสือแจ้งเตือน');
  const d=ctx.blankFromTor(text,{site:'ขุขันธ์',office:'กฟส.อำเภอขุขันธ์',budget:806238.58,bid_date:'2026-12-02'});
  assert.equal(d.torBudget,'806245');
  assert.equal(d.torRef,'806238.58');
  assert.equal(d.qty,'107642');
  assert.equal(d.mid,'7');
  assert.equal(d.midGuess,'1');
  assert.equal(d.area,'กฟส.ขุขันธ์');
  assert.equal(ctx.blankBudget(d),806238.58);
  assert.equal(ctx.torQty(d,7),'107642');
  assert.equal(ctx.torQty(d,5),'150700');                  // no exact fit with ราคากลาง: วงเงิน 806,245 ÷ 1.07 ÷ 5
  assert.equal(ctx.torQty(d,6.5),'115922');                // neither fits: nearest under the ราคากลาง
  assert.equal(JSON.stringify(ctx.guessPair(806238.58)),'[107642,7]');
  assert.equal(ctx.isTorText('ใบเสนอราคา ลำดับ รายการ จำนวน ราคาต่อหน่วย'),false);
}
// กฟจ.ร้อยเอ็ด ปี 2570 (pB0.pdf, Word): บก.06 with its own money table — 208,785 ราย × 7.00 = 1,461,495.00, budget rounded up
// to 1,461,500 + VAT = 1,563,805 — and numbers split into touching pieces ("1" "," "563" …), joined back as in torText()
{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-notice-roiet-tor.json'),'utf8'));
  const text=ctx.mergeRuns(raw.map(i=>({str:ctx.thaiText(i.str).trim(),x:i.x,y:-i.y,w:i.w,h:i.h})).filter(i=>i.str)).map(i=>i.str).join(' ');
  assert.equal(ctx.isBk06(text),true);
  assert.equal(ctx.isTorText(text),true);
  const f=ctx.torFields(text);
  assert.equal(f.qty,'208785');
  assert.equal(f.mid,'7');
  assert.equal(f.guess,undefined);
  assert.equal(f.year,'2570');
  assert.equal(f.office,'การไฟฟ้าส่วนภูมิภาคจังหวัดร้อยเอ็ด และ กฟส.ในสังกัด');
  assert.equal(f.area,'กฟจ.ร้อยเอ็ด');
  assert.equal(f.areaList,'กฟจ.ร้อยเอ็ด กฟส.จตุรพักตรพิมาน กฟส.ศรีสมเด็จ กฟส.ธวัชบุรี กฟส.เมืองสรวง กฟส.ธงธานี กฟส.เชียงขวัญ กฟส.จังหาร');
  assert.equal(ctx.isBk06('แบบ บก.06 ใบเสนอราคา ราคาที่เสนอ'),false);
}
// กฟส.ขุนหาญ + กฟส.ไพรบึง ปี 2570 (pB0.pdf, Word): บก.06 whose row ราคารวม is rounded to the hundred (66,928 × 7 = 468,496 → 468,500),
// วงเงิน printed ex-VAT then "รวมเป็นเงิน 501,295.00", year split "ปี 25 70", two offices named in the project
{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-notice-khunhan-tor.json'),'utf8'));
  const text=ctx.mergeRuns(raw.map(i=>({str:ctx.thaiText(i.str).trim(),x:i.x,y:-i.y,w:i.w,h:i.h})).filter(i=>i.str)).map(i=>i.str).join(' ');
  assert.equal(ctx.isBk06(text),true);
  const f=ctx.torFields(text);
  assert.equal(f.qty,'66928');
  assert.equal(f.mid,'7');
  assert.equal(f.guess,undefined);
  assert.equal(f.year,'2570');
  assert.equal(f.work,'งานจ้างเหมาบุคคลภายนอกจัดส่งหนังสือแจ้งเตือนค่าไฟฟ้า');
  assert.equal(f.activity,'จัดส่งหนังสือแจ้งเตือน');
  assert.equal(f.office,'การไฟฟ้าส่วนภูมิภาคสาขาขุนหาญ และ กฟส.ไพรบึง');
  assert.equal(f.area,'กฟส.ขุนหาญ');
  assert.equal(f.areaList,'กฟส.ขุนหาญ กฟส.ไพรบึง');
}
console.log('PASS: quote notice blank form (TOR import, site defaults)');

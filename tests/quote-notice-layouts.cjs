// Table detection of เสนอราคาแจ้งเตือน (js/quote-notice.js) on the text positions pdf.js reads from office forms
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/quote-notice.js'),'utf8');
const a=src.indexOf('// ---------------------------------------------------------------- table detection');
const b=src.indexOf('// Header text only gives');
assert.ok(a>0&&b>a,'table detection section not found');
const ctx={};
vm.runInNewContext(`function num(s){var n=Number(String(s==null?'':s).replace(/,/g,'').trim());return isFinite(n)?n:0}
${src.slice(a,b)}
this.read=function(raw){
  var items=mergeRuns(raw.map(function(i){return {str:thaiText(i.str).trim(),x:i.x,y:i.y,w:i.w,h:i.h,thai:/[\\u0E50-\\u0E59]/.test(i.str)}}));
  if(items.some(function(i){return /รำคำ|รำยกำร/.test(i.str)}))items.forEach(function(i){i.str=i.str.replace(/ำ/g,'า').replace(/จ\\s+า/g,'จำ')});
  return detectTables(items,0);
};
this.officeSite=officeSite;
this.grid=gridTables;
this.digits=function(raw){
  return thaiDigitRuns(mergeRuns(raw.map(function(i){return {str:thaiText(i.str).trim(),x:i.x,y:i.y,w:i.w,h:i.h,thai:/[\\u0E50-\\u0E59]/.test(i.str)}})));
};`,ctx);
function rows(name){return ctx.read(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8')));}
function mid(r){return (r[0]+r[1])/2;}

// กฟส.ศีขรภูมิ: tall header, "ต่อหน่วย / รวม / (ราย)" sit ~47pt under the "ราคา" line; the sum before VAT has no words
{
  const r=rows('quote-notice-sikhoraphum.json');
  assert.equal(r.length,1);
  assert.equal(r[0].qty,62400);
  const t=r[0].table;
  assert.deepEqual([...t.cols],['qty','price','amount']);
  assert.ok(mid(t.bounds.price)>468&&mid(t.bounds.price)<513,'offered ต่อหน่วย column');
  assert.ok(mid(t.bounds.amount)>520,'offered รวม column');
  assert.deepEqual([...t.sums.map(s=>s.key)],['amount','vat','total']);
}
// กฟส.พุทไธสง: "ราคาที่เสนอ(บาท)" has no headings under it; its two halves are ต่อหน่วย and รวม
{
  const r=rows('quote-notice-putthaisong.json');
  assert.equal(r.length,1);
  assert.equal(r[0].qty,72000);
  const t=r[0].table;
  assert.deepEqual([...t.cols],['qty','price','amount']);
  assert.ok(mid(t.bounds.price)>453&&mid(t.bounds.price)<mid(t.bounds.amount),'offered halves');
  assert.deepEqual([...t.sums.map(s=>s.key)],['amount','vat','total']);
}
// กฟส.เมืองนครราชสีมา 2: จำนวน (ราย/เดือน) left blank, one "รวม" row with "-" under เป็นเงิน / ภาษี / รวมทั้งสิ้น
{
  const r=rows('quote-notice-nakhonratchasima2.json');
  assert.equal(r.length,1);
  assert.equal(r[0].qtyEdit,true);
  const t=r[0].table;
  assert.equal(t.perMonth,true,'quantity per month');
  assert.deepEqual([...t.cols],['qty','price','amount','vat','total']);
  assert.deepEqual([...t.sums.map(s=>[s.key,s.across,s.blank.length])],[['amount',true,3]]);
}
// กฟส.ด่านขุนทด: "ราคาที่เสนอ (บาท)" over "ต่อหน่วย" | "รวม(ไม่รวม" + "ภาษีมูลค่าเพิ่ม)" wrapped; quantity under "ปริมาณ งานจ้าง (ราย)"
{
  const r=rows('quote-notice-dankhunthot.json');
  assert.equal(r.length,1);
  assert.equal(r[0].qty,102000);
  const t=r[0].table;
  assert.deepEqual([...t.cols],['qty','price','amount']);
  assert.ok(mid(t.bounds.price)>326&&mid(t.bounds.price)<365,'offered ต่อหน่วย column');
  assert.ok(mid(t.bounds.amount)>400&&mid(t.bounds.amount)<467,'offered รวม column');
  assert.deepEqual([...t.sums.map(s=>s.key)],['amount','vat','total']);
}
// กฟส.น้ำพอง: tone marks stored as "É"/"Ê" and out of place ("รวมทั"+"งสิ"+"Ê"+"น"), the รวมทั้งสิ้น row must still be found
{
  const r=rows('quote-notice-namphong.json');
  assert.equal(r.length,1);
  assert.equal(r[0].qty,82300);
  const t=r[0].table;
  assert.deepEqual([...t.cols],['qty','price','amount']);
  assert.deepEqual([...t.sums.map(s=>s.key)],['amount','vat','total']);
}
// กฟส.โนนสูง: "จ านวน" (ำ lost to a space), one row with เป็นเงิน / ภาษี / รวมทั้งสิ้น columns and no summary rows;
// numbers touching Thai words ("108,000.ราย", "924,480บาท") are redrawn on their own, not over the word
{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-notice-nonsung.json'),'utf8'));
  const r=ctx.read(raw);
  assert.equal(r.length,1);
  assert.equal(r[0].qty,108000);
  assert.equal(r[0].label,'ใบแจ้งเตือน');
  assert.deepEqual([...r[0].table.cols],['qty','price','amount','vat','total']);
  assert.equal(r[0].table.sums.length,0);
  const d=ctx.digits(raw.map(i=>Object.assign({},i,{str:i.str.replace(/\d/g,c=>String.fromCharCode(0x0E50+ +c))})));
  const q=d.find(x=>x.text==='108,000'&&x.y<300), b=d.find(x=>x.text==='924,480');
  assert.ok(q&&q.x+q.w<209.9,'quantity in the heading stops before ".ราย"');
  assert.ok(b&&b.x+b.w<463.7,'budget stops before "บาท"');
}
for(const f of ['quote-notice-putthaisong.json','quote-notice-sikhoraphum.json'])assert.equal(rows(f)[0].table.perMonth,false);
// a new job is named after the office's site
for(const [f,site] of [['quote-notice-putthaisong.json','พุทไธสง'],['quote-notice-dankhunthot.json','ด่านขุนทด'],['quote-notice-sikhoraphum.json','ศีขรภูมิ'],['quote-notice-nakhonratchasima2.json','เมืองนครราชสีมา 2']]){
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',f),'utf8'));
  assert.equal(ctx.officeSite(raw.map(i=>i.str).join(' ')),site);
}
// กฟส.ปราสาท: the form prints its numbers in Thai digits (๑๒๐,๐๐๐ / ๘.๐๐ / VAT ๗%); they are rewritten in Arabic like the filled prices
{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-notice-prasat.json'),'utf8'));
  const r=ctx.read(raw);
  assert.equal(r.length,1);
  assert.equal(r[0].qty,120000);
  assert.deepEqual([...r[0].table.sums.map(s=>s.key)],['amount','vat','total']);
  const d=ctx.digits(raw);
  const of=t=>[...d.filter(x=>x.text===t).map(x=>x.align)];
  assert.deepEqual(of('120,000'),['center']);
  assert.deepEqual(of('8.00'),['center']);
  assert.deepEqual(of('860,000.00'),['center']);
  assert.deepEqual(of('1'),['center']);
  assert.deepEqual(of('7%'),['right'],'VAT 7% label');
  assert.deepEqual(of('2570'),['right','right'],'year at the end of a heading');
  const vat=raw.find(i=>i.str==='VAT ๗%'), v=d.find(x=>x.text==='7%');
  assert.ok(Math.abs(v.x+v.w-(vat.x+vat.w))<0.01&&v.x>vat.x+10,'only the number part of "VAT ๗%" is covered');
}
// กฟจ.บุรีรัมย์ (Attach_TOR_3.pdf): a scanned picture, turned ≈0.9°, no text at all; the table is read from its lines
{
  const zlib=require('node:zlib');
  const buf=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures','quote-notice-buriram-scan.pbm.gz')));
  const m=buf.toString('latin1',0,40).match(/^P4\s+(\d+)\s+(\d+)\s/), W=+m[1], H=+m[2], rb=Math.ceil(W/8);
  const ink=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)ink[y*W+x]=(buf[m[0].length+y*rb+(x>>3)]>>(7-(x&7)))&1;
  const r=ctx.grid(ink,W,H,3,0);   // pdftoppm -r 216 -mono = the app's 3 pixels per point
  assert.equal(r.length,1,'one item row, the empty spacer row is skipped');
  assert.equal(r[0].qtyEdit,true); assert.equal(r[0].qtyPrinted,true,'168,000 is printed in the picture, not redrawn');
  const c=r[0].cells;
  assert.ok(c.qty[0]>283&&c.qty[1]<368&&c.price[0]>360&&c.price[1]<441&&c.amount[0]>431&&c.amount[1]<569,'quantity | price | amount cells');
  assert.ok(r[0].y>316&&r[0].y<330,'first text line of the item');
  const t=r[0].table;
  assert.deepEqual([...t.sums.map(s=>s.key)],['amount','vat','total']);
  t.sums.forEach((s,i)=>{assert.ok(s.cell[0]>430&&s.cell[1]<569,'sum in the last column');assert.ok(s.y>405+i*18&&s.y<422+i*18,'sum row '+i);});
  // a blank page or text-only scan has no table
  assert.equal(ctx.grid(new Uint8Array(W*H),W,H,3,0).length,0);
}
console.log('PASS: quote notice layouts (scanned form read from table lines, Thai digits → Arabic, misplaced tone marks in รวมทั้งสิ้น, tall header, wrapped รวม(ไม่รวมภาษี) heading, offered column without headings, per-month blank quantity, site name)');

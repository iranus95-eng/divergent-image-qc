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
this.officeSite=officeSite;`,ctx);
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
for(const f of ['quote-notice-putthaisong.json','quote-notice-sikhoraphum.json'])assert.equal(rows(f)[0].table.perMonth,false);
// a new job is named after the office's site
for(const [f,site] of [['quote-notice-putthaisong.json','พุทไธสง'],['quote-notice-sikhoraphum.json','ศีขรภูมิ'],['quote-notice-nakhonratchasima2.json','เมืองนครราชสีมา 2']]){
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',f),'utf8'));
  assert.equal(ctx.officeSite(raw.map(i=>i.str).join(' ')),site);
}
console.log('PASS: quote notice layouts (tall header, offered column without headings, per-month blank quantity, site name)');

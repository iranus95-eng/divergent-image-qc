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
this.torFields=torFields;this.blankDefaults=blankDefaults;this.thaiText=thaiText;this.blankBudget=blankBudget;`,ctx);

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
console.log('PASS: quote notice blank form (TOR import, site defaults)');

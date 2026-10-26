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
vm.runInNewContext(`var VAT=0.07;${src.slice(a,b)};this.extract=extract;this.mergeDocs=mergeDocs;`,ctx);
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

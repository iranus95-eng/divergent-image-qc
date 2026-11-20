// เมนูค้ำประกันสัญญา: LG / ตราสาร tabs like LG-ตราสาร2570.xlsx. Synthetic fixtures only (no customer records).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CG_PLAYWRIGHT || 'playwright');
const items = [
  { id: 1, seq: 1, zone: 'ฉ.3', site: 'ไซด์ A', office: 'กฟส.ไซด์ A', qty: 48000, price_bid: '6.3000', status: 'ชนะประมูล' },
  { id: 3, seq: 3, zone: 'ฉ.1', site: 'ไซด์ <C>', qty: null, price_bid: '5.0200', status: 'ชนะประมูล' },
  { id: 4, seq: 4, zone: 'ฉ.1', site: 'ไซด์ D', office: 'กฟจ.ไซด์ D', qty: 72000, price_bid: '4.8300', status: 'ชนะประมูล' },
];
let contracts = [{ notice_bid_id: 1, pea_name: 'การไฟฟ้าทดสอบ A', tax_id: '0000000000000', branch_no: '00001', address: '1 หมู่ 1', contract_no: '001/2569', contract_date: '2026-11-19', wage_ex_vat: 302400, guarantee: 16179, period: '1/1/2570-31/12/2570', lg_done: true, stamp_done: false }];
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const saves = [];
  await page.route('https://neauzvqroaszvqffahkv.functions.supabase.co/won-contract-api', async (r) => {
    const b = r.request().postDataJSON(); let out = { ok: true };
    if (b.action === 'list') Object.assign(out, { items, contracts });
    if (b.action === 'save') { saves.push(b); const item = { ...(contracts.find((c) => c.notice_bid_id === b.notice_bid_id) || {}), ...b.row, notice_bid_id: b.notice_bid_id, wage_ex_vat: +b.row.wage_ex_vat || null, guarantee: +b.row.guarantee || null, contract_date: b.row.contract_date || null }; contracts = contracts.filter((c) => c.notice_bid_id !== b.notice_bid_id).concat([item]); out.item = item; }
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('https://cg-test.invalid/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div class="side-nav"><div class="nav-item" id="navPaperOrder">กระดาษ</div><div class="nav-item" id="navNoticeBids">ตาราง</div></div><main class="main-shell"><section id="otherWorkspace">other</section></main>' }));
  await page.goto('https://cg-test.invalid/');
  await page.evaluate(() => { localStorage.setItem('divergent_web_session_user', JSON.stringify({ username: 'admin', role: 'admin' })); window.getBestDataToken = async () => 't'; });
  await page.addScriptTag({ path: 'js/contract-guarantee.js' });
  // pure helpers: the file's own numbers
  assert.deepEqual(await page.evaluate(() => [302400, 409200, 834000, 482460, 361440, 347760].map(ContractGuarantee.guaranteeOf)), [16179, 21893, 44619, 25812, 19338, 18606]);
  assert.equal(await page.evaluate(() => ContractGuarantee.beDate('2026-11-19')), '19/11/2569');
  assert.equal(await page.evaluate(() => ContractGuarantee.peaName({ office: 'กฟจ.ชัยภูมิ', site: 'ชัยภูมิ' })), 'การไฟฟ้าส่วนภูมิภาคจังหวัดชัยภูมิ');
  assert.equal(await page.evaluate(() => document.getElementById('navPaperOrder').nextElementSibling.id), 'navContractGuarantee');
  await page.locator('#navContractGuarantee').click();
  await page.locator('.cg-table').first().waitFor();
  let text = await page.locator('#contractGuaranteeWorkspace').innerText();
  // one table, two lines per site (LG then ตราสาร)
  assert.equal(await page.locator('.cg-two tbody tr').count(), 6);
  assert.match(text, /การไฟฟ้าทดสอบ A[\s\S]*001\/2569[\s\S]*19\/11\/2569[\s\S]*✓ LG[\s\S]*เงินค้ำ 16,179[\s\S]*ตราสาร · ยังไม่ได้[\s\S]*ค่าจ้าง 302,400[\s\S]*0000000000000/);
  assert.match(text, /ไซด์ <C>/);
  assert.match(text, /เงินค้ำ 18,606/);                    // ไซด์ D: 72,000 × 4.83 estimate
  assert.match(text, /ยังไม่มีค่าจ้าง/);
  assert.match(text, /ยังไม่ได้ LG 2[\s\S]*ยังไม่ได้ตราสาร 3/);
  assert.equal(await page.locator('#otherWorkspace').isVisible(), false);
  await page.locator('[data-tab=stamp]').click();
  assert.equal(await page.locator('.cg-two tbody tr').count(), 6);
  await page.locator('[data-tab=lg]').click();
  assert.equal(await page.locator('.cg-two tbody tr').count(), 4);
  await page.locator('[data-tab=all]').click();
  // fill ไซด์ D: defaults come from the bid, guarantee follows the wage
  await page.locator('[data-cg=edit][data-id="4"]').click();
  assert.equal(await page.locator('#cgModal [name=pea_name]').inputValue(), 'การไฟฟ้าส่วนภูมิภาคจังหวัดไซด์ D');
  assert.equal(await page.locator('#cgModal [name=wage_ex_vat]').inputValue(), '347760');
  assert.equal(await page.locator('#cgModal [name=guarantee]').inputValue(), '18606');
  await page.locator('#cgModal [name=wage_ex_vat]').fill('302400');
  assert.equal(await page.locator('#cgModal [name=guarantee]').inputValue(), '16179');
  await page.locator('#cgModal [name=contract_no]').fill('ฉ.3/009');
  await page.locator('#cgModal [name=contract_date]').fill('2026-11-20');
  await page.locator('#cgModal [name=lg_done]').check();
  await page.locator('#cgModal [type=submit]').click();
  await page.locator('#cgModal').waitFor({ state: 'detached' });
  assert.equal(saves.length, 1);
  assert.equal(saves[0].row.lg_done, true); assert.equal(saves[0].row.stamp_done, false); assert.equal(saves[0].row.tax_id, '0994000165501');
  text = await page.locator('#contractGuaranteeWorkspace').innerText();
  assert.match(text, /ยังไม่ได้ LG 1/);
  assert.match(await page.locator('tfoot').innerText(), /32,358/);   // 16,179 × 2
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => localStorage.setItem('divergent_web_session_user', JSON.stringify({ username: 'staff1', role: 'staff' })));
  await page.evaluate(() => document.body.appendChild(document.createElement('div')));
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.getElementById('navContractGuarantee').style.display), '');   // every signed-in user
  await page.locator('#navContractGuarantee').click();
  await page.locator('.cg-two').waitFor();
  assert.equal(await page.locator('[data-cg=bids]').count(), 0);                                                  // ตารางประมูล stays admin-only
  assert.equal(await page.locator('[data-cg=edit]').count() > 0, true);
  await page.evaluate(() => localStorage.removeItem('divergent_web_session_user'));
  await page.evaluate(() => document.body.appendChild(document.createElement('div')));
  await page.waitForFunction(() => document.getElementById('navContractGuarantee').style.display === 'none');
  assert.deepEqual(errors, []);
  console.log('PASS contract-guarantee: one table with LG + ตราสาร lines per site, not-yet filters, 5%×1.07 guarantee, edit+save, mobile width, menu for every signed-in user');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

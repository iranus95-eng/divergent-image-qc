// เมนูค้ำประกันสัญญา: lists only won sites (🏆) from notice-bid-api with a 5% contract guarantee. Synthetic fixtures only.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CG_PLAYWRIGHT || 'playwright');
const items = [
  { id: 1, seq: 1, zone: 'ฉ.3', site: 'ไซด์ A', office: 'กฟส.A', project_no: '111', budget: '564960.00', price_bid: '6.2000', bid_date: '2026-10-20', status: 'ชนะประมูล' },
  { id: 2, seq: 2, zone: 'ฉ.3', site: 'ไซด์ B', budget: '1027200.00', price_bid: '5.0200', status: 'ไม่ชนะประมูล' },
  { id: 3, seq: 3, zone: 'ฉ.1', site: 'ไซด์ <C>', budget: '465450.00', price_bid: '5.0200', bid_date: '2026-10-30', status: 'ชนะประมูล' },
  { id: 4, seq: 4, zone: 'ฉ.1', site: 'ไซด์ D', budget: '500000.00', status: 'รอประมูล' },
  { id: 5, seq: 5, zone: 'ฉ.1', site: 'ไซด์ E', budget: '700000.00', status: 'แพ้ ชนะไม่ได้' },
];
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  let calls = 0;
  await page.route('https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api', async (r) => { calls++; await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, items }) }); });
  await page.route('https://cg-test.invalid/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div class="side-nav"><div class="nav-item" id="navNoticeBids">ตาราง</div></div><main class="main-shell"><section id="otherWorkspace">other</section></main>' }));
  await page.goto('https://cg-test.invalid/');
  await page.evaluate(() => { localStorage.setItem('divergent_web_session_user', JSON.stringify({ username: 'admin', role: 'admin' })); window.getBestDataToken = async () => 't'; });
  await page.addScriptTag({ path: 'js/contract-guarantee.js' });
  const nav = page.locator('#navContractGuarantee');
  await nav.waitFor();
  assert.equal(await page.evaluate(() => document.getElementById('navNoticeBids').nextElementSibling.id), 'navContractGuarantee');
  await nav.click();
  await page.locator('#cgBody tr').nth(1).waitFor();
  const body = await page.locator('#cgBody').innerText();
  assert.equal(await page.locator('#cgBody tr').count(), 2);
  assert.ok(!/ไซด์ B|ไซด์ D|ไซด์ E/.test(body), 'only won sites');
  assert.match(body, /ไซด์ <C>/);                      // escaped, shown as text
  assert.ok(body.indexOf('ไซด์ <C>') < body.indexOf('ไซด์ A'), 'sorted by zone');
  assert.match(body, /28,248\.00/);                      // 564,960 × 5%
  assert.match(body, /23,272\.50/);                      // 465,450 × 5%
  assert.match(await page.locator('#cgFoot').innerText(), /1,030,410\.00[\s\S]*51,520\.50/);
  assert.equal(await page.locator('#otherWorkspace').isVisible(), false);
  await page.locator('#cgZone').selectOption('ฉ.3');
  assert.equal(await page.locator('#cgBody tr').count(), 1);
  assert.match(await page.locator('#cgKpis').innerText(), /28,248\.00/);
  await page.locator('#cgZone').selectOption('');
  await page.locator('#cgQ').fill('111');
  assert.equal(await page.locator('#cgBody tr').count(), 1);
  await page.locator('[data-cg=reload]').click();
  await page.waitForFunction(() => document.querySelectorAll('#cgBody tr').length === 1 && !/กำลังโหลด/.test(document.getElementById('cgBody').innerText));
  assert.equal(calls, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // non-admin: menu hidden
  await page.evaluate(() => localStorage.setItem('divergent_web_session_user', JSON.stringify({ username: 'staff1', role: 'staff' })));
  await page.evaluate(() => document.body.appendChild(document.createElement('div')));
  await page.waitForFunction(() => document.getElementById('navContractGuarantee').style.display === 'none');
  assert.deepEqual(errors, []);
  console.log('PASS contract-guarantee: won sites only, 5% guarantee, zone/search filters, refresh, mobile width, admin-only nav');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

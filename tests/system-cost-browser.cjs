const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.COST_PLAYWRIGHT || 'playwright');
const root = path.join(__dirname, '..');
const origin = 'https://divergent-image-qc.vercel.app';
const api =
  'https://neauzvqroaszvqffahkv.functions.supabase.co/system-cost-api';
const bidsApi =
  'https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api';
const quoteApi =
  'https://neauzvqroaszvqffahkv.functions.supabase.co/quote-notice-api';
// Synthetic ตารางประมูลแจ้งเตือน rows: only won offices with a budget, ราคากลาง and a winning price are costed.
const bids = [
  {
    id: 8,
    seq: 8,
    zone: 'ฉ.3',
    site: 'โชคชัย',
    budget: '616320.00',
    mid_price: '8.0000',
    price_bid: '4.5000',
    status: 'ชนะประมูล',
  },
  {
    id: 5,
    seq: 5,
    zone: 'ฉ.3',
    site: 'สตึก',
    budget: null,
    mid_price: '8.0000',
    price_bid: null,
    status: null,
  },
  {
    id: 11,
    seq: 11,
    zone: 'ฉ.3',
    site: 'ปราสาท',
    budget: '1027200.00',
    mid_price: '8.0000',
    price_bid: null,
    status: 'ชนะประมูล',
  },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.COST_CHANNEL !== '' && {
      channel: process.env.COST_CHANNEL || 'msedge',
    }),
  });
  const rows = new Map();
  let fail = false;
  const errors = [];
  async function context(auth = true, mobile = false) {
    const ctx = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    });
    if (auth)
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem(
            'divergent_web_session_token_v1',
            'synthetic-test-session',
          );
        } catch (_) {}
      });
    await ctx.route(origin + '/**', async (route) => {
      const url = new URL(route.request().url());
      const relative =
        decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.join(
        root,
        relative.endsWith('/') ? relative + 'index.html' : relative,
      );
      if (!file.startsWith(root) || !fs.existsSync(file))
        return route.fulfill({ status: 404, body: 'Missing fixture' });
      const ext = path.extname(file);
      await route.fulfill({
        contentType:
          ext === '.js'
            ? 'text/javascript'
            : ext === '.css'
              ? 'text/css'
              : 'text/html',
        body: fs.readFileSync(file),
      });
    });
    await ctx.route(bidsApi, (route) => {
      const body = route.request().postDataJSON();
      if (auth && body.action === 'save') {
        const bid = bids.find((item) => item.id === body.id);
        Object.assign(bid, body.row);
        return route.fulfill({ json: { ok: true, item: bid } });
      }
      return route.fulfill({
        status: auth ? 200 : 401,
        json: auth ? { ok: true, items: bids } : { error: 'SESSION_REQUIRED' },
      });
    });
    // The winning unit price of โชคชัย comes from its เสนอราคาแจ้งเตือน quote.
    await ctx.route(quoteApi, (route) => {
      const body = route.request().postDataJSON();
      return route.fulfill({
        json:
          body.action === 'get'
            ? { ok: true, item: { id: 1, state: { rows: [{ price: 4.65 }] } } }
            : {
                ok: true,
                items: [
                  {
                    id: 1,
                    title: 'ใบเสนอราคา กฟส.โชคชัย',
                    total_amount: '386740.80',
                  },
                ],
              },
      });
    });
    await ctx.route(api, async (route) => {
      const body = route.request().postDataJSON();
      if (fail)
        return route.fulfill({ status: 503, json: { error: 'SERVER_ERROR' } });
      if (body.action === 'list')
        return route.fulfill({ json: { items: [...rows.values()] } });
      const old = rows.get(body.key);
      if (body.revision !== (old?.revision || 0))
        return route.fulfill({
          status: 409,
          json: { error: 'REVISION_CONFLICT' },
        });
      const item = {
        key: body.key,
        value: body.value,
        revision: (old?.revision || 0) + 1,
      };
      rows.set(body.key, item);
      await route.fulfill({ json: { item } });
    });
    ctx.on('page', (page) =>
      page.on('pageerror', (e) => errors.push(e.message)),
    );
    return ctx;
  }
  try {
    const anonymous = await context(false);
    const denied = await anonymous.newPage();
    await denied.goto(origin + '/system-cost/');
    await denied.getByRole('alert').waitFor();
    assert.equal(
      await denied.getByRole('button', { name: 'จดหน่วยแจ้งค่าไฟฟ้า' }).count(),
      0,
    );
    await anonymous.close();

    const ctx = await context();
    const page = await ctx.newPage();
    await page.goto(origin + '/system-cost/');
    await page.getByRole('button', { name: /ใบแจ้งเตือนค่าไฟฟ้า/ }).click();
    // The won sites open on their profit and loss summary.
    await page.getByRole('heading', { name: /สรุปกำไรขาดทุน/ }).waitFor();
    assert.match(
      await page.locator('table').innerText(),
      /โชคชัย[\s\S]*4\.65[\s\S]*รวม 1 ไซด์/,
    );
    await page.getByText(/ยังไม่นับในยอดรวม.*ปราสาท ขาดราคาที่ชนะ/).waitFor();
    assert.equal(await page.getByRole('button', { name: /สตึก/ }).count(), 0);
    await page.getByRole('button', { name: /ปราสาท.*ขาดราคาที่ชนะ/ }).waitFor();
    // Marking a site won writes the same status as ตารางประมูลแจ้งเตือน.
    await page.getByRole('button', { name: /เพิ่มไซด์ที่ชนะประมูล/ }).click();
    await page.getByLabel('ชนะประมูล สตึก').click();
    await page.getByRole('button', { name: /สตึก.*ขาดงบประมาณ/ }).waitFor();
    assert.equal(bids.find((bid) => bid.id === 5).status, 'ชนะประมูล');
    await page.getByRole('button', { name: /แสดงเฉพาะไซด์ที่ชนะประมูล/ }).click();
    await page.getByRole('table').getByRole('button', { name: 'โชคชัย' }).click();
    const laborInput = page.getByLabel('ค่าแรงส่งใบแจ้งเตือน (บาท/ราย)', {
      exact: true,
    });
    const topSave = page.getByRole('button', { name: 'บันทึก', exact: true });
    // Every edit raises the unsaved warning until บันทึก is pressed.
    await laborInput.fill('3.51');
    await page.locator('.dvBarUnsaved').waitFor();
    await topSave.click();
    await page
      .getByRole('status')
      .filter({ hasText: 'บันทึกข้อมูลในฐานข้อมูลกลางแล้ว' })
      .waitFor();
    assert.equal(await page.locator('.dvBarUnsaved').count(), 0);
    assert.equal(await topSave.isDisabled(), true);
    assert.equal(
      rows.get('epc:electricity-notice:v1:site:bid-8').value.labor,
      3.51,
    );
    await laborInput.fill('3.5');
    await page.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }).click();
    await page
      .getByRole('status')
      .filter({ hasText: 'บันทึกข้อมูลในฐานข้อมูลกลางแล้ว' })
      .waitFor();
    const key = 'epc:electricity-notice:v1:site:bid-8';
    assert.equal(rows.get(key).value.jobs, 6420);
    assert.equal(rows.get(key).value.budget, 616320);
    assert.equal(rows.get(key).value.auction, 4.65);
    assert.equal(rows.get(key).value.labor, 3.5);

    const ctxB = await context(true, true);
    const second = await ctxB.newPage();
    await second.goto(origin + '/system-cost/');
    await second.getByRole('button', { name: /ใบแจ้งเตือนค่าไฟฟ้า/ }).click();
    await second
      .getByRole('table')
      .getByRole('button', { name: 'โชคชัย' })
      .click();
    assert.equal(
      await second.evaluate(() =>
        localStorage.getItem('epc:electricity-notice:v1:site:bid-8'),
      ),
      null,
    );

    // Exercise both calculators and cloud scenario CRUD through the original UI.
    await page.getByRole('button', { name: 'กลับไปเลือกโปรเจกต์' }).click();
    await page.getByRole('button', { name: /จดหน่วยแจ้งค่าไฟฟ้า/ }).click();
    await page.getByLabel('ชื่อชุดคำนวณ').fill('Cloud scenario fixture');
    await page
      .getByRole('button', { name: 'บันทึกชุดคำนวณ', exact: true })
      .click();
    await page.getByText('บันทึกชุดคำนวณแล้ว', { exact: true }).waitFor();
    assert.equal(
      [...rows.values()].filter(
        (row) => row.key.startsWith('scenario:') && row.value,
      ).length,
      1,
    );
    await page.reload();
    await page.getByRole('button', { name: /จดหน่วยแจ้งค่าไฟฟ้า/ }).click();
    await page.getByText('Cloud scenario fixture', { exact: true }).waitFor();
    await page.getByRole('button', { name: /จตุรัส/ }).click();
    await page.getByText('ค่าแรงต่อราย (บาท)', { exact: true }).waitFor();

    // A second actor's newer record must never be silently overwritten.
    rows.get(key).revision++;
    // Alter a field using its associated label (the main labor input).
    const labor = second.getByLabel('ค่าแรงส่งใบแจ้งเตือน (บาท/ราย)', {
      exact: true,
    });
    await labor.fill('3.75');
    await second.getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }).click();
    await second
      .getByRole('status')
      .filter({ hasText: 'ข้อมูลถูกแก้ไขจากอีกหน้าจอ' })
      .waitFor();
    assert.equal(rows.get(key).value.labor, 3.5);
    assert.match(
      await second.evaluate(() =>
        localStorage.getItem('system-cost:pending:v1'),
      ),
      /3.75/,
    );
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(
      'PASS: anonymous denial, notice save, cross-device load, scenario creation/reload, bid calculator, and concurrent-write protection',
    );
    await ctx.close();
    await ctxB.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

# คำนวนต้นทุนระบบงาน

The existing Executive Profit Calculator is hosted at `/system-cost/` and opened from the authenticated QC application's finance menu. It keeps the original reading calculators, nine notice calculators, and printable/PDF reports.

## Build

Use Node 22+ and the committed pnpm lockfile:

```sh
cd cost-calculator
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run build
```

The build updates the committed `system-cost/` static assets. Vercel keeps its existing static deployment configuration; no build command for the rest of the QC app is changed. Commit the source and generated assets together.

## Data and access

- `system-cost-api` authenticates the existing QC `app_sessions` token and active `admin` role on every request.
- `system_cost_records` holds the shared calculator key/value records and original saved scenarios, with revision checks to reject stale writes.
- Direct anon/authenticated database and RPC access is revoked. The Edge Function uses its server-side service role after checking the session.
- The client loads cloud data before mounting the calculators. Site edits retain the original automatic/manual save rules, but writes now go to the protected API.
- A status bar distinguishes queued writes, confirmed saves, and failures. Failed writes remain local drafts and can be recovered after reloading. They are not described as cloud saves.
- Deleting an original saved scenario writes a tombstone so importing old data cannot resurrect it.
- The original AppDeploy server's one scenario was copied without deleting or modifying its original. Browser-only values require the owner to click **นำเข้าข้อมูลจากเว็บเดิม** from the browser/profile where they were saved.
- The old app's `#transfer-cost-data` page only reads allowlisted calculator storage keys and scenarios, after an explicit click, and posts to the exact Vercel production origin. Destination checks both origin and popup source. Existing destination records are never overwritten by migration.

## Verify

```sh
node tests/v2-unified.cjs
node tests/quote-notice-layouts.cjs
node tests/notice-bids-extract.cjs
COST_PLAYWRIGHT=/absolute/path/to/playwright node tests/system-cost-browser.cjs
```

The calculator browser test uses synthetic session/data fixtures and exercises anonymous denial, notice saving, separate browser contexts, reading calculator persistence, and stale-write rejection. Database transaction checks additionally exercise insert/update and rollback without retaining fixtures.

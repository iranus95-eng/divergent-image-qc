# V2 unified production app

The root path `/` is the only application UI. The old preview and duplicate V1/V2 assets have been removed.

All production menus remain in the root application: claims, blocked claims, payroll, cash advances, expenses, QC, search, location comparison, users, invoices, billing, profit/loss, and staff payroll.

`app-v2.css` owns the shared V2 visual shell. `js/app-v2.js` supplies the permission-aware mobile navigation and marks the application as V2. Existing feature handlers remain intact so the migration does not alter business formulas or API payloads.

Staff payroll uses `staff-payroll-report-api`, `staff_payroll_monthly_drafts`, `ensure_staff_payroll_month`, and `staff_payroll_report_rows`. The old legacy-named endpoint and database objects are retired after deployment.

Validation:

- `node tests/v2-unified.cjs`
- `node tests/staff-payroll-v2.cjs`
- Run `tests/staff-payroll-v2.sql` against the September fixture; it rolls back every mutation.

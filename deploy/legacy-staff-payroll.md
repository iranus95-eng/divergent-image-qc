# Legacy monthly staff payroll

The root site's `staff_payroll_rows` request uses `legacy-staff-payroll-api`.
The existing profit-loss API, shared salary table, and V2 assets are unchanged.

- `legacy_staff_payroll_drafts` holds a zero-valued roster while salary input is pending.
- The scheduled database job runs daily at 00:05 Asia/Bangkok and creates each new month once. The current-month API request is also a retry path.
- Roster identity comes from the latest month. An unambiguous payroll profile is captured and carried forward. Missing or ambiguous matches are not assigned to another employee.
- Only APPROVED requests are summed by profile and the request's month in Asia/Bangkok. Request time is immutable; approval date and mutable profile source-month are not the accounting period.
- The response replaces advance deduction and adjusts the existing net by `net_paid + stored_advance_deduction - approved_total`. Other salary fields are preserved. Stored values are never repeatedly deducted on refresh.
- Real entries in `staff_payroll_rows` take precedence over drafts for that month. Enter/import the complete monthly roster through the existing data-entry process. Drafts are not a salary-entry form.
- Draft net can be negative before salary entry; the root UI marks it as pending, not an amount ready for payment.
- Tables and RPCs are restricted to the service role. The Edge Function retains the existing owner/session and LINE authentication checks.

Deployment: apply migrations in order, deploy `legacy-staff-payroll-api` with custom authentication (`verify_jwt=false`), then deploy the root static site.

Validation: `node tests/legacy-staff-payroll.cjs`; run `tests/legacy-staff-payroll.sql` against the September test dataset. The integration test rolls back all mutations and invokes no approval/LINE endpoints.

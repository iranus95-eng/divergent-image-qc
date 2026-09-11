# Divergent Image QC — V2 Status

Last updated: 2026-09-11

## Production

- Repository: `iranus95-eng/divergent-image-qc`
- Branch: `main`
- Production route: `/`
- The root route is the single V2 application. The separate preview application has been retired and redirects to `/`.

## Available modules

The unified V2 application contains authentication, home navigation, claims, pending claims, employee payroll, staff payroll, employee advances, staff expenses, QC, data search, coordinate search, user management, invoices, billing, and monthly profit/loss.

Desktop and mobile navigation use the same permission checks as each module. No placeholder workspace remains.

## Staff payroll automation

- `staff_payroll_monthly_drafts` holds a zero-value monthly roster while salary is waiting to be entered.
- `ensure_staff_payroll_month(date)` creates the current month's roster automatically and never duplicates a month.
- `staff_payroll_report_rows(date)` totals only `APPROVED` employee advances in the matching Bangkok calendar month, groups multiple requests by payroll profile, writes the result to `advance_deduction`, and adjusts only `net_paid`.
- Entered payroll rows replace the waiting draft in the report while keeping the approved advance deduction.
- The daily scheduled job creates the current month automatically, so the same behavior continues every month.
- The V2 browser calls `staff-payroll-report-api`.

## Deployment checks

CI validates the V2 root, all module entry points, browser script syntax, deployment configuration, payroll API access control, and the approved-advance summary fixture of 202.98 baht.

# Compensation register

The root compensation menu now opens a persistent register instead of the old preview-only form. The existing root HTML changes only by loading `js/claim-register.js`; the module renders inside the existing claim workspace using a shadow root. Other menu scripts and routes remain unchanged.

The register supports year/month/agency/status filters, subtotals, manual claims, edits before receiving money, append-only receipts, and private PDF evidence in the existing money-reports bucket. Existing admin/QC access rules apply; viewers cannot write. Browser clients cannot access the new tables directly. The Edge Function validates existing app sessions or the configured LINE channel and uses the service-only, transactional RPC.

## Preserved source

Workbook SHA-256: `15fb89baa9f4823d1ed25a61073fb300edcd81d9be56747499a8a249fd9da90b`.

Before import there were no compensation-register tables. The import preserves all 14 raw worksheets, original values/formulas/cached results, and a separate snapshot of the previous 165-row web dataset. The register has 206 source rows: monthly 165, arrears 21, guarantees 20. Source hash/sheet/row uniqueness makes repeated imports non-destructive. Blank template rows are retained in the raw workbook snapshot, not counted as agency entries. Original workbook and root source backups are retained locally outside the repository.

The workbook's fine column sometimes calculates claimed minus received, which includes outstanding money. All historical rows therefore remain pending review. Historical amounts are visible, but outstanding/fine totals are explicitly incomplete until a permitted user confirms the opening amounts and records a reason. This never overwrites the source cells. Guarantees remain a separate, read-only register. Original date text is preserved without guessing the calendar year.

## Deployment and checks

Apply `db/claim-register.sql`, import the preserved workbook snapshot and rows, then deploy `supabase/functions/claim-register-api/index.ts` with platform JWT verification disabled because this app uses its existing custom session/LINE authentication. The handler itself always verifies authorization. Never put the service-role key in the browser.

On 2026-09-12 the schema, import, and function were deployed to the existing project. Final verification: 206 source rows, 14 sheets, one import, zero test receipts and zero test audit entries remaining.

Run from repository root:

```
node --check js/claim-register.js
node tests/claim-register-api.cjs
node tests/claim-register-browser.cjs
```

The API test requires Node with `module.stripTypeScriptTypes`. Browser checks require Playwright and Edge (or set CLAIM_BROWSER); CLAIM_PLAYWRIGHT optionally selects the module path. Tests use synthetic records and a mocked transport. They cover create/update, filters, partial/full receipts, fines, blank historical confirmation, read-only controls and mobile layout. Execute `tests/claim-register.sql` as a transaction with its final rollback to verify the database permissions, idempotency, locking and amount guards against the imported data. That SQL test is an integration check for this deployment, not an unattended production migration.

Database integration tests, API validation tests, browser tests and the existing staff-payroll test passed. The live unauthenticated endpoint returned 401. An authenticated end-to-end user session and real evidence upload have not been exercised. Existing `tests/v2-unified.cjs` fails on a payroll get_employee text-pattern assertion on both baseline commit `44514138d44983337f8a75d6eb03cdb863614825` and this change. The payroll code/test is outside this change and was not modified.

To roll back the UI, remove only the claim-register script include. Keep the tables, raw source and receipt/audit history intact.

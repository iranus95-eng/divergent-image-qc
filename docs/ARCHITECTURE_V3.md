# Divergent Clean Architecture V3

Branch: `rebuild-clean-v3`

## Goal
Separate responsibilities so changes in one area do not unexpectedly break another area.

## Core rules
1. One authenticated identity at a time.
2. One permission contract shared by database, APIs, and frontend.
3. Sidebar renders permissions; it does not calculate permissions.
4. Each business module owns its own UI/API/data concerns.
5. Legacy behavior is migrated module-by-module, not copied wholesale.

## Target frontend structure

```text
js/
  core/
    permissions.js
    auth-session.js
    api-client.js
    events.js
    logger.js
  ui/
    sidebar.js
    notifications.js
  modules/
    qc/
    search/
    payroll/
    staff-expenses/
    user-management/
    invoice/
    billing/
    pnl/
```

## Canonical permission keys

```text
qc
claim
claim_pending
search
payroll
staff_expenses
user_management
invoice
billing
pnl
```

Every layer must use exactly these names.

## Migration order
1. Permission contract
2. Auth/session kernel
3. Sidebar renderer
4. User management
5. Payroll
6. Staff expenses
7. QC/Image Rescue
8. Search/Location Finder
9. Invoice/Billing/P&L
10. Remove legacy duplicate logic

## Safety
- `main` remains production until a module is tested.
- Changes are developed in `rebuild-clean-v3`.
- Backup branch: `backup-main-before-clean-v3-2026-09-07`.
- No legacy function or database RPC is removed until all callers are identified.

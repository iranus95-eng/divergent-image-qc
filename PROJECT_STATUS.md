# Divergent Image QC — Project Status

Last updated: 2026-09-10

## Why V2 exists
The legacy template accumulated UI/behavior problems and repeated fixes were causing regressions. The current strategy is to keep the legacy system as reference only, build a clean V2 template, and migrate working modules into V2 one at a time.

## Source of truth
- Repository: `iranus95-eng/divergent-image-qc`
- Branch: `main`
- Production is deployed from the current V2 work on `main`.
- Do not overwrite V2 with old recovery/export HTML files.

## Migration status
- V2 shell/template: active
- Authentication: migrated
- Profit/Loss: migrated/connected
- QC inspection: in progress

## QC inspection — current stage
Working flow currently implemented:
1. Open QC menu.
2. Select site.
3. Load QC batches.
4. Open a batch.
5. Load batch images and coordinate data.
6. Show image cards with CA, file name, route-distance classification, and filters.
7. Image detail modal is implemented and is being hardened so clicking/tapping any image card reliably opens the detail view.

Current image detail contains:
- Enlarged original image
- CA number
- File name
- Road distance
- Notice latitude/longitude
- Meter latitude/longitude
- Google Maps links when coordinates exist

Recent QC click/navigation fixes:
- `d320194` — Fix QC batch navigation and focus detail
- `20392d7` — Style QC batch detail navigation
- `5a212e9` — Fix QC image card click handling
- `428dc56` — Harden QC image card pointer behavior

## Next QC work
1. Verify image-card click/tap in Production.
2. Finish a stable image-detail inspection workflow.
3. Move remaining required QC actions from the old template only after each part is verified in V2.
4. Avoid changing unrelated menus while QC is being stabilized.

## Deferred Location Finder / Image Rescue requirement
Before operators can start work, they must select both:
- Site
- Work date

If either is missing, the app must block receiving/saving/sending images so data cannot be assigned to the wrong site/date.

This is intentionally deferred until the web QC V2 migration is stable.

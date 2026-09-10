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
- QC inspection: in progress and usable through image review

## QC inspection — current stage
Working flow currently implemented:
1. Open QC menu.
2. Select site.
3. Load QC batches.
4. Open a batch.
5. Load batch images and notice-coordinate data.
6. Show image cards with CA, file name and notice coordinates.
7. Filter images by whether notice coordinates exist.
8. Click/tap the whole image card to open the detail modal.
9. Review images sequentially with Previous / Next controls.
10. Keyboard review is supported: Left/Right arrows move between images and Esc closes the modal.
11. Open notice coordinates in Google Maps.
12. Reject an image and send the QC message + image through LINE shareTargetPicker.

Current image detail contains:
- Enlarged original image
- Image position counter within the current filtered/visible set
- Previous / Next navigation
- CA number
- File name
- Notice latitude/longitude
- Google Maps link when notice coordinates exist
- LINE reject/share action

Coordinate checkpoint passed on 2026-09-10:
- `qc-batch-data` Version 5 is the current baseline.
- Notice coordinates are selected by exact matched object path first, then matching site + batch, then matching source photo name.
- Meter coordinates and route distance are intentionally deferred for now.

Site handling:
- V2 currently has the restored legacy site list in the UI as a compatibility fallback.
- `qc-api` Version 11 now exposes action `sites`, returning distinct current sites from `image_batches` so the UI can move away from a hardcoded list and automatically include future sites.

Stability improvements now included:
- Delegated image-card click handling so thumbnail replacement does not break clicks.
- Card contents do not swallow pointer events.
- Signed image URLs are cached during the session to reduce repeated requests.
- Modal requests are sequence-guarded so rapid navigation cannot let an older image request overwrite a newer modal.
- Modal is closed/reset when switching batch/filter or returning to the batch list.
- LINE LIFF SDK can be loaded by the QC module when needed.

Recent QC commits / checkpoints:
- `5a212e9` — Fix QC image card click handling
- `428dc56` — Harden QC image card pointer behavior
- `20df66c` — Stabilize V2 QC image review workflow
- `5667648` — Restore LINE share action in V2 QC review
- `8189aa5` — Fix V2 QC LINE contact picker login flow
- `60b293b` — Auto-load LINE LIFF SDK in V2 QC
- `98c59bd` — Show notice coordinates first and restore full site list
- `7476a55` — Improve V2 QC image detail review layout

## Next QC work
1. Change the V2 site selector to prefer the new dynamic `qc-api` sites list while keeping the restored list as fallback.
2. Harden LINE sending to match the legacy behavior, including image URL validation and success/failure feedback.
3. Continue migrating only the required QC actions from the legacy template without changing unrelated menus.

## Deferred Location Finder / Image Rescue requirement
Before operators can start work, they must select both:
- Site
- Work date

If either is missing, the app must block receiving/saving/sending images so data cannot be assigned to the wrong site/date.

This remains deferred until the web QC V2 migration is stable.

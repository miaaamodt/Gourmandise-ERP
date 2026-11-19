# Weekly planning and inventory imports

This release extends the existing ERP. It does not rebuild the catalog, replace the recurring schedule, reset inventory, or change forecast formulas.

## Weekly plan

Choose a date in **Week of Monday**, or use Previous, Next, and Current week. The date is normalized using the local Monday calendar date, not a UTC timestamp. Monday–Friday cards show their calendar dates.

The Week 1, Week 2, Every Week, and On Demand tabs retain their original recurring categories. Choosing a calendar week does not relabel those categories. Recurring occurrence IDs are derived from their existing schedule IDs; temporary entries receive UUIDs.

Drag a card using its grip/name area, or use its **Move to** dropdown on any device. The selected week's day assignment is saved centrally. Quantities and categories do not change when moving a card. Future weeks use recurring days unless they have their own overrides.

**Undo Move** reverses the last move for the selected week. **Reset This Week** asks for confirmation, then resets day assignments in all four sections of that week. It keeps temporary entries, removals, quantities, inventory, sales, and other weeks. Reset does not restore removed occurrences.

**+ Add item**, beside On Demand, adds an existing catalog product or a custom task to the current week and section. Set its day, units, and batches. The item does not become recurring and does not change inventory. Known product yields retain the existing units/batches conversion logic; custom tasks without yields can use independent quantities.

**− Remove item** opens one searchable combobox. Type a name or occurrence ID, choose a result, then confirm removal. Options show the scheduled day, whether the entry is temporary or recurring, and its occurrence ID. Arrow keys and Enter select a result; Escape closes the result list. Only that occurrence in this week/section is hidden. Catalog products, inventory, sales, and recurring definitions are kept.

**Changes for this week** shows the latest 50 saved planning events; the full event list remains in the shared document. Events record action, calendar week, occurrence, time, and the name entered in the app. In public testing mode names are self-reported, not verified identities.

## Inventory imports

On Inventory, choose **Import inventory from Excel**. Enter the responsible employee/manager's name and upload an XLSX or CSV file. Use Product and Quantity, or supported variations such as Product Name/Item and Units/Count. Download [the XLSX sample](../samples/inventory-count-template.xlsx) or [CSV sample](../samples/inventory-count-template.csv).

Each quantity is a physical count. A system quantity of 100 and uploaded count of 250 creates a +150 count adjustment. It does not add 250. A lower count creates a negative adjustment; zero is valid. Unchanged counts create no adjustment. Products omitted from the file are unchanged.

The preview shows product, current count, uploaded count, adjustment, and validation issues. Duplicate rows, ambiguous/unknown active products, missing columns, negative/non-finite/fractional counts, and blank counts are rejected. Fix all rejected rows and upload again; partial imports are not allowed. Products are never created by this importer.

Confirmation submits the entire batch in one version-checked database operation. The UI reports success only after the database acknowledges it. Each adjustment appends a count transaction containing the responsible name, timestamp, file/import reference, and uploaded physical count. Existing transactions are preserved. Repeating the same physical counts creates zero further adjustments.

If inventory or the catalog changed after preview, upload again. If another device saved first, the database rejects the stale version instead of silently overwriting data. On a network failure, keep the error message, reload current shared data, and preview again. A connection can fail after the database commits; rechecking current physical totals prevents counting the same upload twice.

## Access and storage

The requested default remains **shared testing without sign-in**, selected in `app-config.js`. Anyone able to access the testing site/API can view and edit the public testing copy. Backend-enforced individual management permissions do not exist in this mode. Do not use it for confidential production data.

Staff sign-in remains implemented and tested as an optional mode. Complete the existing staff setup in README, provision users and `erp_members`, then set `accessMode:'staff'` in `app-config.js`. `connection.js` loads `cloud.js` instead of `preview.js`. Employees can use Move and Cycle count; schedule and bulk inventory handlers require management, and `erp_save` rejects employee changes outside append-only inventory transactions. Do not merely hide buttons to secure a public testing copy.

No new database migration is required for this release. Per-week records live in `weeklyPlans`, and the audit trail lives in `auditLog`, inside the existing Supabase JSON document. Saving uses the existing locked version check. Public testing audit labels are not verified or tamper-proof; stronger production audit retention should be configured before operational use.

## Backup and rollback

The previous stable code is preserved at commit `ea57134cea25025f9f82aaadb387566d2d9ccdd1` on branch `backup/stable-before-weekly-inventory-2026-11-19`. GitHub's Code → Download ZIP downloads that complete version. Restore through a new commit or pull request if needed; do not reset shared inventory or copy sample data over an initialized database. Reverting code does not revert the database. Older code retains unfamiliar JSON fields but does not display these new planning features.

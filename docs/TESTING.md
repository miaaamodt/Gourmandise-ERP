# Browser and data-integrity testing

Tested November 19, 2026 against the stable GitHub baseline `ea57134cea25025f9f82aaadb387566d2d9ccdd1`, with additive feature code. Browser engine: Chromium 156.0.8078.79, controlled by Playwright. Database permission tests use PostgreSQL in PGlite. Browser Supabase requests use an isolated versioned mock; no test writes were sent to the live bakery database.

## Completed and tested

| Area | Evidence |
| --- | --- |
| Drag and drop | Actual Chromium drag from Monday to Wednesday; original units and batches retained; saved assignment survives reload. |
| Calendar weeks | Previous/Next/Current controls; selected date normalizes to local Monday; future recurring days unchanged; return to edited week retains the move. Denver and Auckland timezones, including DST boundary dates, checked. |
| Undo/reset | Last move reverses; day-only reset retains quantity overrides, temporary entries, and removed entries. Native confirmation is required. |
| Temporary items | Add a catalog product twice with distinct IDs, add a custom task, and add items in all four categories. Recurring schedule, inventory transactions, and sales are unchanged by planning actions. |
| Removal | One searchable dropdown; required valid selection; keyboard ArrowDown/Enter; duplicate occurrence IDs distinguish repeated products; removing recurring/temporary occurrences affects only the target week and section. |
| Mobile | 390-pixel viewport, touch mode, dark system preference; day dropdown works; light-blue card contrast retained; no horizontal page overflow. |
| CSV counts | Higher, lower, zero, unchanged, and omitted-product cases; correct deltas; responsible name/date/import reference; historical transaction prefix retained. |
| Validation | Negative, blank, fractional and NaN counts; duplicate rows; unknown products; missing headers. Invalid files make no save request. |
| XLSX stress | A compressed XLSX workbook with 120 catalog products; full preview; atomic save; counts persist after refresh. Delayed older polling snapshots are ignored. |
| Repeat/cancel | Repeating the same physical count does not append another adjustment; cancelling a preview leaves shared data and version unchanged. |
| Failure/concurrency | Server failure and stale-version rejection leave the entire inventory import unapplied in the UI and shared mock. Error/recovery controls appear. |
| Existing workflows | Navigation, inventory movement, cycle counts, product CSV import, sales CSV upload, and forecast XLSX download execute successfully. Existing recurring catalog additions are preserved. Forecast source formulas were not changed. |
| Optional staff mode | Management and employee email/password flows exercised against mock authentication; employee navigation excludes Weekly plan; direct import-handler invocation is denied. |
| Database authorization | Actual PostgreSQL permission tests reject anonymous access to staff data, self-assigned membership, employee catalog/weekly-plan/audit edits, historical transaction edits, and direct table writes. Version conflicts, server actor stamping, and revocation are checked. |
| Shared-testing database | Anonymous public-testing read/save, input validation, direct-write restrictions, and version-conflict rejection checked in PostgreSQL. |
| Sample workbook | App-generated downloadable XLSX has valid ZIP/XML and workbook relationships; CSV equivalent included. |
| Runtime errors | No unexpected JavaScript errors or unexpected Supabase request routes in the feature browser suite. Deliberate failure cases are handled visibly. |

Run `npm install`, install Chromium through Playwright or set `CHROMIUM_PATH`, then run `npm test`. Node.js 22+ and Python 3 are required; Python's standard library generates the compressed XLSX test fixture. No additional Python packages are needed. The original `test-browser.cjs` entry point delegates to `test-features.cjs`.

## Known limits and remaining validation

- The live site intentionally remains public testing without individual sign-in. Display names and the document's audit trail are self-reported/editable. Staff-only backend permission tests apply to optional staff mode, not to public testing.
- Browser tests use isolated API mocks, while SQL tests execute the actual migrations. They do not prove a live end-to-end inventory write. Deployment smoke checks fetch public assets and read the configured Supabase row without modifying it. A company acceptance test should use agreed test records before operational use.
- Mobile testing uses Chromium emulation. Physical iOS Safari, Android browsers, assistive technology, and company devices still need acceptance checks.
- Imports read the first XLSX worksheet or comma-delimited CSV. Physical inventory counts are whole units. Files are limited to 10 MB and 10,000 nonblank inventory rows; the stress suite covers 120 rows, not 10,000.
- Shared storage remains one JSON document with optimistic version checks. Concurrent edits are rejected and require reload/manual reapplication; they are not merged automatically. This is deliberate protection against silent overwrites, with a downloadable recovery copy.
- Reset restores day assignments, not removed occurrences. Undo applies to moves only. Temporary entries are not promoted to the recurring schedule.
- Week categories remain explicit tabs. The app does not infer a Week 1/Week 2 rotation from calendar dates because no anchor date was supplied.

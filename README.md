# Gourmandise ERP

## Temporary demonstration login

The live presentation uses `accessMode:'demo'`. See [demo credentials and limitations](docs/DEMO-LOGIN.md). This is a browser presentation gate, not secure authentication; shared testing storage remains public. No Supabase setup is required for the demonstration. The prepared real staff-login change is saved separately on `prepared-staff-login-2026-11-20` for later activation.


## Weekly planning and inventory update — November 19, 2026

The current release adds calendar-week scheduling, drag/drop and mobile day moves, move undo, day-only reset, temporary production items, searchable occurrence removal, and atomic XLSX/CSV inventory physical-count imports. It preserves the existing ERP, blue mobile palette, catalog, inventory history, sales and forecast calculations.

Read [the user guide and backup instructions](docs/WEEKLY-PLAN-AND-INVENTORY.md), [the browser testing report and limitations](docs/TESTING.md), or download the [inventory XLSX sample](samples/inventory-count-template.xlsx) and [CSV sample](samples/inventory-count-template.csv).

No additional SQL setup is needed. The live default remains shared testing without sign-in, as requested. `app-config.js` now selects `testing` or `staff`, and `connection.js` loads the matching storage adapter. Staff setup remains described below; staff permissions are enforced by the existing database function when staff mode is enabled. The code and sample data are not a replacement for production access controls.


## Shared testing without sign-in

This branch opens the ERP directly, without approved-user accounts. Changes save to a public Supabase testing copy and other devices refresh about every 10 seconds while idle. Anyone who can access the site can view and edit this testing copy. Use testing data.

Before activating this branch, run `supabase/migrations/202611180002_shared_testing.sql` once in the Supabase SQL Editor. It creates an independent `erp_preview_state` table and version-checked `erp_preview_save` function. It leaves the staff-only tables, membership rules, and existing data unchanged. The publishable key is intentionally public.

On first opening, choose the sample catalog and records or explicitly share this browser’s earlier bakery data. After that, every browser loads the same copy without a login. Existing `bakery5` browser storage is preserved. Personal product selection and typed display name stay per device. A banner confirms online saves. Conflicting or failed saves block further editing and offer a downloadable unsaved backup; reload and manually reapply those edits rather than silently overwriting someone else.

`preview.js` handles shared testing; `cloud.js` remains available as the staff-sign-in reference. To enable staff accounts later, finish the staff setup below and change `accessMode` to `'staff'` in `app-config.js`. Private production data should use the staff-only tables. Public test data is not automatically copied into them.

Validation: `npm test` runs the original staff database permissions tests, the public testing database permissions/version tests, and a two-device browser test for no-login loading, shared saving, refresh, and conflict recovery. The new browser test replaces the original login-flow browser test; that earlier test is available in the login integration commit. The public testing schema still needs to be applied and verified against the real project.

## Staff-sign-in setup reference (paused during shared testing)

Static bakery ERP hosted with GitHub Pages. `cloud.js` connects `index.html` to Supabase email/password authentication and shared storage. The publishable key in `cloud.js` is intentionally public. Never add a Supabase secret key, service-role key, database password, or staff passwords to this repository.

## One-time setup before deploying this branch

1. Open your Supabase project (`tzrumhqtimdrytqqhclc`). Open **SQL Editor → New query**. Copy the complete contents of [the database migration](supabase/migrations/202611180001_bakery_cloud.sql) and click **Run**. Run this migration once. It creates two new tables and a save function; it does not import or replace bakery data.
2. Open **Authentication → Users → Add user → Create new user**. Create your own management account with your email and a new password. Enable **Auto confirm user** if offered. Keep the password private.
3. In **SQL Editor → New query**, run the following, replacing the email address with the exact email you used above:

   ```sql
   do $$
   declare staff_id uuid;
   begin
     select id into staff_id from auth.users
       where lower(email) = lower('YOUR_EMAIL_HERE');
     if staff_id is null then
       raise exception 'Create the user in Authentication → Users first';
     end if;
     insert into public.erp_members (user_id, role)
       values (staff_id, 'management')
       on conflict (user_id) do update set role = excluded.role;
   end $$;
   ```

4. Under **Authentication → Sign In / Providers**, disable **Allow new users to sign up**. Only administrator-created accounts should be used for this internal app. Database access is still restricted to explicitly listed staff if this setting is left enabled.
5. Set **Authentication → URL Configuration → Site URL** to `https://miaaamodt.github.io/Gourmandise-ERP/`. If you later use email confirmation or recovery, configure its allowed redirect URLs there too. The current app uses direct email/password sign-in; password resets are handled by your Supabase administrator.
6. Deploy this branch by merging its pull request into `main`. GitHub Pages must publish `main` at `/ (root)`. Until then, the live website continues to run the previous browser-only version and its old login.
7. Open the website and sign in with your new management account. On first sign-in choose either the starter catalog **with sample records**, or **Import this browser’s existing bakery data**. Import from the same browser and website origin where your current inventory was entered. Data stored by a downloaded HTML file or on another device is not automatically available here. Nothing is silently merged. Existing `bakery5` browser storage remains untouched as a backup.
8. Verify inventory and saved changes in a second browser signed in with an approved staff account before relying on the shared copy. This initial integration stores the ERP as one versioned JSON document. Large datasets or frequent simultaneous edits will eventually benefit from separate database tables per entity.

## Add employees

Create each employee under **Authentication → Users**, then repeat the SQL above with their email and change `'management'` to `'employee'`. Employees can view the shared bakery data and append inventory additions, removals, and cycle-count adjustments. Product, forecast, sales, schedule, order, and historical transaction edits are restricted to management by the database. Typed employee names are display labels; employee transactions also receive the signed-in account ID and server timestamp.

To revoke access, remove the staff member's row from `erp_members` in Supabase. Their next database request will be denied. Never allow staff to edit their own membership or role.

## Saving and conflicts

The banner reports pending changes, online saves, and errors. Changes save after a short delay. Shared data refreshes every 15 seconds when the app is idle. Keep the tab open until the banner confirms the save. Authentication sessions last in the current browser tab and refresh automatically.

Every save checks a database version under a row lock. If another device saved first, the app blocks further edits and offers **Download unsaved copy** and **Reload shared data**. Download the backup, reload, and manually reapply the intended edits. JSON backups are for recovery and review; automatic backup import/merge is not included. No failed or conflicting save is automatically retried against newer data. Check the banner even if an existing form says a change was booked.

## Validation

The database migration was tested using PostgreSQL in PGlite, including anonymous access denial, membership restrictions, management initialization, employee append-only rules, actor stamping, invalid input, concurrent version rejection, and staff revocation. Browser tests mock Supabase and cover sign-in, first-time setup, online saves, browser-data preservation, role-specific navigation, and conflict handling. These tests do not replace an end-to-end check against the configured Supabase project after setup.

To run locally with Node.js 22 or later: `npm install`, `npx playwright install chromium`, then `npm test`. If system Chromium is installed, the browser test uses it; alternatively set `CHROMIUM_PATH`.


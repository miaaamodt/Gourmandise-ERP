# Gourmandise ERP

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

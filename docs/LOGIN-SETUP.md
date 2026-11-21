# Activate management and employee access

Complete the Supabase steps before publishing this branch to GitHub Pages. This site expects the existing staff tables and moves current shared testing data into staff-only storage before public access is closed.

## 1. Provision the management account

In Supabase **Authentication → Users**, create or confirm the management user at `mikalya@gourmandise.com`. Use the management password privately in Supabase; it is not stored in the site or repository. The site displays the public username configured in `app-config.js` and maps it to this email. The configured username/email are routing identifiers; the password remains only in Supabase Auth.

## 2. Preserve the current bakery data and close public access

If the staff tables do not exist yet, apply `supabase/migrations/202611180001_bakery_cloud.sql` and `supabase/migrations/202611180002_shared_testing.sql` once. Do not rerun table-creation migrations that have already been applied.

Open **SQL Editor → New query** and run `supabase/manual/enable-staff-access.sql`. It verifies the manager account, copies the initialized shared testing data to staff storage without overwriting different staff data, and closes public read/write access to the old testing table and save function. The script is safe to review before running and stops if its required data is missing.

## 3. Add anonymous employee access

Run `supabase/migrations/202611210001_anonymous_employee_access.sql` once. It assigns the employee role to anonymous Supabase accounts. It does not grant the public `anon` database role access to bakery data.

In Supabase **Authentication → Sign-In / Providers**, enable **Allow anonymous sign-ins**. The employee button creates an anonymous account; Supabase sessions are browser-specific and cannot be recovered after signing out or clearing browser data. Consider enabling CAPTCHA or Turnstile to reduce automated anonymous account creation.

Keep email/password signups restricted to administrator-provisioned users if desired. The employee anonymous-sign-in setting is separate. Do not add the manager password or a Supabase secret key to GitHub.

## 4. Publish and verify

Merge the reviewed branch into `main` after the Supabase steps above. GitHub Pages must publish the repository root. Then verify that the management username reaches the management role and that **Continue as employee** exposes only **Move** and **Cycle Count**. The database additionally rejects employee changes to products, forecasts, schedules, sales, and historical transactions.

If the manager email changes later, update `app-config.js`, create/confirm the new Supabase account, and move the `management` membership to that account in `erp_members`. Do not leave the old account with management access.

The old public testing copy remains in Supabase only as a restricted backup after the cutover. Previously opened testing tabs may still hold stale content; reload them after the cutover.

# Restore staff sign-in

Before deploying this branch, run `supabase/manual/enable-staff-access.sql` in a new, blank Supabase SQL Editor query. Replace the single quoted `MANAGER_EMAIL_HERE` value with the existing Authentication user's email. Do not rerun the original table-creation migrations.

The query runs as one transaction. It verifies that the user exists, copies the initialized shared testing JSON into empty staff storage, grants that user management access, and closes public read and write access to the old testing table/function. Existing weekly plans, quantities, temporary entries, inventory transactions, sales, and audit records are preserved. The old copy stays in the database as a restricted backup. If staff storage already has different data, the query stops instead of overwriting it.

After the query succeeds, deploy the branch's `app-config.js` with `accessMode:'staff'`. The existing email/password sign-in screen and staff storage adapter then load. Sign in with the approved Supabase Authentication email/password. No password or management email is committed to GitHub.

New accounts still need to be provisioned in Supabase Authentication and explicitly added to `erp_members`. Employees have Move and Cycle count access; management has planning and inventory-import access. Disable open signup in Authentication settings if it is still enabled.

This protects current shared Supabase records. It does not make the public GitHub repository, website source, or embedded starter/sample catalog private. Information already downloaded to an open testing tab cannot be recalled; refresh those tabs after cutover.

The SQL cutover was tested in PostgreSQL/PGlite for exact data preservation, rejected missing users, closure of both public read and write paths, management-only access, and refusal to overwrite different existing staff data. The existing application release separately tests management/employee login in Chromium against mocked authentication. A real account sign-in check is still required after the administrator applies the query.

# Gourmandise ERP

## Access

The site uses Supabase authentication and the staff-only bakery database.

- **Management:** enter the configured username and password. The username is a public sign-in label; Supabase verifies the password for the management account and the database checks its role. The password is never stored in this repository.
- **Employee:** choose **Continue as employee**. Supabase creates an anonymous account with the employee role. Employees can use only **Move** and **Cycle Count**. Database rules also limit employee saves to inventory transactions.
- The manager email and username are in `app-config.js`. Update both the app configuration and Supabase membership when changing the management account.

## Supabase setup before publishing

See [the login setup guide](docs/LOGIN-SETUP.md). It describes how to provision the manager account, preserve and close the public testing copy, and enable the employee sign-in.

The employee button requires the migration [202611210001_anonymous_employee_access.sql](supabase/migrations/202611210001_anonymous_employee_access.sql) and **Authentication → Sign-In / Providers → Allow anonymous sign-ins** enabled. Supabase recommends CAPTCHA or Turnstile to reduce anonymous-account abuse on public sites.

Do not add a Supabase secret/service-role key or password to the repository. The publishable Supabase key in `cloud.js` is intended to be public; access is enforced through the database membership table and SQL permissions.

## Features

The ERP includes product and inventory management, inventory moves and cycle counts, sales and forecasting, weekly production planning, and an activity log. See [the weekly plan and inventory guide](docs/WEEKLY-PLAN-AND-INVENTORY.md). Testing and known limitations are documented in [docs/TESTING.md](docs/TESTING.md).

Run the project checks with `npm test`.

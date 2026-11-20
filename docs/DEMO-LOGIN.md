# Temporary presentation login

The current `app-config.js` selects `accessMode:'demo'`. It displays a demonstration login before loading the shared-testing interface. No Supabase setup query or real staff account is needed.

- Demonstration email: `demo@gourmandise.test`
- Demonstration password: `bakery-demo`

These credentials are intentionally public and are stored in browser-delivered code. Do not use a real password. The screen is a presentation gate, not authentication or access control. Supabase's testing data remains publicly readable/editable through the existing testing API, just as before. The page labels this limitation explicitly.

A successful demo sign-in opens the existing management interface, including weekly planning and inventory imports. Existing shared records and storage behavior are retained. Refreshing the same tab remembers the demo session. Sign out returns to the demonstration login; it waits for pending saves rather than discarding unsaved changes. The browser stores only a demo-session flag, not the password.

Real staff authentication is prepared separately on branch `prepared-staff-login-2026-11-20`. That branch includes the data-preserving Supabase cutover query, public-testing access revocation, and staff-mode configuration. It has not been applied or activated. When ready, complete that database step before switching to `accessMode:'staff'`.

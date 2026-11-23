# Production planning and access update — November 23, 2026

## Management and employees

Open the existing website. Management uses the username supplied by the owner and its password. **Continue as employee** opens only Move and Cycle count, without credentials. Sign out before switching roles. The interface remembers the role in that browser tab until sign-out or the tab session ends.

This requested login is an **interface gate only**. Password verification happens in the browser against a salted PBKDF2 hash. It is not Supabase Authentication, and people can bypass browser restrictions. The existing shared-testing database remains publicly accessible with its published key. Do not treat this release as secure staff authorization or store sensitive information behind this form. No SQL or database access policies were created or changed for this release. Real staff security still requires a separate Supabase authentication and database-policy cutover.

## Monthly sales and production

1. Open **Sales & Forecast** and choose the sales month.
2. Enter or upload sales using the existing product-name/quantity spreadsheet format. Save manually entered sales. Uploads save automatically.
3. Each product defaults to a **Production adjustment of 1.5**. Change this number to increase or decrease that product's target. It saves to the shared records.
4. The adjusted target is sales × adjustment. Production need subtracts Main Fridge inventory once and stops at zero. Example: 100 × 1.5 − 25 = **125**.
5. When production is needed, products listed with a batch count in the supplied production-yield PDF round up to their minimum run and then whole additional batches. Use **+ / −** or enter a batch count. The listed minimum cannot be lowered. If inventory covers the target, production is always **0**, including when a manual batch quantity was previously saved.
6. **Use calculated** removes a manual batch choice for that forecast month. Each product's multiplier persists across months; manual monthly batch quantities belong to the forecast month.
7. **Download Excel forecast** includes sales, adjustment, adjusted target, inventory, net need, planned batches, minimum batches, production quantity, and measure.

A manual batch choice may be below the calculated recommendation but cannot go below the PDF minimum. Review the needed quantity alongside the chosen production quantity.

The previous growth, safety-stock, and catering values remain in existing records but are not added to this formula. Blank sales mean no forecast, while explicitly entered zero sales mean a zero sales target. Whole-piece net requirements round up. Whole-piece batch outputs round only after calculating the exact yield ratio: 1,400 at six batches gives 1,633 at seven and 2,800 at twelve.

## Weekly plan

Existing recurring product names now resolve through the existing catalog aliases where needed. Defaults divide the monthly net requirement across recurring monthly production runs. Each positive run then respects its PDF batch minimum, so a weekly schedule can produce more than the monthly net requirement. Existing saved weekly quantities remain separate from monthly batch choices. Use the weekly batch controls to adjust individual occurrences. These adjustments save for that selected week. Existing moves, custom tasks, additions, removals, inventory, and sales history are retained.

## Yield reference and setup

`production-rules.js` records the PDF batch counts, output, measures, and product-name aliases. Every stated count is a minimum, including 1, 2, 3, 4, 6, 9, and 1.5. Products absent from that reference keep the calculated net quantity without an invented floor.

Owner-confirmed interpretations:

- Regular salted pecan cookie: **1,300 at six batches**.
- Peach/raspberry/blueberry thumbprints: **550 at six batches**; the separate 600 note is not used.
- Brownies and almond cake: **35 pieces per sheet**, so 18 sheets = **630 pieces**. Brownies have a three-batch minimum and almond cake nine.
- Fillings, glazes, and puddings retain the listed buckets, gallons, or trays. Sales and inventory must be entered in that same measure. Existing stock numbers are not converted automatically.

Some PDF rows specify a batch count but no output: caramel filling, lemon filling, and lemon/raspberry/orange icing. Where a matching product exists, use **Batch details / Set batch yield** to enter the full output at the stated minimum run. The app does not guess these yields. This changes the output, never the batch minimum. PDF rows without any batch count receive no invented rule. Reference rows without an existing catalog product are not automatically added as new products.

## Files and maintenance

- `index.html`: main interface and existing catalog/import tools.
- `app-config.js`, `access.js`: requested interface access configuration and login.
- `connection.js`, `preview.js`: existing shared data connection and versioned saves.
- `features.js`, `features.css`: weekly planner and physical-count imports.
- `production-math.js`: shared arithmetic.
- `production-rules.js`: PDF yields and product aliases.
- `production.js`: forecast table, batch controls, weekly integration, and Excel export.

Shared adjustments live in the existing Supabase JSON record: `items[].productionAdjustment`, `items[].productionMinimumOutput`, and `productionPlanOverrides[forecastMonth][productId]`. Save conflicts reject the new change and require reload; they do not silently overwrite another device. Weekly quantities remain in `weeklyPlans`.

The backup branch `backup/before-initial-launch-2026-11-23` preserves the previous website code. Reverting website code does not restore or erase database records. Download a data backup before bulk operational changes.

## Verification

Run `npm test`. Browser tests use a mocked, versioned Supabase endpoint and do not alter live records. They cover management/employee entry, the requested formula, saved adjustments across devices, batch floors/increments, zero-production behavior, weekly changes, imports, Excel export, mobile colors, and save failures/conflicts. The retired `test-demo.cjs` belongs to the earlier demo release and is not part of the current suite.

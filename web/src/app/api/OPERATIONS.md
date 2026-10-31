# Local operations API contract

These endpoints are local-development groundwork. They have **no authentication, role checks or customer isolation**. Do not deploy or expose them on a network. An origin check is not authentication.

Each list endpoint returns `{items,total,page,pageSize}` with 20 items per page; use `?page=1` through `?page=10000`.

## Customers

- `GET /api/customers`: paginated customers.
- `POST /api/customers`: `{ "name": "Example", "email": "person@example.invalid" }`. Returns 201 `{customer}`; email is trimmed, lowercased and unique. Invalid input returns 400; duplicate email returns 409. This creates a customer record, not a sign-up account.

## Plans

- `GET /api/plans`: paginated plans.
- `POST /api/plans`: `{ "name": "Monthly", "priceMinor": 50000, "billingInterval": "MONTHLY", "minimumQuantity": 1, "availableFrom": "2026-10-31", "availableUntil": null, "automaticClosing": false, "allowEarlyClosing": false, "allowPausing": false, "allowRenewal": true }`. Returns 201 `{plan}`. Intervals: DAILY, WEEKLY, MONTHLY, YEARLY. Dates are optional date-only `YYYY-MM-DD`; missing policy flags default to false. Plan rules beyond start-date availability, minimum total quantity and early closing are not implemented.

## Subscriptions

- `GET /api/subscriptions`: paginated subscriptions with customer, plan and product lines. Product data in a line is limited to ID, name and type.
- `POST /api/subscriptions`: `{ "customerId": "...", "planId": "...", "startsAt": "2026-10-31", "expiresAt": null, "paymentTermDays": 30, "lines": [{ "productId": "...", "quantity": 1, "unitPriceMinor": 50000, "taxBasisPoints": 1800 }] }`. Returns 201 `{subscription}` with an automatically generated unique number and DRAFT status. Every ID must exist, the start date must be inside the plan's availability, and summed quantity must meet its minimum. At least one line is required; all amounts are integer INR paise. Line prices are supplied snapshots; the API does not automatically attach the plan price.
- `PATCH /api/subscriptions/{id}/status`: `{ "status": "QUOTATION" }`, then `CONFIRMED`, `ACTIVE`, `CLOSED`. Invalid or repeated transitions return 409. Activation sets `nextBillingAt` to the start date; closing clears it. Early closing is rejected unless the plan permits it, or the expiry date has arrived. This check uses the UTC calendar date. There is no separate quotation or approval record in this increment.

Invalid input returns 400, cross-origin browser writes return 403, and a missing subscription returns 404. Do not present these endpoints as customer-safe. No subscription editing, quotation templates, product variants, discount rules, authorization or billing is implemented here. Work with Afsal on invoice/billing endpoints and Dharvesh on UI integration.

## Local verification

Run the integration test only against your local migrated development database; it creates uniquely named records and deletes only those records afterward:

```bash
npm run db:generate
npm run db:deploy
npm run build
npm run start -- --hostname 127.0.0.1 --port 3002
# In another terminal inside web:
node --env-file=.env --test tests/operations.integration.test.mjs
```

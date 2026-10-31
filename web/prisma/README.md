# Subscription and billing schema contract

This migration is database groundwork. It does not implement APIs, authentication, state transitions, invoice scheduling, invoice delivery or payments.

- Money is INR paise, stored as PostgreSQL `INTEGER`; every value and calculated total must fit that type. APIs must validate inputs and handle overflow before writing.
- `Customer.email` must be trimmed and lowercased by the API. The database enforces that form and uniqueness, but not complete email syntax. Customer is not a login account.
- Plans store a price, interval, minimum quantity, optional inclusive date-only availability range and policy flags. Enforcement of those policies is application work.
- Subscription dates are date-only. A subscription has a unique number, customer, plan, status, payment term in days, optional expiry and next billing date, and product lines. Subscription line unit prices and tax basis points are snapshots. Status transitions are not enforced by this schema.
- Invoice periods use date-only boundaries: `periodStart` is inclusive and `periodEnd` is exclusive. `@@unique([subscriptionId, periodStart])` rejects a second invoice for the same subscription and period start, even if the first is cancelled. Agree cancellation/reissue behavior before implementing it.
- Afsal's billing service must serialize or lock each subscription when advancing `nextBillingAt`, insert each due period and update the cursor in the same transaction. It must calculate each missed period, not advance past one without an invoice; handle retries and unique conflicts explicitly. The unique key alone does not prevent overlapping periods, missing periods or prove concurrent correctness. Period calculation and concurrency need tests.
- Invoice totals must satisfy `subtotalMinor - discountMinor + taxMinor = totalMinor`. Invoice lines store a product-name and price snapshot. Agree line amount and discount allocation semantics before implementation; mixed-rate discount allocation is not implemented here. The billing service must verify the invoice customer matches the subscription customer.
- Payments are positive integer paise and belong to an invoice. Calculate balances from saved payments. Lock the invoice or otherwise serialize competing payment writes to prevent overpayment. Partial and overdue are derived display states; no database check alone enforces invoice transitions or payment totals.
- Database checks reject basic negative, invalid date and percentage values; APIs still need full validation, authorization and clear errors. Dates are `DATE` fields; use a consistent calendar-date policy in all integrations.
- The database uses restrictive foreign keys to avoid silently deleting billing history. Product variants, quotation templates, discount eligibility/redemption and account/role models are not included yet.

The product API currently has no authentication and exposes cost prices. Keep the app on localhost with development data until server-side access controls exist.

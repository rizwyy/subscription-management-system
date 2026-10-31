// Requires a running local server and migrated disposable development database.
// Run: node --env-file=.env --test tests/operations.integration.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3002";
const db = new PrismaClient();
const ids = { customer: null, plan: null, product: null, subscription: null };
const marker = randomUUID();
async function request(path, method = "GET", data, extraHeaders = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(data !== undefined ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

test("customer, plan and subscription workflow, validation and transitions", async () => {
  try {
    let r = await request("/api/customers", "POST", { name: "Test", email: "invalid" });
    assert.equal(r.status, 400);
    r = await request("/api/customers", "POST", { name: "Test", email: `Test-${marker}@example.invalid` });
    assert.equal(r.status, 201); ids.customer = r.body.customer.id;
    assert.equal(r.body.customer.email, `test-${marker}@example.invalid`);
    r = await request("/api/customers", "POST", { name: "Test", email: `TEST-${marker}@example.invalid` });
    assert.equal(r.status, 409);
    assert.equal((await request("/api/customers?page=0")).status, 400);
    assert.ok((await request("/api/customers")).body.items.some(item => item.id === ids.customer));

    const plan = { name: `Test ${marker}`, priceMinor: 50000, billingInterval: "MONTHLY", minimumQuantity: 2, allowEarlyClosing: true };
    assert.equal((await request("/api/plans", "POST", { ...plan, availableFrom: "2026-02-30" })).status, 400);
    assert.equal((await request("/api/plans", "POST", { ...plan, availableFrom: "2026-12-01", availableUntil: "2026-01-01" })).status, 400);
    r = await request("/api/plans", "POST", plan);
    assert.equal(r.status, 201); ids.plan = r.body.plan.id;
    assert.ok((await request("/api/plans")).body.items.some(item => item.id === ids.plan));

    r = await request("/api/products", "POST", { name: `Test ${marker}`, type: "SOFTWARE", salesPriceMinor: 50000, costPriceMinor: 10000 });
    assert.equal(r.status, 201); ids.product = r.body.product.id;
    const sub = { customerId: ids.customer, planId: ids.plan, startsAt: "2026-10-31", paymentTermDays: 30, lines: [{ productId: ids.product, quantity: 2, unitPriceMinor: 50000, taxBasisPoints: 1800 }] };
    assert.equal((await request("/api/subscriptions", "POST", { ...sub, lines: [{ ...sub.lines[0], quantity: 1 }] })).status, 400);
    assert.equal((await request("/api/subscriptions", "POST", { ...sub, startsAt: "2026-02-30" })).status, 400);
    assert.equal((await request("/api/subscriptions", "POST", sub, { Origin: "https://untrusted.example" })).status, 403);
    r = await request("/api/subscriptions", "POST", sub);
    assert.equal(r.status, 201); ids.subscription = r.body.subscription.id;
    assert.equal(r.body.subscription.status, "DRAFT");
    const statusPath = `/api/subscriptions/${ids.subscription}/status`;
    assert.equal((await request(statusPath, "PATCH", { status: "ACTIVE" })).status, 409);
    const concurrent = await Promise.all([request(statusPath, "PATCH", { status: "QUOTATION" }), request(statusPath, "PATCH", { status: "QUOTATION" })]);
    assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409]);
    for (const status of ["CONFIRMED", "ACTIVE"]) {
      r = await request(statusPath, "PATCH", { status });
      assert.equal(r.status, 200); assert.equal(r.body.subscription.status, status);
    }
    assert.equal(r.body.subscription.nextBillingAt.slice(0, 10), "2026-10-31");
    assert.equal((await request(statusPath, "PATCH", { status: "ACTIVE" })).status, 409);
    const listed = await request("/api/subscriptions");
    assert.equal(listed.status, 200);
    assert.ok(listed.body.items.some(item => item.id === ids.subscription));
    r = await request(statusPath, "PATCH", { status: "CLOSED" });
    assert.equal(r.status, 200); assert.equal(r.body.subscription.nextBillingAt, null);
  } finally {
    // Delete only records created in this run, in foreign-key order.
    if (ids.subscription) {
      await db.subscriptionLine.deleteMany({ where: { subscriptionId: ids.subscription } });
      await db.subscription.deleteMany({ where: { id: ids.subscription } });
    }
    if (ids.product) await db.product.deleteMany({ where: { id: ids.product } });
    if (ids.plan) await db.plan.deleteMany({ where: { id: ids.plan } });
    if (ids.customer) await db.customer.deleteMany({ where: { id: ids.customer } });
    await db.$disconnect();
  }
});

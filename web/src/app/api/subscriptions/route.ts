import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { body, date, failure, InputError, integer, object, optionalDate, pageNumber, text } from "@/lib/operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const page = pageNumber(request);
    const [items, total] = await prisma.$transaction([
      prisma.subscription.findMany({ include: { customer: true, plan: true, lines: { include: { product: { select: { id: true, name: true, type: true } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
      prisma.subscription.count(),
    ], { isolationLevel: "RepeatableRead" });
    return Response.json({ items, total, page, pageSize: 20 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const value = await body(request);
    const customerId = text(value.customerId, "Customer ID", 100);
    const planId = text(value.planId, "Plan ID", 100);
    const startsAt = date(value.startsAt, "Start date");
    const expiresAt = optionalDate(value.expiresAt, "Expiry date");
    if (expiresAt && expiresAt < startsAt) throw new InputError("Expiry date cannot precede start date.");
    const paymentTermDays = integer(value.paymentTermDays ?? 0, "Payment terms", 0, 3650);
    if (!Array.isArray(value.lines) || value.lines.length < 1 || value.lines.length > 100) throw new InputError("Add between 1 and 100 product lines.");
    const lines = value.lines.map((raw: unknown) => {
      const line = object(raw);
      return { productId: text(line.productId, "Product ID", 100), quantity: integer(line.quantity, "Quantity", 1, 1_000_000), unitPriceMinor: integer(line.unitPriceMinor, "Unit price", 0, 2_000_000_000), taxBasisPoints: integer(line.taxBasisPoints ?? 0, "Tax", 0, 10000) };
    });
    // Every invoice amount must fit the database's signed 32-bit money columns.
    const maximumTotal = lines.reduce((sum, line) => {
      const subtotal = BigInt(line.quantity) * BigInt(line.unitPriceMinor);
      return sum + subtotal + (subtotal * BigInt(line.taxBasisPoints) + 5000n) / 10000n;
    }, 0n);
    if (maximumTotal > 2_147_483_647n) throw new InputError("Subscription total exceeds the supported limit.");
    const subscription = await prisma.$transaction(async (tx) => {
      const [customer, plan, products] = await Promise.all([
        tx.customer.findUnique({ where: { id: customerId }, select: { id: true } }),
        tx.plan.findUnique({ where: { id: planId } }),
        tx.product.findMany({ where: { id: { in: [...new Set(lines.map((line) => line.productId))] } }, select: { id: true } }),
      ]);
      if (!customer || !plan || products.length !== new Set(lines.map((line) => line.productId)).size) throw new InputError("Customer, plan or product not found.");
      if ((plan.availableFrom && startsAt < plan.availableFrom) || (plan.availableUntil && startsAt > plan.availableUntil)) throw new InputError("Plan is unavailable on the subscription start date.");
      if (lines.reduce((sum, line) => sum + line.quantity, 0) < plan.minimumQuantity) throw new InputError("Total quantity is below the plan minimum.");
      return tx.subscription.create({ data: { number: `SUB-${randomUUID()}`, customerId, planId, startsAt, expiresAt, paymentTermDays, lines: { create: lines } }, include: { customer: true, plan: true, lines: true } });
    });
    return Response.json({ subscription }, { status: 201 });
  } catch (error) { return failure(error); }
}

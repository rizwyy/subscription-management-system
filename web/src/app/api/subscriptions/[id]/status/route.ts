import { prisma } from "@/lib/prisma";
import { body, failure, InputError } from "@/lib/operations";
import { SubscriptionStatus } from "@prisma/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const next: Partial<Record<SubscriptionStatus, SubscriptionStatus>> = {
  DRAFT: "QUOTATION", QUOTATION: "CONFIRMED", CONFIRMED: "ACTIVE", ACTIVE: "CLOSED",
};
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const value = await body(request);
    const { id } = await context.params;
    if (typeof value.status !== "string" || !Object.values(SubscriptionStatus).includes(value.status as SubscriptionStatus)) throw new InputError("Invalid subscription status.");
    const requested = value.status as SubscriptionStatus;
    const current = await prisma.subscription.findUnique({ where: { id }, include: { plan: true, _count: { select: { lines: true } } } });
    if (!current) return Response.json({ error: "Subscription not found." }, { status: 404 });
    if (next[current.status] !== requested) return Response.json({ error: "That status transition is not allowed." }, { status: 409 });
    if (requested === "ACTIVE" && current._count.lines === 0) throw new InputError("An active subscription requires at least one line.");
    if (requested === "CLOSED" && !current.plan.allowEarlyClosing) {
      const today = new Date();
      const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      if (!current.expiresAt || current.expiresAt > day) return Response.json({ error: "This plan does not allow early closing." }, { status: 409 });
    }
    const result = await prisma.subscription.updateMany({ where: { id, status: current.status }, data: { status: requested, ...(requested === "ACTIVE" ? { nextBillingAt: current.startsAt } : {}), ...(requested === "CLOSED" ? { nextBillingAt: null } : {}) } });
    if (result.count !== 1) return Response.json({ error: "Subscription changed. Refresh and retry." }, { status: 409 });
    const subscription = await prisma.subscription.findUnique({ where: { id }, include: { customer: true, plan: true, lines: true } });
    return Response.json({ subscription });
  } catch (error) { return failure(error); }
}

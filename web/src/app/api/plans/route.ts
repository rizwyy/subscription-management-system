import { prisma } from "@/lib/prisma";
import { body, boolean, failure, InputError, integer, optionalDate, pageNumber, text } from "@/lib/operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const intervals = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

export async function GET(request: Request) {
  try {
    const page = pageNumber(request);
    const [items, total] = await prisma.$transaction([
      prisma.plan.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
      prisma.plan.count(),
    ], { isolationLevel: "RepeatableRead" });
    return Response.json({ items, total, page, pageSize: 20 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const value = await body(request);
    const billingInterval = value.billingInterval;
    if (typeof billingInterval !== "string" || !intervals.includes(billingInterval as typeof intervals[number])) throw new InputError("Select a valid billing interval.");
    const availableFrom = optionalDate(value.availableFrom, "Available from");
    const availableUntil = optionalDate(value.availableUntil, "Available until");
    if (availableFrom && availableUntil && availableFrom > availableUntil) throw new InputError("Availability end must follow start.");
    const plan = await prisma.plan.create({ data: {
      name: text(value.name, "Name"), priceMinor: integer(value.priceMinor, "Price", 0, 2_000_000_000),
      billingInterval: billingInterval as typeof intervals[number], minimumQuantity: integer(value.minimumQuantity ?? 1, "Minimum quantity", 1, 1_000_000),
      availableFrom, availableUntil, automaticClosing: boolean(value.automaticClosing, "Automatic closing"),
      allowEarlyClosing: boolean(value.allowEarlyClosing, "Early closing"), allowPausing: boolean(value.allowPausing, "Pausing"), allowRenewal: boolean(value.allowRenewal, "Renewal"),
    } });
    return Response.json({ plan }, { status: 201 });
  } catch (error) { return failure(error); }
}

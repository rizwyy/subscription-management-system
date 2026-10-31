import { prisma } from "@/lib/prisma";
import { body, failure, InputError, pageNumber, text } from "@/lib/operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local development only: authentication and customer isolation are not implemented.
export async function GET(request: Request) {
  try {
    const page = pageNumber(request);
    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
      prisma.customer.count(),
    ], { isolationLevel: "RepeatableRead" });
    return Response.json({ items, total, page, pageSize: 20 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const value = await body(request);
    const name = text(value.name, "Name");
    const email = text(value.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError("Enter a valid email address.");
    const customer = await prisma.customer.create({ data: { name, email } });
    return Response.json({ customer }, { status: 201 });
  } catch (error) { return failure(error); }
}

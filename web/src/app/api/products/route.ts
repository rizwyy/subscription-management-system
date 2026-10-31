import { prisma } from "@/lib/prisma";
import {
  PRODUCT_PAGE_SIZE,
  isAllowedOrigin,
  validateProduct,
  validateProductQuery,
} from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local internal development only. Riswin must add session/role enforcement
// before exposing this API; these internal responses include product costs.
export async function GET(request: Request) {
  const validation = validateProductQuery(new URL(request.url).searchParams);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }
  const { page, query } = validation.value;
  const where = query ? { name: { contains: query, mode: "insensitive" as const } } : {};
  try {
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PRODUCT_PAGE_SIZE,
        take: PRODUCT_PAGE_SIZE,
      }),
      prisma.product.count({ where }),
    ], { isolationLevel: "RepeatableRead" });
    return Response.json({ items, total, page, pageSize: PRODUCT_PAGE_SIZE }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Product listing failed", error);
    return Response.json({ error: "Products could not be loaded. Please try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  // An origin check is an extra browser protection, not authentication.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!isAllowedOrigin(origin, request.url, host)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON body." }, { status: 400 });
  }
  const validation = validateProduct(body);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }
  try {
    const product = await prisma.product.create({ data: validation.value });
    return Response.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed", error);
    return Response.json({ error: "Product could not be saved. Please try again." }, { status: 503 });
  }
}

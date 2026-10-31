export const PRODUCT_TYPES = ["SOFTWARE", "SERVICE", "ADDON"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const PRODUCT_PAGE_SIZE = 20;

export type ProductInput = {
  name: string;
  type: ProductType;
  salesPriceMinor: number;
  costPriceMinor: number;
  notes: string;
};

type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateProduct(input: unknown): Validation<ProductInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Enter valid product details." };
  }
  const value = input as Record<string, unknown>;
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 120) {
    return { ok: false, error: "Product name must contain 1 to 120 characters." };
  }
  if (!PRODUCT_TYPES.includes(value.type as ProductType)) {
    return { ok: false, error: "Select a valid product type." };
  }
  for (const field of ["salesPriceMinor", "costPriceMinor"] as const) {
    const price = value[field];
    if (typeof price !== "number" || !Number.isSafeInteger(price) || price < 0 || price > 2_000_000_000) {
      return { ok: false, error: "Prices must be non-negative whole paise, up to INR 20,000,000." };
    }
  }
  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 2000)) {
    return { ok: false, error: "Notes must contain at most 2,000 characters." };
  }
  return {
    ok: true,
    value: {
      name: value.name.trim(),
      type: value.type as ProductType,
      salesPriceMinor: value.salesPriceMinor as number,
      costPriceMinor: value.costPriceMinor as number,
      notes: typeof value.notes === "string" ? value.notes.trim() : "",
    },
  };
}

export function validateProductQuery(params: URLSearchParams): Validation<{ page: number; query: string }> {
  if (params.getAll("page").length > 1 || params.getAll("q").length > 1) {
    return { ok: false, error: "Provide page and search only once." };
  }
  const rawPage = params.get("page") ?? "1";
  const page = Number(rawPage);
  const query = (params.get("q") ?? "").trim();
  if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1 || page > 10000 || query.length > 120) {
    return { ok: false, error: "Enter a valid page and search term." };
  }
  return { ok: true, value: { page, query } };
}

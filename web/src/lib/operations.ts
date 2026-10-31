import { isAllowedOrigin } from "@/lib/products";

export class InputError extends Error {}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Expected a JSON object.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new InputError(`${label} must contain 1 to ${max} characters.`);
  return value.trim();
}
export function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new InputError(`${label} must be an integer between ${min} and ${max}.`);
  return value;
}
export function date(value: unknown, label: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InputError(`${label} must be YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new InputError(`${label} must be a real date.`);
  return parsed;
}
export function optionalDate(value: unknown, label: string): Date | null {
  return value === undefined || value === null || value === "" ? null : date(value, label);
}
export function boolean(value: unknown, label: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new InputError(`${label} must be true or false.`);
  return value;
}
export function checkOrigin(request: Request): void {
  if (!isAllowedOrigin(request.headers.get("origin"), request.url, request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) throw new InputError("Request origin is not allowed.");
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  checkOrigin(request);
  let value: unknown;
  try { value = await request.json(); } catch { throw new InputError("Send a valid JSON body."); }
  return object(value);
}
export function failure(error: unknown): Response {
  if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.message === "Request origin is not allowed." ? 403 : 400 });
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return Response.json({ error: "A record with this unique value already exists." }, { status: 409 });
  console.error("Operations API failed", error);
  return Response.json({ error: "Request could not be completed." }, { status: 503 });
}
export function pageNumber(request: Request): number {
  const raw = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^\d+$/.test(raw)) throw new InputError("Invalid page.");
  return integer(Number(raw), "Page", 1, 10000);
}

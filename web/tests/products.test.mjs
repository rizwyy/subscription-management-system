import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin, validateProduct, validateProductQuery } from "../src/lib/products.ts";

const valid = { name: " Workspace ", type: "SOFTWARE", salesPriceMinor: 50000, costPriceMinor: 12000 };

test("normalizes product details and discards client-supplied database fields", () => {
  const result = validateProduct({ ...valid, notes: " useful ", id: "forged" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { ...valid, name: "Workspace", notes: "useful" });
});

test("accepts all product types and database monetary boundaries", () => {
  for (const type of ["SOFTWARE", "SERVICE", "ADDON"]) {
    const result = validateProduct({ ...valid, type, salesPriceMinor: 0, costPriceMinor: 2_000_000_000 });
    assert.equal(result.ok, true);
    assert.equal(result.value.notes, "");
  }
});

test("rejects empty, oversized and invalid names and product types", () => {
  for (const name of [" ", "x".repeat(121), null, 42]) {
    assert.equal(validateProduct({ ...valid, name }).ok, false);
  }
  for (const type of ["UNKNOWN", "software", null]) {
    assert.equal(validateProduct({ ...valid, type }).ok, false);
  }
});

test("rejects invalid values for both monetary fields", () => {
  for (const field of ["salesPriceMinor", "costPriceMinor"]) {
    for (const amount of [-1, 1.5, "500", Infinity, NaN, null, undefined, 2_000_000_001]) {
      assert.equal(validateProduct({ ...valid, [field]: amount }).ok, false);
    }
  }
});

test("rejects malformed bodies and invalid notes", () => {
  for (const body of [null, [], "bad", 0, {}, { ...valid, notes: null }, { ...valid, notes: "x".repeat(2001) }]) {
    assert.equal(validateProduct(body).ok, false);
  }
  assert.equal(validateProduct({ ...valid, name: "x".repeat(120), notes: "x".repeat(2000) }).ok, true);
});

test("defaults and trims search parameters", () => {
  assert.deepEqual(validateProductQuery(new URLSearchParams()).value, { page: 1, query: "" });
  assert.deepEqual(validateProductQuery(new URLSearchParams("page=2&q=%20work%20")).value, { page: 2, query: "work" });
});

test("rejects unsafe, malformed and out-of-range pages", () => {
  for (const page of ["", "0", "-1", "1.5", "1e2", " 1", "10001", "9007199254740993"]) {
    assert.equal(validateProductQuery(new URLSearchParams({ page })).ok, false);
  }
  assert.equal(validateProductQuery(new URLSearchParams("page=10000")).ok, true);
});

test("rejects repeated parameters and oversized searches", () => {
  for (const query of ["page=1&page=2", "q=one&q=two", `q=${"x".repeat(121)}`]) {
    assert.equal(validateProductQuery(new URLSearchParams(query)).ok, false);
  }
});

test("allows legitimate same-origin requests on localhost and 127.0.0.1", () => {
  // Matching origin and request URL
  assert.equal(isAllowedOrigin("http://localhost:3001", "http://localhost:3001/api/products"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3001", "http://127.0.0.1:3001/api/products"), true);

  // When request.url has internal localhost (Next.js default) but browser is on 127.0.0.1:3001
  assert.equal(isAllowedOrigin("http://127.0.0.1:3001", "http://localhost:3001/api/products", "127.0.0.1:3001"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3001", "http://localhost:3001/api/products"), true);

  // When request.url has 127.0.0.1 but browser is on localhost:3001
  assert.equal(isAllowedOrigin("http://localhost:3001", "http://127.0.0.1:3001/api/products", "localhost:3001"), true);
  assert.equal(isAllowedOrigin("http://localhost:3001", "http://127.0.0.1:3001/api/products"), true);

  // IPv6 loopback
  assert.equal(isAllowedOrigin("http://[::1]:3001", "http://localhost:3001/api/products"), true);

  // Default HTTP ports
  assert.equal(isAllowedOrigin("http://localhost", "http://127.0.0.1/api/products"), true);

  // Non-browser / server-to-server requests without Origin header
  assert.equal(isAllowedOrigin(null, "http://localhost:3001/api/products"), true);
  assert.equal(isAllowedOrigin(undefined, "http://localhost:3001/api/products"), true);
});

test("rejects cross-origin, port-mismatched, and malformed requests", () => {
  // Untrusted external origins
  assert.equal(isAllowedOrigin("https://untrusted.example", "http://localhost:3001/api/products"), false);
  assert.equal(isAllowedOrigin("http://evil.com:3001", "http://localhost:3001/api/products"), false);
  assert.equal(isAllowedOrigin("http://localhost.evil.com:3001", "http://localhost:3001/api/products"), false);
  assert.equal(isAllowedOrigin("http://127.0.0.1.attacker.com:3001", "http://127.0.0.1:3001/api/products"), false);

  // Port mismatch on local addresses
  assert.equal(isAllowedOrigin("http://localhost:3000", "http://localhost:3001/api/products"), false);
  assert.equal(isAllowedOrigin("http://127.0.0.1:4000", "http://127.0.0.1:3001/api/products"), false);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3000", "http://localhost:3001/api/products"), false);

  // Protocol mismatch
  assert.equal(isAllowedOrigin("https://localhost:3001", "http://localhost:3001/api/products"), false);

  // Malformed origins
  assert.equal(isAllowedOrigin("null", "http://localhost:3001/api/products"), false);
  assert.equal(isAllowedOrigin("not-a-valid-url", "http://localhost:3001/api/products"), false);
});

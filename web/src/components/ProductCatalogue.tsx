"use client";

import { useEffect, useState, type FormEvent } from "react";

type Product = {
  id: string;
  name: string;
  type: "SOFTWARE" | "SERVICE" | "ADDON";
  salesPriceMinor: number;
  costPriceMinor: number;
  notes: string;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const labels = { SOFTWARE: "Software", SERVICE: "Service", ADDON: "Add-on" };

function toMinor(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Enter prices with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 2_000_000_000) throw new Error("Price exceeds the supported limit.");
  return result;
}

export default function ProductCatalogue({ initialQuery = "" }: { initialQuery?: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({ page: String(page), q: search });
        const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as { items?: Product[]; total?: number; error?: unknown } | null;
        if (!response.ok) {
          throw new Error(typeof body?.error === "string" ? body.error : "Products could not be loaded. Please try again.");
        }
        if (!body || !Array.isArray(body.items) || typeof body.total !== "number") {
          throw new Error("Products could not be loaded. Please try again.");
        }
        if (!cancelled) {
          setItems(body.items);
          setTotal(body.total);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to connect.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [page, search, version]);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setFormError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), type: data.get("type"), notes: data.get("notes"),
          salesPriceMinor: toMinor(String(data.get("salesPrice"))),
          costPriceMinor: toMinor(String(data.get("costPrice"))),
        }),
      });
      const body = (await response.json().catch(() => null)) as { product?: Product; error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Product could not be saved. Please try again.");
      }
      if (!body?.product || typeof body.product.name !== "string") {
        throw new Error("Product could not be saved. Please try again.");
      }
      form.reset();
      setNotice(`${body.product.name} was added to your catalogue.`);
      setDraftSearch("");
      setSearch("");
      setPage(1);
      setLoading(true);
      setVersion((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Product could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function searchProducts(event: FormEvent) {
    event.preventDefault();
    setSearch(draftSearch.trim());
    setPage(1);
    setLoading(true);
    setVersion((value) => value + 1);
  }

  const lastPage = Math.max(1, Math.ceil(total / 20));

  return (
    <main className="page-content" id="main-content">
      <div className="page-heading page-heading-row">
        <div>
          <p className="eyebrow">CATALOGUE</p>
          <h1>Products</h1>
          <p className="page-description">Manage the products available to your subscription business.</p>
        </div>
        <a className="button primary button-fit" href="#add-product">＋ <span>Add product</span></a>
      </div>

      <section className="metric-strip" aria-label="Product summary">
        <div className="metric-card"><span className="metric-label">{search ? "Matching products" : "Products in catalogue"}</span><strong>{loading || loadError ? "—" : total}</strong><span className="metric-foot">Live from product catalogue</span></div>
        <div className="metric-card metric-context"><span className="metric-label">Currency</span><strong>INR</strong><span className="metric-foot">Prices shown per unit</span></div>
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="catalogue-layout">
        <section className="surface catalogue-surface" aria-labelledby="products-title">
          <div className="surface-heading"><div><h2 id="products-title">Product catalogue</h2><p>Products currently stored in your workspace.</p></div></div>
          <form className="search-form" onSubmit={searchProducts} role="search">
            <label className="sr-only" htmlFor="product-search">Search products by name</label>
            <span className="search-symbol" aria-hidden="true">⌕</span>
            <input id="product-search" placeholder="Search products by name" maxLength={120} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} />
            <button className="button secondary" type="submit" disabled={loading}>Search</button>
          </form>
          {loading ? <div className="state-panel" role="status"><span className="spinner" aria-hidden="true" /> Loading products…</div> : loadError ? <div className="state-panel"><p className="error" role="alert">{loadError}</p><button className="button secondary" onClick={() => { setLoading(true); setVersion((value) => value + 1); }}>Try again</button></div> : items.length === 0 ? <div className="state-panel empty-panel"><span className="empty-icon" aria-hidden="true">◇</span><h3>{search ? "No matching products" : "No products yet"}</h3><p>{search ? "Try a different product name or clear your search." : "Add a product to create the first entry in your catalogue."}</p></div> : <>
            <div className="table-scroll"><table><thead><tr><th>Product</th><th>Type</th><th className="numeric">Sales price</th><th className="numeric">Cost price</th></tr></thead><tbody>{items.map((product) => <tr key={product.id}><td><strong>{product.name}</strong>{product.notes && <small className="product-note" title={product.notes}>{product.notes}</small>}</td><td><span className={`badge ${product.type.toLowerCase()}`}>{labels[product.type]}</span></td><td className="numeric">{currency.format(product.salesPriceMinor / 100)}</td><td className="numeric muted">{currency.format(product.costPriceMinor / 100)}</td></tr>)}</tbody></table></div>
            <div className="pagination"><span>Page {page} of {lastPage} · {total} products</span><div><button className="button secondary" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }}>Previous</button><button className="button secondary" disabled={page >= lastPage || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Next</button></div></div>
          </>}
        </section>

        <section className="surface create-surface" id="add-product" aria-labelledby="create-title">
          <div className="surface-heading"><div><h2 id="create-title">Add a product</h2><p>Save product details to your catalogue.</p></div></div>
          <form className="product-form" onSubmit={createProduct}>
            <label htmlFor="name">Product name<input id="name" name="name" placeholder="e.g. Business Workspace" required maxLength={120} /></label>
            <label htmlFor="type">Product type<select id="type" name="type" defaultValue="SOFTWARE"><option value="SOFTWARE">Software</option><option value="SERVICE">Service</option><option value="ADDON">Add-on</option></select></label>
            <div className="price-fields"><label htmlFor="salesPrice">Sales price (₹)<input id="salesPrice" name="salesPrice" type="number" min="0" max="20000000" step="0.01" placeholder="500.00" required /></label><label htmlFor="costPrice">Cost price (₹)<input id="costPrice" name="costPrice" type="number" min="0" max="20000000" step="0.01" placeholder="120.00" required /></label></div>
            <label htmlFor="notes">Notes <span className="optional">Optional</span><textarea id="notes" name="notes" placeholder="What should your team know about this product?" maxLength={2000} rows={3} /></label>
            {formError && <p className="error" role="alert">{formError}</p>}
            <button className="button primary submit-product" type="submit" disabled={saving}>{saving ? "Saving product…" : "Save product"}<span aria-hidden="true">→</span></button>
            <p className="form-security-note">Product costs are internal data. Keep this application on localhost until access control is implemented.</p>
          </form>
        </section>
      </div>
    </main>
  );
}

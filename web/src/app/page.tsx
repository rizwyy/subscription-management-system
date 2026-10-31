"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

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

export default function Home() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
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
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">B</span>brightloop<span className="brand-dot">.</span></Link>
        <div className="workspace-name"><span className="workspace-avatar">BS</span><div><strong>Brightloop Software</strong><small>Subscription operations</small></div></div>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <Link href="/" className="nav-active" aria-current="page"><span aria-hidden="true">▦</span> Product catalogue</Link>
        <div className="sidebar-note"><strong>A clear starting point.</strong><p>Manage the products that power your recurring business.</p></div>
      </aside>
      <div className="main-area">
        <header className="topbar"><span>Workspace <span className="muted">/</span> <strong>Product catalogue</strong></span><span className="workspace-avatar">BS</span></header>
        <main className="content">
          <div className="page-heading"><div><p className="eyebrow">BUILD YOUR CATALOGUE</p><h1>Good products. Lasting relationships.</h1><p className="muted">Keep your software, services and add-ons organised in one place.</p></div></div>
          <section className="summary" aria-label="Catalogue summary"><div><span className="summary-label">{search ? "Matching products" : "Total products"}</span><strong>{loading || loadError ? "—" : total}</strong></div><div><span className="summary-label">Currency</span><strong className="summary-text">INR <small>Indian Rupee</small></strong></div><div><span className="summary-label">Pricing</span><strong className="summary-text">Per unit <small>Before tax</small></strong></div></section>
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="catalogue-grid">
            <section className="panel product-panel" aria-labelledby="products-title">
              <div className="panel-heading"><div><h2 id="products-title">Your products</h2><p className="muted">A reliable foundation for every subscription.</p></div></div>
              <form className="search-form" onSubmit={searchProducts}><label className="sr-only" htmlFor="product-search">Search products</label><input id="product-search" placeholder="Search by product name…" maxLength={120} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /><button className="button secondary" type="submit" disabled={loading}>Search</button></form>
              {loading ? <div className="empty-state" role="status">Loading your catalogue…</div> : loadError ? <div className="empty-state"><p className="error" role="alert">{loadError}</p><button className="button secondary" onClick={() => { setLoading(true); setVersion((value) => value + 1); }}>Try again</button></div> : items.length === 0 ? <div className="empty-state"><span className="empty-icon" aria-hidden="true">▦</span><h3>{search ? "No matching products" : "Your next chapter starts here"}</h3><p>{search ? "Try a different product name." : "Add your first product using the form to get your catalogue started."}</p></div> : <><div className="table-scroll"><table><thead><tr><th>Product</th><th>Type</th><th className="numeric">Sales price</th><th className="numeric">Cost price</th></tr></thead><tbody>{items.map((product) => <tr key={product.id}><td><strong>{product.name}</strong>{product.notes && <small className="product-note" title={product.notes}>{product.notes}</small>}</td><td><span className={`badge ${product.type.toLowerCase()}`}>{labels[product.type]}</span></td><td className="numeric">{currency.format(product.salesPriceMinor / 100)}</td><td className="numeric muted">{currency.format(product.costPriceMinor / 100)}</td></tr>)}</tbody></table></div><div className="pagination"><span>Page {page} of {lastPage} · {total} products</span><div><button className="button secondary" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }}>Previous</button><button className="button secondary" disabled={page >= lastPage} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Next</button></div></div></>}
            </section>
            <section className="panel create-panel" aria-labelledby="create-title"><div className="panel-heading"><div><h2 id="create-title">Add a product</h2><p className="muted">Set the details. Build from here.</p></div></div><form className="product-form" onSubmit={createProduct}>
              <label htmlFor="name">Product name<input id="name" name="name" placeholder="e.g. Business Workspace" required maxLength={120} /></label>
              <label htmlFor="type">Product type<select id="type" name="type" defaultValue="SOFTWARE"><option value="SOFTWARE">Software</option><option value="SERVICE">Service</option><option value="ADDON">Add-on</option></select></label>
              <div className="price-fields"><label htmlFor="salesPrice">Sales price (₹)<input id="salesPrice" name="salesPrice" type="number" min="0" max="20000000" step="0.01" placeholder="500.00" required /></label><label htmlFor="costPrice">Cost price (₹)<input id="costPrice" name="costPrice" type="number" min="0" max="20000000" step="0.01" placeholder="120.00" required /></label></div>
              <label htmlFor="notes">Notes <span className="optional">optional</span><textarea id="notes" name="notes" placeholder="What should your team know about this product?" maxLength={2000} rows={3} /></label>
              {formError && <p className="error" role="alert">{formError}</p>}
              <button className="button primary" type="submit" disabled={saving}>{saving ? "Saving product…" : "Add product"}<span aria-hidden="true">＋</span></button>
            </form></section>
          </div>
        </main>
      </div>
    </div>
  );
}

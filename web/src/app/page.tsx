"use client";

import AppShell from "@/components/AppShell";
import Link from "next/link";
import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  type: "SOFTWARE" | "SERVICE" | "ADDON";
  salesPriceMinor: number;
  costPriceMinor: number;
  notes: string;
};

type ProductResponse = { items?: Product[]; total?: number; error?: unknown };
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const typeLabels = { SOFTWARE: "Software", SERVICE: "Service", ADDON: "Add-on" };

export default function OverviewPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/products?page=1", { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as ProductResponse | null;
        if (!response.ok) {
          throw new Error(typeof body?.error === "string" ? body.error : "Workspace data could not be loaded.");
        }
        if (!body || !Array.isArray(body.items) || typeof body.total !== "number") {
          throw new Error("Workspace data could not be loaded. Please try again.");
        }
        if (!cancelled) {
          setProducts(body.items.slice(0, 5));
          setProductCount(body.total);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to connect to the workspace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);
  const retry = () => {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  };

  return (
    <AppShell>
      <main className="page-content" id="main-content">
        <section className="overview-heading">
          <div>
            <p className="eyebrow">BRIGHTLOOP CONTROL</p>
            <h1>What needs attention today?</h1>
            <p className="page-description">A clear view of your subscription operations. Only connected, live data is shown.</p>
          </div>
          <Link className="button primary button-fit" href="/products">＋ <span>Manage products</span></Link>
        </section>

        <section className="metric-strip overview-metrics" aria-label="Workspace status">
          <div className="metric-card"><span className="metric-label">Products in catalogue</span><strong>{loading || error ? "—" : productCount}</strong><span className="metric-foot">Live database count</span></div>
          <div className="metric-card"><span className="metric-label">Subscriptions</span><strong className="metric-status">Not connected</strong><span className="metric-foot">Subscription API unavailable</span></div>
          <div className="metric-card"><span className="metric-label">Billing</span><strong className="metric-status">Not connected</strong><span className="metric-foot">Invoice and payment APIs unavailable</span></div>
        </section>

        <section className="attention-grid" aria-label="Items needing attention">
          <article className="attention-card attention-red">
            <div className="attention-icon" aria-hidden="true">▤</div>
            <div><p className="attention-label">Overdue invoices</p><strong className="attention-value">Unavailable</strong><p className="attention-description">Invoice and due-date data is not connected.</p></div>
            <span className="attention-tag">API pending</span>
          </article>
          <article className="attention-card attention-amber">
            <div className="attention-icon" aria-hidden="true">◷</div>
            <div><p className="attention-label">Upcoming renewals</p><strong className="attention-value">Unavailable</strong><p className="attention-description">Subscription schedule data is not connected.</p></div>
            <span className="attention-tag">API pending</span>
          </article>
          <article className="attention-card attention-green">
            <div className="attention-icon" aria-hidden="true">⇄</div>
            <div><p className="attention-label">Payments to review</p><strong className="attention-value">Unavailable</strong><p className="attention-description">Payment review rules are not defined yet.</p></div>
            <span className="attention-tag">API pending</span>
          </article>
        </section>

        <div className="overview-grid">
          <section className="surface overview-table" aria-labelledby="catalogue-preview-title">
            <div className="surface-heading surface-heading-row">
              <div><h2 id="catalogue-preview-title">Product catalogue</h2><p>Recent products from the live database.</p></div>
              <Link href="/products" className="text-link">View catalogue <span aria-hidden="true">→</span></Link>
            </div>
            {loading ? <div className="state-panel compact-state" role="status"><span className="spinner" aria-hidden="true" /> Loading workspace data…</div> : error ? <div className="state-panel compact-state"><p className="error" role="alert">{error}</p><button className="button secondary" onClick={retry}>Retry</button></div> : products.length === 0 ? <div className="state-panel compact-state empty-panel"><h3>No products yet</h3><p>Your catalogue is empty. Add a product to get started.</p><Link className="button secondary" href="/products">Open product catalogue</Link></div> : <>
              <div className="table-scroll"><table><thead><tr><th>Product</th><th>Type</th><th className="numeric">Sales price</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td><span className={`badge ${product.type.toLowerCase()}`}>{typeLabels[product.type]}</span></td><td className="numeric">{currency.format(product.salesPriceMinor / 100)}</td></tr>)}</tbody></table></div>
              <p className="table-footnote">Showing up to 5 of {productCount} products</p>
            </>}
          </section>

          <aside className="overview-side">
            <section className="surface side-panel" aria-labelledby="subscriptions-title">
              <div className="surface-heading"><div><h2 id="subscriptions-title">Recent subscriptions</h2><p>Lifecycle and renewal activity</p></div></div>
              <div className="integration-state"><span className="integration-icon" aria-hidden="true">↻</span><strong>Subscription data isn’t connected</strong><p>Customer, plan, status and next billing date will appear once the subscription API is available.</p></div>
            </section>
            <section className="surface side-panel billing-panel" aria-labelledby="billing-title">
              <div className="surface-heading"><div><h2 id="billing-title">Invoice summary</h2><p>Amounts and balances from billing records</p></div><span className="status-pill status-pending">Not connected</span></div>
              <div className="billing-blocked"><p>Invoice and payment endpoints are not available in this workspace yet.</p><p>Preview invoices and Run billing will appear here only after the billing backend and permissions are ready.</p></div>
            </section>
            <div className="overview-refresh"><button className="button secondary" onClick={retry} disabled={loading}>{loading ? "Refreshing…" : "Refresh overview"}</button><span>Product data refreshes from the database.</span></div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

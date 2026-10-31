"use client";

import AppShell from "@/components/AppShell";
import { useEffect, useState, type FormEvent } from "react";

type Option = { id: string; name: string };
type Subscription = { id: string; number: string; status: string; nextBillingAt: string | null; customer: Option; plan: Option };
const transitions: Record<string, string> = { DRAFT: "QUOTATION", QUOTATION: "CONFIRMED", CONFIRMED: "ACTIVE", ACTIVE: "CLOSED" };
function paise(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error("Enter a valid price with at most two decimal places.");
  const [whole, fraction = ""] = raw.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 2_000_000_000) throw new Error("Price exceeds the supported limit.");
  return result;
}

export default function SubscriptionsPage() {
  const [customers, setCustomers] = useState<Option[]>([]);
  const [plans, setPlans] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const results = await Promise.all(["customers", "plans", "products", "subscriptions"].map(async name => {
          const response = await fetch(`/api/${name}`, { cache: "no-store" });
          const result = await response.json();
          if (!response.ok || !Array.isArray(result.items)) throw new Error(result.error || `Unable to load ${name}.`);
          return result.items;
        }));
        if (!cancelled) { setCustomers(results[0]); setPlans(results[1]); setProducts(results[2]); setSubscriptions(results[3]); setError(""); }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load data."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>, kind: "customers" | "plans" | "subscriptions") {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      let payload: object;
      if (kind === "customers") payload = { name: fields.get("name"), email: fields.get("email") };
      else if (kind === "plans") payload = { name: fields.get("name"), priceMinor: paise(fields.get("price")), billingInterval: fields.get("interval"), minimumQuantity: 1 };
      else payload = { customerId: fields.get("customerId"), planId: fields.get("planId"), startsAt: fields.get("startsAt"), paymentTermDays: 30, lines: [{ productId: fields.get("productId"), quantity: Number(fields.get("quantity")), unitPriceMinor: paise(fields.get("price")), taxBasisPoints: Number(fields.get("tax")) }] };
      const response = await fetch(`/api/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save.");
      form.reset(); setNotice(`${kind === "customers" ? "Customer" : kind === "plans" ? "Plan" : "Draft subscription"} saved.`); setRefresh(value => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save."); }
    finally { setBusy(false); }
  }
  async function advance(item: Subscription) {
    if (busy || !transitions[item.status]) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/subscriptions/${encodeURIComponent(item.id)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: transitions[item.status] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Status could not be updated.");
      setNotice(`Subscription moved to ${result.subscription.status}.`); setRefresh(value => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Status could not be updated."); }
    finally { setBusy(false); }
  }

  return <AppShell><main className="page-content" id="main-content">
    <div className="overview-heading"><div><p className="eyebrow">SUBSCRIPTION OPERATIONS</p><h1>Subscriptions</h1><p>Create a customer, plan and draft subscription, then advance its status.</p></div></div>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {loading ? <p role="status">Loading…</p> : <>
      <div className="overview-grid"><section className="surface"><div className="surface-heading"><h2>New customer</h2></div><form className="product-form" onSubmit={e => submit(e, "customers")}><label>Name<input name="name" required maxLength={120} /></label><label>Email<input name="email" type="email" required maxLength={254} /></label><button className="button primary" disabled={busy}>Save customer</button></form></section>
      <section className="surface"><div className="surface-heading"><h2>New plan</h2></div><form className="product-form" onSubmit={e => submit(e, "plans")}><label>Name<input name="name" required maxLength={120} /></label><label>Price (₹)<input name="price" type="number" min="0" step="0.01" required /></label><label>Billing interval<select name="interval"><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label><button className="button primary" disabled={busy}>Save plan</button></form></section></div>
      <section className="surface"><div className="surface-heading"><h2>New draft subscription</h2><p>Up to the first 20 customers, plans and products are shown.</p></div><form className="product-form" onSubmit={e => submit(e, "subscriptions")}>
        <label>Customer<select name="customerId" required defaultValue=""><option value="" disabled>Select customer</option>{customers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Plan<select name="planId" required defaultValue=""><option value="" disabled>Select plan</option>{plans.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Product<select name="productId" required defaultValue=""><option value="" disabled>Select product</option>{products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Start date<input type="date" name="startsAt" required /></label><label>Quantity<input type="number" name="quantity" min="1" step="1" defaultValue="1" required /></label><label>Unit price (₹)<input type="number" name="price" min="0" step="0.01" required /></label><label>Tax (basis points; 18% = 1800)<input type="number" name="tax" min="0" max="10000" defaultValue="0" required /></label><button className="button primary" disabled={busy || !customers.length || !plans.length || !products.length}>Create draft</button></form></section>
      <section className="surface"><div className="surface-heading"><h2>Recent subscriptions</h2><p>Showing the first 20 subscriptions.</p></div>{subscriptions.length === 0 ? <p>No subscriptions yet.</p> : <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Next billing</th><th>Action</th></tr></thead><tbody>{subscriptions.map(item => <tr key={item.id}><td>{item.customer.name}</td><td>{item.plan.name}</td><td>{item.status}</td><td>{item.nextBillingAt?.slice(0,10) ?? "—"}</td><td>{transitions[item.status] && <button className="button secondary" disabled={busy} onClick={() => advance(item)}>Move to {transitions[item.status]}</button>}</td></tr>)}</tbody></table></div>}</section>
    </>}
  </main></AppShell>;
}

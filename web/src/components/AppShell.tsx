"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { label: "Overview", href: "/", icon: "⌂", available: true },
  { label: "Customers", icon: "◉", available: false },
  { label: "Products", href: "/products", icon: "◇", available: true },
  { label: "Plans", icon: "▤", available: false },
  { label: "Quotes", icon: "▧", available: false },
  { label: "Subscriptions", icon: "↻", available: false },
  { label: "Invoices", icon: "▱", available: false },
  { label: "Payments", icon: "⇄", available: false },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageTitle = pathname === "/products" ? "Products" : "Overview";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="Brightloop home">
          <span className="brand-mark" aria-hidden="true">B</span>brightloop<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-switcher">
          <span className="workspace-avatar" aria-hidden="true">BL</span>
          <span><strong>Brightloop</strong><small>Workspace</small></span>
          <span className="switcher-chevron" aria-hidden="true">⌄</span>
        </div>
        <nav className="nav-list">
          <p className="nav-caption">WORKSPACE</p>
          {navigation.map((item) => item.available ? (
            <Link
              key={item.label}
              href={item.href!}
              className={`nav-item${pathname === item.href ? " nav-item-active" : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ) : (
            <div className="nav-item nav-item-disabled" key={item.label} aria-disabled="true" title={`${item.label} API and screen are not connected yet`}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              <span className="nav-soon">Soon</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="nav-caption">PREFERENCES</p>
          <div className="nav-item nav-item-disabled" aria-disabled="true" title="Settings and staff management are not connected yet">
            <span className="nav-icon" aria-hidden="true">⚙</span>
            <span>Settings / Staff</span>
            <span className="nav-soon">Soon</span>
          </div>
          <p className="local-only"><span aria-hidden="true" /> Local development · localhost only</p>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span aria-hidden="true">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-note"><span className="local-dot" /> Internal preview</div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.filter((item) => item.available).map((item) => (
            <Link key={item.label} href={item.href!} className={`mobile-nav-item${pathname === item.href ? " active" : ""}`} aria-current={pathname === item.href ? "page" : undefined}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </Link>
          ))}
          <span className="mobile-nav-note">Other sections coming soon</span>
        </nav>
        {children}
      </div>
    </div>
  );
}

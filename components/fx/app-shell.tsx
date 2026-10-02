"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "./icon";
import { TallyMark } from "./tally";
import { Brand } from "./brand";
import { SignOutButton } from "../sign-out-button";
import { centsToUsd } from "@/lib/money";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Overview", icon: "home" },
  { href: "/dashboard/earn", label: "Earn", icon: "spark" },
  { href: "/dashboard/wallet", label: "Wallet", icon: "wallet" },
  { href: "/dashboard/transactions", label: "Activity", icon: "activity" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export function FxAppShell({
  children,
  email,
  initial,
  availableCents,
}: {
  children: React.ReactNode;
  email: string;
  initial: string;
  availableCents: number;
}) {
  const path = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const allLinks = [...navigation, { href: "/dashboard/profile", label: "Profile", icon: "settings" as IconName }];
  const current =
    allLinks.find((item) => path === item.href) ??
    allLinks.find((item) => item.href !== "/dashboard" && path.startsWith(`${item.href}/`)) ??
    navigation[0];
  const isActive = (href: string) =>
    path === href || (href !== "/dashboard" && path.startsWith(`${href}/`));

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand light />
        <div className="sidebar-caption">YOUR TIME ADDS UP</div>
        <nav aria-label="Main navigation" className="side-nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? "nav-link active" : "nav-link"}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav aria-label="Account navigation">
            <Link
              href="/dashboard/profile"
              className={`nav-link ${isActive("/dashboard/profile") ? "active" : ""}`}
              aria-current={isActive("/dashboard/profile") ? "page" : undefined}
            >
              <Icon name="settings" />
              Profile
            </Link>
            <SignOutButton />
          </nav>
          <div className="sidebar-note">
            <TallyMark size={27} className="tiny-spark" />
            <span>
              A little, then
              <br />a little more.
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <div className="breadcrumb">
            <span>My Freearn</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{current?.label ?? "Overview"}</strong>
          </div>
          <form
            className="header-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/dashboard/transactions?q=${encodeURIComponent(search)}`);
            }}
          >
            <Icon name="search" size={18} />
            <input
              aria-label="Search activity"
              placeholder="Search your activity"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="header-actions">
            <Link href="/dashboard/wallet" className="mobile-balance">
              {centsToUsd(availableCents)}
            </Link>
            <Link className="avatar" href="/dashboard/profile" aria-label={`${email}'s account`}>
              {initial}
            </Link>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {children}
          <footer className="app-footer">
            <span>Your time adds up.</span>
            <span>
              USD <span className="footer-divider">·</span>{" "}
              <Link href="/contact">Need a hand?</Link>
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "active" : ""}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

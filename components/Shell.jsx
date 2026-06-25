"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Settings2,
  FileSpreadsheet,
  LogOut,
  Anchor,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { href: "/", label: "Beranda", icon: LayoutDashboard },
  { href: "/pesanan", label: "Pesanan Customer", icon: ClipboardList },
  { href: "/master-data", label: "Master Data", icon: Settings2 },
  { href: "/import-export", label: "Import / Export", icon: FileSpreadsheet },
];

export default function Shell({ title, subtitle, children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="skeleton">Memuat sesi admin...</div>;
  }

  if (!user) {
    return <div className="skeleton">Mengalihkan ke halaman login...</div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Anchor size={16} />
          </div>
          <div className="brand-text">
            Sales Logistics
            <small>Pesanan Customer</small>
          </div>
        </div>

        <nav>
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                className={`nav-link ${active ? "active" : ""}`}
                onClick={() => router.push(item.href)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">{user.email}</div>
          <button className="logout-btn" onClick={logout}>
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title display">{title}</div>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  FolderKanban,
  FileBarChart,
  Shield,
  Bell,
  Settings,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BASIC_ITEMS: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/receipts", label: "Receipts", icon: Receipt },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/exports", label: "Exports", icon: FileBarChart },
  { href: "/app/lifecycle", label: "Lifecycle", icon: Shield },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
];

interface SidebarProps {
  planTier?: string;
  receiptsUsed?: number;
  receiptsLimit?: number;
}

export default function Sidebar({ receiptsUsed, receiptsLimit }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-gunmetal border border-edge-steel rounded-lg p-2 text-concrete hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60 bg-gunmetal border-r border-edge-steel flex flex-col
          transition-transform lg:translate-x-0 lg:static lg:z-auto
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-edge-steel">
          <Link href="/app/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-safety-orange">
              <span className="text-white font-bold text-sm">II</span>
            </div>
            <span className="text-lg font-bold text-white">Itemize-It</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-concrete hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Basic nav items */}
          {BASIC_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href) ?? false;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-safety-orange/10 text-safety-orange"
                      : "text-concrete hover:text-white hover:bg-edge-steel/50"
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}

          {/* Bookkeeping section */}
          <div className="pt-4 pb-2 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-concrete/40">
              Bookkeeping
            </p>
          </div>

          <a
            href="https://bookkeeperbrian.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-concrete hover:text-violet-400 hover:bg-violet-600/5 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            Connect to Brian
          </a>

          {/* Settings — always last */}
          <div className="pt-2">
            <Link
              href="/app/settings"
              onClick={() => setMobileOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${
                  pathname?.startsWith("/app/settings")
                    ? "bg-safety-orange/10 text-safety-orange"
                    : "text-concrete hover:text-white hover:bg-edge-steel/50"
                }
              `}
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-edge-steel space-y-2">
          {receiptsUsed !== undefined && receiptsLimit !== undefined && receiptsLimit > 0 && (
            <div>
              <div className="flex justify-between text-[10px] text-concrete/60 mb-1">
                <span>Receipts</span>
                <span>{receiptsUsed}/{receiptsLimit}</span>
              </div>
              <div className="h-1 bg-asphalt rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    receiptsUsed / receiptsLimit >= 0.9
                      ? "bg-critical"
                      : receiptsUsed / receiptsLimit >= 0.7
                        ? "bg-warn"
                        : "bg-safety-orange/60"
                  }`}
                  style={{ width: `${Math.min((receiptsUsed / receiptsLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
          <p className="text-xs text-concrete/60">
            Itemize-It v0.1
          </p>
        </div>
      </aside>
    </>
  );
}

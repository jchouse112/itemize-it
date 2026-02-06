"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Shield, Package, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import WarrantyCard from "@/components/app/WarrantyCard";
import ReturnDeadline from "@/components/app/ReturnDeadline";
import RecallAlert from "@/components/app/RecallAlert";
import type { IIWarranty, IIReturn, IIRecallMatch } from "@/lib/ii-types";

type WarrantyWithReceipt = IIWarranty & {
  ii_receipts?: { merchant: string | null; purchase_date: string | null } | null;
};

type ReturnWithReceipt = IIReturn & {
  ii_receipts?: { merchant: string | null; purchase_date: string | null } | null;
};

type PendingWarrantyItem = {
  id: string;
  receipt_id: string;
  name: string;
  total_price_cents: number;
  warranty_lookup_status: "unknown" | "in_progress" | "found" | "not_found" | "error" | "not_eligible";
  warranty_checked_at: string | null;
  ii_receipts?: { merchant: string | null; purchase_date: string | null } | null;
};

type Tab = "warranties" | "returns" | "recalls";

export default function LifecyclePage() {
  const [activeTab, setActiveTab] = useState<Tab>("warranties");
  const [warranties, setWarranties] = useState<WarrantyWithReceipt[]>([]);
  const [pendingWarrantyItems, setPendingWarrantyItems] = useState<PendingWarrantyItem[]>([]);
  const [returns, setReturns] = useState<ReturnWithReceipt[]>([]);
  const [recalls, setRecalls] = useState<IIRecallMatch[]>([]);
  const [loadingTab, setLoadingTab] = useState<Tab | null>("warranties");

  // Track which tabs have already been fetched to avoid re-fetching
  const fetchedTabs = useRef(new Set<Tab>());

  const fetchTabData = useCallback(async (tab: Tab) => {
    if (fetchedTabs.current.has(tab)) return;
    fetchedTabs.current.add(tab);
    setLoadingTab(tab);

    try {
      switch (tab) {
        case "warranties": {
          const [warrantyRes, pendingRes] = await Promise.all([
            fetch("/api/warranties"),
            fetch("/api/warranties/pending-items"),
          ]);
          if (warrantyRes.ok) setWarranties(await warrantyRes.json());
          if (pendingRes.ok) setPendingWarrantyItems(await pendingRes.json());
          break;
        }
        case "returns": {
          const res = await fetch("/api/returns");
          if (res.ok) setReturns(await res.json());
          break;
        }
        case "recalls": {
          const res = await fetch("/api/recalls?dismissed=false");
          if (res.ok) setRecalls(await res.json());
          break;
        }
      }
    } catch (err) {
      console.error(`Failed to load ${tab} data:`, err);
      // Allow retry on next tab switch
      fetchedTabs.current.delete(tab);
    } finally {
      setLoadingTab(null);
    }
  }, []);

  // Fetch data for the active tab
  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  async function handleMarkReturned(id: string) {
    const res = await fetch("/api/returns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "returned" }),
    });
    if (res.ok) {
      setReturns((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "returned" as const } : r))
      );
    }
  }

  async function handleDismissRecall(id: string) {
    const res = await fetch("/api/recalls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, dismissed: true }),
    });
    if (res.ok) {
      setRecalls((prev) => prev.filter((r) => r.id !== id));
    }
  }

  const isLoading = loadingTab === activeTab;

  const tabs: { key: Tab; label: string; icon: typeof Shield; count: number }[] = [
    { key: "warranties", label: "Warranties", icon: Shield, count: warranties.length + pendingWarrantyItems.length },
    { key: "returns", label: "Returns", icon: Package, count: returns.filter((r) => r.status === "eligible").length },
    { key: "recalls", label: "Recalls", icon: AlertTriangle, count: recalls.length },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lifecycle Tracking</h1>
        <p className="text-sm text-concrete mt-1">
          Monitor warranties, return windows, and product recalls.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gunmetal rounded-xl p-1 border border-edge-steel">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
                isActive
                  ? "bg-safety-orange/10 text-safety-orange"
                  : "text-concrete hover:text-white hover:bg-edge-steel/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-safety-orange/20" : "bg-edge-steel"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-concrete" />
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === "warranties" && (
            <>
              {pendingWarrantyItems.length > 0 && (
                <div className="bg-gunmetal border border-edge-steel rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">Needs Warranty Check</h3>
                    <span className="text-xs text-concrete">{pendingWarrantyItems.length} items</span>
                  </div>
                  <div className="space-y-2">
                    {pendingWarrantyItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between border border-edge-steel/70 rounded-lg px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{item.name}</p>
                          <p className="text-xs text-concrete">
                            {item.ii_receipts?.merchant ?? "Unknown merchant"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-edge-steel text-concrete capitalize">
                            {item.warranty_lookup_status.replace("_", " ")}
                          </span>
                          <Link
                            href={`/app/receipts/${item.receipt_id}`}
                            className="text-xs text-safety-orange hover:underline"
                          >
                            Open item
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {warranties.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No warranties yet"
                  description="Run a warranty check from a receipt item to start tracking coverage."
                />
              ) : (
                warranties.map((w) => <WarrantyCard key={w.id} warranty={w} />)
              )}
            </>
          )}

          {activeTab === "returns" && (
            <>
              {returns.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No return deadlines"
                  description="Return tracking will appear as return policies are detected from your receipts."
                />
              ) : (
                returns.map((r) => (
                  <ReturnDeadline
                    key={r.id}
                    returnRecord={r}
                    onMarkReturned={handleMarkReturned}
                  />
                ))
              )}
            </>
          )}

          {activeTab === "recalls" && (
            <>
              {recalls.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No active recalls"
                  description="Products from your receipts are checked against the CPSC recall database."
                />
              ) : (
                recalls.map((r) => (
                  <RecallAlert key={r.id} recall={r} onDismiss={handleDismissRecall} />
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-16 space-y-3">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-edge-steel/50">
        <Icon className="w-6 h-6 text-concrete/60" />
      </div>
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <p className="text-xs text-concrete/60 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

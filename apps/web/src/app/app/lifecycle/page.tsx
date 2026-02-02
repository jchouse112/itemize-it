"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Shield, Package, AlertTriangle, Loader2 } from "lucide-react";
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

type Tab = "warranties" | "returns" | "recalls";

export default function LifecyclePage() {
  const [activeTab, setActiveTab] = useState<Tab>("warranties");
  const [warranties, setWarranties] = useState<WarrantyWithReceipt[]>([]);
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
          const res = await fetch("/api/warranties");
          if (res.ok) setWarranties(await res.json());
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
    { key: "warranties", label: "Warranties", icon: Shield, count: warranties.length },
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
              {warranties.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No warranties yet"
                  description="Warranties are automatically created when you upload receipts from recognized retailers."
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

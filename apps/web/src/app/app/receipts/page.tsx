"use client";

import { useState, useEffect, useCallback } from "react";
import { Receipt, Filter, AlertCircle } from "lucide-react";
import ReceiptUpload from "@/components/app/ReceiptUpload";
import ReceiptCard from "@/components/app/ReceiptCard";
import type { IIReceipt, ReceiptStatus } from "@/lib/ii-types";

type ReceiptWithItemCount = IIReceipt & {
  ii_receipt_items: { id: string }[];
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Processing" },
  { value: "in_review", label: "Needs Review" },
  { value: "complete", label: "Complete" },
  { value: "exported", label: "Exported" },
  { value: "archived", label: "Archived" },
];

/** Skeleton placeholder for receipt cards list */
function ReceiptCardsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="bg-gunmetal border border-edge-steel rounded-xl p-4 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-40 bg-edge-steel rounded" />
                {i % 3 === 0 && <div className="h-4 w-12 bg-edge-steel/60 rounded" />}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-24 bg-edge-steel/60 rounded" />
                <div className="h-4 w-16 bg-edge-steel/60 rounded" />
                <div className="h-4 w-20 bg-edge-steel/60 rounded" />
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="h-5 w-16 bg-safe/10 rounded" />
                {i % 2 === 0 && <div className="h-5 w-16 bg-edge-steel rounded" />}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <div className="h-6 w-20 bg-edge-steel rounded" />
              <div className="h-4 w-4 bg-edge-steel/60 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptWithItemCount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/receipts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts ?? []);
        setTotal(data.total ?? 0);
      } else {
        setError("Failed to load receipts. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Receipts</h1>
          <p className="text-sm text-concrete mt-0.5">{total} total</p>
        </div>
        <ReceiptUpload onUploadComplete={fetchReceipts} />
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-concrete shrink-0" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`
              text-sm px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors
              ${
                statusFilter === f.value
                  ? "bg-safety-orange/10 text-safety-orange"
                  : "text-concrete hover:text-white hover:bg-edge-steel/50"
              }
            `}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Receipt list */}
      {loading ? (
        <ReceiptCardsSkeleton />
      ) : receipts.length === 0 ? (
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-12 text-center">
          <Receipt className="w-12 h-12 text-concrete/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            {statusFilter ? "No receipts match this filter" : "No receipts yet"}
          </h2>
          <p className="text-concrete text-sm max-w-md mx-auto">
            {statusFilter
              ? "Try a different filter or upload a new receipt."
              : "Upload your first receipt to start organizing your expenses."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => (
            <ReceiptCard
              key={r.id}
              id={r.id}
              merchant={r.merchant}
              purchase_date={r.purchase_date}
              total_cents={r.total_cents}
              currency={r.currency}
              status={r.status as ReceiptStatus}
              has_business_items={r.has_business_items}
              has_personal_items={r.has_personal_items}
              has_unclassified_items={r.has_unclassified_items}
              item_count={r.ii_receipt_items?.length ?? 0}
              email_from={r.email_from}
              onDelete={() => {
                setReceipts((prev) => prev.filter((receipt) => receipt.id !== r.id));
                setTotal((prev) => prev - 1);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

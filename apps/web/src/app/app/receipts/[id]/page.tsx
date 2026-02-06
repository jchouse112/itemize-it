"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  Pencil,
  Save,
  X,
  Check,
} from "lucide-react";
import Link from "next/link";
import LineItemTable from "@/components/app/LineItemTable";
import DuplicateAlert from "@/components/app/DuplicateAlert";
import ResizableSplitPanel from "@/components/app/ResizableSplitPanel";
import { ProjectCacheProvider } from "@/components/app/ProjectCacheProvider";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { formatCentsDisplay, formatReceiptDate } from "@/lib/ii-utils";
import type { ReceiptWithItems, ReceiptStatus, IIReceiptItem, IIReceipt } from "@/lib/ii-types";

/** Celebration overlay shown when all items are classified */
function ClassificationComplete({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="animate-in zoom-in-50 fade-in duration-300 flex flex-col items-center gap-3 bg-gunmetal/95 border border-safe/30 rounded-2xl px-8 py-6 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-safe/20 flex items-center justify-center animate-in zoom-in duration-500">
          <Check className="w-8 h-8 text-safe" strokeWidth={3} />
        </div>
        <p className="text-lg font-semibold text-white">All Done!</p>
        <p className="text-sm text-concrete">All items have been classified</p>
      </div>
    </div>
  );
}

// Lazy load heavy modal components
const SplitItemModal = dynamic(() => import("@/components/app/SplitItemModal"), {
  loading: () => null,
});
const DuplicateComparison = dynamic(() => import("@/components/app/DuplicateComparison"), {
  loading: () => null,
});

const STATUS_LABELS: Record<ReceiptStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-warn" },
  processing: { label: "Processing", color: "text-warn" },
  in_review: { label: "Needs Review", color: "text-safety-orange" },
  complete: { label: "Complete", color: "text-safe" },
  exported: { label: "Exported", color: "text-concrete" },
  archived: { label: "Archived", color: "text-concrete/60" },
};

/** Skeleton placeholder matching the page layout */
function ReceiptDetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-edge-steel rounded" />
          <div>
            <div className="h-6 w-48 bg-edge-steel rounded mb-2" />
            <div className="h-4 w-32 bg-edge-steel/60 rounded" />
          </div>
        </div>
        <div className="h-9 w-20 bg-edge-steel rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Image skeleton */}
        <div className="lg:col-span-1">
          <div className="bg-gunmetal border border-edge-steel rounded-xl overflow-hidden">
            <div className="aspect-[3/4] bg-edge-steel/50" />
          </div>
        </div>

        {/* Right: Details skeleton */}
        <div className="lg:col-span-2 space-y-6">
          {/* Receipt summary skeleton */}
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
            <div className="h-4 w-24 bg-edge-steel rounded mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-16 bg-edge-steel/60 rounded mb-2" />
                  <div className="h-5 w-24 bg-edge-steel rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Notes skeleton */}
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
            <div className="h-4 w-12 bg-edge-steel rounded mb-3" />
            <div className="h-4 w-full bg-edge-steel/60 rounded" />
          </div>

          {/* Line items skeleton */}
          <div>
            <div className="h-4 w-28 bg-edge-steel rounded mb-3" />
            <div className="bg-gunmetal border border-edge-steel rounded-xl overflow-hidden">
              <div className="border-b border-edge-steel p-3 flex gap-4">
                <div className="h-4 w-32 bg-edge-steel/60 rounded" />
                <div className="h-4 w-20 bg-edge-steel/60 rounded" />
                <div className="h-4 w-16 bg-edge-steel/60 rounded ml-auto" />
              </div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border-b border-edge-steel/50 p-3 flex gap-4">
                  <div className="h-5 w-40 bg-edge-steel rounded" />
                  <div className="h-5 w-24 bg-edge-steel/60 rounded" />
                  <div className="h-5 w-16 bg-edge-steel rounded ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [receipt, setReceipt] = useState<ReceiptWithItems | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split modal
  const [splitItem, setSplitItem] = useState<IIReceiptItem | null>(null);

  // Duplicate comparison modal
  const [showDuplicateComparison, setShowDuplicateComparison] = useState(false);

  // Classification celebration
  const [showCelebration, setShowCelebration] = useState(false);
  const prevHadUnclassified = useRef<boolean | null>(null);

  // Editable fields
  const [merchant, setMerchant] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [totalCents, setTotalCents] = useState("");
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const supabaseRef = useRef(createBrowserClient());

  const loadReceipt = useCallback(async () => {
    const res = await fetch(`/api/receipts/${id}`);
    if (!res.ok) {
      router.push("/app/receipts");
      return;
    }
    const data = await res.json();
    setReceipt(data.receipt);
    setImageUrl(data.imageUrl);
    setImageLoaded(false); // Reset for new image
    setMerchant(data.receipt.merchant ?? "");
    setPurchaseDate(data.receipt.purchase_date ?? "");
    setTotalCents(
      data.receipt.total_cents != null
        ? (data.receipt.total_cents / 100).toFixed(2)
        : ""
    );
    setNotes(data.receipt.notes ?? "");
    setLoading(false);
    return data.receipt.status as string;
  }, [id, router]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const status = await loadReceipt();
      // Subscribe to realtime updates while receipt is pending extraction
      if (!cancelled && status === "pending") {
        const channel = supabaseRef.current
          .channel(`receipt-${id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "ii_receipts",
              filter: `id=eq.${id}`,
            },
            async (payload) => {
              if (payload.new && (payload.new as Record<string, unknown>).status !== "pending") {
                await loadReceipt();
                supabaseRef.current.removeChannel(channel);
              }
            }
          )
          .subscribe();

        return () => {
          supabaseRef.current.removeChannel(channel);
        };
      }
    }

    const cleanupPromise = init();

    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [id, loadReceipt]);

  // Detect when all items become classified and show celebration
  useEffect(() => {
    if (!receipt) return;
    const currentHasUnclassified = receipt.has_unclassified_items;

    // Show celebration when transitioning from unclassified to all classified
    if (
      prevHadUnclassified.current === true &&
      currentHasUnclassified === false
    ) {
      setShowCelebration(true);
    }

    prevHadUnclassified.current = currentHasUnclassified;
  }, [receipt]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const updates: Record<string, unknown> = {
      merchant: merchant || null,
      purchase_date: purchaseDate || null,
      total_cents: totalCents ? Math.round(parseFloat(totalCents) * 100) : null,
      notes: notes.trim() || null,
    };

    try {
      const res = await fetch(`/api/receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setReceipt((prev) => (prev ? { ...prev, ...data.receipt } : prev));
        setEditing(false);
      } else {
        setError("Failed to save changes. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setSaving(false);
  }

  async function handlePaymentSourceChange(source: string) {
    setError(null);
    try {
      const res = await fetch(`/api/receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_source: source }),
      });
      if (res.ok) {
        const data = await res.json();
        setReceipt((prev) => (prev ? { ...prev, ...data.receipt } : prev));
      } else {
        setError("Failed to update payment source.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
  }

  async function handleMarkComplete() {
    setError(null);
    try {
      const res = await fetch(`/api/receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" }),
      });
      if (res.ok) {
        const data = await res.json();
        setReceipt((prev) => (prev ? { ...prev, ...data.receipt } : prev));
      } else {
        setError("Failed to mark as complete.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
  }

  async function handleNotesSave() {
    const trimmed = notes.trim();
    if (trimmed === (receipt?.notes ?? "")) {
      setEditingNotes(false);
      return;
    }
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: trimmed || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setReceipt((prev) => (prev ? { ...prev, ...data.receipt } : prev));
      }
    } catch {
      // Silently fail — user can retry
    }
    setSavingNotes(false);
    setEditingNotes(false);
  }

  if (loading || !receipt) {
    return <ReceiptDetailSkeleton />;
  }

  const statusCfg = STATUS_LABELS[receipt.status];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/app/receipts"
            className="text-concrete hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">
              {receipt.merchant ?? "Unknown Merchant"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-concrete mt-0.5">
              <span>{formatReceiptDate(receipt.purchase_date)}</span>
              <span className={statusCfg.color}>• {statusCfg.label}</span>
              {receipt.confidence_score != null && (
                <span className="text-concrete/60">
                  • AI confidence:{" "}
                  {Math.round(receipt.confidence_score * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {receipt.status === "in_review" && (
            <button
              onClick={handleMarkComplete}
              className="flex items-center gap-1.5 text-sm bg-safe/10 text-safe hover:bg-safe/20 rounded-lg px-3 py-2 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Complete
            </button>
          )}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm text-concrete hover:text-white border border-edge-steel rounded-lg px-3 py-2 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 text-sm text-concrete hover:text-white border border-edge-steel rounded-lg px-3 py-2 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm bg-safety-orange hover:bg-safety-orange/90 text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-critical shrink-0" />
          <p className="text-sm text-critical">{error}</p>
        </div>
      )}

      {/* Pending banner */}
      {receipt.status === "pending" && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-xl p-4 mb-6">
          <Clock className="w-5 h-5 text-warn shrink-0" />
          <div>
            <p className="text-sm text-white font-medium">
              Processing receipt...
            </p>
            <p className="text-xs text-concrete mt-0.5">
              AI extraction is in progress. Line items will appear when
              complete.
            </p>
          </div>
        </div>
      )}

      {/* Needs review banner */}
      {receipt.needs_review && receipt.status !== "pending" && (
        <div className="flex items-center gap-2 bg-safety-orange/10 border border-safety-orange/20 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-safety-orange shrink-0" />
          <div>
            <p className="text-sm text-white font-medium">
              This receipt needs review
            </p>
            <p className="text-xs text-concrete mt-0.5">
              Some items have low confidence scores or are unclassified.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate alert */}
      {receipt.duplicate_of && (
        <DuplicateAlert
          duplicateOfId={receipt.duplicate_of}
          duplicateOfMerchant={receipt.merchant}
          onCompare={() => setShowDuplicateComparison(true)}
        />
      )}

      <ResizableSplitPanel
        leftPanel={
          <div className="bg-gunmetal border border-edge-steel rounded-xl overflow-hidden relative">
            {imageUrl ? (
              <>
                {/* Loading skeleton for image */}
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-edge-steel/50 animate-pulse flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-concrete/30 border-t-concrete rounded-full animate-spin" />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Receipt"
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                  className={`w-full h-auto transition-opacity duration-300 ${
                    imageLoaded ? "opacity-100" : "opacity-0"
                  }`}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-concrete/40 text-sm">
                No image available
              </div>
            )}
          </div>
        }
        rightPanel={
          <div className="space-y-6">
          {/* Receipt summary */}
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
            <h2 className="text-sm font-medium text-concrete mb-4">
              Receipt Details
            </h2>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-concrete mb-1">
                    Merchant
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs text-concrete mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs text-concrete mb-1">
                    Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={totalCents}
                    onChange={(e) => setTotalCents(e.target.value)}
                    className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs text-concrete mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Add context for your bookkeeper — e.g. 'Client dinner with Jane Smith, discussed Q2 proposal' or 'Employee team lunch for project kickoff'"
                    className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange resize-none placeholder:text-concrete/30"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-concrete">Merchant</p>
                  <p className="text-white text-sm mt-0.5">
                    {receipt.merchant ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-concrete">Date</p>
                  <p className="text-white text-sm mt-0.5">
                    {formatReceiptDate(receipt.purchase_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-concrete">Total</p>
                  <p className="text-white text-sm mt-0.5 font-mono tabular-nums font-bold">
                    {formatCentsDisplay(receipt.total_cents, receipt.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-concrete">Tax</p>
                  <p className="text-white text-sm mt-0.5 font-mono tabular-nums">
                    {formatCentsDisplay(receipt.tax_cents, receipt.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-concrete">Payment</p>
                  <p className="text-white text-sm mt-0.5 capitalize">
                    {receipt.payment_method?.replace("_", " ") ?? "—"}
                    {receipt.card_last_four
                      ? ` ••${receipt.card_last_four}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-concrete mb-1">Payment Source</p>
                  {receipt.status !== "pending" ? (
                    <div className="flex gap-1">
                      {(
                        [
                          { value: "business_funds", label: "Business" },
                          { value: "personal_funds", label: "Personal" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handlePaymentSourceChange(opt.value)}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                            receipt.payment_source === opt.value
                              ? opt.value === "business_funds"
                                ? "bg-safe/20 text-safe border-safe/40"
                                : "bg-concrete/20 text-concrete border-concrete/40"
                              : "border-transparent text-concrete/40 hover:text-concrete hover:bg-edge-steel/30"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white text-sm capitalize">
                      {receipt.payment_source.replace("_", " ")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-concrete">Notes</h2>
              {!editing && !editingNotes && receipt.notes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-concrete/40 hover:text-concrete transition-colors"
                  title="Edit note"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  autoFocus
                  placeholder="Add context for your bookkeeper — e.g. 'Client dinner with Jane Smith, discussed Q2 proposal' or 'Employee team lunch for project kickoff'"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setNotes(receipt.notes ?? "");
                      setEditingNotes(false);
                    }
                  }}
                  className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange resize-none placeholder:text-concrete/30"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-concrete/40">
                    Press Escape to cancel
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setNotes(receipt.notes ?? "");
                        setEditingNotes(false);
                      }}
                      className="text-xs text-concrete hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNotesSave}
                      disabled={savingNotes}
                      className="text-xs bg-safety-orange hover:bg-safety-orange/90 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {savingNotes ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : receipt.notes ? (
              <p className="text-sm text-white/80 whitespace-pre-wrap">
                {receipt.notes}
              </p>
            ) : !editing ? (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-sm text-concrete/40 hover:text-concrete transition-colors italic"
              >
                Add a note for your bookkeeper...
              </button>
            ) : null}
          </div>

          {/* Line items */}
          <div>
            <h2 className="text-sm font-medium text-concrete mb-3">
              Line Items ({receipt.ii_receipt_items?.length ?? 0})
            </h2>
            <ProjectCacheProvider>
              <LineItemTable
                items={receipt.ii_receipt_items ?? []}
                currency={receipt.currency}
                receiptId={receipt.id}
                editable={receipt.status !== "pending"}
                merchant={receipt.merchant}
                onItemsUpdated={(updatedItems: IIReceiptItem[]) =>
                  setReceipt((prev) =>
                    prev
                      ? { ...prev, ii_receipt_items: updatedItems }
                      : prev
                  )
                }
                onReceiptUpdated={(updatedReceipt) =>
                  setReceipt((prev) =>
                    prev
                      ? { ...prev, ...updatedReceipt }
                      : prev
                  )
                }
                onSplitItem={(item) => setSplitItem(item)}
              />
            </ProjectCacheProvider>
          </div>
          </div>
        }
      />

      {/* Split item modal */}
      {splitItem && (
        <SplitItemModal
          item={splitItem}
          receiptId={receipt.id}
          currency={receipt.currency}
          onComplete={(updatedItems: IIReceiptItem[], updatedReceipt: IIReceipt) => {
            setReceipt((prev) =>
              prev
                ? { ...prev, ...updatedReceipt, ii_receipt_items: updatedItems }
                : prev
            );
            setSplitItem(null);
          }}
          onClose={() => setSplitItem(null)}
        />
      )}

      {/* Duplicate comparison modal */}
      {showDuplicateComparison && receipt.duplicate_of && (
        <DuplicateComparison
          currentReceipt={receipt}
          duplicateOfId={receipt.duplicate_of}
          onResolve={() => {
            setShowDuplicateComparison(false);
            loadReceipt();
          }}
          onClose={() => setShowDuplicateComparison(false)}
        />
      )}

      {/* Classification complete celebration */}
      {showCelebration && (
        <ClassificationComplete onDismiss={() => setShowCelebration(false)} />
      )}
    </div>
  );
}

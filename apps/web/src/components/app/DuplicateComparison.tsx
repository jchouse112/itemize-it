"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle, Copy, Trash2 } from "lucide-react";
import type { IIReceipt } from "@/lib/ii-types";
import { formatCentsDisplay, formatReceiptDate } from "@/lib/ii-utils";

type Resolution = "keep_both" | "keep_current" | "keep_original";

interface DuplicateComparisonProps {
  currentReceipt: IIReceipt;
  duplicateOfId: string;
  onResolve: (resolution: Resolution) => void;
  onClose: () => void;
}

export default function DuplicateComparison({
  currentReceipt,
  duplicateOfId,
  onResolve,
  onClose,
}: DuplicateComparisonProps) {
  const [original, setOriginal] = useState<IIReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOriginal() {
      try {
        const res = await fetch(`/api/receipts/${duplicateOfId}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setError("Could not load the original receipt.");
          return;
        }
        const data = await res.json();
        setOriginal(data.receipt);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Network error loading original receipt.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadOriginal();
    return () => controller.abort();
  }, [duplicateOfId]);

  async function handleResolve(resolution: Resolution) {
    setResolving(true);
    setError(null);
    try {
      const res = await fetch(`/api/receipts/${currentReceipt.id}/resolve-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, duplicate_of: duplicateOfId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to resolve duplicate.");
        return;
      }

      onResolve(resolution);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gunmetal border border-edge-steel rounded-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Compare Receipts
          </h2>
          <button
            onClick={onClose}
            className="text-concrete hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-safety-orange animate-spin" />
          </div>
        ) : error && !original ? (
          <div className="bg-critical/10 border border-critical/20 rounded-lg p-4 text-sm text-critical">
            {error}
          </div>
        ) : (
          <>
            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Current receipt */}
              <ReceiptSummaryCard
                label="This Receipt"
                receipt={currentReceipt}
                highlight
              />

              {/* Original receipt */}
              {original && (
                <ReceiptSummaryCard
                  label="Existing Receipt"
                  receipt={original}
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
                {error}
              </div>
            )}

            {/* Resolution actions */}
            <div className="space-y-2">
              <p className="text-xs text-concrete mb-2">How would you like to resolve this?</p>

              <button
                onClick={() => handleResolve("keep_both")}
                disabled={resolving}
                className="w-full flex items-center gap-3 bg-asphalt border border-edge-steel rounded-lg px-4 py-3 hover:border-safe/40 transition-colors group disabled:opacity-50"
              >
                <Copy className="w-4 h-4 text-concrete group-hover:text-safe transition-colors" />
                <div className="text-left">
                  <p className="text-sm text-white font-medium">Keep both</p>
                  <p className="text-xs text-concrete">
                    These are different receipts — clear the duplicate flag
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleResolve("keep_current")}
                disabled={resolving}
                className="w-full flex items-center gap-3 bg-asphalt border border-edge-steel rounded-lg px-4 py-3 hover:border-safety-orange/40 transition-colors group disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 text-concrete group-hover:text-safety-orange transition-colors" />
                <div className="text-left">
                  <p className="text-sm text-white font-medium">
                    Keep this one, archive the original
                  </p>
                  <p className="text-xs text-concrete">
                    This is the correct version
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleResolve("keep_original")}
                disabled={resolving}
                className="w-full flex items-center gap-3 bg-asphalt border border-edge-steel rounded-lg px-4 py-3 hover:border-critical/40 transition-colors group disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 text-concrete group-hover:text-critical transition-colors" />
                <div className="text-left">
                  <p className="text-sm text-white font-medium">
                    This is the duplicate — archive it
                  </p>
                  <p className="text-xs text-concrete">
                    Keep the original receipt instead
                  </p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReceiptSummaryCard({
  label,
  receipt,
  highlight,
}: {
  label: string;
  receipt: IIReceipt;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-asphalt border rounded-lg p-4 ${
        highlight ? "border-safety-orange/30" : "border-edge-steel"
      }`}
    >
      <p
        className={`text-[10px] font-medium uppercase tracking-wider mb-2 ${
          highlight ? "text-safety-orange" : "text-concrete"
        }`}
      >
        {label}
      </p>
      <div className="space-y-2">
        <Row label="Merchant" value={receipt.merchant ?? "—"} />
        <Row label="Date" value={formatReceiptDate(receipt.purchase_date)} />
        <Row
          label="Total"
          value={formatCentsDisplay(receipt.total_cents, receipt.currency)}
          mono
        />
        <Row
          label="Tax"
          value={formatCentsDisplay(receipt.tax_cents, receipt.currency)}
          mono
        />
        <Row label="Status" value={receipt.status} />
        <Row
          label="Created"
          value={formatReceiptDate(receipt.created_at?.split("T")[0] ?? null)}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-concrete">{label}</span>
      <span
        className={`text-xs text-white ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

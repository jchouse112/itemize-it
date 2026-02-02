"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2, Loader2, Scissors } from "lucide-react";
import type { IIReceiptItem, IIReceipt, Classification } from "@/lib/ii-types";
import { formatCents, splitRemainder, validateSplitAmounts } from "@/lib/ii-utils";
import type { SplitRow } from "@/lib/ii-utils";
import ClassificationToggle from "./ClassificationToggle";

interface SplitItemModalProps {
  item: IIReceiptItem;
  receiptId: string;
  currency: string;
  onComplete: (items: IIReceiptItem[], receipt: IIReceipt) => void;
  onClose: () => void;
}

function makeRow(classification: Classification = "unclassified"): SplitRow & { key: number } {
  return { amountCents: 0, classification, key: Date.now() + Math.random() };
}

export default function SplitItemModal({
  item,
  receiptId,
  currency,
  onComplete,
  onClose,
}: SplitItemModalProps) {
  const originalCents = item.total_price_cents;
  const [rows, setRows] = useState<(SplitRow & { key: number })[]>(() => [
    { amountCents: Math.ceil(originalCents / 2), classification: "business", key: 1 },
    { amountCents: Math.floor(originalCents / 2), classification: "personal", key: 2 },
  ]);
  const [taxMethod, setTaxMethod] = useState<"prorated" | "manual">("prorated");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainder = useMemo(
    () => splitRemainder(originalCents, rows.map((r) => r.amountCents)),
    [originalCents, rows]
  );

  const validationError = useMemo(
    () => validateSplitAmounts(originalCents, rows),
    [originalCents, rows]
  );

  function updateRow(index: number, patch: Partial<SplitRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function addRow() {
    if (rows.length >= 10) return;
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(index: number) {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  /** Auto-fill the last row with the remainder */
  function autoFillLast() {
    if (rows.length < 2) return;
    const allButLast = rows.slice(0, -1).reduce((s, r) => s + r.amountCents, 0);
    const lastAmount = originalCents - allButLast;
    if (lastAmount > 0) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === prev.length - 1 ? { ...r, amountCents: lastAmount } : r
        )
      );
    }
  }

  async function handleSplit() {
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/receipts/${receiptId}/items/${item.id}/split`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: rows.map((r) => ({
              amount_cents: r.amountCents,
              classification: r.classification,
              label: r.label,
            })),
            tax_method: taxMethod,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to split item.");
        return;
      }

      const data = await res.json();
      onComplete(data.items, data.receipt);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gunmetal border border-edge-steel rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-safety-orange/10 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-safety-orange" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Split Item</h2>
              <p className="text-xs text-concrete">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-concrete hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Original amount */}
        <div className="bg-asphalt border border-edge-steel rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-concrete">Original Amount</span>
            <span className="font-mono tabular-nums text-white font-bold">
              {formatCents(originalCents, currency)}
            </span>
          </div>
          {item.tax_cents != null && item.tax_cents > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-concrete">Tax included</span>
              <span className="font-mono tabular-nums text-concrete text-xs">
                {formatCents(item.tax_cents, currency)}
              </span>
            </div>
          )}
        </div>

        {/* Tax method */}
        {item.tax_cents != null && item.tax_cents > 0 && (
          <div className="mb-4">
            <label className="text-xs text-concrete mb-1 block">Tax Handling</label>
            <div className="flex gap-2">
              {(["prorated", "manual"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTaxMethod(m)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    taxMethod === m
                      ? "border-safety-orange/40 bg-safety-orange/10 text-safety-orange"
                      : "border-edge-steel text-concrete hover:text-white"
                  }`}
                >
                  {m === "prorated" ? "Prorate proportionally" : "Enter manually"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Split rows */}
        <div className="space-y-3 mb-4">
          {rows.map((row, i) => (
            <div
              key={row.key}
              className="bg-asphalt border border-edge-steel rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-concrete font-medium">
                  Row {i + 1}
                </span>
                {rows.length > 2 && (
                  <button
                    onClick={() => removeRow(i)}
                    className="text-concrete/40 hover:text-critical transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Amount input */}
                <div className="flex-1">
                  <label className="text-[10px] text-concrete block mb-0.5">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-concrete text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={row.amountCents > 0 ? (row.amountCents / 100).toFixed(2) : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cents = val ? Math.round(parseFloat(val) * 100) : 0;
                        updateRow(i, { amountCents: cents });
                      }}
                      className="w-full bg-gunmetal border border-edge-steel rounded-lg pl-7 pr-3 py-1.5 text-white text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
                    />
                  </div>
                </div>

                {/* Classification */}
                <div>
                  <label className="text-[10px] text-concrete block mb-0.5">
                    Type
                  </label>
                  <ClassificationToggle
                    value={row.classification}
                    onChange={(v: Classification) =>
                      updateRow(i, { classification: v })
                    }
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add row + auto-fill */}
        <div className="flex items-center gap-2 mb-4">
          {rows.length < 10 && (
            <button
              onClick={addRow}
              className="flex items-center gap-1 text-xs text-concrete hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add row
            </button>
          )}
          {remainder > 0 && (
            <button
              onClick={autoFillLast}
              className="text-xs text-safety-orange hover:text-safety-orange/80 transition-colors ml-auto"
            >
              Auto-fill last row ({formatCents(remainder, currency)} remaining)
            </button>
          )}
        </div>

        {/* Remainder indicator */}
        <div
          className={`flex items-center justify-between rounded-lg px-3 py-2 mb-4 text-sm ${
            remainder === 0
              ? "bg-safe/10 text-safe"
              : "bg-critical/10 text-critical"
          }`}
        >
          <span>Remainder</span>
          <span className="font-mono tabular-nums font-bold">
            {formatCents(remainder, currency)}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-concrete hover:text-white border border-edge-steel rounded-lg px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={saving || validationError !== null}
            className="flex items-center gap-1.5 text-sm bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Scissors className="w-4 h-4" />
            )}
            Split into {rows.length} items
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X, Plus, Loader2, DollarSign } from "lucide-react";
import type { Classification, PaymentMethod } from "@/lib/ii-types";
import ClassificationToggle from "./ClassificationToggle";

interface AddExpenseModalProps {
  projectId: string;
  currency: string;
  onComplete: () => void;
  onClose: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

export default function AddExpenseModal({
  projectId,
  currency,
  onComplete,
  onClose,
}: AddExpenseModalProps) {
  const [name, setName] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [merchant, setMerchant] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [classification, setClassification] =
    useState<Classification>("business");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round((parseFloat(amountDollars) || 0) * 100);
  const isValid = name.trim().length > 0 && amountCents > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount_cents: amountCents,
          merchant: merchant.trim() || null,
          purchase_date: purchaseDate || null,
          classification,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add expense.");
        return;
      }

      onComplete();
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gunmetal border border-edge-steel rounded-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-edge-steel">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-safety-orange/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-safety-orange" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Add Expense</h2>
              <p className="text-xs text-concrete">
                Manual entry for cash or lost receipts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-concrete hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Item name */}
          <div>
            <label className="block text-sm font-medium text-concrete mb-1.5">
              Item / Description <span className="text-critical">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lumber, Paint, Hardware"
              className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
              autoFocus
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-concrete mb-1.5">
              Amount ({currency}) <span className="text-critical">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              placeholder="0.00"
              className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
            />
          </div>

          {/* Merchant and Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-concrete mb-1.5">
                Merchant
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="Store name"
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-concrete mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
              />
            </div>
          </div>

          {/* Classification */}
          <div>
            <label className="block text-sm font-medium text-concrete mb-1.5">
              Classification
            </label>
            <ClassificationToggle
              value={classification}
              onChange={setClassification}
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-concrete mb-1.5">
              Payment Method
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setPaymentMethod(pm.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    paymentMethod === pm.value
                      ? "bg-safety-orange/10 border-safety-orange text-safety-orange"
                      : "border-edge-steel text-concrete hover:text-white hover:border-concrete/50"
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-concrete mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this expense..."
              rows={2}
              className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-concrete hover:text-white border border-edge-steel rounded-lg px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !isValid}
              className="flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, Loader2, DollarSign } from "lucide-react";
import type { Classification, PaymentMethod, ExpenseType, LabourType } from "@/lib/ii-types";
import type { IIProject } from "@/lib/ii-types";
import ClassificationToggle from "./ClassificationToggle";
import ExpenseTypeSelector from "./ExpenseTypeSelector";

interface AddExpenseModalProps {
  projectId: string;
  currency: string;
  onComplete: () => void;
  onClose: () => void;
}

interface Allocation {
  key: number;
  projectId: string;
  amountDollars: string;
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
  const [expenseType, setExpenseType] = useState<ExpenseType>("material");
  const [labourType, setLabourType] = useState<LabourType>("employee");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [taxExempt, setTaxExempt] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-project allocation (labour only)
  const [projects, setProjects] = useState<IIProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([
    { key: 1, projectId: projectId, amountDollars: "" },
  ]);
  const useAllocations = classification === "business" && expenseType === "labour" && allocations.length >= 2;

  // Fetch projects when labour is selected
  useEffect(() => {
    if (classification === "business" && expenseType === "labour" && !projectsLoaded) {
      fetch("/api/projects")
        .then((r) => r.json())
        .then((data) => {
          setProjects(
            (data.projects ?? []).filter((p: IIProject) => p.status === "active")
          );
          setProjectsLoaded(true);
        })
        .catch(() => setProjectsLoaded(true));
    }
  }, [classification, expenseType, projectsLoaded]);

  // Sync first allocation amount with total when single row
  useEffect(() => {
    if (allocations.length === 1) {
      setAllocations((prev) => [{ ...prev[0], amountDollars }]);
    }
  }, [amountDollars, allocations.length]);

  const amountCents = Math.round((parseFloat(amountDollars) || 0) * 100);

  const allocTotalCents = useMemo(
    () => allocations.reduce((s, a) => s + Math.round((parseFloat(a.amountDollars) || 0) * 100), 0),
    [allocations]
  );
  const allocRemainder = amountCents - allocTotalCents;

  const allocValid = !useAllocations || (
    allocRemainder === 0 &&
    allocations.every((a) => a.projectId && Math.round((parseFloat(a.amountDollars) || 0) * 100) > 0)
  );

  const isValid = name.trim().length > 0 && amountCents > 0 && allocValid;

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
          expense_type: classification === "business" ? expenseType : undefined,
          labour_type: classification === "business" && expenseType === "labour" ? labourType : null,
          tax_exempt: classification === "business" && expenseType === "material" ? taxExempt : undefined,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
          ...(useAllocations
            ? {
                allocations: allocations.map((a) => ({
                  project_id: a.projectId,
                  amount_cents: Math.round((parseFloat(a.amountDollars) || 0) * 100),
                })),
              }
            : {}),
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

  function addAllocation() {
    if (allocations.length >= 10) return;
    setAllocations((prev) => [...prev, { key: Date.now(), projectId: "", amountDollars: "" }]);
  }

  function removeAllocation(index: number) {
    if (allocations.length <= 1) return;
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAllocation(index: number, patch: Partial<Allocation>) {
    setAllocations((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function autoFillLastAllocation() {
    if (allocations.length < 2 || allocRemainder <= 0) return;
    const lastIdx = allocations.length - 1;
    const currentLast = Math.round((parseFloat(allocations[lastIdx].amountDollars) || 0) * 100);
    const newAmount = currentLast + allocRemainder;
    updateAllocation(lastIdx, { amountDollars: (newAmount / 100).toFixed(2) });
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
            {classification === "business" && expenseType === "labour" && labourType === "employee" && (
              <p className="text-[11px] text-concrete/60 mt-1.5 leading-relaxed">
                Enter the total loaded cost (wages + EI + CPP + WSIB).
              </p>
            )}
            {classification === "business" && expenseType === "labour" && labourType === "subcontractor" && (
              <p className="text-[11px] text-concrete/60 mt-1.5 leading-relaxed">
                Enter the invoice total incl. HST.
              </p>
            )}
            {classification === "business" && expenseType === "material" && (
              <p className="text-[11px] text-concrete/60 mt-1.5 leading-relaxed">
                {taxExempt
                  ? "Enter the total amount paid (no tax applied)."
                  : "Enter the total amount paid incl. taxes."}
              </p>
            )}
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

          {/* Expense Type (only for business) */}
          {classification === "business" && (
            <div>
              <label className="block text-sm font-medium text-concrete mb-1.5">
                Expense Type
              </label>
              <ExpenseTypeSelector
                value={expenseType}
                onChange={(v) => {
                  setExpenseType(v);
                  if (v !== "material") setTaxExempt(false);
                }}
                disabled={saving}
              />
            </div>
          )}

          {/* Tax Exempt (only for business + material) */}
          {classification === "business" && expenseType === "material" && (
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={taxExempt}
                onChange={(e) => setTaxExempt(e.target.checked)}
                disabled={saving}
                className="w-4 h-4 rounded border-edge-steel bg-asphalt text-safety-orange focus:ring-safety-orange/50 focus:ring-2 accent-safety-orange"
              />
              <span className="text-sm text-concrete group-hover:text-white transition-colors">
                Tax exempt (no HST/GST/PST)
              </span>
            </label>
          )}

          {/* Labour Type (only when labour selected) */}
          {classification === "business" && expenseType === "labour" && (
            <div>
              <label className="block text-sm font-medium text-concrete mb-1.5">
                Worker Type
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "employee", label: "Employee" },
                    { value: "subcontractor", label: "Sub-contractor" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={saving}
                    onClick={() => setLabourType(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      labourType === opt.value
                        ? "bg-blue-500/10 border-blue-500 text-blue-400"
                        : "border-edge-steel text-concrete hover:text-white hover:border-concrete/50"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Project Allocation (labour only) */}
          {classification === "business" && expenseType === "labour" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-concrete">
                Project Allocation
              </label>

              {allocations.map((alloc, idx) => (
                <div key={alloc.key} className="flex items-center gap-2">
                  <select
                    value={alloc.projectId}
                    onChange={(e) => updateAllocation(idx, { projectId: e.target.value })}
                    disabled={saving}
                    className="flex-1 min-w-0 bg-asphalt border border-edge-steel rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-40"
                  >
                    <option value="">Select project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-concrete/50 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={alloc.amountDollars}
                      onChange={(e) => updateAllocation(idx, { amountDollars: e.target.value })}
                      disabled={saving || allocations.length < 2}
                      placeholder="0.00"
                      className="w-full bg-asphalt border border-edge-steel rounded-lg pl-5 pr-2 py-1.5 text-white text-xs font-mono tabular-nums placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-40"
                    />
                  </div>
                  {allocations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAllocation(idx)}
                      disabled={saving}
                      className="text-concrete hover:text-critical transition-colors disabled:opacity-40"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add row + auto-fill + remainder */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={addAllocation}
                  disabled={saving || allocations.length >= 10 || !projectsLoaded}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add project
                </button>

                {allocations.length >= 2 && (
                  <div className="flex items-center gap-2">
                    {allocRemainder > 0 && (
                      <button
                        type="button"
                        onClick={autoFillLastAllocation}
                        disabled={saving}
                        className="text-[11px] text-blue-400 hover:text-blue-300 underline transition-colors"
                      >
                        Auto-fill last
                      </button>
                    )}
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        allocRemainder === 0
                          ? "text-safe"
                          : "text-critical"
                      }`}
                    >
                      {allocRemainder === 0
                        ? "✓ Balanced"
                        : allocRemainder > 0
                          ? `$${(allocRemainder / 100).toFixed(2)} remaining`
                          : `$${(Math.abs(allocRemainder) / 100).toFixed(2)} over`}
                    </span>
                  </div>
                )}
              </div>

              {!projectsLoaded && (
                <p className="text-[11px] text-concrete/50 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading projects…
                </p>
              )}
            </div>
          )}

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


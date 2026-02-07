"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { IIReceiptItem, IIReceipt, Classification, ExpenseType } from "@/lib/ii-types";
import { formatCentsDisplay } from "@/lib/ii-utils";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Sparkles, X, Scissors, GitBranch, Shield, ShieldCheck, ShieldAlert, ShieldQuestion, ShieldBan, ShieldOff } from "lucide-react";
import type { WarrantyLookupStatus } from "@/lib/ii-types";
import ClassificationToggle from "./ClassificationToggle";
import ExpenseTypeDropdown from "./ExpenseTypeDropdown";
import ProjectSelector from "./ProjectSelector";

const DEBOUNCE_MS = 300;

interface RuleSuggestion {
  classification: Classification;
  merchant: string | null;
  itemName: string;
}

interface ToastState {
  type: "success" | "error" | "info";
  message: string;
}

interface WarrantyCheckResponse {
  item?: Partial<IIReceiptItem> & { id: string };
  cached?: boolean;
  warranty_found?: boolean;
  error?: string;
}

interface LineItemTableProps {
  items: IIReceiptItem[];
  currency: string;
  receiptId?: string;
  editable?: boolean;
  merchant?: string | null;
  onItemsUpdated?: (items: IIReceiptItem[]) => void;
  onReceiptUpdated?: (receipt: IIReceipt) => void;
  onSplitItem?: (item: IIReceiptItem) => void;
}

export default function LineItemTable({
  items,
  currency,
  receiptId,
  editable = false,
  merchant,
  onItemsUpdated,
  onReceiptUpdated,
  onSplitItem,
}: LineItemTableProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [checkingWarrantyId, setCheckingWarrantyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clear all pending debounce timers on unmount to prevent firing against
  // stale state or leaking memory when the component is removed mid-edit.
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
      debounceTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const flushUpdate = useCallback(
    async (itemId: string, field: string, value: string | boolean | null) => {
      if (!receiptId) return;
      setSaving(itemId);
      try {
        const res = await fetch(`/api/receipts/${receiptId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ id: itemId, [field]: value }],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          onItemsUpdated?.(data.items);
          if (data.receipt) {
            onReceiptUpdated?.(data.receipt);
          }
          // Suggest creating a rule when user manually classifies
          if (field === "classification" && value && value !== "unclassified") {
            const item = items.find((i) => i.id === itemId);
            if (item && !item.classified_by?.startsWith("rule:")) {
              setRuleSuggestion({
                classification: value as Classification,
                merchant: merchant ?? null,
                itemName: item.name,
              });
            }
          }
        }
      } finally {
        setSaving(null);
      }
    },
    [receiptId, items, merchant, onItemsUpdated, onReceiptUpdated]
  );

  function updateItem(itemId: string, field: string, value: string | boolean | null) {
    // Debounce rapid toggles on the same item+field
    const key = `${itemId}:${field}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);

    debounceTimers.current.set(
      key,
      setTimeout(() => {
        debounceTimers.current.delete(key);
        flushUpdate(itemId, field, value);
      }, DEBOUNCE_MS)
    );
  }

  const handleCreateRule = useCallback(async (type: "merchant" | "keyword") => {
    if (!ruleSuggestion) return;
    setCreatingRule(true);
    try {
      const matchValue = type === "merchant"
        ? ruleSuggestion.merchant ?? ""
        : ruleSuggestion.itemName;
      if (!matchValue) return;

      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_type: type === "merchant" ? "merchant_contains" : "keyword",
          match_value: matchValue,
          classification: ruleSuggestion.classification,
        }),
      });
      setRuleSuggestion(null);
    } finally {
      setCreatingRule(false);
    }
  }, [ruleSuggestion]);

  const handleCheckWarranty = useCallback(async (item: IIReceiptItem) => {
    if (!receiptId) return;
    setCheckingWarrantyId(item.id);
    try {
      const shouldForce =
        item.warranty_lookup_status === "found" ||
        item.warranty_lookup_status === "not_found";
      const res = await fetch(
        `/api/receipts/${receiptId}/items/${item.id}/warranty-check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: shouldForce }),
        }
      );
      let data: WarrantyCheckResponse | null = null;
      try {
        data = (await res.json()) as WarrantyCheckResponse;
      } catch {
        data = null;
      }
      const updatedItem = data?.item;
      if (updatedItem) {
        onItemsUpdated?.(
          items.map((existing) =>
            existing.id === updatedItem.id ? { ...existing, ...updatedItem } : existing
          )
        );
      }
      if (!res.ok) {
        const message =
          typeof data?.error === "string" && data.error.length > 0
            ? data.error
            : "Warranty check failed. Please try again.";
        setToast({ type: "error", message });
        return;
      }

      if (data?.cached === true) {
        setToast({
          type: "info",
          message: "Using recent cached warranty result.",
        });
        return;
      }

      if (data?.warranty_found === true) {
        setToast({
          type: "success",
          message: "Warranty found and added to Lifecycle tracking.",
        });
      } else {
        setToast({
          type: "info",
          message: "No warranty coverage found for this item.",
        });
      }
    } catch {
      setToast({
        type: "error",
        message: "Network error while checking warranty.",
      });
    } finally {
      setCheckingWarrantyId(null);
    }
  }, [items, onItemsUpdated, receiptId]);

  function getWarrantyStatusConfig(status: IIReceiptItem["warranty_lookup_status"]) {
    switch (status) {
      case "found":
        return { label: "Found", className: "bg-safe/10 text-safe" };
      case "in_progress":
        return { label: "Checking", className: "bg-safety-orange/10 text-safety-orange" };
      case "not_found":
        return { label: "Not Found", className: "bg-edge-steel text-concrete" };
      case "error":
        return { label: "Error", className: "bg-critical/10 text-critical" };
      case "not_eligible":
        return { label: "Hidden", className: "bg-edge-steel/60 text-concrete/80" };
      default:
        return { label: "Needs Check", className: "bg-warn/10 text-warn" };
    }
  }

  function getWarrantyIcon(status: WarrantyLookupStatus, isChecking: boolean) {
    if (isChecking) {
      return { Icon: Loader2, className: "text-safety-orange animate-spin" };
    }
    switch (status) {
      case "found":
        return { Icon: ShieldCheck, className: "text-safe" };
      case "in_progress":
        return { Icon: Loader2, className: "text-safety-orange animate-spin" };
      case "not_found":
        return { Icon: ShieldAlert, className: "text-concrete/40" };
      case "error":
        return { Icon: ShieldBan, className: "text-critical" };
      case "not_eligible":
        return { Icon: ShieldOff, className: "text-concrete/30" };
      default: // "unknown"
        return { Icon: ShieldQuestion, className: "text-concrete/40" };
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-gunmetal border border-edge-steel rounded-xl p-8 text-center">
        <p className="text-concrete text-sm">No line items extracted yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Rule suggestion banner */}
      {ruleSuggestion && (
        <div className="flex items-center gap-2 bg-safety-orange/5 border border-safety-orange/20 rounded-lg px-3 py-2 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-safety-orange shrink-0" />
          <span className="text-concrete">
            Always classify{" "}
            {ruleSuggestion.merchant ? (
              <span className="text-white font-medium">{ruleSuggestion.merchant}</span>
            ) : (
              <span className="text-white font-medium">&ldquo;{ruleSuggestion.itemName}&rdquo;</span>
            )}{" "}
            as <span className="text-white font-medium">{ruleSuggestion.classification}</span>?
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {ruleSuggestion.merchant && (
              <button
                onClick={() => handleCreateRule("merchant")}
                disabled={creatingRule}
                title={`Apply to ALL items from "${ruleSuggestion.merchant}"`}
                className="text-safety-orange hover:text-safety-orange/80 font-medium disabled:opacity-50"
              >
                {creatingRule ? "Saving..." : "Create merchant rule"}
              </button>
            )}
            {ruleSuggestion.merchant && <span className="text-concrete/40">|</span>}
            <button
              onClick={() => handleCreateRule("keyword")}
              disabled={creatingRule}
              title={`Apply to items containing "${ruleSuggestion.itemName}"`}
              className="text-safety-orange hover:text-safety-orange/80 font-medium disabled:opacity-50"
            >
              {creatingRule ? "Saving..." : "Create keyword rule"}
            </button>
            <button
              onClick={() => setRuleSuggestion(null)}
              className="text-concrete/40 hover:text-concrete ml-1"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    <div className="bg-gunmetal border border-edge-steel rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-edge-steel">
            <th className="text-left text-concrete font-medium px-4 py-3">
              Item
            </th>
            <th className="text-left text-concrete font-medium px-4 py-3">
              Class
            </th>
            {editable && (
              <th className="text-left text-concrete font-medium px-2 py-3 hidden lg:table-cell">
                Type
              </th>
            )}
            {editable && (
              <th className="text-left text-concrete font-medium px-4 py-3 hidden md:table-cell">
                Project
              </th>
            )}
            <th className="text-left text-concrete font-medium px-4 py-3 hidden lg:table-cell">
              Warranty
            </th>
            <th className="text-right text-concrete font-medium px-4 py-3">
              Amount
            </th>
            {editable && onSplitItem && (
              <th className="text-right text-concrete font-medium px-4 py-3 w-10">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items
            .filter((item) => !item.is_split_original)
            .map((item) => {
            const isSaving = saving === item.id;
            const isCheckingWarranty = checkingWarrantyId === item.id;
            const isSplitChild = !!item.parent_item_id;
            const canSplit = editable && !isSplitChild && !item.is_split_original;
            const warrantyStatusCfg = getWarrantyStatusConfig(item.warranty_lookup_status);
            return (
              <tr
                key={item.id}
                className={`border-b border-edge-steel/50 last:border-0 hover:bg-edge-steel/20 transition-colors ${
                  isSplitChild ? "bg-safety-orange/[0.02]" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {isSplitChild && (
                      <GitBranch className="w-3 h-3 text-safety-orange/60 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-concrete/60 text-xs font-mono tabular-nums">
                          {item.quantity}x
                        </span>
                        <span className={`text-white font-medium ${
                          item.classification_confidence != null && item.classification_confidence < 0.7
                            ? "underline decoration-critical decoration-wavy decoration-1 underline-offset-2"
                            : ""
                        }`}>
                          {item.name}
                        </span>
                      </div>
                      {item.description && (
                        <div className="text-concrete text-xs mt-0.5 truncate max-w-[250px]">
                          {item.description}
                        </div>
                      )}
                      {isSplitChild && item.split_ratio != null && (
                        <div className="text-safety-orange/60 text-[10px] mt-0.5">
                          Split — {Math.round(item.split_ratio * 100)}% of original
                        </div>
                      )}
                      {item.needs_review && (
                        <div className="flex items-center gap-1 text-warn text-xs mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          {item.review_reasons?.join(", ")}
                        </div>
                      )}
                      {item.tax_calculation_method === "exempt" && (
                        editable ? (
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, "tax_exempt", false)}
                            disabled={isSaving}
                            className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                          >
                            Tax Exempt
                          </button>
                        ) : (
                          <span className="mt-0.5 inline-block text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Tax Exempt
                          </span>
                        )
                      )}
                      {editable && item.classification === "business" && item.expense_type === "material" && item.tax_calculation_method !== "exempt" && (
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, "tax_exempt", true)}
                          disabled={isSaving}
                          className="mt-0.5 text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded text-concrete/30 border border-transparent hover:text-amber-400/60 hover:border-amber-500/20 hover:bg-amber-500/5 transition-colors disabled:opacity-50"
                        >
                          + Tax Exempt
                        </button>
                      )}
                    </div>
                  </div>
                  {editable && item.warranty_lookup_status !== "not_eligible" && (
                    <button
                      type="button"
                      onClick={() => handleCheckWarranty(item)}
                      disabled={isCheckingWarranty}
                      className="lg:hidden mt-1 text-[11px] text-safety-orange hover:text-safety-orange/80 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {isCheckingWarranty ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Checking warranty
                        </>
                      ) : (
                        <>
                          <Shield className="w-3 h-3" />
                          Check warranty
                        </>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <ClassificationToggle
                        value={item.classification}
                        onChange={(v: Classification) =>
                          updateItem(item.id, "classification", v)
                        }
                        disabled={isSaving}
                      />
                      {isSaving && (
                        <Loader2 className="w-3 h-3 text-concrete animate-spin" />
                      )}
                    </div>
                  ) : (
                    <ClassificationBadge value={item.classification} />
                  )}
                </td>
                {editable && (
                  <td className="px-2 py-3 hidden lg:table-cell">
                    {item.classification === "business" ? (
                      <ExpenseTypeDropdown
                        value={item.expense_type ?? "material"}
                        onChange={(v: ExpenseType) =>
                          updateItem(item.id, "expense_type", v)
                        }
                        disabled={isSaving}
                      />
                    ) : (
                      <span className="text-concrete/30 text-xs">—</span>
                    )}
                  </td>
                )}
                {editable && (
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="max-w-[140px]">
                      <ProjectSelector
                        value={item.project_id}
                        onChange={(projectId) =>
                          updateItem(item.id, "project_id", projectId)
                        }
                        disabled={isSaving}
                      />
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 hidden lg:table-cell">
                  {item.warranty_lookup_status !== "not_eligible" && (() => {
                    const { Icon, className: iconClass } = getWarrantyIcon(
                      item.warranty_lookup_status,
                      isCheckingWarranty
                    );
                    return editable ? (
                      <button
                        type="button"
                        onClick={() => handleCheckWarranty(item)}
                        disabled={isCheckingWarranty}
                        title={warrantyStatusCfg.label}
                        className={`${iconClass} hover:opacity-80 transition-colors disabled:opacity-50`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className={iconClass} title={warrantyStatusCfg.label}>
                        <Icon className="w-4 h-4" />
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                  {formatCentsDisplay(item.total_price_cents, currency)}
                </td>
                {editable && onSplitItem && (
                  <td className="px-4 py-3 text-right">
                    {canSplit && (
                      <button
                        onClick={() => onSplitItem(item)}
                        title="Split item"
                        className="text-concrete/40 hover:text-safety-orange transition-colors"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {toast && (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div
          className={`border rounded-lg px-3 py-2 text-sm shadow-lg flex items-start gap-2 ${
            toast.type === "success"
              ? "bg-safe/10 border-safe/30 text-safe"
              : toast.type === "error"
                ? "bg-critical/10 border-critical/30 text-critical"
                : "bg-edge-steel border-edge-steel text-concrete"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <Shield className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      </div>
    )}
    </div>
  );
}

function ClassificationBadge({ value }: { value: Classification }) {
  const config: Record<Classification, { label: string; className: string }> = {
    business: { label: "Business", className: "bg-safe/10 text-safe" },
    personal: { label: "Personal", className: "bg-edge-steel text-concrete" },
    unclassified: {
      label: "Unclassified",
      className: "bg-warn/10 text-warn",
    },
  };
  const badge = config[value];
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded ${badge.className}`}>
      {badge.label}
    </span>
  );
}

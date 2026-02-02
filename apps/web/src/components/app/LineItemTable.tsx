"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { IIReceiptItem, IIReceipt, Classification } from "@/lib/ii-types";
import { formatCentsDisplay } from "@/lib/ii-utils";
import { AlertTriangle, Loader2, Sparkles, X, Scissors, GitBranch } from "lucide-react";
import ClassificationToggle from "./ClassificationToggle";
import ProjectSelector from "./ProjectSelector";

const DEBOUNCE_MS = 300;

interface RuleSuggestion {
  classification: Classification;
  merchant: string | null;
  itemName: string;
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

  const flushUpdate = useCallback(
    async (itemId: string, field: string, value: string | null) => {
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

  function updateItem(itemId: string, field: string, value: string | null) {
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
                className="text-safety-orange hover:text-safety-orange/80 font-medium disabled:opacity-50"
              >
                {creatingRule ? "Saving..." : "Create merchant rule"}
              </button>
            )}
            {ruleSuggestion.merchant && <span className="text-concrete/40">|</span>}
            <button
              onClick={() => handleCreateRule("keyword")}
              disabled={creatingRule}
              className="text-safety-orange hover:text-safety-orange/80 font-medium disabled:opacity-50"
            >
              {creatingRule ? "Saving..." : "Create keyword rule"}
            </button>
            <button
              onClick={() => setRuleSuggestion(null)}
              className="text-concrete/40 hover:text-concrete ml-1"
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
            <th className="text-left text-concrete font-medium px-4 py-3 hidden sm:table-cell">
              Qty
            </th>
            <th className="text-left text-concrete font-medium px-4 py-3">
              Classification
            </th>
            {editable && (
              <th className="text-left text-concrete font-medium px-4 py-3 hidden md:table-cell">
                Project
              </th>
            )}
            <th className="text-right text-concrete font-medium px-4 py-3 hidden sm:table-cell">
              Confidence
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
            const isSplitChild = !!item.parent_item_id;
            const canSplit = editable && !isSplitChild && !item.is_split_original;
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
                    <span className="text-white font-medium">{item.name}</span>
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
                </td>
                <td className="px-4 py-3 text-concrete hidden sm:table-cell font-mono tabular-nums">
                  {item.quantity}
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
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ProjectSelector
                      value={item.project_id}
                      onChange={(projectId) =>
                        updateItem(item.id, "project_id", projectId)
                      }
                      disabled={isSaving}
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  {item.classification_confidence != null ? (
                    <span
                      className={`font-mono tabular-nums text-xs ${
                        item.classification_confidence >= 0.9
                          ? "text-safe"
                          : item.classification_confidence >= 0.7
                            ? "text-warn"
                            : "text-critical"
                      }`}
                    >
                      {Math.round(item.classification_confidence * 100)}%
                    </span>
                  ) : (
                    <span className="text-concrete/40">—</span>
                  )}
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

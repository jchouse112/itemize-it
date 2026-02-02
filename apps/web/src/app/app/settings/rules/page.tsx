"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  X,
  Trash2,
  Loader2,
  BookOpen,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import type { Classification, TaxCategory } from "@/lib/ii-types";
import ConfirmDialog from "@/components/app/ConfirmDialog";

interface Rule {
  id: string;
  match_type: "merchant" | "keyword" | "merchant_contains";
  match_value: string;
  classification: Classification | null;
  category: string | null;
  tax_category: TaxCategory | null;
  project_id: string | null;
  created_at: string;
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  merchant: "Merchant exact",
  merchant_contains: "Merchant contains",
  keyword: "Item keyword",
};

const CLASSIFICATION_OPTIONS: { value: Classification; label: string }[] = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
];

const TAX_CATEGORIES: { value: TaxCategory; label: string }[] = [
  { value: "advertising", label: "Advertising" },
  { value: "car_truck_expenses", label: "Car & Truck" },
  { value: "office_expense", label: "Office Expense" },
  { value: "supplies", label: "Supplies" },
  { value: "travel", label: "Travel" },
  { value: "meals", label: "Meals" },
  { value: "utilities", label: "Utilities" },
  { value: "repairs_maintenance", label: "Repairs & Maintenance" },
  { value: "insurance", label: "Insurance" },
  { value: "rent_lease_property", label: "Rent / Lease" },
  { value: "legal_professional", label: "Legal / Professional" },
  { value: "taxes_licenses", label: "Taxes & Licenses" },
  { value: "cost_of_goods_sold", label: "Cost of Goods Sold" },
  { value: "other_expenses", label: "Other Expenses" },
  { value: "not_deductible", label: "Not Deductible" },
];

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create form
  const [matchType, setMatchType] = useState<
    "merchant" | "keyword" | "merchant_contains"
  >("merchant_contains");
  const [matchValue, setMatchValue] = useState("");
  const [classification, setClassification] = useState<Classification | "">(
    "business"
  );
  const [taxCategory, setTaxCategory] = useState<TaxCategory | "">("");
  const [creating, setCreating] = useState(false);

  async function loadRules() {
    const res = await fetch("/api/rules");
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!matchValue.trim()) return;
    setCreating(true);

    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_type: matchType,
        match_value: matchValue.trim(),
        classification: classification || null,
        tax_category: taxCategory || null,
      }),
    });

    if (res.ok) {
      setMatchValue("");
      setClassification("business");
      setTaxCategory("");
      setShowCreate(false);
      await loadRules();
    }
    setCreating(false);
  }

  async function handleDelete(ruleId: string) {
    setConfirmDeleteId(null);
    setDeleting(ruleId);
    const res = await fetch(`/api/rules?id=${ruleId}`, { method: "DELETE" });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/app/settings"
          className="text-concrete hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white flex-1">
          Classification Rules
        </h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 text-sm bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-4 py-2 transition-colors"
        >
          {showCreate ? (
            <X className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {showCreate ? "Cancel" : "New Rule"}
        </button>
      </div>

      <p className="text-concrete text-sm mb-6">
        Rules automatically classify line items when a receipt is processed.
        Merchant and keyword matches are applied to new receipts.
      </p>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-gunmetal border border-edge-steel rounded-xl p-5 mb-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-concrete mb-1">
                Match Type
              </label>
              <select
                value={matchType}
                onChange={(e) =>
                  setMatchType(
                    e.target.value as
                      | "merchant"
                      | "keyword"
                      | "merchant_contains"
                  )
                }
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
              >
                <option value="merchant_contains">Merchant contains</option>
                <option value="merchant">Merchant exact match</option>
                <option value="keyword">Item keyword</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-concrete mb-1">
                Match Value
              </label>
              <input
                type="text"
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                required
                placeholder={
                  matchType === "keyword"
                    ? 'e.g. "lumber"'
                    : 'e.g. "Home Depot"'
                }
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-concrete mb-1">
                Classify as
              </label>
              <select
                value={classification}
                onChange={(e) =>
                  setClassification(e.target.value as Classification | "")
                }
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
              >
                <option value="">No classification</option>
                {CLASSIFICATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-concrete mb-1">
                Tax Category
              </label>
              <select
                value={taxCategory}
                onChange={(e) =>
                  setTaxCategory(e.target.value as TaxCategory | "")
                }
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
              >
                <option value="">No tax category</option>
                {TAX_CATEGORIES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !matchValue.trim()}
            className="flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 transition-colors"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Rule
          </button>
        </form>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-concrete/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            No rules yet
          </h2>
          <p className="text-concrete text-sm max-w-md mx-auto">
            Create rules to automatically classify expenses. For example,
            &quot;Home Depot&quot; → Business, Supplies.
          </p>
        </div>
      ) : (
        <div className="bg-gunmetal border border-edge-steel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-steel">
                <th className="text-left text-concrete font-medium px-4 py-3">
                  Match
                </th>
                <th className="text-left text-concrete font-medium px-4 py-3">
                  Classification
                </th>
                <th className="text-left text-concrete font-medium px-4 py-3 hidden sm:table-cell">
                  Tax Category
                </th>
                <th className="text-right text-concrete font-medium px-4 py-3 w-12">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-edge-steel/50 last:border-0 hover:bg-edge-steel/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-concrete/60 mr-1.5">
                      {MATCH_TYPE_LABELS[rule.match_type]}:
                    </span>
                    <span className="text-white font-medium">
                      {rule.match_value}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {rule.classification ? (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded ${
                          rule.classification === "business"
                            ? "bg-safe/10 text-safe"
                            : "bg-edge-steel text-concrete"
                        }`}
                      >
                        {rule.classification.charAt(0).toUpperCase() +
                          rule.classification.slice(1)}
                      </span>
                    ) : (
                      <span className="text-concrete/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {rule.tax_category ? (
                      <span className="text-xs text-concrete capitalize">
                        {rule.tax_category.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-concrete/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmDeleteId(rule.id)}
                      disabled={deleting === rule.id}
                      className="text-concrete/40 hover:text-critical transition-colors disabled:opacity-50"
                    >
                      {deleting === rule.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Rule"
        message="This rule will no longer auto-classify future receipts. Existing classifications are not affected."
        confirmLabel="Delete"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

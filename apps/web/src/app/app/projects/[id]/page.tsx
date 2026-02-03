"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Archive,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { IIProject, ProjectStatus, IIReceiptItem } from "@/lib/ii-types";
import { formatCents, formatReceiptDate } from "@/lib/ii-utils";
import ConfirmDialog from "@/components/app/ConfirmDialog";

interface ProjectWithStats extends IIProject {
  item_count: number;
  total_cents: number;
  business_cents: number;
}

interface ItemWithReceipt extends IIReceiptItem {
  ii_receipts: {
    merchant: string | null;
    purchase_date: string | null;
    currency: string;
  } | null;
}

const STATUS_ACTIONS: {
  from: ProjectStatus;
  to: ProjectStatus;
  label: string;
  icon: typeof CheckCircle;
  className: string;
}[] = [
  {
    from: "active",
    to: "completed",
    label: "Mark Complete",
    icon: CheckCircle,
    className: "bg-safe/10 text-safe hover:bg-safe/20",
  },
  {
    from: "active",
    to: "archived",
    label: "Archive",
    icon: Archive,
    className: "bg-edge-steel text-concrete hover:bg-edge-steel/80",
  },
  {
    from: "completed",
    to: "active",
    label: "Reopen",
    icon: CheckCircle,
    className: "bg-safety-orange/10 text-safety-orange hover:bg-safety-orange/20",
  },
  {
    from: "archived",
    to: "active",
    label: "Unarchive",
    icon: Archive,
    className: "bg-safety-orange/10 text-safety-orange hover:bg-safety-orange/20",
  },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [items, setItems] = useState<ItemWithReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<ProjectStatus | null>(null);

  // Edit fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [budgetDollars, setBudgetDollars] = useState("");
  const [materialTarget, setMaterialTarget] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        router.push("/app/projects");
        return;
      }
      const data = await res.json();
      setProject(data.project);
      setItems(data.items ?? []);
      setName(data.project.name);
      setDescription(data.project.description ?? "");
      setClientName(data.project.client_name ?? "");
      setBudgetDollars(
        data.project.budget_cents
          ? (data.project.budget_cents / 100).toFixed(2)
          : ""
      );
      setMaterialTarget(
        data.project.material_target_percent !== null
          ? String(data.project.material_target_percent)
          : ""
      );
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          client_name: clientName.trim() || null,
          budget_cents: budgetDollars
            ? Math.round(parseFloat(budgetDollars) * 100)
            : null,
          material_target_percent: materialTarget
            ? parseInt(materialTarget, 10)
            : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProject((prev) => (prev ? { ...prev, ...data.project } : prev));
        setEditing(false);
      } else {
        setError("Failed to save changes.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setSaving(false);
  }

  async function handleStatusChange(newStatus: ProjectStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setProject((prev) => (prev ? { ...prev, ...data.project } : prev));
      } else {
        setError("Failed to update project status.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin" />
      </div>
    );
  }

  const budgetUsed =
    project.budget_cents && project.budget_cents > 0
      ? Math.min((project.total_cents / project.budget_cents) * 100, 100)
      : null;

  const availableActions = STATUS_ACTIONS.filter(
    (a) => a.from === project.status
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/app/projects"
            className="text-concrete hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            <div className="flex items-center gap-2 text-sm text-concrete mt-0.5">
              {project.client_name && <span>{project.client_name}</span>}
              <span className="capitalize">
                {project.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {availableActions.map((action) => (
            <button
              key={action.to}
              onClick={() => setConfirmStatus(action.to)}
              className={`flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 transition-colors ${action.className}`}
            >
              <action.icon className="w-4 h-4" />
              {action.label}
            </button>
          ))}
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
                  <Loader2 className="w-4 h-4 animate-spin" />
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
        <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Project details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-concrete mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
                />
              </div>
              <div>
                <label className="block text-xs text-concrete mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
                />
              </div>
              <div>
                <label className="block text-xs text-concrete mb-1">
                  Client
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-concrete mb-1">
                    Budget
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={budgetDollars}
                    onChange={(e) => setBudgetDollars(e.target.value)}
                    className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-concrete mb-1">
                    Material %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={materialTarget}
                    onChange={(e) => setMaterialTarget(e.target.value)}
                    placeholder="40"
                    className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-concrete">Description</p>
                <p className="text-white text-sm mt-0.5">
                  {project.description ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-concrete">Client</p>
                <p className="text-white text-sm mt-0.5">
                  {project.client_name ?? "—"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
          <h3 className="text-sm font-medium text-concrete mb-3">Spending</h3>
          <p className="text-2xl font-bold text-white font-mono tabular-nums mb-1">
            {formatCents(project.total_cents)}
          </p>
          <p className="text-xs text-concrete">
            {formatCents(project.business_cents)} business
          </p>
          {budgetUsed !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-concrete mb-1">
                <span>Budget used</span>
                <span className="font-mono tabular-nums">
                  {Math.round(budgetUsed)}%
                </span>
              </div>
              <div className="h-1.5 bg-edge-steel rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    budgetUsed > 90
                      ? "bg-critical"
                      : budgetUsed > 70
                        ? "bg-warn"
                        : "bg-safe"
                  }`}
                  style={{ width: `${budgetUsed}%` }}
                />
              </div>
            </div>
          )}
          {project.material_target_percent !== null && budgetUsed !== null && (
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-concrete">Materials</span>
              <span className="font-mono tabular-nums">
                <span className="text-safety-orange">
                  Target {project.material_target_percent}%
                </span>
                <span className="text-concrete mx-1">/</span>
                <span
                  className={
                    budgetUsed <= project.material_target_percent
                      ? "text-safe"
                      : budgetUsed <= project.material_target_percent * 1.1
                        ? "text-warn"
                        : "text-critical"
                  }
                >
                  Current {Math.round(budgetUsed)}%
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
          <h3 className="text-sm font-medium text-concrete mb-3">Items</h3>
          <p className="text-2xl font-bold text-white font-mono tabular-nums">
            {project.item_count}
          </p>
          <p className="text-xs text-concrete mt-1">line items assigned</p>
        </div>
      </div>

      {/* Items table */}
      <h2 className="text-sm font-medium text-concrete mb-3">
        Assigned Items ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-8 text-center">
          <p className="text-concrete text-sm">
            No items assigned to this project yet. Assign items from the receipt
            detail page.
          </p>
        </div>
      ) : (
        <div className="bg-gunmetal border border-edge-steel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-steel">
                <th className="text-left text-concrete font-medium px-4 py-3">
                  Item
                </th>
                <th className="text-left text-concrete font-medium px-4 py-3 hidden sm:table-cell">
                  Merchant
                </th>
                <th className="text-left text-concrete font-medium px-4 py-3 hidden sm:table-cell">
                  Date
                </th>
                <th className="text-left text-concrete font-medium px-4 py-3">
                  Class
                </th>
                <th className="text-right text-concrete font-medium px-4 py-3">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-edge-steel/50 last:border-0 hover:bg-edge-steel/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/receipts/${item.receipt_id}`}
                      className="text-white font-medium hover:text-safety-orange transition-colors"
                    >
                      {item.name}
                    </Link>
                    {item.description && (
                      <div className="text-concrete text-xs mt-0.5 truncate max-w-[200px]">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-concrete hidden sm:table-cell">
                    {item.ii_receipts?.merchant ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-concrete hidden sm:table-cell">
                    {formatReceiptDate(item.ii_receipts?.purchase_date ?? null)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded ${
                        item.classification === "business"
                          ? "bg-safe/10 text-safe"
                          : item.classification === "personal"
                            ? "bg-edge-steel text-concrete"
                            : "bg-warn/10 text-warn"
                      }`}
                    >
                      {item.classification.charAt(0).toUpperCase() +
                        item.classification.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                    {formatCents(
                      item.total_price_cents,
                      item.ii_receipts?.currency
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmStatus !== null}
        title={
          confirmStatus === "archived" ? "Archive Project" :
          confirmStatus === "completed" ? "Complete Project" :
          "Reopen Project"
        }
        message={
          confirmStatus === "archived"
            ? "Archived projects are hidden from active views. You can unarchive later."
            : confirmStatus === "completed"
              ? "Marking this project complete will move it out of active projects."
              : "This will reactivate the project."
        }
        confirmLabel={
          confirmStatus === "archived" ? "Archive" :
          confirmStatus === "completed" ? "Complete" :
          "Reopen"
        }
        confirmClassName={
          confirmStatus === "archived"
            ? "bg-concrete hover:bg-concrete/90 text-white"
            : "bg-safety-orange hover:bg-safety-orange/90 text-white"
        }
        onConfirm={() => {
          if (confirmStatus) handleStatusChange(confirmStatus);
          setConfirmStatus(null);
        }}
        onCancel={() => setConfirmStatus(null)}
      />
    </div>
  );
}

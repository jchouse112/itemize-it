import Link from "next/link";
import { useState } from "react";
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Archive,
  FileDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import type { ReceiptStatus } from "@/lib/ii-types";

interface ReceiptCardProps {
  id: string;
  merchant: string | null;
  purchase_date: string | null;
  total_cents: number | null;
  currency: string;
  status: ReceiptStatus;
  has_business_items: boolean;
  has_personal_items: boolean;
  has_unclassified_items: boolean;
  item_count: number;
  email_from: string | null;
  onDelete?: (id: string) => void;
}

const STATUS_CONFIG: Record<
  ReceiptStatus,
  { label: string; icon: typeof Clock; color: string }
> = {
  pending: { label: "Pending", icon: Clock, color: "text-warn" },
  processing: { label: "Processing", icon: Clock, color: "text-warn" },
  in_review: {
    label: "Needs Review",
    icon: AlertTriangle,
    color: "text-safety-orange",
  },
  complete: { label: "Complete", icon: CheckCircle, color: "text-safe" },
  exported: { label: "Exported", icon: FileDown, color: "text-concrete" },
  archived: { label: "Archived", icon: Archive, color: "text-concrete/60" },
};

function formatCents(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReceiptCard({
  id,
  merchant,
  purchase_date,
  total_cents,
  currency,
  status,
  has_business_items,
  has_personal_items,
  has_unclassified_items,
  item_count,
  email_from,
  onDelete,
}: ReceiptCardProps) {
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete?.(id);
      }
    } catch {
      // Silently fail — the receipt will still be visible
    }
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div className="relative bg-gunmetal border border-edge-steel rounded-xl hover:border-concrete/40 transition-colors group">
      {/* Confirmation overlay */}
      {confirming && (
        <div className="absolute inset-0 z-10 bg-gunmetal/95 rounded-xl flex items-center justify-center gap-3 px-4">
          <p className="text-sm text-concrete mr-2">Delete this receipt?</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs bg-critical/10 text-critical border border-critical/20 px-3 py-1.5 rounded-lg hover:bg-critical/20 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-concrete border border-edge-steel px-3 py-1.5 rounded-lg hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center">
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            setConfirming(true);
          }}
          className="shrink-0 px-3 py-4 text-concrete/40 hover:text-critical transition-colors"
          title="Delete receipt"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Card content — navigates to detail */}
        <Link
          href={`/app/receipts/${id}`}
          className="flex-1 flex items-center justify-between p-4 pl-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-medium truncate">
                {merchant ?? "Unknown Merchant"}
              </h3>
              {email_from && (
                <span className="shrink-0 text-[10px] bg-edge-steel text-concrete px-1.5 py-0.5 rounded">
                  email
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-concrete">
              <span>{formatDate(purchase_date)}</span>
              <span>{item_count} item{item_count !== 1 ? "s" : ""}</span>
              <span className={`flex items-center gap-1 ${cfg.color}`}>
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>
            {/* Classification badges */}
            <div className="flex items-center gap-1.5 mt-2">
              {has_business_items && (
                <span className="text-[10px] bg-safe/10 text-safe px-1.5 py-0.5 rounded">
                  Business
                </span>
              )}
              {has_personal_items && (
                <span className="text-[10px] bg-edge-steel text-concrete px-1.5 py-0.5 rounded">
                  Personal
                </span>
              )}
              {has_unclassified_items && (
                <span className="text-[10px] bg-warn/10 text-warn px-1.5 py-0.5 rounded">
                  Unclassified
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <span className="text-lg font-bold text-white font-mono tabular-nums">
              {formatCents(total_cents, currency)}
            </span>
            <ChevronRight className="w-4 h-4 text-concrete group-hover:text-white transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}

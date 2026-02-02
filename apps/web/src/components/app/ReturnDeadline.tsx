"use client";

import { Package, PackageCheck, PackageX } from "lucide-react";
import type { IIReturn } from "@/lib/ii-types";
import { formatReceiptDate } from "@/lib/ii-utils";

interface ReturnDeadlineProps {
  returnRecord: IIReturn & {
    ii_receipts?: { merchant: string | null; purchase_date: string | null } | null;
  };
  onMarkReturned?: (id: string) => void;
}

function getDaysUntil(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const statusConfig = {
  eligible: { icon: Package, color: "text-blue-400", badge: "bg-blue-500/20 text-blue-400" },
  returned: { icon: PackageCheck, color: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-400" },
  expired: { icon: PackageX, color: "text-red-400", badge: "bg-red-500/20 text-red-400" },
  ineligible: { icon: PackageX, color: "text-concrete/60", badge: "bg-concrete/20 text-concrete/60" },
};

export default function ReturnDeadline({ returnRecord, onMarkReturned }: ReturnDeadlineProps) {
  const config = statusConfig[returnRecord.status];
  const Icon = config.icon;
  const daysLeft = getDaysUntil(returnRecord.return_by);
  const merchant = returnRecord.merchant ?? returnRecord.ii_receipts?.merchant ?? "Unknown";
  const productName = returnRecord.product_name ?? "Item";

  const isUrgent = returnRecord.status === "eligible" && daysLeft <= 3;
  const borderColor = isUrgent
    ? "border-amber-500/50"
    : returnRecord.status === "eligible"
      ? "border-blue-500/30"
      : "border-edge-steel";

  return (
    <div className={`rounded-xl border ${borderColor} bg-gunmetal/50 p-4`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${config.badge}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{productName}</h3>
          <p className="text-xs text-concrete mt-0.5">{merchant}</p>
          <div className="flex items-center gap-2 mt-2">
            {returnRecord.status === "eligible" && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isUrgent ? "bg-amber-500/20 text-amber-400" : config.badge
                }`}
              >
                {daysLeft <= 0
                  ? "Last day!"
                  : daysLeft === 1
                    ? "1 day left"
                    : `${daysLeft} days left`}
              </span>
            )}
            {returnRecord.status === "returned" && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
                Returned
              </span>
            )}
            {returnRecord.status === "expired" && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
                Expired
              </span>
            )}
          </div>
          <p className="text-xs text-concrete/80 mt-1">
            Return by:{" "}
            {formatReceiptDate(returnRecord.return_by, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        {returnRecord.status === "eligible" && onMarkReturned && (
          <button
            onClick={() => onMarkReturned(returnRecord.id)}
            className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/30 transition-colors shrink-0"
          >
            Mark Returned
          </button>
        )}
      </div>
    </div>
  );
}

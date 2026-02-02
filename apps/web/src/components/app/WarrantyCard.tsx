"use client";

import { Shield, ShieldAlert, ShieldX } from "lucide-react";
import type { IIWarranty } from "@/lib/ii-types";
import { getWarrantyStatus } from "@/lib/lifecycle/warranty-heuristics";
import { formatReceiptDate } from "@/lib/ii-utils";

interface WarrantyCardProps {
  warranty: IIWarranty & {
    ii_receipts?: { merchant: string | null; purchase_date: string | null } | null;
  };
}

const statusConfig = {
  active: {
    icon: Shield,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-400",
  },
  expiring_soon: {
    icon: ShieldAlert,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-400",
  },
  expired: {
    icon: ShieldX,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-400",
  },
};

export default function WarrantyCard({ warranty }: WarrantyCardProps) {
  const { status, label, daysRemaining } = getWarrantyStatus(warranty.end_date);
  const config = statusConfig[status];
  const Icon = config.icon;
  const merchant = warranty.ii_receipts?.merchant ?? "Unknown Merchant";
  const productName = warranty.product_name ?? merchant;

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} p-4 transition-colors hover:brightness-110`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${config.badge}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{productName}</h3>
          <p className="text-xs text-concrete mt-0.5">{merchant}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
              {label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-concrete/80">
            <span>
              Start: {formatReceiptDate(warranty.start_date, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span>
              End: {formatReceiptDate(warranty.end_date, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          {warranty.is_estimated && (
            <p className="text-xs text-concrete/60 mt-1 italic">Estimated dates</p>
          )}
        </div>
        {warranty.confidence < 0.5 && (
          <span className="text-xs text-concrete/50 shrink-0">Low confidence</span>
        )}
      </div>
    </div>
  );
}

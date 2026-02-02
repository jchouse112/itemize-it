"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";

interface DuplicateAlertProps {
  duplicateOfId: string;
  duplicateOfMerchant?: string | null;
  duplicateOfDate?: string | null;
  onCompare: () => void;
}

export default function DuplicateAlert({
  duplicateOfId,
  duplicateOfMerchant,
  onCompare,
}: DuplicateAlertProps) {
  return (
    <div className="flex items-start gap-3 bg-warn/10 border border-warn/20 rounded-xl p-4 mb-6">
      <AlertTriangle className="w-5 h-5 text-warn shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">
          Possible duplicate receipt
        </p>
        <p className="text-xs text-concrete mt-0.5">
          This receipt has the same merchant, date, and total as{" "}
          {duplicateOfMerchant ? (
            <span className="text-white">{duplicateOfMerchant}</span>
          ) : (
            "another receipt"
          )}
          . It may have been uploaded or forwarded twice.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={onCompare}
            className="text-xs font-medium text-safety-orange hover:text-safety-orange/80 transition-colors"
          >
            Compare side by side
          </button>
          <Link
            href={`/app/receipts/${duplicateOfId}`}
            className="flex items-center gap-1 text-xs text-concrete hover:text-white transition-colors"
          >
            View original
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface UpgradeBannerProps {
  used: number;
  limit: number;
  label: string; // e.g., "receipts", "exports"
  className?: string;
}

/**
 * Reusable upgrade banner that shows when usage is above 80%.
 * Renders nothing if usage is below threshold.
 */
export default function UpgradeBanner({
  used,
  limit,
  label,
  className = "",
}: UpgradeBannerProps) {
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;

  if (percent < 80) return null;

  const isAtLimit = used >= limit;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
        isAtLimit
          ? "bg-critical/10 border border-critical/20 text-critical"
          : "bg-warn/10 border border-warn/20 text-warn"
      } ${className}`}
    >
      <div className="flex-1">
        {isAtLimit ? (
          <span>
            You&apos;ve reached your monthly {label} limit ({used}/{limit}).
          </span>
        ) : (
          <span>
            You&apos;ve used {used} of {limit} {label} this month.
          </span>
        )}
      </div>
      <Link
        href="/app/settings/billing"
        className="flex items-center gap-1 font-medium hover:underline whitespace-nowrap"
      >
        Upgrade
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

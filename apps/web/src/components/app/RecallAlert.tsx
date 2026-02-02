"use client";

import { AlertTriangle, ExternalLink, X } from "lucide-react";
import type { IIRecallMatch } from "@/lib/ii-types";

interface RecallAlertProps {
  recall: IIRecallMatch;
  onDismiss?: (id: string) => void;
}

const confidenceConfig = {
  high: { label: "High Match", badge: "bg-red-500/20 text-red-400" },
  medium: { label: "Possible Match", badge: "bg-amber-500/20 text-amber-400" },
  low: { label: "Low Match", badge: "bg-concrete/20 text-concrete/60" },
};

const SAFE_PROTOCOLS = new Set(["https:", "http:"]);

/** Only allow http/https URLs — blocks javascript:, data:, etc. */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export default function RecallAlert({ recall, onDismiss }: RecallAlertProps) {
  const config = confidenceConfig[recall.confidence];

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg p-2 bg-red-500/20 text-red-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{recall.title}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
              {config.label}
            </span>
          </div>
          {recall.hazard && (
            <p className="text-xs text-red-300 mt-1">
              <span className="font-medium">Hazard:</span> {recall.hazard}
            </p>
          )}
          {recall.remedy && (
            <p className="text-xs text-concrete mt-1">
              <span className="font-medium text-concrete/80">Remedy:</span> {recall.remedy}
            </p>
          )}
          {recall.description && (
            <p className="text-xs text-concrete/80 mt-1">{recall.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {recall.url && isSafeUrl(recall.url) && (
              <a
                href={recall.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-safety-orange hover:underline flex items-center gap-1"
              >
                View Notice <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {recall.recall_date && (
              <span className="text-xs text-concrete/60">
                Recalled: {recall.recall_date}
              </span>
            )}
            <span className="text-xs text-concrete/60">
              Source: {recall.source.toUpperCase()}
            </span>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(recall.id)}
            className="text-concrete/40 hover:text-concrete transition-colors shrink-0"
            aria-label="Dismiss recall"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

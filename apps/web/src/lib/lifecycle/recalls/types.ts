/**
 * Recall service types for Itemize-It.
 * Adapted from Recevity's recalls/types.ts.
 */

export type RecallSource = "cpsc" | "perplexity";
export type RecallConfidence = "high" | "medium" | "low";

/**
 * High-risk product categories monitored by CPSC.
 */
export const HIGH_RISK_CATEGORIES = new Set([
  "computers",
  "phones",
  "tablets",
  "tvs",
  "audio",
  "cameras",
  "gaming",
  "wearables",
  "smart_home",
  "appliances_major",
  "appliances_small",
  "tools_power",
  "tools_hand",
  "outdoor_equipment",
  "lawn_garden",
  "bicycles",
  "fitness",
  "sports",
  "camping",
  "baby",
  "health",
  "pets",
  "kitchen",
]);

export function isHighRiskCategory(category?: string | null): boolean {
  if (!category) return false;
  return HIGH_RISK_CATEGORIES.has(category.toLowerCase());
}

export interface SearchVectors {
  upc?: string | null;
  brand?: string | null;
  model?: string | null;
  name: string;
  category?: string | null;
}

export interface RecallMatch {
  externalRecallId?: string | null;
  source: RecallSource;
  confidence: RecallConfidence;
  matchedOn: string[];
  title: string;
  description?: string | null;
  hazard?: string | null;
  remedy?: string | null;
  recallDate?: string | null;
  url?: string | null;
  rawResponse?: Record<string, unknown> | null;
}

export interface RecallSearchResult {
  matches: RecallMatch[];
  raw?: unknown;
}

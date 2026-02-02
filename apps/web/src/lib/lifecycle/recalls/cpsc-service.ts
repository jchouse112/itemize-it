/**
 * CPSC (Consumer Product Safety Commission) recall search service.
 * Adapted from Recevity — stateless, no changes needed.
 */
import "server-only";

import type { RecallMatch, RecallSearchResult, SearchVectors } from "./types";

export interface CPSCRecall {
  RecallNumber?: string;
  RecallDate?: string;
  RecallURL?: string;
  RecallTitle?: string;
  ProductName?: string;
  ProductDescription?: string;
  ProductModel?: string;
  ModelNumber?: string;
  Manufacturer?: string;
  UPC?: string;
  Hazard?: string;
  Remedy?: string;
  [key: string]: unknown;
}

const BASE_URL = "https://www.saferproducts.gov/RestWebServices/Recall";

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function tokenSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.length || !tokensB.length) return 0;
  const setB = new Set(tokensB);
  let overlap = 0;
  tokensA.forEach((token) => {
    if (setB.has(token)) overlap += 1;
  });
  return overlap / Math.min(tokensA.length, tokensB.length);
}

function fuzzyMatch(a: string | undefined, b: string | undefined, threshold: number): boolean {
  if (!a || !b) return false;
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;
  return tokenSimilarity(normalizedA, normalizedB) >= threshold;
}

function normalizeUpc(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length ? digits : null;
}

function extractUpcs(recall: CPSCRecall): string[] {
  const candidates = [
    recall.UPC,
    typeof recall.UPC === "string" ? recall.UPC : undefined,
    (recall as Record<string, unknown>).UPCList as string | undefined,
  ].filter((value): value is string => typeof value === "string");

  const upcs = new Set<string>();
  candidates.forEach((value) => {
    const matches = value.match(/[0-9]{8,14}/g);
    if (matches) {
      matches.forEach((match) => upcs.add(match));
    }
  });
  return Array.from(upcs);
}

function recallText(recall: CPSCRecall): string {
  return [
    recall.Manufacturer,
    recall.ProductName,
    recall.ProductDescription,
    recall.RecallTitle,
    recall.ProductModel,
    recall.ModelNumber,
  ]
    .filter(Boolean)
    .join(" ");
}

function matchesBrand(recall: CPSCRecall, brand: string): boolean {
  if (!brand) return false;
  const needle = normalizeText(brand);
  if (!needle) return false;
  return normalizeText(recallText(recall)).includes(needle);
}

function matchesModel(recall: CPSCRecall, model: string): boolean {
  if (!model) return false;
  const needle = normalizeText(model);
  if (!needle) return false;
  const haystack = normalizeText(
    [recall.ProductModel, recall.ModelNumber, recall.ProductName, recall.ProductDescription]
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(needle);
}

export function scoreConfidence(
  item: SearchVectors,
  recall: CPSCRecall
): "high" | "medium" | "low" {
  const upc = normalizeUpc(item.upc);
  if (upc && extractUpcs(recall).includes(upc)) return "high";

  if (item.brand && item.model && matchesBrand(recall, item.brand) && matchesModel(recall, item.model)) {
    return "high";
  }

  if (
    item.brand &&
    matchesBrand(recall, item.brand) &&
    fuzzyMatch(recall.ProductName ?? recall.RecallTitle ?? "", item.name, 0.7)
  ) {
    return "medium";
  }

  return "low";
}

function buildRecallMatch(item: SearchVectors, recall: CPSCRecall): RecallMatch | null {
  const confidence = scoreConfidence(item, recall);
  if (confidence === "low") return null;

  const matchedOn = new Set<string>();
  const upc = normalizeUpc(item.upc);
  if (upc && extractUpcs(recall).includes(upc)) {
    matchedOn.add("upc");
  }

  if (item.brand && item.model && matchesBrand(recall, item.brand) && matchesModel(recall, item.model)) {
    matchedOn.add("brand_model");
  } else if (item.brand && matchesBrand(recall, item.brand)) {
    matchedOn.add("brand");
  }

  if (fuzzyMatch(recall.ProductName ?? recall.RecallTitle ?? "", item.name, 0.7)) {
    matchedOn.add("brand_name");
  }

  return {
    externalRecallId: recall.RecallNumber ?? null,
    source: "cpsc",
    confidence,
    matchedOn: Array.from(matchedOn),
    title: recall.RecallTitle ?? recall.ProductName ?? "Recall notice",
    description: recall.ProductDescription ?? null,
    hazard: recall.Hazard ?? null,
    remedy: recall.Remedy ?? null,
    recallDate: recall.RecallDate ?? null,
    url: recall.RecallURL ?? null,
    rawResponse: recall as Record<string, unknown>,
  };
}

async function fetchCpscRecalls(params: Record<string, string>): Promise<CPSCRecall[]> {
  const url = new URL(BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CPSC request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data as CPSCRecall[];
}

export async function searchCpscRecalls(item: SearchVectors): Promise<RecallSearchResult> {
  const upc = normalizeUpc(item.upc);
  let recalls: CPSCRecall[] = [];

  if (upc) {
    recalls = await fetchCpscRecalls({ UPC: upc });
  }

  if (!recalls.length && item.name) {
    const params: Record<string, string> = { ProductName: item.name };
    if (item.brand) params.Manufacturer = item.brand;
    recalls = await fetchCpscRecalls(params);
  }

  const matches = recalls
    .map((recall) => buildRecallMatch(item, recall))
    .filter((match): match is RecallMatch => Boolean(match));

  const deduped: RecallMatch[] = [];
  const seen = new Set<string>();
  matches.forEach((match) => {
    const key = match.externalRecallId ?? match.title;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(match);
  });

  return { matches: deduped, raw: recalls };
}

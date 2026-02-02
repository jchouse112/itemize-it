/**
 * Client for calling Receivity's external recall-check API.
 * Falls back to direct Perplexity if Receivity is unavailable.
 */
import "server-only";

import type { RecallMatch, RecallSearchResult, SearchVectors } from "./types";
import { searchPerplexityRecalls } from "./perplexity-service";
import { log } from "@/lib/logger";

const RECEIVITY_TIMEOUT_MS = 10_000;
const RECEIVITY_MAX_RETRIES = 2;

interface ReceivityRecallResponse {
  check: {
    status: string;
    matchCount: number;
    sourcesChecked: string[];
    cachedHit: boolean;
  };
  matches: RecallMatch[];
}

async function fallbackToDirectPerplexity(
  searchVectors: SearchVectors
): Promise<RecallSearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    log.error("Neither Receivity nor Perplexity configured for recall checks");
    return { matches: [] };
  }
  log.info("Falling back to direct Perplexity call");
  return searchPerplexityRecalls(searchVectors, apiKey);
}

export async function checkRecallsViaReceivity(
  searchVectors: SearchVectors
): Promise<RecallSearchResult> {
  const baseUrl = process.env.RECEIVITY_API_URL;
  const serviceKey = process.env.RECEIVITY_SERVICE_API_KEY;

  if (!baseUrl || !serviceKey) {
    log.warn(
      "Receivity integration not configured, falling back to direct Perplexity"
    );
    return fallbackToDirectPerplexity(searchVectors);
  }

  for (let attempt = 0; attempt < RECEIVITY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `${baseUrl}/api/external/recall-check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-service-key": serviceKey,
          },
          body: JSON.stringify({ searchVectors }),
          signal: AbortSignal.timeout(RECEIVITY_TIMEOUT_MS),
        }
      );

      if (response.status === 429) {
        log.warn("Receivity rate limited, falling back to direct Perplexity");
        return fallbackToDirectPerplexity(searchVectors);
      }

      if (!response.ok) {
        throw new Error(`Receivity returned ${response.status}`);
      }

      const data: ReceivityRecallResponse = await response.json();
      return { matches: data.matches };
    } catch (err) {
      const isLast = attempt === RECEIVITY_MAX_RETRIES - 1;
      log.warn("Receivity recall check failed", {
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : "Unknown",
      });
      if (isLast) {
        log.warn(
          "All Receivity attempts failed, falling back to direct Perplexity"
        );
        return fallbackToDirectPerplexity(searchVectors);
      }
      // Exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  return fallbackToDirectPerplexity(searchVectors);
}

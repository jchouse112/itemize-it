/**
 * Orchestrates recall checks for receipt items.
 * Calls Receivity's external API (with direct Perplexity fallback),
 * then stores results in Itemize-It's own Supabase tables.
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { checkRecallsViaReceivity } from "./receivity-client";
import type { SearchVectors } from "./types";
import { log } from "@/lib/logger";

interface ReceiptItem {
  id: string;
  name: string;
  description?: string | null;
}

function buildSearchVectors(
  item: ReceiptItem,
  merchant?: string | null
): SearchVectors {
  return {
    name: item.name,
    brand: merchant ?? null,
    model: null,
    upc: null,
    category: null,
  };
}

export async function checkReceiptRecalls(options: {
  receiptId: string;
  businessId: string;
  items: ReceiptItem[];
  merchant?: string | null;
}): Promise<void> {
  const { receiptId, businessId, items, merchant } = options;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (const item of items) {
    const searchVectors = buildSearchVectors(item, merchant);

    try {
      const result = await checkRecallsViaReceivity(searchVectors);

      const status =
        result.matches.length > 0 ? "recalls_found" : "no_recalls";

      const { data: checkRow, error: checkError } = await supabase
        .from("ii_recall_checks")
        .insert({
          business_id: businessId,
          receipt_id: receiptId,
          status,
          checked_at: new Date().toISOString(),
          api_response: {
            searchVectors,
            matchCount: result.matches.length,
          },
          match_count: result.matches.length,
        })
        .select("id")
        .single();

      if (checkError || !checkRow) {
        log.error("Failed to insert ii_recall_checks", {
          receiptId,
          itemName: item.name,
          error: checkError?.message,
        });
        continue;
      }

      if (result.matches.length > 0) {
        const matchRows = result.matches.map((match) => ({
          business_id: businessId,
          receipt_id: receiptId,
          recall_check_id: checkRow.id,
          product_name: item.name,
          recall_id: match.externalRecallId ?? null,
          hazard: match.hazard ?? null,
          remedy: match.remedy ?? null,
          source_url: match.url ?? null,
          confidence: match.confidence,
          status: "active",
          matched_at: new Date().toISOString(),
        }));

        const { error: matchError } = await supabase
          .from("ii_recall_matches")
          .insert(matchRows);

        if (matchError) {
          log.error("Failed to insert ii_recall_matches", {
            receiptId,
            itemName: item.name,
            error: matchError.message,
          });
        }
      }
    } catch (err) {
      log.error("Recall check failed for item", {
        receiptId,
        itemName: item.name,
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }
}

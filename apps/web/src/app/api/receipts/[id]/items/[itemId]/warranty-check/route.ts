import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { detectWarrantyWithFallback, type WarrantyDetectionResult } from "@/lib/lifecycle/warranty-heuristics";
import { lookupWarrantyWithPerplexity } from "@/lib/lifecycle/warranties/perplexity-service";

const BodySchema = z.object({
  force: z.boolean().optional(),
});

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isCached(checkedAt: string | null): boolean {
  if (!checkedAt) return false;
  const checkedMs = new Date(checkedAt).getTime();
  if (Number.isNaN(checkedMs)) return false;
  return Date.now() - checkedMs < CACHE_TTL_MS;
}

function heuristicLookup(input: {
  itemName: string;
  merchant: string | null;
  purchaseDate: string;
  totalPriceCents: number | null;
}): WarrantyDetectionResult | null {
  return detectWarrantyWithFallback({
    merchant: input.merchant,
    brand: input.itemName,
    purchaseDate: input.purchaseDate,
    total:
      input.totalPriceCents != null
        ? input.totalPriceCents / 100
        : null,
    allowGenericFallback: false,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: receiptId, itemId } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // No body is valid for this route.
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const force = parsed.data.force ?? false;

  const { data: item, error: itemError } = await supabase
    .from("ii_receipt_items")
    .select(`
      id,
      receipt_id,
      name,
      description,
      total_price_cents,
      warranty_eligible,
      track_warranty,
      warranty_lookup_status,
      warranty_end_date,
      warranty_checked_at,
      warranty_lookup_confidence,
      ii_receipts!inner(id, merchant, purchase_date)
    `)
    .eq("id", itemId)
    .eq("receipt_id", receiptId)
    .eq("business_id", businessId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const receiptRelation = item.ii_receipts as
    | { id: string; merchant: string | null; purchase_date: string | null }
    | Array<{ id: string; merchant: string | null; purchase_date: string | null }>
    | null;
  const receipt = Array.isArray(receiptRelation)
    ? receiptRelation[0]
    : receiptRelation;
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found for item" }, { status: 404 });
  }
  const purchaseDate = receipt.purchase_date;
  const merchant = receipt.merchant;

  if (!purchaseDate) {
    const { data: updatedItem } = await supabase
      .from("ii_receipt_items")
      .update({
        track_warranty: true,
        warranty_eligible: true,
        warranty_lookup_status: "error",
        warranty_lookup_error: "Missing purchase date on receipt",
        warranty_checked_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("receipt_id", receiptId)
      .select("*")
      .single();

    return NextResponse.json(
      { error: "Purchase date required before warranty check", item: updatedItem },
      { status: 400 }
    );
  }

  if (
    !force &&
    (item.warranty_lookup_status === "found" || item.warranty_lookup_status === "not_found") &&
    isCached(item.warranty_checked_at)
  ) {
    return NextResponse.json({
      item,
      cached: true,
      warranty_found: item.warranty_lookup_status === "found",
    });
  }

  await supabase
    .from("ii_receipt_items")
    .update({
      track_warranty: true,
      warranty_eligible: true,
      warranty_lookup_status: "in_progress",
      warranty_lookup_error: null,
    })
    .eq("id", itemId)
    .eq("receipt_id", receiptId);

  let found = false;
  let startDate = purchaseDate;
  let endDate: string | null = null;
  let category: string | null = null;
  let manufacturer: string | null = null;
  let confidence: number | null = null;
  let source: "ai_lookup" | "receipt" | null = null;
  let lookupError: string | null = null;
  let lookupMetadata: Record<string, unknown> | null = null;

  try {
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityApiKey) {
      const perplexityResult = await lookupWarrantyWithPerplexity({
        apiKey: perplexityApiKey,
        itemName: item.name,
        description: item.description,
        merchant,
        purchaseDate,
        totalPriceCents: item.total_price_cents,
      });

      if (
        perplexityResult.hasWarranty &&
        perplexityResult.warrantyMonths != null
      ) {
        const detected = detectWarrantyWithFallback({
          merchant,
          brand: perplexityResult.manufacturer ?? item.name,
          purchaseDate,
          total:
            item.total_price_cents != null
              ? item.total_price_cents / 100
              : null,
          allowGenericFallback: true,
        });

        found = true;
        endDate = addMonths(purchaseDate, perplexityResult.warrantyMonths);
        category = detected?.category ?? "other";
        manufacturer = perplexityResult.manufacturer;
        confidence = perplexityResult.confidence ?? 0.7;
        source = "ai_lookup";
      }

      lookupMetadata = {
        provider: "perplexity",
        rationale: perplexityResult.rationale,
        source_urls: perplexityResult.sourceUrls,
        raw: perplexityResult.rawContent,
      };
    }

    if (!found) {
      const heuristicResult = heuristicLookup({
        itemName: item.name,
        merchant,
        purchaseDate,
        totalPriceCents: item.total_price_cents,
      });

      if (heuristicResult) {
        found = true;
        startDate = heuristicResult.startDate;
        endDate = heuristicResult.endDate;
        category = heuristicResult.category;
        confidence = heuristicResult.confidence;
        source = "receipt";
      }
    }
  } catch (err) {
    lookupError = err instanceof Error ? err.message : "Warranty lookup failed";
  }

  // If Perplexity fails, still attempt local heuristics.
  if (!found) {
    const heuristicResult = heuristicLookup({
      itemName: item.name,
      merchant,
      purchaseDate,
      totalPriceCents: item.total_price_cents,
    });
    if (heuristicResult) {
      found = true;
      startDate = heuristicResult.startDate;
      endDate = heuristicResult.endDate;
      category = heuristicResult.category;
      confidence = heuristicResult.confidence;
      source = "receipt";
      lookupError = null;
    }
  }

  const checkedAt = new Date().toISOString();

  if (found && endDate) {
    const { data: existingWarranty } = await supabase
      .from("ii_warranties")
      .select("id")
      .eq("business_id", businessId)
      .eq("receipt_id", receiptId)
      .eq("item_id", itemId)
      .maybeSingle();

    const warrantyPayload = {
      business_id: businessId,
      receipt_id: receiptId,
      item_id: itemId,
      start_date: startDate,
      end_date: endDate,
      category,
      manufacturer,
      confidence,
    };

    if (existingWarranty?.id) {
      await supabase
        .from("ii_warranties")
        .update(warrantyPayload)
        .eq("id", existingWarranty.id);
    } else {
      await supabase.from("ii_warranties").insert(warrantyPayload);
    }

    const { data: updatedItem } = await supabase
      .from("ii_receipt_items")
      .update({
        track_warranty: true,
        warranty_eligible: true,
        warranty_lookup_status: "found",
        warranty_end_date: endDate,
        warranty_checked_at: checkedAt,
        warranty_lookup_confidence: confidence,
        warranty_lookup_source: source,
        warranty_lookup_error: null,
        warranty_lookup_metadata: lookupMetadata,
      })
      .eq("id", itemId)
      .eq("receipt_id", receiptId)
      .select("*")
      .single();

    return NextResponse.json({
      item: updatedItem,
      cached: false,
      warranty_found: true,
    });
  }

  const failureStatus = lookupError ? "error" : "not_found";
  const { data: updatedItem } = await supabase
    .from("ii_receipt_items")
    .update({
      track_warranty: true,
      warranty_eligible: true,
      warranty_lookup_status: failureStatus,
      warranty_end_date: null,
      warranty_checked_at: checkedAt,
      warranty_lookup_confidence: confidence,
      warranty_lookup_source: source,
      warranty_lookup_error: lookupError,
      warranty_lookup_metadata: lookupMetadata,
    })
    .eq("id", itemId)
    .eq("receipt_id", receiptId)
    .select("*")
    .single();

  return NextResponse.json({
    item: updatedItem,
    cached: false,
    warranty_found: false,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { SplitItemSchema } from "@/lib/validation";
import { prorateTax } from "@/lib/ii-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

// 20 splits per minute per user — generous for normal use, blocks abuse
const SPLIT_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

/**
 * POST /api/receipts/[id]/items/[itemId]/split
 *
 * Split a single line item into 2+ rows. The original item is marked
 * as `is_split_original = true` (soft-hidden from totals), and new child
 * rows are inserted with `parent_item_id` pointing back to it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: receiptId, itemId } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  const rl = checkRateLimit(`split:${userId}`, SPLIT_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many split requests. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) },
      }
    );
  }

  // Verify receipt ownership
  const { data: receipt } = await supabase
    .from("ii_receipts")
    .select("id, business_id, currency")
    .eq("id", receiptId)
    .eq("business_id", businessId)
    .single();

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  // Verify item belongs to this receipt
  const { data: originalItem } = await supabase
    .from("ii_receipt_items")
    .select("*")
    .eq("id", itemId)
    .eq("receipt_id", receiptId)
    .single();

  if (!originalItem) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Cannot split an item that is already a split original (already split)
  if (originalItem.is_split_original) {
    return NextResponse.json(
      { error: "This item has already been split." },
      { status: 409 }
    );
  }

  // Cannot split a child of another split
  if (originalItem.parent_item_id) {
    return NextResponse.json(
      { error: "Cannot split a child item. Undo the parent split first." },
      { status: 409 }
    );
  }

  // Parse & validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = SplitItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { rows, tax_method, manual_tax } = parsed.data;

  // Validate amounts sum to original total
  const totalSplit = rows.reduce((s, r) => s + r.amount_cents, 0);
  if (totalSplit !== originalItem.total_price_cents) {
    return NextResponse.json(
      {
        error: `Split amounts must sum to ${originalItem.total_price_cents} cents. Got ${totalSplit}.`,
      },
      { status: 400 }
    );
  }

  // Compute tax per row
  const originalTax = originalItem.tax_cents ?? 0;
  let taxPerRow: number[];

  if (tax_method === "manual" && manual_tax && manual_tax.length === rows.length) {
    const manualSum = manual_tax.reduce((s, v) => s + v, 0);
    if (manualSum !== originalTax) {
      return NextResponse.json(
        { error: `Manual tax values must sum to ${originalTax} cents. Got ${manualSum}.` },
        { status: 400 }
      );
    }
    taxPerRow = manual_tax;
  } else {
    taxPerRow = prorateTax(
      originalTax,
      rows.map((r) => ({ amountCents: r.amount_cents }))
    );
  }

  // Validate project ownership for any project_id assignments
  const projectIds = [
    ...new Set(
      rows
        .filter((r) => r.project_id != null)
        .map((r) => r.project_id as string)
    ),
  ];
  if (projectIds.length > 0) {
    const { data: ownedProjects } = await supabase
      .from("ii_projects")
      .select("id")
      .in("id", projectIds)
      .eq("business_id", businessId);
    const ownedIds = new Set((ownedProjects ?? []).map((p) => p.id));
    const invalidIds = projectIds.filter((pid) => !ownedIds.has(pid));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "One or more project IDs do not belong to your business" },
        { status: 403 }
      );
    }
  }

  // Build child item inserts
  const now = new Date().toISOString();
  const childItems = rows.map((row, i) => ({
    receipt_id: receiptId,
    business_id: businessId,
    user_id: userId,
    name: row.label || `${originalItem.name} (split ${i + 1}/${rows.length})`,
    description: originalItem.description,
    quantity: originalItem.quantity,
    unit_price_cents: null,
    total_price_cents: row.amount_cents,
    subtotal_cents: null,
    tax_cents: taxPerRow[i],
    tax_rate: null,
    tax_calculation_method: tax_method === "manual" ? "manual" : "prorated",
    classification: row.classification,
    classification_confidence: null,
    classified_at: row.classification !== "unclassified" ? now : null,
    classified_by: row.classification !== "unclassified" ? userId : null,
    category: originalItem.category,
    category_confidence: null,
    category_locked: false,
    tax_category: row.tax_category ?? originalItem.tax_category,
    project_id: row.project_id ?? null,
    parent_item_id: itemId,
    is_split_original: false,
    split_ratio: originalItem.total_price_cents > 0
      ? row.amount_cents / originalItem.total_price_cents
      : null,
    review_reasons: [],
    needs_review: false,
    notes: row.notes ?? null,
  }));

  // Insert children first, then mark original. This ordering is safer:
  // if children insert fails, there's nothing to roll back. If the mark
  // fails, we delete the children (orphaned children are less harmful
  // than a marked original with no children).
  const { data: insertedItems, error: insertError } = await supabase
    .from("ii_receipt_items")
    .insert(childItems)
    .select("*");

  if (insertError) {
    log.error("Failed to insert split children", {
      itemId,
      receiptId,
      error: insertError.message,
    });
    return NextResponse.json(
      { error: "Failed to create split items. Please try again." },
      { status: 500 }
    );
  }

  const { error: markError } = await supabase
    .from("ii_receipt_items")
    .update({ is_split_original: true, updated_at: now })
    .eq("id", itemId);

  if (markError) {
    // Rollback: delete the children we just inserted
    const childIds = (insertedItems ?? []).map((c) => c.id);
    if (childIds.length > 0) {
      const { error: rollbackError } = await supabase
        .from("ii_receipt_items")
        .delete()
        .in("id", childIds);
      if (rollbackError) {
        log.error("Rollback failed: could not delete orphaned split children", {
          itemId,
          receiptId,
          childIds,
          error: rollbackError.message,
        });
      }
    }
    log.error("Failed to mark item as split original", {
      itemId,
      receiptId,
      error: markError.message,
    });
    return NextResponse.json(
      { error: "Failed to split item. Please try again." },
      { status: 500 }
    );
  }

  // Fetch all items once — used for both classification flags and the response.
  // This replaces two separate queries (one for flags, one for the response).
  const [{ data: allItems }, auditResult] = await Promise.all([
    supabase
      .from("ii_receipt_items")
      .select("*")
      .eq("receipt_id", receiptId)
      .order("created_at"),
    // Audit log (fire concurrently — doesn't block the response)
    supabase.rpc("log_ii_audit_event", {
      p_business_id: businessId,
      p_actor_id: userId,
      p_entity_type: "receipt_item",
      p_entity_id: itemId,
      p_event_type: "item_split",
      p_before_state: {
        total_price_cents: originalItem.total_price_cents,
        tax_cents: originalItem.tax_cents,
        classification: originalItem.classification,
      },
      p_after_state: {
        split_count: rows.length,
        children: (insertedItems ?? []).map((c) => ({
          id: c.id,
          amount: c.total_price_cents,
          classification: c.classification,
        })),
      },
      p_metadata: { tax_method },
    }),
  ]);

  // Update receipt-level classification flags from the single items query
  if (allItems) {
    const active = allItems.filter((i) => !i.is_split_original);
    const classifications = active.map((i) => i.classification);
    await supabase
      .from("ii_receipts")
      .update({
        has_business_items: classifications.includes("business"),
        has_personal_items: classifications.includes("personal"),
        has_unclassified_items: classifications.includes("unclassified"),
      })
      .eq("id", receiptId);
  }

  // Fetch the updated receipt (after classification flags are set)
  const { data: updatedReceipt } = await supabase
    .from("ii_receipts")
    .select("*")
    .eq("id", receiptId)
    .single();

  return NextResponse.json({
    items: allItems,
    receipt: updatedReceipt,
    split: {
      original_item_id: itemId,
      children: insertedItems,
    },
  });
}

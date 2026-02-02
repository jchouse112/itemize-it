import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";
import { log } from "@/lib/logger";

const ResolveSchema = z.object({
  resolution: z.enum(["keep_both", "keep_current", "keep_original"]),
  duplicate_of: z.string().uuid(),
});

/**
 * POST /api/receipts/[id]/resolve-duplicate
 *
 * Resolve a duplicate receipt flag.
 * - keep_both: clear duplicate flag on both, they're separate receipts
 * - keep_current: archive the original, keep this one
 * - keep_original: archive this receipt, keep the original
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: receiptId } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Verify receipt ownership
  const { data: receipt } = await supabase
    .from("ii_receipts")
    .select("id, business_id, duplicate_of, confidence_score")
    .eq("id", receiptId)
    .eq("business_id", businessId)
    .single();

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { resolution, duplicate_of } = parsed.data;

  // The client must pass the same duplicate_of that is stored on the receipt.
  // This prevents misuse of this endpoint to archive arbitrary receipts by
  // claiming they are "duplicates" of the target.
  if (receipt.duplicate_of !== duplicate_of) {
    return NextResponse.json(
      { error: "duplicate_of does not match the receipt's flagged duplicate" },
      { status: 400 }
    );
  }

  // Verify the duplicate_of receipt also belongs to this business
  const { data: originalReceipt } = await supabase
    .from("ii_receipts")
    .select("id, business_id")
    .eq("id", duplicate_of)
    .eq("business_id", businessId)
    .single();

  if (!originalReceipt) {
    return NextResponse.json(
      { error: "Original receipt not found" },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();

  switch (resolution) {
    case "keep_both": {
      // Clear the duplicate flag on the current receipt only.
      // Don't touch the original — it may have its own independent
      // duplicate_of pointing at a third receipt.
      // Don't blanket-clear needs_review — the receipt may have other
      // review reasons (low confidence, price warnings). Only clear it
      // if the duplicate flag was the sole reason.
      const keepBothUpdate: Record<string, unknown> = { duplicate_of: null };
      if (receipt.duplicate_of) {
        // Check whether any items still need review independently
        const { data: reviewItems } = await supabase
          .from("ii_receipt_items")
          .select("id")
          .eq("receipt_id", receiptId)
          .eq("needs_review", true)
          .limit(1);
        const hasOtherReviewReasons = (reviewItems?.length ?? 0) > 0;
        if (!hasOtherReviewReasons) {
          // Also check receipt-level confidence — low-confidence extractions
          // set needs_review independently of duplicates
          const hasLowConfidence =
            receipt.confidence_score != null && receipt.confidence_score < 0.5;
          if (!hasLowConfidence) {
            keepBothUpdate.needs_review = false;
          }
        }
      }
      await supabase
        .from("ii_receipts")
        .update(keepBothUpdate)
        .eq("id", receiptId);
      break;
    }

    case "keep_current":
      // Archive the original, clear flag on current
      await Promise.all([
        supabase
          .from("ii_receipts")
          .update({ duplicate_of: null, needs_review: false })
          .eq("id", receiptId),
        supabase
          .from("ii_receipts")
          .update({ status: "archived" })
          .eq("id", duplicate_of),
      ]);
      break;

    case "keep_original":
      // Archive the current receipt
      await supabase
        .from("ii_receipts")
        .update({ status: "archived", duplicate_of: null })
        .eq("id", receiptId);
      break;
  }

  // Audit log
  await supabase.rpc("log_ii_audit_event", {
    p_business_id: businessId,
    p_actor_id: userId,
    p_entity_type: "receipt",
    p_entity_id: receiptId,
    p_event_type: "duplicate_resolved",
    p_before_state: { duplicate_of: receipt.duplicate_of },
    p_after_state: { resolution, duplicate_of },
    p_metadata: { resolved_at: now },
  });

  // Return updated receipt
  const { data: updatedReceipt } = await supabase
    .from("ii_receipts")
    .select("*")
    .eq("id", receiptId)
    .single();

  return NextResponse.json({ receipt: updatedReceipt });
}

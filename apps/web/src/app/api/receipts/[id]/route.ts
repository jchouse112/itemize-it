import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { ReceiptPatchSchema } from "@/lib/validation";
import { log } from "@/lib/logger";

/** GET /api/receipts/[id] — Get a single receipt with its items */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const { data: receipt, error } = await supabase
    .from("ii_receipts")
    .select("*, ii_receipt_items(*), ii_projects(*)")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (error || !receipt) {
    return NextResponse.json(
      { error: "Receipt not found" },
      { status: 404 }
    );
  }

  // Generate a fresh signed URL per request.
  // No in-memory cache — avoids leaking URLs across requests in shared
  // serverless processes and eliminates stale-cache bugs on deletion.
  let imageUrl: string | null = null;
  if (receipt.storage_key) {
    const { data: signedData } = await supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.storage_key, 3600); // 1 hour
    imageUrl = signedData?.signedUrl ?? null;
  }

  return NextResponse.json({ receipt, imageUrl });
}

/** PATCH /api/receipts/[id] — Update receipt fields (merchant, date, status, etc.) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Parse and validate every field through Zod — rejects unknown keys,
  // enforces type constraints, and bounds numeric ranges.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ReceiptPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };

  // If user is manually editing core fields, mark it
  if (
    "merchant" in updates ||
    "total_cents" in updates ||
    "purchase_date" in updates
  ) {
    updates.is_manually_edited = true;
  }

  // If marking as reviewed
  if (updates.status === "complete") {
    updates.reviewed_at = new Date().toISOString();
  }

  // Snapshot current state for audit before_state
  const { data: beforeReceipt } = await supabase
    .from("ii_receipts")
    .select("merchant, total_cents, purchase_date, status, payment_source, project_id")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  const { data: receipt, error } = await supabase
    .from("ii_receipts")
    .update(updates)
    .eq("id", id)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error) {
    log.error("Failed to update receipt", { receiptId: id, businessId });
    return NextResponse.json(
      { error: "Failed to update receipt" },
      { status: 500 }
    );
  }

  // Audit: log receipt update with before/after state
  await supabase.rpc("log_ii_audit_event", {
    p_business_id: businessId,
    p_actor_id: userId,
    p_entity_type: "receipt",
    p_entity_id: id,
    p_event_type: "receipt_updated",
    p_before_state: beforeReceipt ?? {},
    p_after_state: parsed.data,
    p_metadata: { fields_changed: Object.keys(parsed.data) },
  });

  return NextResponse.json({ receipt });
}

/** DELETE /api/receipts/[id] — Permanently delete a receipt, its items, and stored file */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Fetch the receipt to get the storage key before deleting
  const { data: receipt, error: fetchError } = await supabase
    .from("ii_receipts")
    .select("id, storage_key, merchant, status")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !receipt) {
    return NextResponse.json(
      { error: "Receipt not found" },
      { status: 404 }
    );
  }

  // Delete the stored file from Supabase Storage
  if (receipt.storage_key) {
    const { error: storageError } = await supabase.storage
      .from("receipts")
      .remove([receipt.storage_key]);

    if (storageError) {
      log.warn("Failed to delete receipt file from storage", {
        receiptId: id,
        storageKey: receipt.storage_key,
        error: storageError.message,
      });
      // Continue with DB deletion even if storage cleanup fails
    }
  }

  // Delete receipt (cascades to ii_receipt_items, ii_recall_checks, etc.)
  const { error: deleteError } = await supabase
    .from("ii_receipts")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (deleteError) {
    log.error("Failed to delete receipt", {
      receiptId: id,
      businessId,
      error: deleteError.message,
    });
    return NextResponse.json(
      { error: "Failed to delete receipt" },
      { status: 500 }
    );
  }

  // Audit log
  await supabase.rpc("log_ii_audit_event", {
    p_business_id: businessId,
    p_actor_id: userId,
    p_entity_type: "receipt",
    p_entity_id: id,
    p_event_type: "receipt_deleted",
    p_before_state: receipt,
    p_after_state: {},
    p_metadata: {},
  });

  return NextResponse.json({ success: true });
}

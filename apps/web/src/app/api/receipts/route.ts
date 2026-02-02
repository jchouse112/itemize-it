import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { validateFileContent } from "@/lib/validation";
import { canUploadReceipt } from "@/lib/plan-gate";
import { log } from "@/lib/logger";

/** POST /api/receipts — Upload a receipt file and create the ii_receipts record */
export async function POST(request: NextRequest) {
  // Fail fast if the internal API secret isn't configured — without it we
  // cannot authenticate the call to /api/internal/process-receipt and the
  // upload would silently skip extraction.
  if (!process.env.INTERNAL_API_SECRET) {
    log.error("INTERNAL_API_SECRET is not set — receipt uploads are disabled");
    return NextResponse.json(
      { error: "Server configuration error. Please contact support." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Plan gate: check receipt upload quota
  const quota = await canUploadReceipt(businessId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Monthly receipt limit reached (${quota.used}/${quota.limit}). Upgrade your plan for more uploads.`,
        code: "PLAN_LIMIT_REACHED",
        used: quota.used,
        limit: quota.limit,
      },
      { status: 403 }
    );
  }

  // Get business currency — fail explicitly instead of silently defaulting to USD.
  // A missing business record means the auth context is stale or the business
  // was deleted, which should never happen silently.
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("default_currency")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    log.error("Business lookup failed during receipt upload", {
      businessId,
      userId,
      error: businessError?.message,
    });
    return NextResponse.json(
      { error: "Unable to determine business settings. Please try again." },
      { status: 500 }
    );
  }

  const currency = business.default_currency;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Server-side file size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.` },
      { status: 400 }
    );
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ];

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type." },
      { status: 400 }
    );
  }

  // Read file bytes once — reused for magic byte validation, duplicate check, and upload
  const arrayBuffer = await file.arrayBuffer();

  // Validate actual file content via magic bytes (don't trust MIME header alone).
  // This blocks executables/scripts disguised with a spoofed Content-Type.
  const { valid: magicValid, detectedType } = validateFileContent(arrayBuffer);
  if (!magicValid) {
    log.warn("File content mismatch on upload", {
      claimedType: file.type,
      detectedType: detectedType ?? "unknown",
      userId,
      businessId,
    });
    return NextResponse.json(
      { error: "File content does not match an allowed image or PDF format." },
      { status: 400 }
    );
  }

  // ---- Duplicate detection ----
  // Compute a SHA-256 hash of the file content. If we've already seen this
  // exact file for this business, flag it as a potential duplicate instead of
  // silently creating another receipt.
  const fileHash = await computeFileHash(arrayBuffer);

  const { data: existingDupe } = await supabase
    .from("ii_receipts")
    .select("id, merchant, created_at, status")
    .eq("business_id", businessId)
    .eq("file_hash", fileHash)
    .limit(1)
    .maybeSingle();

  if (existingDupe) {
    log.info("Duplicate receipt detected", {
      existingId: existingDupe.id,
      fileHash,
      userId,
      businessId,
    });
    return NextResponse.json(
      {
        error: "This file appears to be a duplicate of an existing receipt.",
        duplicate_of: {
          id: existingDupe.id,
          merchant: existingDupe.merchant,
          created_at: existingDupe.created_at,
          status: existingDupe.status,
        },
      },
      { status: 409 }
    );
  }

  // Build storage path: itemize-it/{business_id}/{YYYY-MM}/{uuid}.{ext}
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileId = crypto.randomUUID();
  const storageKey = `itemize-it/${businessId}/${yearMonth}/${fileId}.${ext}`;

  // Upload to Supabase Storage (arrayBuffer already read above for magic byte check)
  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(storageKey, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    log.error("Storage upload failed", { businessId, userId, storageKey });
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  // Create the ii_receipts record
  const { data: receipt, error: insertError } = await supabase
    .from("ii_receipts")
    .insert({
      business_id: businessId,
      user_id: userId,
      storage_key: storageKey,
      file_hash: fileHash,
      status: "pending",
      currency,
    })
    .select("id, status, created_at")
    .single();

  if (insertError) {
    // Clean up uploaded file on insert failure
    await supabase.storage.from("receipts").remove([storageKey]);
    log.error("Receipt insert failed", { businessId, userId, storageKey, error: insertError.message });
    return NextResponse.json(
      { error: "Failed to create receipt. Please try again." },
      { status: 500 }
    );
  }

  // Audit: log receipt creation
  await supabase.rpc("log_ii_audit_event", {
    p_business_id: businessId,
    p_actor_id: userId,
    p_entity_type: "receipt",
    p_entity_id: receipt.id,
    p_event_type: "receipt_created",
    p_after_state: { storage_key: storageKey, currency, file_hash: fileHash },
    p_metadata: { source: "upload", file_type: file.type, file_size: file.size },
  });

  // Trigger AI extraction in the background.
  // We intentionally don't await the full processing, but we DO await the
  // initial fetch to ensure the request was accepted. This catches network
  // errors and server-down scenarios that a fire-and-forget would miss.
  const processUrl = new URL("/api/internal/process-receipt", request.url);
  const processPayload = JSON.stringify({
    receiptRawId: receipt.id,
    userId,
    storageKey,
    fileType: file.type,
  });

  try {
    const processResponse = await fetch(processUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: processPayload,
    });

    if (!processResponse.ok) {
      const errText = await processResponse.text().catch(() => "unknown");
      log.error("Extraction trigger failed", {
        receiptId: receipt.id,
        status: processResponse.status,
        responseSnippet: errText.substring(0, 200),
      });
      await supabase
        .from("ii_receipts")
        .update({
          status: "in_review",
          needs_review: true,
          confidence_score: 0,
        })
        .eq("id", receipt.id);
    }
  } catch (err) {
    log.error("Failed to trigger receipt extraction", {
      receiptId: receipt.id,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    await supabase
      .from("ii_receipts")
      .update({
        status: "in_review",
        needs_review: true,
        confidence_score: 0,
      })
      .eq("id", receipt.id);
  }

  return NextResponse.json({ receipt }, { status: 201 });
}

/** GET /api/receipts — List receipts for the current business */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    100
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let query = supabase
    .from("ii_receipts")
    .select("*, ii_receipt_items(id, name, total_price_cents, classification)", {
      count: "exact",
    })
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data: receipts, count, error } = await query;

  if (error) {
    log.error("Failed to list receipts", { businessId });
    return NextResponse.json({ error: "Failed to load receipts" }, { status: 500 });
  }

  return NextResponse.json({ receipts, total: count });
}

// ============================================
// Helpers
// ============================================

/**
 * Compute a SHA-256 hex digest of the file content.
 * Used for duplicate detection — two identical files produce the same hash.
 */
async function computeFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { IngestEmailSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getReceiptCountThisMonth } from "@/lib/plan-gate";
import { log } from "@/lib/logger";

/** Per-source rate limit for inbound email processing */
const INGEST_RATE_LIMIT = { limit: 30, windowMs: 60_000 }; // 30 emails/min per source

// ============================================
// Forwarding email → business resolution cache
// ============================================
// Avoids repeated RPC calls for the same forwarding address within a short window.
// TTL is short (5 min) so alias regeneration takes effect quickly.
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;

interface ResolvedAlias {
  businessId: string;
  userId: string;
  cachedAt: number;
}

const resolveCache = new Map<string, ResolvedAlias>();

function getCachedResolution(email: string): ResolvedAlias | null {
  const key = email.toLowerCase();
  const cached = resolveCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > RESOLVE_CACHE_TTL_MS) {
    resolveCache.delete(key);
    return null;
  }
  return cached;
}

function setCachedResolution(email: string, businessId: string, userId: string): void {
  resolveCache.set(email.toLowerCase(), {
    businessId,
    userId,
    cachedAt: Date.now(),
  });
}

/**
 * POST /api/internal/ingest-email
 *
 * Called by the inbound-email edge function after receiving a forwarded email.
 * The edge function has already:
 *   1. Parsed the email (sender, subject, message-id)
 *   2. Extracted attachments and uploaded them to Supabase Storage
 *
 * This route:
 *   1. Resolves the forwarding address → business + user
 *   2. Creates an ii_inbound_emails tracking record
 *   3. Creates ii_receipts records for each attachment
 *   4. Triggers AI extraction for each receipt
 *
 * Authentication: INTERNAL_API_SECRET bearer token (same as process-receipt).
 */
export async function POST(request: NextRequest) {
  // Validate internal API secret
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (
    !expectedSecret ||
    expectedSecret.length === 0 ||
    authHeader !== `Bearer ${expectedSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate payload
  let payload;
  try {
    const raw = await request.json();
    const parsed = IngestEmailSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { toEmail, fromEmail, subject, messageId, receivedAt, attachments } =
    payload;

  // Rate-limit by forwarding address (1:1 with a business) to prevent
  // abuse if the INTERNAL_API_SECRET is leaked.
  const rlKey = `ingest-email:${toEmail.toLowerCase()}`;
  const rlResult = checkRateLimit(rlKey, INGEST_RATE_LIMIT);
  if (!rlResult.allowed) {
    log.warn("Ingest email rate limited", { toEmail, remaining: rlResult.remaining });
    return NextResponse.json(
      { error: "Too many emails. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rlResult.retryAfterMs ?? INGEST_RATE_LIMIT.windowMs) / 1000)
          ),
        },
      }
    );
  }

  // Use service role client (server-to-server, bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Resolve forwarding email → business + user (with short TTL cache)
  let businessId: string;
  let userId: string;

  const cached = getCachedResolution(toEmail);
  if (cached) {
    businessId = cached.businessId;
    userId = cached.userId;
  } else {
    const { data: resolved, error: resolveError } = await supabase.rpc(
      "resolve_ii_forwarding_email",
      { p_email: toEmail }
    );

    if (resolveError || !resolved || resolved.length === 0) {
      log.warn("Inbound email for unknown alias", {
        toEmail,
        fromEmail,
        error: resolveError?.message,
      });
      return NextResponse.json(
        { error: "Unknown forwarding address" },
        { status: 404 }
      );
    }

    businessId = resolved[0].business_id;
    userId = resolved[0].user_id;
    setCachedResolution(toEmail, businessId, userId);
  }

  // Plan gate: check receipt upload quota for this business
  // We need to query the business limits via the service role client
  const { data: bizLimits } = await supabase
    .from("businesses")
    .select("limits_json")
    .eq("id", businessId)
    .single();

  if (bizLimits?.limits_json) {
    const limits = bizLimits.limits_json as { uploads_per_month?: number };
    const uploadsLimit = limits.uploads_per_month ?? 50;
    const currentCount = await getReceiptCountThisMonth(businessId);

    if (currentCount >= uploadsLimit) {
      log.warn("Email ingestion blocked by plan limit", {
        businessId,
        currentCount,
        uploadsLimit,
        fromEmail,
      });
      return NextResponse.json(
        { error: "Monthly receipt limit reached. Upgrade plan for more uploads." },
        { status: 403 }
      );
    }
  }

  // 2. Deduplicate by Message-ID — if we've already processed this exact email, skip
  if (messageId) {
    const { data: existing } = await supabase
      .from("ii_inbound_emails")
      .select("id")
      .eq("business_id", businessId)
      .eq("message_id", messageId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      log.info("Duplicate inbound email skipped", {
        messageId,
        existingId: existing.id,
        businessId,
      });
      return NextResponse.json(
        { skipped: true, reason: "duplicate_message_id", existing_id: existing.id },
        { status: 200 }
      );
    }
  }

  // 3. Handle emails with no attachments (bounce)
  if (attachments.length === 0) {
    const { data: bounceRecord } = await supabase
      .from("ii_inbound_emails")
      .insert({
        business_id: businessId,
        user_id: userId,
        from_email: fromEmail,
        to_email: toEmail,
        subject,
        message_id: messageId,
        attachment_count: 0,
        receipts_created: 0,
        received_at: receivedAt,
        status: "failed",
        error_message: "No receipt attachments found in this email",
      })
      .select("id")
      .single();

    // Create an in-app notification so the user knows
    await supabase.from("ii_notifications").insert({
      business_id: businessId,
      user_id: userId,
      type: "email_bounce",
      entity_id: bounceRecord?.id ?? businessId,
      title: "Email received with no attachments",
      body: `An email${subject ? ` "${subject.substring(0, 80)}"` : ""} was forwarded but had no receipt attachments to process. Make sure to attach or include receipt images.`,
    });

    log.info("Bounce: inbound email with no attachments", {
      inboundEmailId: bounceRecord?.id,
      businessId,
    });

    return NextResponse.json({
      inbound_email_id: bounceRecord?.id ?? null,
      receipts_created: 0,
      receipt_ids: [],
      bounce: true,
      reason: "no_attachments",
    });
  }

  // 4. Create the inbound email tracking record
  const { data: inboundEmail, error: inboundError } = await supabase
    .from("ii_inbound_emails")
    .insert({
      business_id: businessId,
      user_id: userId,
      from_email: fromEmail,
      to_email: toEmail,
      subject,
      message_id: messageId,
      attachment_count: attachments.length,
      received_at: receivedAt,
      status: "processing",
    })
    .select("id")
    .single();

  if (inboundError || !inboundEmail) {
    log.error("Failed to create inbound email record", {
      businessId,
      fromEmail,
      error: inboundError?.message,
    });
    return NextResponse.json(
      { error: "Failed to record inbound email" },
      { status: 500 }
    );
  }

  // 5. Get business currency (for receipt records)
  const { data: business } = await supabase
    .from("businesses")
    .select("default_currency")
    .eq("id", businessId)
    .single();

  const currency = business?.default_currency ?? "USD";

  // 6. Create receipt records for all valid attachments, then trigger
  //    extractions concurrently. This avoids sequential round-trips.
  const receiptIds: string[] = [];
  const errors: string[] = [];

  // 6a. Filter and create receipt records
  interface ReceiptEntry {
    receiptId: string;
    storageKey: string;
    fileType: string;
    filename?: string;
  }
  const receiptEntries: ReceiptEntry[] = [];

  for (const attachment of attachments) {
    // Skip oversized attachments (guard even if edge function didn't report size)
    if (attachment.fileSize && attachment.fileSize > 20 * 1024 * 1024) {
      log.warn("Skipping oversized email attachment", {
        businessId,
        storageKey: attachment.storageKey,
        fileSize: attachment.fileSize,
      });
      errors.push(
        `Attachment too large: ${attachment.filename ?? attachment.storageKey} (${Math.round(attachment.fileSize / 1024 / 1024)}MB)`
      );
      continue;
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("ii_receipts")
      .insert({
        business_id: businessId,
        user_id: userId,
        storage_key: attachment.storageKey,
        status: "pending",
        currency,
        email_message_id: messageId,
        email_from: fromEmail,
        email_subject: subject,
        email_received_at: receivedAt,
      })
      .select("id")
      .single();

    if (receiptError || !receipt) {
      log.error("Failed to create receipt from email attachment", {
        businessId,
        storageKey: attachment.storageKey,
        error: receiptError?.message,
      });
      errors.push(
        `Failed to create receipt for ${attachment.filename ?? attachment.storageKey}`
      );
      continue;
    }

    receiptIds.push(receipt.id);
    receiptEntries.push({
      receiptId: receipt.id,
      storageKey: attachment.storageKey,
      fileType: attachment.fileType,
      filename: attachment.filename,
    });
  }

  // 6b. Fire all extraction triggers concurrently
  const processUrl = new URL("/api/internal/process-receipt", request.url);

  const extractionResults = await Promise.allSettled(
    receiptEntries.map(async (entry) => {
      const res = await fetch(processUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${expectedSecret}`,
        },
        body: JSON.stringify({
          receiptRawId: entry.receiptId,
          userId,
          storageKey: entry.storageKey,
          fileType: entry.fileType,
          emailMessageId: messageId,
          emailFrom: fromEmail,
          emailSubject: subject,
          emailReceivedAt: receivedAt,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown");
        throw new Error(
          `HTTP ${res.status}: ${errText.substring(0, 200)}`
        );
      }

      return entry.receiptId;
    })
  );

  // 6c. Handle extraction failures — mark receipts so they don't stay "pending"
  for (let i = 0; i < extractionResults.length; i++) {
    const result = extractionResults[i];
    const entry = receiptEntries[i];

    if (result.status === "rejected") {
      log.error("Extraction trigger failed for email receipt", {
        receiptId: entry.receiptId,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });

      await supabase
        .from("ii_receipts")
        .update({
          status: "in_review",
          needs_review: true,
          confidence_score: 0,
        })
        .eq("id", entry.receiptId);

      errors.push(
        `Extraction failed for ${entry.filename ?? entry.storageKey}`
      );
    }
  }

  // 7. Update the inbound email record with results
  const finalStatus =
    receiptIds.length === 0
      ? "failed"
      : errors.length > 0
        ? "partial"
        : "processed";

  await supabase
    .from("ii_inbound_emails")
    .update({
      receipts_created: receiptIds.length,
      status: finalStatus,
      error_message:
        errors.length > 0 ? errors.join("; ") : null,
    })
    .eq("id", inboundEmail.id);

  log.info("Inbound email processed", {
    inboundEmailId: inboundEmail.id,
    businessId,
    fromEmail,
    attachments: attachments.length,
    receiptsCreated: receiptIds.length,
    errors: errors.length,
  });

  return NextResponse.json({
    inbound_email_id: inboundEmail.id,
    receipts_created: receiptIds.length,
    receipt_ids: receiptIds,
    errors: errors.length > 0 ? errors : undefined,
  });
}

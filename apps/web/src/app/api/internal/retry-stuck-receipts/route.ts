import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { log } from "@/lib/logger";

/**
 * POST /api/internal/retry-stuck-receipts
 *
 * Finds receipts that have been stuck in "pending" status for longer than
 * STUCK_THRESHOLD_MINUTES and re-triggers extraction for each one.
 *
 * Intended to be called by a scheduled cron job (e.g. Vercel Cron every 10 min).
 * Authentication: INTERNAL_API_SECRET bearer token.
 *
 * Query params:
 *   - threshold_minutes: override the stuck threshold (default 15, max 1440)
 *   - limit: max receipts to retry per invocation (default 10, max 50)
 */

const DEFAULT_STUCK_THRESHOLD_MINUTES = 15;
const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 50;
const MAX_THRESHOLD_MINUTES = 1440; // 24 hours

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

  const url = new URL(request.url);
  const thresholdMinutes = Math.min(
    parseInt(url.searchParams.get("threshold_minutes") ?? String(DEFAULT_STUCK_THRESHOLD_MINUTES), 10) || DEFAULT_STUCK_THRESHOLD_MINUTES,
    MAX_THRESHOLD_MINUTES
  );
  const batchLimit = Math.min(
    parseInt(url.searchParams.get("limit") ?? String(DEFAULT_BATCH_LIMIT), 10) || DEFAULT_BATCH_LIMIT,
    MAX_BATCH_LIMIT
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find receipts stuck in "pending" beyond the threshold
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

  const { data: stuckReceipts, error: queryError } = await supabase
    .from("ii_receipts")
    .select("id, user_id, storage_key, email_message_id, email_from, email_subject, email_received_at")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(batchLimit);

  if (queryError) {
    log.error("Failed to query stuck receipts", {
      error: queryError.message,
    });
    return NextResponse.json(
      { error: "Failed to query stuck receipts" },
      { status: 500 }
    );
  }

  if (!stuckReceipts || stuckReceipts.length === 0) {
    return NextResponse.json({
      retried: 0,
      message: "No stuck receipts found",
    });
  }

  log.info("Found stuck receipts for retry", {
    count: stuckReceipts.length,
    thresholdMinutes,
  });

  // Detect file type from storage key extension (best-effort)
  function inferFileType(storageKey: string): string {
    const ext = storageKey.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
      heic: "image/heic",
    };
    return mimeMap[ext ?? ""] ?? "application/octet-stream";
  }

  // Re-trigger extraction for each stuck receipt
  const processUrl = new URL("/api/internal/process-receipt", request.url);
  const results = await Promise.allSettled(
    stuckReceipts.map(async (receipt) => {
      const res = await fetch(processUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${expectedSecret}`,
        },
        body: JSON.stringify({
          receiptRawId: receipt.id,
          userId: receipt.user_id,
          storageKey: receipt.storage_key,
          fileType: inferFileType(receipt.storage_key ?? ""),
          emailMessageId: receipt.email_message_id,
          emailFrom: receipt.email_from,
          emailSubject: receipt.email_subject,
          emailReceivedAt: receipt.email_received_at,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown");
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }

      return receipt.id;
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // Log failures for visibility
  for (const result of results) {
    if (result.status === "rejected") {
      log.error("Retry extraction failed", {
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  log.info("Retry stuck receipts completed", {
    total: stuckReceipts.length,
    succeeded,
    failed,
  });

  return NextResponse.json({
    retried: stuckReceipts.length,
    succeeded,
    failed,
  });
}

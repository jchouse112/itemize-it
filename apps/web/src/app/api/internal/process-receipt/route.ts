import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ProcessReceiptPayload } from "@/lib/ii-types";
import { ExtractionResultSchema, type ValidatedExtractionResult } from "@/lib/validation";
import { receiptFingerprint } from "@/lib/ii-utils";
import { log } from "@/lib/logger";
import { detectWarrantyWithFallback } from "@/lib/lifecycle/warranty-heuristics";
import { assessWarrantyEligibility } from "@/lib/lifecycle/warranty-eligibility";
import { checkReceiptRecalls } from "@/lib/lifecycle/recalls/check-receipt-recalls";

const OPENAI_TIMEOUT_MS = 60_000; // 60 seconds

// ============================================
// Auto-generated suggested note for bookkeeper
// ============================================
// Builds a short starter note from extracted data so users have
// context to edit rather than a blank field.

/** Common food/dining keywords to detect meal receipts */
const FOOD_KEYWORDS = [
  "poutine", "burger", "pizza", "sandwich", "salad", "soup", "fries",
  "coffee", "latte", "espresso", "tea", "beer", "wine", "cocktail",
  "appetizer", "entree", "dessert", "meal", "lunch", "dinner", "breakfast",
  "chicken", "steak", "sushi", "taco", "wrap", "pasta", "noodle",
  "wings", "nachos", "fish", "shrimp", "lobster", "crab",
  "smoothie", "juice", "water", "soda", "pop", "drink",
];

/** Common food/dining merchant keywords */
const FOOD_MERCHANT_KEYWORDS = [
  "restaurant", "café", "cafe", "bistro", "grill", "bar", "pub",
  "kitchen", "diner", "eatery", "bakery", "pizzeria", "sushi",
  "starbucks", "tim hortons", "mcdonalds", "mcdonald's", "subway",
  "a&w", "wendy", "burger king", "popeyes", "chick-fil-a",
  "chipotle", "panera", "domino", "pizza hut", "taco bell",
  "kfc", "five guys", "shake shack", "dairy queen",
];

const OFFICE_KEYWORDS = [
  "paper", "ink", "toner", "pen", "pencil", "stapler", "folder",
  "binder", "notebook", "sticky notes", "tape", "envelope",
  "printer", "cartridge", "desk", "chair", "monitor",
];

const TECH_KEYWORDS = [
  "laptop", "computer", "phone", "tablet", "ipad", "macbook",
  "keyboard", "mouse", "charger", "cable", "adapter", "usb",
  "software", "license", "subscription", "hard drive", "ssd",
  "ram", "gpu", "headset", "webcam", "speaker",
];

function generateSuggestedNote(
  merchant: string | null,
  items: Array<{ name: string; description?: string | null }>,
  totalCents: number | null
): string | null {
  if (!merchant && items.length === 0) return null;

  const merchantLower = (merchant ?? "").toLowerCase();
  const allItemText = items.map((i) => i.name.toLowerCase()).join(" ");
  const combined = `${merchantLower} ${allItemText}`;

  // Detect category
  let category = "";
  if (
    FOOD_KEYWORDS.some((kw) => combined.includes(kw)) ||
    FOOD_MERCHANT_KEYWORDS.some((kw) => merchantLower.includes(kw))
  ) {
    category = "Food/dining";
  } else if (OFFICE_KEYWORDS.some((kw) => combined.includes(kw))) {
    category = "Office supplies";
  } else if (TECH_KEYWORDS.some((kw) => combined.includes(kw))) {
    category = "Technology/equipment";
  }

  // Build item summary — first 3 item names, truncated
  const itemNames = items
    .slice(0, 3)
    .map((i) => i.name)
    .join(", ");
  const itemSuffix = items.length > 3 ? ` +${items.length - 3} more` : "";
  const itemSummary = itemNames ? `${itemNames}${itemSuffix}` : "";

  // Compose the note
  const parts: string[] = [];
  if (category) parts.push(category);
  if (merchant) parts.push(`at ${merchant}`);
  if (itemSummary) parts.push(`— ${itemSummary}`);

  if (parts.length === 0) return null;

  // Add a prompt for the user to complete
  return `${parts.join(" ")}. Purpose: `;
}
const OPENAI_MAX_RETRIES = 3;
const OPENAI_RETRY_BASE_MS = 1_000; // 1s, 2s, 4s exponential backoff
const MAX_FILE_SIZE_FOR_EXTRACTION = 10 * 1024 * 1024; // 10MB after download
const AUTO_CREATE_WARRANTY_ON_INGEST =
  process.env.AUTO_CREATE_WARRANTY_ON_INGEST === "true";

// ============================================
// Concurrency limiter for OpenAI calls
// ============================================
// Prevents flooding the API when many receipts are uploaded simultaneously.
// Includes a queue timeout so requests don't wait indefinitely if all slots
// are occupied — this prevents queue exhaustion as a DoS vector.
const OPENAI_MAX_CONCURRENT = 3;
const OPENAI_QUEUE_TIMEOUT_MS = 30_000; // max 30s waiting for a slot
const OPENAI_MAX_QUEUE_SIZE = 20;       // reject immediately if queue > 20
let openaiActiveCount = 0;
const openaiQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

function acquireOpenAISlot(): Promise<void> {
  if (openaiActiveCount < OPENAI_MAX_CONCURRENT) {
    openaiActiveCount++;
    return Promise.resolve();
  }

  // Reject immediately if queue is already too deep
  if (openaiQueue.length >= OPENAI_MAX_QUEUE_SIZE) {
    return Promise.reject(
      new Error("Too many receipts being processed. Please try again shortly.")
    );
  }

  return new Promise<void>((resolve, reject) => {
    const entry = { resolve, reject };
    openaiQueue.push(entry);

    // Timeout: don't let requests wait forever for a slot
    const timer = setTimeout(() => {
      const idx = openaiQueue.indexOf(entry);
      if (idx !== -1) {
        openaiQueue.splice(idx, 1);
        reject(
          new Error("Extraction queue timeout — too many concurrent requests")
        );
      }
    }, OPENAI_QUEUE_TIMEOUT_MS);

    // Wrap resolve to clear the timer when a slot becomes available
    const originalResolve = entry.resolve;
    entry.resolve = () => {
      clearTimeout(timer);
      originalResolve();
    };
  });
}

function releaseOpenAISlot(): void {
  const next = openaiQueue.shift();
  if (next) {
    next.resolve(); // hand the slot to the next waiter
  } else {
    openaiActiveCount--;
  }
}

function buildRuleUpdateGroupKey(data: Record<string, unknown>): string {
  const sortedEntries = Object.entries(data).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return JSON.stringify(sortedEntries);
}

/**
 * POST /api/internal/process-receipt
 *
 * Called after a receipt is uploaded.
 * Uses service role key to bypass RLS since this is a server-to-server call.
 *
 * Flow:
 * 1. Download the file from Supabase Storage
 * 2. Send to OpenAI for extraction
 * 3. Update the existing ii_receipts record + insert ii_receipt_items
 * 4. Return extraction results
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

  const body: ProcessReceiptPayload = await request.json();
  const {
    receiptRawId,
    userId,
    storageKey,
    fileType,
    emailMessageId,
    emailFrom,
    emailSubject,
    emailReceivedAt,
  } = body;

  if (!receiptRawId || !userId || !storageKey) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Use service role client for server-to-server operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Helper: mark receipt as failed so it doesn't stay stuck in "pending"
  async function markExtractionFailed(receiptId: string, reason: string) {
    await supabase
      .from("ii_receipts")
      .update({
        status: "in_review",
        needs_review: true,
        extraction_model: "gpt-4o",
        confidence_score: 0,
      })
      .eq("id", receiptId);
    log.error("Extraction failed", { receiptId, reason });
  }

  try {
    // 1. Get user's business
    const { data: membership } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "User has no active business" },
        { status: 400 }
      );
    }

    const businessId = membership.business_id;

    // 2. Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("receipts")
      .download(storageKey);

    if (downloadError || !fileData) {
      await markExtractionFailed(receiptRawId, `Download failed: ${downloadError?.message}`);
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 2b. Guard against very large files to avoid excessive memory usage
    if (fileData.size > MAX_FILE_SIZE_FOR_EXTRACTION) {
      await markExtractionFailed(
        receiptRawId,
        `File too large for extraction (${(fileData.size / 1024 / 1024).toFixed(1)}MB)`
      );
      return NextResponse.json(
        { error: "File too large for AI extraction" },
        { status: 413 }
      );
    }

    // 3. Call OpenAI for extraction (with concurrency limit and retries)
    await acquireOpenAISlot();
    let extractedData: ValidatedExtractionResult;
    try {
      extractedData = await extractWithRetry(fileData, fileType);
    } finally {
      releaseOpenAISlot();
    }

    // 4. Update the existing receipt record (created by POST /api/receipts)
    const receiptId = receiptRawId;

    // Sanitize purchase_date: reject future dates — the AI likely misread the year.
    // Null it out so the user is prompted to correct it during review.
    let sanitizedDate = extractedData.purchase_date;
    let dateFlagged = false;
    if (sanitizedDate) {
      const parsed = new Date(sanitizedDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // allow same-day receipts
      if (parsed > today) {
        log.warn("Future purchase_date detected — nulling for user review", {
          receiptId: receiptRawId,
          extractedDate: sanitizedDate,
        });
        sanitizedDate = null;
        dateFlagged = true;
      }
    }

    // Generate a suggested note from extracted data to give the user a head start
    const suggestedNote = generateSuggestedNote(
      extractedData.merchant,
      extractedData.items,
      extractedData.total_cents
    );

    await supabase
      .from("ii_receipts")
      .update({
        merchant: extractedData.merchant,
        merchant_address: extractedData.merchant_address,
        purchase_date: sanitizedDate,
        total_cents: extractedData.total_cents,
        subtotal_cents: extractedData.subtotal_cents,
        tax_cents: extractedData.tax_cents,
        // Payment method extraction (e.g., Visa, Cash, Debit)
        ...(extractedData.payment_method && { payment_method: extractedData.payment_method }),
        ...(extractedData.card_last_four && { card_last_four: extractedData.card_last_four }),
        confidence_score: dateFlagged
          ? Math.min(extractedData.confidence, 0.5)
          : extractedData.confidence,
        extraction_model: "gpt-4o",
        status: "in_review",
        needs_review: true,
        // AI-suggested starter note for bookkeeper context
        ...(suggestedNote && { notes: suggestedNote }),
        // Email metadata — only set when receipt came via forwarded email
        ...(emailMessageId && { email_message_id: emailMessageId }),
        ...(emailFrom && { email_from: emailFrom }),
        ...(emailSubject && { email_subject: emailSubject }),
        ...(emailReceivedAt && { email_received_at: emailReceivedAt }),
      })
      .eq("id", receiptId);

    // 4b. Fingerprint-based duplicate detection (merchant + date + total)
    //     Unlike the file-hash check at upload time, this catches different
    //     photos of the same receipt (e.g., re-photographed or forwarded email).
    const fingerprint = receiptFingerprint(
      extractedData.merchant,
      sanitizedDate,
      extractedData.total_cents
    );

    let fingerprintDuplicate: { id: string; merchant: string | null; created_at: string } | null = null;

    if (fingerprint) {
      // Store the fingerprint on the receipt for future comparisons
      await supabase
        .from("ii_receipts")
        .update({ fingerprint })
        .eq("id", receiptId);

      // Look for existing receipts with the same fingerprint
      const { data: existingFp } = await supabase
        .from("ii_receipts")
        .select("id, merchant, created_at")
        .eq("business_id", businessId)
        .eq("fingerprint", fingerprint)
        .neq("id", receiptId)
        .limit(1)
        .maybeSingle();

      if (existingFp) {
        fingerprintDuplicate = existingFp;
        // Flag the receipt as a potential duplicate (doesn't block processing)
        await supabase
          .from("ii_receipts")
          .update({
            needs_review: true,
            duplicate_of: existingFp.id,
          })
          .eq("id", receiptId);

        log.info("Fingerprint duplicate detected", {
          receiptId,
          duplicateOf: existingFp.id,
          fingerprint,
        });
      }
    }

    // 5. Insert line items — treat as all-or-nothing.
    //    If the bulk insert fails, delete any partially-inserted rows
    //    and mark the receipt for manual review so it doesn't show
    //    inconsistent data.
    if (extractedData.items.length > 0) {
      const itemRows = extractedData.items.map((item) => {
        const eligibility = assessWarrantyEligibility({
          itemName: item.name,
          description: item.description,
          merchant: extractedData.merchant,
          totalPriceCents: item.total_price_cents,
        });

        return {
          receipt_id: receiptId,
          business_id: businessId,
          user_id: userId,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_price_cents: item.total_price_cents,
          tax_cents: item.tax_cents,
          classification: "unclassified" as const,
          classification_confidence: item.confidence,
          review_reasons:
            item.confidence != null && item.confidence < 0.7
              ? ["low_confidence"]
              : [],
          warranty_eligible: eligibility.eligible,
          warranty_eligibility_reason: eligibility.reason,
          track_warranty: eligibility.eligible,
          warranty_lookup_status: eligibility.eligible
            ? ("unknown" as const)
            : ("not_eligible" as const),
        };
      });

      const { error: insertItemsError } = await supabase
        .from("ii_receipt_items")
        .insert(itemRows);

      if (insertItemsError) {
        log.error("Item insertion failed", {
          receiptId,
          error: insertItemsError.message,
        });

        // Roll back: delete any partially-inserted rows for this receipt
        await supabase
          .from("ii_receipt_items")
          .delete()
          .eq("receipt_id", receiptId);

        // Mark receipt as needing review — extraction succeeded but
        // items couldn't be persisted
        await supabase
          .from("ii_receipts")
          .update({
            status: "in_review",
            needs_review: true,
            confidence_score: 0,
          })
          .eq("id", receiptId);

        return NextResponse.json(
          { error: "Failed to save extracted items" },
          { status: 500 }
        );
      }

      // 5b. Fire-and-forget recall checks for inserted items
      const { data: insertedItems } = await supabase
        .from("ii_receipt_items")
        .select("id, name, description")
        .eq("receipt_id", receiptId);

      if (insertedItems && insertedItems.length > 0) {
        checkReceiptRecalls({
          receiptId,
          businessId,
          items: insertedItems,
          merchant: extractedData.merchant,
        }).catch((err) => {
          log.warn("Background recall check failed", {
            receiptId,
            error: err instanceof Error ? err.message : "Unknown",
          });
        });
      }
    }

    // 6. Auto-apply classification rules
    let rulesApplied = 0;
    const { data: rules } = await supabase
      .from("ii_classification_rules")
      .select("*")
      .eq("business_id", businessId);

    if (rules && rules.length > 0) {
      const { data: insertedItems } = await supabase
        .from("ii_receipt_items")
        .select("id, name")
        .eq("receipt_id", receiptId);

      if (insertedItems) {
        const merchantLower = (extractedData.merchant ?? "").toLowerCase();

        // Pre-index rules by type for faster matching
        const exactMerchantRules = new Map<string, typeof rules[0]>();
        const containsMerchantRules: typeof rules = [];
        const keywordRules: typeof rules = [];

        for (const rule of rules) {
          const matchVal = rule.match_value.toLowerCase();
          if (rule.match_type === "merchant") {
            exactMerchantRules.set(matchVal, rule);
          } else if (rule.match_type === "merchant_contains") {
            containsMerchantRules.push(rule);
          } else if (rule.match_type === "keyword") {
            keywordRules.push(rule);
          }
        }

        // Find merchant-level rule (applies to all items)
        const merchantRule =
          exactMerchantRules.get(merchantLower) ??
          containsMerchantRules.find((r) =>
            merchantLower.includes(r.match_value.toLowerCase())
          );

        // Batch: collect all updates, then apply in grouped batches
        // (many items share the same rule result).
        const itemUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
        const classifiedAt = new Date().toISOString();

        for (const item of insertedItems) {
          // Merchant rule wins, then fall back to keyword
          const matchedRule =
            merchantRule ??
            keywordRules.find((r) =>
              item.name.toLowerCase().includes(r.match_value.toLowerCase())
            );

          if (matchedRule) {
            const updates: Record<string, unknown> = {};
            if (matchedRule.classification) {
              updates.classification = matchedRule.classification;
              updates.classified_at = classifiedAt;
              updates.classified_by = "rule:" + matchedRule.id;
            }
            if (matchedRule.category) updates.category = matchedRule.category;
            if (matchedRule.tax_category) updates.tax_category = matchedRule.tax_category;
            if (matchedRule.project_id) updates.project_id = matchedRule.project_id;

            if (Object.keys(updates).length > 0) {
              itemUpdates.push({ id: item.id, data: updates });
            }
          }
        }

        // Group identical payloads to reduce DB round-trips.
        const groupedUpdates = new Map<
          string,
          { ids: string[]; data: Record<string, unknown> }
        >();

        for (const { id, data } of itemUpdates) {
          const key = buildRuleUpdateGroupKey(data);
          const existing = groupedUpdates.get(key);
          if (existing) {
            existing.ids.push(id);
          } else {
            groupedUpdates.set(key, { ids: [id], data });
          }
        }
        const groupedUpdateList = Array.from(groupedUpdates.values());

        // Apply grouped updates in parallel
        const updateResults = await Promise.allSettled(
          groupedUpdateList.map(({ ids, data }) =>
            supabase.from("ii_receipt_items").update(data).in("id", ids)
          )
        );
        rulesApplied = updateResults.reduce((sum, result, index) => {
          if (result.status !== "fulfilled") return sum;
          return sum + groupedUpdateList[index].ids.length;
        }, 0);

        // Update receipt-level classification flags
        if (rulesApplied > 0) {
          const { data: allItems } = await supabase
            .from("ii_receipt_items")
            .select("classification")
            .eq("receipt_id", receiptId);

          if (allItems) {
            const classifications = allItems.map((i) => i.classification);
            await supabase
              .from("ii_receipts")
              .update({
                has_business_items: classifications.includes("business"),
                has_personal_items: classifications.includes("personal"),
                has_unclassified_items:
                  classifications.includes("unclassified"),
              })
              .eq("id", receiptId);
          }
        }
      }
    }

    // 7. Auto-create warranty records from extraction data
    let warrantiesCreated = 0;
    if (AUTO_CREATE_WARRANTY_ON_INGEST && extractedData.merchant && sanitizedDate) {
      const warrantyResult = detectWarrantyWithFallback({
        merchant: extractedData.merchant,
        purchaseDate: sanitizedDate,
        total:
          extractedData.total_cents != null
            ? extractedData.total_cents / 100
            : null,
      });

      if (warrantyResult) {
        const { error: warrantyError } = await supabase
          .from("ii_warranties")
          .insert({
            business_id: businessId,
            user_id: userId,
            receipt_id: receiptId,
            category: warrantyResult.category,
            start_date: warrantyResult.startDate,
            end_date: warrantyResult.endDate,
            confidence: warrantyResult.confidence,
            is_estimated: warrantyResult.isEstimated,
            warranty_source: warrantyResult.warrantySource,
            product_name: extractedData.merchant,
          });

        if (warrantyError) {
          log.warn("Failed to create warranty record", {
            receiptId,
            error: warrantyError.message,
          });
        } else {
          warrantiesCreated = 1;
        }
      }
    }

    // 8. Try to auto-match a project based on GPS if available
    let matchedProjectId: string | null = null;
    // Project matching would happen here via find_nearest_ii_project RPC

    return NextResponse.json({
      receipt_id: receiptId,
      items_extracted: extractedData.items.length,
      rules_applied: rulesApplied,
      warranties_created: warrantiesCreated,
      matched_project_id: matchedProjectId,
      price_warnings: extractedData.warnings,
      fingerprint_duplicate: fingerprintDuplicate,
    });
  } catch (err) {
    log.error("Receipt processing failed", {
      receiptId: receiptRawId,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    // Mark receipt as needing review so it doesn't stay stuck in "pending"
    await markExtractionFailed(
      receiptRawId,
      err instanceof Error ? err.message : "Unknown error"
    );
    // Never leak internal error details to the caller — the actual message
    // is already logged by markExtractionFailed above.
    return NextResponse.json(
      { error: "Receipt processing failed" },
      { status: 500 }
    );
  }
}

// ============================================
// OpenAI extraction with retry
// ============================================

/**
 * Wraps extractWithOpenAI with exponential backoff retry logic.
 * Retries on transient errors (5xx, 429 rate limit, network failures).
 * Non-retryable errors (4xx auth/validation) throw immediately.
 */
async function extractWithRetry(
  fileBlob: Blob,
  fileType: string
): Promise<ValidatedExtractionResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < OPENAI_MAX_RETRIES; attempt++) {
    try {
      return await extractWithOpenAI(fileBlob, fileType);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry client errors (auth, bad request) — only transient failures
      const isRetryable =
        lastError.message.includes("429") ||
        lastError.message.includes("500") ||
        lastError.message.includes("502") ||
        lastError.message.includes("503") ||
        lastError.message.includes("504") ||
        lastError.message.includes("AbortError") ||
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("network");

      if (!isRetryable || attempt === OPENAI_MAX_RETRIES - 1) {
        throw lastError;
      }

      const delayMs = OPENAI_RETRY_BASE_MS * Math.pow(2, attempt);
      log.warn("OpenAI extraction attempt failed, retrying", {
        attempt: attempt + 1,
        delayMs,
        error: lastError.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError ?? new Error("Extraction failed after retries");
}

// Extraction types are now defined by ExtractionResultSchema in @/lib/validation.
// The old interfaces (ExtractedItem, ExtractionResult) have been replaced by
// Zod-validated types that bound array sizes, string lengths, and numeric ranges.

async function extractWithOpenAI(
  fileBlob: Blob,
  fileType: string
): Promise<ValidatedExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Convert file to base64 for the API
  const buffer = await fileBlob.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${fileType};base64,${base64}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a receipt extraction engine. Extract structured data from receipt images.
Return valid JSON with this exact shape:
{
  "merchant": "store name or null",
  "merchant_address": "full address or null",
  "purchase_date": "YYYY-MM-DD or null",
  "total_cents": integer in cents or null,
  "subtotal_cents": integer in cents or null,
  "tax_cents": integer in cents or null,
  "payment_method": "cash" | "credit_card" | "debit_card" | "check" | "other" | null,
  "card_last_four": "last 4 digits of card if visible, e.g. 0431" | null,
  "confidence": float 0-1 for overall extraction confidence,
  "items": [
    {
      "name": "item name",
      "description": "additional detail or null",
      "quantity": number (default 1),
      "unit_price_cents": integer in cents or null,
      "total_price_cents": integer in cents,
      "tax_cents": integer in cents or null,
      "confidence": float 0-1 for this item
    }
  ],
  "warnings": ["any issues found, e.g. blurry text, partial data"]
}
All monetary values MUST be in integer cents (e.g. $12.99 = 1299).
For payment_method: look for "Visa", "Mastercard", "Amex", "Debit", "Cash", etc.
If you cannot read part of the receipt, set confidence lower and add a warning.
If line items are unreadable, create a single item with the total amount.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
            {
              type: "text",
              text: "Extract all data from this receipt. Return only the JSON, no markdown.",
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0,
    }),
  });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    // Log details server-side only — never expose API response bodies to callers
    log.error("OpenAI API error", {
      status: response.status,
      responseSnippet: errorText.substring(0, 500),
    });
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  // Parse JSON from response (strip any markdown code fences)
  const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const raw = JSON.parse(jsonStr);

    // Validate and bound the entire response through Zod — prevents
    // oversized arrays, out-of-range numbers, and missing fields.
    const result = ExtractionResultSchema.safeParse(raw);
    if (!result.success) {
      log.error("OpenAI response failed schema validation", {
        issues: result.error.issues,
      });
      throw new Error("OpenAI response did not match expected schema");
    }

    return result.data;
  } catch (err) {
    // Log a truncated snippet for debugging; never include in thrown error
    if (err instanceof SyntaxError) {
      log.error("OpenAI returned non-JSON", { snippet: jsonStr.substring(0, 200) });
      throw new Error("Failed to parse OpenAI response as JSON");
    }
    throw err;
  }
}

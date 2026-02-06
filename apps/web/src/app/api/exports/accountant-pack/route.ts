import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { canExport } from "@/lib/plan-gate";
import { log } from "@/lib/logger";
import { z } from "zod";
import JSZip from "jszip";

const ExportQuerySchema = z
  .object({
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    projectId: z.string().uuid().optional(),
    classifications: z
      .array(z.enum(["business", "personal", "unclassified"]))
      .optional(),
    markExported: z.boolean().optional(),
  })
  .refine((d) => d.dateFrom <= d.dateTo, {
    message: "dateFrom must be on or before dateTo",
    path: ["dateFrom"],
  });

/** Maximum receipts per accountant pack to prevent memory/timeout issues */
const EXPORT_RECEIPT_LIMIT = 500;
/** Maximum receipt images to include in a single ZIP */
const MAX_IMAGES_PER_PACK = 200;
/** Max concurrent Storage downloads for accountant pack images */
const IMAGE_DOWNLOAD_CONCURRENCY = 6;

/**
 * POST /api/exports/accountant-pack
 * Generate a ZIP bundle: CSV + receipt images + plain text summary.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Plan gate: check export quota
  const exportQuota = await canExport(businessId, supabase);
  if (!exportQuota.allowed) {
    return NextResponse.json(
      {
        error: `Monthly export limit reached (${exportQuota.used}/${exportQuota.limit}). Upgrade your plan for more exports.`,
        code: "PLAN_LIMIT_REACHED",
        used: exportQuota.used,
        limit: exportQuota.limit,
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ExportQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid export parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { dateFrom, dateTo, projectId, classifications, markExported } = parsed.data;

  // Query receipts with items
  let receiptQuery = supabase
    .from("ii_receipts")
    .select(`
      id,
      merchant,
      merchant_address,
      purchase_date,
      total_cents,
      subtotal_cents,
      tax_cents,
      currency,
      payment_method,
      payment_source,
      storage_key,
      status,
      ii_receipt_items(
        id,
        name,
        description,
        quantity,
        unit_price_cents,
        total_price_cents,
        subtotal_cents,
        tax_cents,
        tax_rate,
        tax_calculation_method,
        classification,
        category,
        tax_category,
        project_id,
        notes,
        is_split_original
      )
    `)
    .eq("business_id", businessId)
    .gte("purchase_date", dateFrom)
    .lte("purchase_date", dateTo)
    .order("purchase_date", { ascending: true })
    .limit(EXPORT_RECEIPT_LIMIT);

  const { data: receipts, error: receiptError } = await receiptQuery;

  if (receiptError) {
    log.error("Accountant pack query failed", { businessId, error: receiptError.message });
    return NextResponse.json(
      { error: "Failed to retrieve export data" },
      { status: 500 }
    );
  }

  if (!receipts || receipts.length === 0) {
    return NextResponse.json(
      { error: "No receipts match the selected filters" },
      { status: 404 }
    );
  }

  // Filter items based on project, classification, and split status
  const filteredReceipts = receipts.map((r) => ({
    ...r,
    ii_receipt_items: (r.ii_receipt_items ?? []).filter((item: Record<string, unknown>) => {
      if (item.is_split_original) return false;
      if (projectId && item.project_id !== projectId) return false;
      if (classifications && classifications.length > 0) {
        return (classifications as string[]).includes(item.classification as string);
      }
      return true;
    }),
  })).filter((r) => r.ii_receipt_items.length > 0);

  if (filteredReceipts.length === 0) {
    return NextResponse.json(
      { error: "No items match the selected filters" },
      { status: 404 }
    );
  }

  const zip = new JSZip();

  // 1. Generate CSV
  const csvContent = buildCSV(filteredReceipts);
  zip.file(`export-${dateFrom}-to-${dateTo}.csv`, csvContent);

  // 2. Download receipt images and add to ZIP
  const imagesFolder = zip.folder("receipts");
  const receiptsWithImages = filteredReceipts.filter((r) => !!r.storage_key);
  const receiptsToDownload = receiptsWithImages.slice(0, MAX_IMAGES_PER_PACK);
  const imagesSkipped = Math.max(receiptsWithImages.length - receiptsToDownload.length, 0);

  const imageResults = await mapWithConcurrency(
    receiptsToDownload,
    IMAGE_DOWNLOAD_CONCURRENCY,
    async (receipt) => {
      try {
        const storageKey = receipt.storage_key!;
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("receipts")
          .download(storageKey);

        if (downloadError || !fileData) {
          log.warn("Failed to download receipt image for accountant pack", {
            receiptId: receipt.id,
            storageKey,
          });
          return false;
        }

        const ext = storageKey.split(".").pop() ?? "jpg";
        const dateStr = receipt.purchase_date ?? "unknown-date";
        const merchant = (receipt.merchant ?? "unknown")
          .replace(/[^a-zA-Z0-9-_ ]/g, "")
          .slice(0, 50);
        const filename = `${dateStr}_${merchant}_${receipt.id.slice(0, 8)}.${ext}`;

        const buffer = await fileData.arrayBuffer();
        imagesFolder?.file(filename, buffer);
        return true;
      } catch (err) {
        log.warn("Error downloading receipt image", {
          receiptId: receipt.id,
          error: err instanceof Error ? err.message : "Unknown",
        });
        return false;
      }
    }
  );

  const imageCount = imageResults.filter(Boolean).length;

  // 3. Generate plain text summary
  const summary = buildSummary(filteredReceipts, dateFrom, dateTo, imageCount, imagesSkipped);
  zip.file("summary.txt", summary);

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

  // Mark receipts as exported if requested
  if (markExported) {
    const allReceiptIds = filteredReceipts.map((r) => r.id);

    // Only mark receipts as exported when no classification filter is applied,
    // meaning the entire receipt was included. A partial export should not
    // mark the whole receipt as exported.
    const receiptIdsToMark = classifications && classifications.length > 0
      ? [] // Filtered export — don't mark
      : allReceiptIds;

    const now = new Date().toISOString();

    if (receiptIdsToMark.length > 0) {
      const { error: updateError } = await supabase
        .from("ii_receipts")
        .update({ status: "exported", exported_at: now })
        .eq("business_id", businessId)
        .in("id", receiptIdsToMark)
        .in("status", ["complete", "in_review"]);

      if (updateError) {
        log.error("Failed to mark receipts as exported", {
          businessId,
          error: updateError.message,
          receiptCount: receiptIdsToMark.length,
        });
      }
    }

    const { error: auditError } = await supabase.rpc("log_ii_audit_event", {
      p_business_id: businessId,
      p_actor_id: userId,
      p_entity_type: "export",
      p_entity_id: null,
      p_event_type: "accountant_pack_exported",
      p_after_state: null,
      p_metadata: {
        date_from: dateFrom,
        date_to: dateTo,
        project_id: projectId ?? null,
        classifications: classifications ?? [],
        receipt_count: allReceiptIds.length,
        receipts_marked_exported: receiptIdsToMark.length,
        image_count: imageCount,
      },
    });

    if (auditError) {
      log.error("Failed to log accountant pack export audit event", {
        businessId,
        error: auditError.message,
      });
    }

    // Record the export action for per-action quota counting
    await supabase.from("ii_export_log").insert({
      business_id: businessId,
      user_id: userId,
      export_type: "accountant_pack",
      receipt_count: allReceiptIds.length,
    });
  }

  const filename = `itemize-it-accountant-pack-${dateFrom}-to-${dateTo}.zip`;

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ============================================
// Helpers
// ============================================

interface ExportReceipt {
  id: string;
  merchant: string | null;
  merchant_address: string | null;
  purchase_date: string | null;
  total_cents: number | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  currency: string;
  payment_method: string | null;
  payment_source: string;
  ii_receipt_items: ExportItem[];
}

interface ExportItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number | null;
  total_price_cents: number;
  subtotal_cents: number | null;
  tax_cents: number | null;
  tax_rate: number | null;
  tax_calculation_method: string | null;
  classification: string;
  category: string | null;
  tax_category: string | null;
  project_id: string | null;
  notes: string | null;
}

function buildCSV(receipts: ExportReceipt[]): string {
  const headers = [
    "Date",
    "Merchant",
    "Item",
    "Description",
    "Qty",
    "Unit Price",
    "Total",
    "Subtotal",
    "Tax",
    "Tax Rate",
    "Tax Method",
    "Classification",
    "Category",
    "Tax Category",
    "Payment Method",
    "Payment Source",
    "Notes",
    "Receipt ID",
    "Item ID",
  ];

  const rows: string[][] = [headers];

  for (const receipt of receipts) {
    for (const item of receipt.ii_receipt_items) {
      rows.push([
        receipt.purchase_date ?? "",
        sanitizeForSpreadsheet(receipt.merchant ?? ""),
        sanitizeForSpreadsheet(item.name),
        sanitizeForSpreadsheet(item.description ?? ""),
        String(item.quantity),
        centsToStr(item.unit_price_cents),
        centsToStr(item.total_price_cents),
        centsToStr(item.subtotal_cents),
        centsToStr(item.tax_cents),
        item.tax_rate != null ? String(item.tax_rate) : "",
        item.tax_calculation_method ?? "",
        item.classification,
        sanitizeForSpreadsheet(item.category ?? ""),
        sanitizeForSpreadsheet(item.tax_category ?? ""),
        receipt.payment_method ?? "",
        receipt.payment_source ?? "",
        sanitizeForSpreadsheet(item.notes ?? ""),
        receipt.id,
        item.id,
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
}

function buildSummary(
  receipts: ExportReceipt[],
  dateFrom: string,
  dateTo: string,
  imageCount: number,
  imagesSkipped: number = 0
): string {
  const totalItems = receipts.reduce((s, r) => s + r.ii_receipt_items.length, 0);
  const totalSpendCents = receipts.reduce(
    (s, r) => s + r.ii_receipt_items.reduce((is, item) => is + item.total_price_cents, 0),
    0
  );

  // Aggregate by classification
  const byClass: Record<string, number> = {};
  // Aggregate by tax category
  const byTaxCat: Record<string, number> = {};

  for (const receipt of receipts) {
    for (const item of receipt.ii_receipt_items) {
      byClass[item.classification] = (byClass[item.classification] ?? 0) + item.total_price_cents;
      if (item.tax_category) {
        byTaxCat[item.tax_category] = (byTaxCat[item.tax_category] ?? 0) + item.total_price_cents;
      }
    }
  }

  const imageNote = imagesSkipped > 0
    ? `Receipt images included: ${imageCount} (${imagesSkipped} omitted — max ${MAX_IMAGES_PER_PACK} per pack)`
    : `Receipt images included: ${imageCount}`;

  const lines = [
    "ITEMIZE-IT EXPORT SUMMARY",
    "=".repeat(40),
    "",
    `Period: ${dateFrom} to ${dateTo}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "OVERVIEW",
    "-".repeat(40),
    `Receipts: ${receipts.length}`,
    `Line items: ${totalItems}`,
    imageNote,
    `Total spend: $${(totalSpendCents / 100).toFixed(2)}`,
    "",
    "BY CLASSIFICATION",
    "-".repeat(40),
  ];

  for (const [cls, cents] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${cls.padEnd(20)} $${(cents / 100).toFixed(2)}`);
  }

  if (Object.keys(byTaxCat).length > 0) {
    lines.push("");
    lines.push("BY TAX CATEGORY");
    lines.push("-".repeat(40));
    for (const [cat, cents] of Object.entries(byTaxCat).sort((a, b) => b[1] - a[1])) {
      const label = cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`  ${label.padEnd(25)} $${(cents / 100).toFixed(2)}`);
    }
  }

  lines.push("");
  lines.push("=".repeat(40));
  lines.push("Generated by Itemize-It (https://itemize-it.com)");

  return lines.join("\n");
}

function centsToStr(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Prevent CSV/Excel formula injection when exported files are opened in
 * spreadsheet tools.
 */
function sanitizeForSpreadsheet(value: string): string {
  if (/^[\t\r ]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (true) {
        const current = nextIndex++;
        if (current >= items.length) return;
        results[current] = await worker(items[current], current);
      }
    }
  );

  await Promise.all(runners);
  return results;
}

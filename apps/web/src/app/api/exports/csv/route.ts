import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { canExport } from "@/lib/plan-gate";
import { log } from "@/lib/logger";
import { z } from "zod";

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

/** Maximum line items per export to prevent memory/timeout issues */
const EXPORT_ITEM_LIMIT = 10_000;

/**
 * POST /api/exports/csv
 * Generate a CSV of line items matching the filter criteria.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Plan gate: check export quota
  const exportQuota = await canExport(businessId);
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

  // Query line items joined with receipt data
  let query = supabase
    .from("ii_receipt_items")
    .select(`
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
      expense_type,
      category,
      tax_category,
      project_id,
      notes,
      receipt_id,
      ii_receipts!inner(
        merchant,
        merchant_address,
        purchase_date,
        total_cents,
        tax_cents,
        currency,
        payment_method,
        payment_source,
        status
      )
    `)
    .eq("business_id", businessId)
    .gte("ii_receipts.purchase_date", dateFrom)
    .lte("ii_receipts.purchase_date", dateTo)
    .eq("is_split_original", false); // Exclude parent split items

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  if (classifications && classifications.length > 0) {
    query = query.in("classification", classifications);
  }

  // Order by receipt date, then item name; cap at limit to prevent memory issues
  query = query.order("receipt_id").limit(EXPORT_ITEM_LIMIT);

  const { data: items, error } = await query;

  if (error) {
    log.error("CSV export query failed", { businessId, error: error.message });
    return NextResponse.json(
      { error: "Failed to retrieve export data" },
      { status: 500 }
    );
  }

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "No items match the selected filters" },
      { status: 404 }
    );
  }

  // Build CSV
  const CSV_HEADERS = [
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
    "Expense Type",
    "Category",
    "Tax Category",
    "Payment Method",
    "Payment Source",
    "Notes",
    "Receipt ID",
    "Item ID",
  ];

  const rows: string[][] = [CSV_HEADERS];

  for (const item of items) {
    const receipt = item.ii_receipts as unknown as {
      merchant: string | null;
      purchase_date: string | null;
      currency: string;
      payment_method: string | null;
      payment_source: string;
    };

    rows.push([
      receipt.purchase_date ?? "",
      receipt.merchant ?? "",
      item.name,
      item.description ?? "",
      String(item.quantity),
      formatCentsCSV(item.unit_price_cents),
      formatCentsCSV(item.total_price_cents),
      formatCentsCSV(item.subtotal_cents),
      formatCentsCSV(item.tax_cents),
      item.tax_rate != null ? String(item.tax_rate) : "",
      item.tax_calculation_method ?? "",
      item.classification,
      item.expense_type ?? "",
      item.category ?? "",
      item.tax_category ?? "",
      receipt.payment_method ?? "",
      receipt.payment_source ?? "",
      item.notes ?? "",
      item.receipt_id,
      item.id,
    ]);
  }

  const csvContent = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");

  // Mark receipts as exported if requested
  if (markExported) {
    const exportedReceiptIds = [...new Set(items.map((i) => i.receipt_id))];

    // Only mark receipts as exported when no classification filter is applied,
    // meaning the entire receipt was included. A partial export (e.g. only
    // "business" items) should not mark the whole receipt as exported.
    const receiptIdsToMark = classifications && classifications.length > 0
      ? [] // Filtered export — don't mark
      : exportedReceiptIds;

    const now = new Date().toISOString();

    if (receiptIdsToMark.length > 0) {
      const { error: updateError } = await supabase
        .from("ii_receipts")
        .update({ status: "exported", exported_at: now })
        .eq("business_id", businessId)
        .in("id", receiptIdsToMark)
        .in("status", ["complete", "in_review"]); // Don't downgrade archived

      if (updateError) {
        log.error("Failed to mark receipts as exported", {
          businessId,
          error: updateError.message,
          receiptCount: receiptIdsToMark.length,
        });
      }
    }

    // Audit log
    const { error: auditError } = await supabase.rpc("log_ii_audit_event", {
      p_business_id: businessId,
      p_actor_id: userId,
      p_entity_type: "export",
      p_entity_id: null,
      p_event_type: "csv_exported",
      p_after_state: null,
      p_metadata: {
        date_from: dateFrom,
        date_to: dateTo,
        project_id: projectId ?? null,
        classifications: classifications ?? [],
        item_count: items.length,
        receipt_count: exportedReceiptIds.length,
        receipts_marked_exported: receiptIdsToMark.length,
      },
    });

    if (auditError) {
      log.error("Failed to log CSV export audit event", {
        businessId,
        error: auditError.message,
      });
    }

    // Record the export action for per-action quota counting
    await supabase.from("ii_export_log").insert({
      business_id: businessId,
      user_id: userId,
      export_type: "csv",
      receipt_count: exportedReceiptIds.length,
    });
  }

  const filename = `itemize-it-export-${dateFrom}-to-${dateTo}.csv`;
  const truncated = items.length >= EXPORT_ITEM_LIMIT;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(truncated && { "X-Export-Truncated": "true", "X-Export-Limit": String(EXPORT_ITEM_LIMIT) }),
    },
  });
}

/** Format cents to dollars string for CSV (e.g., 1234 → "12.34") */
function formatCentsCSV(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

/** Escape a CSV field value — wrap in quotes if it contains commas, quotes, or newlines */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

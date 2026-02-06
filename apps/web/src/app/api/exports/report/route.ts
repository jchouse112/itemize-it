import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { log } from "@/lib/logger";

const ReportQuerySchema = z
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
  })
  .refine((d) => d.dateFrom <= d.dateTo, {
    message: "dateFrom must be on or before dateTo",
    path: ["dateFrom"],
  });

const REPORT_ITEM_LIMIT = 10_000;

interface ExportReportRpcResponse {
  byCategoryData: Array<{ label: string; cents: number }>;
  byProjectData: Array<{ label: string; cents: number }>;
  monthlyData: Array<{
    month: string;
    businessCents: number;
    personalCents: number;
    totalCents: number;
  }>;
  topMerchants: Array<{ label: string; cents: number }>;
  totalItemsCents: number;
  totalItemCount: number;
  receiptCount: number;
  exportedReceiptCount: number;
  truncated: boolean;
  limit: number;
}

/**
 * POST /api/exports/report
 * Build export analytics server-side to avoid heavy browser-side aggregation.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ReportQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { dateFrom, dateTo, projectId, classifications } = parsed.data;

  const { data, error } = await supabase.rpc("get_ii_exports_report", {
    p_business_id: businessId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_project_id: projectId ?? null,
    p_classifications:
      classifications && classifications.length > 0 ? classifications : null,
    p_limit: REPORT_ITEM_LIMIT,
  });

  if (error) {
    log.error("Export report RPC failed", { businessId, error: error.message });
    return NextResponse.json(
      { error: "Failed to build export report" },
      { status: 500 }
    );
  }

  const report = (data ?? null) as ExportReportRpcResponse | null;
  if (!report || Number(report.totalItemCount ?? 0) === 0) {
    return NextResponse.json({
      report: null,
      truncated: Boolean(report?.truncated),
      limit: Number(report?.limit ?? REPORT_ITEM_LIMIT),
    });
  }

  return NextResponse.json({
    report: {
      ...report,
      totalItemsCents: Number(report.totalItemsCents ?? 0),
      totalItemCount: Number(report.totalItemCount ?? 0),
      receiptCount: Number(report.receiptCount ?? 0),
      exportedReceiptCount: Number(report.exportedReceiptCount ?? 0),
    },
    truncated: Boolean(report.truncated),
    limit: Number(report.limit ?? REPORT_ITEM_LIMIT),
  });
}

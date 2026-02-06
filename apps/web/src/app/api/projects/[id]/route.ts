import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  client_name: z.string().max(200).nullable().optional(),
  budget_cents: z.number().int().nonnegative().nullable().optional(),
  material_target_percent: z.number().int().min(0).max(100).nullable().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

interface ProjectStatsRpcRow {
  item_count: number | string | null;
  total_cents: number | string | null;
  business_cents: number | string | null;
  material_cents: number | string | null;
  labour_cents: number | string | null;
}

/** GET /api/projects/[id] — Get a single project with its items (paginated) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  // Fetch project and business currency in parallel
  const [projectResult, businessResult] = await Promise.all([
    supabase
      .from("ii_projects")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single(),
    supabase
      .from("businesses")
      .select("default_currency, province_state")
      .eq("id", businessId)
      .single(),
  ]);

  const { data: project, error } = projectResult;
  const currency = businessResult.data?.default_currency ?? "USD";
  const provinceState = businessResult.data?.province_state ?? null;

  if (error || !project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    100
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  // Run paginated items query and aggregate stats query in parallel
  const [itemsResult, statsResult] = await Promise.all([
    supabase
      .from("ii_receipt_items")
      .select("*, ii_receipts(merchant, purchase_date, currency)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .rpc("get_ii_project_stats", { p_project_id: id })
      .single(),
  ]);

  const items = itemsResult.data ?? [];
  if (statsResult.error) {
    console.error("Failed to aggregate project stats:", statsResult.error.message);
  }
  const stats: ProjectStatsRpcRow = (statsResult.data as ProjectStatsRpcRow | null) ?? {
    item_count: 0,
    total_cents: 0,
    business_cents: 0,
    material_cents: 0,
    labour_cents: 0,
  };
  const itemCount = Number(stats.item_count ?? 0);
  const totalCents = Number(stats.total_cents ?? 0);
  const businessCents = Number(stats.business_cents ?? 0);
  const materialCents = Number(stats.material_cents ?? 0);
  const labourCents = Number(stats.labour_cents ?? 0);

  return NextResponse.json({
    project: {
      ...project,
      item_count: itemCount,
      total_cents: totalCents,
      business_cents: businessCents,
      material_cents: materialCents,
      labour_cents: labourCents,
    },
    items,
    total: itemCount,
    currency,
    provinceState,
  });
}

/** PATCH /api/projects/[id] — Update project fields */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const body = await request.json();
  const parsed = UpdateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      updates[key] = typeof value === "string" ? value.trim() : value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: project, error } = await supabase
    .from("ii_projects")
    .update(updates)
    .eq("id", id)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update project:", error.message);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }

  return NextResponse.json({ project });
}

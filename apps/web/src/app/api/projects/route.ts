import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { canCreateProject } from "@/lib/plan-gate";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  client_name: z.string().max(200).optional(),
  budget_cents: z.number().int().nonnegative().nullable().optional(),
  material_target_percent: z.number().int().min(0).max(100).nullable().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

/** GET /api/projects — List all projects for the current business */
export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const { data: projects, error } = await supabase
    .from("ii_projects")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list projects:", error.message);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ projects: [] });
  }

  // Single query to get all item stats for all projects at once (avoids N+1)
  const projectIds = projects.map((p) => p.id);
  const { data: allItems } = await supabase
    .from("ii_receipt_items")
    .select("project_id, total_price_cents, classification")
    .in("project_id", projectIds);

  // Aggregate stats per project
  const statsMap = new Map<
    string,
    { item_count: number; total_cents: number; business_cents: number }
  >();

  for (const item of allItems ?? []) {
    if (!item.project_id) continue;
    const stats = statsMap.get(item.project_id) ?? {
      item_count: 0,
      total_cents: 0,
      business_cents: 0,
    };
    stats.item_count++;
    stats.total_cents += item.total_price_cents ?? 0;
    if (item.classification === "business") {
      stats.business_cents += item.total_price_cents ?? 0;
    }
    statsMap.set(item.project_id, stats);
  }

  const projectsWithStats = projects.map((project) => ({
    ...project,
    ...(statsMap.get(project.id) ?? {
      item_count: 0,
      total_cents: 0,
      business_cents: 0,
    }),
  }));

  return NextResponse.json({ projects: projectsWithStats });
}

/** POST /api/projects — Create a new project */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  const body = await request.json();
  const parsed = CreateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, description, client_name, budget_cents } = parsed.data;

  // Enforce project limit for the business's plan
  const gate = await canCreateProject(businessId);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: `Project limit reached (${gate.used}/${gate.limit}). Upgrade your plan to create more projects.`,
        code: "LIMIT_REACHED",
      },
      { status: 403 }
    );
  }

  const { data: project, error } = await supabase
    .from("ii_projects")
    .insert({
      business_id: businessId,
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
      client_name: client_name?.trim() || null,
      budget_cents: budget_cents ?? null,
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create project:", error.message);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  return NextResponse.json({ project }, { status: 201 });
}

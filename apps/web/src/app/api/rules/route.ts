import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateRuleSchema = z.object({
  match_type: z.enum(["merchant", "keyword", "merchant_contains"]),
  match_value: z.string().min(1).max(500),
  classification: z
    .enum(["business", "personal", "unclassified"])
    .nullable()
    .optional(),
  category: z.string().max(200).nullable().optional(),
  tax_category: z.string().max(200).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

const UpdateRuleSchema = z.object({
  match_type: z.enum(["merchant", "keyword", "merchant_contains"]).optional(),
  match_value: z.string().min(1).max(500).optional(),
  classification: z
    .enum(["business", "personal", "unclassified"])
    .nullable()
    .optional(),
  category: z.string().max(200).nullable().optional(),
  tax_category: z.string().max(200).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

/** GET /api/rules — List categorization rules for the current business */
export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const { data: rules, error } = await supabase
    .from("ii_classification_rules")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list rules:", error.message);
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }

  return NextResponse.json({ rules: rules ?? [] });
}

/** POST /api/rules — Create a new categorization rule */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  const body = await request.json();
  const parsed = CreateRuleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { match_type, match_value, classification, category, tax_category, project_id } =
    parsed.data;

  const { data: rule, error } = await supabase
    .from("ii_classification_rules")
    .insert({
      business_id: businessId,
      user_id: userId,
      match_type,
      match_value: match_value.trim(),
      classification: classification ?? null,
      category: category ?? null,
      tax_category: tax_category ?? null,
      project_id: project_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create rule:", error.message);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }

  return NextResponse.json({ rule }, { status: 201 });
}

/** PATCH /api/rules — Update an existing rule by id (passed as query param) */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const url = new URL(request.url);
  const ruleId = url.searchParams.get("id");

  if (!ruleId || !UUID_REGEX.test(ruleId)) {
    return NextResponse.json(
      { error: "Valid rule id is required" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = UpdateRuleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Build update payload from only the provided fields
  const updates: Record<string, unknown> = {};
  const { match_type, match_value, classification, category, tax_category, project_id } =
    parsed.data;

  if (match_type !== undefined) updates.match_type = match_type;
  if (match_value !== undefined) updates.match_value = match_value.trim();
  if (classification !== undefined) updates.classification = classification;
  if (category !== undefined) updates.category = category;
  if (tax_category !== undefined) updates.tax_category = tax_category;
  if (project_id !== undefined) updates.project_id = project_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: rule, error } = await supabase
    .from("ii_classification_rules")
    .update(updates)
    .eq("id", ruleId)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update rule:", error.message);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }

  return NextResponse.json({ rule });
}

/** DELETE /api/rules — Delete a rule by id (passed as query param) */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const url = new URL(request.url);
  const ruleId = url.searchParams.get("id");

  if (!ruleId || !UUID_REGEX.test(ruleId)) {
    return NextResponse.json(
      { error: "Valid rule id is required" },
      { status: 400 }
    );
  }

  // Scope delete to the user's business to prevent cross-tenant deletion
  const { error } = await supabase
    .from("ii_classification_rules")
    .delete()
    .eq("id", ruleId)
    .eq("business_id", businessId);

  if (error) {
    console.error("Failed to delete rule:", error.message);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

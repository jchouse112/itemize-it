import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// API accepts match_type which maps to DB rule_type + match_mode
// "merchant" → rule_type="merchant", match_mode="exact"
// "merchant_contains" → rule_type="merchant", match_mode="contains"
// "keyword" → rule_type="keyword", match_mode="contains"
const CreateRuleSchema = z.object({
  match_type: z.enum(["merchant", "keyword", "merchant_contains"]),
  match_value: z.string().min(1).max(500),
  classification: z.enum(["business", "personal"]),
  tax_category: z.string().max(200).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

const UpdateRuleSchema = z.object({
  match_type: z.enum(["merchant", "keyword", "merchant_contains"]).optional(),
  match_value: z.string().min(1).max(500).optional(),
  classification: z.enum(["business", "personal"]).optional(),
  tax_category: z.string().max(200).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

/** Convert API match_type to DB rule_type and match_mode */
function parseMatchType(matchType: string): { rule_type: string; match_mode: string } {
  switch (matchType) {
    case "merchant":
      return { rule_type: "merchant", match_mode: "exact" };
    case "merchant_contains":
      return { rule_type: "merchant", match_mode: "contains" };
    case "keyword":
      return { rule_type: "keyword", match_mode: "contains" };
    default:
      return { rule_type: "merchant", match_mode: "contains" };
  }
}

/** Convert DB rule_type and match_mode to API match_type */
function toApiMatchType(ruleType: string, matchMode: string): string {
  if (ruleType === "merchant" && matchMode === "exact") return "merchant";
  if (ruleType === "merchant" && matchMode === "contains") return "merchant_contains";
  if (ruleType === "keyword") return "keyword";
  return "merchant_contains";
}

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

  // Transform DB columns to API format for frontend compatibility
  const transformedRules = (rules ?? []).map((rule) => ({
    id: rule.id,
    match_type: toApiMatchType(rule.rule_type, rule.match_mode),
    match_value: rule.pattern,
    classification: rule.classification,
    tax_category: rule.tax_category,
    project_id: rule.project_id,
    created_at: rule.created_at,
  }));

  return NextResponse.json({ rules: transformedRules });
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

  const { match_type, match_value, classification, tax_category, project_id } =
    parsed.data;

  // Convert API match_type to DB rule_type and match_mode
  const { rule_type, match_mode } = parseMatchType(match_type);

  const { data: rule, error } = await supabase
    .from("ii_classification_rules")
    .insert({
      business_id: businessId,
      user_id: userId,
      rule_type,
      pattern: match_value.trim(),
      match_mode,
      classification,
      tax_category: tax_category ?? null,
      project_id: project_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create rule:", error.message);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }

  // Transform response to API format
  const transformedRule = {
    id: rule.id,
    match_type: toApiMatchType(rule.rule_type, rule.match_mode),
    match_value: rule.pattern,
    classification: rule.classification,
    tax_category: rule.tax_category,
    project_id: rule.project_id,
    created_at: rule.created_at,
  };

  return NextResponse.json({ rule: transformedRule }, { status: 201 });
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
  const { match_type, match_value, classification, tax_category, project_id } =
    parsed.data;

  // Convert API match_type to DB rule_type and match_mode
  if (match_type !== undefined) {
    const { rule_type, match_mode } = parseMatchType(match_type);
    updates.rule_type = rule_type;
    updates.match_mode = match_mode;
  }
  if (match_value !== undefined) updates.pattern = match_value.trim();
  if (classification !== undefined) updates.classification = classification;
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

  // Transform response to API format
  const transformedRule = {
    id: rule.id,
    match_type: toApiMatchType(rule.rule_type, rule.match_mode),
    match_value: rule.pattern,
    classification: rule.classification,
    tax_category: rule.tax_category,
    project_id: rule.project_id,
    created_at: rule.created_at,
  };

  return NextResponse.json({ rule: transformedRule });
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

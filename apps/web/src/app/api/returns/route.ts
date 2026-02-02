import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import { ReturnStatusSchema } from "@/lib/validation";

/**
 * GET /api/returns — list return records for the current user's business.
 * Supports ?status=eligible|returned|expired filter.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No active business" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  let query = supabase
    .from("ii_returns")
    .select("*, ii_receipts(merchant, purchase_date)")
    .eq("business_id", membership.business_id)
    .order("return_by", { ascending: true });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    log.error("Failed to fetch returns", { error: error.message });
    return NextResponse.json({ error: "Failed to fetch returns" }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/returns — update return status.
 * Body: { id: string, status: "returned" | "ineligible" }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No active business" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = ReturnStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { id, status } = parsed.data;

  const { error } = await supabase
    .from("ii_returns")
    .update({ status })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) {
    log.error("Failed to update return", { error: error.message });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

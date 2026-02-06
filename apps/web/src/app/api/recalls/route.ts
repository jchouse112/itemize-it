import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import { RecallDismissSchema } from "@/lib/validation";

/**
 * GET /api/recalls — list recall matches for the current user's business.
 * Supports ?dismissed=true|false filter.
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
  const dismissed = searchParams.get("dismissed");

  let query = supabase
    .from("ii_recall_matches")
    .select("*, ii_recall_checks(status, checked_at, match_count)")
    .eq("business_id", membership.business_id)
    .order("matched_at", { ascending: false });

  // Filter by status: dismissed=false means status='active', dismissed=true means status='dismissed'
  if (dismissed === "false") {
    query = query.eq("status", "active");
  } else if (dismissed === "true") {
    query = query.eq("status", "dismissed");
  }

  const { data, error } = await query;

  if (error) {
    log.error("Failed to fetch recall matches", { error: error.message });
    return NextResponse.json({ error: "Failed to fetch recalls" }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/recalls — dismiss or undismiss a recall match.
 * Body: { id: string, dismissed: boolean }
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
  const parsed = RecallDismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { id, dismissed } = parsed.data;

  // Map boolean dismissed to status column value
  const newStatus = dismissed ? "dismissed" : "active";

  const { error } = await supabase
    .from("ii_recall_matches")
    .update({ status: newStatus })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) {
    log.error("Failed to update recall match", { error: error.message });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

/**
 * GET /api/warranties — list warranties for the current user's business.
 * Supports ?status=active|expiring_soon|expired filter.
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
    .from("ii_warranties")
    .select("*, ii_receipts(merchant, purchase_date)")
    .eq("business_id", membership.business_id)
    .order("end_date", { ascending: true });

  const now = new Date().toISOString().split("T")[0];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const soonDate = thirtyDaysFromNow.toISOString().split("T")[0];

  if (statusFilter === "active") {
    query = query.gte("end_date", now);
  } else if (statusFilter === "expiring_soon") {
    query = query.gte("end_date", now).lte("end_date", soonDate);
  } else if (statusFilter === "expired") {
    query = query.lt("end_date", now);
  }

  const { data, error } = await query;

  if (error) {
    log.error("Failed to fetch warranties", { error: error.message });
    return NextResponse.json({ error: "Failed to fetch warranties" }, { status: 500 });
  }

  return NextResponse.json(data);
}

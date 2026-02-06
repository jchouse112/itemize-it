import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

/**
 * GET /api/warranties/pending-items
 * Lists receipt items that should be reviewed/checked for warranty.
 */
export async function GET() {
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

  const { data, error } = await supabase
    .from("ii_receipt_items")
    .select(`
      id,
      receipt_id,
      name,
      total_price_cents,
      warranty_lookup_status,
      warranty_checked_at,
      ii_receipts!inner(merchant, purchase_date)
    `)
    .eq("business_id", membership.business_id)
    .or("warranty_eligible.eq.true,track_warranty.eq.true")
    .in("warranty_lookup_status", ["unknown", "error", "not_found", "in_progress"])
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    log.error("Failed to fetch pending warranty items", { error: error.message });
    return NextResponse.json(
      { error: "Failed to fetch pending warranty items" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}

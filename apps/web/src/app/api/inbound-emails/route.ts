import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { log } from "@/lib/logger";

/** GET /api/inbound-emails — List recent inbound emails with parsing status */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const { data: emails, count, error } = await supabase
    .from("ii_inbound_emails")
    .select("*", { count: "exact" })
    .eq("business_id", businessId)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    log.error("Failed to list inbound emails", { businessId });
    return NextResponse.json(
      { error: "Failed to load inbound emails" },
      { status: 500 }
    );
  }

  return NextResponse.json({ emails, total: count });
}

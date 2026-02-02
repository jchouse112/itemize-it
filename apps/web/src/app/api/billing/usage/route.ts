import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { getUsageSummary } from "@/lib/plan-gate";

/**
 * GET /api/billing/usage
 *
 * Returns current usage summary for the authenticated business.
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const usage = await getUsageSummary(businessId);
  if (!usage) {
    return NextResponse.json(
      { error: "Unable to load usage data" },
      { status: 500 }
    );
  }

  return NextResponse.json(usage);
}

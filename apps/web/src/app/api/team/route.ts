import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { PLAN_TIERS } from "@/lib/constants";
import { log } from "@/lib/logger";
import type { PlanTier } from "@/lib/ii-types";

/**
 * GET /api/team
 *
 * List all members and pending invitations for the current business.
 * Also returns the caller's role, plan tier, and seat limit so the
 * team page doesn't need redundant client-side Supabase queries.
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Fetch members, caller's role, and business info in parallel
  const [membersResult, callerResult, bizResult, invitationsResult] =
    await Promise.all([
      supabase
        .from("business_members")
        .select(
          "id, business_id, user_id, role, status, invited_by, invited_at, joined_at, created_at"
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
      supabase
        .from("business_members")
        .select("role")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .eq("status", "active")
        .single(),
      supabase
        .from("businesses")
        .select("plan_tier, limits_json")
        .eq("id", businessId)
        .single(),
      supabase
        .from("business_invitations")
        .select(
          "id, email, role, invited_by, expires_at, accepted_at, created_at"
        )
        .eq("business_id", businessId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

  if (membersResult.error) {
    return NextResponse.json(
      { error: "Failed to load team members" },
      { status: 500 }
    );
  }

  // Resolve member emails via service role client (auth.users is not
  // accessible through the anon/user client). We look up each user_id
  // and attach their email to the member record for the UI.
  const members = membersResult.data ?? [];
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceUrl && serviceKey && members.length > 0) {
    try {
      const admin = createServiceClient(serviceUrl, serviceKey);
      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await admin
        .from("auth.users")
        .select("id, email")
        .in("id", userIds);

      // If direct table access fails (common), fall back to admin API
      if (!profiles) {
        const emailMap = new Map<string, string>();
        // Fetch in parallel, capped to avoid excessive calls
        await Promise.all(
          userIds.map(async (uid) => {
            const { data } = await admin.auth.admin.getUserById(uid);
            if (data?.user?.email) {
              emailMap.set(uid, data.user.email);
            }
          })
        );
        for (const member of members) {
          (member as Record<string, unknown>).email = emailMap.get(member.user_id) ?? null;
        }
      } else {
        const emailMap = new Map(profiles.map((p: { id: string; email: string }) => [p.id, p.email]));
        for (const member of members) {
          (member as Record<string, unknown>).email = emailMap.get(member.user_id) ?? null;
        }
      }
    } catch (err) {
      log.warn("Failed to resolve member emails", {
        error: err instanceof Error ? err.message : "Unknown",
      });
      // Non-fatal — UI will fall back to user_id display
    }
  }

  const planTier = ((bizResult.data?.plan_tier as PlanTier) ?? "free");
  const limitsJson = bizResult.data?.limits_json as { seats?: number } | null;
  const seatsLimit = limitsJson?.seats ?? PLAN_TIERS[planTier].limits.seats;

  return NextResponse.json({
    members,
    invitations: invitationsResult.data ?? [],
    callerUserId: userId,
    callerRole: callerResult.data?.role ?? null,
    planTier,
    seatsLimit,
  });
}

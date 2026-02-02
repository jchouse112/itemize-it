import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import type { MemberRole } from "@/lib/ii-types";

interface AuthContext {
  userId: string;
  email: string;
  businessId: string;
}

interface AuthContextWithRole extends AuthContext {
  role: MemberRole;
}

/**
 * Validates the current user session and retrieves their active business membership.
 * Returns either the auth context or a NextResponse error to send back.
 *
 * NOTE: This relies on Supabase Row-Level Security (RLS) on the `business_members`
 * table to enforce data isolation. The RLS policy should restrict SELECT to rows
 * where `user_id = auth.uid()` so that even if this code is bypassed, the database
 * itself prevents cross-tenant access. Verify the policy exists in the Supabase
 * dashboard under Authentication → Policies → business_members.
 */
export async function getAuthContext(
  supabase: SupabaseClient
): Promise<{ ctx: AuthContextWithRole } | { error: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    log.warn("Auth failure: no valid session", {
      reason: "no_user",
    });
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    log.warn("Auth failure: no active business membership", {
      reason: membershipError ? "query_error" : "no_membership",
      userId: user.id,
      error: membershipError?.message,
    });
    return {
      error: NextResponse.json(
        { error: "No business found" },
        { status: 400 }
      ),
    };
  }

  return {
    ctx: {
      userId: user.id,
      email: user.email ?? "",
      businessId: membership.business_id,
      role: membership.role as MemberRole,
    },
  };
}

/**
 * Validates auth context and checks that the caller has one of the required roles.
 * Returns the context with role, or a 403 NextResponse error.
 *
 * Usage:
 *   const auth = await requireRole(supabase, ["owner", "admin"]);
 *   if ("error" in auth) return auth.error;
 *   const { userId, businessId, role } = auth.ctx;
 */
export async function requireRole(
  supabase: SupabaseClient,
  allowedRoles: MemberRole[]
): Promise<{ ctx: AuthContextWithRole } | { error: NextResponse }> {
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth;

  if (!allowedRoles.includes(auth.ctx.role)) {
    return {
      error: NextResponse.json(
        { error: `Requires one of: ${allowedRoles.join(", ")}` },
        { status: 403 }
      ),
    };
  }

  return auth as { ctx: AuthContextWithRole };
}

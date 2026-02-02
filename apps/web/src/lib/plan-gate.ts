import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PLAN_TIERS } from "@/lib/constants";
import type { PlanTier } from "@/lib/ii-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logger";

// ============================================
// Types
// ============================================

export interface UsageSummary {
  receiptsUsed: number;
  receiptsLimit: number;
  receiptsPercent: number;
  exportsUsed: number;
  exportsLimit: number;
  exportsPercent: number;
  seatsUsed: number;
  seatsLimit: number;
  planTier: PlanTier;
  hasStripeCustomer: boolean;
}

interface BusinessLimits {
  uploads_per_month: number;
  exports_per_month: number;
  seats: number;
  retention_days: number;
  projects_limit: number;
}

interface BusinessInfo {
  limits: BusinessLimits;
  planTier: PlanTier;
  stripeCustomerId: string | null;
}

// ============================================
// Helpers
// ============================================

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function getBusinessInfo(
  businessId: string,
  supabase?: SupabaseClient
): Promise<BusinessInfo | null> {
  const sb = supabase ?? (await createClient());
  const { data } = await sb
    .from("businesses")
    .select("plan_tier, limits_json, stripe_customer_id")
    .eq("id", businessId)
    .single();

  if (!data) return null;

  const tier = (data.plan_tier ?? "free") as PlanTier;
  const limits = (data.limits_json as BusinessLimits) ?? PLAN_TIERS[tier].limits;

  return { limits, planTier: tier, stripeCustomerId: data.stripe_customer_id ?? null };
}

// ============================================
// Receipt upload gate
// ============================================

export async function getReceiptCountThisMonth(
  businessId: string,
  supabase?: SupabaseClient
): Promise<number> {
  const sb = supabase ?? (await createClient());
  const monthStart = startOfMonth();

  const { count, error } = await sb
    .from("ii_receipts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", monthStart);

  if (error) {
    log.error("Failed to count receipts", { businessId, error: error.message });
    return 0;
  }

  return count ?? 0;
}

export async function canUploadReceipt(
  businessId: string,
  supabase?: SupabaseClient
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const sb = supabase ?? (await createClient());
  const biz = await getBusinessInfo(businessId, sb);
  if (!biz) return { allowed: false, used: 0, limit: 0 };

  const used = await getReceiptCountThisMonth(businessId, sb);
  const limit = biz.limits.uploads_per_month;

  return { allowed: used < limit, used, limit };
}

// ============================================
// Export gate
// ============================================

export async function getExportCountThisMonth(
  businessId: string,
  supabase?: SupabaseClient
): Promise<number> {
  const sb = supabase ?? (await createClient());
  const monthStart = startOfMonth();

  // Count export actions (not individual receipts) this month
  const { count, error } = await sb
    .from("ii_export_log")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", monthStart);

  if (error) {
    log.error("Failed to count exports", { businessId, error: error.message });
    return 0;
  }

  return count ?? 0;
}

export async function canExport(
  businessId: string,
  supabase?: SupabaseClient
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const sb = supabase ?? (await createClient());
  const biz = await getBusinessInfo(businessId, sb);
  if (!biz) return { allowed: false, used: 0, limit: 0 };

  const used = await getExportCountThisMonth(businessId, sb);
  const limit = biz.limits.exports_per_month;

  return { allowed: used < limit, used, limit };
}

// ============================================
// Seat gate
// ============================================

export async function getSeatCount(
  businessId: string,
  supabase?: SupabaseClient
): Promise<number> {
  const sb = supabase ?? (await createClient());

  // Count active members AND pending invitations toward the seat limit.
  // Without this, a team at 9/10 seats could send unlimited invitations
  // and exceed the seat cap when they're all accepted.
  const [membersResult, invitationsResult] = await Promise.all([
    sb
      .from("business_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active"),
    sb
      .from("business_invitations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);

  if (membersResult.error) {
    log.error("Failed to count seats", { businessId, error: membersResult.error.message });
    return 0;
  }
  if (invitationsResult.error) {
    log.error("Failed to count pending invitations", { businessId, error: invitationsResult.error.message });
    return membersResult.count ?? 0;
  }

  return (membersResult.count ?? 0) + (invitationsResult.count ?? 0);
}

export async function canInviteMember(
  businessId: string,
  supabase?: SupabaseClient
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const sb = supabase ?? (await createClient());
  const biz = await getBusinessInfo(businessId, sb);
  if (!biz) return { allowed: false, used: 0, limit: 0 };

  const used = await getSeatCount(businessId, sb);
  const limit = biz.limits.seats;

  return { allowed: used < limit, used, limit };
}

// ============================================
// Project gate
// ============================================

export async function getProjectCount(
  businessId: string,
  supabase?: SupabaseClient
): Promise<number> {
  const sb = supabase ?? (await createClient());

  const { count, error } = await sb
    .from("ii_projects")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["active", "completed"]);

  if (error) {
    log.error("Failed to count projects", { businessId, error: error.message });
    return 0;
  }

  return count ?? 0;
}

export async function canCreateProject(
  businessId: string,
  supabase?: SupabaseClient
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const sb = supabase ?? (await createClient());
  const biz = await getBusinessInfo(businessId, sb);
  if (!biz) return { allowed: false, used: 0, limit: 0 };

  const used = await getProjectCount(businessId, sb);
  const limit = biz.limits.projects_limit;

  return { allowed: used < limit, used, limit };
}

// ============================================
// Full usage summary
// ============================================

/**
 * Returns a complete usage summary for a business.
 * Uses a single Supabase client for all queries to avoid redundant connections.
 * Includes `hasStripeCustomer` so the billing page doesn't need extra client-side queries.
 */
export async function getUsageSummary(
  businessId: string,
  supabase?: SupabaseClient
): Promise<UsageSummary | null> {
  const sb = supabase ?? (await createClient());

  const biz = await getBusinessInfo(businessId, sb);
  if (!biz) return null;

  const [receiptsUsed, exportsUsed, seatsUsed] = await Promise.all([
    getReceiptCountThisMonth(businessId, sb),
    getExportCountThisMonth(businessId, sb),
    getSeatCount(businessId, sb),
  ]);

  const receiptsLimit = biz.limits.uploads_per_month;
  const exportsLimit = biz.limits.exports_per_month;
  const seatsLimit = biz.limits.seats;

  return {
    receiptsUsed,
    receiptsLimit,
    receiptsPercent: receiptsLimit > 0 ? Math.round((receiptsUsed / receiptsLimit) * 100) : 0,
    exportsUsed,
    exportsLimit,
    exportsPercent: exportsLimit > 0 ? Math.round((exportsUsed / exportsLimit) * 100) : 0,
    seatsUsed,
    seatsLimit,
    planTier: biz.planTier,
    hasStripeCustomer: !!biz.stripeCustomerId,
  };
}

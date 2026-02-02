import "server-only";
import Stripe from "stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PLAN_TIERS } from "@/lib/constants";
import type { PlanTier } from "@/lib/ii-types";
import { log } from "@/lib/logger";

// ============================================
// Stripe client singleton
// ============================================

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-01-28.clover" });
  }
  return _stripe;
}

// ============================================
// Service-role Supabase client for webhooks
// ============================================

/**
 * Creates a Supabase client with the service-role key.
 * Used by webhook handlers that run without a user session
 * and need to bypass RLS to update business records.
 */
function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createSupabaseClient(url, key);
}

// ============================================
// Price ID → Tier mapping (cached at module level)
// ============================================

/**
 * Lazily-built map from Stripe price ID → PlanTier.
 * Built once on first access and cached for the lifetime of the process.
 * Includes both monthly and annual price IDs for each tier.
 */
let _priceToTierMap: Map<string, PlanTier> | null = null;

function getPriceToTierMap(): Map<string, PlanTier> {
  if (!_priceToTierMap) {
    _priceToTierMap = new Map<string, PlanTier>();
    for (const config of Object.values(PLAN_TIERS)) {
      // Monthly price
      if (config.stripePriceEnvKey) {
        const priceId = process.env[config.stripePriceEnvKey];
        if (priceId) {
          _priceToTierMap.set(priceId, config.tier);
        }
      }
      // Annual price
      if (config.stripePriceAnnualEnvKey) {
        const priceId = process.env[config.stripePriceAnnualEnvKey];
        if (priceId) {
          _priceToTierMap.set(priceId, config.tier);
        }
      }
    }
  }
  return _priceToTierMap;
}

export function tierFromPriceId(priceId: string): PlanTier | null {
  return getPriceToTierMap().get(priceId) ?? null;
}

// ============================================
// Customer management
// ============================================

/**
 * Get or create a Stripe customer for a business.
 * Stores the customer ID in `businesses.stripe_customer_id`.
 */
export async function getOrCreateCustomer(
  businessId: string,
  email: string
): Promise<string> {
  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("stripe_customer_id, name")
    .eq("id", businessId)
    .single();

  if (biz?.stripe_customer_id) return biz.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: biz?.name ?? undefined,
    metadata: { business_id: businessId },
  });

  // Use conditional update to prevent race conditions: only set the customer ID
  // if it hasn't been set by a concurrent request. If another request won the
  // race, use their customer ID and clean up the one we just created.
  const { data: updated } = await supabase
    .from("businesses")
    .update({ stripe_customer_id: customer.id })
    .eq("id", businessId)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id")
    .single();

  if (!updated) {
    // Another request won the race — re-read and use the existing customer ID,
    // then delete the orphaned Stripe customer we just created.
    const { data: reFetched } = await supabase
      .from("businesses")
      .select("stripe_customer_id")
      .eq("id", businessId)
      .single();

    if (reFetched?.stripe_customer_id) {
      stripe.customers.del(customer.id).catch((err) => {
        log.warn("Failed to clean up orphaned Stripe customer", {
          orphanedCustomerId: customer.id,
          businessId,
          error: String(err),
        });
      });
      return reFetched.stripe_customer_id;
    }
  }

  log.info("Stripe customer created", { businessId, customerId: customer.id });

  return customer.id;
}

// ============================================
// Checkout & Portal sessions
// ============================================

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  businessId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl,
    metadata: { business_id: businessId },
    subscription_data: {
      metadata: { business_id: businessId },
    },
  });

  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ============================================
// Subscription status handling
// ============================================

/** Subscription statuses where the user should retain their paid tier */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Subscription statuses that get a grace period (keep tier but warn user) */
const GRACE_PERIOD_STATUSES = new Set(["past_due"]);

/**
 * Sync a Stripe subscription to the database.
 * Called from webhooks when subscription changes.
 * Uses a service-role client to bypass RLS (no user session in webhook context).
 *
 * Handles status transitions:
 * - active / trialing → sync tier normally
 * - past_due → keep tier (grace period) but log warning
 * - incomplete / incomplete_expired / canceled / unpaid → downgrade to free
 */
export async function syncSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  const businessId = subscription.metadata?.business_id;
  if (!businessId) {
    log.warn("Subscription has no business_id in metadata", {
      subscriptionId: subscription.id,
    });
    return;
  }

  const status = subscription.status;

  // If the subscription is in a terminal/failed state, downgrade immediately
  if (!ACTIVE_STATUSES.has(status) && !GRACE_PERIOD_STATUSES.has(status)) {
    log.warn("Subscription in non-active status, downgrading", {
      subscriptionId: subscription.id,
      businessId,
      status,
    });
    await downgradeToFree(businessId);
    return;
  }

  // For past_due: keep the tier but log a warning. The invoice.payment_failed
  // handler will create an in-app notification for the user.
  if (GRACE_PERIOD_STATUSES.has(status)) {
    log.warn("Subscription past_due — grace period, keeping tier", {
      subscriptionId: subscription.id,
      businessId,
      status,
    });
  }

  // Determine the tier from the first item's price
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    log.warn("Subscription has no price ID", {
      subscriptionId: subscription.id,
    });
    return;
  }

  const tier = tierFromPriceId(priceId);
  if (!tier) {
    log.warn("Unknown price ID on subscription", {
      subscriptionId: subscription.id,
      priceId,
    });
    return;
  }

  const planConfig = PLAN_TIERS[tier];
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      plan_tier: tier,
      stripe_subscription_id: subscription.id,
      limits_json: planConfig.limits,
    })
    .eq("id", businessId);

  if (error) {
    log.error("Failed to sync subscription to DB", {
      businessId,
      subscriptionId: subscription.id,
      error: error.message,
    });
  } else {
    log.info("Subscription synced", {
      businessId,
      tier,
      status,
      subscriptionId: subscription.id,
    });
  }
}

/**
 * Downgrade a business to free tier (e.g., subscription cancelled).
 * Uses a service-role client to bypass RLS (no user session in webhook context).
 *
 * Existing data that exceeds free-tier limits remains accessible (read-only)
 * but the plan gates prevent new creates. Admins are notified with details
 * about what's over the limit so they can clean up or re-subscribe.
 */
export async function downgradeToFree(businessId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const freeConfig = PLAN_TIERS.free;

  const { error } = await supabase
    .from("businesses")
    .update({
      plan_tier: "free",
      stripe_subscription_id: null,
      limits_json: freeConfig.limits,
    })
    .eq("id", businessId);

  if (error) {
    log.error("Failed to downgrade business to free", {
      businessId,
      error: error.message,
    });
    return;
  }

  log.info("Business downgraded to free", { businessId });

  // Notify admins/owners about the downgrade and any over-limit data
  await notifyDowngrade(businessId, supabase);
}

/**
 * Creates in-app notifications for admins/owners when a business is downgraded
 * to free tier. Includes details about what exceeds free-tier limits so users
 * know what's affected.
 */
async function notifyDowngrade(
  businessId: string,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<void> {
  const freeLimits = PLAN_TIERS.free.limits;

  // Check what exceeds free-tier limits
  const [membersResult, projectsResult] = await Promise.all([
    supabase
      .from("business_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active"),
    supabase
      .from("ii_projects")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["active", "completed"]),
  ]);

  const memberCount = membersResult.count ?? 0;
  const projectCount = projectsResult.count ?? 0;

  const overLimits: string[] = [];
  if (memberCount > freeLimits.seats) {
    overLimits.push(`${memberCount} team members (free limit: ${freeLimits.seats})`);
  }
  if (projectCount > freeLimits.projects_limit) {
    overLimits.push(`${projectCount} projects (free limit: ${freeLimits.projects_limit})`);
  }

  const overLimitText = overLimits.length > 0
    ? ` Your account currently has: ${overLimits.join("; ")}. Existing data is still accessible, but new items can't be added until you're within limits or upgrade.`
    : "";

  // Get admin/owner members to notify
  const { data: admins } = await supabase
    .from("business_members")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("status", "active")
    .in("role", ["owner", "admin"]);

  if (!admins || admins.length === 0) return;

  const notifications = admins.map((admin) => ({
    business_id: businessId,
    user_id: admin.user_id,
    type: "plan_downgraded",
    entity_id: businessId,
    title: "Plan downgraded to Free",
    body: `Your subscription has ended and your account has been moved to the Free (Solo) plan.${overLimitText}`,
  }));

  const { error } = await supabase
    .from("ii_notifications")
    .insert(notifications);

  if (error) {
    log.error("Failed to create downgrade notifications", {
      businessId,
      error: error.message,
    });
  }
}

// ============================================
// Payment failure notification
// ============================================

/**
 * Creates an in-app notification for all admin/owner members of the business
 * when an invoice payment fails. This gives users visibility into billing
 * issues before their subscription is cancelled.
 */
export async function notifyPaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const sub = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof sub === "string" ? sub : sub?.id;

  log.warn("Invoice payment failed", {
    invoiceId: invoice.id,
    subscriptionId: subscriptionId ?? "unknown",
    customerEmail: invoice.customer_email,
  });

  if (!subscriptionId) return;

  const supabase = createServiceRoleClient();

  // Look up the business from the subscription ID
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!biz) {
    log.warn("No business found for failed invoice subscription", {
      subscriptionId,
    });
    return;
  }

  // Get all admin/owner members to notify
  const { data: admins } = await supabase
    .from("business_members")
    .select("user_id")
    .eq("business_id", biz.id)
    .eq("status", "active")
    .in("role", ["owner", "admin"]);

  if (!admins || admins.length === 0) return;

  const amountDisplay = invoice.amount_due
    ? `$${(invoice.amount_due / 100).toFixed(2)}`
    : "your subscription";

  const notifications = admins.map((admin) => ({
    business_id: biz.id,
    user_id: admin.user_id,
    type: "payment_failed",
    entity_id: biz.id,
    title: "Payment failed",
    body: `We were unable to process payment for ${amountDisplay}. Please update your payment method in Billing settings to avoid service interruption.`,
  }));

  const { error } = await supabase
    .from("ii_notifications")
    .insert(notifications);

  if (error) {
    log.error("Failed to create payment_failed notifications", {
      businessId: biz.id,
      error: error.message,
    });
  } else {
    log.info("Payment failed notifications created", {
      businessId: biz.id,
      notifiedUsers: admins.length,
    });
  }
}

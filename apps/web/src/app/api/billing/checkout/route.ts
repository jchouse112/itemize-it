import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth-helpers";
import { getOrCreateCustomer, createCheckoutSession } from "@/lib/stripe";
import { CheckoutRequestSchema } from "@/lib/validation";
import { PLAN_TIERS } from "@/lib/constants";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for upgrading to a paid plan.
 * Accepts { tier: "starter" | "pro" | "enterprise" } and resolves
 * the actual Stripe price ID server-side from environment variables.
 * Returns { url } for the client to redirect to.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["owner", "admin"]);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const parsed = CheckoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { tier, interval } = parsed.data;

  // Resolve the actual Stripe price ID from tier + interval
  const planConfig = PLAN_TIERS[tier];
  const envKey = interval === "year"
    ? planConfig.stripePriceAnnualEnvKey
    : planConfig.stripePriceEnvKey;

  if (!envKey) {
    return NextResponse.json(
      { error: "This plan does not support checkout" },
      { status: 400 }
    );
  }

  const priceId = process.env[envKey];
  if (!priceId) {
    log.error("Stripe price ID not configured for tier", { tier, interval, envKey });
    return NextResponse.json(
      { error: "Billing is not configured for this plan" },
      { status: 500 }
    );
  }

  try {
    const customerId = await getOrCreateCustomer(businessId, auth.ctx.email);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      log.error("NEXT_PUBLIC_APP_URL is not set — cannot create checkout session");
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 500 }
      );
    }
    const returnUrl = `${appUrl}/app/settings/billing`;

    const url = await createCheckoutSession(
      customerId,
      priceId,
      businessId,
      returnUrl
    );

    log.info("Checkout session created", { businessId, userId, tier, interval, priceId });

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Failed to create checkout session", {
      businessId,
      userId,
      error: message,
    });
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

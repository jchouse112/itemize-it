import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth-helpers";
import { createBillingPortalSession } from "@/lib/stripe";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Billing Portal session for managing subscription/payment.
 * Returns { url } for the client to redirect to.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["owner", "admin"]);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Get the business's Stripe customer ID
  const { data: biz } = await supabase
    .from("businesses")
    .select("stripe_customer_id")
    .eq("id", businessId)
    .single();

  if (!biz?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found. Please subscribe to a plan first." },
      { status: 400 }
    );
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      log.error("NEXT_PUBLIC_APP_URL is not set — cannot create portal session");
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 500 }
      );
    }
    const returnUrl = `${appUrl}/app/settings/billing`;

    const url = await createBillingPortalSession(
      biz.stripe_customer_id,
      returnUrl
    );

    log.info("Billing portal session created", { businessId, userId });

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Failed to create billing portal session", {
      businessId,
      userId,
      error: message,
    });
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    );
  }
}

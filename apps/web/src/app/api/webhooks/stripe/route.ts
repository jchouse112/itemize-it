import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getStripe,
  syncSubscription,
  downgradeToFree,
  notifyPaymentFailed,
} from "@/lib/stripe";
import { PLAN_TIERS } from "@/lib/constants";
import { log } from "@/lib/logger";
import type Stripe from "stripe";

// ============================================
// Idempotency: skip duplicate webhook events
// ============================================
// Uses a database table (ii_stripe_webhook_events) for idempotency so it
// works correctly on serverless platforms where each invocation may run
// in a separate isolate with no shared in-memory state.

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set");
  return createSupabaseClient(url, key);
}

async function isAlreadyProcessed(eventId: string): Promise<boolean> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("ii_stripe_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .single();
  return !!data;
}

async function markProcessed(eventId: string, eventType: string): Promise<void> {
  const sb = getServiceClient();
  await sb
    .from("ii_stripe_webhook_events")
    .upsert({ event_id: eventId, event_type: eventType })
    .select()
    .single();
}

// ============================================
// Webhook handler
// ============================================

/**
 * POST /api/webhooks/stripe
 *
 * Stripe sends webhook events here. We verify the signature and handle
 * subscription lifecycle events to keep the businesses table in sync.
 *
 * This route must NOT use Supabase auth — Stripe calls it directly.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.warn("Stripe webhook signature verification failed", { error: message });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Idempotency check — skip duplicate events
  if (await isAlreadyProcessed(event.id)) {
    log.info("Stripe webhook skipped (duplicate)", { type: event.type, id: event.id });
    return NextResponse.json({ received: true });
  }

  log.info("Stripe webhook received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && session.metadata?.business_id) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          // Ensure the subscription has the business_id metadata
          if (!subscription.metadata?.business_id) {
            await stripe.subscriptions.update(subscription.id, {
              metadata: { business_id: session.metadata.business_id },
            });
            subscription.metadata.business_id = session.metadata.business_id;
          }
          await syncSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const businessId = subscription.metadata?.business_id;
        if (businessId) {
          await downgradeToFree(businessId);
        }
        break;
      }

      case "customer.subscription.paused": {
        // Paused subscriptions should restrict to free limits but preserve
        // the subscription ID so resuming can restore the tier automatically.
        const subscription = event.data.object as Stripe.Subscription;
        const businessId = subscription.metadata?.business_id;
        if (businessId) {
          const supabase = getServiceClient();
          const freeConfig = PLAN_TIERS.free;
          await supabase
            .from("businesses")
            .update({
              plan_tier: "free",
              limits_json: freeConfig.limits,
              // Keep stripe_subscription_id so resume can restore the tier
            })
            .eq("id", businessId);
          log.info("Subscription paused — downgraded to free limits", {
            businessId,
            subscriptionId: subscription.id,
          });
        }
        break;
      }

      case "customer.subscription.resumed": {
        // Resuming a paused subscription — re-sync to restore the paid tier
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await notifyPaymentFailed(invoice);
        break;
      }

      default:
        log.info("Unhandled Stripe event type", { type: event.type });
    }
    // Mark as processed only after successful handling
    await markProcessed(event.id, event.type);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Error processing Stripe webhook", {
      type: event.type,
      error: message,
    });
    // Return 500 so Stripe retries — the event is NOT marked as processed
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

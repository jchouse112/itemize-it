"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  ArrowUpRight,
  Check,
  Loader2,
  AlertCircle,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { PLAN_TIERS } from "@/lib/constants";
import type { PlanTier, BillingInterval } from "@/lib/ii-types";

interface UsageData {
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

// Derive the plan display list from the single source of truth in constants.ts
const PLANS = Object.values(PLAN_TIERS);
const TIER_ORDER: PlanTier[] = ["free", "starter", "pro", "enterprise"];

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("year");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/billing/usage");
        if (!res.ok) throw new Error("Failed to load usage data");
        const data: UsageData = await res.json();
        setUsage(data);
      } catch {
        setError("Failed to load billing data");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleUpgrade(tier: PlanTier) {
    if (tier === "free") return;

    setUpgrading(tier);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to start checkout");
        setUpgrading(null);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setUpgrading(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to open billing portal");
        setPortalLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin" />
      </div>
    );
  }

  const currentTierIndex = TIER_ORDER.indexOf(usage?.planTier ?? "free");
  const hasStripeCustomer = usage?.hasStripeCustomer ?? false;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/app/settings"
          className="text-concrete hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Current Usage */}
      {usage && (
        <section className="bg-gunmetal border border-edge-steel rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-safety-orange" />
            <h2 className="text-lg font-semibold text-white">
              Current Usage
            </h2>
            <span className="ml-auto text-sm text-concrete">
              {
                {
                  free: "Solo (Free)",
                  starter: "Starter",
                  pro: "Pro",
                  enterprise: "Team",
                }[usage.planTier]
              }{" "}
              plan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Receipt usage */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-concrete">Receipts this month</span>
                <span className="text-white font-medium">
                  {usage.receiptsUsed} / {usage.receiptsLimit}
                </span>
              </div>
              <div className="h-2 bg-asphalt rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.receiptsPercent >= 90
                      ? "bg-critical"
                      : usage.receiptsPercent >= 70
                        ? "bg-warn"
                        : "bg-safety-orange"
                  }`}
                  style={{
                    width: `${Math.min(usage.receiptsPercent, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Export usage */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-concrete">Exports this month</span>
                <span className="text-white font-medium">
                  {usage.exportsUsed} / {usage.exportsLimit}
                </span>
              </div>
              <div className="h-2 bg-asphalt rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.exportsPercent >= 90
                      ? "bg-critical"
                      : usage.exportsPercent >= 70
                        ? "bg-warn"
                        : "bg-safety-orange"
                  }`}
                  style={{
                    width: `${Math.min(usage.exportsPercent, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Manage billing button for paid plans */}
          {hasStripeCustomer && (
            <div className="mt-4 pt-4 border-t border-edge-steel">
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="flex items-center gap-2 text-sm text-safety-orange hover:underline disabled:opacity-50"
              >
                {portalLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5" />
                )}
                Manage subscription & payment
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Plan Cards */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Plans</h2>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center gap-1 bg-asphalt rounded-lg p-1">
            <button
              onClick={() => setInterval("month")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                interval === "month"
                  ? "bg-gunmetal text-white font-medium"
                  : "text-concrete hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                interval === "year"
                  ? "bg-gunmetal text-white font-medium"
                  : "text-concrete hover:text-white"
              }`}
            >
              Annual
              <span className="ml-1 text-xs text-safe">Save ~17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const planIndex = TIER_ORDER.indexOf(plan.tier);
            const isCurrent = plan.tier === (usage?.planTier ?? "free");
            const isUpgrade = planIndex > currentTierIndex;
            const isDowngrade = planIndex < currentTierIndex;

            const displayPrice =
              interval === "year"
                ? plan.priceAnnual
                : plan.priceMonthly;
            const perMonthEquivalent =
              interval === "year" && plan.priceAnnual > 0
                ? Math.round((plan.priceAnnual / 12) * 100) / 100
                : null;

            return (
              <div
                key={plan.tier}
                className={`relative bg-gunmetal border rounded-xl p-5 flex flex-col ${
                  isCurrent
                    ? "border-safety-orange"
                    : "border-edge-steel"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-4 bg-safety-orange text-white text-xs font-semibold px-2 py-0.5 rounded">
                    Current
                  </div>
                )}

                <h3 className="text-white font-semibold text-lg">
                  {plan.label}
                </h3>
                <p className="text-concrete text-sm mt-1">
                  {plan.description}
                </p>

                <div className="mt-3 mb-4">
                  {displayPrice === 0 ? (
                    <span className="text-2xl font-bold text-white">Free</span>
                  ) : interval === "month" ? (
                    <div>
                      <span className="text-2xl font-bold text-white">
                        ${displayPrice}
                      </span>
                      <span className="text-concrete text-sm">/mo</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold text-white">
                        ${displayPrice}
                      </span>
                      <span className="text-concrete text-sm">/yr</span>
                      {perMonthEquivalent && (
                        <div className="text-xs text-concrete mt-0.5">
                          ${perMonthEquivalent}/mo equivalent
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-concrete"
                    >
                      <Check className="w-3.5 h-3.5 text-safe mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="text-center text-sm text-concrete py-2">
                    Your current plan
                  </div>
                ) : isUpgrade ? (
                  <button
                    onClick={() => handleUpgrade(plan.tier)}
                    disabled={upgrading !== null}
                    className="flex items-center justify-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
                  >
                    {upgrading === plan.tier ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Upgrade
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                ) : isDowngrade && hasStripeCustomer ? (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="flex items-center justify-center gap-2 bg-asphalt border border-edge-steel hover:border-concrete/40 text-concrete hover:text-white rounded-lg px-4 py-2.5 text-sm transition-colors"
                  >
                    Downgrade
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

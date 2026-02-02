export const BUSINESS_TYPES = [
  { value: "sole_proprietor", label: "Sole Proprietor" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "s_corp", label: "S-Corp" },
  { value: "partnership", label: "Partnership" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
] as const;

export const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// ============================================
// Plan Tiers
// ============================================

import type { PlanTier } from "@itemize-it/types";

export interface PlanConfig {
  tier: PlanTier;
  label: string;
  description: string;
  priceMonthly: number; // display price in dollars (0 = free)
  priceAnnual: number; // display price in dollars per year (0 = free)
  stripePriceEnvKey: string | null; // monthly price — null for free tier
  stripePriceAnnualEnvKey: string | null; // annual price — null for free tier
  limits: {
    uploads_per_month: number;
    exports_per_month: number;
    seats: number;
    retention_days: number;
    projects_limit: number;
  };
  features: string[];
}

export const PLAN_TIERS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    label: "Solo",
    description: "For getting started",
    priceMonthly: 0,
    priceAnnual: 0,
    stripePriceEnvKey: null,
    stripePriceAnnualEnvKey: null,
    limits: {
      uploads_per_month: 5,
      exports_per_month: 1,
      seats: 1,
      retention_days: 90,
      projects_limit: 2,
    },
    features: [
      "5 receipts/month",
      "1 export/month",
      "90-day retention",
      "2 projects",
      "AI extraction",
    ],
  },
  starter: {
    tier: "starter",
    label: "Starter",
    description: "For freelancers & side hustles",
    priceMonthly: 9,
    priceAnnual: 90,
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
    stripePriceAnnualEnvKey: "STRIPE_PRICE_STARTER_ANNUAL",
    limits: {
      uploads_per_month: 50,
      exports_per_month: 5,
      seats: 1,
      retention_days: 395,
      projects_limit: 10,
    },
    features: [
      "50 receipts/month",
      "5 exports/month",
      "13-month retention",
      "10 projects",
      "AI extraction",
      "Email forwarding",
      "Lifecycle tracking",
    ],
  },
  pro: {
    tier: "pro",
    label: "Pro",
    description: "For growing businesses",
    priceMonthly: 29,
    priceAnnual: 290,
    stripePriceEnvKey: "STRIPE_PRICE_PRO",
    stripePriceAnnualEnvKey: "STRIPE_PRICE_PRO_ANNUAL",
    limits: {
      uploads_per_month: 300,
      exports_per_month: 20,
      seats: 3,
      retention_days: 760,
      projects_limit: 50,
    },
    features: [
      "300 receipts/month",
      "20 exports/month",
      "25-month retention",
      "50 projects",
      "AI extraction",
      "Email forwarding",
      "Lifecycle tracking",
      "3 team seats",
    ],
  },
  enterprise: {
    tier: "enterprise",
    label: "Team",
    description: "For teams & firms",
    priceMonthly: 79,
    priceAnnual: 790,
    stripePriceEnvKey: "STRIPE_PRICE_ENTERPRISE",
    stripePriceAnnualEnvKey: "STRIPE_PRICE_ENTERPRISE_ANNUAL",
    limits: {
      uploads_per_month: 1000,
      exports_per_month: 50,
      seats: 10,
      retention_days: -1,
      projects_limit: 200,
    },
    features: [
      "1000 receipts/month",
      "50 exports/month",
      "Unlimited retention",
      "200 projects",
      "AI extraction",
      "Email forwarding",
      "Lifecycle tracking",
      "10 team seats",
      "Priority support",
    ],
  },
} as const;

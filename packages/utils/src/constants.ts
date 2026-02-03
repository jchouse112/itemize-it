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

// Canadian provinces with their tax types
export const CANADIAN_PROVINCES = [
  { value: "AB", label: "Alberta", taxLabel: "GST" },
  { value: "BC", label: "British Columbia", taxLabel: "GST/PST" },
  { value: "MB", label: "Manitoba", taxLabel: "GST/PST" },
  { value: "NB", label: "New Brunswick", taxLabel: "HST" },
  { value: "NL", label: "Newfoundland and Labrador", taxLabel: "HST" },
  { value: "NS", label: "Nova Scotia", taxLabel: "HST" },
  { value: "NT", label: "Northwest Territories", taxLabel: "GST" },
  { value: "NU", label: "Nunavut", taxLabel: "GST" },
  { value: "ON", label: "Ontario", taxLabel: "HST" },
  { value: "PE", label: "Prince Edward Island", taxLabel: "HST" },
  { value: "QC", label: "Quebec", taxLabel: "GST/QST" },
  { value: "SK", label: "Saskatchewan", taxLabel: "GST/PST" },
  { value: "YT", label: "Yukon", taxLabel: "GST" },
] as const;

// US states (simplified list)
export const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
] as const;

/**
 * Get the tax exclusion text based on currency and province/state
 */
export function getTaxExclusionText(currency: string, provinceState?: string | null): string {
  if (currency === "CAD") {
    if (provinceState) {
      const province = CANADIAN_PROVINCES.find((p) => p.value === provinceState);
      if (province) {
        return `Excludes ${province.taxLabel}`;
      }
    }
    // Fallback for CAD without province
    return "Excludes GST/HST/QST";
  }
  // USD and others
  return "Excludes sales tax";
}

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// ============================================
// Currency Conversion (Approximate Rates)
// ============================================

/**
 * Fallback approximate exchange rates (used when API is unavailable).
 * Format: { [fromCurrency]: { [toCurrency]: rate } }
 */
export const FALLBACK_EXCHANGE_RATES: Record<string, Record<string, number>> = {
  USD: { CAD: 1.36, EUR: 0.92, GBP: 0.79 },
  CAD: { USD: 0.74, EUR: 0.68, GBP: 0.58 },
  EUR: { USD: 1.09, CAD: 1.47, GBP: 0.86 },
  GBP: { USD: 1.27, CAD: 1.72, EUR: 1.16 },
};

const EXCHANGE_RATE_CACHE_KEY = "ii_exchange_rates";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ExchangeRateCache {
  rates: Record<string, Record<string, number>>;
  fetchedAt: number;
}

/**
 * Get cached exchange rates from localStorage.
 * Returns null if cache is missing or expired.
 */
function getCachedRates(): ExchangeRateCache | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
    if (!cached) return null;
    const parsed: ExchangeRateCache = JSON.parse(cached);
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(EXCHANGE_RATE_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save exchange rates to localStorage cache.
 */
function setCachedRates(rates: Record<string, Record<string, number>>): void {
  if (typeof window === "undefined") return;
  try {
    const cache: ExchangeRateCache = { rates, fetchedAt: Date.now() };
    localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Fetch live exchange rates from Frankfurter API.
 * Returns rates for common currencies (USD, CAD, EUR, GBP).
 */
async function fetchLiveRates(): Promise<Record<string, Record<string, number>> | null> {
  const bases = ["USD", "CAD", "EUR", "GBP"];
  const rates: Record<string, Record<string, number>> = {};

  try {
    // Fetch rates for each base currency in parallel
    const results = await Promise.all(
      bases.map(async (base) => {
        const res = await fetch(
          `https://api.frankfurter.app/latest?from=${base}&to=${bases.filter(c => c !== base).join(",")}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        return { base, rates: data.rates as Record<string, number> };
      })
    );

    for (const result of results) {
      if (result) {
        rates[result.base] = result.rates;
      }
    }

    return Object.keys(rates).length > 0 ? rates : null;
  } catch {
    return null;
  }
}

/**
 * Get exchange rates (from cache, API, or fallback).
 * Call this once when the page loads.
 */
export async function getExchangeRates(): Promise<Record<string, Record<string, number>>> {
  // Check cache first
  const cached = getCachedRates();
  if (cached) {
    return cached.rates;
  }

  // Fetch live rates
  const liveRates = await fetchLiveRates();
  if (liveRates) {
    setCachedRates(liveRates);
    return liveRates;
  }

  // Fall back to approximate rates
  return FALLBACK_EXCHANGE_RATES;
}

/**
 * Convert cents from one currency to another using provided rates.
 * Returns null if no conversion rate is available.
 */
export function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, Record<string, number>>
): number | null {
  if (fromCurrency === toCurrency) return cents;
  const rate = rates[fromCurrency]?.[toCurrency];
  if (!rate) return null;
  return Math.round(cents * rate);
}

/**
 * Check if a receipt currency differs from the business currency (foreign purchase).
 */
export function isForeignCurrency(
  receiptCurrency: string | undefined | null,
  businessCurrency: string
): boolean {
  if (!receiptCurrency) return false;
  return receiptCurrency !== businessCurrency;
}

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

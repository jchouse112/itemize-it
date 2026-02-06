/**
 * Warranty heuristics for Itemize-It.
 * Adapted from Recevity's warranty/heuristics.ts — uses ii_warranties table.
 */

import type { WarrantyCategory, WarrantySource, ItemCategory } from "@/lib/ii-types";

interface WarrantyEstimate {
  category: WarrantyCategory;
  durationMonths: number;
  confidence: number;
}

export interface WarrantyDetectionResult {
  category: WarrantyCategory;
  startDate: string;
  endDate: string;
  confidence: number;
  isEstimated: boolean;
  warrantySource: WarrantySource;
}

// ============================================
// Date helpers (local calendar-day semantics)
// ============================================

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateOnlyLocal(dateStr: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", options);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() + months);
  return result;
}

function getToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// ============================================
// Unified warranty pattern table
// ============================================
// Each entry is tagged with its match context:
//   "merchant" — only matches against merchant/retailer names
//   "brand"    — only matches against brand/manufacturer names
//   "both"     — matches in either context
//
// When a key appears in both merchant and brand contexts with
// identical category+duration, it's tagged "both" to avoid duplication.

type MatchContext = "merchant" | "brand" | "both";

interface WarrantyPatternEntry {
  category: WarrantyCategory;
  durationMonths: number;
  context: MatchContext;
}

const WARRANTY_PATTERNS: [string, WarrantyPatternEntry][] = [
  // ── Electronics: retailers ──
  ["best buy",      { category: "electronics", durationMonths: 12, context: "merchant" }],
  ["amazon",        { category: "electronics", durationMonths: 12, context: "merchant" }],
  ["newegg",        { category: "electronics", durationMonths: 12, context: "merchant" }],
  ["micro center",  { category: "electronics", durationMonths: 12, context: "merchant" }],
  ["b&h",           { category: "electronics", durationMonths: 12, context: "merchant" }],

  // ── Electronics: brands (merchant + brand) ──
  ["apple",         { category: "electronics", durationMonths: 12, context: "both" }],
  ["samsung",       { category: "electronics", durationMonths: 12, context: "both" }],
  ["sony",          { category: "electronics", durationMonths: 12, context: "both" }],
  ["lg",            { category: "electronics", durationMonths: 12, context: "both" }],
  ["dell",          { category: "electronics", durationMonths: 12, context: "both" }],
  ["hp",            { category: "electronics", durationMonths: 12, context: "both" }],
  ["lenovo",        { category: "electronics", durationMonths: 12, context: "both" }],

  // ── Electronics: brand-only ──
  ["asus",          { category: "electronics", durationMonths: 12, context: "brand" }],
  ["acer",          { category: "electronics", durationMonths: 12, context: "brand" }],
  ["microsoft",     { category: "electronics", durationMonths: 12, context: "brand" }],
  ["google",        { category: "electronics", durationMonths: 12, context: "brand" }],
  ["bose",          { category: "electronics", durationMonths: 12, context: "brand" }],
  ["jbl",           { category: "electronics", durationMonths: 12, context: "brand" }],
  ["canon",         { category: "electronics", durationMonths: 12, context: "brand" }],
  ["nikon",         { category: "electronics", durationMonths: 12, context: "brand" }],
  ["gopro",         { category: "electronics", durationMonths: 12, context: "brand" }],
  ["nintendo",      { category: "electronics", durationMonths: 12, context: "brand" }],
  ["playstation",   { category: "electronics", durationMonths: 12, context: "brand" }],
  ["xbox",          { category: "electronics", durationMonths: 12, context: "brand" }],
  ["fitbit",        { category: "electronics", durationMonths: 12, context: "brand" }],
  ["garmin",        { category: "electronics", durationMonths: 12, context: "brand" }],
  ["ring",          { category: "electronics", durationMonths: 12, context: "brand" }],
  ["nest",          { category: "electronics", durationMonths: 24, context: "brand" }],
  ["ecobee",        { category: "electronics", durationMonths: 36, context: "brand" }],

  // ── Appliances: retailers ──
  ["home depot",    { category: "appliances", durationMonths: 12, context: "merchant" }],
  ["lowe's",        { category: "appliances", durationMonths: 12, context: "merchant" }],
  ["lowes",         { category: "appliances", durationMonths: 12, context: "merchant" }],
  ["sears",         { category: "appliances", durationMonths: 12, context: "merchant" }],

  // ── Appliances: brands (merchant + brand) ──
  ["whirlpool",     { category: "appliances", durationMonths: 12, context: "both" }],
  ["ge appliances", { category: "appliances", durationMonths: 12, context: "both" }],
  ["maytag",        { category: "appliances", durationMonths: 12, context: "both" }],
  ["kitchenaid",    { category: "appliances", durationMonths: 12, context: "both" }],

  // ── Appliances: brand-only ──
  ["ge",            { category: "appliances", durationMonths: 12, context: "brand" }],
  ["frigidaire",    { category: "appliances", durationMonths: 12, context: "brand" }],
  ["bosch",         { category: "appliances", durationMonths: 24, context: "brand" }],
  ["miele",         { category: "appliances", durationMonths: 24, context: "brand" }],
  ["sub-zero",      { category: "appliances", durationMonths: 24, context: "brand" }],
  ["thermador",     { category: "appliances", durationMonths: 24, context: "brand" }],
  ["viking",        { category: "appliances", durationMonths: 24, context: "brand" }],
  ["wolf",          { category: "appliances", durationMonths: 24, context: "brand" }],
  ["electrolux",    { category: "appliances", durationMonths: 12, context: "brand" }],
  ["kenmore",       { category: "appliances", durationMonths: 12, context: "brand" }],
  ["amana",         { category: "appliances", durationMonths: 12, context: "brand" }],
  ["speed queen",   { category: "appliances", durationMonths: 36, context: "brand" }],
  ["dyson",         { category: "appliances", durationMonths: 24, context: "brand" }],
  ["shark",         { category: "appliances", durationMonths: 24, context: "brand" }],
  ["roomba",        { category: "appliances", durationMonths: 12, context: "brand" }],
  ["irobot",        { category: "appliances", durationMonths: 12, context: "brand" }],

  // ── Tools: retailers ──
  ["harbor freight", { category: "tools", durationMonths: 12, context: "merchant" }],

  // ── Tools: brands (merchant + brand) ──
  ["dewalt",        { category: "tools", durationMonths: 36, context: "both" }],
  ["milwaukee",     { category: "tools", durationMonths: 60, context: "both" }],
  ["makita",        { category: "tools", durationMonths: 36, context: "both" }],
  ["craftsman",     { category: "tools", durationMonths: 12, context: "both" }],
  ["snap-on",       { category: "tools", durationMonths: 12, context: "both" }],
  ["stanley",       { category: "tools", durationMonths: 12, context: "both" }],

  // ── Tools: brand-only ──
  ["bosch tools",   { category: "tools", durationMonths: 12, context: "brand" }],
  ["ryobi",         { category: "tools", durationMonths: 36, context: "brand" }],
  ["ridgid",        { category: "tools", durationMonths: 36, context: "brand" }],
  ["black & decker", { category: "tools", durationMonths: 24, context: "brand" }],
  ["husqvarna",     { category: "tools", durationMonths: 24, context: "brand" }],
  ["stihl",         { category: "tools", durationMonths: 24, context: "brand" }],
  ["honda",         { category: "tools", durationMonths: 36, context: "brand" }],
  ["toro",          { category: "tools", durationMonths: 24, context: "brand" }],
  ["john deere",    { category: "tools", durationMonths: 24, context: "brand" }],

  // ── Furniture: brands (merchant + brand) ──
  ["ikea",          { category: "furniture", durationMonths: 12, context: "both" }],
  ["pottery barn",  { category: "furniture", durationMonths: 12, context: "both" }],
  ["west elm",      { category: "furniture", durationMonths: 12, context: "both" }],
  ["crate & barrel", { category: "furniture", durationMonths: 12, context: "both" }],

  // ── Furniture: retailers ──
  ["wayfair",       { category: "furniture", durationMonths: 12, context: "merchant" }],
  ["ashley",        { category: "furniture", durationMonths: 12, context: "merchant" }],
  ["rooms to go",   { category: "furniture", durationMonths: 12, context: "merchant" }],

  // ── Furniture: brand-only ──
  ["herman miller", { category: "furniture", durationMonths: 144, context: "brand" }],
  ["steelcase",     { category: "furniture", durationMonths: 144, context: "brand" }],
  ["knoll",         { category: "furniture", durationMonths: 60, context: "brand" }],
  ["restoration hardware", { category: "furniture", durationMonths: 12, context: "brand" }],
  ["ethan allen",   { category: "furniture", durationMonths: 12, context: "brand" }],
  ["la-z-boy",      { category: "furniture", durationMonths: 12, context: "brand" }],

  // ── Clothing: retailers ──
  ["nike",          { category: "clothing", durationMonths: 6, context: "merchant" }],
  ["adidas",        { category: "clothing", durationMonths: 6, context: "merchant" }],
  ["nordstrom",     { category: "clothing", durationMonths: 6, context: "merchant" }],
  ["macy's",        { category: "clothing", durationMonths: 6, context: "merchant" }],
  ["macys",         { category: "clothing", durationMonths: 6, context: "merchant" }],

  // ── Jewelry: retailers ──
  ["tiffany",       { category: "jewelry", durationMonths: 24, context: "merchant" }],
  ["kay jewelers",  { category: "jewelry", durationMonths: 12, context: "merchant" }],
  ["zales",         { category: "jewelry", durationMonths: 12, context: "merchant" }],
  ["jared",         { category: "jewelry", durationMonths: 12, context: "merchant" }],

  // ── Automotive: retailers ──
  ["autozone",      { category: "automotive", durationMonths: 12, context: "merchant" }],
  ["advance auto",  { category: "automotive", durationMonths: 12, context: "merchant" }],
  ["o'reilly",      { category: "automotive", durationMonths: 12, context: "merchant" }],
  ["napa",          { category: "automotive", durationMonths: 12, context: "merchant" }],
  ["tire rack",     { category: "automotive", durationMonths: 12, context: "merchant" }],
  ["discount tire", { category: "automotive", durationMonths: 12, context: "merchant" }],

  // ── Automotive: brand-only ──
  ["michelin",      { category: "automotive", durationMonths: 72, context: "brand" }],
  ["goodyear",      { category: "automotive", durationMonths: 72, context: "brand" }],
  ["bridgestone",   { category: "automotive", durationMonths: 72, context: "brand" }],
  ["bosch automotive", { category: "automotive", durationMonths: 12, context: "brand" }],
  ["denso",         { category: "automotive", durationMonths: 12, context: "brand" }],
];

// ============================================
// Pre-built Maps for O(1) exact-match lookup
// ============================================
// At module load, split the unified table into two Maps (merchant / brand)
// for fast exact-key lookups. Substring matching falls back to a filtered
// array scan only when the exact lookup misses.

type PatternInfo = { category: WarrantyCategory; durationMonths: number };

const merchantExact = new Map<string, PatternInfo>();
const merchantSubstring: [string, PatternInfo][] = [];
const brandExact = new Map<string, PatternInfo>();
const brandSubstring: [string, PatternInfo][] = [];

for (const [key, entry] of WARRANTY_PATTERNS) {
  const info: PatternInfo = { category: entry.category, durationMonths: entry.durationMonths };
  if (entry.context === "merchant" || entry.context === "both") {
    merchantExact.set(key, info);
    merchantSubstring.push([key, info]);
  }
  if (entry.context === "brand" || entry.context === "both") {
    brandExact.set(key, info);
    brandSubstring.push([key, info]);
  }
}

const categoryDefaults: Record<WarrantyCategory, number> = {
  electronics: 12,
  appliances: 12,
  tools: 12,
  furniture: 12,
  clothing: 6,
  jewelry: 12,
  vehicles: 12,
  automotive: 12,
  other: 12,
};

const priceThresholds = {
  highValue: 500,
  premium: 1000,
};

const itemCategoryToWarrantyCategory: Partial<Record<ItemCategory, WarrantyCategory>> = {
  computers: "electronics",
  phones: "electronics",
  tablets: "electronics",
  tvs: "electronics",
  audio: "electronics",
  cameras: "electronics",
  gaming: "electronics",
  wearables: "electronics",
  smart_home: "electronics",
  appliances_major: "appliances",
  appliances_small: "appliances",
  furniture: "furniture",
  lighting: "other",
  decor: "other",
  bedding: "other",
  tools_power: "tools",
  tools_hand: "tools",
  outdoor_equipment: "tools",
  lawn_garden: "tools",
  clothing: "clothing",
  shoes: "clothing",
  jewelry: "jewelry",
  watches: "jewelry",
  bags: "clothing",
  vehicles: "vehicles",
  automotive_parts: "automotive",
  bicycles: "vehicles",
  fitness: "other",
  sports: "other",
  camping: "other",
  office: "other",
  kitchen: "appliances",
  baby: "other",
  pets: "other",
  health: "other",
  other: "other",
};

// ============================================
// Detection functions
// ============================================

export function detectWarrantyFromMerchant(merchant: string): WarrantyEstimate | null {
  const normalized = merchant.toLowerCase().trim();

  // O(1) exact match first
  const exact = merchantExact.get(normalized);
  if (exact) {
    return { category: exact.category, durationMonths: exact.durationMonths, confidence: 0.8 };
  }

  // Substring fallback
  for (const [pattern, info] of merchantSubstring) {
    if (normalized.includes(pattern)) {
      return { category: info.category, durationMonths: info.durationMonths, confidence: 0.8 };
    }
  }
  return null;
}

export function estimateWarrantyFromPrice(total: number): WarrantyEstimate | null {
  if (total >= priceThresholds.premium) {
    return { category: "other", durationMonths: 12, confidence: 0.5 };
  }
  if (total >= priceThresholds.highValue) {
    return { category: "other", durationMonths: 12, confidence: 0.4 };
  }
  return null;
}

export function detectWarrantyFromBrand(brand: string): WarrantyEstimate | null {
  const normalized = brand.toLowerCase().trim();

  // O(1) exact match first (high confidence)
  const exact = brandExact.get(normalized);
  if (exact) {
    return { category: exact.category, durationMonths: exact.durationMonths, confidence: 0.85 };
  }

  // Substring fallback (lower confidence)
  for (const [pattern, info] of brandSubstring) {
    if (normalized.includes(pattern) || pattern.includes(normalized)) {
      return { category: info.category, durationMonths: info.durationMonths, confidence: 0.7 };
    }
  }
  return null;
}

export function detectWarrantyFromItemCategory(itemCategory: ItemCategory): WarrantyEstimate | null {
  const warrantyCategory = itemCategoryToWarrantyCategory[itemCategory];
  if (!warrantyCategory) return null;
  return {
    category: warrantyCategory,
    durationMonths: categoryDefaults[warrantyCategory],
    confidence: 0.5,
  };
}

/**
 * Main warranty detection with fallback chain.
 * Priority: brand → merchant → item category → price → generic fallback.
 */
export function detectWarrantyWithFallback(params: {
  merchant?: string | null;
  brand?: string | null;
  itemCategory?: ItemCategory | null;
  total?: number | null;
  purchaseDate?: string | null;
  manufacturedYear?: number | null;
  allowGenericFallback?: boolean;
}): WarrantyDetectionResult | null {
  const {
    merchant,
    brand,
    itemCategory,
    total,
    purchaseDate,
    manufacturedYear,
    allowGenericFallback = true,
  } = params;

  let startDateStr: string;
  let isEstimated: boolean;
  let warrantySource: WarrantySource;

  if (purchaseDate) {
    startDateStr = purchaseDate;
    isEstimated = false;
    warrantySource = "receipt";
  } else if (manufacturedYear) {
    startDateStr = `${manufacturedYear}-01-01`;
    isEstimated = true;
    warrantySource = "manufactured_year";
  } else {
    return null;
  }

  let estimate: WarrantyEstimate | null = null;
  if (brand) estimate = detectWarrantyFromBrand(brand);
  if (!estimate && merchant) estimate = detectWarrantyFromMerchant(merchant);
  if (!estimate && itemCategory) estimate = detectWarrantyFromItemCategory(itemCategory);
  if (!estimate && total != null) estimate = estimateWarrantyFromPrice(total);
  if (!estimate) {
    if (!allowGenericFallback) return null;
    estimate = { category: "other", durationMonths: categoryDefaults.other, confidence: 0.3 };
  }

  const startDate = parseDateOnly(startDateStr);
  const endDate = addMonths(startDate, estimate.durationMonths);
  const finalConfidence = isEstimated
    ? Math.max(0.1, estimate.confidence - 0.2)
    : estimate.confidence;

  return {
    category: estimate.category,
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
    confidence: finalConfidence,
    isEstimated,
    warrantySource,
  };
}

export function getWarrantyCategoryFromItemCategory(itemCategory: ItemCategory): WarrantyCategory {
  return itemCategoryToWarrantyCategory[itemCategory] || "other";
}

export function isWarrantyActive(endDate: string): boolean {
  return parseDateOnly(endDate) >= getToday();
}

export function getDaysRemaining(endDate: string): number {
  const end = parseDateOnly(endDate);
  const today = getToday();
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getWarrantyStatus(endDate: string): {
  status: "active" | "expiring_soon" | "expired";
  label: string;
  daysRemaining: number;
} {
  const days = getDaysRemaining(endDate);

  if (days < 0) {
    return { status: "expired", label: "Expired", daysRemaining: days };
  }
  if (days <= 30) {
    return {
      status: "expiring_soon",
      label: `Expires in ${days} day${days === 1 ? "" : "s"}`,
      daysRemaining: days,
    };
  }
  if (days <= 90) {
    return {
      status: "expiring_soon",
      label: `Expires in ${Math.ceil(days / 30)} month${Math.ceil(days / 30) === 1 ? "" : "s"}`,
      daysRemaining: days,
    };
  }
  return {
    status: "active",
    label: `Valid until ${formatDateOnlyLocal(endDate, { month: "short", year: "numeric" })}`,
    daysRemaining: days,
  };
}

export function getDefaultDuration(category: WarrantyCategory): number {
  return categoryDefaults[category];
}

/**
 * Itemize-It shared utility functions.
 * All functions here are pure and have zero external dependencies.
 */

/**
 * Format a dollar amount as currency
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format an integer cents value as currency.
 * This is the primary formatting function — all amounts are stored as integer cents.
 */
export function formatCents(
  cents: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return formatCurrency(cents / 100, currency, locale);
}

/**
 * Parse a currency string to a number
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and thousands separators
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate the sum of an array of numbers
 */
export function sum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

/**
 * Round a number to specified decimal places
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate percentage
 */
export function percentage(part: number, whole: number): number {
  if (whole === 0) return 0;
  return roundTo((part / whole) * 100, 2);
}

/**
 * Format a date string to a localized format
 */
export function formatDate(
  date: string | Date,
  locale: string = "en-US",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, options ?? {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string (YYYY-MM-DD) for receipt/project display.
 * Appends T00:00:00 to prevent timezone shift on date-only strings.
 */
export function formatReceiptDate(
  dateStr: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", options ?? {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format cents with null handling (returns em-dash for null).
 */
export function formatCentsDisplay(
  cents: number | null,
  currency: string = "USD"
): string {
  if (cents == null) return "\u2014";
  return formatCents(cents, currency);
}

/**
 * Generate a unique ID (client-side only, not cryptographically secure)
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// Split helpers (Phase 4)
// ============================================

export interface SplitRow {
  amountCents: number;
  classification: "business" | "personal" | "unclassified";
  label?: string;
}

/**
 * Prorate tax across split rows proportional to their amounts.
 * Uses largest-remainder method to ensure the pieces sum exactly to totalTaxCents.
 *
 * NOTE: This function is intentionally called in two places:
 * - Client-side (SplitItemModal) for preview display only
 * - Server-side (split API route) as the authoritative computation
 * The server never trusts the client's tax values for prorated mode.
 */
export function prorateTax(
  totalTaxCents: number,
  rows: { amountCents: number }[]
): number[] {
  const totalAmount = rows.reduce((s, r) => s + r.amountCents, 0);
  if (totalAmount === 0 || totalTaxCents === 0) {
    return rows.map(() => 0);
  }

  // Exact (fractional) allocation per row
  const exact = rows.map((r) => (r.amountCents / totalAmount) * totalTaxCents);
  // Floor each allocation
  const floored = exact.map(Math.floor);
  // Remainder to distribute
  let remainder = totalTaxCents - floored.reduce((s, v) => s + v, 0);

  // Distribute remainder one cent at a time to rows with largest fractional parts
  const fractionals = exact.map((v, i) => ({ idx: i, frac: v - floored[i] }));
  fractionals.sort((a, b) => b.frac - a.frac);

  for (const { idx } of fractionals) {
    if (remainder <= 0) break;
    floored[idx] += 1;
    remainder -= 1;
  }

  return floored;
}

/**
 * Validate that split rows sum exactly to the original amount.
 * Returns null if valid, or an error message string.
 */
export function validateSplitAmounts(
  originalCents: number,
  rows: SplitRow[]
): string | null {
  if (rows.length < 2) {
    return "At least two split rows are required.";
  }
  for (const row of rows) {
    if (row.amountCents <= 0) {
      return "Each split row must have a positive amount.";
    }
    if (!Number.isInteger(row.amountCents)) {
      return "Amounts must be whole cents.";
    }
  }
  const total = rows.reduce((s, r) => s + r.amountCents, 0);
  if (total !== originalCents) {
    return `Split amounts must sum to the original (${formatCents(originalCents)}). Currently: ${formatCents(total)}.`;
  }
  return null;
}

/**
 * Calculate the remainder after subtracting already-entered split amounts.
 */
export function splitRemainder(originalCents: number, enteredCents: number[]): number {
  return originalCents - enteredCents.reduce((s, v) => s + v, 0);
}

/**
 * Generate a fingerprint string for duplicate detection.
 * Normalises merchant name and combines with date + total for fuzzy matching.
 *
 * DUPLICATE DETECTION has two intentionally asymmetric layers:
 * 1. File-hash (POST /api/receipts) — SHA-256 of raw bytes. Exact same file
 *    → BLOCKS upload with 409. No false positives possible.
 * 2. Fingerprint (process-receipt) — merchant+date+total. Different photos of
 *    the same receipt → FLAGS with `duplicate_of` but allows processing.
 *    May produce false positives (same merchant, date, and total for genuinely
 *    different purchases), which is why it flags rather than blocks.
 */
export function receiptFingerprint(
  merchant: string | null,
  purchaseDate: string | null,
  totalCents: number | null
): string | null {
  if (!merchant || !purchaseDate || totalCents == null) return null;
  const normMerchant = merchant.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${normMerchant}|${purchaseDate}|${totalCents}`;
}

/**
 * Structured logger for Itemize-It.
 *
 * Wraps console methods with:
 * - JSON-structured output in production (machine-parseable by log aggregators)
 * - Human-readable output in development
 * - Automatic redaction of sensitive fields (keys, tokens, passwords)
 * - Consistent context fields (timestamp, level)
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.error("Upload failed", { receiptId, error: err.message });
 *   log.warn("Rate limit approaching", { userId, remaining: 2 });
 *   log.info("Receipt processed", { receiptId, itemCount: 5 });
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Fields whose values should never appear in logs */
const REDACTED_KEYS = new Set([
  "authorization",
  "apikey",
  "api_key",
  "openai_api_key",
  "internal_api_secret",
  "service_role_key",
  "supabase_service_role_key",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "cookie",
  "set-cookie",
  // PII / email addresses
  "email",
  "email_address",
  "from_email",
  "to_email",
  "fromemail",
  "toemail",
  // PII / financial identifiers
  "ssn",
  "social_security_number",
  "tax_id",
  "ein",
  "credit_card",
  "credit_card_number",
  "card_number",
  "cvv",
  "cvc",
  "routing_number",
  "account_number",
  "bank_account",
]);

/**
 * Patterns matched against string *values* to catch sensitive data even when
 * the key name doesn't reveal it (e.g. a generic "note" field containing a CC number).
 */
const SENSITIVE_VALUE_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  // Email addresses (catch-all for values where key name doesn't reveal it's an email)
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, label: "EMAIL" },
  // US SSN: 123-45-6789
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, label: "SSN" },
  // Credit card numbers (13-19 digits, optionally separated by spaces or dashes)
  { pattern: /\b(?:\d[ -]*?){13,19}\b/, label: "CC" },
  // US EIN: 12-1234567
  { pattern: /\b\d{2}-\d{7}\b/, label: "EIN" },
];

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Deep-redact sensitive keys from an object.
 * Returns a new object with sensitive values replaced by "[REDACTED]".
 */
function redact(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion on circular references
  if (depth > 8) return "[MAX_DEPTH]";

  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    // Redact strings that look like JWTs or long base64 tokens
    if (obj.length > 100 && /^[A-Za-z0-9._-]+$/.test(obj)) {
      return `[REDACTED_TOKEN:${obj.length}chars]`;
    }
    // Redact strings containing patterns that look like PII (SSN, CC, EIN)
    for (const { pattern, label } of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.test(obj)) {
        return `[REDACTED_${label}]`;
      }
    }
    return obj;
  }
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redact(value, depth + 1);
    }
  }
  return result;
}

function formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (context) {
    const safe = redact(context) as Record<string, unknown>;
    Object.assign(entry, safe);
  }

  return entry;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = formatEntry(level, message, context);

  if (IS_PRODUCTION) {
    // Structured JSON — machine-parseable by Datadog, CloudWatch, etc.
    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(JSON.stringify(entry));
  } else {
    // Human-readable in development
    const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "ℹ️";
    const contextStr = context ? ` ${JSON.stringify(redact(context), null, 2)}` : "";
    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(`${prefix} [${level.toUpperCase()}] ${message}${contextStr}`);
  }
}

export const log = {
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};

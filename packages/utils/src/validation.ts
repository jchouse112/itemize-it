/**
 * Zod validation schemas for Itemize-It API boundaries.
 *
 * Every API route that accepts user input MUST validate through these schemas
 * before touching the database. This prevents malformed dates, oversized strings,
 * out-of-range numbers, and invalid enum values from reaching Supabase.
 */

import { z } from "zod";

// ============================================
// Shared primitives
// ============================================

/** Integer cents: -999_999_999_99 to 999_999_999_99 ($9,999,999,999.99) */
const centsField = z.number().int().min(-99_999_999_99).max(99_999_999_99);

/** Optional integer cents (nullable) */
const optionalCents = centsField.nullable().optional();

/** ISO 8601 date string (YYYY-MM-DD) */
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
  .refine(
    (s) => !isNaN(Date.parse(s)),
    "Must be a valid date"
  );

/** Bounded short string (merchant names, addresses, etc.) */
const shortString = z.string().max(500).trim();

// ============================================
// Receipt PATCH schema
// ============================================

export const ReceiptPatchSchema = z
  .object({
    merchant: shortString.nullable().optional(),
    merchant_address: shortString.nullable().optional(),
    merchant_phone: z
      .string()
      .max(50)
      .trim()
      .nullable()
      .optional(),
    purchase_date: isoDateString.nullable().optional(),
    total_cents: optionalCents,
    subtotal_cents: optionalCents,
    tax_cents: optionalCents,
    tip_cents: optionalCents,
    payment_method: z
      .enum(["cash", "credit_card", "debit_card", "check", "ach", "wire", "other"])
      .nullable()
      .optional(),
    payment_source: z
      .enum(["business_funds", "personal_funds", "mixed", "unknown"])
      .optional(),
    status: z
      .enum(["pending", "in_review", "complete", "exported", "archived"])
      .optional(),
    project_id: z.string().uuid().nullable().optional(),
    is_manually_edited: z.boolean().optional(),
    notes: z.string().max(1000).trim().nullable().optional(),
  })
  .strict()  // reject unknown keys
  .refine(
    (obj) => Object.keys(obj).length > 0,
    "At least one field must be provided"
  );

// ============================================
// OpenAI extraction response validation
// ============================================

/**
 * Validates + clamps AI extraction output.
 * Bounds every field so a compromised or hallucinating model
 * cannot inject millions of items or gigabyte-length strings.
 */

const ExtractedItemSchema = z.object({
  name: z.string().max(1000).default("Unknown item"),
  description: z.string().max(2000).nullable().default(null),
  quantity: z.number().min(0).max(100_000).default(1),
  unit_price_cents: centsField.nullable().default(null),
  total_price_cents: centsField.default(0),
  tax_cents: centsField.nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
});

export const ExtractionResultSchema = z.object({
  merchant: z.string().max(500).nullable().default(null),
  merchant_address: z.string().max(1000).nullable().default(null),
  purchase_date: z
    .string()
    .max(30)
    .nullable()
    .default(null)
    .refine(
      (v) => v === null || /^\d{4}-\d{2}-\d{2}/.test(v),
      "purchase_date must be YYYY-MM-DD or null"
    ),
  total_cents: centsField.nullable().default(null),
  subtotal_cents: centsField.nullable().default(null),
  tax_cents: centsField.nullable().default(null),
  // Payment method extracted from receipt (e.g., Visa, Cash, Debit)
  payment_method: z
    .enum(["cash", "credit_card", "debit_card", "check", "other"])
    .nullable()
    .default(null),
  // Last 4 digits of card if visible on receipt
  card_last_four: z
    .string()
    .max(10)
    .transform((v) => v?.replace(/\D/g, "").slice(-4) || null)
    .nullable()
    .default(null),
  confidence: z.number().min(0).max(1).default(0.5),
  items: z.array(ExtractedItemSchema).max(500).default([]),
  warnings: z.array(z.string().max(1000)).max(100).default([]),
});

export type ValidatedExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ============================================
// Line item split schema (Phase 4)
// ============================================

const SplitRowSchema = z.object({
  amount_cents: centsField.refine((v) => v > 0, "Amount must be positive"),
  classification: z.enum(["business", "personal", "unclassified"]),
  label: shortString.optional(),
  project_id: z.string().uuid().nullable().optional(),
  tax_category: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const SplitItemSchema = z
  .object({
    rows: z
      .array(SplitRowSchema)
      .min(2, "At least two split rows are required")
      .max(10, "Maximum 10 split rows"),
    tax_method: z
      .enum(["prorated", "manual"])
      .default("prorated"),
    /** When tax_method is "manual", each row must carry its own tax_cents */
    manual_tax: z
      .array(centsField)
      .optional(),
  })
  .refine(
    (data) => {
      if (data.tax_method === "manual" && data.manual_tax) {
        return data.manual_tax.length === data.rows.length;
      }
      return true;
    },
    {
      message: "manual_tax array length must match the number of rows",
      path: ["manual_tax"],
    }
  );

export type ValidatedSplitItem = z.infer<typeof SplitItemSchema>;

// ============================================
// Lifecycle PATCH schemas (Phase 6)
// ============================================

/** PATCH /api/recalls — dismiss or undismiss a recall match */
export const RecallDismissSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  dismissed: z.boolean(),
}).strict();

export type ValidatedRecallDismiss = z.infer<typeof RecallDismissSchema>;

/** PATCH /api/returns — update return status */
export const ReturnStatusSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  status: z.enum(["returned", "ineligible"]),
}).strict();

export type ValidatedReturnStatus = z.infer<typeof ReturnStatusSchema>;

/** PATCH /api/notifications — mark single notification read/unread */
export const NotificationReadSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  read: z.boolean(),
}).strict();

export type ValidatedNotificationRead = z.infer<typeof NotificationReadSchema>;

/** PATCH /api/notifications — bulk mark notifications read/unread */
export const NotificationBulkReadSchema = z.object({
  ids: z
    .array(z.string().uuid("Each id must be a valid UUID"))
    .min(1, "At least one id is required")
    .max(100, "Maximum 100 ids per request"),
  read: z.boolean(),
}).strict();

export type ValidatedNotificationBulkRead = z.infer<typeof NotificationBulkReadSchema>;

// ============================================
// Email ingestion payload (Phase 7)
// ============================================

/** Maximum attachment size: 20MB (in bytes) */
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

const IngestEmailAttachmentSchema = z.object({
  /** Supabase Storage key where the attachment was uploaded */
  storageKey: z.string().min(1).max(500),
  /** MIME type of the attachment */
  fileType: z.string().min(1).max(100),
  /** Original filename from the email */
  filename: z.string().max(500).optional(),
  /** File size in bytes — rejected if over 20MB */
  fileSize: z
    .number()
    .int()
    .min(1, "Attachment must not be empty")
    .max(MAX_ATTACHMENT_SIZE_BYTES, "Attachment exceeds 20MB limit")
    .optional(),
});

export const IngestEmailSchema = z.object({
  /** The forwarding address the email was sent to (e.g. jh42@2itm.com) */
  toEmail: z.string().email().max(320),
  /** Sender's email address */
  fromEmail: z.string().email().max(320),
  /** Email subject line */
  subject: z.string().max(1000).nullable().default(null),
  /** Email Message-ID header for deduplication */
  messageId: z.string().max(500).nullable().default(null),
  /** When the email was received */
  receivedAt: z.string().max(50).default(() => new Date().toISOString()),
  /** Attachments already uploaded to Supabase Storage by the edge function.
   *  May be empty — the route handles zero-attachment emails as a "bounce"
   *  (email received but nothing to process), creating a notification for the user. */
  attachments: z
    .array(IngestEmailAttachmentSchema)
    .max(20, "Maximum 20 attachments per email"),
});

export type ValidatedIngestEmail = z.infer<typeof IngestEmailSchema>;

// ============================================
// Billing & Team schemas (Phase 8)
// ============================================

/** POST /api/billing/checkout — request a Stripe Checkout session */
export const CheckoutRequestSchema = z.object({
  tier: z.enum(["starter", "pro", "enterprise"], {
    message: "tier must be starter, pro, or enterprise",
  }),
  interval: z.enum(["month", "year"]).default("month"),
}).strict();

export type ValidatedCheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

/** POST /api/team/invite — send a team invitation */
export const TeamInviteSchema = z.object({
  email: z.string().email("Invalid email address").max(320),
  role: z.enum(["admin", "member", "viewer"]),
}).strict();

export type ValidatedTeamInvite = z.infer<typeof TeamInviteSchema>;

/** PATCH /api/team/[memberId] — update member role */
export const TeamMemberUpdateSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
}).strict();

export type ValidatedTeamMemberUpdate = z.infer<typeof TeamMemberUpdateSchema>;

/** POST /api/team/invite/accept — accept an invitation */
export const AcceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required").max(200),
}).strict();

export type ValidatedAcceptInvite = z.infer<typeof AcceptInviteSchema>;

// ============================================
// File upload magic byte validation
// ============================================

/**
 * Known file signatures (magic bytes) for allowed receipt file types.
 * Validates the actual binary content rather than trusting the client-supplied MIME type.
 */
interface MagicSignature {
  /** Byte offsets and expected values */
  bytes: { offset: number; values: number[] }[];
  /** The canonical MIME type for this format */
  mime: string;
}

const MAGIC_SIGNATURES: MagicSignature[] = [
  // JPEG: FF D8 FF
  {
    bytes: [{ offset: 0, values: [0xff, 0xd8, 0xff] }],
    mime: "image/jpeg",
  },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    bytes: [{ offset: 0, values: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
    mime: "image/png",
  },
  // GIF87a / GIF89a: 47 49 46 38
  {
    bytes: [{ offset: 0, values: [0x47, 0x49, 0x46, 0x38] }],
    mime: "image/gif",
  },
  // WebP: RIFF....WEBP
  {
    bytes: [
      { offset: 0, values: [0x52, 0x49, 0x46, 0x46] },   // "RIFF"
      { offset: 8, values: [0x57, 0x45, 0x42, 0x50] },    // "WEBP"
    ],
    mime: "image/webp",
  },
  // PDF: %PDF
  {
    bytes: [{ offset: 0, values: [0x25, 0x50, 0x44, 0x46] }],
    mime: "application/pdf",
  },
  // HEIF/HEIC: ....ftyp at offset 4
  {
    bytes: [{ offset: 4, values: [0x66, 0x74, 0x79, 0x70] }],  // "ftyp"
    mime: "image/heic",
  },
];

/**
 * Detects the real file type from its binary content (magic bytes).
 * Returns the MIME type if recognised, or null if the file doesn't match
 * any allowed signature.
 *
 * This guards against clients spoofing the Content-Type header to upload
 * executables, scripts, or other dangerous payloads disguised as images.
 */
export function detectFileType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);

  // Need at least 12 bytes for the longest check (WebP: offset 8 + 4)
  if (bytes.length < 12) return null;

  for (const sig of MAGIC_SIGNATURES) {
    let matches = true;
    for (const check of sig.bytes) {
      for (let i = 0; i < check.values.length; i++) {
        if (bytes[check.offset + i] !== check.values[i]) {
          matches = false;
          break;
        }
      }
      if (!matches) break;
    }
    if (matches) return sig.mime;
  }

  return null;
}

/**
 * Validates that the file's actual content matches one of the allowed types.
 * Returns { valid: true, detectedType } or { valid: false, detectedType }.
 */
export function validateFileContent(buffer: ArrayBuffer): {
  valid: boolean;
  detectedType: string | null;
} {
  const detectedType = detectFileType(buffer);
  const allowedMimes = MAGIC_SIGNATURES.map((s) => s.mime);
  return {
    valid: detectedType !== null && allowedMimes.includes(detectedType),
    detectedType,
  };
}

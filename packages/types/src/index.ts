/**
 * Itemize-It shared TypeScript types.
 * Matches the ii_* database schema.
 */

// ============================================
// Enum Types (matching database CHECK constraints)
// ============================================

export type ReceiptStatus =
  | "pending"
  | "processing"
  | "in_review"
  | "complete"
  | "exported"
  | "archived";

export type Classification = "business" | "personal" | "unclassified";

export type ExpenseType = "material" | "labour" | "overhead";

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "check"
  | "ach"
  | "wire"
  | "other";

export type PaymentSource =
  | "business_funds"
  | "personal_funds"
  | "mixed"
  | "unknown";

export type TaxCalculationMethod =
  | "extracted"
  | "prorated"
  | "manual"
  | "exempt";

export type TaxCategory =
  | "advertising"
  | "car_truck_expenses"
  | "commissions_fees"
  | "contract_labor"
  | "depletion"
  | "depreciation"
  | "employee_benefits"
  | "insurance"
  | "interest_mortgage"
  | "interest_other"
  | "legal_professional"
  | "office_expense"
  | "pension_profit_sharing"
  | "rent_lease_vehicles"
  | "rent_lease_equipment"
  | "rent_lease_property"
  | "repairs_maintenance"
  | "supplies"
  | "taxes_licenses"
  | "travel"
  | "meals"
  | "utilities"
  | "wages"
  | "other_expenses"
  | "cost_of_goods_sold"
  | "not_deductible";

export type ProjectStatus = "active" | "completed" | "archived";

// ============================================
// Domain Types (matching ii_* tables)
// ============================================

export interface IIReceipt {
  id: string;
  business_id: string;
  user_id: string;
  storage_key: string | null;
  merchant: string | null;
  merchant_address: string | null;
  merchant_phone: string | null;
  purchase_date: string | null;
  purchase_time: string | null;
  total_cents: number | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  currency: string;
  payment_method: PaymentMethod | null;
  payment_source: PaymentSource;
  card_last_four: string | null;
  has_business_items: boolean;
  has_personal_items: boolean;
  has_unclassified_items: boolean;
  needs_review: boolean;
  confidence_score: number | null;
  extraction_model: string | null;
  is_manually_edited: boolean;
  status: ReceiptStatus;
  project_id: string | null;
  fingerprint: string | null;
  duplicate_of: string | null;
  email_message_id: string | null;
  email_from: string | null;
  email_subject: string | null;
  email_received_at: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  exported_at: string | null;
  notes: string | null;
}

export interface IIReceiptItem {
  id: string;
  receipt_id: string;
  business_id: string;
  user_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number | null;
  total_price_cents: number;
  subtotal_cents: number | null;
  tax_cents: number | null;
  tax_rate: number | null;
  tax_calculation_method: TaxCalculationMethod | null;
  classification: Classification;
  expense_type: ExpenseType;
  classification_confidence: number | null;
  classified_at: string | null;
  classified_by: string | null;
  category: string | null;
  category_confidence: number | null;
  category_locked: boolean;
  tax_category: TaxCategory | null;
  project_id: string | null;
  parent_item_id: string | null;
  is_split_original: boolean;
  split_ratio: number | null;
  review_reasons: string[];
  needs_review: boolean;
  notes: string | null;
  warranty_eligible: boolean;
  warranty_eligibility_reason: string | null;
  track_warranty: boolean;
  warranty_lookup_status: WarrantyLookupStatus;
  warranty_end_date: string | null;
  warranty_checked_at: string | null;
  warranty_lookup_confidence: number | null;
  warranty_lookup_source: WarrantySource | null;
  warranty_lookup_error: string | null;
  warranty_lookup_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface IIProject {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  budget_cents: number | null;
  /** Target percentage of budget for materials (0-100) */
  material_target_percent: number | null;
  lat: number | null;
  lng: number | null;
  radius_meters: number | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

// ============================================
// API Types
// ============================================

/** Payload sent from edge function to /api/internal/process-receipt */
export interface ProcessReceiptPayload {
  receiptRawId: string;
  userId: string;
  storageKey: string;
  fileType: string;
  /** Email metadata — present when the receipt was ingested via forwarded email */
  emailMessageId?: string;
  emailFrom?: string;
  emailSubject?: string;
  emailReceivedAt?: string;
}

/** Response from /api/internal/process-receipt */
export interface ProcessReceiptResponse {
  receipt_id: string;
  items_extracted: number;
  matched_project_id: string | null;
  price_warnings: string[];
}

// ============================================
// UI Helper Types
// ============================================

/** Receipt with joined items for display */
export interface ReceiptWithItems extends IIReceipt {
  ii_receipt_items: IIReceiptItem[];
  ii_projects?: IIProject | null;
}

/** Summary statistics for dashboard */
export interface ExpenseSummary {
  total_cents: number;
  business_cents: number;
  personal_cents: number;
  unclassified_cents: number;
  material_cents: number;
  labour_cents: number;
  overhead_cents: number;
  receipt_count: number;
  item_count: number;
}

// ============================================
// Lifecycle Types (Phase 6)
// ============================================

export type WarrantyCategory =
  | "electronics"
  | "appliances"
  | "clothing"
  | "furniture"
  | "tools"
  | "vehicles"
  | "jewelry"
  | "automotive"
  | "other";

export type WarrantySource =
  | "receipt"
  | "manufactured_year"
  | "ai_lookup"
  | "manual_entry";

export type WarrantyLookupStatus =
  | "unknown"
  | "in_progress"
  | "found"
  | "not_found"
  | "error"
  | "not_eligible";

export type ItemCategory =
  | "computers" | "phones" | "tablets" | "tvs" | "audio"
  | "cameras" | "gaming" | "wearables" | "smart_home"
  | "appliances_major" | "appliances_small"
  | "furniture" | "lighting" | "decor" | "bedding"
  | "tools_power" | "tools_hand" | "outdoor_equipment" | "lawn_garden"
  | "clothing" | "shoes" | "jewelry" | "watches" | "bags"
  | "vehicles" | "automotive_parts" | "bicycles"
  | "fitness" | "sports" | "camping"
  | "office" | "kitchen" | "baby" | "pets" | "health"
  | "other";

export type ReturnStatus = "eligible" | "returned" | "expired" | "ineligible";

export type RecallConfidence = "high" | "medium" | "low";
export type RecallSource = "cpsc" | "perplexity";
export type NotificationType =
  | "warranty_expiring"
  | "return_expiring"
  | "recall_alert"
  | "email_bounce";

export interface IIWarranty {
  id: string;
  business_id: string;
  user_id: string;
  receipt_id: string;
  receipt_item_id: string | null;
  category: WarrantyCategory | null;
  start_date: string;
  end_date: string;
  confidence: number;
  is_manually_edited: boolean;
  is_estimated: boolean;
  warranty_source: WarrantySource | null;
  product_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IIReturn {
  id: string;
  business_id: string;
  user_id: string;
  receipt_id: string;
  receipt_item_id: string | null;
  merchant: string | null;
  return_by: string;
  status: ReturnStatus;
  product_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IIRecallCheck {
  id: string;
  business_id: string;
  receipt_item_id: string;
  checked_at: string;
  sources_checked: RecallSource[];
  match_found: boolean;
  created_at: string;
}

export interface IIRecallMatch {
  id: string;
  business_id: string;
  recall_check_id: string;
  receipt_item_id: string;
  external_recall_id: string | null;
  source: RecallSource;
  confidence: RecallConfidence;
  matched_on: string[];
  title: string;
  description: string | null;
  hazard: string | null;
  remedy: string | null;
  recall_date: string | null;
  url: string | null;
  dismissed: boolean;
  created_at: string;
}

export interface IINotification {
  id: string;
  business_id: string;
  user_id: string;
  type: NotificationType;
  entity_id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

// ============================================
// Email Ingestion Types (Phase 7)
// ============================================

/**
 * Inbound email status state machine:
 *
 *   pending ──→ processing ──→ processed   (all attachments succeeded)
 *                    │
 *                    ├──→ partial    (some attachments failed, some succeeded)
 *                    │
 *                    └──→ failed     (all attachments failed or zero receipts created)
 *
 * Transitions:
 * - pending → processing:  Set on insert by ingest-email route (record created as "processing")
 * - processing → processed: All receipt records created and extraction triggers succeeded
 * - processing → partial:   At least one receipt created but errors occurred (oversized,
 *                           creation failure, or extraction trigger failure)
 * - processing → failed:    Zero receipts were successfully created
 *
 * Terminal states: processed, partial, failed — no backward transitions.
 * Retry: There is no automatic retry from failed/partial. Users must re-forward the email.
 */
export type InboundEmailStatus = "pending" | "processing" | "processed" | "partial" | "failed";

export interface IIInboundEmail {
  id: string;
  business_id: string;
  /**
   * Always set on insert (resolved from forwarding address → business member).
   * Nullable in DB only because of ON DELETE SET NULL (user deletion preserves records).
   */
  user_id: string | null;
  from_email: string;
  to_email: string;
  subject: string | null;
  /** Email Message-ID header — used for deduplication */
  message_id: string | null;
  attachment_count: number;
  receipts_created: number;
  received_at: string;
  status: InboundEmailStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Plan & Billing Types
// ============================================

export type PlanTier = "free" | "starter" | "pro" | "enterprise";

// ============================================
// Business / Team Types (Phase 8)
// ============================================

export type BillingInterval = "month" | "year";

export type MemberRole = "owner" | "admin" | "member" | "viewer";
export type MemberStatus = "active" | "invited" | "suspended" | "removed";

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  /** Joined from auth.users for display */
  email?: string;
}

export interface BusinessInvitation {
  id: string;
  business_id: string;
  email: string;
  role: MemberRole;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}


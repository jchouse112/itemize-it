/**
 * @itemize-it/ts-types
 *
 * Shared TypeScript types for the Itemize-It monorepo.
 * This package is the single source of truth for:
 * - Supabase database types (auto-generated)
 * - Shared domain types
 * - API response types
 */

// Re-export Supabase types
export * from "./supabase";

// ============================================
// Enum Types (matching database constraints)
// ============================================

export type ScanStatus = "uploading" | "processing" | "complete" | "failed";
export type ItemCategory = "material" | "asset" | "personal";

// ============================================
// Domain Types (matching database schema)
// ============================================

/**
 * Project for expense tracking with GPS context
 */
export interface Project {
  id: string;
  user_id: string;
  name: string;
  budget_limit: number | null;
  lat: number | null;
  lng: number | null;
  radius_meters: number;
  created_at: string;
  updated_at: string;
}

/**
 * A receipt record
 */
export interface Receipt {
  id: string;
  user_id: string;
  merchant_name: string | null;
  total_amount: number | null;
  scan_status: ScanStatus;
  image_url: string | null;
  receipt_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A single line item from a receipt
 */
export interface ReceiptItem {
  id: string;
  receipt_id: string;
  description: string;
  amount: number;
  project_id: string | null;
  category: ItemCategory;
  created_at: string;
  updated_at: string;
}

/**
 * A business asset tracked for depreciation/inventory
 */
export interface Asset {
  id: string;
  user_id: string;
  name: string;
  purchase_date: string | null;
  value: number | null;
  receipt_item_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Price history record for inflation tracking
 */
export interface PriceHistory {
  id: string;
  user_id: string;
  item_description: string;
  merchant_name: string | null;
  amount: number;
  recorded_at: string;
}

// ============================================
// API Types
// ============================================

/**
 * Payload for process-receipt edge function
 */
export interface ProcessReceiptPayload {
  receipt_id: string;
  image_url: string;
  user_lat?: number;
  user_lng?: number;
}

/**
 * Response from process-receipt edge function
 */
export interface ProcessReceiptResponse {
  success: boolean;
  receipt_id: string;
  items_extracted: number;
  matched_project_id: string | null;
  price_warnings: string[];
}

/**
 * OCR extracted receipt data
 */
export interface ExtractedReceiptData {
  merchant_name: string;
  receipt_date: string | null;
  total_amount: number;
  items: Array<{
    description: string;
    amount: number;
    category: ItemCategory;
  }>;
}

// ============================================
// UI Helper Types
// ============================================

/**
 * Receipt with joined items for display
 */
export interface ReceiptWithItems extends Receipt {
  items: ReceiptItem[];
  project?: Project;
}

/**
 * Summary statistics for dashboard
 */
export interface ExpenseSummary {
  total_amount: number;
  billable_amount: number;
  personal_amount: number;
  asset_amount: number;
  receipt_count: number;
  item_count: number;
}

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import Constants from "expo-constants";

// Get Supabase config from environment
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

// Custom storage adapter using SecureStore for auth persistence
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};

// Deep link callback URL for magic link auth
export const AUTH_CALLBACK_URL = Linking.createURL("auth/callback");

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ============================================================================
// Shared types from @itemize-it/types
// ============================================================================

import type { IIReceipt, IIReceiptItem, IIProject } from "@itemize-it/types";
export type { IIReceipt, IIReceiptItem, IIProject };

// Mobile-specific Business type (not in shared package — includes mobile-only fields)
export interface Business {
  id: string;
  owner_id: string;
  name: string;
  business_type: string | null;
  tax_id: string | null;
  default_currency: string;
  timezone: string;
  projects_enabled: boolean;
  plan_tier: string;
  limits_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current user's business ID
 */
export async function getUserBusinessId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_user_business_id");
  if (error) {
    console.error("Error getting user business ID:", error);
    return null;
  }
  return data;
}

/**
 * Get projects for the current user's business
 */
export async function getProjects(): Promise<IIProject[]> {
  const { data, error } = await supabase
    .from("ii_projects")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Get receipts for the current user's business
 */
export async function getReceipts(options?: {
  status?: string;
  limit?: number;
}): Promise<IIReceipt[]> {
  let query = supabase
    .from("ii_receipts")
    .select("*")
    .order("purchase_date", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching receipts:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Get items for a specific receipt
 */
export async function getReceiptItems(receiptId: string): Promise<IIReceiptItem[]> {
  const { data, error } = await supabase
    .from("ii_receipt_items")
    .select("*")
    .eq("receipt_id", receiptId)
    .is("parent_item_id", null) // Exclude split children by default
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching receipt items:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Update item classification
 */
export async function classifyItem(
  itemId: string,
  classification: "business" | "personal"
): Promise<boolean> {
  const { error } = await supabase
    .from("ii_receipt_items")
    .update({
      classification,
      classified_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    console.error("Error classifying item:", error);
    return false;
  }
  return true;
}

/**
 * Get project expense totals
 */
export async function getProjectExpenseTotal(projectId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_ii_project_expenses_total", {
    p_project_id: projectId,
  });

  if (error) {
    console.error("Error getting project total:", error);
    return 0;
  }
  return data ?? 0;
}

/**
 * Bulk classify multiple items at once
 * Returns the number of items successfully updated
 */
export async function bulkClassifyItems(
  itemIds: string[],
  classification: "business" | "personal"
): Promise<{ updated: number; previousStates: { id: string; classification: string }[] }> {
  // Capture previous states for undo
  const { data: before } = await supabase
    .from("ii_receipt_items")
    .select("id, classification")
    .in("id", itemIds);

  const previousStates = (before || []).map((item) => ({
    id: item.id,
    classification: item.classification as string,
  }));

  const { error, count } = await supabase
    .from("ii_receipt_items")
    .update({
      classification,
      classified_at: new Date().toISOString(),
    })
    .in("id", itemIds);

  if (error) {
    console.error("Error bulk classifying items:", error);
    return { updated: 0, previousStates: [] };
  }
  return { updated: count || itemIds.length, previousStates };
}

/**
 * Undo a bulk classification by restoring previous states
 */
export async function undoBulkClassify(
  previousStates: { id: string; classification: string }[]
): Promise<boolean> {
  try {
    for (const item of previousStates) {
      await supabase
        .from("ii_receipt_items")
        .update({
          classification: item.classification,
          classified_at: item.classification === "unclassified" ? null : new Date().toISOString(),
        })
        .eq("id", item.id);
    }
    return true;
  } catch (error) {
    console.error("Error undoing bulk classify:", error);
    return false;
  }
}

/**
 * Split an item into multiple portions via API
 */
export async function splitItem(
  itemId: string,
  splits: { amountCents: number; classification: "business" | "personal"; notes?: string }[]
): Promise<IIReceiptItem[] | null> {
  // Refresh to ensure a valid token, fall back to cached session
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  const session = refreshed ?? (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;
  if (!token) return null;

  const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) return null;

  try {
    const res = await fetch(`${apiUrl}/api/itemize-it/split-item`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ itemId, splits }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.children || null;
  } catch (error) {
    console.error("Error splitting item:", error);
    return null;
  }
}

// ============================================================================
// Forwarding Email
// ============================================================================

/**
 * Get the business's current forwarding email (if any)
 */
export async function getForwardingEmail(): Promise<string | null> {
  const businessId = await getUserBusinessId();
  if (!businessId) return null;

  const { data, error } = await supabase
    .from("businesses")
    .select("ii_forwarding_email")
    .eq("id", businessId)
    .single();

  if (error) {
    console.error("Error getting forwarding email:", error);
    return null;
  }
  return data?.ii_forwarding_email ?? null;
}

/**
 * Generate a new forwarding email for the business
 */
export async function generateForwardingEmail(
  firstName: string,
  lastName?: string
): Promise<string | null> {
  const businessId = await getUserBusinessId();
  if (!businessId) return null;

  const { data, error } = await supabase.rpc("generate_ii_forwarding_email", {
    p_business_id: businessId,
    p_first_name: firstName,
    p_last_name: lastName || null,
  });

  if (error) {
    console.error("Error generating forwarding email:", error);
    return null;
  }
  return data;
}

/**
 * Regenerate the forwarding email (invalidates the old one)
 */
export async function regenerateForwardingEmail(
  firstName: string,
  lastName?: string
): Promise<string | null> {
  const businessId = await getUserBusinessId();
  if (!businessId) return null;

  const { data, error } = await supabase.rpc("regenerate_ii_forwarding_email", {
    p_business_id: businessId,
    p_first_name: firstName,
    p_last_name: lastName || null,
  });

  if (error) {
    console.error("Error regenerating forwarding email:", error);
    return null;
  }
  return data;
}

/**
 * Get inbound email count for the business
 */
export async function getInboundEmailCount(): Promise<number> {
  const businessId = await getUserBusinessId();
  if (!businessId) return 0;

  const { count, error } = await supabase
    .from("ii_inbound_emails")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId);

  if (error) {
    console.error("Error getting inbound email count:", error);
    return 0;
  }
  return count ?? 0;
}

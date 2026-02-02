import { useState, useEffect } from "react";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";

export interface WarrantyData {
  id: string;
  receipt_id: string;
  start_date: string;
  end_date: string;
  category: string | null;
  manufacturer: string | null;
  confidence: number | null;
  notes: string | null;
  days_remaining: number;
  covered_items: { name: string; total_price_cents: number }[];
}

export interface ReturnWindowData {
  id: string;
  receipt_id: string;
  retailer_name: string;
  policy_days: number;
  return_by: string;
  status: "open" | "returned" | "expired";
  days_remaining: number;
}

export interface RecallMatchData {
  id: string;
  receipt_id: string;
  product_name: string;
  recall_id: string | null;
  hazard: string | null;
  remedy: string | null;
  source_url: string | null;
  confidence: string;
  status: string;
  matched_at: string;
}

export interface DuplicateData {
  duplicate_of_receipt_id: string | null;
  duplicate_receipt: {
    id: string;
    merchant: string | null;
    purchase_date: string | null;
    total_cents: number;
  } | null;
}

export interface ReceiptLifecycleData {
  warranty: WarrantyData | null;
  return_window: ReturnWindowData | null;
  recall_matches: RecallMatchData[];
  last_recall_check: {
    id: string;
    checked_at: string;
    status: string;
    match_count: number;
  } | null;
  duplicate: DuplicateData | null;
}

export function useReceiptLifecycle(receiptId: string | undefined) {
  const [data, setData] = useState<ReceiptLifecycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptId) {
      setLoading(false);
      return;
    }

    async function fetch_lifecycle() {
      try {
        setError(null);
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) {
          setLoading(false);
          return;
        }

        const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;
        if (!apiUrl) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${apiUrl}/api/itemize-it/lifecycle/receipt/${receiptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setError("Failed to fetch lifecycle data");
          return;
        }

        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("Failed to fetch receipt lifecycle:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetch_lifecycle();
  }, [receiptId]);

  const hasLifecycleData = data
    ? !!(data.warranty || data.return_window || data.recall_matches.length > 0 || data.duplicate)
    : false;

  return { data, loading, error, hasLifecycleData };
}

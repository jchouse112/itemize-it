import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";

export interface LifecycleAlert {
  id: string;
  type: "recall" | "return_expiring" | "warranty_expiring" | "duplicate";
  urgency: "critical" | "warning" | "info";
  receipt_id: string;
  merchant: string;
  purchase_date: string | null;
  total_cents: number;
  title: string;
  subtitle: string;
  expires_at?: string;
  metadata: Record<string, unknown>;
}

export interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

export function useLifecycleAlerts() {
  const [alerts, setAlerts] = useState<LifecycleAlert[]>([]);
  const [counts, setCounts] = useState<AlertCounts>({ critical: 0, warning: 0, info: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
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

      const res = await fetch(`${apiUrl}/api/itemize-it/lifecycle/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setError("Failed to fetch alerts");
        return;
      }

      const data = await res.json();
      setAlerts(data.alerts || []);
      setCounts(data.counts || { critical: 0, warning: 0, info: 0, total: 0 });
    } catch (err) {
      console.error("Failed to fetch lifecycle alerts:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
    }, [fetchAlerts])
  );

  return { alerts, counts, loading, error, refresh: fetchAlerts };
}

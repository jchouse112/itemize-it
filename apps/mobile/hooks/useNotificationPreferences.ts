import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface IINotificationPreferences {
  push_enabled: boolean;
  ii_receipt_processed: boolean;
  ii_items_review: boolean;
  ii_export_ready: boolean;
  ii_warranty_expiring: boolean;
  ii_return_closing: boolean;
  ii_recall_alert: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
}

const DEFAULT_PREFERENCES: IINotificationPreferences = {
  push_enabled: true,
  ii_receipt_processed: true,
  ii_items_review: true,
  ii_export_ready: true,
  ii_warranty_expiring: true,
  ii_return_closing: true,
  ii_recall_alert: true,
  quiet_start: null,
  quiet_end: null,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<IINotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(DEFAULT_PREFERENCES);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("notification_preferences")
        .select("push_enabled, ii_receipt_processed, ii_items_review, ii_export_ready, ii_warranty_expiring, ii_return_closing, ii_recall_alert, quiet_start, quiet_end")
        .eq("user_id", user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 = no rows found, that's fine (use defaults)
        setError(fetchError.message);
        return;
      }

      if (data) {
        setPreferences({
          push_enabled: data.push_enabled ?? true,
          ii_receipt_processed: data.ii_receipt_processed ?? true,
          ii_items_review: data.ii_items_review ?? true,
          ii_export_ready: data.ii_export_ready ?? true,
          ii_warranty_expiring: data.ii_warranty_expiring ?? true,
          ii_return_closing: data.ii_return_closing ?? true,
          ii_recall_alert: data.ii_recall_alert ?? true,
          quiet_start: data.quiet_start ?? null,
          quiet_end: data.quiet_end ?? null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch preferences");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updatePreferences = useCallback(
    async (updates: Partial<IINotificationPreferences>) => {
      if (!user) return;

      setSaving(true);
      setError(null);

      try {
        const { error: upsertError } = await supabase
          .from("notification_preferences")
          .upsert(
            {
              user_id: user.id,
              ...preferences,
              ...updates,
            },
            { onConflict: "user_id" }
          );

        if (upsertError) {
          setError(upsertError.message);
          return;
        }

        setPreferences((prev) => ({ ...prev, ...updates }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update preferences");
      } finally {
        setSaving(false);
      }
    },
    [user, preferences]
  );

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    saving,
    error,
    updatePreferences,
    refetch: fetchPreferences,
  };
}

import { useState, useCallback } from "react";
import { Alert, Share, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";

export interface ExportConfig {
  from: string | null;
  to: string | null;
  classification: "all" | "business" | "personal";
  projectId: string | null;
  status: string | null;
  format: "csv" | "pdf";
  includeTaxSummary: boolean;
}

const DEFAULT_CONFIG: ExportConfig = {
  from: null,
  to: null,
  classification: "all",
  projectId: null,
  status: null,
  format: "csv",
  includeTaxSummary: false,
};

export function useExport() {
  const [config, setConfig] = useState<ExportConfig>(DEFAULT_CONFIG);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConfig = useCallback((updates: Partial<ExportConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        setError("Not authenticated");
        return false;
      }

      const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) {
        setError("API URL not configured");
        return false;
      }

      // Build query string
      const params = new URLSearchParams();
      if (config.from) params.set("from", config.from);
      if (config.to) params.set("to", config.to);
      if (config.classification !== "all") params.set("classification", config.classification);
      if (config.projectId) params.set("projectId", config.projectId);
      if (config.status) params.set("status", config.status);

      const url = `${apiUrl}/api/itemize-it/export?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.error || "Export failed");
        return false;
      }

      // Download and share the file
      const csvContent = await res.text();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `itemize-it-export-${dateStr}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Share Export",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("Export Complete", `File saved to ${filename}`);
      }

      return true;
    } catch (err) {
      console.error("Export failed:", err);
      setError(err instanceof Error ? err.message : "Export failed");
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [config]);

  return {
    config,
    updateConfig,
    resetConfig,
    generate,
    isGenerating,
    error,
  };
}

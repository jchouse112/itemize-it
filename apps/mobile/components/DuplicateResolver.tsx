import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import { Copy, Check } from "lucide-react-native";
import Constants from "expo-constants";
import { COLORS, formatCurrency } from "../lib/utils";
import { supabase } from "../lib/supabase";

interface DuplicateResolverProps {
  receiptId: string;
  duplicateReceipt: {
    id: string;
    merchant: string | null;
    purchase_date: string | null;
    total_cents: number;
  } | null;
  onResolved: () => void;
}

type ResolveAction = "keep_both" | "discard_new" | "replace_existing";

export function DuplicateResolver({
  receiptId,
  duplicateReceipt,
  onResolved,
}: DuplicateResolverProps) {
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);

  const handleResolve = async (action: ResolveAction) => {
    setResolving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return;

      const res = await fetch(`${apiUrl}/api/itemize-it/lifecycle/resolve-duplicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receipt_id: receiptId, action }),
      });

      if (res.ok) {
        setResolved(true);
        onResolved();
      }
    } catch (err) {
      console.error("Failed to resolve duplicate:", err);
    } finally {
      setResolving(false);
    }
  };

  if (resolved) {
    return (
      <View style={styles.resolvedContainer}>
        <Check size={20} color={COLORS.safe} />
        <Text style={styles.resolvedText}>Duplicate resolved</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Possible Duplicate</Text>
      <Text style={styles.description}>
        This receipt may be a duplicate of another receipt.
      </Text>

      {duplicateReceipt && (
        <View style={styles.comparisonCard}>
          <Copy size={16} color={COLORS.concrete} />
          <View style={styles.comparisonContent}>
            <Text style={styles.comparisonMerchant}>
              {duplicateReceipt.merchant || "Unknown"}
            </Text>
            <Text style={styles.comparisonMeta}>
              {duplicateReceipt.purchase_date
                ? new Date(duplicateReceipt.purchase_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "No date"}{" "}
              • {formatCurrency(duplicateReceipt.total_cents)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => handleResolve("keep_both")}
          disabled={resolving}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
            resolving && styles.actionButtonDisabled,
          ]}
        >
          <Text style={styles.actionButtonText}>Keep Both</Text>
        </Pressable>

        <Pressable
          onPress={() => handleResolve("discard_new")}
          disabled={resolving}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionButtonDanger,
            pressed && styles.actionButtonPressed,
            resolving && styles.actionButtonDisabled,
          ]}
        >
          <Text style={styles.actionButtonText}>Discard This</Text>
        </Pressable>

        <Pressable
          onPress={() => handleResolve("replace_existing")}
          disabled={resolving}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
            resolving && styles.actionButtonDisabled,
          ]}
        >
          <Text style={styles.actionButtonText}>Replace Other</Text>
        </Pressable>
      </View>

      {resolving && (
        <ActivityIndicator
          size="small"
          color={COLORS.safetyOrange}
          style={{ marginTop: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  description: {
    color: COLORS.concrete,
    fontSize: 13,
    marginBottom: 14,
  },
  comparisonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.asphalt,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  comparisonContent: {
    flex: 1,
  },
  comparisonMerchant: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },
  comparisonMeta: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    alignItems: "center",
  },
  actionButtonDanger: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
  resolvedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
  },
  resolvedText: {
    color: COLORS.safe,
    fontSize: 15,
    fontWeight: "600",
  },
});

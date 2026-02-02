import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { ShieldCheck, RotateCcw, AlertTriangle, Copy, ChevronRight } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "../lib/utils";
import { useReceiptLifecycle } from "../hooks/useReceiptLifecycle";
import { ReturnCountdown } from "./ReturnCountdown";

interface LifecycleSectionProps {
  receiptId: string;
}

export function LifecycleSection({ receiptId }: LifecycleSectionProps) {
  const { data, loading, hasLifecycleData } = useReceiptLifecycle(receiptId);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.safetyOrange} />
      </View>
    );
  }

  if (!hasLifecycleData || !data) return null;

  const navigateToLifecycle = () => {
    router.push({
      pathname: "/lifecycle/[receiptId]",
      params: { receiptId },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Lifecycle</Text>

      {/* Warranty */}
      {data.warranty && (
        <Pressable
          onPress={navigateToLifecycle}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={[styles.iconContainer, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
            <ShieldCheck size={18} color="#3B82F6" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Warranty</Text>
            <Text style={styles.cardSubtitle}>
              Covered until{" "}
              {new Date(data.warranty.end_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            {data.warranty.category && (
              <Text style={styles.cardMeta}>{data.warranty.category}</Text>
            )}
          </View>
          <ChevronRight size={16} color={COLORS.concrete} />
        </Pressable>
      )}

      {/* Return Window */}
      {data.return_window && data.return_window.status === "open" && (
        <Pressable
          onPress={navigateToLifecycle}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={[styles.iconContainer, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
            <RotateCcw size={18} color="#F59E0B" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Return Window</Text>
            <Text style={styles.cardSubtitle}>
              {data.return_window.retailer_name} — {data.return_window.policy_days}-day policy
            </Text>
            <ReturnCountdown daysRemaining={data.return_window.days_remaining} size="small" />
          </View>
          <ChevronRight size={16} color={COLORS.concrete} />
        </Pressable>
      )}

      {/* Recall Matches */}
      {data.recall_matches.length > 0 && (
        <Pressable
          onPress={navigateToLifecycle}
          style={({ pressed }) => [styles.card, styles.cardRecall, pressed && styles.cardPressed]}
        >
          <View style={[styles.iconContainer, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
            <AlertTriangle size={18} color="#EF4444" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Recall Alert</Text>
            <Text style={[styles.cardSubtitle, { color: "#EF4444" }]}>
              {data.recall_matches.length} product{data.recall_matches.length !== 1 ? "s" : ""} may
              be affected
            </Text>
          </View>
          <ChevronRight size={16} color={COLORS.concrete} />
        </Pressable>
      )}

      {/* Duplicate */}
      {data.duplicate && (
        <Pressable
          onPress={navigateToLifecycle}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={[styles.iconContainer, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
            <Copy size={18} color="#F59E0B" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Possible Duplicate</Text>
            <Text style={styles.cardSubtitle}>
              Matches receipt from{" "}
              {data.duplicate.duplicate_receipt?.purchase_date
                ? new Date(data.duplicate.duplicate_receipt.purchase_date).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )
                : "another date"}
            </Text>
          </View>
          <ChevronRight size={16} color={COLORS.concrete} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 12,
    alignItems: "center",
  },
  sectionHeader: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "600",
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  cardRecall: {
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  cardPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },
  cardSubtitle: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  cardMeta: {
    color: COLORS.concrete,
    fontSize: 11,
    marginTop: 2,
    fontStyle: "italic",
  },
});

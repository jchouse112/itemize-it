import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Receipt, Camera } from "lucide-react-native";
import { formatCurrency, COLORS } from "../../lib/utils";
import { getReceipts, IIReceipt } from "../../lib/supabase";
import { LifecycleIconBadges } from "../../components/LifecycleIconBadges";

type StatusFilter = "all" | "processing" | "ready" | "needs_review" | "completed";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "ready", label: "Ready" },
  { key: "needs_review", label: "Review" },
  { key: "completed", label: "Done" },
];

function getReceiptStatus(receipt: IIReceipt): StatusFilter {
  if (receipt.status === "processing") return "processing";
  if (receipt.needs_review) return "needs_review";
  if (receipt.has_unclassified_items) return "ready";
  return "completed";
}

function getStatusBadge(status: StatusFilter): { label: string; color: string; bg: string } {
  switch (status) {
    case "processing":
      return { label: "Processing", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" };
    case "ready":
      return { label: "Ready", color: COLORS.safetyOrange, bg: "rgba(255,95,0,0.1)" };
    case "needs_review":
      return { label: "Needs Review", color: COLORS.critical, bg: "rgba(239,68,68,0.1)" };
    case "completed":
      return { label: "Done", color: COLORS.safe, bg: "rgba(16,185,129,0.1)" };
    default:
      return { label: "", color: COLORS.concrete, bg: "transparent" };
  }
}

function formatReceiptDate(dateStr: string | null): string {
  if (!dateStr) return "No date";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const [receipts, setReceipts] = useState<IIReceipt[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReceipts = useCallback(async () => {
    try {
      const data = await getReceipts({ limit: 50 });
      setReceipts(data);
    } catch (error) {
      console.error("Failed to load receipts:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [loadReceipts])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadReceipts();
  };

  const filteredReceipts = filter === "all"
    ? receipts
    : receipts.filter((r) => getReceiptStatus(r) === filter);

  const handleOpenReceipt = (receipt: IIReceipt) => {
    router.push({
      pathname: "/receipt/[id]",
      params: { id: receipt.id },
    });
  };

  const renderReceipt = ({ item }: { item: IIReceipt }) => {
    const status = getReceiptStatus(item);
    const badge = getStatusBadge(status);

    return (
      <Pressable
        onPress={() => handleOpenReceipt(item)}
        style={({ pressed }) => [
          styles.receiptRow,
          pressed && styles.receiptRowPressed,
        ]}
      >
        <View style={styles.receiptLeft}>
          <Text style={styles.receiptMerchant} numberOfLines={1}>
            {item.merchant || "Unknown Merchant"}
          </Text>
          <Text style={styles.receiptDate}>
            {formatReceiptDate(item.purchase_date)}
          </Text>
        </View>
        <View style={styles.receiptRight}>
          <Text style={styles.receiptAmount}>
            {item.total_cents ? formatCurrency(item.total_cents) : "---"}
          </Text>
          <View style={styles.badgeRow}>
            <LifecycleIconBadges
              hasWarranty={(item as any).has_warranty}
              hasReturnWindow={(item as any).has_return_window}
              hasRecallMatch={(item as any).has_recall_match}
              isDuplicate={(item as any).is_potential_duplicate}
            />
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoContainer}>
            <Receipt size={24} color={COLORS.safetyOrange} />
            <Text style={styles.logoText}>
              itemize<Text style={styles.logoAccent}>-it</Text>
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterChip,
                filter === f.key && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Receipt List */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.safetyOrange} />
        </View>
      ) : filteredReceipts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Camera size={48} color={COLORS.concrete} />
          <Text style={styles.emptyTitle}>
            {filter === "all" ? "No receipts yet" : "No receipts match this filter"}
          </Text>
          <Text style={styles.emptySubtitle}>
            Capture your first receipt to get started
          </Text>
          <Pressable
            onPress={() => router.push("/scan")}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaText}>Capture Receipt</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredReceipts}
          keyExtractor={(item) => item.id}
          renderItem={renderReceipt}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.safetyOrange}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
    backgroundColor: COLORS.asphalt,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.white,
  },
  logoAccent: {
    color: COLORS.safetyOrange,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  filterChipActive: {
    backgroundColor: COLORS.safetyOrange,
    borderColor: COLORS.safetyOrange,
  },
  filterChipText: {
    color: COLORS.concrete,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  receiptRowPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  receiptLeft: {
    flex: 1,
    marginRight: 12,
  },
  receiptMerchant: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  receiptDate: {
    color: COLORS.concrete,
    fontSize: 13,
    marginTop: 4,
  },
  receiptRight: {
    alignItems: "flex-end",
  },
  receiptAmount: {
    color: COLORS.white,
    fontFamily: "monospace",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    opacity: 0.7,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtitle: {
    color: COLORS.concrete,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  emptyCta: {
    marginTop: 24,
    backgroundColor: COLORS.safetyOrange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyCtaText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
});

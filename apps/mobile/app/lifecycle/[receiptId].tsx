import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Clock,
} from "lucide-react-native";
import { COLORS, formatCurrency } from "../../lib/utils";
import { useReceiptLifecycle } from "../../hooks/useReceiptLifecycle";
import { ReturnCountdown } from "../../components/ReturnCountdown";
import { DuplicateResolver } from "../../components/DuplicateResolver";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function LifecycleDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const insets = useSafeAreaInsets();
  const { data, loading, error } = useReceiptLifecycle(receiptId);
  const [merchant, setMerchant] = useState<string>("Loading...");
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState<number>(0);

  // Fetch receipt header info
  useEffect(() => {
    if (!receiptId) return;
    supabase
      .from("ii_receipts")
      .select("merchant, purchase_date, total_cents")
      .eq("id", receiptId)
      .single()
      .then(({ data: r }) => {
        if (r) {
          setMerchant(r.merchant || "Unknown Merchant");
          setPurchaseDate(r.purchase_date);
          setTotalCents(r.total_cents || 0);
        }
      });
  }, [receiptId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.safetyOrange} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error || "No lifecycle data found"}</Text>
      </View>
    );
  }

  const formattedDate = purchaseDate
    ? new Date(purchaseDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Receipt Header */}
        <View style={styles.receiptHeader}>
          <Text style={styles.merchantName}>{merchant}</Text>
          <View style={styles.receiptMeta}>
            {formattedDate && (
              <View style={styles.metaChip}>
                <Calendar size={13} color={COLORS.concrete} />
                <Text style={styles.metaText}>{formattedDate}</Text>
              </View>
            )}
            {totalCents > 0 && (
              <Text style={styles.metaAmount}>{formatCurrency(totalCents)}</Text>
            )}
          </View>
        </View>

        {/* Warranty Section */}
        {data.warranty && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <ShieldCheck size={18} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Warranty</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Coverage Period</Text>
                <Text style={styles.infoValue}>
                  {new Date(data.warranty.start_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  –{" "}
                  {new Date(data.warranty.end_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <ReturnCountdown daysRemaining={data.warranty.days_remaining} size="small" />
              </View>

              {data.warranty.category && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Category</Text>
                  <Text style={styles.infoValue}>{data.warranty.category}</Text>
                </View>
              )}

              {data.warranty.manufacturer && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Manufacturer</Text>
                  <Text style={styles.infoValue}>{data.warranty.manufacturer}</Text>
                </View>
              )}

              {data.warranty.confidence != null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Confidence</Text>
                  <Text style={styles.infoValue}>
                    {data.warranty.confidence >= 0.8
                      ? "High"
                      : data.warranty.confidence >= 0.5
                        ? "Medium"
                        : "Low"}{" "}
                    ({Math.round(data.warranty.confidence * 100)}%)
                  </Text>
                </View>
              )}

              {data.warranty.covered_items.length > 0 && (
                <View style={styles.coveredItems}>
                  <Text style={styles.infoLabel}>Covered Items</Text>
                  {data.warranty.covered_items.map((item, i) => (
                    <Text key={i} style={styles.coveredItemText}>
                      • {item.name} ({formatCurrency(item.total_price_cents)})
                    </Text>
                  ))}
                </View>
              )}

              {data.warranty.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.infoLabel}>Notes</Text>
                  <Text style={styles.notesText}>{data.warranty.notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Return Window Section */}
        {data.return_window && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <RotateCcw size={18} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Return Window</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Retailer</Text>
                <Text style={styles.infoValue}>{data.return_window.retailer_name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Policy</Text>
                <Text style={styles.infoValue}>{data.return_window.policy_days}-day return window</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Return By</Text>
                <Text style={styles.infoValue}>
                  {new Date(data.return_window.return_by).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Time Remaining</Text>
                <ReturnCountdown daysRemaining={data.return_window.days_remaining} />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <View style={[styles.statusChip, statusStyle(data.return_window.status)]}>
                  <Text style={[styles.statusText, statusTextStyle(data.return_window.status)]}>
                    {data.return_window.status.charAt(0).toUpperCase() +
                      data.return_window.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Recall Section */}
        {data.recall_matches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <AlertTriangle size={18} color="#EF4444" />
              <Text style={styles.sectionTitle}>Recall Alerts</Text>
            </View>

            {data.last_recall_check && (
              <View style={styles.recallCheckMeta}>
                <Clock size={12} color={COLORS.concrete} />
                <Text style={styles.recallCheckText}>
                  Last checked:{" "}
                  {new Date(data.last_recall_check.checked_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            )}

            {data.recall_matches.map((match) => (
              <View key={match.id} style={[styles.card, styles.cardRecall]}>
                <Text style={styles.recallProduct}>{match.product_name}</Text>

                {match.recall_id && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Recall ID</Text>
                    <Text style={styles.infoValue}>{match.recall_id}</Text>
                  </View>
                )}

                {match.hazard && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Hazard</Text>
                    <Text style={[styles.infoValue, { color: "#EF4444" }]}>{match.hazard}</Text>
                  </View>
                )}

                {match.remedy && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Remedy</Text>
                    <Text style={styles.infoValue}>{match.remedy}</Text>
                  </View>
                )}

                {match.source_url && (
                  <Pressable
                    onPress={() => Linking.openURL(match.source_url!)}
                    style={styles.externalLink}
                  >
                    <ExternalLink size={14} color={COLORS.safetyOrange} />
                    <Text style={styles.externalLinkText}>View Recall Details</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Duplicate Section */}
        {data.duplicate && (
          <View style={styles.section}>
            <DuplicateResolver
              receiptId={receiptId!}
              duplicateReceipt={data.duplicate.duplicate_receipt}
              onResolved={() => {
                // Could refresh data here
              }}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case "open":
      return { backgroundColor: "rgba(245, 158, 11, 0.1)" };
    case "returned":
      return { backgroundColor: "rgba(16, 185, 129, 0.1)" };
    case "expired":
      return { backgroundColor: "rgba(239, 68, 68, 0.1)" };
    default:
      return {};
  }
}

function statusTextStyle(status: string) {
  switch (status) {
    case "open":
      return { color: "#F59E0B" };
    case "returned":
      return { color: COLORS.safe };
    case "expired":
      return { color: "#EF4444" };
    default:
      return { color: COLORS.concrete };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: COLORS.critical,
    fontSize: 16,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
  },
  receiptHeader: {
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  merchantName: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  receiptMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: COLORS.concrete,
    fontSize: 13,
  },
  metaAmount: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "600",
  },
  card: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
  },
  cardRecall: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  infoLabel: {
    color: COLORS.concrete,
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  coveredItems: {
    paddingTop: 10,
  },
  coveredItemText: {
    color: COLORS.white,
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
  },
  notesContainer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.edgeSteel,
    marginTop: 8,
  },
  notesText: {
    color: COLORS.white,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  recallCheckMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  recallCheckText: {
    color: COLORS.concrete,
    fontSize: 12,
  },
  recallProduct: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  externalLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.edgeSteel,
  },
  externalLinkText: {
    color: COLORS.safetyOrange,
    fontSize: 14,
    fontWeight: "600",
  },
});

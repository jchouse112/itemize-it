import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Store,
  Calendar,
  CreditCard,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  User,
  Package,
  ArrowRight,
  ImageIcon,
  X,
  ZoomIn,
} from "lucide-react-native";
import { formatCurrency, COLORS } from "../../lib/utils";
import {
  supabase,
  IIReceipt,
  IIReceiptItem,
  getReceiptItems,
} from "../../lib/supabase";
import { LifecycleSection } from "../../components/LifecycleSection";

function StatusBadge({ receipt }: { receipt: IIReceipt }) {
  if (receipt.status === "processing") {
    return (
      <View style={[styles.statusBadge, { backgroundColor: "rgba(59,130,246,0.1)" }]}>
        <Clock size={14} color="#3B82F6" />
        <Text style={[styles.statusBadgeText, { color: "#3B82F6" }]}>Processing</Text>
      </View>
    );
  }
  if (receipt.needs_review) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
        <AlertCircle size={14} color={COLORS.critical} />
        <Text style={[styles.statusBadgeText, { color: COLORS.critical }]}>Needs Review</Text>
      </View>
    );
  }
  if (receipt.has_unclassified_items) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: "rgba(255,95,0,0.1)" }]}>
        <Package size={14} color={COLORS.safetyOrange} />
        <Text style={[styles.statusBadgeText, { color: COLORS.safetyOrange }]}>Ready to Classify</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: "rgba(16,185,129,0.1)" }]}>
      <CheckCircle2 size={14} color={COLORS.safe} />
      <Text style={[styles.statusBadgeText, { color: COLORS.safe }]}>Complete</Text>
    </View>
  );
}

function ClassIcon({ classification }: { classification: string }) {
  switch (classification) {
    case "business":
      return <Briefcase size={14} color={COLORS.safe} />;
    case "personal":
      return <User size={14} color="#3B82F6" />;
    default:
      return <Package size={14} color={COLORS.safetyOrange} />;
  }
}

function classColor(classification: string): string {
  switch (classification) {
    case "business":
      return COLORS.safe;
    case "personal":
      return "#3B82F6";
    default:
      return COLORS.safetyOrange;
  }
}

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [receipt, setReceipt] = useState<IIReceipt | null>(null);
  const [items, setItems] = useState<IIReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [receiptRes, itemsData] = await Promise.all([
          supabase.from("ii_receipts").select("*").eq("id", id).single(),
          getReceiptItems(id),
        ]);

        if (receiptRes.data) {
          setReceipt(receiptRes.data);
          // Fetch signed URL for receipt image
          if (receiptRes.data.storage_key) {
            setImageLoading(true);
            const { data: signedUrl } = await supabase.storage
              .from("receipts")
              .createSignedUrl(receiptRes.data.storage_key, 3600); // 1 hour
            if (signedUrl?.signedUrl) {
              setImageUrl(signedUrl.signedUrl);
            }
            setImageLoading(false);
          }
        }
        setItems(itemsData);
      } catch (error) {
        console.error("Failed to load receipt:", error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  const businessCount = items.filter((i) => i.classification === "business").length;
  const personalCount = items.filter((i) => i.classification === "personal").length;
  const unclassifiedCount = items.filter((i) => i.classification === "unclassified").length;

  const showClassifyButton =
    receipt && (receipt.has_unclassified_items || receipt.needs_review) && receipt.status !== "processing";

  const handleClassify = () => {
    if (!receipt) return;
    router.push({
      pathname: "/split",
      params: {
        receiptId: receipt.id,
        merchant: receipt.merchant || "Unknown",
        total: receipt.total_cents?.toString() || "0",
      },
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.safetyOrange} />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={[styles.container, styles.centered]}>
        <AlertCircle size={48} color={COLORS.critical} />
        <Text style={styles.errorText}>Receipt not found</Text>
      </View>
    );
  }

  const purchaseDate = receipt.purchase_date
    ? new Date(receipt.purchase_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: showClassifyButton ? 100 : 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Merchant Header */}
        <View style={styles.merchantHeader}>
          <View style={styles.merchantIconContainer}>
            <Store size={28} color={COLORS.safetyOrange} />
          </View>
          <Text style={styles.merchantName}>
            {receipt.merchant || "Unknown Merchant"}
          </Text>
          <StatusBadge receipt={receipt} />
        </View>

        {/* Info Row */}
        <View style={styles.infoRow}>
          {purchaseDate && (
            <View style={styles.infoChip}>
              <Calendar size={14} color={COLORS.concrete} />
              <Text style={styles.infoChipText}>{purchaseDate}</Text>
            </View>
          )}
          {receipt.purchase_time && (
            <View style={styles.infoChip}>
              <Clock size={14} color={COLORS.concrete} />
              <Text style={styles.infoChipText}>{receipt.purchase_time}</Text>
            </View>
          )}
        </View>

        {/* Receipt Image */}
        {(imageUrl || imageLoading) && (
          <View style={styles.imageCard}>
            <View style={styles.imageCardHeader}>
              <ImageIcon size={14} color={COLORS.concrete} />
              <Text style={styles.cardTitle}>Receipt Image</Text>
            </View>
            {imageLoading ? (
              <View style={styles.imagePlaceholder}>
                <ActivityIndicator size="small" color={COLORS.safetyOrange} />
              </View>
            ) : imageUrl ? (
              <Pressable onPress={() => setImageModalVisible(true)}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <View style={styles.imageZoomHint}>
                  <ZoomIn size={16} color={COLORS.white} />
                  <Text style={styles.imageZoomText}>Tap to view full size</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Merchant Details */}
        {(receipt.merchant_address || receipt.merchant_phone) && (
          <View style={styles.card}>
            {receipt.merchant_address && (
              <View style={styles.detailRow}>
                <MapPin size={16} color={COLORS.concrete} />
                <Text style={styles.detailText}>{receipt.merchant_address}</Text>
              </View>
            )}
            {receipt.merchant_phone && (
              <View style={styles.detailRow}>
                <Phone size={16} color={COLORS.concrete} />
                <Text style={styles.detailText}>{receipt.merchant_phone}</Text>
              </View>
            )}
          </View>
        )}

        {/* Totals Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Totals</Text>
          {receipt.subtotal_cents != null && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(receipt.subtotal_cents)}
              </Text>
            </View>
          )}
          {receipt.tax_cents != null && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(receipt.tax_cents)}
              </Text>
            </View>
          )}
          {receipt.tip_cents != null && receipt.tip_cents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tip</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(receipt.tip_cents)}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>Total</Text>
            <Text style={styles.totalValueFinal}>
              {formatCurrency(receipt.total_cents ?? 0)}
            </Text>
          </View>
        </View>

        {/* Payment Info */}
        {(receipt.payment_method || receipt.card_last_four) && (
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <CreditCard size={16} color={COLORS.concrete} />
              <Text style={styles.detailText}>
                {receipt.payment_method || "Card"}
                {receipt.card_last_four ? ` ···· ${receipt.card_last_four}` : ""}
              </Text>
            </View>
          </View>
        )}

        {/* Lifecycle Section */}
        <LifecycleSection receiptId={id!} />

        {/* Classification Summary */}
        {items.length > 0 && (
          <View style={styles.summaryRow}>
            {businessCount > 0 && (
              <View style={[styles.summaryChip, { backgroundColor: "rgba(16,185,129,0.1)" }]}>
                <Briefcase size={14} color={COLORS.safe} />
                <Text style={[styles.summaryChipText, { color: COLORS.safe }]}>
                  {businessCount} business
                </Text>
              </View>
            )}
            {personalCount > 0 && (
              <View style={[styles.summaryChip, { backgroundColor: "rgba(59,130,246,0.1)" }]}>
                <User size={14} color="#3B82F6" />
                <Text style={[styles.summaryChipText, { color: "#3B82F6" }]}>
                  {personalCount} personal
                </Text>
              </View>
            )}
            {unclassifiedCount > 0 && (
              <View style={[styles.summaryChip, { backgroundColor: "rgba(255,95,0,0.1)" }]}>
                <Package size={14} color={COLORS.safetyOrange} />
                <Text style={[styles.summaryChipText, { color: COLORS.safetyOrange }]}>
                  {unclassifiedCount} unclassified
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Items List */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            Items ({items.length})
          </Text>
          {items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Text style={styles.emptyItemsText}>No items extracted</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <View style={styles.itemNameRow}>
                    <ClassIcon classification={item.classification} />
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  {item.description && (
                    <Text style={styles.itemDescription} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                  {item.category && (
                    <Text style={styles.itemCategory}>{item.category}</Text>
                  )}
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemPrice}>
                    {formatCurrency(item.total_price_cents)}
                  </Text>
                  {item.quantity > 1 && (
                    <Text style={styles.itemQty}>×{item.quantity}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Metadata */}
        {receipt.confidence_score != null && (
          <View style={styles.metaSection}>
            <Text style={styles.metaLabel}>
              Extraction confidence: {Math.round(receipt.confidence_score * 100)}%
            </Text>
            {receipt.extraction_model && (
              <Text style={styles.metaLabel}>
                Model: {receipt.extraction_model}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Classify CTA */}
      {showClassifyButton && (
        <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={handleClassify}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
            ]}
          >
            <Text style={styles.ctaText}>Classify Items</Text>
            <ArrowRight size={20} color={COLORS.white} />
          </Pressable>
        </View>
      )}

      {/* Fullscreen Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalClose}
            onPress={() => setImageModalVisible(false)}
          >
            <X size={24} color={COLORS.white} />
          </Pressable>
          {imageUrl && (
            <Image
              source={{ uri: imageUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
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
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  merchantHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  merchantIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  merchantName: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoChipText: {
    color: COLORS.concrete,
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "600",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  detailText: {
    color: COLORS.white,
    fontSize: 14,
    flex: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  totalLabel: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  totalValue: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: "monospace",
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.edgeSteel,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabelFinal: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  totalValueFinal: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  summaryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
    fontWeight: "600",
  },
  emptyItems: {
    padding: 24,
    alignItems: "center",
  },
  emptyItemsText: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  itemDescription: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 22,
  },
  itemCategory: {
    color: COLORS.concrete,
    fontSize: 11,
    marginTop: 4,
    marginLeft: 22,
    fontStyle: "italic",
  },
  itemRight: {
    alignItems: "flex-end",
  },
  itemPrice: {
    color: COLORS.white,
    fontFamily: "monospace",
    fontWeight: "bold",
    fontSize: 15,
  },
  itemQty: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 4,
  },
  metaSection: {
    paddingVertical: 12,
    opacity: 0.5,
  },
  metaLabel: {
    color: COLORS.concrete,
    fontSize: 11,
    marginBottom: 4,
  },
  ctaContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.asphalt,
    borderTopWidth: 1,
    borderTopColor: COLORS.edgeSteel,
  },
  ctaButton: {
    backgroundColor: COLORS.safetyOrange,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaButtonPressed: {
    opacity: 0.8,
  },
  ctaText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  imageCard: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  imageCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  imagePlaceholder: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.asphalt,
    borderRadius: 8,
  },
  imagePreview: {
    width: "100%",
    height: 240,
    borderRadius: 8,
    backgroundColor: COLORS.asphalt,
  },
  imageZoomHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  imageZoomText: {
    color: COLORS.concrete,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.8,
  },
});

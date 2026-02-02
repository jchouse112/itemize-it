import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Briefcase, User, ChevronLeft, Scissors } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { formatCurrency, formatDollars, COLORS } from "../lib/utils";
import { supabase, IIReceiptItem, getReceiptItems, classifyItem, splitItem } from "../lib/supabase";
import { SplitCard } from "../components";

type AssignmentType = "business" | "personal";

export default function SplitScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    receiptId?: string;
    merchant?: string;
    total?: string;
    itemCount?: string;
  }>();

  const [items, setItems] = useState<IIReceiptItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(false);

  // Animation values
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const currentItem = items[currentIndex];
  const isComplete = currentIndex >= items.length && items.length > 0;

  // Load items from database
  useEffect(() => {
    async function loadItems() {
      if (!params.receiptId) {
        setIsLoading(false);
        return;
      }

      const receiptItems = await getReceiptItems(params.receiptId);
      // Only show unclassified items
      const unclassified = receiptItems.filter(
        (item) => item.classification === "unclassified"
      );
      setItems(unclassified);
      setIsLoading(false);
    }

    loadItems();
  }, [params.receiptId]);

  const advanceToNext = useCallback(() => {
    // Reset animation values for next card
    translateX.value = 0;
    opacity.value = 1;
    scale.value = 1;
    setIsSplitMode(false);
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleAssign = useCallback(
    async (type: AssignmentType) => {
      if (isComplete || !currentItem || isSaving) return;

      setIsSaving(true);

      // Determine slide direction (business = left, personal = right)
      const direction = type === "business" ? -1 : 1;

      // Save to database
      const success = await classifyItem(currentItem.id, type);
      if (!success) {
        setIsSaving(false);
        return;
      }

      // Animate card sliding off screen
      translateX.value = withTiming(
        direction * 400,
        {
          duration: 250,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        },
        () => {
          // After animation completes, advance to next item
          runOnJS(advanceToNext)();
          runOnJS(setIsSaving)(false);
        }
      );

      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 250 });
    },
    [currentItem, isComplete, isSaving, advanceToNext]
  );

  const handleSplit = useCallback(
    async (splits: { amountCents: number; classification: "business" | "personal" }[]) => {
      if (!currentItem || isSaving) return;

      setIsSaving(true);

      const children = await splitItem(currentItem.id, splits);

      if (children) {
        // Animate card sliding down
        translateX.value = withTiming(
          0,
          { duration: 50 },
          () => {
            runOnJS(advanceToNext)();
            runOnJS(setIsSaving)(false);
          }
        );
        opacity.value = withTiming(0, { duration: 200 });
        scale.value = withTiming(0.9, { duration: 200 });
      } else {
        setIsSaving(false);
      }
    },
    [currentItem, isSaving, advanceToNext]
  );

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleGoBack = () => {
    router.back();
  };

  const handleDone = () => {
    router.replace("/");
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.safetyOrange} />
        <Text style={styles.loadingText}>Loading items...</Text>
      </View>
    );
  }

  // No items to classify
  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingBottom: insets.bottom }]}>
        <Text style={styles.emptyTitle}>No Items to Classify</Text>
        <Text style={styles.emptyText}>
          {params.receiptId
            ? "All items have already been classified."
            : "No receipt data found."}
        </Text>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Completion state
  if (isComplete) {
    return (
      <View
        style={[styles.container, styles.completionContainer, { paddingBottom: insets.bottom }]}
      >
        <Text style={styles.completionTitle}>All Items Classified!</Text>

        {/* Receipt Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.merchantName}>{params.merchant || "Receipt"}</Text>
          <Text style={styles.totalAmount}>
            {formatCurrency(parseInt(params.total || "0", 10))}
          </Text>
          <Text style={styles.itemCountText}>
            {items.length} items classified
          </Text>
        </View>

        <Pressable onPress={handleDone} style={styles.doneButton}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleGoBack} style={styles.headerBackButton}>
          <ChevronLeft size={24} color={COLORS.white} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.merchantText} numberOfLines={1}>
            {params.merchant || "Receipt"}
          </Text>
          <Text style={styles.totalText}>
            {formatCurrency(parseInt(params.total || "0", 10))}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            Item {currentIndex + 1} of {items.length}
          </Text>
          <View style={styles.dotsContainer}>
            {items.slice(0, 10).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      idx < currentIndex
                        ? COLORS.safe
                        : idx === currentIndex
                        ? COLORS.safetyOrange
                        : COLORS.edgeSteel,
                  },
                ]}
              />
            ))}
            {items.length > 10 && (
              <Text style={styles.moreDotsText}>+{items.length - 10}</Text>
            )}
          </View>
        </View>
      </View>

      {isSplitMode ? (
        /* Split Mode: Show SplitCard */
        <ScrollView
          style={styles.splitScrollView}
          contentContainerStyle={styles.splitScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <SplitCard
            itemName={currentItem.name}
            totalCents={currentItem.total_price_cents}
            onSplit={handleSplit}
            onCancel={() => setIsSplitMode(false)}
            isSaving={isSaving}
          />
        </ScrollView>
      ) : (
        <>
          {/* Item Card (Chopping Block) */}
          <View style={styles.cardContainer}>
            <Animated.View style={[styles.itemCard, cardAnimatedStyle]}>
              <Text style={styles.cardLabel}>Classify This Item</Text>
              <Text style={styles.cardDescription}>{currentItem.name}</Text>
              <Text style={styles.cardAmount}>
                {formatCurrency(currentItem.total_price_cents)}
              </Text>
              {currentItem.quantity > 1 && (
                <Text style={styles.cardQuantity}>
                  Qty: {currentItem.quantity} × {formatCurrency(currentItem.unit_price_cents || 0)}
                </Text>
              )}
            </Animated.View>
          </View>

          {/* Assignment Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Business Button */}
            <Pressable
              onPress={() => handleAssign("business")}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.assignButton,
                pressed && styles.assignButtonPressed,
                isSaving && styles.buttonDisabled,
              ]}
            >
              <Briefcase size={28} color={COLORS.safe} />
              <Text style={styles.buttonLabel}>Business</Text>
              <Text style={styles.buttonHint}>Tap to assign</Text>
            </Pressable>

            {/* Split Button (center) */}
            <Pressable
              onPress={() => setIsSplitMode(true)}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.splitButton,
                pressed && styles.assignButtonPressed,
                isSaving && styles.buttonDisabled,
              ]}
            >
              <Scissors size={22} color={COLORS.safetyOrange} />
              <Text style={styles.splitButtonLabel}>Split</Text>
            </Pressable>

            {/* Personal Button */}
            <Pressable
              onPress={() => handleAssign("personal")}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.assignButton,
                pressed && styles.assignButtonPressed,
                isSaving && styles.buttonDisabled,
              ]}
            >
              <User size={28} color={COLORS.concrete} />
              <Text style={styles.buttonLabel}>Personal</Text>
              <Text style={styles.buttonHint}>Tap to assign</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    color: COLORS.concrete,
    marginTop: 16,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.concrete,
    textAlign: "center",
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.edgeSteel,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  headerBackButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  merchantText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  totalText: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  headerSpacer: {
    width: 40,
  },
  completionContainer: {
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  completionTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 2,
    borderColor: COLORS.safe,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    marginBottom: 32,
  },
  merchantName: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  totalAmount: {
    color: COLORS.safetyOrange,
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  itemCountText: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: COLORS.safetyOrange,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressText: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  moreDotsText: {
    color: COLORS.concrete,
    fontSize: 12,
    marginLeft: 4,
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  itemCard: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 2,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 24,
  },
  cardLabel: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  cardDescription: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardAmount: {
    color: COLORS.safetyOrange,
    fontSize: 30,
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  cardQuantity: {
    color: COLORS.concrete,
    fontSize: 14,
    marginTop: 8,
  },
  buttonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 16,
  },
  assignButton: {
    flex: 1,
    height: 96,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 2,
    borderColor: COLORS.edgeSteel,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  assignButtonPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  splitButton: {
    width: 64,
    height: 96,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 2,
    borderColor: COLORS.safetyOrange,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  splitButtonLabel: {
    color: COLORS.safetyOrange,
    fontWeight: "600",
    fontSize: 12,
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: COLORS.white,
    fontWeight: "600",
    marginTop: 8,
  },
  buttonHint: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 4,
  },
  splitScrollView: {
    flex: 1,
  },
  splitScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});

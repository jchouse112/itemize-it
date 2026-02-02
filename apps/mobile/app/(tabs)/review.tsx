import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Animated as RNAnimated } from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart2,
  ChevronRight,
  Briefcase,
  User,
  X,
  Undo2,
  CheckSquare,
  Square,
  ShieldAlert,
} from "lucide-react-native";
import { formatCurrency, COLORS } from "../../lib/utils";
import { supabase, IIReceipt, IIReceiptItem, getReceipts, bulkClassifyItems, undoBulkClassify } from "../../lib/supabase";
import { useLifecycleAlerts } from "../../hooks/useLifecycleAlerts";
import { AlertCard } from "../../components/AlertCard";

type TaskStatus = "READY" | "NEEDS_REVIEW" | "PROCESSING";

interface ActionTask {
  id: string;
  merchant: string;
  date: string;
  amount: number | null;
  status: TaskStatus;
  itemsCount?: number;
  issue?: string;
  unclassifiedItemIds?: string[];
}

interface UndoState {
  message: string;
  previousStates: { id: string; classification: string }[];
}

function getTaskStatus(receipt: IIReceipt): TaskStatus {
  if (receipt.status === "processing") return "PROCESSING";
  if (receipt.needs_review) return "NEEDS_REVIEW";
  if (receipt.has_unclassified_items) return "READY";
  return "READY";
}

function getStatusLabel(task: ActionTask): string {
  if (task.status === "READY") return `${task.itemsCount || 0} items to swipe`;
  if (task.status === "NEEDS_REVIEW") return task.issue || "Needs review";
  return "Processing...";
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";

  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userInitials, setUserInitials] = useState("??");
  const { alerts, counts: alertCounts, loading: alertsLoading } = useLifecycleAlerts();
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  // Bulk selection state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);

  // Undo state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoOpacity = useRef(new RNAnimated.Value(0)).current;

  // Load action tasks from database
  const loadTasks = useCallback(async () => {
    try {
      const receipts = await getReceipts({ limit: 50 });

      // Filter to only actionable receipts
      const actionable = receipts.filter(
        (r) => r.has_unclassified_items || r.needs_review || r.status === "processing"
      );

      // For each receipt, get unclassified items
      const tasksWithCounts = await Promise.all(
        actionable.map(async (receipt) => {
          let itemsCount = 0;
          let unclassifiedItemIds: string[] = [];

          if (receipt.has_unclassified_items) {
            const { data, count } = await supabase
              .from("ii_receipt_items")
              .select("id", { count: "exact" })
              .eq("receipt_id", receipt.id)
              .eq("classification", "unclassified");
            itemsCount = count || 0;
            unclassifiedItemIds = (data || []).map((i) => i.id);
          }

          return {
            id: receipt.id,
            merchant: receipt.merchant || "Unknown Merchant",
            date: formatRelativeDate(receipt.purchase_date || receipt.created_at),
            amount: receipt.total_cents,
            status: getTaskStatus(receipt),
            itemsCount,
            issue: receipt.needs_review ? "Needs review" : undefined,
            unclassifiedItemIds,
          };
        })
      );

      setTasks(tasksWithCounts);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load user info
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const parts = user.email.split("@")[0].split(".");
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : parts[0].slice(0, 2).toUpperCase();
        setUserInitials(initials);
      }
    }
    loadUser();
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTasks();
      return () => {
        // Clear undo on leave
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      };
    }, [loadTasks])
  );

  // --- Selection Handlers ---

  const toggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedIds(new Set());
    }
    setIsSelectMode(!isSelectMode);
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = tasks
      .filter((t) => t.status !== "PROCESSING" && (t.unclassifiedItemIds?.length ?? 0) > 0)
      .map((t) => t.id);
    setSelectedIds(new Set(allIds));
  };

  // --- Bulk Actions ---

  const handleBulkClassify = async (classification: "business" | "personal") => {
    if (selectedIds.size === 0 || isBulkActing) return;
    setIsBulkActing(true);

    // Collect all unclassified item IDs from selected receipts
    const allItemIds: string[] = [];
    for (const task of tasks) {
      if (selectedIds.has(task.id) && task.unclassifiedItemIds) {
        allItemIds.push(...task.unclassifiedItemIds);
      }
    }

    if (allItemIds.length === 0) {
      setIsBulkActing(false);
      return;
    }

    const result = await bulkClassifyItems(allItemIds, classification);

    if (result.updated > 0) {
      // Show undo toast
      showUndoToast(
        `${result.updated} items marked as ${classification}`,
        result.previousStates
      );

      // Exit select mode and reload
      setIsSelectMode(false);
      setSelectedIds(new Set());
      await loadTasks();
    }

    setIsBulkActing(false);
  };

  // --- Undo ---

  const showUndoToast = (message: string, previousStates: { id: string; classification: string }[]) => {
    // Clear any existing timer
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    setUndoState({ message, previousStates });

    // Fade in
    RNAnimated.timing(undoOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss after 6 seconds
    undoTimerRef.current = setTimeout(() => {
      dismissUndo();
    }, 6000);
  };

  const dismissUndo = () => {
    RNAnimated.timing(undoOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setUndoState(null);
    });
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;

    const success = await undoBulkClassify(undoState.previousStates);
    if (success) {
      dismissUndo();
      await loadTasks();
    }
  };

  // --- Navigation ---

  const handleOpenStats = () => {
    // Future route
  };

  const handleReview = (id: string) => {
    if (isSelectMode) {
      toggleSelectTask(id);
      return;
    }
    router.push({
      pathname: "/receipt/[id]",
      params: { id },
    });
  };

  const selectedCount = selectedIds.size;
  const selectedItemCount = tasks
    .filter((t) => selectedIds.has(t.id))
    .reduce((sum, t) => sum + (t.unclassifiedItemIds?.length || 0), 0);

  return (
    <View style={styles.container}>
      {/* 1. Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          {isSelectMode ? (
            <>
              <Pressable onPress={toggleSelectMode} style={styles.headerAction}>
                <X size={24} color={COLORS.white} />
              </Pressable>
              <Text style={styles.selectCountText}>
                {selectedCount} receipt{selectedCount !== 1 ? "s" : ""} selected
                {selectedItemCount > 0 && ` (${selectedItemCount} items)`}
              </Text>
              <Pressable onPress={selectAll} style={styles.headerAction}>
                <Text style={styles.selectAllText}>All</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.logoContainer}>
                <Receipt size={24} color={COLORS.safetyOrange} />
                <Text style={styles.logoText}>
                  itemize<Text style={styles.logoAccent}>-it</Text>
                </Text>
              </View>
              <View style={styles.headerActions}>
                {tasks.length > 0 && (
                  <Pressable onPress={toggleSelectMode} style={styles.selectButton}>
                    <CheckSquare size={20} color={COLORS.concrete} />
                    <Text style={styles.selectButtonText}>Select</Text>
                  </Pressable>
                )}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{userInitials}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Stats Card */}
        {!isSelectMode && (
          <Pressable
            onPress={handleOpenStats}
            style={({ pressed }) => [
              styles.statsCard,
              pressed && styles.statsCardPressed,
            ]}
          >
            <View style={styles.statsCardContent}>
              <View style={styles.statsIconContainer}>
                <BarChart2 size={20} color={COLORS.safe} />
              </View>
              <View>
                <Text style={styles.statsTitle}>Job Reports</Text>
                <Text style={styles.statsSubtitle}>View budget & spend</Text>
              </View>
            </View>
            <ChevronRight size={20} color={COLORS.concrete} />
          </Pressable>
        )}

        {/* 3. Lifecycle Alerts / Protection Summary */}
        {!isSelectMode && (
          <View style={styles.actionSection}>
            {alertCounts.total > 0 ? (
              <>
                <Pressable
                  onPress={() => setAlertsCollapsed(!alertsCollapsed)}
                  style={styles.alertsHeaderRow}
                >
                  <View style={styles.alertsHeaderLeft}>
                    <ShieldAlert size={16} color={COLORS.safetyOrange} />
                    <Text style={styles.sectionHeader}>
                      Alerts ({alertCounts.total})
                    </Text>
                  </View>
                  <Text style={styles.alertsToggle}>
                    {alertsCollapsed ? "Show" : "Hide"}
                  </Text>
                </Pressable>
                {!alertsCollapsed &&
                  alerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      type={alert.type}
                      urgency={alert.urgency}
                      title={alert.title}
                      subtitle={alert.subtitle}
                      onPress={() => {
                        router.push({
                          pathname: "/lifecycle/[receiptId]",
                          params: { receiptId: alert.receipt_id },
                        });
                      }}
                    />
                  ))}
              </>
            ) : (
              <Pressable
                onPress={() => router.push("/protection")}
                style={({ pressed }) => [
                  styles.protectionCard,
                  pressed && styles.protectionCardPressed,
                ]}
              >
                <View style={styles.protectionCardContent}>
                  <View style={styles.protectionIconContainer}>
                    <ShieldAlert size={22} color={COLORS.safetyOrange} />
                  </View>
                  <View style={styles.protectionTextContainer}>
                    <Text style={styles.protectionTitle}>Receipt Protection</Text>
                    <Text style={styles.protectionSubtitle}>
                      Warranties, returns, recalls & duplicates — tracked automatically
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={COLORS.concrete} />
              </Pressable>
            )}
          </View>
        )}

        {/* 4. Action Feed */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionHeader}>
            Action Items ({tasks.length})
          </Text>

          {isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={COLORS.safetyOrange} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.emptyState}>
              <CheckCircle2 size={48} color={COLORS.concrete} />
              <Text style={styles.emptyText}>All caught up!</Text>
            </View>
          ) : (
            tasks.map((task) => {
              const isSelected = selectedIds.has(task.id);
              return (
                <Pressable
                  key={task.id}
                  onPress={() => handleReview(task.id)}
                  onLongPress={() => {
                    if (!isSelectMode) {
                      setIsSelectMode(true);
                      setSelectedIds(new Set([task.id]));
                    }
                  }}
                  style={({ pressed }) => [
                    styles.taskCard,
                    pressed && styles.taskCardPressed,
                    isSelected && styles.taskCardSelected,
                  ]}
                >
                  {/* Checkbox (select mode) */}
                  {isSelectMode && (
                    <View style={styles.checkboxContainer}>
                      {isSelected ? (
                        <CheckSquare size={22} color={COLORS.safetyOrange} />
                      ) : (
                        <Square size={22} color={COLORS.concrete} />
                      )}
                    </View>
                  )}

                  {/* Left: Icon & Details */}
                  <View style={styles.taskCardLeft}>
                    {!isSelectMode && <StatusIcon status={task.status} />}
                    <View style={styles.taskDetails}>
                      <Text style={styles.taskMerchant} numberOfLines={1}>
                        {task.merchant}
                      </Text>
                      <Text style={styles.taskMeta}>
                        {task.date} • {getStatusLabel(task)}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Amount */}
                  <View style={styles.taskCardRight}>
                    {task.amount ? (
                      <Text style={styles.taskAmount}>
                        {formatCurrency(task.amount)}
                      </Text>
                    ) : (
                      <Text style={styles.taskAmountEmpty}>---</Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bulk Action Bar (select mode) */}
      {isSelectMode && selectedCount > 0 && (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => handleBulkClassify("business")}
            disabled={isBulkActing}
            style={({ pressed }) => [
              styles.bulkButton,
              styles.bulkButtonBusiness,
              pressed && styles.bulkButtonPressed,
              isBulkActing && styles.buttonDisabled,
            ]}
          >
            <Briefcase size={20} color={COLORS.safe} />
            <Text style={styles.bulkButtonText}>All Business</Text>
          </Pressable>

          <Pressable
            onPress={() => handleBulkClassify("personal")}
            disabled={isBulkActing}
            style={({ pressed }) => [
              styles.bulkButton,
              styles.bulkButtonPersonal,
              pressed && styles.bulkButtonPressed,
              isBulkActing && styles.buttonDisabled,
            ]}
          >
            <User size={20} color={COLORS.concrete} />
            <Text style={styles.bulkButtonText}>All Personal</Text>
          </Pressable>
        </View>
      )}

      {/* Undo Toast */}
      {undoState && (
        <RNAnimated.View
          style={[
            styles.undoToast,
            { opacity: undoOpacity, bottom: insets.bottom + (isSelectMode ? 80 : 16) },
          ]}
        >
          <Text style={styles.undoText} numberOfLines={1}>
            {undoState.message}
          </Text>
          <Pressable onPress={handleUndo} style={styles.undoButton}>
            <Undo2 size={16} color={COLORS.safetyOrange} />
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        </RNAnimated.View>
      )}
    </View>
  );
}

// --- Helper Components ---

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "READY":
      return (
        <View style={[styles.statusIcon, styles.statusIconReady]}>
          <CheckCircle2 size={20} color={COLORS.safetyOrange} />
        </View>
      );
    case "NEEDS_REVIEW":
      return (
        <View style={[styles.statusIcon, styles.statusIconReview]}>
          <AlertCircle size={20} color={COLORS.critical} />
        </View>
      );
    case "PROCESSING":
    default:
      return (
        <View style={[styles.statusIcon, styles.statusIconProcessing]}>
          <Clock size={20} color="#3B82F6" />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
    backgroundColor: COLORS.asphalt,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerAction: {
    padding: 4,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  selectButtonText: {
    color: COLORS.concrete,
    fontSize: 13,
    fontWeight: "500",
  },
  selectCountText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  selectAllText: {
    color: COLORS.safetyOrange,
    fontSize: 14,
    fontWeight: "600",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.concrete,
    fontSize: 12,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.gunmetal,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  statsCardPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  statsCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.asphalt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  statsTitle: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  statsSubtitle: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  protectionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
  },
  protectionCardPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  protectionCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  protectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 95, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  protectionTextContainer: {
    flex: 1,
  },
  protectionTitle: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  protectionSubtitle: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  alertsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  alertsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertsToggle: {
    color: COLORS.safetyOrange,
    fontSize: 13,
    fontWeight: "600",
  },
  actionSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 16,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    opacity: 0.5,
  },
  emptyText: {
    color: COLORS.concrete,
    marginTop: 16,
    fontSize: 16,
  },
  taskCard: {
    marginBottom: 12,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskCardPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  taskCardSelected: {
    borderColor: COLORS.safetyOrange,
    backgroundColor: "rgba(255, 95, 0, 0.05)",
  },
  checkboxContainer: {
    marginRight: 12,
  },
  taskCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconReady: {
    backgroundColor: "rgba(255, 95, 0, 0.1)",
  },
  statusIconReview: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  statusIconProcessing: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  taskDetails: {
    flex: 1,
  },
  taskMerchant: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  taskMeta: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 4,
  },
  taskCardRight: {
    alignItems: "flex-end",
  },
  taskAmount: {
    color: COLORS.white,
    fontFamily: "monospace",
    fontWeight: "bold",
    fontSize: 16,
  },
  taskAmountEmpty: {
    color: COLORS.concrete,
    fontFamily: "monospace",
    fontSize: 14,
  },
  // Bulk action bar
  bulkBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.edgeSteel,
    backgroundColor: COLORS.asphalt,
  },
  bulkButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
  },
  bulkButtonBusiness: {
    borderColor: COLORS.safe,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  bulkButtonPersonal: {
    borderColor: COLORS.edgeSteel,
    backgroundColor: COLORS.gunmetal,
  },
  bulkButtonPressed: {
    opacity: 0.7,
  },
  bulkButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Undo toast
  undoToast: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  undoText: {
    color: COLORS.white,
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  undoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255, 95, 0, 0.15)",
  },
  undoButtonText: {
    color: COLORS.safetyOrange,
    fontWeight: "600",
    fontSize: 14,
  },
});

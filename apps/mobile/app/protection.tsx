import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  Copy,
  ChevronRight,
  ArrowLeft,
  Bell,
} from "lucide-react-native";
import { COLORS } from "../lib/utils";
import { useLifecycleAlerts } from "../hooks/useLifecycleAlerts";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  stat: string;
  statColor: string;
  count: number;
}

function FeatureCard({ icon, title, description, stat, statColor, count }: FeatureCardProps) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureCardHeader}>
        {icon}
        <Text style={styles.featureCardTitle}>{title}</Text>
        {count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: statColor }]}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.featureCardDescription}>{description}</Text>
      <Text style={[styles.featureCardStat, { color: statColor }]}>{stat}</Text>
    </View>
  );
}

export default function ProtectionScreen() {
  const insets = useSafeAreaInsets();
  const { alerts, counts } = useLifecycleAlerts();

  const warrantyAlerts = alerts.filter((a) => a.type === "warranty_expiring");
  const returnAlerts = alerts.filter((a) => a.type === "return_expiring");
  const recallAlerts = alerts.filter((a) => a.type === "recall");
  const duplicateAlerts = alerts.filter((a) => a.type === "duplicate");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.title}>Receipt Protection</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconContainer}>
            <ShieldCheck size={32} color={COLORS.safetyOrange} />
          </View>
          <Text style={styles.heroTitle}>Full lifecycle protection</Text>
          <Text style={styles.heroSubtitle}>
            Every receipt you capture keeps working for you — tracking warranties,
            monitoring returns, and catching duplicates automatically.
          </Text>
          {counts.total > 0 ? (
            <View style={styles.heroStatsRow}>
              {counts.critical > 0 && (
                <View style={[styles.heroStat, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
                  <Text style={[styles.heroStatText, { color: COLORS.critical }]}>
                    {counts.critical} urgent
                  </Text>
                </View>
              )}
              {counts.warning > 0 && (
                <View style={[styles.heroStat, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
                  <Text style={[styles.heroStatText, { color: COLORS.warn }]}>
                    {counts.warning} warning
                  </Text>
                </View>
              )}
              {counts.info > 0 && (
                <View style={[styles.heroStat, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
                  <Text style={[styles.heroStatText, { color: "#3B82F6" }]}>
                    {counts.info} info
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.heroStatsRow}>
              <View style={[styles.heroStat, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
                <Text style={[styles.heroStatText, { color: COLORS.safe }]}>
                  No active alerts
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Feature Cards */}
        <Text style={styles.sectionHeader}>Features</Text>

        <FeatureCard
          icon={
            <View style={[styles.featureIcon, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
              <ShieldCheck size={18} color="#3B82F6" />
            </View>
          }
          title="Warranty Tracking"
          description="Automatically detects warranty-eligible purchases — tools, electronics, equipment. Tracks coverage dates and alerts you before expiry."
          stat="112+ MANUFACTURERS RECOGNIZED"
          statColor="#3B82F6"
          count={warrantyAlerts.length}
        />

        <FeatureCard
          icon={
            <View style={[styles.featureIcon, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
              <RotateCcw size={18} color="#F59E0B" />
            </View>
          }
          title="Return Deadlines"
          description="Calculates return windows for 30+ major retailers. Color-coded urgency alerts so you never miss a deadline."
          stat="ALERTS 7 DAYS BEFORE EXPIRY"
          statColor="#F59E0B"
          count={returnAlerts.length}
        />

        <FeatureCard
          icon={
            <View style={[styles.featureIcon, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
              <AlertTriangle size={18} color="#EF4444" />
            </View>
          }
          title="Recall Detection"
          description="AI-powered product recall monitoring. If a tool or product you purchased gets recalled, you'll know immediately."
          stat="AUTOMATIC SAFETY ALERTS"
          statColor="#EF4444"
          count={recallAlerts.length}
        />

        <FeatureCard
          icon={
            <View style={[styles.featureIcon, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
              <Copy size={18} color="#F59E0B" />
            </View>
          }
          title="Duplicate Detection"
          description="Fingerprints every receipt by merchant, date, total, and payment method. Catches double-scans and email+photo overlaps."
          stat="PREVENTS DOUBLE-COUNTING"
          statColor="#F59E0B"
          count={duplicateAlerts.length}
        />

        {/* Active Alerts */}
        {counts.total > 0 && (
          <>
            <Text style={styles.sectionHeader}>Active Alerts</Text>
            {alerts.map((alert) => (
              <Pressable
                key={alert.id}
                onPress={() =>
                  router.push({
                    pathname: "/lifecycle/[receiptId]",
                    params: { receiptId: alert.receipt_id },
                  })
                }
                style={({ pressed }) => [
                  styles.alertRow,
                  pressed && styles.alertRowPressed,
                ]}
              >
                <View
                  style={[
                    styles.alertAccent,
                    {
                      backgroundColor:
                        alert.urgency === "critical"
                          ? COLORS.critical
                          : alert.urgency === "warning"
                          ? COLORS.warn
                          : "#3B82F6",
                    },
                  ]}
                />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertSubtitle}>{alert.subtitle}</Text>
                </View>
                <ChevronRight size={16} color={COLORS.concrete} />
              </Pressable>
            ))}
          </>
        )}

        {/* Notification Settings Hint */}
        <Pressable
          onPress={() => router.push("/(tabs)/settings")}
          style={({ pressed }) => [
            styles.notifHint,
            pressed && styles.notifHintPressed,
          ]}
        >
          <Bell size={16} color={COLORS.concrete} />
          <Text style={styles.notifHintText}>
            Configure alert notifications in Settings
          </Text>
          <ChevronRight size={14} color={COLORS.concrete} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Hero
  heroCard: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 28,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 95, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 95, 0, 0.2)",
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: COLORS.concrete,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  heroStat: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroStatText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Section
  sectionHeader: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
    fontWeight: "600",
  },
  // Feature Cards
  featureCard: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  featureCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCardTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
  },
  featureCardDescription: {
    color: COLORS.concrete,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  featureCardStat: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: "monospace",
  },
  // Alert rows
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  alertRowPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  alertAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  alertContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  alertTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  alertSubtitle: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  // Notification hint
  notifHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 20,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
  },
  notifHintPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  notifHintText: {
    color: COLORS.concrete,
    fontSize: 13,
    flex: 1,
  },
});

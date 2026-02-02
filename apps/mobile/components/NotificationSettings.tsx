import { View, Text, Switch, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import { Bell, FileText, ClipboardList, Download, Moon, ShieldCheck, RotateCcw, AlertTriangle } from "lucide-react-native";
import { COLORS } from "../lib/utils";
import { useNotificationPreferences, IINotificationPreferences } from "../hooks/useNotificationPreferences";
import { usePushNotifications } from "../hooks/usePushNotifications";

const QUIET_HOURS_OPTIONS = [
  { label: "None", start: null, end: null },
  { label: "9 PM – 8 AM", start: "21:00", end: "08:00" },
  { label: "10 PM – 7 AM", start: "22:00", end: "07:00" },
  { label: "11 PM – 6 AM", start: "23:00", end: "06:00" },
];

export function NotificationSettings() {
  const { preferences, loading, saving, updatePreferences } = useNotificationPreferences();
  const { permission, error: pushError } = usePushNotifications();
  const [showQuietPicker, setShowQuietPicker] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.safetyOrange} />
      </View>
    );
  }

  const handleToggle = (key: keyof IINotificationPreferences, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  const currentQuiet = QUIET_HOURS_OPTIONS.find(
    (o) => o.start === preferences.quiet_start && o.end === preferences.quiet_end
  ) || QUIET_HOURS_OPTIONS[0];

  const permissionDenied = permission === "denied";

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>

      {permissionDenied && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Push notifications are disabled in device settings.
          </Text>
        </View>
      )}

      {/* Master Push Toggle */}
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={[styles.iconContainer, { backgroundColor: "rgba(255, 95, 0, 0.1)" }]}>
            <Bell size={18} color={COLORS.safetyOrange} />
          </View>
          <View>
            <Text style={styles.rowTitle}>Push Notifications</Text>
            <Text style={styles.rowSubtitle}>Enable all push notifications</Text>
          </View>
        </View>
        <Switch
          value={preferences.push_enabled}
          onValueChange={(v) => handleToggle("push_enabled", v)}
          trackColor={{ false: COLORS.edgeSteel, true: COLORS.safetyOrange }}
          thumbColor={COLORS.white}
          disabled={saving || permissionDenied}
        />
      </View>

      {preferences.push_enabled && !permissionDenied && (
        <>
          {/* Receipt Processed */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(34, 197, 94, 0.1)" }]}>
                <FileText size={18} color={COLORS.safe} />
              </View>
              <View>
                <Text style={styles.rowTitle}>Receipt Processed</Text>
                <Text style={styles.rowSubtitle}>When a scanned or emailed receipt is ready</Text>
              </View>
            </View>
            <Switch
              value={preferences.ii_receipt_processed}
              onValueChange={(v) => handleToggle("ii_receipt_processed", v)}
              trackColor={{ false: COLORS.edgeSteel, true: COLORS.safetyOrange }}
              thumbColor={COLORS.white}
              disabled={saving}
            />
          </View>

          {/* Items Need Review */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
                <ClipboardList size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.rowTitle}>Items Need Review</Text>
                <Text style={styles.rowSubtitle}>Daily digest of unclassified items</Text>
              </View>
            </View>
            <Switch
              value={preferences.ii_items_review}
              onValueChange={(v) => handleToggle("ii_items_review", v)}
              trackColor={{ false: COLORS.edgeSteel, true: COLORS.safetyOrange }}
              thumbColor={COLORS.white}
              disabled={saving}
            />
          </View>

          {/* Export Ready */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(168, 85, 247, 0.1)" }]}>
                <Download size={18} color="#A855F7" />
              </View>
              <View>
                <Text style={styles.rowTitle}>Export Ready</Text>
                <Text style={styles.rowSubtitle}>When a CSV export is generated</Text>
              </View>
            </View>
            <Switch
              value={preferences.ii_export_ready}
              onValueChange={(v) => handleToggle("ii_export_ready", v)}
              trackColor={{ false: COLORS.edgeSteel, true: COLORS.safetyOrange }}
              thumbColor={COLORS.white}
              disabled={saving}
            />
          </View>

          {/* Warranty Expiring */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
                <ShieldCheck size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.rowTitle}>Warranty Expiring</Text>
                <Text style={styles.rowSubtitle}>When a warranty is about to expire</Text>
              </View>
            </View>
            <Switch
              value={preferences.ii_warranty_expiring}
              onValueChange={(v) => handleToggle("ii_warranty_expiring", v)}
              trackColor={{ false: COLORS.edgeSteel, true: COLORS.safetyOrange }}
              thumbColor={COLORS.white}
              disabled={saving}
            />
          </View>

          {/* Return Window Closing */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
                <RotateCcw size={18} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.rowTitle}>Return Window Closing</Text>
                <Text style={styles.rowSubtitle}>When a return deadline is approaching</Text>
              </View>
            </View>
            <Switch
              value={preferences.ii_return_closing}
              onValueChange={(v) => handleToggle("ii_return_closing", v)}
              trackColor={{ false: COLORS.edgeSteel, true: COLORS.safetyOrange }}
              thumbColor={COLORS.white}
              disabled={saving}
            />
          </View>

          {/* Recall Alerts */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
                <AlertTriangle size={18} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.rowTitle}>Recall Alerts</Text>
                <Text style={styles.rowSubtitle}>When a product recall is detected</Text>
              </View>
            </View>
            <Switch
              value={preferences.ii_recall_alert}
              onValueChange={(v) => handleToggle("ii_recall_alert", v)}
              trackColor={{ false: COLORS.edgeSteel, true: COLORS.safetyOrange }}
              thumbColor={COLORS.white}
              disabled={saving}
            />
          </View>

          {/* Quiet Hours */}
          <Pressable
            onPress={() => setShowQuietPicker(!showQuietPicker)}
            style={styles.row}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(99, 102, 241, 0.1)" }]}>
                <Moon size={18} color="#6366F1" />
              </View>
              <View>
                <Text style={styles.rowTitle}>Quiet Hours</Text>
                <Text style={styles.rowSubtitle}>{currentQuiet.label}</Text>
              </View>
            </View>
          </Pressable>

          {showQuietPicker && (
            <View style={styles.picker}>
              {QUIET_HOURS_OPTIONS.map((option) => {
                const isActive = option.start === preferences.quiet_start;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => {
                      updatePreferences({
                        quiet_start: option.start,
                        quiet_end: option.end,
                      });
                      setShowQuietPicker(false);
                    }}
                    style={[styles.pickerOption, isActive && styles.pickerOptionActive]}
                  >
                    <Text style={[styles.pickerText, isActive && styles.pickerTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  loadingContainer: {
    marginTop: 24,
    paddingVertical: 20,
    alignItems: "center",
  },
  sectionHeader: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  warningBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    padding: 12,
  },
  warningText: {
    color: "#EF4444",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },
  rowSubtitle: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  picker: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: COLORS.gunmetal,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    overflow: "hidden",
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  pickerOptionActive: {
    backgroundColor: "rgba(255, 95, 0, 0.1)",
  },
  pickerText: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  pickerTextActive: {
    color: COLORS.safetyOrange,
    fontWeight: "600",
  },
});

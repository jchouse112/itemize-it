import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Building2,
  Mail,
  LogOut,
  ChevronRight,
  User,
  Download,
  ShieldCheck,
} from "lucide-react-native";
import { COLORS } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { NotificationSettings } from "../../components/NotificationSettings";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const userEmail = user?.email ?? null;

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setShowSignOutModal(false);
    setSigningOut(false);
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <Text style={styles.sectionHeader}>Account</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIconContainer}>
              <User size={20} color={COLORS.safetyOrange} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{userEmail ?? "Loading..."}</Text>
            </View>
          </View>
        </View>

        {/* Business Section */}
        <Text style={styles.sectionHeader}>Business</Text>

        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowIconContainer}>
              <Building2 size={20} color={COLORS.safetyOrange} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Business Profile</Text>
              <Text style={styles.rowHint}>Manage your business info</Text>
            </View>
            <ChevronRight size={18} color={COLORS.concrete} />
          </Pressable>

          <View style={styles.rowDivider} />

          <Pressable
            onPress={() => router.push("/email-alias")}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowIconContainer}>
              <Mail size={20} color={COLORS.safetyOrange} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Email Alias</Text>
              <Text style={styles.rowHint}>Forward receipts via email</Text>
            </View>
            <ChevronRight size={18} color={COLORS.concrete} />
          </Pressable>
        </View>

        {/* Data & Protection Section */}
        <Text style={styles.sectionHeader}>Data & Protection</Text>

        <View style={styles.card}>
          <Pressable
            onPress={() => router.push("/protection")}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowIconContainer}>
              <ShieldCheck size={20} color={COLORS.safetyOrange} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Receipt Protection</Text>
              <Text style={styles.rowHint}>Warranties, returns, recalls & duplicates</Text>
            </View>
            <ChevronRight size={18} color={COLORS.concrete} />
          </Pressable>

          <View style={styles.rowDivider} />

          <Pressable
            onPress={() => router.push("/export")}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowIconContainer}>
              <Download size={20} color={COLORS.safetyOrange} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Export Data</Text>
              <Text style={styles.rowHint}>CSV export with filters</Text>
            </View>
            <ChevronRight size={18} color={COLORS.concrete} />
          </Pressable>
        </View>

        {/* Notifications Section */}
        <Text style={styles.sectionHeader}>Notifications</Text>
        <NotificationSettings />

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutPressed,
          ]}
        >
          <LogOut size={20} color={COLORS.critical} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        {/* App Info */}
        <Text style={styles.appVersion}>itemize-it v0.1.0</Text>
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !signingOut && setShowSignOutModal(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconCircle}>
                <LogOut size={24} color={COLORS.critical} />
              </View>
            </View>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalMessage}>
              You'll need to sign back in to access your receipts and data.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButtonCancel,
                  pressed && styles.modalButtonCancelPressed,
                ]}
                onPress={() => setShowSignOutModal(false)}
                disabled={signingOut}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButtonConfirm,
                  pressed && styles.modalButtonConfirmPressed,
                  signingOut && styles.modalButtonDisabled,
                ]}
                onPress={confirmSignOut}
                disabled={signingOut}
              >
                <Text style={styles.modalButtonConfirmText}>
                  {signingOut ? "Signing out..." : "Sign Out"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingBottom: 16,
  },
  title: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
    marginTop: 24,
    fontWeight: "600",
  },
  card: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  rowPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  rowIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.asphalt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  rowValue: {
    color: COLORS.concrete,
    fontSize: 13,
    marginTop: 2,
  },
  rowHint: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.edgeSteel,
    marginLeft: 64,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 32,
    padding: 16,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
  },
  signOutPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  signOutText: {
    color: COLORS.critical,
    fontSize: 16,
    fontWeight: "600",
  },
  appVersion: {
    color: COLORS.concrete,
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalCard: {
    backgroundColor: COLORS.gunmetal,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIconRow: {
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.concrete,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: COLORS.asphalt,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  modalButtonCancelPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.white,
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: COLORS.critical,
  },
  modalButtonConfirmPressed: {
    opacity: 0.85,
  },
  modalButtonConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
});

import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, ImagePlus, FileText, Mail, WifiOff, ChevronRight } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../../lib/utils";
import { useSyncContext } from "../../context/SyncContext";
import { useNetworkContext } from "../../context/NetworkContext";

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const { pendingCount, failedCount, totalCount, isSyncing } = useSyncContext();
  const { isOnline } = useNetworkContext();

  const handleCamera = () => {
    router.push("/scan");
  };

  const handleGallery = () => {
    router.push({
      pathname: "/scan",
      params: { source: "gallery" },
    });
  };

  const handleUploadPdf = () => {
    router.push({
      pathname: "/scan",
      params: { source: "gallery" },
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Capture Receipt</Text>
        <Text style={styles.subtitle}>Choose how to add a receipt</Text>
      </View>

      <View style={styles.content}>
        {/* Primary: Camera */}
        <Pressable
          onPress={handleCamera}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.primaryIconContainer}>
            <Camera size={40} color={COLORS.white} />
          </View>
          <Text style={styles.primaryButtonLabel}>Take Photo</Text>
          <Text style={styles.primaryButtonHint}>
            Use your camera to scan a receipt
          </Text>
        </Pressable>

        {/* Secondary options row */}
        <View style={styles.secondaryRow}>
          <Pressable
            onPress={handleGallery}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <ImagePlus size={28} color={COLORS.safetyOrange} />
            <Text style={styles.secondaryLabel}>Gallery</Text>
            <Text style={styles.secondaryHint}>From photos</Text>
          </Pressable>

          <Pressable
            onPress={handleUploadPdf}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <FileText size={28} color={COLORS.safetyOrange} />
            <Text style={styles.secondaryLabel}>Upload</Text>
            <Text style={styles.secondaryHint}>PDF or image</Text>
          </Pressable>
        </View>

        {/* Email forwarding */}
        <Pressable
          onPress={() => router.push("/email-alias")}
          style={({ pressed }) => [
            styles.emailCard,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.emailCardContent}>
            <View style={styles.emailIconContainer}>
              <Mail size={20} color={COLORS.safetyOrange} />
            </View>
            <View style={styles.emailTextContainer}>
              <Text style={styles.emailTitle}>Email Receipts</Text>
              <Text style={styles.emailSubtitle}>
                Forward receipts to auto-scan
              </Text>
            </View>
            <ChevronRight size={16} color={COLORS.concrete} />
          </View>
        </Pressable>

        {/* Network status */}
        {!isOnline && (
          <View style={styles.networkBanner}>
            <WifiOff size={14} color={COLORS.warn} />
            <Text style={styles.networkBannerText}>
              You're offline — captures will be queued
            </Text>
          </View>
        )}

        {/* Offline queue card */}
        {totalCount > 0 && (
          <Pressable
            onPress={() => router.push("/pending-uploads")}
            style={({ pressed }) => [
              styles.offlineCard,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.offlineCardLeft}>
              {isSyncing ? (
                <ActivityIndicator size="small" color={COLORS.safetyOrange} />
              ) : (
                <WifiOff size={16} color={COLORS.warn} />
              )}
              <Text style={styles.offlineText}>
                {isSyncing
                  ? "Uploading..."
                  : `Pending Uploads: ${pendingCount}${failedCount > 0 ? ` (${failedCount} failed)` : ""}`}
              </Text>
            </View>
            <ChevronRight size={16} color={COLORS.concrete} />
          </Pressable>
        )}
      </View>
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
    paddingBottom: 24,
  },
  title: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    color: COLORS.concrete,
    fontSize: 16,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.safetyOrange,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  primaryButtonLabel: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "bold",
  },
  primaryButtonHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: 4,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  secondaryLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  secondaryHint: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 4,
  },
  emailCard: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
  },
  emailCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.asphalt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  emailTextContainer: {
    flex: 1,
  },
  emailTitle: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 15,
  },
  emailSubtitle: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  networkBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  networkBannerText: {
    color: COLORS.warn,
    fontSize: 13,
    fontWeight: "500",
  },
  offlineCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  offlineCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineText: {
    color: COLORS.warn,
    fontSize: 14,
    fontWeight: "600",
  },
});

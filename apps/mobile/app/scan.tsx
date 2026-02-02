import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera as CameraIcon, X, ImagePlus, WifiOff } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useState, useCallback, useEffect } from "react";
import { COLORS } from "../lib/utils";
import { CapturePreview } from "../components/CapturePreview";
import { ImageEditor } from "../components/ImageEditor";
import { useImageEnhancement } from "../hooks/useImageEnhancement";
import { useOfflineCapture } from "../hooks/useOfflineCapture";
import type { EnhancedImage, ImageQualityResult } from "../hooks/useImageEnhancement";

type CaptureState =
  | { phase: "camera" }
  | {
      phase: "preview";
      originalUri: string;
      currentUri: string;
      isEnhanced: boolean;
    };

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { uploadUri, source } = useLocalSearchParams<{ uploadUri?: string; source?: string }>();
  const [isUploading, setIsUploading] = useState(false);
  const [assessingQuality, setAssessingQuality] = useState(false);
  const [enhancingImage, setEnhancingImage] = useState(false);
  const [imageQuality, setImageQuality] = useState<ImageQualityResult | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [captureState, setCaptureState] = useState<CaptureState>({ phase: "camera" });
  const [uploadUriHandled, setUploadUriHandled] = useState(false);

  const { assessQuality, autoEnhance } = useImageEnhancement();
  const { isOnline, uploading: offlineUploading, uploadOrQueue } = useOfflineCapture();

  // After capture/pick, run auto-enhance + quality assessment, then show preview
  const handleImageCaptured = useCallback(
    async (uri: string) => {
      // Copy to a stable cache path so the file persists after ImagePicker/Manipulator cleanup
      const stableDir = `${FileSystem.cacheDirectory}ii-captures/`;
      const dirInfo = await FileSystem.getInfoAsync(stableDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(stableDir, { intermediates: true });
      }
      const stableUri = `${stableDir}${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: stableUri });

      setCaptureState({
        phase: "preview",
        originalUri: stableUri,
        currentUri: stableUri,
        isEnhanced: false,
      });

      // Run auto-enhance
      setEnhancingImage(true);
      const enhanced = await autoEnhance(stableUri);
      const finalUri = enhanced?.uri ?? stableUri;
      const wasEnhanced = !!enhanced;

      setCaptureState({
        phase: "preview",
        originalUri: stableUri,
        currentUri: finalUri,
        isEnhanced: wasEnhanced,
      });
      setEnhancingImage(false);

      // Assess quality on the (possibly enhanced) image
      setAssessingQuality(true);
      const quality = await assessQuality(finalUri);
      setImageQuality(quality);
      setAssessingQuality(false);
    },
    [autoEnhance, assessQuality]
  );

  // If navigated with an uploadUri param (from Gallery/Upload button), go directly to preview
  // Decode the URI since route params may URL-encode special characters like file:// paths
  useEffect(() => {
    if (uploadUri && !uploadUriHandled) {
      setUploadUriHandled(true);
      // Expo router may double-encode the URI, so decode until stable
      let decodedUri = uploadUri;
      try {
        let prev = "";
        while (prev !== decodedUri) {
          prev = decodedUri;
          decodedUri = decodeURIComponent(decodedUri);
        }
      } catch {
        // already fully decoded
      }
      handleImageCaptured(decodedUri);
    }
  }, [uploadUri, uploadUriHandled, handleImageCaptured]);

  // If navigated with source=gallery, immediately open the gallery picker
  const [galleryOpened, setGalleryOpened] = useState(false);
  useEffect(() => {
    if (source === "gallery" && !galleryOpened) {
      setGalleryOpened(true);
      handlePickImage();
    }
  }, [source, galleryOpened]);

  const handleCapture = async () => {
    if (captureState.phase !== "camera") return;

    try {
      // Use system camera via ImagePicker (avoids expo-camera native view issues)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      await handleImageCaptured(result.assets[0].uri);
    } catch (error) {
      console.error("Capture error:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    }
  };

  const handlePickImage = async () => {
    if (captureState.phase !== "camera") return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      await handleImageCaptured(result.assets[0].uri);
    } catch (error) {
      console.error("Pick image error:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleRetake = useCallback(() => {
    setCaptureState({ phase: "camera" });
    setImageQuality(null);
  }, []);

  const handleEditSave = useCallback(
    async (editedImage: EnhancedImage) => {
      setEditorVisible(false);

      if (captureState.phase !== "preview") return;

      setCaptureState({
        ...captureState,
        currentUri: editedImage.uri,
        isEnhanced: true,
      });

      // Re-assess quality after edit
      setAssessingQuality(true);
      const quality = await assessQuality(editedImage.uri);
      setImageQuality(quality);
      setAssessingQuality(false);
    },
    [captureState, assessQuality]
  );

  const handleUpload = async () => {
    if (captureState.phase !== "preview") return;

    setIsUploading(true);
    try {
      const result = await uploadOrQueue(captureState.currentUri);

      if (result.queued) {
        // Saved to offline queue
        Alert.alert(
          "Saved to Queue",
          result.error || "Receipt saved for upload when back online.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      // Direct upload succeeded — navigate to split
      if (result.receiptData) {
        const { receipt, items } = result.receiptData;
        router.push({
          pathname: "/split",
          params: {
            receiptId: receipt.id,
            merchant: receipt.merchant || "Unknown",
            total: receipt.total_cents?.toString() || "0",
            itemCount: items.length.toString(),
          },
        });
      }
    } catch (error) {
      console.error("Process error:", error);
      Alert.alert(
        "Extraction Failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  // ── Preview phase ──
  if (captureState.phase === "preview") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <CapturePreview
          imageUri={captureState.currentUri}
          imageQuality={imageQuality}
          isEnhanced={captureState.isEnhanced}
          assessingQuality={assessingQuality}
          enhancing={enhancingImage}
          uploading={isUploading}
          onEdit={() => setEditorVisible(true)}
          onCancel={handleRetake}
          onUpload={handleUpload}
        />

        <ImageEditor
          visible={editorVisible}
          imageUri={captureState.currentUri}
          onClose={() => setEditorVisible(false)}
          onSave={handleEditSave}
        />
      </View>
    );
  }

  // ── Camera phase ──
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.cameraHeader}>
        <Text style={styles.cameraTitle}>Capture Receipt</Text>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <X size={20} color={COLORS.white} />
        </Pressable>
      </View>

      {/* Scan frame visual */}
      <View style={styles.cameraContainer}>
        <View style={styles.scanFrame}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
          <View style={styles.scanFrameCenter}>
            <CameraIcon size={48} color={COLORS.edgeSteel} />
          </View>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Take a photo or pick from gallery
          </Text>
          <Text style={styles.subInstructionsText}>
            Ensure good lighting for best results
          </Text>
          {!isOnline && (
            <View style={styles.offlineChip}>
              <WifiOff size={14} color={COLORS.warn} />
              <Text style={styles.offlineChipText}>
                Offline — will queue for upload
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={handleCapture}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.primaryActionPressed,
          ]}
        >
          <CameraIcon size={22} color={COLORS.white} />
          <Text style={styles.primaryActionText}>Take Photo</Text>
        </Pressable>

        <Pressable
          onPress={handlePickImage}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.secondaryActionPressed,
          ]}
        >
          <ImagePlus size={22} color={COLORS.safetyOrange} />
          <Text style={styles.secondaryActionText}>Choose from Gallery</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cameraTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.edgeSteel,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 260,
    height: 340,
    position: "relative",
  },
  scanFrameCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.safetyOrange,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.safetyOrange,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.safetyOrange,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.safetyOrange,
    borderBottomRightRadius: 8,
  },
  instructionsContainer: {
    marginTop: 32,
    alignItems: "center",
  },
  instructionsText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  subInstructionsText: {
    color: COLORS.concrete,
    fontSize: 14,
    marginTop: 8,
  },
  actions: {
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.safetyOrange,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryActionPressed: {
    opacity: 0.85,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.gunmetal,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  secondaryActionPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  secondaryActionText: {
    color: COLORS.safetyOrange,
    fontSize: 17,
    fontWeight: "600",
  },
  offlineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
  },
  offlineChipText: {
    color: COLORS.warn,
    fontSize: 13,
    fontWeight: "500",
  },
});

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useImageEnhancement } from '../hooks/useImageEnhancement';
import type { EnhancedImage, ImageQualityResult } from '../hooks/useImageEnhancement';
import { COLORS } from '../lib/utils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_MAX_HEIGHT = SCREEN_HEIGHT * 0.5;

interface ImageEditorProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onSave: (enhancedImage: EnhancedImage) => void;
}

type RotationDegrees = 0 | 90 | 180 | 270;

export function ImageEditor({ visible, imageUri, onClose, onSave }: ImageEditorProps) {
  const {
    processing,
    assessQuality,
    autoEnhance,
    rotateImage,
    flipImage,
  } = useImageEnhancement();

  const [currentUri, setCurrentUri] = useState(imageUri);
  const [currentRotation, setCurrentRotation] = useState<RotationDegrees>(0);
  const [quality, setQuality] = useState<ImageQualityResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (visible && imageUri) {
      setCurrentUri(imageUri);
      setCurrentRotation(0);
      setHasChanges(false);
      assessQuality(imageUri).then(setQuality);
      Image.getSize(
        imageUri,
        (width, height) => setImageSize({ width, height }),
        () => setImageSize({ width: SCREEN_WIDTH, height: IMAGE_MAX_HEIGHT })
      );
    }
  }, [visible, imageUri, assessQuality]);

  const displayDimensions = useCallback(() => {
    if (!imageSize.width || !imageSize.height) {
      return { width: SCREEN_WIDTH - 32, height: IMAGE_MAX_HEIGHT };
    }
    const maxWidth = SCREEN_WIDTH - 32;
    const maxHeight = IMAGE_MAX_HEIGHT;
    const aspectRatio = imageSize.width / imageSize.height;
    let width = maxWidth;
    let height = width / aspectRatio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    return { width, height };
  }, [imageSize]);

  const handleRotate = useCallback(async () => {
    const newRotation = ((currentRotation + 90) % 360) as RotationDegrees;
    const result = await rotateImage(currentUri, 90);
    if (result) {
      setCurrentUri(result.uri);
      setCurrentRotation(newRotation);
      setHasChanges(true);
      setImageSize({ width: result.width, height: result.height });
    }
  }, [currentUri, currentRotation, rotateImage]);

  const handleFlipHorizontal = useCallback(async () => {
    const result = await flipImage(currentUri, 'horizontal');
    if (result) {
      setCurrentUri(result.uri);
      setHasChanges(true);
    }
  }, [currentUri, flipImage]);

  const handleFlipVertical = useCallback(async () => {
    const result = await flipImage(currentUri, 'vertical');
    if (result) {
      setCurrentUri(result.uri);
      setHasChanges(true);
    }
  }, [currentUri, flipImage]);

  const handleAutoEnhance = useCallback(async () => {
    const result = await autoEnhance(currentUri);
    if (result) {
      setCurrentUri(result.uri);
      setHasChanges(true);
      const newQuality = await assessQuality(result.uri);
      setQuality(newQuality);
    }
  }, [currentUri, autoEnhance, assessQuality]);

  const handleReset = useCallback(() => {
    setCurrentUri(imageUri);
    setCurrentRotation(0);
    setHasChanges(false);
    assessQuality(imageUri).then(setQuality);
    Image.getSize(
      imageUri,
      (width, height) => setImageSize({ width, height }),
      () => {}
    );
  }, [imageUri, assessQuality]);

  const handleSave = useCallback(() => {
    onSave({
      uri: currentUri,
      width: imageSize.width,
      height: imageSize.height,
    });
  }, [currentUri, imageSize, onSave]);

  const dimensions = displayDimensions();

  const qualityColor =
    quality && quality.score >= 80
      ? COLORS.safe
      : quality && quality.score >= 60
      ? COLORS.warn
      : COLORS.critical;

  const qualityLabel =
    quality && quality.score >= 80
      ? 'Good'
      : quality && quality.score >= 60
      ? 'Fair'
      : 'Poor';

  const qualityIcon: keyof typeof Ionicons.glyphMap =
    quality && quality.score >= 80
      ? 'checkmark-circle'
      : quality && quality.score >= 60
      ? 'alert-circle'
      : 'warning';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Image</Text>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.headerButton}
            disabled={!hasChanges}
          >
            <Text
              style={[
                styles.resetText,
                { color: hasChanges ? COLORS.safetyOrange : COLORS.concrete },
              ]}
            >
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Image Preview */}
          <View style={styles.imageContainer}>
            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={COLORS.safetyOrange} />
                <Text style={styles.processingText}>Processing...</Text>
              </View>
            )}
            <Image
              source={{ uri: currentUri }}
              style={[styles.image, { width: dimensions.width, height: dimensions.height }]}
              resizeMode="contain"
            />
          </View>

          {/* Quality Indicator */}
          {quality && (
            <View style={styles.qualityContainer}>
              <View style={styles.qualityHeader}>
                <Ionicons name={qualityIcon} size={20} color={qualityColor} />
                <Text style={styles.qualityTitle}>
                  Image Quality: {qualityLabel}
                </Text>
              </View>
              {quality.recommendation && (
                <Text style={styles.qualityText}>{quality.recommendation}</Text>
              )}
            </View>
          )}

          {/* Edit Tools */}
          <View style={styles.toolsSection}>
            <Text style={styles.sectionTitle}>Adjustments</Text>

            <TouchableOpacity
              style={styles.autoEnhanceButton}
              onPress={handleAutoEnhance}
              disabled={processing}
            >
              <Ionicons name="sparkles" size={20} color={COLORS.white} />
              <Text style={styles.autoEnhanceText}>Auto Enhance</Text>
            </TouchableOpacity>

            <View style={styles.toolsRow}>
              <TouchableOpacity
                style={styles.toolButton}
                onPress={handleRotate}
                disabled={processing}
              >
                <Ionicons name="refresh" size={24} color={COLORS.white} />
                <Text style={styles.toolLabel}>Rotate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolButton}
                onPress={handleFlipHorizontal}
                disabled={processing}
              >
                <Ionicons name="swap-horizontal" size={24} color={COLORS.white} />
                <Text style={styles.toolLabel}>Flip H</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolButton}
                onPress={handleFlipVertical}
                disabled={processing}
              >
                <Ionicons name="swap-vertical" size={24} color={COLORS.white} />
                <Text style={styles.toolLabel}>Flip V</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Pressable style={styles.footerButtonOutline} onPress={onClose}>
            <Text style={styles.footerButtonOutlineText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.footerButtonPrimary, processing && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={processing}
          >
            <Text style={styles.footerButtonPrimaryText}>Use This Image</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  image: {
    borderRadius: 8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 17, 21, 0.8)',
    borderRadius: 8,
    zIndex: 10,
  },
  processingText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.white,
  },
  qualityContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: COLORS.edgeSteel,
  },
  qualityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.white,
  },
  qualityText: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 28,
    color: COLORS.concrete,
  },
  toolsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.white,
  },
  autoEnhanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: COLORS.safetyOrange,
  },
  autoEnhanceText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toolButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 4,
    backgroundColor: COLORS.edgeSteel,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.edgeSteel,
  },
  footerButtonOutline: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  footerButtonOutlineText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  footerButtonPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.safetyOrange,
  },
  footerButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});

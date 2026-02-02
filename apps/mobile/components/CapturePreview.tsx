import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/utils';
import { ImageQualityIndicator } from './ImageQualityIndicator';
import type { ImageQualityResult } from '../hooks/useImageEnhancement';

interface CapturePreviewProps {
  imageUri: string;
  imageQuality: ImageQualityResult | null;
  isEnhanced: boolean;
  assessingQuality: boolean;
  enhancing: boolean;
  uploading: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onUpload: () => void;
}

export function CapturePreview({
  imageUri,
  imageQuality,
  isEnhanced,
  assessingQuality,
  enhancing,
  uploading,
  onEdit,
  onCancel,
  onUpload,
}: CapturePreviewProps) {
  const isProcessing = assessingQuality || enhancing;
  const isDisabled = uploading || isProcessing;

  return (
    <View style={styles.container}>
      {/* Image preview card */}
      <View style={styles.card}>
        <View style={styles.imageWrapper}>
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={COLORS.safetyOrange} />
              <Text style={styles.processingText}>
                {enhancing ? 'Enhancing...' : 'Checking quality...'}
              </Text>
            </View>
          )}
          <Image
            source={{ uri: imageUri }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
          {!isProcessing && (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Ionicons name="create-outline" size={20} color={COLORS.white} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quality + enhanced badge row */}
      <View style={styles.qualityRow}>
        <ImageQualityIndicator
          quality={imageQuality}
          loading={isProcessing}
          compact
        />
        {isEnhanced && !isProcessing && (
          <View style={styles.enhancedBadge}>
            <Ionicons name="sparkles" size={14} color={COLORS.safe} />
            <Text style={styles.enhancedText}>Auto-enhanced</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.buttonOutline, isDisabled && styles.buttonDisabled]}
          onPress={onCancel}
          disabled={isDisabled}
        >
          <Text style={styles.buttonOutlineText}>Retake</Text>
        </Pressable>
        <Pressable
          style={[styles.buttonPrimary, isDisabled && styles.buttonDisabled]}
          onPress={onUpload}
          disabled={isDisabled}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.buttonPrimaryText}>Upload</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.gunmetal,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imageWrapper: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 400,
    borderRadius: 12,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 17, 21, 0.8)',
    borderRadius: 12,
    zIndex: 10,
  },
  processingText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.white,
  },
  editButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 17, 21, 0.9)',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.white,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  enhancedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.safe + '20',
  },
  enhancedText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.safe,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonOutline: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  buttonOutlineText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  buttonPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.safetyOrange,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

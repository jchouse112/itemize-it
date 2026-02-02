import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * Supported output formats
 * WebP offers ~30% smaller files than JPEG at similar quality
 */
export type ImageFormat = 'jpeg' | 'webp' | 'png';

export interface EnhancementSettings {
  brightness: number; // -1 to 1, 0 is neutral
  contrast: number; // -1 to 1, 0 is neutral
  rotation: number; // 0, 90, 180, 270
  cropRect?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
}

export interface CompressionOptions {
  format?: ImageFormat;
  quality?: number;
  maxDimension?: number;
}

export interface ImageQualityResult {
  score: number; // 0-100
  issues: ImageQualityIssue[];
  recommendation: string | null;
}

export type ImageQualityIssue =
  | 'too_dark'
  | 'too_bright'
  | 'low_contrast'
  | 'too_small'
  | 'blurry';

export interface EnhancedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

const DEFAULT_SETTINGS: EnhancementSettings = {
  brightness: 0,
  contrast: 0,
  rotation: 0,
};

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const COMPRESSION_QUALITY = 0.85;
const DEFAULT_MAX_DIMENSION = 2000;

function toManipulatorFormat(format: ImageFormat): ImageManipulator.SaveFormat {
  switch (format) {
    case 'webp':
      return ImageManipulator.SaveFormat.WEBP;
    case 'png':
      return ImageManipulator.SaveFormat.PNG;
    case 'jpeg':
    default:
      return ImageManipulator.SaveFormat.JPEG;
  }
}

/**
 * Hook for image enhancement and quality assessment.
 * Ported from Recevity mobile, adapted for Itemize-It.
 */
export function useImageEnhancement() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessQuality = useCallback(
    async (imageUri: string): Promise<ImageQualityResult> => {
      try {
        const info = await FileSystem.getInfoAsync(imageUri);
        if (!info.exists) {
          return { score: 0, issues: [], recommendation: 'Image file not found' };
        }

        const result = await ImageManipulator.manipulateAsync(imageUri, [], {
          base64: false,
        });

        const issues: ImageQualityIssue[] = [];
        let score = 100;

        if (result.width < MIN_WIDTH || result.height < MIN_HEIGHT) {
          issues.push('too_small');
          score -= 20;
        }

        const fileSizeKB = (info.size || 0) / 1024;
        if (fileSizeKB < 50) {
          issues.push('blurry');
          score -= 15;
        }

        if (fileSizeKB > 100 && fileSizeKB < 5000) {
          // Good range
        } else if (fileSizeKB >= 5000) {
          score = Math.max(score, 85);
        }

        let recommendation: string | null = null;
        if (issues.includes('too_small')) {
          recommendation = 'Image resolution is low. Try capturing closer or with better lighting.';
        } else if (issues.includes('blurry')) {
          recommendation = 'Image may be blurry. Try holding the camera steady.';
        }

        return {
          score: Math.max(0, Math.min(100, score)),
          issues,
          recommendation,
        };
      } catch (err) {
        console.error('Quality assessment error:', err);
        return { score: 50, issues: [], recommendation: 'Could not assess image quality' };
      }
    },
    []
  );

  const autoEnhance = useCallback(
    async (
      imageUri: string,
      options?: CompressionOptions
    ): Promise<EnhancedImage | null> => {
      setProcessing(true);
      setError(null);

      const {
        format = 'jpeg',
        quality = COMPRESSION_QUALITY,
        maxDimension = DEFAULT_MAX_DIMENSION,
      } = options || {};

      try {
        const original = await ImageManipulator.manipulateAsync(imageUri, [], {
          base64: false,
        });

        const actions: ImageManipulator.Action[] = [];

        if (original.width > maxDimension || original.height > maxDimension) {
          if (original.width > original.height) {
            actions.push({ resize: { width: maxDimension } });
          } else {
            actions.push({ resize: { height: maxDimension } });
          }
        }

        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          actions,
          { compress: quality, format: toManipulatorFormat(format) }
        );

        setProcessing(false);
        return { uri: result.uri, width: result.width, height: result.height };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Enhancement failed';
        setError(message);
        setProcessing(false);
        return null;
      }
    },
    []
  );

  const optimizeForUpload = useCallback(
    async (
      imageUri: string,
      options?: {
        preferWebP?: boolean;
        quality?: number;
        maxDimension?: number;
      }
    ): Promise<EnhancedImage | null> => {
      const {
        preferWebP = Platform.OS === 'android',
        quality = COMPRESSION_QUALITY,
        maxDimension = DEFAULT_MAX_DIMENSION,
      } = options || {};

      const format: ImageFormat = preferWebP ? 'webp' : 'jpeg';
      return autoEnhance(imageUri, { format, quality, maxDimension });
    },
    [autoEnhance]
  );

  const applyEnhancements = useCallback(
    async (
      imageUri: string,
      settings: EnhancementSettings
    ): Promise<EnhancedImage | null> => {
      setProcessing(true);
      setError(null);

      try {
        const actions: ImageManipulator.Action[] = [];

        if (settings.rotation !== 0) {
          actions.push({ rotate: settings.rotation });
        }

        if (settings.cropRect) {
          actions.push({ crop: settings.cropRect });
        }

        const original = await ImageManipulator.manipulateAsync(imageUri, [], {
          base64: false,
        });

        const maxDimension = 2000;
        if (original.width > maxDimension || original.height > maxDimension) {
          if (original.width > original.height) {
            actions.push({ resize: { width: maxDimension } });
          } else {
            actions.push({ resize: { height: maxDimension } });
          }
        }

        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          actions,
          { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProcessing(false);
        return { uri: result.uri, width: result.width, height: result.height };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Enhancement failed';
        setError(message);
        setProcessing(false);
        return null;
      }
    },
    []
  );

  const rotateImage = useCallback(
    async (imageUri: string, degrees: 90 | 180 | 270 = 90): Promise<EnhancedImage | null> => {
      setProcessing(true);
      setError(null);

      try {
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ rotate: degrees }],
          { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProcessing(false);
        return { uri: result.uri, width: result.width, height: result.height };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Rotation failed';
        setError(message);
        setProcessing(false);
        return null;
      }
    },
    []
  );

  const cropImage = useCallback(
    async (
      imageUri: string,
      crop: { originX: number; originY: number; width: number; height: number }
    ): Promise<EnhancedImage | null> => {
      setProcessing(true);
      setError(null);

      try {
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ crop }],
          { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProcessing(false);
        return { uri: result.uri, width: result.width, height: result.height };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Crop failed';
        setError(message);
        setProcessing(false);
        return null;
      }
    },
    []
  );

  const flipImage = useCallback(
    async (
      imageUri: string,
      direction: 'horizontal' | 'vertical'
    ): Promise<EnhancedImage | null> => {
      setProcessing(true);
      setError(null);

      try {
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ flip: direction === 'horizontal' ? ImageManipulator.FlipType.Horizontal : ImageManipulator.FlipType.Vertical }],
          { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
        );

        setProcessing(false);
        return { uri: result.uri, width: result.width, height: result.height };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Flip failed';
        setError(message);
        setProcessing(false);
        return null;
      }
    },
    []
  );

  return {
    processing,
    error,
    assessQuality,
    autoEnhance,
    optimizeForUpload,
    applyEnhancements,
    rotateImage,
    cropImage,
    flipImage,
    DEFAULT_SETTINGS,
  };
}

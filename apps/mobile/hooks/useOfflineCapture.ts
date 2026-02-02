/**
 * Hook for receipt capture with offline support.
 * Online: direct extract API call.
 * Offline: save locally + queue for later sync.
 * Graceful degradation: if online upload fails, falls back to queue.
 */

import { useCallback, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { useNetworkContext } from '../context/NetworkContext';
import { useSyncContext } from '../context/SyncContext';
import { saveLocalReceipt } from '../lib/offlineStorage';
import { addToQueue } from '../lib/syncQueue';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? 'https://recevity.com';

export interface UploadResult {
  success: boolean;
  queued: boolean;
  receiptData?: {
    receipt: { id: string; merchant?: string; total_cents?: number };
    items: Array<{ id: string; description: string; amount_cents: number }>;
  };
  localId?: string;
  error?: string;
}

export function useOfflineCapture() {
  const { isOnline } = useNetworkContext();
  const { refresh } = useSyncContext();
  const [uploading, setUploading] = useState(false);

  const uploadOrQueue = useCallback(
    async (imageUri: string): Promise<UploadResult> => {
      setUploading(true);

      try {
        if (isOnline) {
          // Online: direct extract
          // First try to refresh the session to ensure a valid token
          const { data: { session: refreshedSession }, error: refreshError } =
            await supabase.auth.refreshSession();

          if (__DEV__) {
            console.log('[Upload] refreshSession result:', {
              hasSession: !!refreshedSession,
              refreshError: refreshError?.message,
            });
          }

          // Fall back to cached session if refresh fails (e.g. still valid)
          const session = refreshedSession ??
            (await supabase.auth.getSession()).data.session;

          if (__DEV__) {
            console.log('[Upload] token status:', {
              hasAccessToken: !!session?.access_token,
              tokenPrefix: session?.access_token?.substring(0, 20),
              expiresAt: session?.expires_at
                ? new Date(session.expires_at * 1000).toISOString()
                : 'unknown',
              apiUrl,
            });
          }

          if (!session?.access_token) {
            throw new Error('Not authenticated');
          }

          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const response = await fetch(`${apiUrl}/api/itemize-it/extract`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ imageBase64: base64 }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (__DEV__) {
              console.error('[Upload] API error:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
              });
            }
            throw new Error(errorData.error || 'Extraction failed');
          }

          const data = await response.json();
          return { success: true, queued: false, receiptData: data };
        } else {
          // Offline: save locally + queue
          return await queueForLater(imageUri);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Operation failed';

        // If online upload failed, try to queue offline as fallback
        if (isOnline) {
          try {
            const result = await queueForLater(imageUri);
            return {
              ...result,
              error: `Upload failed, saved for retry: ${message}`,
            };
          } catch {
            return { success: false, queued: false, error: message };
          }
        }

        return { success: false, queued: false, error: message };
      } finally {
        setUploading(false);
      }
    },
    [isOnline, refresh]
  );

  const queueForLater = async (imageUri: string): Promise<UploadResult> => {
    // Get file info for metadata
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    const fileSize = fileInfo.exists ? (fileInfo.size || 0) : 0;

    const metadata = await saveLocalReceipt(
      imageUri,
      `receipt-${Date.now()}.jpg`,
      'image/jpeg',
      fileSize
    );

    await addToQueue('RECEIPT_UPLOAD', {
      localFileUri: metadata.localFileUri,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      fileSize: metadata.fileSize,
      capturedAt: metadata.capturedAt,
      localId: metadata.localId,
    });

    await refresh();

    return { success: true, queued: true, localId: metadata.localId };
  };

  return { isOnline, uploading, uploadOrQueue };
}

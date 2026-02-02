/**
 * SyncContext for Itemize-It.
 * Processes the offline queue by reading local files as base64
 * and POSTing to /api/itemize-it/extract.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useNetworkContext } from './NetworkContext';
import {
  SyncQueueItem,
  getPendingItems,
  markSyncing,
  markCompleted,
  markFailed,
  getQueueCounts,
  getRetryDelay,
  updateLastSyncAt,
} from '../lib/syncQueue';
import { deleteLocalReceipt, localFileExists } from '../lib/offlineStorage';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.apiUrl ?? 'https://recevity.com';

export interface SyncState {
  isSyncing: boolean;
  currentItem: SyncQueueItem | null;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
  lastError: string | null;
}

export interface SyncContextValue extends SyncState {
  startSync: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

interface SyncProviderProps {
  children: React.ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const { isOnline } = useNetworkContext();
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentItem, setCurrentItem] = useState<SyncQueueItem | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const syncInProgressRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    try {
      const counts = await getQueueCounts();
      setPendingCount(counts.pending);
      setFailedCount(counts.failed);
      setTotalCount(counts.total);
    } catch (error) {
      console.error('Failed to refresh sync counts:', error);
    }
  }, []);

  const processItem = useCallback(
    async (item: SyncQueueItem): Promise<boolean> => {
      setCurrentItem(item);

      try {
        await markSyncing(item.id);

        // Check if local file still exists
        const fileExists = await localFileExists(item.payload.localFileUri);
        if (!fileExists) {
          await markCompleted(item.id);
          return true;
        }

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          await markFailed(item.id, 'Not authenticated');
          return false;
        }

        // Read local file as base64
        const base64 = await FileSystem.readAsStringAsync(item.payload.localFileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // POST to extract API (same as scan.tsx online flow)
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
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Success — clean up local file and remove from queue
        await deleteLocalReceipt(item.payload.localId);
        await markCompleted(item.id);
        await updateLastSyncAt();
        setLastError(null);

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync failed';
        await markFailed(item.id, message);
        setLastError(message);
        return false;
      } finally {
        setCurrentItem(null);
      }
    },
    []
  );

  const startSync = useCallback(async () => {
    if (syncInProgressRef.current || !isOnline) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      let pendingItems = await getPendingItems();

      while (pendingItems.length > 0 && isOnline) {
        const item = pendingItems[0];
        const success = await processItem(item);

        if (!success) {
          // Schedule retry with backoff
          const retryDelay = getRetryDelay(item.attempts + 1);
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = setTimeout(() => {
            if (isOnline) startSync();
          }, retryDelay);
          break;
        }

        pendingItems = await getPendingItems();
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
      await refresh();
    }
  }, [isOnline, processItem, refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-sync when connectivity is restored
  useEffect(() => {
    if (isOnline && !syncInProgressRef.current) {
      startSync();
    }
  }, [isOnline, startSync]);

  // Sync on app foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isOnline && !syncInProgressRef.current) {
        startSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isOnline, startSync]);

  const value = React.useMemo<SyncContextValue>(() => ({
    isSyncing,
    currentItem,
    pendingCount,
    failedCount,
    totalCount,
    lastError,
    startSync,
    refresh,
  }), [isSyncing, currentItem, pendingCount, failedCount, totalCount, lastError, startSync, refresh]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext(): SyncContextValue {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}

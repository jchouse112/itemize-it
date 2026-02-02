/**
 * Sync queue for Itemize-It offline uploads.
 * Queue metadata is encrypted via SecureStore.
 * Supports exponential backoff retry.
 */

import { getSecureJSON, setSecureJSON, setSecureItem, getSecureItem } from './secureStorage';

const STORAGE_KEYS = {
  SYNC_QUEUE: 'ii_syncQueue',
  LAST_SYNC_AT: 'ii_lastSyncAt',
} as const;

export type SyncOperationType = 'RECEIPT_UPLOAD';

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'completed';

export interface ReceiptUploadPayload {
  localFileUri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  capturedAt: string;
  localId: string;
}

export interface SyncQueueItem {
  id: string;
  type: SyncOperationType;
  payload: ReceiptUploadPayload;
  status: SyncStatus;
  attempts: number;
  lastAttemptAt: string | null;
  error: string | null;
  createdAt: string;
}

export const RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
} as const;

export function getRetryDelay(attempts: number): number {
  const delay = RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempts);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function getQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const items = await getSecureJSON<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE);
    return items || [];
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get queue items:', error);
    }
    return [];
  }
}

async function saveQueue(items: SyncQueueItem[]): Promise<void> {
  try {
    await setSecureJSON(STORAGE_KEYS.SYNC_QUEUE, items);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save queue:', error);
    }
    throw error;
  }
}

export async function addToQueue(
  type: SyncOperationType,
  payload: ReceiptUploadPayload
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    id: generateId(),
    type,
    payload,
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
    error: null,
    createdAt: new Date().toISOString(),
  };

  const items = await getQueueItems();
  items.push(item);
  await saveQueue(items);

  return item;
}

export async function updateQueueItem(
  id: string,
  updates: Partial<Pick<SyncQueueItem, 'status' | 'attempts' | 'lastAttemptAt' | 'error'>>
): Promise<SyncQueueItem | null> {
  const items = await getQueueItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  items[index] = { ...items[index], ...updates };
  await saveQueue(items);
  return items[index];
}

export async function removeFromQueue(id: string): Promise<boolean> {
  const items = await getQueueItems();
  const filteredItems = items.filter((item) => item.id !== id);
  if (filteredItems.length === items.length) return false;

  await saveQueue(filteredItems);
  return true;
}

export async function getPendingItems(): Promise<SyncQueueItem[]> {
  const items = await getQueueItems();
  return items.filter((item) => item.status === 'pending');
}

export async function getFailedItems(): Promise<SyncQueueItem[]> {
  const items = await getQueueItems();
  return items.filter((item) => item.status === 'failed');
}

export async function getRetryableItems(): Promise<SyncQueueItem[]> {
  const items = await getQueueItems();
  return items.filter(
    (item) => item.status === 'failed' && item.attempts < RETRY_CONFIG.maxAttempts
  );
}

export async function markSyncing(id: string): Promise<SyncQueueItem | null> {
  return updateQueueItem(id, {
    status: 'syncing',
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function markCompleted(id: string): Promise<boolean> {
  return removeFromQueue(id);
}

export async function markFailed(id: string, error: string): Promise<SyncQueueItem | null> {
  const items = await getQueueItems();
  const item = items.find((i) => i.id === id);
  if (!item) return null;

  const newAttempts = item.attempts + 1;
  const newStatus: SyncStatus = newAttempts >= RETRY_CONFIG.maxAttempts ? 'failed' : 'pending';

  return updateQueueItem(id, {
    status: newStatus,
    attempts: newAttempts,
    error,
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function retryFailedItems(): Promise<number> {
  const items = await getQueueItems();
  let count = 0;

  const updatedItems = items.map((item) => {
    if (item.status === 'failed' && item.attempts < RETRY_CONFIG.maxAttempts) {
      count++;
      return { ...item, status: 'pending' as SyncStatus };
    }
    return item;
  });

  await saveQueue(updatedItems);
  return count;
}

export async function clearCompletedItems(): Promise<number> {
  const items = await getQueueItems();
  const filteredItems = items.filter((item) => item.status !== 'completed');
  const removedCount = items.length - filteredItems.length;
  await saveQueue(filteredItems);
  return removedCount;
}

export async function clearQueue(): Promise<void> {
  await saveQueue([]);
}

export async function getQueueCounts(): Promise<{
  pending: number;
  syncing: number;
  failed: number;
  total: number;
}> {
  const items = await getQueueItems();
  return {
    pending: items.filter((i) => i.status === 'pending').length,
    syncing: items.filter((i) => i.status === 'syncing').length,
    failed: items.filter((i) => i.status === 'failed').length,
    total: items.length,
  };
}

export async function updateLastSyncAt(): Promise<void> {
  await setSecureItem(STORAGE_KEYS.LAST_SYNC_AT, new Date().toISOString());
}

export async function getLastSyncAt(): Promise<Date | null> {
  try {
    const data = await getSecureItem(STORAGE_KEYS.LAST_SYNC_AT);
    return data ? new Date(data) : null;
  } catch {
    return null;
  }
}

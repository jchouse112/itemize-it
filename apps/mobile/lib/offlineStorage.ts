/**
 * Offline receipt storage for Itemize-It.
 * Files stored on filesystem, metadata encrypted in SecureStore.
 */

import * as FileSystem from 'expo-file-system';
import { getSecureJSON, setSecureJSON, removeSecureItem } from './secureStorage';

const OFFLINE_RECEIPTS_DIR = `${FileSystem.documentDirectory}ii-offline-receipts/`;
const METADATA_INDEX_KEY = 'ii_offlineReceiptsIndex';

export interface OfflineReceiptMetadata {
  localId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  capturedAt: string;
  localFileUri: string;
}

async function ensureDirectoryExists(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(OFFLINE_RECEIPTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_RECEIPTS_DIR, { intermediates: true });
  }
}

function generateLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getExtension(uri: string, fileName?: string): string {
  if (fileName) {
    const parts = fileName.split('.');
    if (parts.length > 1) return parts.pop() || 'bin';
  }
  const parts = uri.split('.');
  return parts.length > 1 ? (parts.pop()?.split('?')[0] || 'bin') : 'bin';
}

async function getMetadataIndex(): Promise<Record<string, OfflineReceiptMetadata>> {
  const index = await getSecureJSON<Record<string, OfflineReceiptMetadata>>(METADATA_INDEX_KEY);
  return index || {};
}

async function saveMetadataIndex(index: Record<string, OfflineReceiptMetadata>): Promise<void> {
  await setSecureJSON(METADATA_INDEX_KEY, index);
}

export async function saveLocalReceipt(
  sourceUri: string,
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<OfflineReceiptMetadata> {
  await ensureDirectoryExists();

  const localId = generateLocalId();
  const ext = getExtension(sourceUri, fileName);
  const localFileName = `${localId}.${ext}`;
  const localFileUri = `${OFFLINE_RECEIPTS_DIR}${localFileName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: localFileUri });

  const metadata: OfflineReceiptMetadata = {
    localId,
    fileName,
    mimeType,
    fileSize,
    capturedAt: new Date().toISOString(),
    localFileUri,
  };

  const index = await getMetadataIndex();
  index[localId] = metadata;
  await saveMetadataIndex(index);

  return metadata;
}

export async function getLocalReceipt(localId: string): Promise<OfflineReceiptMetadata | null> {
  try {
    const index = await getMetadataIndex();
    return index[localId] || null;
  } catch {
    return null;
  }
}

export async function deleteLocalReceipt(localId: string): Promise<boolean> {
  try {
    const index = await getMetadataIndex();
    const metadata = index[localId];
    if (!metadata) return false;

    await FileSystem.deleteAsync(metadata.localFileUri, { idempotent: true });

    delete index[localId];
    await saveMetadataIndex(index);

    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to delete local receipt:', error);
    }
    return false;
  }
}

export async function getOfflineReceipts(): Promise<OfflineReceiptMetadata[]> {
  try {
    await ensureDirectoryExists();
    const index = await getMetadataIndex();
    const receipts = Object.values(index);
    return receipts.sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function localFileExists(localFileUri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(localFileUri);
    return info.exists;
  } catch {
    return false;
  }
}

export async function getOfflineStorageSize(): Promise<number> {
  try {
    const receipts = await getOfflineReceipts();
    return receipts.reduce((total, r) => total + r.fileSize, 0);
  } catch {
    return 0;
  }
}

export async function clearOfflineReceipts(): Promise<void> {
  try {
    await FileSystem.deleteAsync(OFFLINE_RECEIPTS_DIR, { idempotent: true });
    await ensureDirectoryExists();
    await removeSecureItem(METADATA_INDEX_KEY);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to clear offline receipts:', error);
    }
  }
}

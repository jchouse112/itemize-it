/**
 * Secure Storage Utility for Itemize-It
 * Uses expo-secure-store for encrypted storage of sensitive data.
 * Handles SecureStore's 2048-byte limit per item via chunking.
 */

import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 2000;
const CHUNK_PREFIX = '_chunk_';

const isValidSecureStoreKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  return /^[a-zA-Z0-9._-]+$/.test(key);
};

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!isValidSecureStoreKey(key)) {
    if (__DEV__) {
      console.warn('SecureStore: Invalid key format, skipping setSecureItem:', key);
    }
    return;
  }
  try {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await cleanupChunks(key);
      return;
    }

    const chunks = splitIntoChunks(value, CHUNK_SIZE);
    await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);

    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}${CHUNK_PREFIX}${i}`, chunks[i]);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('SecureStore setItem failed:', error);
    }
    throw error;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (!isValidSecureStoreKey(key)) {
    if (__DEV__) {
      console.warn('SecureStore: Invalid key format, skipping getSecureItem:', key);
    }
    return null;
  }
  try {
    const value = await SecureStore.getItemAsync(key);
    if (!value) return null;

    if (value.startsWith(CHUNK_PREFIX)) {
      const chunkCount = parseInt(value.replace(CHUNK_PREFIX, ''), 10);
      const chunks: string[] = [];

      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}${CHUNK_PREFIX}${i}`);
        if (chunk === null) {
          if (__DEV__) {
            console.warn(`Missing chunk ${i} for key ${key}`);
          }
          return null;
        }
        chunks.push(chunk);
      }

      return chunks.join('');
    }

    return value;
  } catch (error) {
    if (__DEV__) {
      console.error('SecureStore getItem failed:', error);
    }
    return null;
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  if (!isValidSecureStoreKey(key)) return;
  try {
    const value = await SecureStore.getItemAsync(key);

    if (value?.startsWith(CHUNK_PREFIX)) {
      const chunkCount = parseInt(value.replace(CHUNK_PREFIX, ''), 10);
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}${CHUNK_PREFIX}${i}`);
      }
    }

    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    if (__DEV__) {
      console.error('SecureStore removeItem failed:', error);
    }
  }
}

async function cleanupChunks(key: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      await SecureStore.deleteItemAsync(`${key}${CHUNK_PREFIX}${i}`);
    } catch {
      break;
    }
  }
}

function splitIntoChunks(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

export async function setSecureJSON<T>(key: string, data: T): Promise<void> {
  const json = JSON.stringify(data);
  await setSecureItem(key, json);
}

export async function getSecureJSON<T>(key: string): Promise<T | null> {
  const json = await getSecureItem(key);
  if (!json) return null;

  try {
    return JSON.parse(json) as T;
  } catch {
    if (__DEV__) {
      console.warn(`Failed to parse secure JSON for key ${key}`);
    }
    return null;
  }
}

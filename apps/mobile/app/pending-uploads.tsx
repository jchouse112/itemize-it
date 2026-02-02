/**
 * Pending Uploads screen (PRD §7.4)
 * Shows queued offline receipts with retry/delete controls.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { WifiOff, RefreshCw, Trash2, ChevronLeft } from 'lucide-react-native';
import { COLORS } from '../lib/utils';
import { useSyncContext } from '../context/SyncContext';
import { useNetworkContext } from '../context/NetworkContext';
import {
  SyncQueueItem,
  getQueueItems,
  retryFailedItems,
  removeFromQueue,
} from '../lib/syncQueue';
import { deleteLocalReceipt } from '../lib/offlineStorage';

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getStatusLabel(item: SyncQueueItem): string {
  if (item.status === 'syncing') return 'Uploading...';
  if (item.status === 'failed') return `Failed (${item.attempts}/5)`;
  return 'Pending';
}

function getStatusColor(item: SyncQueueItem): string {
  if (item.status === 'syncing') return COLORS.safetyOrange;
  if (item.status === 'failed') return COLORS.critical;
  return COLORS.warn;
}

export default function PendingUploadsScreen() {
  const insets = useSafeAreaInsets();
  const { isSyncing, startSync, refresh: refreshSync } = useSyncContext();
  const { isOnline } = useNetworkContext();
  const [items, setItems] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    const queueItems = await getQueueItems();
    // Show non-completed items, newest first
    setItems(queueItems.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRetryAll = async () => {
    const count = await retryFailedItems();
    if (count > 0) {
      await loadItems();
      await refreshSync();
      if (isOnline) startSync();
    }
  };

  const handleDeleteItem = (item: SyncQueueItem) => {
    Alert.alert(
      'Delete Upload',
      'This will permanently delete this queued receipt. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLocalReceipt(item.payload.localId);
            await removeFromQueue(item.id);
            await loadItems();
            await refreshSync();
          },
        },
      ]
    );
  };

  const handleRetryItem = async (item: SyncQueueItem) => {
    // Reset to pending so sync picks it up
    const { updateQueueItem } = await import('../lib/syncQueue');
    await updateQueueItem(item.id, { status: 'pending' });
    await loadItems();
    await refreshSync();
    if (isOnline) startSync();
  };

  const renderItem = ({ item }: { item: SyncQueueItem }) => {
    const statusColor = getStatusColor(item);

    return (
      <View style={styles.itemCard}>
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.payload.localFileUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          {item.status === 'syncing' && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color={COLORS.white} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemFileName} numberOfLines={1}>
            {item.payload.fileName}
          </Text>
          <Text style={styles.itemTime}>
            {formatTimeAgo(item.payload.capturedAt)}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(item)}
            </Text>
          </View>
          {item.error && (
            <Text style={styles.errorText} numberOfLines={1}>
              {item.error}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.itemActions}>
          {item.status === 'failed' && (
            <Pressable
              onPress={() => handleRetryItem(item)}
              style={styles.iconButton}
            >
              <RefreshCw size={18} color={COLORS.safetyOrange} />
            </Pressable>
          )}
          <Pressable
            onPress={() => handleDeleteItem(item)}
            style={styles.iconButton}
          >
            <Trash2 size={18} color={COLORS.critical} />
          </Pressable>
        </View>
      </View>
    );
  };

  const failedCount = items.filter((i) => i.status === 'failed').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.white} />
        </Pressable>
        <Text style={styles.title}>Pending Uploads</Text>
        <View style={styles.headerRight}>
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <WifiOff size={14} color={COLORS.warn} />
              <Text style={styles.offlineBadgeText}>Offline</Text>
            </View>
          )}
        </View>
      </View>

      {/* Retry all banner */}
      {failedCount > 0 && (
        <Pressable onPress={handleRetryAll} style={styles.retryBanner}>
          <RefreshCw size={16} color={COLORS.safetyOrange} />
          <Text style={styles.retryBannerText}>
            Retry {failedCount} failed upload{failedCount > 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}

      {/* Syncing indicator */}
      {isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color={COLORS.safetyOrange} />
          <Text style={styles.syncingText}>Uploading...</Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.safetyOrange} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No pending uploads</Text>
          <Text style={styles.emptySubtitle}>
            Receipts captured offline will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  title: {
    flex: 1,
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.warn + '20',
  },
  offlineBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.warn,
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: COLORS.gunmetal,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  retryBannerText: {
    color: COLORS.safetyOrange,
    fontSize: 14,
    fontWeight: '600',
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: COLORS.gunmetal,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  syncingText: {
    color: COLORS.safetyOrange,
    fontSize: 13,
  },
  list: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.gunmetal,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    padding: 12,
    alignItems: 'center',
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.edgeSteel,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 17, 21, 0.7)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemFileName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  itemTime: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    color: COLORS.critical,
    fontSize: 11,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.edgeSteel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: COLORS.concrete,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

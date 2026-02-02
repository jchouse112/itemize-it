import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/utils';
import type { ImageQualityResult } from '../hooks/useImageEnhancement';

interface ImageQualityIndicatorProps {
  quality: ImageQualityResult | null;
  loading?: boolean;
  compact?: boolean;
}

export function ImageQualityIndicator({
  quality,
  loading = false,
  compact = false,
}: ImageQualityIndicatorProps) {
  if (loading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <Text style={styles.loadingText}>Checking quality...</Text>
      </View>
    );
  }

  if (!quality) {
    return null;
  }

  const getStatusColor = () => {
    if (quality.score >= 80) return COLORS.safe;
    if (quality.score >= 60) return COLORS.warn;
    return COLORS.critical;
  };

  const getStatusIcon = (): keyof typeof Ionicons.glyphMap => {
    if (quality.score >= 80) return 'checkmark-circle';
    if (quality.score >= 60) return 'alert-circle';
    return 'warning';
  };

  const getStatusLabel = () => {
    if (quality.score >= 80) return 'Good';
    if (quality.score >= 60) return 'Fair';
    return 'Poor';
  };

  const statusColor = getStatusColor();

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: statusColor + '20' }]}>
        <Ionicons name={getStatusIcon()} size={16} color={statusColor} />
        <Text style={[styles.compactText, { color: statusColor }]}>
          {getStatusLabel()}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name={getStatusIcon()} size={20} color={statusColor} />
        <Text style={styles.title}>
          Image Quality: {getStatusLabel()}
        </Text>
      </View>
      {quality.recommendation && (
        <Text style={styles.recommendation}>{quality.recommendation}</Text>
      )}
      {quality.issues.length > 0 && (
        <View style={styles.issuesList}>
          {quality.issues.map((issue, index) => (
            <View key={index} style={[styles.issueBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.issueText, { color: statusColor }]}>
                {formatIssue(issue)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formatIssue(issue: string): string {
  switch (issue) {
    case 'too_dark':
      return 'Too Dark';
    case 'too_bright':
      return 'Too Bright';
    case 'low_contrast':
      return 'Low Contrast';
    case 'too_small':
      return 'Low Resolution';
    case 'blurry':
      return 'May Be Blurry';
    default:
      return issue;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.edgeSteel,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.concrete,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.white,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  recommendation: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 28,
    color: COLORS.concrete,
  },
  issuesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    marginLeft: 28,
  },
  issueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  issueText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

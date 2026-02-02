import { View, Text, StyleSheet } from "react-native";
import { formatCurrency, COLORS } from "../lib/utils";

interface ProjectCardProps {
  name: string;
  spentCents: number;
  budgetCents: number;
  currency?: string;
}

export function ProjectCard({
  name,
  spentCents,
  budgetCents,
  currency = "USD",
}: ProjectCardProps) {
  const percentUsed = budgetCents > 0 ? (spentCents / budgetCents) * 100 : 0;
  const remainingCents = budgetCents - spentCents;

  const getProgressColor = () => {
    if (percentUsed > 100) return COLORS.critical;
    if (percentUsed > 75) return COLORS.warn;
    return COLORS.safe;
  };

  const getPercentColor = () => {
    if (percentUsed > 100) return COLORS.critical;
    if (percentUsed > 75) return COLORS.warn;
    return COLORS.safe;
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.percent, { color: getPercentColor() }]}>
          {percentUsed.toFixed(0)}%
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${Math.min(percentUsed, 100)}%`,
              backgroundColor: getProgressColor(),
            },
          ]}
        />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View>
          <Text style={styles.statLabel}>Spent</Text>
          <Text style={styles.statValue}>{formatCurrency(spentCents, currency)}</Text>
        </View>
        <View>
          <Text style={[styles.statLabel, styles.textRight]}>Budget</Text>
          <Text style={[styles.statValue, styles.textRight]}>
            {formatCurrency(budgetCents, currency)}
          </Text>
        </View>
      </View>

      {/* Remaining */}
      {remainingCents > 0 && (
        <View style={styles.remainingRow}>
          <Text style={styles.remainingLabel}>Remaining</Text>
          <Text style={[styles.remainingValue, { color: COLORS.safe }]}>
            {formatCurrency(remainingCents, currency)}
          </Text>
        </View>
      )}

      {/* Over budget */}
      {remainingCents < 0 && (
        <View style={styles.remainingRow}>
          <Text style={styles.remainingLabel}>Over Budget</Text>
          <Text style={[styles.remainingValue, { color: COLORS.critical }]}>
            {formatCurrency(Math.abs(remainingCents), currency)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 2,
    borderColor: COLORS.edgeSteel,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  name: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  percent: {
    fontFamily: "monospace",
    fontSize: 14,
  },
  progressContainer: {
    height: 8,
    backgroundColor: COLORS.edgeSteel,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statLabel: {
    color: COLORS.concrete,
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: COLORS.white,
    fontFamily: "monospace",
    fontSize: 16,
  },
  textRight: {
    textAlign: "right",
  },
  remainingRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.edgeSteel,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  remainingLabel: {
    color: COLORS.concrete,
    fontSize: 12,
  },
  remainingValue: {
    fontFamily: "monospace",
    fontSize: 14,
  },
});

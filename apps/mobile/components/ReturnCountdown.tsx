import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../lib/utils";

interface ReturnCountdownProps {
  daysRemaining: number;
  size?: "small" | "default";
}

function getCountdownColor(days: number): string {
  if (days <= 3) return "#EF4444";
  if (days <= 7) return "#F59E0B";
  return COLORS.safe;
}

export function ReturnCountdown({ daysRemaining, size = "default" }: ReturnCountdownProps) {
  const color = getCountdownColor(daysRemaining);
  const isSmall = size === "small";

  if (daysRemaining < 0) {
    return (
      <View style={[styles.container, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
        <Text style={[styles.text, isSmall && styles.textSmall, { color: "#EF4444" }]}>
          Expired
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: `${color}15` }]}>
      <Text style={[styles.text, isSmall && styles.textSmall, { color }]}>
        {daysRemaining === 0
          ? "Last day"
          : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
  textSmall: {
    fontSize: 11,
  },
});

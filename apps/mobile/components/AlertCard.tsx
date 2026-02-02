import { View, Text, Pressable, StyleSheet } from "react-native";
import { ShieldCheck, RotateCcw, AlertTriangle, Copy, ChevronRight } from "lucide-react-native";
import { COLORS } from "../lib/utils";

export type AlertType = "recall" | "return_expiring" | "warranty_expiring" | "duplicate";
export type AlertUrgency = "critical" | "warning" | "info";

interface AlertCardProps {
  type: AlertType;
  urgency: AlertUrgency;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const URGENCY_COLORS: Record<AlertUrgency, string> = {
  critical: "#EF4444",
  warning: "#F59E0B",
  info: "#3B82F6",
};

function AlertIcon({ type, urgency }: { type: AlertType; urgency: AlertUrgency }) {
  const color = URGENCY_COLORS[urgency];
  const size = 18;

  switch (type) {
    case "recall":
      return <AlertTriangle size={size} color={color} />;
    case "return_expiring":
      return <RotateCcw size={size} color={color} />;
    case "warranty_expiring":
      return <ShieldCheck size={size} color={color} />;
    case "duplicate":
      return <Copy size={size} color={color} />;
  }
}

export function AlertCard({ type, urgency, title, subtitle, onPress }: AlertCardProps) {
  const accentColor = URGENCY_COLORS[urgency];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={[styles.iconContainer, { backgroundColor: `${accentColor}15` }]}>
        <AlertIcon type={type} urgency={urgency} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: accentColor }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={16} color={COLORS.concrete} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    overflow: "hidden",
  },
  cardPressed: {
    backgroundColor: COLORS.edgeSteel,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
});

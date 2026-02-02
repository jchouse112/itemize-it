import { View, StyleSheet } from "react-native";
import { ShieldCheck, RotateCcw, AlertTriangle, Copy } from "lucide-react-native";

interface LifecycleIconBadgesProps {
  hasWarranty?: boolean;
  hasReturnWindow?: boolean;
  hasRecallMatch?: boolean;
  isDuplicate?: boolean;
}

const ICON_SIZE = 14;

export function LifecycleIconBadges({
  hasWarranty,
  hasReturnWindow,
  hasRecallMatch,
  isDuplicate,
}: LifecycleIconBadgesProps) {
  const hasAny = hasWarranty || hasReturnWindow || hasRecallMatch || isDuplicate;
  if (!hasAny) return null;

  return (
    <View style={styles.container}>
      {hasRecallMatch && <AlertTriangle size={ICON_SIZE} color="#EF4444" />}
      {hasReturnWindow && <RotateCcw size={ICON_SIZE} color="#F59E0B" />}
      {isDuplicate && <Copy size={ICON_SIZE} color="#F59E0B" />}
      {hasWarranty && <ShieldCheck size={ICON_SIZE} color="#3B82F6" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
});

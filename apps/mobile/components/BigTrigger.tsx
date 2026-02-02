import { Pressable, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../lib/utils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface BigTriggerProps {
  label: string;
  onPress: () => void;
}

export function BigTrigger({ label, onPress }: BigTriggerProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(0.96, {
      duration: 100,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, {
      duration: 100,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.button, animatedStyle]}
    >
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 64,
    backgroundColor: COLORS.safetyOrange,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});

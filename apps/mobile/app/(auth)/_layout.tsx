import { Stack } from "expo-router";

const COLORS = {
  asphalt: "#0F1115",
  white: "#FFFFFF",
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: COLORS.asphalt,
        },
      }}
    />
  );
}

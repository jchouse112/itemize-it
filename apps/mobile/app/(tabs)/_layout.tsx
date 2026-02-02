import { Tabs } from "expo-router";
import { Inbox, Camera, ClipboardCheck, Search, Settings } from "lucide-react-native";

const COLORS = {
  asphalt: "#0F1115",
  edgeSteel: "#2A2F3A",
  safetyOrange: "#FF5F00",
  white: "#FFFFFF",
  concrete: "#9CA3AF",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.safetyOrange,
        tabBarInactiveTintColor: COLORS.concrete,
        tabBarStyle: {
          backgroundColor: COLORS.asphalt,
          borderTopColor: COLORS.edgeSteel,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: COLORS.asphalt,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inbox",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Inbox size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Camera size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: "Review",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <ClipboardCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Search size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

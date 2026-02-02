import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../hooks/useAuth";
import { NetworkProvider } from "../context/NetworkContext";
import { SyncProvider } from "../context/SyncContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

const COLORS = {
  asphalt: "#0F1115",
  gunmetal: "#1C1F26",
  safetyOrange: "#FF5F00",
  white: "#FFFFFF",
};

function AppInner() {
  // Register push token & listen for notification taps
  usePushNotifications();

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.asphalt,
          },
          headerTintColor: COLORS.white,
          headerTitleStyle: {
            fontWeight: "bold",
          },
          contentStyle: {
            backgroundColor: COLORS.asphalt,
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="receipt/[id]"
          options={{
            title: "Receipt",
            headerTintColor: COLORS.safetyOrange,
          }}
        />
        <Stack.Screen
          name="scan"
          options={{
            title: "Scan Receipt",
            headerTintColor: COLORS.safetyOrange,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="split"
          options={{
            title: "Split Items",
            headerTintColor: COLORS.safetyOrange,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="pending-uploads"
          options={{
            title: "Pending Uploads",
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="email-alias"
          options={{
            title: "Email Alias",
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="lifecycle/[receiptId]"
          options={{
            title: "Lifecycle Details",
            headerTintColor: COLORS.safetyOrange,
          }}
        />
        <Stack.Screen
          name="export"
          options={{
            title: "Export Data",
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="protection"
          options={{
            title: "Receipt Protection",
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NetworkProvider>
        <SyncProvider>
          <AppInner />
        </SyncProvider>
      </NetworkProvider>
    </AuthProvider>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

/**
 * Itemize-It notification data payload
 */
interface IINotificationData {
  notification_id?: string;
  type?:
    | "receipt_processed"
    | "items_need_review"
    | "export_ready"
    | "warranty_expiring"
    | "return_closing"
    | "recall_detected";
  receipt_id?: string;
  export_id?: string;
}

/**
 * Navigate based on notification type
 */
function handleNotificationNavigation(data: IINotificationData) {
  switch (data.type) {
    case "receipt_processed":
      if (data.receipt_id) {
        router.push({ pathname: "/receipt/[id]", params: { id: data.receipt_id } });
      } else {
        router.push("/(tabs)");
      }
      break;

    case "items_need_review":
      router.push("/(tabs)/review");
      break;

    case "export_ready":
      router.push("/export");
      break;

    case "warranty_expiring":
    case "return_closing":
    case "recall_detected":
      if (data.receipt_id) {
        router.push({
          pathname: "/lifecycle/[receiptId]",
          params: { receiptId: data.receipt_id },
        });
      } else {
        router.push("/(tabs)/review");
      }
      break;

    default:
      router.push("/(tabs)");
  }
}

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationState {
  expoPushToken: string | null;
  permission: Notifications.PermissionStatus | null;
  loading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    expoPushToken: null,
    permission: null,
    loading: true,
    error: null,
  });

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Register push token with backend
  const registerTokenWithBackend = useCallback(
    async (token: string) => {
      if (!user) return;

      try {
        const { error } = await supabase.from("push_tokens").upsert(
          {
            user_id: user.id,
            token,
            platform: Platform.OS as "ios" | "android",
            device_name: Device.deviceName || `${Device.brand} ${Device.modelName}`,
            is_active: true,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: "token" }
        );

        if (error) {
          console.error("[II Push] Failed to register token:", error);
        }
      } catch (err) {
        console.error("[II Push] Error registering token:", err);
      }
    },
    [user]
  );

  // Deactivate token on logout
  const deactivateToken = useCallback(async () => {
    if (!state.expoPushToken) return;

    try {
      await supabase
        .from("push_tokens")
        .update({ is_active: false })
        .eq("token", state.expoPushToken);
    } catch (err) {
      console.error("[II Push] Error deactivating token:", err);
    }
  }, [state.expoPushToken]);

  // Register for push notifications
  const registerForPushNotifications = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (!Device.isDevice) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Push notifications require a physical device",
        }));
        return;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setState((prev) => ({ ...prev, permission: finalStatus }));

      if (finalStatus !== "granted") {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Push notification permission not granted",
        }));
        return;
      }

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      setState((prev) => ({
        ...prev,
        expoPushToken: token,
        loading: false,
      }));

      await registerTokenWithBackend(token);

      // Configure Android notification channels
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("ii_default", {
          name: "Itemize-It",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF5F00",
        });

        await Notifications.setNotificationChannelAsync("ii_receipts", {
          name: "Receipt Processing",
          description: "Notifications when receipts finish processing",
          importance: Notifications.AndroidImportance.HIGH,
        });

        await Notifications.setNotificationChannelAsync("ii_review", {
          name: "Items to Review",
          description: "Daily digest of items needing classification",
          importance: Notifications.AndroidImportance.DEFAULT,
        });

        await Notifications.setNotificationChannelAsync("ii_lifecycle", {
          name: "Receipt Protection",
          description: "Warranty, return window, and recall alerts",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to register for push notifications",
      }));
    }
  }, [registerTokenWithBackend]);

  // Set up listeners
  useEffect(() => {
    if (user) {
      registerForPushNotifications();
    }

    // Listen for incoming notifications (app in foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("[II Push] Notification received:", notification.request.content.title);
    });

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as IINotificationData;

      // Mark notification as read
      if (data.notification_id) {
        supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", data.notification_id)
          .then(({ error }) => {
            if (error) console.error("[II Push] Failed to mark as read:", error);
          });
      }

      handleNotificationNavigation(data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user, registerForPushNotifications]);

  return {
    ...state,
    registerForPushNotifications,
    deactivateToken,
  };
}

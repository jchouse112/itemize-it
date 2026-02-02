/**
 * Push notification service for Itemize-It.
 * Adapted from Recevity — uses Expo push service for mobile notifications.
 */
import "server-only";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushNotifications(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];

  const batchSize = 100;
  const tickets: ExpoPushTicket[] = [];

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error("Expo push API error:", response.status, await response.text());
        tickets.push(...batch.map(() => ({ status: "error" as const, message: "API error" })));
        continue;
      }

      const result = await response.json();
      tickets.push(...(result.data || []));
    } catch (error) {
      console.error("Failed to send push notifications:", error);
      tickets.push(...batch.map(() => ({ status: "error" as const, message: "Network error" })));
    }
  }

  return tickets;
}

export async function getPushReceipts(
  ticketIds: string[]
): Promise<Record<string, ExpoPushReceipt>> {
  if (ticketIds.length === 0) return {};

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ids: ticketIds }),
    });

    if (!response.ok) {
      console.error("Failed to get push receipts:", response.status);
      return {};
    }

    const result = await response.json();
    return result.data || {};
  } catch (error) {
    console.error("Error getting push receipts:", error);
    return {};
  }
}

export function buildWarrantyReminderMessage(
  token: string,
  warrantyId: string,
  productName: string,
  daysRemaining: number
): ExpoPushMessage {
  const title = daysRemaining <= 7 ? "Warranty Expiring Soon" : "Warranty Reminder";
  const body =
    daysRemaining === 1
      ? `Your warranty for ${productName} expires tomorrow!`
      : `Your warranty for ${productName} expires in ${daysRemaining} days.`;

  return {
    to: token,
    title,
    body,
    data: { type: "warranty_expiring", warrantyId, screen: "lifecycle" },
    sound: "default",
    channelId: "warranty",
    priority: daysRemaining <= 7 ? "high" : "normal",
  };
}

export function buildReturnReminderMessage(
  token: string,
  returnId: string,
  merchantName: string,
  daysRemaining: number
): ExpoPushMessage {
  const title = daysRemaining <= 1 ? "Last Day to Return!" : "Return Window Closing";
  const body =
    daysRemaining === 0
      ? `Today is the last day to return your purchase from ${merchantName}!`
      : daysRemaining === 1
        ? `Tomorrow is the last day to return your purchase from ${merchantName}.`
        : `${daysRemaining} days left to return your purchase from ${merchantName}.`;

  return {
    to: token,
    title,
    body,
    data: { type: "return_expiring", returnId, screen: "lifecycle" },
    sound: "default",
    channelId: "returns",
    priority: daysRemaining <= 1 ? "high" : "normal",
  };
}

export function buildRecallAlertMessage(
  token: string,
  itemId: string,
  productName: string,
  recallReason: string
): ExpoPushMessage {
  return {
    to: token,
    title: "Product Recall Alert",
    body: `${productName} has been recalled: ${recallReason.length > 100 ? recallReason.slice(0, 100) + "\u2026" : recallReason}`,
    data: { type: "recall_alert", itemId, screen: "lifecycle" },
    sound: "default",
    channelId: "recalls",
    priority: "high",
  };
}

/**
 * Notification generator for Itemize-It lifecycle events.
 * Adapted from Recevity — adds business_id scoping for multi-tenant.
 */
import "server-only";

import type { NotificationType } from "@/lib/ii-types";

export interface NotificationInput {
  userId: string;
  businessId: string;
  type: NotificationType;
  entityId: string;
  title: string;
  body: string | null;
  scheduledFor: Date;
}

/**
 * Generate warranty expiration notifications for warranties expiring in the next 30 days.
 */
export function generateWarrantyExpiringNotifications(warranties: {
  id: string;
  user_id: string;
  business_id: string;
  receipt_id: string;
  end_date: string;
  category: string;
  product_name: string | null;
}[]): NotificationInput[] {
  const notifications: NotificationInput[] = [];
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  for (const warranty of warranties) {
    const endDate = new Date(warranty.end_date);

    if (endDate > now && endDate <= thirtyDaysFromNow) {
      const daysRemaining = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const productLabel = warranty.product_name ?? warranty.category;
      notifications.push({
        userId: warranty.user_id,
        businessId: warranty.business_id,
        type: "warranty_expiring",
        entityId: warranty.receipt_id,
        title: `Warranty expiring in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        body: `Your ${productLabel} warranty expires on ${endDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}.`,
        scheduledFor: now,
      });
    }
  }

  return notifications;
}

/**
 * Generate return deadline notifications for returns expiring in the next 7 days.
 */
export function generateReturnExpiringNotifications(returns: {
  id: string;
  user_id: string;
  business_id: string;
  receipt_id: string;
  return_by: string;
  status: string;
  product_name: string | null;
  merchant: string | null;
}[]): NotificationInput[] {
  const notifications: NotificationInput[] = [];
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  for (const returnRecord of returns) {
    if (returnRecord.status !== "eligible") continue;

    const returnByDate = new Date(returnRecord.return_by);

    if (returnByDate > now && returnByDate <= sevenDaysFromNow) {
      const daysRemaining = Math.ceil(
        (returnByDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const label = returnRecord.product_name ?? returnRecord.merchant ?? "item";
      notifications.push({
        userId: returnRecord.user_id,
        businessId: returnRecord.business_id,
        type: "return_expiring",
        entityId: returnRecord.receipt_id,
        title:
          daysRemaining <= 1
            ? "Last day to return!"
            : `Return window closing in ${daysRemaining} days`,
        body: `Return deadline for ${label}: ${returnByDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}.`,
        scheduledFor: now,
      });
    }
  }

  return notifications;
}

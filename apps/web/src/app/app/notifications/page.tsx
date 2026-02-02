"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Shield, Package, AlertTriangle, Mail, Loader2, CheckCheck } from "lucide-react";
import type { IINotification } from "@/lib/ii-types";

const typeConfig: Record<
  string,
  { icon: typeof Shield; color: string; bg: string }
> = {
  warranty_expiring: { icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10" },
  return_expiring: { icon: Package, color: "text-blue-400", bg: "bg-blue-500/10" },
  recall_alert: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  email_bounce: { icon: Mail, color: "text-orange-400", bg: "bg-orange-500/10" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<IINotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAsRead(id: string) {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds, read: true }),
    });
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-concrete mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs text-safety-orange hover:text-safety-orange/80 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-concrete" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-edge-steel/50">
            <Bell className="w-6 h-6 text-concrete/60" />
          </div>
          <h3 className="text-sm font-medium text-white">No notifications</h3>
          <p className="text-xs text-concrete/60 max-w-sm mx-auto">
            Notifications will appear here when warranties are expiring, return deadlines
            approach, or product recalls are detected.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const config = typeConfig[notification.type] ?? {
              icon: Bell,
              color: "text-concrete",
              bg: "bg-edge-steel/50",
            };
            const Icon = config.icon;

            return (
              <div
                key={notification.id}
                className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                  notification.read
                    ? "border-edge-steel bg-gunmetal/30"
                    : "border-edge-steel bg-gunmetal/60 hover:bg-gunmetal/80"
                }`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${config.bg} ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-medium ${
                          notification.read ? "text-concrete" : "text-white"
                        }`}
                      >
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-safety-orange shrink-0" />
                      )}
                    </div>
                    {notification.body && (
                      <p className="text-xs text-concrete/80 mt-0.5">{notification.body}</p>
                    )}
                    <p className="text-xs text-concrete/50 mt-1">
                      {new Date(notification.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

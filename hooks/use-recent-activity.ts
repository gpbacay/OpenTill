"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { buildActivity } from "@/lib/activity";

const READ_EVENT = "opentill:activity-read";

export function useRecentActivity() {
  const { user } = useAuth();
  const { activeTenant, tenantSyncedOrders } = usePos();
  const { expenses, movements, suppliers, ready } = useOps();
  const storageKey = user && activeTenant ? `opentill_${user.id}_${activeTenant.id}_activity_read` : "";
  const [readThrough, setReadThrough] = useState("");
  const [readStateReady, setReadStateReady] = useState(false);

  const activities = useMemo(
    () =>
      buildActivity({
        orders: tenantSyncedOrders,
        expenses,
        movements,
        suppliers,
        currency: activeTenant?.currency ?? "PHP",
      }),
    [tenantSyncedOrders, expenses, movements, suppliers, activeTenant?.currency],
  );

  useEffect(() => {
    if (!storageKey) return;
    setReadStateReady(false);
    setReadThrough(localStorage.getItem(storageKey) ?? "");
    setReadStateReady(true);

    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (detail?.key === storageKey) setReadThrough(detail.value);
    };
    window.addEventListener(READ_EVENT, onRead);
    return () => window.removeEventListener(READ_EVENT, onRead);
  }, [storageKey]);

  const markAllRead = useCallback(() => {
    if (!storageKey) return;
    const value = new Date().toISOString();
    localStorage.setItem(storageKey, value);
    setReadThrough(value);
    window.dispatchEvent(new CustomEvent(READ_EVENT, { detail: { key: storageKey, value } }));
  }, [storageKey]);

  const isUnread = useCallback(
    (date: string) => readStateReady && (!readThrough || date > readThrough),
    [readStateReady, readThrough],
  );
  const unreadCount = readStateReady ? activities.filter((item) => isUnread(item.date)).length : 0;

  return {
    activities,
    unreadCount,
    isUnread,
    markAllRead,
    ready: ready.expenses && ready.movements && ready.suppliers && readStateReady,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribe } from "@/lib/realtime";

type Row = { id: string; tenantId: string };
type Outbox = { upserts: string[]; deletes: string[] };

const key = (userId: string, name: string, part: string) => `opentill_${userId}_${name}_${part}`;

function read<T>(storageKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(storageKey: string, value: unknown) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the in-memory copy still works this session */
  }
}

/**
 * A tenant-scoped list that works offline. Reads come from a local copy (instant, survives the API being down);
 * writes apply locally, join an outbox, and replay against `/api/<path>/:id` whenever the API is reachable.
 * The server copy is re-fetched on realtime events, when the browser comes back online, and on mount.
 * With `enabled` false it never talks to the server (e.g. back-office lists a cashier isn't allowed to read).
 */
export function useCollection<T extends Row>(userId: string, name: string, path: string, topic: string, enabled = true) {
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(0);
  const itemsRef = useRef<T[]>([]);
  const outboxRef = useRef<Outbox>({ upserts: [], deletes: [] });
  const busyRef = useRef(false);
  const rerunRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const commit = useCallback(
    (next: T[]) => {
      itemsRef.current = next;
      setItems(next);
      write(key(userId, name, "items"), next);
    },
    [userId, name]
  );

  const saveOutbox = useCallback(
    (box: Outbox) => {
      outboxRef.current = box;
      setPending(box.upserts.length + box.deletes.length);
      write(key(userId, name, "outbox"), box);
    },
    [userId, name]
  );

  flushRef.current = async () => {
    if (!enabled || !navigator.onLine) return;
    if (busyRef.current) {
      rerunRef.current = true;
      return;
    }
    busyRef.current = true;
    try {
      let box = outboxRef.current;
      for (const id of box.deletes) {
        const res = await fetch(`/api/${path}/${id}`, { method: "DELETE" });
        if (res.ok || res.status === 404) box = { ...box, deletes: box.deletes.filter((x) => x !== id) };
      }
      for (const id of box.upserts) {
        const row = itemsRef.current.find((item) => item.id === id);
        if (!row) {
          box = { ...box, upserts: box.upserts.filter((x) => x !== id) };
          continue;
        }
        const res = await fetch(`/api/${path}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        // 404 means a dependency (e.g. the product) isn't on the server yet: keep it queued and retry later.
        const permanent = res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 408 && res.status !== 429;
        if (res.ok || permanent) box = { ...box, upserts: box.upserts.filter((x) => x !== id) };
      }
      saveOutbox(box);

      const res = await fetch(`/api/${path}`);
      if (!res.ok) return;
      const server: T[] = await res.json();
      if (!Array.isArray(server)) return;
      const dirty = new Set(box.upserts);
      const deleted = new Set(box.deletes);
      const local = itemsRef.current;
      // An empty reply while we hold data usually means the API is running on its fallback store, so keep ours.
      if (server.length === 0 && local.length > 0 && box.upserts.length === 0) return;
      const byId = new Map(local.map((row) => [row.id, row]));
      const merged = server
        .filter((row) => !deleted.has(row.id))
        .map((row) => (dirty.has(row.id) && byId.has(row.id) ? byId.get(row.id)! : row));
      const serverIds = new Set(server.map((row) => row.id));
      commit([...merged, ...local.filter((row) => dirty.has(row.id) && !serverIds.has(row.id))]);
    } catch (err) {
      console.warn(`Could not reach /api/${path}; using the copy on this device.`, err);
    } finally {
      busyRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void flushRef.current();
      }
    }
  };

  useEffect(() => {
    itemsRef.current = read<T[]>(key(userId, name, "items"), []);
    setItems(itemsRef.current);
    const box = read<Outbox>(key(userId, name, "outbox"), { upserts: [], deletes: [] });
    outboxRef.current = box;
    setPending(box.upserts.length + box.deletes.length);
    setReady(true);
    const refresh = () => void flushRef.current();
    refresh();
    window.addEventListener("online", refresh);
    const unsubscribe = subscribe([topic], refresh);
    return () => {
      window.removeEventListener("online", refresh);
      unsubscribe();
    };
  }, [userId, name, topic]);

  const upsert = (row: T) => {
    const exists = itemsRef.current.some((item) => item.id === row.id);
    commit(exists ? itemsRef.current.map((item) => (item.id === row.id ? row : item)) : [row, ...itemsRef.current]);
    const box = outboxRef.current;
    saveOutbox({ ...box, upserts: [...box.upserts.filter((id) => id !== row.id), row.id] });
    void flushRef.current();
  };

  const remove = (id: string) => {
    commit(itemsRef.current.filter((item) => item.id !== id));
    const box = outboxRef.current;
    saveOutbox({ upserts: box.upserts.filter((x) => x !== id), deletes: [...box.deletes.filter((x) => x !== id), id] });
    void flushRef.current();
  };

  return { items, ready, pending, upsert, remove, refresh: () => flushRef.current() };
}

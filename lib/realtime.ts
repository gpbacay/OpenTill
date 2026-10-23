import { useSyncExternalStore } from "react";

/**
 * One shared Server-Sent Events stream (/api/events). Subscribers re-fetch when a topic changes.
 * Degrades gracefully: if the stream can't connect (proxy buffering, old browser, server restart),
 * every subscriber is polled instead, so data still refreshes, just slower.
 */
export type RealtimeStatus = "live" | "polling" | "offline";

const POLL_MS = 3_000; // how often to look for changes while there is no live stream
const FULL_REFRESH_EVERY = 10; // every Nth poll refreshes everything, as a safety net

const handlers = new Map<string, Set<() => void>>();
const listeners = new Set<() => void>();
let source: EventSource | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let connected = false;
let seen: Record<string, number> | null = null;
let polls = 0;

const notifyStatus = () => listeners.forEach((fn) => fn());

function run(topic: string) {
  handlers.get(topic)?.forEach((fn) => fn());
}

function runAll() {
  handlers.forEach((set) => set.forEach((fn) => fn()));
}

/** No live stream (serverless hosting): ask the server which topics changed since last time and refresh only those. */
async function poll() {
  if (connected || !navigator.onLine || document.visibilityState !== "visible") return;
  polls += 1;
  if (polls % FULL_REFRESH_EVERY === 0) return runAll();
  try {
    const res = await fetch("/api/changes");
    if (!res.ok) return;
    const now: Record<string, number> = await res.json();
    const before = seen;
    seen = now;
    if (!before) return;
    const topics = new Set(Object.keys(now).filter((id) => now[id] !== before[id]).map((id) => id.slice(id.indexOf(":") + 1)));
    topics.forEach(run);
  } catch {
    /* offline or API down: the next poll tries again */
  }
}

function open() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource("/api/events");
  source.onopen = () => {
    connected = true;
    notifyStatus();
    runAll(); // catch up on anything missed while disconnected
  };
  source.onmessage = (event) => {
    try {
      const { topic } = JSON.parse(event.data);
      if (topic && topic !== "ping") run(topic);
    } catch {
      /* ignore malformed frames */
    }
  };
  source.onerror = () => {
    connected = false;
    notifyStatus(); // EventSource retries on its own
  };
  timer = setInterval(() => void poll(), POLL_MS);
}

function close() {
  source?.close();
  source = null;
  seen = null;
  if (timer) clearInterval(timer);
  timer = null;
  connected = false;
}

export function subscribe(topics: string[], fn: () => void) {
  topics.forEach((topic) => {
    if (!handlers.has(topic)) handlers.set(topic, new Set());
    handlers.get(topic)!.add(fn);
  });
  open();
  return () => {
    topics.forEach((topic) => handlers.get(topic)?.delete(fn));
    if ([...handlers.values()].every((set) => set.size === 0)) close();
  };
}

function status(): RealtimeStatus {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  return connected ? "live" : "polling";
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      window.addEventListener("online", fn);
      window.addEventListener("offline", fn);
      return () => {
        listeners.delete(fn);
        window.removeEventListener("online", fn);
        window.removeEventListener("offline", fn);
      };
    },
    status,
    () => "polling"
  );
}

import { useSyncExternalStore } from "react";

/**
 * Whether the API is reachable, not just whether the device has a network: Wi-Fi without internet or a dead
 * mobile signal still reports navigator.onLine. Every /api fetch updates it; while unreachable the API is probed
 * until it answers. Changes are announced as window "online"/"offline" events, so existing listeners resync.
 */
const PROBE_MS = 10_000;
const PROBE_TIMEOUT_MS = 5_000;

let reachable = true;
let probeTimer: ReturnType<typeof setInterval> | null = null;

export function isOnline() {
  return typeof navigator === "undefined" || (navigator.onLine && reachable);
}

/** Any JSON answer (even a 401 or 404) comes from the API; a host error page or a network failure doesn't. */
function fromApi(res: Response) {
  return res.status === 204 || (res.headers.get("content-type") ?? "").includes("json");
}

function setReachable(next: boolean) {
  if (next === reachable) return;
  const before = isOnline();
  reachable = next;
  if (!next && !probeTimer) probeTimer = setInterval(() => void probe(), PROBE_MS);
  if (next && probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  if (before !== isOnline()) window.dispatchEvent(new Event(isOnline() ? "online" : "offline"));
}

async function probe() {
  if (!navigator.onLine || document.visibilityState !== "visible") return;
  try {
    const res = await nativeFetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    setReachable(fromApi(res));
  } catch {
    setReachable(false);
  }
}

const isApi = (input: RequestInfo | URL) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  return url.origin === location.origin && url.pathname.startsWith("/api/");
};

let nativeFetch: typeof fetch;

if (typeof window !== "undefined") {
  nativeFetch = window.fetch.bind(window);
  // Every fetch in the app routes through here, so each /api call doubles as a reachability check.
  window.fetch = async (input, init) => {
    if (!isApi(input)) return nativeFetch(input, init);
    try {
      const res = await nativeFetch(input, init);
      setReachable(fromApi(res));
      return res;
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setReachable(false);
      throw err;
    }
  };
  window.addEventListener("online", (event) => {
    if (event.isTrusted) void probe();
  });
  document.addEventListener("visibilitychange", () => {
    if (!reachable) void probe();
  });
}

export function useOnline() {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener("online", fn);
      window.addEventListener("offline", fn);
      return () => {
        window.removeEventListener("online", fn);
        window.removeEventListener("offline", fn);
      };
    },
    isOnline,
    () => true
  );
}

/** Installs the service worker (public/sw.js) and has it keep `pages` on the device, so they open offline. */
export async function enableOfflinePages(pages: string[]) {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  try {
    // Ask the browser not to clear this device's data (offline sales, catalogue) when space runs low.
    void navigator.storage?.persist?.();
    await navigator.serviceWorker.register("/sw.js");
    const ready = await navigator.serviceWorker.ready;
    ready.active?.postMessage({ type: "cache-pages", pages });
  } catch (err) {
    console.warn("Offline pages are unavailable on this device.", err);
  }
}

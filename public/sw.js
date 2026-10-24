// Keeps OpenTill's pages and their static files on the device so the app opens with no connection.
// Data never goes through here: the app keeps its own offline copy and queues writes (lib/offline.ts, contexts/pos-context.tsx).
// ponytail: one cache that grows by a build's chunks per deploy; bump CACHE to clear it if devices run short of space.
const CACHE = "opentill-v1";
const NETWORK_WAIT_MS = 4000;

const OFFLINE_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenTill</title><body style="font-family:system-ui;background:#121212;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">
<div><h1 style="font-size:1.25rem">You're offline</h1><p>This page hasn't been saved on this device yet.</p>
<p><a href="/orders" style="color:#fbbf24">Open the Register</a></p></div>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Stores a page and every /_next/static file it references (scripts, styles, fonts). */
async function savePage(path, res) {
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  await cache.put(path, res);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) ?? []);
  await Promise.all(
    [...assets].map(async (asset) => {
      if (!(await cache.match(asset))) await cache.add(asset).catch(() => undefined);
    })
  );
}

const isPage = (res) => res.ok && res.type === "basic" && (res.headers.get("content-type") ?? "").includes("text/html");

const wait = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

/** Pages: network first so deploys show up, the saved copy when the network fails or is too slow. */
async function page(event, path) {
  const network = fetch(event.request);
  event.waitUntil(network.then((res) => isPage(res) && savePage(path, res.clone())).catch(() => undefined));
  const cached = await caches.match(path);
  if (!cached) return network.catch(() => new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html" } }));
  return Promise.race([network, wait(NETWORK_WAIT_MS)]).catch(() => cached);
}

/** Hashed build files never change, so the saved copy always wins. */
async function built(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) await (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

/** Other files (icons, manifest) can change between deploys: network first, the saved copy offline. */
async function fresh(request) {
  try {
    const res = await fetch(request);
    if (res.ok) await (await caches.open(CACHE)).put(request, res.clone());
    return res;
  } catch {
    return (await caches.match(request)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") return event.respondWith(page(event, url.pathname));
  // In-app navigation data. Failing fast offline makes Next fall back to a full page load, which page() serves.
  if (request.headers.has("RSC")) return event.respondWith(Promise.race([fetch(request), wait(NETWORK_WAIT_MS)]).catch(() => Response.error()));
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(built(request));
  if (/\.(png|svg|ico|webmanifest)$/.test(url.pathname)) event.respondWith(fresh(request));
});

// The app sends the pages it wants available offline once the worker is running.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-pages") return;
  event.waitUntil(
    Promise.all(
      event.data.pages.map(async (path) => {
        try {
          const res = await fetch(path, { cache: "no-store" });
          if (isPage(res)) await savePage(path, res);
        } catch {
          /* offline: try again next time the app opens */
        }
      })
    )
  );
});

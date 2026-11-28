// Çevrimdışı çalışma için service worker.
// - Uygulama dosyaları (index.html, assets, simgeler): önbellekten, yoksa ağdan
// - Veri (report.json, puzzles.json): önce ağ (güncel veri), ağ yoksa önbellek
const VERSION = "20261128201200";
// Önbellek adı siteye göre ayrılır: aynı alan adındaki diğer sitenin (ör. /chess-panel-serkan/)
// önbelleği silinmesin.
const PREFIX = "satranc:" + new URL(self.registration.scope).pathname + ":";
const CACHE = PREFIX + VERSION;
const CORE = ["./", "index.html", "manifest.webmanifest", "report.json", "puzzles.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    // index.html'in yüklediği derlenmiş dosyaları da önbelleğe al
    const html = await (await fetch("index.html", { cache: "no-store" })).text();
    const assets = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => m[1]);
    await c.addAll(assets);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      // bu sitenin eski sürümleri + ilk sürümün önekli olmayan önbelleği ("satranc-<sürüm>")
      if (k !== CACHE && (k.startsWith(PREFIX) || /^satranc-\d+$/.test(k))) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  const isData = url.pathname.endsWith(".json");
  const isPage = req.mode === "navigate";
  if (isData || isPage) {
    // önce ağ; başarısızsa önbellek
    e.respondWith((async () => {
      const key = isPage ? "index.html" : url.pathname.split("/").pop();
      try {
        const res = await fetch(req, { cache: "no-store" });
        if (res.ok) (await caches.open(CACHE)).put(key, res.clone());
        return res;
      } catch {
        const c = await caches.open(CACHE);
        return (await c.match(key)) || (await c.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});

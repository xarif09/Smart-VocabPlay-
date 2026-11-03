// Service Worker — ให้เล่นออฟไลน์ได้หลังเปิดครั้งแรก
// หน้า (navigate) = ลองเน็ตก่อน ไม่ได้ค่อยใช้แคช · ไฟล์อื่นในโดเมนเดียวกัน = ใช้แคชก่อน
const CACHE = "vocabplay-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

// ตอนติดตั้ง: แคชหน้าแรก + ไฟล์ js/css/ไอคอนที่ index.html อ้างถึง (ชื่อไฟล์มี hash เปลี่ยนทุก build)
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    let assets = [];
    try {
      const html = await (await fetch("./index.html", { cache: "no-store" })).text();
      assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
        .filter(u => /\/assets\/|\.png$|\.webmanifest$/.test(u) && !u.startsWith("http") && !u.startsWith("data:"));
    } catch (_) {}
    await Promise.all([...SHELL, ...assets].map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // API ภายนอก (เสียง/แปล) ไม่แคช
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", cp)); return res; })
        .catch(() => caches.match("./index.html", { ignoreVary: true }))
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    }))
  );
});

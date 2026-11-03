// Service Worker — ให้เล่นออฟไลน์ได้หลังเปิดครั้งแรก
// หน้า (navigate) = ลองเน็ตก่อน ไม่ได้ค่อยใช้แคช · ไฟล์อื่นในโดเมนเดียวกัน = ใช้แคชก่อน
const CACHE = "vocabplay-v2";
const IMG_CACHE = "vocabplay-img-v1";   // รูปจาก Wikipedia (แยกแคช ไม่ล้างตอนอัปเดตแอป)
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
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // รูป/ข้อมูลรูปจาก Wikipedia → แคชก่อน (เล่นออฟไลน์เห็นรูปที่เคยโหลด)
  if (/(^|\.)(wikipedia|wikimedia)\.org$/.test(url.hostname)) {
    e.respondWith(caches.open(IMG_CACHE).then(async c => {
      const hit = await c.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    }).catch(() => fetch(req)));
    return;
  }
  if (url.origin !== self.location.origin) return;           // API ภายนอก (แปล) ไม่แคช
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

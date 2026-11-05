// Service Worker — ให้เล่นออฟไลน์ได้หลังเปิดครั้งแรก
// หน้า (navigate) = ลองเน็ตก่อน ไม่ได้ค่อยใช้แคช · ไฟล์อื่นในโดเมนเดียวกัน = ใช้แคชก่อน
const CACHE = "vocabplay-v7";
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
    // ไม่ skipWaiting อัตโนมัติ: รอให้ผู้ใช้กด "อัปเดต" (กันรีโหลดกลางเกม)
  })());
});
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
  warmImages();   // โหลดรูปคำศัพท์ทั้งหมดเข้าแคชเบื้องหลัง (ไม่บล็อก) → ออฟไลน์เห็นครบทุกรูป
  warmAudio();    // เสียงเจ้าของภาษาทั้งหมด (ไฟล์เล็ก ~5KB/คำ)
});
async function warmAudio() {
  try {
    const c = await caches.open(IMG_CACHE);
    const credits = await (await fetch("./audio/credits.json", { cache: "no-store" })).json();
    const files = Object.values(credits).map(x => x.file).filter(Boolean);
    for (let i = 0; i < files.length; i += 8) {
      await Promise.all(files.slice(i, i + 8).map(async f => {
        const u = new URL("./audio/" + f, self.location.href).href;
        if (await c.match(u, { ignoreVary: true })) return;
        try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (_) {}
      }));
    }
  } catch (_) {}
}
// รายชื่อรูปอยู่ใน img/credits.json (สร้างโดย scripts/fetch-images.mjs) · โหลดทีละ 6 รูป ข้ามที่มีแล้ว
async function warmImages() {
  try {
    const c = await caches.open(IMG_CACHE);
    const credits = await (await fetch("./img/credits.json", { cache: "no-store" })).json();
    const files = Object.values(credits).map(x => x.file).filter(Boolean);
    for (let i = 0; i < files.length; i += 6) {
      await Promise.all(files.slice(i, i + 6).map(async f => {
        const u = new URL("./img/" + f, self.location.href).href;
        if (await c.match(u, { ignoreVary: true })) return;
        try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (_) {}
      }));
    }
  } catch (_) {}
}
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
  // รูปคำศัพท์ที่บรรจุมา → แคชแยก (IMG_CACHE) ไม่ถูกล้างตอนอัปเดตแอป
  if (url.pathname.includes("/img/") || url.pathname.includes("/audio/") || url.pathname.includes("/tts/") || url.pathname.includes("/models/")) {
    e.respondWith(caches.open(IMG_CACHE).then(async c => {
      const hit = await c.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
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

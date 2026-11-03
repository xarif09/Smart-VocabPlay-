import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

// PWA: ลงทะเบียน service worker ให้เล่นออฟไลน์ได้ (ถ้าไม่รองรับก็ข้ามเงียบๆ)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").then(reg => {
      // มีเวอร์ชันใหม่รอใช้งาน → แจ้งแอป (App แสดงแถบ "อัปเดต")
      const notify = () => window.dispatchEvent(new CustomEvent("vp-update", { detail: reg }));
      if (reg.waiting && navigator.serviceWorker.controller) notify();
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) notify(); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);   // เช็กอัปเดตทุกชั่วโมงถ้าเปิดค้างไว้
    }).catch(() => {});
    // รีโหลดเมื่อ SW ใหม่เข้าควบคุม "แทนตัวเก่า" เท่านั้น (ครั้งแรกที่ติดตั้งไม่มีตัวเก่า → ไม่รีโหลด)
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloading) { reloading = true; window.location.reload(); } });
  });
}

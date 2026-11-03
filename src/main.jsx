import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

// PWA: ลงทะเบียน service worker ให้เล่นออฟไลน์ได้ (ถ้าไม่รองรับก็ข้ามเงียบๆ)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  });
}

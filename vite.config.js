import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
// เวลา build (เวลาไทย) ใช้โชว์คู่เลขเวอร์ชันบนหน้าแรก/ตั้งค่า
const buildTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date());

// base ต้องตรงกับชื่อ repo เพื่อให้ GitHub Pages โหลดไฟล์ถูก
export default defineConfig({
  plugins: [react()],
  base: "/Smart-VocabPlay-/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
});

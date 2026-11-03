import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base ต้องตรงกับชื่อ repo เพื่อให้ GitHub Pages โหลดไฟล์ถูก
export default defineConfig({
  plugins: [react()],
  base: "/Smart-VocabPlay-/",
});

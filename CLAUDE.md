# CLAUDE.md — Smart VocabPlay

เว็บแอปฝึกคำศัพท์ภาษาอังกฤษสำหรับเด็กไทย · ผู้ใช้: Shareef

## วิธีทำงาน
- ตอบเป็นภาษาไทยทุกครั้ง กระชับ เข้าใจง่าย
- ทำทีละขั้น ถามเฉพาะตอนสงสัยจริงๆ นอกนั้นตัดสินใจเองแล้วบอก

## กฎเหล็ก
1. ห้ามเปลี่ยนหน้าตา / เกม / พฤติกรรมเดิม ถ้าไม่ได้สั่ง
2. `speechSynthesis.speak()` ต้องเรียกตรงใน `onClick` — ห้ามอยู่ใน `setTimeout` / Promise / async (iOS จะไม่ออกเสียง)
3. หน้าแรก "แตะเพื่อเริ่ม" ต้องเรียก `unlockAudio()` ตรงใน `onClick`
4. มือถือห้ามมีอะไรซ้อนกัน · ปุ่มสูง ≥ 44px
5. ห้ามเพิ่มไลบรารีถ้าไม่จำเป็น · ใช้ inline CSS (ไม่ใช้ Tailwind)
6. localStorage ใช้ไม่ได้ แอปต้องยังทำงาน (ครอบ try/catch เสมอ)

## คำสั่ง
```bash
npm install        # ติดตั้ง
npm run dev        # เปิดเครื่อง dev → http://localhost:5173/Smart-VocabPlay-/
npm run build      # build ลง dist/
npm run preview    # ดูผล build → http://localhost:4173/Smart-VocabPlay-/
node scripts/check-ui.cjs   # (ต้องเปิด preview ก่อน) ถ่ายภาพ + ตรวจซ้อน/นับคำ/localStorage
```

## โครงสำคัญ
- โค้ดทั้งแอปอยู่ `src/App.jsx` (ไฟล์เดียว) · `src/main.jsx` แค่ mount
- `vite.config.js` → `base: "/Smart-VocabPlay-/"` (ต้องตรงชื่อ repo)
- Deploy: push เข้า `main` → `.github/workflows/deploy.yml` build แล้วขึ้น GitHub Pages เอง

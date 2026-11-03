# PROJECT.md — Smart VocabPlay

## ทำอะไร
เว็บแอปให้เด็กไทยฝึกคำศัพท์อังกฤษผ่านเกม · อ่านเสียง EN แล้วต่อด้วย TH (Web Speech API)
· 296 คำ 14 หมวด · หน้าแรก = ตารางหมวด → หมวด = รายการเกม → เล่น
· เกม: Quiz / Spelling / Memory / Speed Round + เกมเฉพาะหมวด (Habitat Hunt, Picture Match, Color Mix, Count Quest, Body Doctor, Dress Up)
· หน้า จัดการ: ค้นหา / กรอง / เพิ่ม / แก้ / ลบ / ฟังเสียง

เล่นบนมือถือ: https://xarif09.github.io/Smart-VocabPlay-/

## โครงไฟล์
```
index.html                    หน้า HTML (viewport มือถือ, reset margin)
vite.config.js                ตั้ง base /Smart-VocabPlay-/
src/main.jsx                  mount React
src/App.jsx                   ทั้งแอป (เสียง, คำศัพท์, หน้าจอ, เกม) — มาจาก smart-vocabplay-v8.jsx
.github/workflows/deploy.yml  build + deploy GitHub Pages เมื่อ push เข้า main
scripts/check-ui.cjs          Playwright: ถ่ายภาพมือถือ/คอม + ตรวจซ้อน, นับคำ, localStorage
docs/screenshots/             ภาพผลตรวจล่าสุด
```

## เสร็จแล้ว
- [x] v8: เสียง EN→TH, หน้าแตะเพื่อเริ่ม (unlockAudio), 296 คำ 14 หมวด, เกมทั้งหมด, หน้าจัดการ, inline CSS
- [x] ตั้งเป็นโปรเจกต์ Vite + React (`npm install / dev / build` ผ่าน)
- [x] คำที่เพิ่ม/แก้/ลบ บันทึกลง localStorage (key `smart-vocabplay:words:v1`) + ปุ่ม "↺ คืนค่าคำศัพท์เริ่มต้น" (ถามยืนยัน) ท้ายหน้าจัดการ · localStorage ใช้ไม่ได้ก็ยังเล่นได้
- [x] GitHub Actions deploy ขึ้น GitHub Pages

## งานถัดไป (ยังไม่ได้ทำ — รอสั่ง)
1. **เสียงยังไม่ตรงกฎข้อ 2 ทั้งหมด** (ตั้งใจไม่แก้ เพราะเป็นพฤติกรรมเดิมที่พอใจแล้ว):
   - `speakWord()` เรียก `cancel()` แล้วรอ 50ms ใน `setTimeout` ก่อน `speak()` · เสียงไทยเล่นต่อใน `onend` / `setTimeout`
   - เกมที่พูดเองตอนขึ้นข้อใหม่ (อยู่ใน `useEffect` ไม่ใช่ onClick): Spelling, Color Mix, Count Quest, Body Doctor, Dress Up
   - Quiz/Speed Round: ข้อถัดไปถูกเลื่อนด้วย setTimeout แต่เสียงเรียกตอนแตะ (ตรงกฎ)
2. **ปุ่มเล็กกว่า 44px**: ปุ่มบนแถบหัว (36px), 🔊✏️🗑️ ในหน้าจัดการ (32px), "🔊 ฟัง EN+TH" (31px), "+ เพิ่มคำ" (37px), บันทึก/ยกเลิก (39px), ปุ่มในเกมสะกด (41px)
3. **MyMemory API ดึงคำแปล** — ไม่พบในโค้ด v8 (ไม่มี fetch) ต้องเพิ่มใหม่ถ้าต้องการ
4. ถ้าเพิ่มคำเริ่มต้นใหม่ในโค้ด เครื่องที่เคยบันทึกไว้จะไม่เห็น จนกว่าจะกด "คืนค่า" (หรือเปลี่ยน key เป็น v2 + รวมคำ)
5. หัวหน้าแรก "296 คำ · 14 หมวด" ตัดเป็น 2 บรรทัดบนจอ 375px (ไม่ซ้อน แต่ดูแน่น)

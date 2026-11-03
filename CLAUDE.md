# CLAUDE.md — Smart VocabPlay

เว็บแอปฝึกคำศัพท์ภาษาอังกฤษสำหรับเด็กไทย · ผู้ใช้: Shareef

## วิธีทำงาน
- ตอบเป็นภาษาไทยทุกครั้ง กระชับ เข้าใจง่าย
- ทำทีละขั้น ถามเฉพาะตอนสงสัยจริงๆ นอกนั้นตัดสินใจเองแล้วบอก

## กฎเหล็ก
1. ห้ามเปลี่ยนหน้าตา / เกม / พฤติกรรมเดิม ถ้าไม่ได้สั่ง · ธีมปัจจุบัน = "Aurora" (v2.0: โทเค็น `T`, `card()`, ฟอนต์ Prompt, แท็บล่าง, โหมดเกม immersive) ของใหม่ต้องใช้โทเค็นเดียวกัน
2. `speechSynthesis.speak()` ต้องเรียกตรงใน `onClick` — ห้ามอยู่ใน `setTimeout` / Promise / async (iOS จะไม่ออกเสียง)
3. หน้าแรก "แตะเพื่อเริ่ม" ต้องเรียก `unlockAudio()` ตรงใน `onClick`
4. มือถือห้ามมีอะไรซ้อนกัน · ปุ่มสูง ≥ 44px
5. ห้ามเพิ่มไลบรารีถ้าไม่จำเป็น · ใช้ inline CSS (ไม่ใช้ Tailwind)
6. localStorage ใช้ไม่ได้ แอปต้องยังทำงาน (ครอบ try/catch เสมอ)
7. ก่อน commit ต้องรัน `npm run build` และ `node scripts/check-ui.cjs` ให้ขึ้น ✅ ALL PASS
8. **ทุกครั้งที่ส่งงาน ต้องขยับ `version` ใน package.json** (โชว์บนหน้าแรก + ตั้งค่า) และบอกเลขเวอร์ชันในสรุป
9. ก่อน push ซ้ำเข้า branch เดิม ต้องเช็กว่า PR ยัง open อยู่ · ถ้า merge แล้วให้ merge main เข้ามาแล้วเปิด PR ใหม่ (งานที่ push หลัง merge จะไม่ขึ้นเว็บ)

## คำสั่ง
```bash
npm install        # ติดตั้ง
npm run dev        # เปิดเครื่อง dev → http://localhost:5173/Smart-VocabPlay-/
npm run build      # build ลง dist/
npm run preview    # ดูผล build → http://localhost:4173/Smart-VocabPlay-/
node scripts/check-ui.cjs   # (ต้องเปิด preview ก่อน) ถ่ายภาพ + ตรวจซ้อน/นับคำ/localStorage
```

## โครงสำคัญ
- `src/App.jsx` = หน้าจอ + เกมทั้งหมด · `src/progress.js` = ดาว/เหรียญ/สติกเกอร์/streak/เพื่อนคู่หู · `src/sfx.js` = เสียงเอฟเฟกต์ (Web Audio) · `src/lexicon.js` = คำอ่านไทย+ประโยค 547 คำ (key `หมวด|คำ`) · `src/images.js` = คำ → บทความ Wikipedia สำหรับรูปจริง (รูปจริงอยู่ `public/img/` ดาวน์โหลดโดย workflow `fetch-images.yml` · แก้ชื่อบทความแล้ว push จะโหลดใหม่เอง · ตรวจด้วย `node scripts/contact-sheet.cjs`) · `src/content.js` = บทสนทนา/นิทาน/โฟนิกส์/ไวยากรณ์/วัน-เดือน/ตัวเลข-เวลา (รูปอ้างด้วย key `หมวด|คำ` · แก้แล้วรัน `node scripts/check-content.mjs`) · `src/main.jsx` แค่ mount
- นำทาง: `navTab` (home/learnhub/playhub/me) + `screen` · หน้า game/learn/versus = immersive (ไม่มีหัว/แท็บล่าง) · เข้าเกมผ่าน `goGame/startPseudoGame/goLearn` เท่านั้น (เรียก `enterFullscreen` ใน onClick)
- เกมที่ไม่ผูกกับหมวดจริง (ไวยากรณ์ ชีวิตประจำวัน สอบ) ใช้ `startPseudoGame(cat, gid)` โดย cat มี `back:"<screen>"` ให้ปุ่มย้อนกลับไปถูกหน้า
- ทุกเกมรายงานผลผ่าน `track.correct(word)` / `track.wrong(word)` / `track.finish(score,total,opts)` → GameRouter คิดดาว เหรียญ สติกเกอร์ แล้วเปิด ResultScreen
- เพิ่มคำเริ่มต้นใหม่ = **ต่อท้าย** รายการ `W(...)` ใน App.jsx เสมอ (id ผูกกับสติกเกอร์/SRS) + แถวใน lexicon.js + (ถ้าเป็นของจริง) แถวใน images.js · ห้ามลบคำกลางรายการ ให้แทนที่ด้วยคำใหม่แทน · ทุกเกมใหม่ต้องมีใน `GAME_META` และ (ถ้าทุกหมวดมี) ใน `EXTRA_GAMES`
- localStorage: `smart-vocabplay:words:v1` (คำศัพท์ ใช้ร่วมทุกคน) · `smart-vocabplay:profiles:v1` (รายชื่อโปรไฟล์) · `smart-vocabplay:progress:v1[:<profileId>]` (ความคืบหน้าแต่ละคน · p1 ไม่มี suffix)
- PWA: `public/sw.js` แคช index + assets · แก้ SW แล้วต้องเปลี่ยนชื่อ `CACHE` · ไอคอนสร้างใหม่ได้ด้วยสคริปต์ Playwright (ดู PROJECT.md)
- `vite.config.js` → `base: "/Smart-VocabPlay-/"` (ต้องตรงชื่อ repo)
- Deploy: push เข้า `main` → `.github/workflows/deploy.yml` build แล้วขึ้น GitHub Pages เอง

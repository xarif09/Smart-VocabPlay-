# CLAUDE.md — Smart VocabPlay

เว็บแอปฝึกคำศัพท์ภาษาอังกฤษสำหรับเด็กไทย · ผู้ใช้: Shareef

## วิธีทำงาน
- ตอบเป็นภาษาไทยทุกครั้ง กระชับ เข้าใจง่าย
- ทำทีละขั้น ถามเฉพาะตอนสงสัยจริงๆ นอกนั้นตัดสินใจเองแล้วบอก

## กฎเหล็ก
1. ห้ามเปลี่ยนหน้าตา / เกม / พฤติกรรมเดิม ถ้าไม่ได้สั่ง · ธีมปัจจุบัน = **Material 3 Expressive** (v3.0 · `src/m3.jsx`): สีไดนามิก oklch จาก seed ของธีม (`applyM3Theme`) → CSS var `--md-*` · โทเค็น `MD.*`/`T.*` · สไตล์สำเร็จรูป `M3.filled/tonal/listItem/card…` · คอมโพเนนต์ `Shape` (cookie/clover/burst) `M3NavBar` `M3TopBar` `M3Sheet` `M3Switch` `WavyProgress` `ButtonGroup` · มุม 28 ปุ่มแคปซูล ไม่มีเงาหนัก · ฟอนต์ Prompt · โหมดเกม immersive · ของใหม่ต้องใช้โทเค็นนี้ **ห้าม hardcode สี** (ธีม space = โหมดมืด ต้องดูได้ทั้งสองโหมด)
2. `speechSynthesis.speak()` ต้องเรียกตรงใน `onClick` — ห้ามอยู่ใน `setTimeout` / Promise / async (iOS จะไม่ออกเสียง)
3. หน้าแรก "แตะเพื่อเริ่ม" ต้องเรียก `unlockAudio()` ตรงใน `onClick`
4. มือถือห้ามมีอะไรซ้อนกัน · ปุ่มสูง ≥ 44px · **รูปคำศัพท์ในเกม/การ์ดต้องใหญ่เต็มพื้นที่เสมอ**: ใช้ `<Pic fill>` (สูง `min(46vh, 430px, 92vw)`) หรือ `<Emoji w>` ห้ามใช้ `<Pic size=เล็ก>` เป็นรูปหลักของข้อ (ผู้ใช้ตำหนิเรื่องนี้หลายครั้ง) · **ห้ามพื้นหลังเบลอรอบรูป/ห้ามแถบขอบ** · **มาตรฐานรูป v3.20 = 3:4 แนวตั้งทุกรูป** (ไฟล์ `public/img/w/*.jpg` 600×800 + `src/wordImages.json` สร้างโดย `scripts/img-pipeline/`: CLIP ยืนยันว่ารูปตรงคำ ตัวหลักอยู่กลาง เห็นครบ (สัตว์เต็มตัว) เหลือที่ว่างรอบๆ) · คำที่ผู้ใช้เพิ่มเองครอปผ่าน `ImageCropper` (3:4) ในหน้าจัดการคำ · **งานรูปทุกครั้งใช้ skill `vocab-images`** (`.claude/skills/vocab-images/SKILL.md`: มาตรฐาน + ขั้นตอน pipeline + ตรวจด้วยตาด้วย `qa_sheet.py` ก่อนส่ง) · **เกมที่ตอบเป็นรูป: โจทย์ = เสียง + คำเขียนเสมอ** (`<SoundPrompt w={word}>` แถบลำโพง+คำ+คำแปล) ตัวเลือกเป็นรูป · ช่องรูปตัวเลือกใช้ `aspectRatio:"3/4"` (`TILE34`) · **หน้าแรก v3.19 = คลังเกมก่อน** (`GAME_GROUPS` → `goPickGame(gid)` → หน้าเลือกหมวด `pickcat`) คำศัพท์อยู่ใต้เกม (แท็บ "เรียน") · ตั้งค่า: เสียงคำแปลไทย (`smart-vocabplay:thaivoice` มีปุ่ม "🗣️ ไทย" บนหัวทุกเกม) / แสดงคำแปลไทยบนจอ (`ThaiTextCtx`) / ความเร็วเสียง · หน้าหมวด = การ์ดเกม 2 คอลัมน์ · **เกมเฉพาะหมวดอยู่หน้าสุดของ `games`** (habitat/feed/colormix/bodydr/dress/count/runner) · **เกมผจญภัย 2D (v3.21 แทนเกม 3D ทั้งหมด)** = `src/game2d/` (Runner2D/Racer2D/Penalty2D/FindRoom2D/Action2D โหลดแบบ lazy ผ่าน `mount2D`) ใช้ชุดภาพ `src/game2d/kit.jsx`: ตัวการ์ตูน/สิ่งของ = Fluent Emoji 3D (MIT) ใน `public/fluent/<codepoint>.webp` (`fl(emoji)`/`<Fl e>`) + ฉาก SVG ชั้นๆ ตามหมวด (`Scene`, `THEMES`) · ห้ามกลับไปใช้ three.js · ก่อนส่งต้องไล่เล่นทุกเกมจริงด้วยภาพหน้าจอ · ก่อนส่งต้องรัน `node scripts/img-size-audit.cjs` และ `node scripts/img-size-audit.cjs 360 640` ให้ผ่านทุกหน้า (วัดขนาดรูปจริงทุกเกม) · เกมใหม่ต้องเพิ่มเข้าสคริปต์นี้ด้วย
5. เพิ่มไลบรารีได้เมื่อทำให้ดีขึ้นจริง (ผู้ใช้อนุญาตแล้ว v2.4) แต่ต้องใช้งานออฟไลน์ได้และไม่หนัก · ใช้ inline CSS (ไม่ใช้ Tailwind) · ตัวละครเพื่อนคู่หูคือ `src/Pet.jsx` (SVG วาดเอง มี mood + outfit) · ไอคอนหมวด/เกมใช้ `src/Icons.jsx` (`<CatIcon>`/`<GameIcon>`) ไม่ใช้อีโมจิบนการ์ดหลัก
6. localStorage ใช้ไม่ได้ แอปต้องยังทำงาน (ครอบ try/catch เสมอ)
7. ก่อน commit ต้องรัน `npm run build` และ `node scripts/check-ui.cjs` ให้ขึ้น ✅ ALL PASS · และ `node scripts/audit.cjs` (ความครบของรูป/เสียง/คำอ่าน) แล้วรายงานตัวเลขในสรุป
8. **ทุกครั้งที่ส่งงาน ต้องขยับ `version` ใน package.json** (โชว์บนหน้าแรก + ตั้งค่า) และบอกเลขเวอร์ชันในสรุป · **สรุปทุกรอบต้องแนบลิงก์ PR และลิงก์เว็บ** https://xarif09.github.io/Smart-VocabPlay-/ เสมอ
9. ก่อน push ซ้ำเข้า branch เดิม ต้องเช็กว่า PR ยัง open อยู่ · ถ้า merge แล้วให้ merge main เข้ามาแล้วเปิด PR ใหม่ (งานที่ push หลัง merge จะไม่ขึ้นเว็บ)

## Skills (`.claude/skills/`)
- `vocabplay-ship` — ส่งงานทุกรอบ: ทดสอบครบ เวอร์ชัน เช็ก PR สรุป+ลิงก์
- `vocabplay-new-game` — เพิ่ม/แก้เกม (รวมเกมผจญภัย 2D) ให้ตรงกฎ + ลงทะเบียนครบ
- `vocab-images` — หา/ตรวจรูปคำศัพท์ตามมาตรฐาน 3:4

## คำสั่ง
```bash
npm install        # ติดตั้ง
npm run dev        # เปิดเครื่อง dev → http://localhost:5173/Smart-VocabPlay-/
npm run build      # build ลง dist/
npm run preview    # ดูผล build → http://localhost:4173/Smart-VocabPlay-/
node scripts/check-ui.cjs   # (ต้องเปิด preview ก่อน) ถ่ายภาพ + ตรวจซ้อน/นับคำ/localStorage
node scripts/audit.cjs      # (ต้องเปิด preview ก่อน) รายงานความครบ: รูป/ภาพออกแบบ/อีโมจิ · เสียงคนจริง · คำอ่าน/ประโยค
node scripts/img-size-audit.cjs [w h]  # (ต้องเปิด preview ก่อน) วัดขนาดรูปจริงทุกหน้า/ทุกเกม ฟ้องหน้าที่รูปเล็ก
```

## โครงสำคัญ
- `src/App.jsx` = หน้าจอ + เกมทั้งหมด · `src/progress.js` = ดาว/เหรียญ/สติกเกอร์/streak/เพื่อนคู่หู · `src/sfx.js` = เสียงเอฟเฟกต์ (Web Audio) · `src/fx.jsx` = เอฟเฟกต์ภาพ (`fx.correct/wrong/win/levelUp`, `<Reveal>`, `<Ambient>`) — เกมใหม่ส่ง event ให้ `track.correct(w, e)` เพื่อให้ระเบิดดาว ณ จุดแตะ · `src/lexicon.js` = คำอ่านไทย+ประโยค 1,165 คำ (key `หมวด|คำ`) · `src/images.js` = คำ → บทความ Wikipedia สำหรับรูปจริง (รูปจริงอยู่ `public/img/` ดาวน์โหลดโดย workflow `fetch-images.yml` · แก้ชื่อบทความแล้ว push จะโหลดใหม่เอง · ตรวจด้วย `node scripts/contact-sheet.cjs`) · เสียงเจ้าของภาษา: `public/audio/*.mp3` + `src/audioManifest.json` (คำตัวพิมพ์เล็ก → ไฟล์) ดาวน์โหลด/แปลงโดย workflow `fetch-audio.yml` (`scripts/fetch-audio.mjs` + ffmpeg) · เสียง neural ประโยค/บทสนทนา/นิทาน/คำแปลไทย: `public/tts/<fnv1a(text)>.mp3` + `src/ttsManifest.json` สร้างโดย workflow `fetch-tts.yml` (`scripts/tts-list.mjs` → `scripts/fetch-tts.py` edge-tts ฟรี) · แก้ประโยค/บทสนทนาแล้ว push workflow จะสร้างเฉพาะท่อนใหม่ · `speakWord()` เล่นไฟล์ก่อน (คำ → Commons, ประโยค/ไทย → tts) ไม่มีค่อยใช้เสียงเครื่อง · `src/Concept.jsx` = ภาพ SVG ออกแบบเองสำหรับคำที่ไม่มีรูปถ่าย (สี ตัวเลข รูปทรง เวลา คำตรงข้าม ความรู้สึก) `<Pic>` ใช้ก่อนอีโมจิ · ตรวจทั้งชุดที่ `?concepts=1` · **ห้ามปล่อยคำใหม่ให้เป็นอีโมจิเปล่า** ต้องมีรูปถ่าย (images.js) หรือภาพออกแบบ · `src/share.js` = แชร์ชุดคำผ่าน `#set=` (deflate+base64url) ใช้กับ `ShareSetSheet`/`ImportSetSheet` ใน App.jsx (QR จาก `qrcode-generator`) · `src/content.js` = บทสนทนา/นิทาน/โฟนิกส์/ไวยากรณ์/วัน-เดือน/ตัวเลข-เวลา (รูปอ้างด้วย key `หมวด|คำ` · แก้แล้วรัน `node scripts/check-content.mjs`) · `src/main.jsx` แค่ mount
- นำทาง: `navTab` (home/learnhub/playhub/me) + `screen` · หน้า game/learn/versus = immersive (ไม่มีหัว/แท็บล่าง) · เข้าเกมผ่าน `goGame/startPseudoGame/goLearn` เท่านั้น (เรียก `enterFullscreen` ใน onClick)
- เกมที่ไม่ผูกกับหมวดจริง (ไวยากรณ์ ชีวิตประจำวัน สอบ) ใช้ `startPseudoGame(cat, gid)` โดย cat มี `back:"<screen>"` ให้ปุ่มย้อนกลับไปถูกหน้า
- ทุกเกมรายงานผลผ่าน `track.correct(word)` / `track.wrong(word)` / `track.finish(score,total,opts)` → GameRouter คิดดาว เหรียญ สติกเกอร์ แล้วเปิด ResultScreen
- เพิ่มคำเริ่มต้นใหม่ = **ต่อท้าย** รายการ `W(...)` ใน App.jsx เสมอ (id ผูกกับสติกเกอร์/SRS) + แถวใน lexicon.js + (ถ้าเป็นของจริง) แถวใน images.js · ห้ามลบคำกลางรายการ ให้แทนที่ด้วยคำใหม่แทน · ทุกเกมใหม่ต้องมีใน `GAME_META` และ (ถ้าทุกหมวดมี) ใน `EXTRA_GAMES`
- localStorage: `smart-vocabplay:words:v1` (คำศัพท์ ใช้ร่วมทุกคน) · `smart-vocabplay:profiles:v1` (รายชื่อโปรไฟล์) · `smart-vocabplay:progress:v1[:<profileId>]` (ความคืบหน้าแต่ละคน · p1 ไม่มี suffix)
- PWA: `public/sw.js` แคช index + assets · แก้ SW แล้วต้องเปลี่ยนชื่อ `CACHE` · ไอคอนสร้างใหม่ได้ด้วยสคริปต์ Playwright (ดู PROJECT.md)
- `vite.config.js` → `base: "/Smart-VocabPlay-/"` (ต้องตรงชื่อ repo)
- Deploy: push เข้า `main` → `.github/workflows/deploy.yml` build แล้วขึ้น GitHub Pages เอง

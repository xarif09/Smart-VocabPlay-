---
name: vocab-images
description: หา/เปลี่ยน/ตรวจรูปคำศัพท์ของ Smart VocabPlay ตามมาตรฐาน 3:4 (รูปถ่ายจริงที่สื่อคำชัด ตัวหลักอยู่กลาง เห็นครบ เหมาะกับเด็ก) ด้วย scripts/img-pipeline แล้วตรวจด้วยตาทุกรูปก่อนส่ง ใช้เมื่อผู้ใช้บอกว่ารูปผิด/ไม่สื่อ/โดนตัด/ไม่ได้มาตรฐาน, เพิ่มคำใหม่ที่ต้องมีรูป, หรือสั่งหารูปให้คำที่ยังเป็นอีโมจิ
---

# รูปคำศัพท์ Smart VocabPlay (มาตรฐาน v3.20)

ผู้ใช้ (Shareef) ตำหนิเรื่องรูปมาหลายรอบแล้ว สรุปเป็นมาตรฐานด้านล่าง **ห้ามส่งรูปที่ยังไม่ได้ดูด้วยตา** คะแนน CLIP เพียงอย่างเดียวเชื่อไม่ได้: รอบ v3.20 pipeline เลือกมา 1,796 รูป แต่ดูด้วยตาแล้วต้องคัดออก 604 รูป

## มาตรฐานรูป (ทุกข้อต้องผ่าน)
1. **สื่อคำชัดสำหรับเด็ก 4–9 ขวบ** เห็นรูปแล้วนึกออกทันทีโดยไม่ต้องอ่าน เช่น DOG ต้องเป็นหมา ห้ามเป็นหมาป่า และห้ามได้รูปที่แค่ชื่อไปตรงกับคำ (ROUTER → ต้นปาล์ม, SISTER → ภูเขา Three Sisters)
2. **รูปถ่ายจริง สี ชัด** ห้ามใช้ภาพขาวดำ ภาพเก่าซีเปีย ภาพวาด โปสเตอร์ ภาพดาวเทียม/แผนที่/เรดาร์ หรือไอคอน
3. **เหมาะกับเด็ก** ห้ามมีแอลกอฮอล์ (แก้วไวน์ ค็อกเทล) ปืน/ทหาร แผล/เลือด/ผื่น หัวมัมมี่ ชุดว่ายน้ำหรือชุดชั้นในผู้ใหญ่ โปสเตอร์หนัง ตัวการ์ตูนมีลิขสิทธิ์ หรือภาพทางศาสนาที่ไม่เกี่ยวกับคำ
4. **ครอป 3:4 แนวตั้ง 600×800** ตัวหลักอยู่กลาง เห็นครบ (สัตว์ต้องเห็นเต็มตัว) และเหลือพื้นที่รอบๆ บ้าง ไม่ชิดขอบ ไม่มีแถบ ไม่มีพื้นหลังเบลอ
5. **สัญญาอนุญาตเปิด** ใช้ได้เฉพาะ CC0, Public Domain, CC BY, CC BY-SA และต้องบันทึก author/license/src (หน้าเครดิตอ่านจาก `src/wordImages.json`)
6. ถ้าไม่มีรูปถ่ายที่ผ่านทุกข้อ **ห้ามใส่รูปที่ไม่ผ่าน** ให้เว้นไว้ แอปจะใช้ตัวสำรองเอง ผู้ใช้ไม่ชอบภาพ SVG วาดเอง (Concept) ยกเว้นแผ่นสีของคำสี

## ลำดับที่แอปใช้รูป (`useWordImage` ใน `src/App.jsx`)
รูปที่ผู้ใช้ครอปเอง (`w.img`) → `src/wordImages.json` (`"cat|WORD"` → `{file:"w/<cat>__<slug>.jpg", src, author, license, score}` ไฟล์อยู่ที่ `public/img/w/`) → รูปเดิม `src/images.js` + `public/img/` → ภาพออกแบบ `src/Concept.jsx` → อีโมจิ
กรอบรูปในแอปเป็น 3:4 cover ทั้งหมด: `Pic fill`, `PicBox`, `CoverImg`, และช่องตัวเลือก `TILE34`

## ขั้นตอน
1. **เตรียม** (ครั้งแรกของ session) โดยวาง venv/โมเดล/แคชไว้นอก repo:
   ```bash
   python3 -m venv $SCRATCH/venv && $SCRATCH/venv/bin/pip install -r scripts/img-pipeline/requirements.txt
   export IMG_CACHE=$SCRATCH/cache IMG_MODELS=$SCRATCH/models V=$SCRATCH/venv/bin/python
   ```
   - โฮสต์ที่ต้องเปิดใน environment: commons.wikimedia.org, upload.wikimedia.org, en.wikipedia.org (ถ้าโดนบล็อก ให้อ่าน `read_documentation` หัวข้อ environment.network)
   - Wikimedia ต้องใช้ User-Agent ที่บอกชื่อแอป (ห้ามใส่อีเมลส่วนตัว) และต้องหน่วงเวลาเอง (`API_INTERVAL`, `IMG_INTERVAL`) ถ้าเจอ 429 ให้ลดจำนวนผู้สมัครต่อคำลง
2. **รันทีละหมวดหรือทีละคำ** (มีแคช รันซ้ำได้):
   ```bash
   $V scripts/img-pipeline/run.py --cats animals        # หรือ --only "animals|DOG,body|NOSE"
   ```
   - pipeline ทำ 3 ขั้น: `fetch.py` ดึงผู้สมัคร → `rank.py` ให้คะแนนด้วย CLIP → `select_crop.py` ใช้ YOLO/U2Net หากรอบตัวหลักแล้วครอป 3:4
   - ผลลัพธ์ไปที่ `public/img/w/` และ `src/wordImages.json` ส่วนคะแนนอยู่ใน `report.json`
   - **container รีสตาร์ทบ่อย** ให้ commit + push ทุกครั้งที่จบหมวด
3. **แก้รายคำ** ใน `scripts/img-pipeline/overrides.json` แล้วรัน `--only` คำนั้นใหม่:
   - บังคับไฟล์: `"cat|WORD": "File:Xxx.jpg"`
   - ค้นใหม่ด้วยคำค้นที่เจาะจงและเหมาะกับเด็ก: `{"queries": ["child climbing stairs"], "exclude": ["File:Bad.jpg"]}`
   - ปรับครอป: `{"zoom": 1.2, "dx": 0, "dy": -0.05}` หรือ `{"box": [x0,y0,x1,y1]}` หรือ `{"mode": "scene"}` (ใช้ทั้งฉาก เหมาะกับสถานที่และอากาศ)
   - ข้ามคำ: `{"skip": true}`
   - เลือกจากตารางผู้สมัคร: `$V scripts/img-pipeline/sheet.py OUT --cands "cat|WORD"` แล้ว `$V scripts/img-pipeline/pick.py "cat|WORD=3"`
3.5 **จัดเฟรมใหม่ (v3.21)**: `$V scripts/img-pipeline/recrop.py` ใช้ `frame.py` (ตัวหลักราว 72% ของด้านที่จำกัด ขอบอย่างน้อย 6% อยู่กลาง ศีรษะคนไม่โดนตัด) · ต้องรันหลัง `run.py` ทุกครั้ง (select_crop.py ยังใช้ตรรกะเก่า) · `--alts` ลองรูปผู้สมัครอื่นที่พอดีกรอบ · `--old "cat|WORD"` ครอปรูปเก่าจาก public/img · ผลรายคำใน `frame_report.json` (`fits:false` = รูปกว้างเกินใส่ 3:4 ไม่ได้ ควรหารูปใหม่ด้วย `research.py`)
4. **ตรวจด้วยตา (ห้ามข้าม)**:
   ```bash
   python3 scripts/img-pipeline/qa_sheet.py $SCRATCH/qa            # หรือระบุหมวด: ... $SCRATCH/qa body,family
   ```
   - เปิดดูทุกแผ่นด้วย Read แล้วไล่ทีละรูปตามมาตรฐานด้านบน
   - รูปที่ไม่ผ่าน: ลบ entry ออกจาก `wordImages.json` ลบไฟล์ jpg และเพิ่ม key ลงใน `scripts/img-pipeline/rejected.json` (รายการที่ต้องหารูปรอบถัดไป)
   - จากนั้นค้นใหม่ด้วย `queries` หรือปล่อยให้แอปใช้ตัวสำรอง
5. **วัดผลในแอป**:
   - `npm run build` แล้วเปิด `npm run preview` (พอร์ต 4173)
   - `node scripts/audit.cjs`: จดตัวเลข รูปถ่าย/ภาพออกแบบ/อีโมจิเปล่า
   - `node scripts/check-ui.cjs` ต้องได้ ✅ ALL PASS
   - `node scripts/img-size-audit.cjs` และ `node scripts/img-size-audit.cjs 360 640` ต้องผ่านทุกหน้า ใช้เวลานาน ให้รันเบื้องหลังและเก็บผลลงไฟล์ ห้ามต่อ `| tail` เพราะรายชื่อหน้าที่ไม่ผ่านจะหาย
   - ถ่ายภาพหน้าจอเกมจริงอย่างน้อยหนึ่งเกมที่ตอบเป็นรูป และการ์ดคำศัพท์ แล้วดูเอง

## หมวดที่หารูปยาก (บทเรียนจาก v3.20)
- **ได้ผลดี:** หมวดของจริง ได้แก่ สัตว์ อาหาร ผลไม้ ผัก ยานพาหนะ ประเทศ ธรรมชาติ และของใช้ในบ้าน
- **ผิดบ่อย:** กริยา ความรู้สึก คำตรงข้าม ครอบครัว ร่างกาย เวลา เลขลำดับ งานอาชีพบางคำ และเทคโนโลยีบางคำ เพราะ CLIP จับคู่ชื่อได้ แต่รูปไม่สื่อความหมาย
  - ต้องใช้ `queries` เป็นฉากเด็กที่ชัด เช่น EMPTY → "empty glass", FULL → "full glass of milk", UP → "child walking up stairs", MOM → "mother hugging child", HEAD → "child head portrait smiling"
  - ไม่เจอรูปที่ดีก็เว้นไว้
- **สี:** ใช้แผ่นสีใน `COLORS` ของ `src/Concept.jsx` (เพิ่มชื่อสีใหม่ที่นั่น)

## คำที่ผู้ใช้เพิ่มเอง
หน้าจัดการคำศัพท์มี `ImageCropper` (3:4, ลาก/ซูม, บันทึก 600×800 JPEG ลง `w.img`) ไม่ต้องผ่าน pipeline

## ก่อนส่งงาน (ตาม CLAUDE.md)
- ขยับ `version` ใน package.json
- บันทึกใน PROJECT.md
- เช็กว่า PR ยัง open อยู่หรือไม่ ถ้า merge แล้วให้ merge main เข้ามาก่อน แล้วเปิด PR ใหม่
- สรุปเป็นภาษาไทย บอกตัวเลข audit และจำนวนรูปที่คัดออก
- แนบลิงก์ PR และ https://xarif09.github.io/Smart-VocabPlay-/

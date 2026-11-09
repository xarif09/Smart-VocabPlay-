---
name: vocabplay-ship
description: ขั้นตอนส่งงาน Smart VocabPlay ทุกรอบ ได้แก่ ทดสอบครบชุด (build, check-ui, audit, img-size-audit 2 ขนาด, ภาพหน้าจอ), ขยับเวอร์ชัน, เช็ก PR ว่ายังเปิดอยู่หรือ merge แล้ว, commit/push, เปิด PR และสรุปภาษาไทยพร้อมลิงก์ ใช้ทุกครั้งก่อนบอกผู้ใช้ว่างานเสร็จ หรือเมื่อผู้ใช้สั่ง "ส่งงาน/push/เปิด PR"
---

# ส่งงาน Smart VocabPlay

ทำครบทุกข้อตามลำดับ ข้อไหนไม่ผ่านห้ามรายงานว่าเสร็จ ให้บอกตามจริงพร้อมผลที่ได้

## 1. ทดสอบ
ต้องเปิด preview ก่อน: `npm run build` แล้วรัน `npx vite preview --port 4173` เป็นเบื้องหลัง เมื่อแก้โค้ดให้ build ใหม่ preview จะเสิร์ฟ dist ใหม่เอง
```bash
npm run build
node scripts/check-ui.cjs                 # ต้องขึ้น ✅ ALL PASS
node scripts/audit.cjs                    # จดตัวเลข: คำ / รูปถ่าย / ภาพออกแบบ / อีโมจิเปล่า / เสียงคนจริง / ประโยค
node scripts/img-size-audit.cjs > $SCRATCH/isa-390.txt 2>&1
node scripts/img-size-audit.cjs 360 640 > $SCRATCH/isa-360.txt 2>&1
grep "❌" $SCRATCH/isa-*.txt              # ต้องไม่มีหน้าที่ไม่ผ่าน
```
- img-size-audit ใช้เวลานาน (ราวสิบนาทีต่อขนาด): ให้รันเบื้องหลังและเก็บผลลงไฟล์ **ห้ามต่อ `| tail`** เพราะรายชื่อหน้าที่ไม่ผ่านจะหาย
- ถ้าหน้าไหนไม่ผ่าน ให้แก้แล้ววัดซ้ำเฉพาะหน้านั้นได้ โดยทำสำเนาสคริปต์ชั่วคราวที่ตัดบรรทัด `await game(`/`await hub(`/`for (const g`/`for (let k` ของหน้าอื่นออก (ห้ามตัด `for (const r of rows)` ซึ่งเป็นบรรทัดพิมพ์ผล) แล้วลบสำเนาทิ้ง
- **ดูภาพหน้าจอเอง**: check-ui เก็บไว้ที่ `docs/screenshots/` ส่วนหน้าที่แก้ให้ถ่ายเพิ่มที่ 390×844 และ 360×640 ด้วย Playwright แล้วเปิดดูว่าไม่มีอะไรซ้อนกัน ปุ่มสูง ≥ 44px รูปใหญ่เต็มกรอบ 3:4 และไม่ล้นจอ
- เกมใหม่หรือเกมที่แก้: เล่นจริงจนจบหนึ่งรอบ (ดูกฎใน skill `vocabplay-new-game`)
- แก้คอนเทนต์ (`src/content.js`) ต้องรัน `node scripts/check-content.mjs`

## 2. เวอร์ชันและเอกสาร
- ขยับ `version` ใน `package.json` ทุกครั้ง: แก้เล็กเพิ่มเลขท้าย ฟีเจอร์ใหม่เพิ่มเลขกลาง เลขนี้โชว์บนหน้าแรกและหน้าตั้งค่า
- เพิ่มบันทึกหนึ่งบรรทัดท้าย `PROJECT.md`: `- vX.Y.Z: ...`
- ถ้าเปลี่ยนกฎหรือโครงสำคัญ ให้แก้ `CLAUDE.md` ให้ตรงกับของจริง
- แก้ `public/sw.js` แล้วต้องเปลี่ยนชื่อ `CACHE`

## 3. Git และ PR
1. เช็กสถานะ PR ล่าสุดของ branch ด้วย `mcp__github__list_pull_requests` (state all)
2. **ถ้า PR ล่าสุด merge แล้ว** ให้รัน `git fetch origin main && git merge origin/main` ก่อน แล้วค่อยเปิด PR ใหม่ งานที่ push เข้า PR ที่ merge แล้วจะไม่ขึ้นเว็บ
3. commit ข้อความภาษาอังกฤษที่บอกว่าทำอะไร ปิดท้ายด้วยบรรทัด attribution ตามที่ระบบกำหนด ห้ามใส่ชื่อรุ่นโมเดล
4. `git push -u origin <branch>` ถ้าล้มเพราะเน็ต ให้ลองใหม่ 2s/4s/8s/16s
5. ถ้าไม่มี PR ที่เปิดอยู่ ให้สร้างด้วย `mcp__github__create_pull_request` (base `main`) ใส่ Summary, Tests (ตัวเลขจริง) และ Known gaps
6. **container รีสตาร์ทบ่อย**: งานยาวให้ commit และ push เป็นช่วงๆ และเก็บไฟล์ใหญ่ชั่วคราวไว้นอก repo

## 4. สรุปให้ผู้ใช้ (ภาษาไทย กระชับ)
- **ต้องมีครบ:** เลขเวอร์ชัน, สิ่งที่ทำ (ตรงกับที่สั่ง), ตัวเลข audit, ผล check-ui และ img-size-audit, สิ่งที่ยังไม่เสร็จหรือข้อจำกัด
- **ลิงก์ที่ต้องแนบทุกครั้ง:** PR `https://github.com/xarif09/Smart-VocabPlay-/pull/<n>` และเว็บ https://xarif09.github.io/Smart-VocabPlay-/
- เว็บจะอัปเดตหลังผู้ใช้ merge PR เท่านั้น (deploy อัตโนมัติจาก `main`)
- ห้ามบอกว่าผ่านถ้ายังไม่ได้รันจริง และห้ามซ่อนผลที่ไม่ผ่าน

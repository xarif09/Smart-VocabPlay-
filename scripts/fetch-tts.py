#!/usr/bin/env python3
"""สร้างเสียงอ่านจริง (Microsoft Edge neural TTS ผ่านไลบรารี edge-tts · ฟรี ไม่ต้องมี key)
   อ่าน scripts/tts-list.json (จาก node scripts/tts-list.mjs) → public/tts/<key>.mp3 (โมโน 24kbps) + src/ttsManifest.json (รายการ key ที่มีไฟล์)
   ใช้: python3 scripts/fetch-tts.py [--force] [--limit N]   · รันใน GitHub Actions (.github/workflows/fetch-tts.yml)
   ถ้าบริการใช้ไม่ได้ ไฟล์ที่มีอยู่ยังใช้ได้ และแอปถอยไปใช้เสียงเครื่องเองสำหรับข้อความที่ไม่มีไฟล์"""
import asyncio, json, os, subprocess, sys, tempfile, time
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "tts")
MANIFEST = os.path.join(ROOT, "src", "ttsManifest.json")
FORCE = "--force" in sys.argv
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
CONCURRENCY = 4
os.makedirs(OUT, exist_ok=True)
items = json.load(open(os.path.join(ROOT, "scripts", "tts-list.json"), encoding="utf-8"))
have = set(json.load(open(MANIFEST, encoding="utf-8"))) if os.path.exists(MANIFEST) else set()
todo = [i for i in items if FORCE or i["key"] not in have or not os.path.exists(os.path.join(OUT, i["key"] + ".mp3"))]
if LIMIT: todo = todo[:LIMIT]
print(f"ทั้งหมด {len(items)} · มีแล้ว {len(items) - len(todo)} · ต้องสร้าง {len(todo)}")
ok, failed = 0, []
sem = asyncio.Semaphore(CONCURRENCY)
CHECKPOINT = 400   # ใน CI: commit+push ทุกๆ N ไฟล์ กันงานหายถ้า job หมดเวลา

def write_manifest():
    keys = {i["key"] for i in items}
    present = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".mp3") and f[:-4] in keys)
    json.dump(present, open(MANIFEST, "w", encoding="utf-8"), separators=(",", ":"))
    return present

def checkpoint(msg):
    if not os.environ.get("GITHUB_ACTIONS"): return
    write_manifest()
    try:
        subprocess.run(["git", "add", "public/tts", "src/ttsManifest.json"], cwd=ROOT, check=True)
        if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0: return
        subprocess.run(["git", "commit", "-q", "-m", msg], cwd=ROOT, check=True)
        ref = os.environ.get("GITHUB_REF_NAME", "")
        subprocess.run(["git", "pull", "--rebase", "--autostash", "-q", "origin", ref], cwd=ROOT, check=True)
        subprocess.run(["git", "push", "-q", "origin", f"HEAD:{ref}"], cwd=ROOT, check=True)
        print(f"  ✓ checkpoint pushed ({msg})", flush=True)
    except Exception as e:  # noqa
        print(f"  checkpoint failed: {e}", flush=True)

async def one(it):
    global ok
    async with sem:
        tmp = os.path.join(tempfile.gettempdir(), f"tts-{it['key']}.mp3")
        for attempt in range(3):
            try:
                # rate ช้าลงเล็กน้อยสำหรับเด็ก
                await edge_tts.Communicate(it["text"], it["voice"], rate="-8%").save(tmp)
                if os.path.getsize(tmp) < 500: raise RuntimeError("empty audio")
                dst = os.path.join(OUT, it["key"] + ".mp3")
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp,
                                "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.1",
                                "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "24k", dst], check=True)
                os.remove(tmp); ok += 1
                if ok % 50 == 0: print(f"  … {ok} ไฟล์", flush=True)
                if ok % CHECKPOINT == 0: checkpoint(f"TTS checkpoint: {ok} clips")
                return
            except Exception as e:  # noqa
                err = e; await asyncio.sleep(2 * (attempt + 1))
        failed.append(f"{it['key']} {it['text'][:40]}: {err}")

async def main():
    t0 = time.time()
    await asyncio.gather(*(one(it) for it in todo))
    print(f"สร้างใหม่ {ok} · ล้มเหลว {len(failed)} · {time.time() - t0:.0f} วิ")
asyncio.run(main())

# manifest = key ที่มีไฟล์จริง (ลบไฟล์ของข้อความที่ไม่ใช้แล้ว)
keys = {i["key"] for i in items}
for f in os.listdir(OUT):
    if f.endswith(".mp3") and f[:-4] not in keys: os.remove(os.path.join(OUT, f))
present = write_manifest()
total = sum(os.path.getsize(os.path.join(OUT, k + ".mp3")) for k in present)
print(f"รวมมีเสียง {len(present)}/{len(items)} · {total / 1e6:.1f} MB")
if failed: print("\n".join(failed[:40]))

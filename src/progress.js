// ═══════════════════════════════════════════════════════
// PROGRESS STORE — ดาว / เหรียญ / สติกเกอร์ / streak / เพื่อนคู่หู
// เก็บใน localStorage · ใช้ไม่ได้ก็ยังเล่นได้ (แค่ไม่จำ)
// ═══════════════════════════════════════════════════════
const KEY = "smart-vocabplay:progress:v1";

export const EMPTY_PROGRESS = {
  coins: 0,            // เหรียญสะสม
  stars: {},           // { "cat:game": 0..3 } ดาวสูงสุดต่อเกม
  stickers: {},        // { wordId: จำนวนครั้งที่ตอบถูก } ปลดล็อกเมื่อถึง STICKER_NEED
  mistakes: {},        // { wordId: จำนวนครั้งที่พลาด } ใช้ทำ "ทบทวนคำที่พลาด"
  streak: { last: null, count: 0 },
  boss: {},            // { catId: true } ชนะบอสแล้ว
  pet: null,           // id ของเพื่อนคู่หู
  totalCorrect: 0,     // XP ของเพื่อนคู่หู
  games: 0,
};

export const STICKER_NEED = 3;

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_PROGRESS };
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return { ...EMPTY_PROGRESS };
    return { ...EMPTY_PROGRESS, ...d, streak: { ...EMPTY_PROGRESS.streak, ...(d.streak || {}) } };
  } catch (_) {
    return { ...EMPTY_PROGRESS };
  }
}

export function saveProgress(p) {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch (_) {}
}

const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => fmt(new Date());

// เรียกตอนเปิดแอป: วันนี้เล่นแล้ว = ไม่เปลี่ยน · เมื่อวานเล่น = +1 · ขาดช่วง = เริ่ม 1
export function bumpStreak(p) {
  const t = today();
  if (p.streak.last === t) return p;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const count = p.streak.last === fmt(y) ? p.streak.count + 1 : 1;
  return { ...p, streak: { last: t, count } };
}

export function starsFor(score, total) {
  if (!total || score <= 0) return 0;
  const r = score / total;
  return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
}
export const starsByWrong = w => (w <= 1 ? 3 : w <= 3 ? 2 : 1);

// ── เพื่อนคู่หู ──
export const PETS = [
  { id: "cat",    name: "มิว",  stages: ["🥚", "🐱", "😺", "😻"] },
  { id: "dog",    name: "บ๊อบ", stages: ["🥚", "🐶", "🐕", "🦮"] },
  { id: "bunny",  name: "ปุย",  stages: ["🥚", "🐰", "🐇", "🐰"] },
  { id: "dragon", name: "ไฟ",   stages: ["🥚", "🐲", "🐉", "🐉"] },
];
// XP (จำนวนข้อที่ตอบถูกสะสม) ที่ต้องถึงในแต่ละเลเวล
export const LEVELS = [0, 15, 40, 80, 140, 220, 320, 450, 600, 800];

export function petLevel(xp) {
  let l = 1;
  LEVELS.forEach((t, i) => { if (xp >= t) l = i + 1; });
  return l;
}
export function getPet(p) {
  const def = PETS.find(x => x.id === p.pet) || null;
  const xp = p.totalCorrect || 0;
  const level = petLevel(xp);
  const stage = level <= 1 ? 0 : level <= 3 ? 1 : level <= 6 ? 2 : 3;
  const next = LEVELS[level] ?? null;           // XP เลเวลถัดไป (null = ตัน)
  const prev = LEVELS[level - 1] ?? 0;
  const pct = next == null ? 100 : Math.round(((xp - prev) / (next - prev)) * 100);
  return def ? { ...def, emoji: def.stages[stage], level, stage, xp, next, pct } : null;
}

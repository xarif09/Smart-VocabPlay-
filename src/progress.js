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
  srs: {},             // { wordId: { box, due:"YYYY-MM-DD", seen } } ทบทวนแบบเว้นระยะ
  daily: { date: null, counters: {}, claimed: {} },
  owned: {},           // { itemId: true } ของที่ซื้อแล้ว
  hat: null,           // itemId หมวกที่ใส่อยู่
  bg: null,            // itemId พื้นหลังการ์ดเพื่อน
  learned: {},         // { wordId: true } เปิดการ์ดเรียนแล้ว
};

export const STICKER_NEED = 3;

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_PROGRESS };
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return { ...EMPTY_PROGRESS };
    return { ...EMPTY_PROGRESS, ...d, streak: { ...EMPTY_PROGRESS.streak, ...(d.streak || {}) }, daily: { ...EMPTY_PROGRESS.daily, ...(d.daily || {}) } };
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

// ═══════════════════════════════════════════════════════
// SRS — ทบทวนแบบเว้นระยะ (แบบ Anki/Leitner) · box 0..5 → เว้น 0,1,3,7,14,30 วัน
// ═══════════════════════════════════════════════════════
export const SRS_DAYS = [0, 1, 3, 7, 14, 30];
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
export function srsCorrect(srs, id) {
  const cur = srs[id] || { box: 0 };
  const box = Math.min(SRS_DAYS.length - 1, (cur.box || 0) + 1);
  return { ...srs, [id]: { box, due: addDays(SRS_DAYS[box]), seen: (cur.seen || 0) + 1 } };
}
export function srsWrong(srs, id) {
  const cur = srs[id] || {};
  return { ...srs, [id]: { box: 0, due: today(), seen: (cur.seen || 0) + 1 } };
}
export const isDue = (srs, id) => { const s = srs[id]; return !!s && s.due <= today(); };
export const isMastered = (srs, id) => (srs[id]?.box || 0) >= 3;

// ═══════════════════════════════════════════════════════
// DAILY MISSIONS — สุ่ม 3 ภารกิจต่อวัน (คงที่ตลอดวัน) · สำเร็จรับเหรียญ
// ═══════════════════════════════════════════════════════
export const MISSION_POOL = [
  { id: "games3",   label: "เล่นเกมให้จบ 3 รอบ",        key: "games",   goal: 3,  reward: 30 },
  { id: "correct20",label: "ตอบถูก 20 ข้อ",             key: "correct", goal: 20, reward: 30 },
  { id: "cards10",  label: "เรียนการ์ดคำศัพท์ 10 ใบ",   key: "cards",   goal: 10, reward: 30 },
  { id: "stars5",   label: "เก็บดาว 5 ดวง",             key: "stars",   goal: 5,  reward: 40 },
  { id: "review1",  label: "ทบทวนวันนี้ให้จบ 1 รอบ",    key: "review",  goal: 1,  reward: 40 },
  { id: "speak1",   label: "ฝึกพูดตาม 1 รอบ",           key: "speak",   goal: 1,  reward: 40 },
  { id: "sentence1",label: "เรียงประโยค 1 รอบ",         key: "sentence",goal: 1,  reward: 30 },
  { id: "stickers2",label: "ได้สติกเกอร์ใหม่ 2 ใบ",     key: "stickers",goal: 2,  reward: 50 },
];
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function missionsForDate(date) {
  const pool = [...MISSION_POOL]; const out = []; let h = hash(date);
  while (out.length < 3 && pool.length) { h = (h * 1103515245 + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  return out;
}
export const EMPTY_DAILY = { date: null, counters: {}, claimed: {} };
export function ensureDaily(p) {
  const d = p.daily && p.daily.date === today() ? p.daily : { ...EMPTY_DAILY, date: today() };
  return d === p.daily ? p : { ...p, daily: d };
}
export function bumpDaily(p, key, n = 1) {
  const q = ensureDaily(p);
  return { ...q, daily: { ...q.daily, counters: { ...q.daily.counters, [key]: (q.daily.counters[key] || 0) + n } } };
}

// ═══════════════════════════════════════════════════════
// SHOP — ของแต่งเพื่อนคู่หู ซื้อด้วยเหรียญ
// ═══════════════════════════════════════════════════════
export const SHOP_ITEMS = [
  { id: "cap",     type: "hat",   emoji: "🧢", name: "หมวกแก๊ป",   cost: 80 },
  { id: "bow",     type: "hat",   emoji: "🎀", name: "โบว์",        cost: 100 },
  { id: "tophat",  type: "hat",   emoji: "🎩", name: "หมวกสูง",     cost: 150 },
  { id: "grad",    type: "hat",   emoji: "🎓", name: "หมวกบัณฑิต",  cost: 200 },
  { id: "crown",   type: "hat",   emoji: "👑", name: "มงกุฎ",       cost: 400 },
  { id: "party",   type: "hat",   emoji: "🥳", name: "หมวกปาร์ตี้", cost: 120 },
  { id: "bgSky",   type: "bg",    emoji: "🌤️", name: "ท้องฟ้า",     cost: 120, css: "linear-gradient(135deg,#e0f2fe,#bae6fd)" },
  { id: "bgForest",type: "bg",    emoji: "🌳", name: "ป่าไม้",      cost: 120, css: "linear-gradient(135deg,#dcfce7,#bbf7d0)" },
  { id: "bgCandy", type: "bg",    emoji: "🍭", name: "ลูกกวาด",     cost: 150, css: "linear-gradient(135deg,#fce7f3,#fbcfe8,#fef3c7)" },
  { id: "bgSpace", type: "bg",    emoji: "🌌", name: "อวกาศ",       cost: 250, css: "linear-gradient(135deg,#1e1b4b,#4c1d95)" },
];

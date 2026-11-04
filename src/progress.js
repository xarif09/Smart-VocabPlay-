// ═══════════════════════════════════════════════════════
// PROGRESS STORE — ดาว / เหรียญ / สติกเกอร์ / streak / เพื่อนคู่หู
// เก็บใน localStorage · ใช้ไม่ได้ก็ยังเล่นได้ (แค่ไม่จำ)
// ═══════════════════════════════════════════════════════
const KEY = "smart-vocabplay:progress:v1";

export const EMPTY_PROGRESS = {
  history: {},         // { "YYYY-MM-DD": { correct, games, cards, stars, stickers, ... } } ย้อนหลังสำหรับสรุปรายสัปดาห์ (เก็บ 60 วัน)
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
  outfit: [],          // itemId ชุดแต่งตัวที่ใส่อยู่ (หลายชิ้น)
  bg: null,            // itemId พื้นหลังการ์ดเพื่อน
  theme: null,         // ธีมแอป (aurora/ocean/forest/sunset/space/candy)
  learned: {},         // { wordId: true } เปิดการ์ดเรียนแล้ว
  care: null,          // ห้องเพื่อนคู่หู (hunger/clean/fun/energy/...)
  room: {},            // { itemId: true } เฟอร์นิเจอร์ที่ซื้อ
  roomOn: {},          // { slot: itemId } ที่วางอยู่
  path: {},            // { unitId: { learn:true, quiz:true, listen:true } } เส้นทางบทเรียน
};

// ═══════════════════════════════════════════════════════
// PROFILES — หลายคนใช้เครื่องเดียวกัน · โปรไฟล์แรก (p1) ใช้ key เดิม ข้อมูลเก่าไม่หาย
// ═══════════════════════════════════════════════════════
const PKEY = "smart-vocabplay:profiles:v1";
export const AVATARS = ["🧒", "👧", "👦", "👶", "🧑", "🐵", "🦊", "🐼", "🦄", "🐯"];
const DEFAULT_PROFILES = { list: [{ id: "p1", name: "หนู", avatar: "🧒" }], current: "p1" };
export function loadProfiles() {
  try {
    const raw = window.localStorage.getItem(PKEY);
    if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.list) && d.list.length && d.list.some(x => x.id === d.current)) return d; }
  } catch (_) {}
  return { ...DEFAULT_PROFILES, list: [...DEFAULT_PROFILES.list] };
}
export function saveProfiles(p) { try { window.localStorage.setItem(PKEY, JSON.stringify(p)); } catch (_) {} }
const progKey = id => (!id || id === "p1" ? KEY : `${KEY}:${id}`);
export function deleteProgress(id) { try { window.localStorage.removeItem(progKey(id)); } catch (_) {} }

export const STICKER_NEED = 3;

export function loadProgress(profileId = "p1") {
  try {
    const raw = window.localStorage.getItem(progKey(profileId));
    if (!raw) return { ...EMPTY_PROGRESS };
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return { ...EMPTY_PROGRESS };
    return { ...EMPTY_PROGRESS, ...d, streak: { ...EMPTY_PROGRESS.streak, ...(d.streak || {}) }, daily: { ...EMPTY_PROGRESS.daily, ...(d.daily || {}) } };
  } catch (_) {
    return { ...EMPTY_PROGRESS };
  }
}

export function saveProgress(p, profileId = "p1") {
  try { window.localStorage.setItem(progKey(profileId), JSON.stringify(p)); } catch (_) {}
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
  { id: "panda",  name: "ปังปัง", stages: ["🥚", "🐼", "🐼", "🐼"] },
  { id: "fox",    name: "จิ้ง",  stages: ["🥚", "🦊", "🦊", "🦊"] },
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
  { id: "dialog1",  label: "เล่นบทสนทนา 1 บท",         key: "dialog",  goal: 1,  reward: 40 },
  { id: "story1",   label: "อ่านนิทานจบ 1 เรื่อง",     key: "story",   goal: 1,  reward: 40 },
  { id: "phonics1", label: "เล่นเกมเสียงแรก 1 รอบ",    key: "phonics", goal: 1,  reward: 30 },
  { id: "grammar1", label: "ฝึกไวยากรณ์ 1 บท",         key: "grammar", goal: 1,  reward: 40 },
  { id: "daily1",   label: "เล่นเกมชีวิตประจำวัน 1 รอบ", key: "daily",  goal: 1,  reward: 30 },
  { id: "care2",    label: "ดูแลเพื่อนคู่หู 2 ครั้ง",   key: "care",    goal: 2,  reward: 30 },
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
  const t = today(); const h = { ...(q.history || {}) }; h[t] = { ...(h[t] || {}), [key]: ((h[t] || {})[key] || 0) + n };
  const keys = Object.keys(h).sort(); while (keys.length > 60) delete h[keys.shift()];   // เก็บแค่ 60 วัน
  return { ...q, history: h, daily: { ...q.daily, counters: { ...q.daily.counters, [key]: (q.daily.counters[key] || 0) + n } } };
}
// สถิติ 7 วันล่าสุด (วันนี้อยู่ท้ายสุด) · ใช้ทำสรุปรายสัปดาห์ให้ผู้ปกครอง
export function weekStats(p, days = 7) {
  const out = []; const h = p.history || {};
  for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = fmt(d); const r = h[k] || {}; out.push({ date: k, dow: d.getDay(), correct: r.correct || 0, games: r.games || 0, cards: r.cards || 0, stars: r.stars || 0, stickers: r.stickers || 0, active: !!h[k] }); }
  return out;
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
  // ชุดแต่งตัว (วาดใน Pet.jsx OUTFIT) · type "outfit" ใส่ได้หลายชิ้น (เก็บใน progress.outfit[])
  { id: "tee",      type: "outfit", emoji: "👕", name: "เสื้อยืด A+",   cost: 120 },
  { id: "hoodie",   type: "outfit", emoji: "🧥", name: "เสื้อฮู้ดม่วง", cost: 180 },
  { id: "dress",    type: "outfit", emoji: "👗", name: "ชุดเดรสชมพู",  cost: 180 },
  { id: "suit",     type: "outfit", emoji: "🤵", name: "สูทหล่อ",       cost: 250 },
  { id: "scarf",    type: "outfit", emoji: "🧣", name: "ผ้าพันคอแดง",  cost: 100 },
  { id: "glasses",  type: "outfit", emoji: "👓", name: "แว่นนักเรียน", cost: 120 },
  { id: "shades",   type: "outfit", emoji: "🕶️", name: "แว่นกันแดดเท่", cost: 160 },
  { id: "necklace", type: "outfit", emoji: "📿", name: "สร้อยทอง",      cost: 200 },
  { id: "backpack", type: "outfit", emoji: "🎒", name: "กระเป๋านักเรียน", cost: 150 },
  { id: "book",     type: "outfit", emoji: "📘", name: "หนังสือคู่ใจ",  cost: 120 },
  { id: "balloon",  type: "outfit", emoji: "🎈", name: "ลูกโป่งแดง",   cost: 100 },
  { id: "wand",     type: "outfit", emoji: "🪄", name: "ไม้กายสิทธิ์", cost: 300 },
  { id: "cape",     type: "outfit", emoji: "🦸", name: "ผ้าคลุมฮีโร่", cost: 350 },
  { id: "wings",    type: "outfit", emoji: "🪽", name: "ปีกนางฟ้า",     cost: 450 },
  // ธีมทั้งแอป (CSS อยู่ใน index.html [data-theme=...])
  { id: "aurora", type: "theme", emoji: "🌈", name: "ออโรรา (เริ่มต้น)", cost: 0,   preview: "linear-gradient(135deg,#6d5dfc,#a855f7,#ff6fae)" },
  { id: "ocean",  type: "theme", emoji: "🌊", name: "ท้องทะเล",      cost: 300, preview: "linear-gradient(135deg,#0ea5e9,#06b6d4,#34d399)" },
  { id: "forest", type: "theme", emoji: "🌿", name: "ป่าเขียว",      cost: 300, preview: "linear-gradient(135deg,#16a34a,#84cc16,#facc15)" },
  { id: "sunset", type: "theme", emoji: "🌇", name: "พระอาทิตย์ตก",  cost: 350, preview: "linear-gradient(135deg,#f43f5e,#fb923c,#facc15)" },
  { id: "space",  type: "theme", emoji: "🚀", name: "อวกาศ (โหมดมืด)", cost: 500, preview: "linear-gradient(135deg,#0f172a,#312e81,#7c3aed)" },
  { id: "candy",  type: "theme", emoji: "🍭", name: "ลูกกวาด",       cost: 300, preview: "linear-gradient(135deg,#f472b6,#c084fc,#67e8f9)" },
];

// ═══════════════════════════════════════════════════════
// LEARNING PATH — เส้นทางบทเรียน (แบบ Duolingo) บทละ ~8 คำ · 3 ขั้น เรียน→Quiz→ฟัง
// ปลดล็อกทีละบท · ป้ายระดับ A1 / A1+ / A2 ตามลำดับบท
// ═══════════════════════════════════════════════════════
export const UNIT_STEPS = ["learn", "quiz", "listen"];
export function buildUnits(words, categories) {
  const units = [];
  categories.forEach(c => {
    const ws = words.filter(w => w.cat === c.id);
    for (let i = 0; i < ws.length; i += 8) {
      const chunk = ws.slice(i, i + 8);
      const last = units[units.length - 1];
      if (chunk.length < 4 && last && last.cat.id === c.id) { last.words = [...last.words, ...chunk]; continue; }
      units.push({ id: `${c.id}-${Math.floor(i / 8) + 1}`, cat: c, words: chunk });
    }
  });
  units.forEach((u, i) => { u.n = i + 1; u.level = i < 12 ? "A1" : i < 26 ? "A1+" : "A2"; });
  return units;
}
export const unitDone = (path, u) => UNIT_STEPS.every(s => path?.[u.id]?.[s]);
export const unitSteps = (path, u) => UNIT_STEPS.filter(s => path?.[u.id]?.[s]).length;
export function markUnitStep(p, unitId, step) {
  return { ...p, path: { ...(p.path || {}), [unitId]: { ...((p.path || {})[unitId] || {}), [step]: true } } };
}

// ความคล้ายของคำ 0..1 (ใช้ให้คะแนน Speak) — Levenshtein
export function similarity(a, b) {
  a = (a || "").toLowerCase().replace(/[^a-z]/g, ""); b = (b || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!a.length || !b.length) return 0;
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

// ═══════════════════════════════════════════════════════
// PET CARE — ห้องเพื่อนคู่หู: ค่าสถานะ 4 อย่าง (0–100) ลดตามเวลาจริง
//  hunger ลด 4/ชม · clean ลด 2/ชม · fun ลด 3/ชม · energy ลด 3/ชม (ตื่น) · นอนคืน +25/ชม
//  ดูแลได้เหรียญเล็กน้อย + ความสุข (happiness) ส่งผลให้เพื่อนยิ้ม/เศร้า
// ═══════════════════════════════════════════════════════
export const CARE_MAX = 100;
export const EMPTY_CARE = { hunger: 80, clean: 80, fun: 80, energy: 80, sleeping: false, last: Date.now(), fedToday: 0, streakCare: 0, lastCareDay: null };
export function tickCare(care) {
  const c = { ...EMPTY_CARE, ...(care || {}) };
  const h = Math.max(0, (Date.now() - (c.last || Date.now())) / 3600000);
  if (h < 0.01) return c;
  const dec = (v, r) => Math.max(0, Math.min(CARE_MAX, v - r * h));
  const n = { ...c, hunger: dec(c.hunger, 4), clean: dec(c.clean, 2), fun: dec(c.fun, 3), last: Date.now() };
  n.energy = c.sleeping ? Math.min(CARE_MAX, c.energy + 25 * h) : dec(c.energy, 3);
  if (n.sleeping && n.energy >= CARE_MAX) n.sleeping = false;
  return n;
}
export const careMood = c => { const avg = (c.hunger + c.clean + c.fun + c.energy) / 4; return c.sleeping ? "sleepy" : avg >= 75 ? "happy" : avg >= 40 ? "idle" : "sad"; };
export const CARE_ACTIONS = [
  { id: "feed",  emoji: "🍎", label: "ให้อาหาร", stat: "hunger", gain: 30, cost: 5,  en: "Yummy! Thank you!", th: "อร่อยจัง ขอบคุณนะ", anim: "eat" },
  { id: "wash",  emoji: "🛁", label: "อาบน้ำ",   stat: "clean",  gain: 40, cost: 0,  en: "Splash splash! I'm clean!", th: "สะอาดแล้ว!", anim: "wash" },
  { id: "play",  emoji: "⚽", label: "เล่นด้วย",  stat: "fun",    gain: 35, cost: 0,  en: "Let's play! This is fun!", th: "สนุกจัง!", anim: "play", energyCost: 10 },
  { id: "sleep", emoji: "🌙", label: "นอน",      stat: "energy", gain: 0,  cost: 0,  en: "Good night...", th: "ราตรีสวัสดิ์", anim: "sleep" },
];
export const FOODS = [
  { id: "apple",  emoji: "🍎", name: "แอปเปิล", cost: 5,  gain: 20, en: "apple" },
  { id: "banana", emoji: "🍌", name: "กล้วย",   cost: 5,  gain: 20, en: "banana" },
  { id: "rice",   emoji: "🍚", name: "ข้าว",    cost: 8,  gain: 30, en: "rice" },
  { id: "pizza",  emoji: "🍕", name: "พิซซ่า",  cost: 12, gain: 40, en: "pizza" },
  { id: "cake",   emoji: "🎂", name: "เค้ก",    cost: 15, gain: 50, en: "cake" },
  { id: "milk",   emoji: "🥛", name: "นม",      cost: 6,  gain: 25, en: "milk" },
];
export const ROOM_ITEMS = [
  { id: "rug",     emoji: "🟪", name: "พรมม่วง",     cost: 80,  slot: "floor" },
  { id: "rugStar", emoji: "⭐", name: "พรมดาว",       cost: 150, slot: "floor" },
  { id: "bed",     emoji: "🛏️", name: "เตียงนุ่ม",     cost: 200, slot: "left" },
  { id: "plant",   emoji: "🪴", name: "ต้นไม้",        cost: 90,  slot: "right" },
  { id: "lamp",    emoji: "🛋️", name: "โซฟา",          cost: 220, slot: "left" },
  { id: "shelf",   emoji: "📚", name: "ชั้นหนังสือ",   cost: 160, slot: "right" },
  { id: "window",  emoji: "🪟", name: "หน้าต่าง",      cost: 120, slot: "wall" },
  { id: "picture", emoji: "🖼️", name: "รูปภาพ",        cost: 100, slot: "wall" },
  { id: "tv",      emoji: "📺", name: "ทีวี",          cost: 260, slot: "wall" },
  { id: "toybox",  emoji: "🧸", name: "กล่องของเล่น", cost: 140, slot: "right" },
  { id: "aquarium",emoji: "🐠", name: "ตู้ปลา",        cost: 300, slot: "left" },
  { id: "balloons",emoji: "🎈", name: "ลูกโป่ง",       cost: 70,  slot: "ceiling" },
  { id: "lights",  emoji: "✨", name: "ไฟประดับ",      cost: 180, slot: "ceiling" },
];

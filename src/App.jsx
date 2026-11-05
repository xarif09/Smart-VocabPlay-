import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, lazy, Suspense } from "react";
import { imageTitleOf, cachedImageUrl, fetchImageUrl, wikiPageUrl, bundledCount, bundledImageUrl } from "./images.js";
const Runner3D = lazy(() => import("./Runner3D.jsx"));   // three.js โหลดเฉพาะตอนเปิดเกม 3D
import { DIALOGUES, STORIES, PHONICS, GRAMMAR, DAYS, MONTHS, MONEY, numberWord, numberThai, timeWord, timeThai, LEVELS_TEST } from "./content.js";
import { loadProgress, saveProgress, bumpStreak, starsFor, starsByWrong, STICKER_NEED, PETS, getPet, petLevel, EMPTY_PROGRESS,
  srsCorrect, srsWrong, isDue, isMastered, missionsForDate, ensureDaily, bumpDaily, EMPTY_DAILY, SHOP_ITEMS, today, weekStats,
  tickCare, careMood, CARE_ACTIONS, CARE_MAX, FOODS, ROOM_ITEMS,
  loadProfiles, saveProfiles, deleteProgress, AVATARS, buildUnits, UNIT_STEPS, unitDone, unitSteps, markUnitStep, similarity } from "./progress.js";
import { lexOf } from "./lexicon.js";
import { sfx, unlockSfx, setSfxEnabled, startMusic, stopMusic } from "./sfx.js";
import { fx, fxPoint, setFxEnabled, installRipple, Ambient, Reveal, CountUp } from "./fx.jsx";
import Pet, { PET_CSS } from "./Pet.jsx";
import { CatIcon, GameIcon, hasGameIcon } from "./Icons.jsx";
import audioManifest from "./audioManifest.json";
import ttsManifest from "./ttsManifest.json";
import { conceptFor, CONCEPT_WORDS } from "./Concept.jsx";
import qrcode from "qrcode-generator";
import { encodeSet, decodeSet, setLink, readIncomingSet } from "./share.js";
import { MD, M3, TYPE, HFONT, WFONT, Shape, M3Switch, M3NavBar, M3TopBar, M3Sheet, WavyProgress, ButtonGroup, applyM3Theme, injectM3Css, isDarkTheme } from "./m3.jsx";

// ═══════════════════════════════════════════════════════
// SPEECH ENGINE — iOS-safe
// ═══════════════════════════════════════════════════════
// iOS Safari rules:
// 1. speechSynthesis.speak() MUST be called synchronously inside a user gesture
// 2. Voices may not load until after first speak attempt
// 3. cancel() + immediate speak() can drop speech — use 50ms gap

// เลขเวอร์ชัน (จาก package.json) + เวลา build — โชว์บนหน้าแรก/ตั้งค่า เพื่อให้รู้ว่าเครื่องโหลดเวอร์ชันไหนอยู่
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
export const BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

// ═══════════════════════════════════════════════════════
// THEME "Aurora" — โทนร่วมสมัย: ฟอนต์ Prompt · พื้นหลังไล่สีนุ่ม · การ์ดมน 24px · เงาฟุ้ง · แถบนำทางล่างแบบแคปซูล
// ═══════════════════════════════════════════════════════
const FONT = "'Prompt', 'Noto Sans Thai', system-ui, -apple-system, sans-serif";
// โทเค็นดีไซน์ = Material 3 Expressive (ดู src/m3.jsx) · สีทั้งหมดเป็น CSS var เปลี่ยนตามธีม/โหมดมืด
const T = {
  ink: MD.onSurface, ink2: MD.onSurfaceV, ink3: MD.outline,
  bg: MD.surface, card: MD.surfLowest, surf: MD.surfLow, surfHigh: MD.surfHigh, surfHighest: MD.surfHighest,
  primary: MD.primary, onPrimary: MD.onPrimary, primaryC: MD.primaryC, onPrimaryC: MD.onPrimaryC,
  secondaryC: MD.secondaryC, onSecondaryC: MD.onSecondaryC, tertiaryC: MD.tertiaryC, onTertiaryC: MD.onTertiaryC,
  outlineV: MD.outlineV, error: MD.error, errorC: MD.errorC, onErrorC: MD.onErrorC, ok: MD.ok, okC: MD.okC, onOkC: MD.onOkC,
  tertiary: MD.tertiary, accent: MD.accent, inverse: MD.inverseSurface, onInverse: MD.inverseOnSurface,
  secondary: MD.secondary, onSecondary: MD.onSecondary, onTertiary: MD.onTertiary, onError: MD.onError,
  primaryEdge: MD.primaryEdge, secondaryEdge: MD.secondaryEdge, tertiaryEdge: MD.tertiaryEdge, okEdge: MD.okEdge, errorEdge: MD.errorEdge, cardBorder: MD.cardBorder, cardEdge: MD.cardEdge,
  grad: MD.heroGrad,
  grad2: MD.heroGrad,
  grad3: `linear-gradient(135deg, ${MD.tertiary}, ${MD.accent})`,
  shadow: "0 1px 2px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.05)",
  shadowLg: MD.shadow,
  r: 28, rs: 16,
};
// การ์ด M3 (filled): พื้น surfaceContainerLow มุม 28 ไม่มีเงา/เส้นขอบ
const card = (extra = {}) => ({ background:T.surf,borderRadius:T.r,color:T.ink,...extra });

let voices = [];
let audioUnlocked = false;

function loadVoices() {
  voices = window.speechSynthesis?.getVoices() || [];
}

// เลือกเสียงตามภาษา · ไทย: ชอบเสียงที่ชื่อมี Kanya (iOS) / Google / Thai / ไทย ก่อน แล้วค่อยเอาตัวแรกที่เจอ
function getVoice(langPrefix) {
  const list = voices.filter(v => (v.lang || "").toLowerCase().replace("_", "-").startsWith(langPrefix));
  if (!list.length) return null;
  const pref = ["kanya", "google", "ไทย", "thai", "narisa", "premwadee", "achara"];
  for (const k of pref) { const v = list.find(x => x.name.toLowerCase().includes(k)); if (v) return v; }
  return list.find(v => v.localService) || list[0];
}
export function voiceReport() {
  const th = voices.filter(v => (v.lang || "").toLowerCase().startsWith("th"));
  const en = voices.filter(v => (v.lang || "").toLowerCase().startsWith("en"));
  return { total: voices.length, th: th.map(v => v.name), en: en.length, thPick: getVoice("th")?.name || null };
}

// Call this INSIDE a click/touch handler to unlock audio on iOS
function unlockAudio() {
  if (audioUnlocked || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0.01;
    u.rate = 2;
    window.speechSynthesis.speak(u);
    audioUnlocked = true;
    loadVoices();
  } catch (_) {}
}

// Speak a single language utterance — call directly in onClick
function speakOne(text, lang, rate) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.volume = 1;
  u.pitch = 1;
  const v = getVoice(lang.split("-")[0]);
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// ── เสียงเจ้าของภาษา: ไฟล์ mp3 จาก Wikimedia Commons ใน public/audio/ (ดู scripts/fetch-audio.mjs)
//    มีไฟล์ → เล่นไฟล์ (อังกฤษ) แล้วต่อด้วยไทยจากเครื่อง · ไม่มี/เล่นไม่ได้ → ใช้เสียงเครื่องเหมือนเดิม
let nativeOn = true;
let curAudio = null;
function setNativeVoice(v) { nativeOn = !!v; }
export const nativeCount = () => Object.keys(audioManifest).length;
const audioUrlFor = en => { const f = audioManifest[(en || "").toLowerCase()]; return f ? `${import.meta.env.BASE_URL}audio/${f}` : null; };
// คำประสม (police car, ice skating, tuk-tuk) ที่ไม่มีไฟล์ของตัวเอง → ต่อเสียงคำเดี่ยวทุกคำ (ต้องมีครบทุกส่วน)
const audioUrlsFor = en => {
  const one = audioUrlFor(en); if (one) return [one];
  const parts = (en || "").toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const urls = parts.map(audioUrlFor); return urls.every(Boolean) ? urls : null;
};
export const hasNativeAudio = en => nativeOn && !!(audioUrlsFor(en) || clipUrl(en));
// ── เสียง neural (edge-tts) สำหรับประโยค/บทสนทนา/นิทาน/คำแปลไทย: public/tts/<fnv1a(text)>.mp3 (สร้างโดย workflow fetch-tts.yml)
const TTS_SET = new Set(ttsManifest);
const fnv1a = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const normTxt = s => (s || "").replace(/\s+/g, " ").trim();
function clipUrl(text) {
  if (!nativeOn || !text) return null;
  const t = normTxt(text); const title = t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  for (const cand of [t, title, t.toLowerCase()]) { const k = fnv1a(cand); if (TTS_SET.has(k)) return `${import.meta.env.BASE_URL}tts/${k}.mp3`; }
  return null;
}
export const ttsClipCount = () => ttsManifest.length;
// เล่นไฟล์เสียงต่อกันเป็นคิว · onStart(i) ก่อนเริ่มแต่ละไฟล์ · onDone เมื่อจบ/ล้มเหลว (ok=false)
function playClips(urls, { onStart, onDone, rate = 1 } = {}) {
  stopNative(); const token = {}; curAudio = token;
  const playAt = i => {
    if (curAudio !== token) return;
    if (i >= urls.length) { curAudio = null; onDone?.(true); return; }
    const a = new Audio(urls[i]); a.preload = "auto"; token.el = a;
    try { a.playbackRate = Math.min(1.1, Math.max(0.65, rate)); } catch (_) {}
    onStart?.(i);
    a.onended = () => playAt(i + 1);
    a.onerror = () => { if (curAudio === token) { curAudio = null; onDone?.(false, i); } };
    try { const p = a.play(); if (p && p.catch) p.catch(() => { if (curAudio === token) { curAudio = null; onDone?.(false, i); } }); } catch (_) { onDone?.(false, i); }
  };
  playAt(0);
}
// พูดไทย: มีไฟล์ neural → เล่นไฟล์ · ไม่มี → เสียงเครื่อง
function playThai(th, rate, onDone) {
  const u = clipUrl(th);
  if (!u) return speakThOnly(th, rate, onDone);
  const a = new Audio(u); curAudio = { el: a }; let d = false; const fin = () => { if (d) return; d = true; onDone?.(); };
  try { a.playbackRate = Math.min(1, Math.max(0.7, rate + 0.1)); } catch (_) {}
  a.onended = fin; a.onerror = () => { d = true; speakThOnly(th, rate, onDone); };
  try { const p = a.play(); if (p && p.catch) p.catch(() => { d = true; speakThOnly(th, rate, onDone); }); } catch (_) { speakThOnly(th, rate, onDone); }
}
// ── รอให้เสียง (ไฟล์ EN + ไทย) จบก่อนค่อยไปข้อถัดไป ──
//  เกมเรียก afterSpeech(fn, min, max): ถ้ากำลังพูดอยู่ รอจนจบ (ไม่เกิน max) · ถ้าไม่ได้พูด (ปิดเสียง) รอแค่ min
let speakingNow = false; let speechWaiters = []; let speechGen = 0;
function speechBegin() { speakingNow = true; return ++speechGen; }
// gen = รุ่นของการพูดที่จบ · ถ้ามีการพูดใหม่เริ่มไปแล้ว (gen ไม่ตรง) ไม่ถือว่าจบ (กัน utterance เก่ามาปลดล็อกก่อนเวลา)
function speechDone(gen) { if (gen !== undefined && gen !== speechGen) return; speakingNow = false; const w = speechWaiters; speechWaiters = []; w.forEach(f => f()); }
function afterSpeech(fn, min = 900, max = 5000) {
  const t0 = Date.now(); let fired = false;
  const go = () => { if (fired) return; fired = true; const wait = Math.max(0, min - (Date.now() - t0)); setTimeout(fn, wait); };
  if (!speakingNow) { setTimeout(go, min); return; }
  speechWaiters.push(go); setTimeout(go, max);
}
function stopNative() { if (curAudio) { try { const el = curAudio.el || curAudio; el.onended = null; el.pause?.(); } catch (_) {} curAudio = null; } }
function speakThOnly(th, rate, onDone) {
  if (!window.speechSynthesis || !th) { onDone?.(); return; }
  const u = new SpeechSynthesisUtterance(th); u.lang = "th-TH"; u.rate = rate; u.volume = 1;
  const v = getVoice("th"); if (v) u.voice = v;
  let done = false; const fin = () => { if (done) return; done = true; onDone?.(); };
  u.onend = fin; u.onerror = fin; setTimeout(fin, Math.max(1200, th.length * 140 / rate) + 400);   // กันเครื่องที่ไม่ยิง onend
  window.speechSynthesis.speak(u);
}

// Speak EN then TH — must be called from onClick
function speakWord(en, th, rate = 0.85, bilingual = true) {
  stopNative();
  const urls = nativeOn ? (audioUrlsFor(en) || (clipUrl(en) ? [clipUrl(en)] : null)) : null;
  if (urls) {
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    const token = {}; curAudio = token; const gen = speechBegin();
    const fallback = () => { if (curAudio !== token) return; curAudio = null; ttsWord(en, th, rate, bilingual); };
    const playAt = i => {
      if (curAudio !== token) return;
      if (i >= urls.length) { curAudio = null; if (bilingual && th) playThai(th, rate, () => speechDone(gen)); else speechDone(gen); return; }
      const a = new Audio(urls[i]); a.preload = "auto"; token.el = a;
      try { a.playbackRate = Math.min(1, Math.max(0.65, rate + 0.1)); } catch (_) {}
      a.onended = () => playAt(i + 1);
      a.onerror = fallback;
      try { const p = a.play(); if (p && p.catch) p.catch(fallback); } catch (_) { fallback(); }
    };
    playAt(0);
    return;
  }
  ttsWord(en, th, rate, bilingual);
}
// เสียงเครื่อง (Web Speech) อังกฤษ → ไทย
function ttsWord(en, th, rate = 0.85, bilingual = true) {
  if (!window.speechSynthesis) { speechDone(); return; }
  window.speechSynthesis.cancel(); const gen = speechBegin();

  setTimeout(() => {
    // English first
    const enU = new SpeechSynthesisUtterance(en);
    enU.lang = "en-US";
    enU.rate = rate;
    enU.volume = 1;
    enU.pitch = 1;
    const enV = getVoice("en");
    if (enV) enU.voice = enV;

    if (bilingual && th) {
      let thDone = false;
      const doThai = () => {
        if (thDone) return;
        thDone = true;
        playThai(th, rate, () => speechDone(gen));
      };
      enU.onend = doThai;
      // iOS sometimes doesn't fire onend — fallback timer
      const ms = Math.max(800, Math.ceil((en.length * 100) / rate));
      setTimeout(doThai, ms + 300);
    }

    if (!(bilingual && th)) { let d = false; const fin = () => { if (d) return; d = true; speechDone(gen); }; enU.onend = fin; enU.onerror = fin; setTimeout(fin, Math.max(900, en.length * 110 / rate) + 300); }
    window.speechSynthesis.speak(enU);
  }, 50); // 50ms gap after cancel() — iOS needs this
}

// ═══════════════════════════════════════════════════════
// VOCABULARY DATA — 300+ words
// ═══════════════════════════════════════════════════════
const CATEGORIES = [
  { id:"animals",  label:"Animals",  thai:"สัตว์",      emoji:"🦁", color:"#F59E0B", games:["habitat","quiz","spell","memory"] },
  { id:"fruits",   label:"Fruits",   thai:"ผลไม้",      emoji:"🍎", color:"#EF4444", games:["feed","quiz","spell","memory","speed"] },
  { id:"food",     label:"Food",     thai:"อาหาร",      emoji:"🍕", color:"#F97316", games:["feed","quiz","spell","memory"] },
  { id:"colors",   label:"Colors",   thai:"สี",         emoji:"🎨", color:"#8B5CF6", games:["colormix","quiz","match"] },
  { id:"school",   label:"School",   thai:"โรงเรียน",   emoji:"🎒", color:"#3B82F6", games:["quiz","spell","memory"] },
  { id:"body",     label:"Body",     thai:"ร่างกาย",    emoji:"👁️", color:"#EC4899", games:["bodydr","quiz"] },
  { id:"weather",  label:"Weather",  thai:"อากาศ",      emoji:"🌈", color:"#06B6D4", games:["dress","quiz"] },
  { id:"numbers",  label:"Numbers",  thai:"ตัวเลข",     emoji:"🔢", color:"#10B981", games:["count","quiz"] },
  { id:"vehicles", label:"Vehicles", thai:"ยานพาหนะ",   emoji:"🚗", color:"#6366F1", games:["runner","quiz","spell","memory"] },
  { id:"jobs",     label:"Jobs",     thai:"อาชีพ",      emoji:"👨‍⚕️",color:"#14B8A6", games:["quiz","memory"] },
  { id:"clothes",  label:"Clothes",  thai:"เสื้อผ้า",   emoji:"👕", color:"#D946EF", games:["quiz","spell","memory"] },
  { id:"home",     label:"Home",     thai:"ของในบ้าน",  emoji:"🏠", color:"#84CC16", games:["quiz","spell","memory"] },
  { id:"nature",   label:"Nature",   thai:"ธรรมชาติ",   emoji:"🌿", color:"#22C55E", games:["quiz","memory","speed"] },
  { id:"sports",   label:"Sports",   thai:"กีฬา",       emoji:"⚽", color:"#60A5FA", games:["quiz","memory","speed"] },
  { id:"family",   label:"Family",   thai:"ครอบครัว",   emoji:"👨‍👩‍👧", color:"#FB7185", games:["quiz","memory","speed"] },
  { id:"actions",  label:"Actions",  thai:"กริยา",      emoji:"🏃", color:"#F472B6", games:["quiz","spell","memory"] },
  { id:"feelings", label:"Feelings", thai:"ความรู้สึก", emoji:"😊", color:"#FBBF24", games:["quiz","memory","speed"] },
  { id:"shapes",   label:"Shapes",   thai:"รูปทรง",     emoji:"🔺", color:"#A78BFA", games:["quiz","spell","memory"] },
  { id:"toys",     label:"Toys",     thai:"ของเล่น",    emoji:"🧸", color:"#F59E0B", games:["quiz","spell","memory","speed"] },
  { id:"places",   label:"Places",   thai:"สถานที่",    emoji:"🏫", color:"#2DD4BF", games:["quiz","spell","memory","speed"] },

  { id:"vegetables", label:"Vegetables", thai:"ผัก",          emoji:"🥦", color:"#65A30D", games:["feed","quiz","spell","memory","speed"] },
  { id:"technology", label:"Technology", thai:"เทคโนโลยี",     emoji:"📱", color:"#0EA5E9", games:["quiz","spell","memory"] },
  { id:"music",      label:"Music",      thai:"ดนตรี",         emoji:"🎵", color:"#D946EF", games:["quiz","memory","speed"] },
  { id:"opposites",  label:"Opposites",  thai:"คำตรงข้าม",     emoji:"↔️", color:"#F97316", games:["quiz","memory","speed"] },
  { id:"time",       label:"Time",       thai:"วัน เดือน เวลา", emoji:"📅", color:"#0891B2", games:["quiz","spell","memory"] },
  { id:"countries",  label:"Countries",  thai:"ประเทศ",        emoji:"🌍", color:"#16A34A", games:["quiz","memory","speed"] },
];

// หมวดพิเศษ "ทบทวนคำที่พลาด" (ไม่อยู่ในตารางหมวด)
const REVIEW_CAT = { id:"review", label:"ทบทวนคำที่พลาด", thai:"ทบทวน", emoji:"🔁", color:"#F97316", games:["quiz"] };

// เกมเสริมที่ทุกหมวดมี (ฟัง / เรียงประโยค / พูดตาม)
const EXTRA_GAMES = ["runner", "listen", "sentence", "speak", "mole", "balloon", "ninja", "bingo"];
CATEGORIES.forEach(c => { c.games.push(...EXTRA_GAMES); c.games = [...new Set(c.games)]; });   // เกมเฉพาะหมวดอยู่หน้าเสมอ

// รูปปกหมวด = คำเสมือน { cat:"cover", word:<id> } → ดึงรูปจาก images.js key "cover|<id>"
// สีประจำหมวด (สด + ขอบนูน) · v3.16
const ACCENTS = { orange:["#FF9F1C","#D97F00","#fff"], red:["#FF5A5F","#D63E44","#fff"], purple:["#9B5CFF","#7539E0","#fff"], blue:["#2F8CFF","#1E6FD6","#fff"],
  pink:["#FF5FA2","#D9407F","#fff"], cyan:["#12B5D6","#0A8FAD","#fff"], green:["#2EBD59","#20994A","#fff"], yellow:["#FFC531","#E0A200","#3A2A00"] };
const CAT_ACCENT = { animals:"orange", food:"orange", toys:"orange", opposites:"orange", fruits:"red", family:"red", colors:"purple", shapes:"purple",
  school:"blue", sports:"blue", vehicles:"blue", body:"pink", clothes:"pink", music:"pink", actions:"pink", weather:"cyan", technology:"cyan", time:"cyan", places:"cyan",
  numbers:"green", nature:"green", home:"green", vegetables:"green", countries:"green", feelings:"yellow", jobs:"yellow" };
const accentOf = id => { const a = ACCENTS[CAT_ACCENT[id] || "purple"]; return { fill:a[0], edge:a[1], on:a[2] }; };
const coverWord = cat => ({ id:`cover:${cat.id}`, cat:"cover", word:cat.id, emoji:cat.emoji });

const GAME_META = {
  quiz:    { label:"Quiz",          thai:"ตอบ 4 ตัวเลือก",      emoji:"🏆" },
  spell:   { label:"Spelling",      thai:"ฟัง→สะกดคำ",           emoji:"✍️" },
  memory:  { label:"Memory",        thai:"พลิกหาคู่",             emoji:"🃏" },
  speed:   { label:"Speed Round",   thai:"แข่งกับเวลา 30 วิ ⭐", emoji:"⚡" },
  habitat: { label:"Habitat Hunt",  thai:"จับสัตว์กลับบ้าน ⭐",  emoji:"🏡" },
  match:   { label:"Picture Match", thai:"จับคู่คำ↔รูป",          emoji:"🖼️" },
  colormix:{ label:"Color Mix",     thai:"ผสมสีให้ตรงเป้า ⭐",   emoji:"🎨" },
  count:   { label:"Count Quest",   thai:"นับแล้วเลือก ⭐",       emoji:"🔢" },
  bodydr:  { label:"Body Doctor",   thai:"แตะส่วนร่างกาย ⭐",    emoji:"🩺" },
  dress:   { label:"Dress Up",      thai:"เลือกเสื้อตามอากาศ ⭐", emoji:"🧥" },
  boss:    { label:"Boss Battle",   thai:"ด่านบอส 10 ข้อ 3 หัวใจ 👑", emoji:"👑" },
  listen:  { label:"Listen",        thai:"ฟังอย่างเดียว เลือกรูป 👂", emoji:"👂" },
  sentence:{ label:"Sentence",      thai:"เรียงคำให้เป็นประโยค 🧩",  emoji:"🧩" },
  speak:   { label:"Speak",         thai:"พูดตาม เช็คเสียง 🎤",       emoji:"🎤" },
  mole:    { label:"Whack-a-Mole",  thai:"ตีตัวตุ่นที่ถือรูปถูก 🔨",   emoji:"🔨" },
  balloon: { label:"Balloon Pop",   thai:"เจาะลูกโป่งคำที่ถูก 🎈",     emoji:"🎈" },
  ninja:   { label:"Word Ninja",    thai:"ปาดนิ้วฟันคำที่ถูก 🗡️",      emoji:"🗡️" },
  bingo:   { label:"Bingo",         thai:"ฟังคำ แตะรูป ครบแถว 🎱",     emoji:"🎱" },
  runner:  { label:"Word Runner 3D", thai:"วิ่ง 3 มิติ เก็บรูปที่ได้ยิน 🏃", emoji:"🏃" },
  feed:    { label:"Feed the Pet",  thai:"ป้อนอาหารให้เพื่อนคู่หู 😋",  emoji:"😋" },
};

let _id = 1;
const W = (cat, word, meaning, emoji, x = {}) =>
  ({ id: _id++, cat, word, meaning, emoji, ...x });

const INITIAL_WORDS = [
  // ── Animals 30 ─────────────────────────────
  W("animals","CAT","แมว","🐱",{habitat:"farm"}),
  W("animals","DOG","หมา","🐶",{habitat:"farm"}),
  W("animals","FISH","ปลา","🐟",{habitat:"ocean"}),
  W("animals","BIRD","นก","🐦",{habitat:"forest"}),
  W("animals","COW","วัว","🐮",{habitat:"farm"}),
  W("animals","PIG","หมู","🐷",{habitat:"farm"}),
  W("animals","FROG","กบ","🐸",{habitat:"forest"}),
  W("animals","DUCK","เป็ด","🦆",{habitat:"farm"}),
  W("animals","LION","สิงโต","🦁",{habitat:"forest"}),
  W("animals","BEAR","หมี","🐻",{habitat:"forest"}),
  W("animals","RABBIT","กระต่าย","🐰",{habitat:"forest"}),
  W("animals","HORSE","ม้า","🐴",{habitat:"farm"}),
  W("animals","SHEEP","แกะ","🐑",{habitat:"farm"}),
  W("animals","MONKEY","ลิง","🐵",{habitat:"forest"}),
  W("animals","ELEPHANT","ช้าง","🐘",{habitat:"forest"}),
  W("animals","TIGER","เสือ","🐯",{habitat:"forest"}),
  W("animals","PANDA","แพนด้า","🐼",{habitat:"forest"}),
  W("animals","DOLPHIN","โลมา","🐬",{habitat:"ocean"}),
  W("animals","SHARK","ฉลาม","🦈",{habitat:"ocean"}),
  W("animals","WHALE","วาฬ","🐋",{habitat:"ocean"}),
  W("animals","OCTOPUS","ปลาหมึก","🐙",{habitat:"ocean"}),
  W("animals","CRAB","ปู","🦀",{habitat:"ocean"}),
  W("animals","OWL","นกฮูก","🦉",{habitat:"forest"}),
  W("animals","SNAKE","งู","🐍",{habitat:"forest"}),
  W("animals","TURTLE","เต่า","🐢",{habitat:"ocean"}),
  W("animals","BUTTERFLY","ผีเสื้อ","🦋",{habitat:"forest"}),
  W("animals","BEE","ผึ้ง","🐝",{habitat:"forest"}),
  W("animals","MOUSE","หนู","🐭",{habitat:"farm"}),
  W("animals","PENGUIN","เพนกวิน","🐧",{habitat:"ocean"}),
  W("animals","FOX","สุนัขจิ้งจอก","🦊",{habitat:"forest"}),

  // ── Fruits 25 ─────────────────────────────
  W("fruits","APPLE","แอปเปิล","🍎"),
  W("fruits","BANANA","กล้วย","🍌"),
  W("fruits","ORANGE","ส้ม","🍊"),
  W("fruits","GRAPE","องุ่น","🍇"),
  W("fruits","LEMON","มะนาว","🍋"),
  W("fruits","MANGO","มะม่วง","🥭"),
  W("fruits","CHERRY","เชอร์รี่","🍒"),
  W("fruits","PEACH","พีช","🍑"),
  W("fruits","STRAWBERRY","สตรอว์เบอร์รี่","🍓"),
  W("fruits","WATERMELON","แตงโม","🍉"),
  W("fruits","PINEAPPLE","สับปะรด","🍍"),
  W("fruits","KIWI","กีวี","🥝"),
  W("fruits","BLUEBERRY","บลูเบอร์รี่","🫐"),
  W("fruits","COCONUT","มะพร้าว","🥥"),
  W("fruits","PEAR","ลูกแพร์","🍐"),
  W("fruits","MELON","เมลอน","🍈"),
  W("fruits","AVOCADO","อะโวคาโด","🥑"),
  W("fruits","GUAVA","ฝรั่ง","🍏"),
  W("fruits","PAPAYA","มะละกอ","🟠"),
  W("fruits","DURIAN","ทุเรียน","🟡"),
  W("fruits","LYCHEE","ลิ้นจี่","🍊"),
  W("fruits","RAMBUTAN","เงาะ","🔴"),
  W("fruits","LONGAN","ลำไย","⚪"),
  W("fruits","POMELO","ส้มโอ","🍋"),
  W("fruits","JACKFRUIT","ขนุน","🟡"),

  // ── Food 35 ──────────────────────────────
  W("food","RICE","ข้าว","🍚"),
  W("food","BREAD","ขนมปัง","🍞"),
  W("food","EGG","ไข่","🥚"),
  W("food","MILK","นม","🥛"),
  W("food","PIZZA","พิซซ่า","🍕"),
  W("food","CAKE","เค้ก","🎂"),
  W("food","CARROT","แครอท","🥕"),
  W("food","CORN","ข้าวโพด","🌽"),
  W("food","NOODLES","บะหมี่","🍜"),
  W("food","SOUP","ซุป","🍲"),
  W("food","SALAD","สลัด","🥗"),
  W("food","SANDWICH","แซนด์วิช","🥪"),
  W("food","HAMBURGER","แฮมเบอร์เกอร์","🍔"),
  W("food","SUSHI","ซูชิ","🍣"),
  W("food","ICECREAM","ไอศกรีม","🍦"),
  W("food","COOKIE","คุกกี้","🍪"),
  W("food","DONUT","โดนัท","🍩"),
  W("food","CHOCOLATE","ช็อกโกแลต","🍫"),
  W("food","CHEESE","ชีส","🧀"),
  W("food","CANDY","ลูกอม","🍬"),
  W("food","HOTDOG","ฮอตด็อก","🌭"),
  W("food","TACO","ทาโก้","🌮"),
  W("food","PASTA","พาสต้า","🍝"),
  W("food","MUSHROOM","เห็ด","🍄"),
  W("food","TOMATO","มะเขือเทศ","🍅"),
  W("food","POTATO","มันฝรั่ง","🥔"),
  W("food","BROCCOLI","บรอกโคลี","🥦"),
  W("food","HONEY","น้ำผึ้ง","🍯"),
  W("food","COFFEE","กาแฟ","☕"),
  W("food","TEA","ชา","🍵"),
  W("food","JUICE","น้ำผลไม้","🧃"),
  W("food","WATER","น้ำ","💧"),
  W("food","CURRY","แกง","🍛"),
  W("food","PANCAKE","แพนเค้ก","🥞"),
  W("food","RAMEN","ราเมน","🍜"),

  // ── Colors 11 ────────────────────────────
  W("colors","RED","สีแดง","🔴"),
  W("colors","BLUE","สีน้ำเงิน","🔵"),
  W("colors","GREEN","สีเขียว","🟢"),
  W("colors","YELLOW","สีเหลือง","🟡"),
  W("colors","PURPLE","สีม่วง","🟣"),
  W("colors","ORANGE","สีส้ม","🟠"),
  W("colors","PINK","สีชมพู","🩷"),
  W("colors","BROWN","สีน้ำตาล","🟤"),
  W("colors","BLACK","สีดำ","⚫"),
  W("colors","WHITE","สีขาว","⚪"),
  W("colors","GRAY","สีเทา","🩶"),

  // ── School 20 ────────────────────────────
  W("school","PEN","ปากกา","🖊️"),
  W("school","BOOK","หนังสือ","📖"),
  W("school","BAG","กระเป๋า","🎒"),
  W("school","PENCIL","ดินสอ","✏️"),
  W("school","RULER","ไม้บรรทัด","📏"),
  W("school","SCISSORS","กรรไกร","✂️"),
  W("school","NOTEBOOK","สมุด","📓"),
  W("school","COMPUTER","คอมพิวเตอร์","💻"),
  W("school","CALCULATOR","เครื่องคิดเลข","🧮"),
  W("school","GLOBE","ลูกโลก","🌍"),
  W("school","CRAYON","สีเทียน","🖍️"),
  W("school","ERASER","ยางลบ","🩹"),
  W("school","DESK","โต๊ะเรียน","🪑"),
  W("school","CHAIR","เก้าอี้","🪑"),
  W("school","CLASSROOM","ห้องเรียน","🏫"),
  W("school","TEACHER","ครู","👨‍🏫"),
  W("school","STUDENT","นักเรียน","👧"),
  W("school","HOMEWORK","การบ้าน","📝"),
  W("school","MAP","แผนที่","🗺️"),
  W("school","PAINT","สีน้ำ","🎨"),

  // ── Body 20 ──────────────────────────────
  W("body","EYE","ตา","👁️"),
  W("body","EAR","หู","👂"),
  W("body","NOSE","จมูก","👃"),
  W("body","HAND","มือ","✋"),
  W("body","FOOT","เท้า","🦶"),
  W("body","MOUTH","ปาก","👄"),
  W("body","HAIR","ผม","💇"),
  W("body","TOOTH","ฟัน","🦷"),
  W("body","FINGER","นิ้ว","☝️"),
  W("body","LEG","ขา","🦵"),
  W("body","ARM","แขน","💪"),
  W("body","TONGUE","ลิ้น","👅"),
  W("body","BRAIN","สมอง","🧠"),
  W("body","HEART","หัวใจ","❤️"),
  W("body","BONE","กระดูก","🦴"),
  W("body","SKIN","ผิวหนัง","🫀"),
  W("body","BACK","หลัง","🫁"),
  W("body","NECK","คอ","👤"),
  W("body","SHOULDER","ไหล่","💆"),
  W("body","STOMACH","ท้อง","🫃"),

  // ── Weather 15 ───────────────────────────
  W("weather","SUN","แดดออก","☀️",{wear:["🕶️","👕","🩳"]}),
  W("weather","RAIN","ฝนตก","🌧️",{wear:["☂️","🧥","🥾"]}),
  W("weather","SNOW","หิมะ","❄️",{wear:["🧣","🧤","🧥"]}),
  W("weather","CLOUD","มีเมฆ","☁️",{wear:["👕","👖"]}),
  W("weather","WIND","ลม","💨",{wear:["🧥","🧢"]}),
  W("weather","STORM","พายุ","⛈️",{wear:["☂️","🧥"]}),
  W("weather","RAINBOW","รุ้งกินน้ำ","🌈",{wear:["👕","🩳"]}),
  W("weather","FOG","หมอก","🌫️",{wear:["🧥","👖"]}),
  W("weather","HOT","ร้อน","🥵",{wear:["👕","🩳","🕶️"]}),
  W("weather","COLD","หนาว","🥶",{wear:["🧥","🧣","🧤"]}),
  W("weather","SUNNY","แดดจัด","🌤️",{wear:["👒","👕"]}),
  W("weather","THUNDER","ฟ้าผ่า","⚡",{wear:["☂️","🧥"]}),
  W("weather","HUMID","อากาศชื้น","💦",{wear:["👕"]}),
  W("weather","WARM","อากาศอุ่น","🌡️",{wear:["👕","👖"]}),
  W("weather","DRY","แห้งแล้ง","🏜️",{wear:["👒","🕶️"]}),

  // ── Numbers 20 ───────────────────────────
  W("numbers","ZERO","ศูนย์","0️⃣",{num:0}),
  W("numbers","ONE","หนึ่ง","1️⃣",{num:1}),
  W("numbers","TWO","สอง","2️⃣",{num:2}),
  W("numbers","THREE","สาม","3️⃣",{num:3}),
  W("numbers","FOUR","สี่","4️⃣",{num:4}),
  W("numbers","FIVE","ห้า","5️⃣",{num:5}),
  W("numbers","SIX","หก","6️⃣",{num:6}),
  W("numbers","SEVEN","เจ็ด","7️⃣",{num:7}),
  W("numbers","EIGHT","แปด","8️⃣",{num:8}),
  W("numbers","NINE","เก้า","9️⃣",{num:9}),
  W("numbers","TEN","สิบ","🔟",{num:10}),
  W("numbers","ELEVEN","สิบเอ็ด","1️⃣1️⃣",{num:11}),
  W("numbers","TWELVE","สิบสอง","1️⃣2️⃣",{num:12}),
  W("numbers","TWENTY","ยี่สิบ","2️⃣0️⃣",{num:20}),
  W("numbers","THIRTY","สามสิบ","3️⃣0️⃣",{num:30}),
  W("numbers","FORTY","สี่สิบ","4️⃣0️⃣",{num:40}),
  W("numbers","FIFTY","ห้าสิบ","5️⃣0️⃣",{num:50}),
  W("numbers","HUNDRED","ร้อย","💯",{num:100}),
  W("numbers","THOUSAND","พัน","🔢",{num:1000}),
  W("numbers","MILLION","ล้าน","💰",{num:1000000}),

  // ── Vehicles 20 ──────────────────────────
  W("vehicles","CAR","รถยนต์","🚗"),
  W("vehicles","BUS","รถบัส","🚌"),
  W("vehicles","TRAIN","รถไฟ","🚆"),
  W("vehicles","PLANE","เครื่องบิน","✈️"),
  W("vehicles","BOAT","เรือ","⛵"),
  W("vehicles","BIKE","จักรยาน","🚲"),
  W("vehicles","TRUCK","รถบรรทุก","🚚"),
  W("vehicles","TAXI","แท็กซี่","🚕"),
  W("vehicles","HELICOPTER","เฮลิคอปเตอร์","🚁"),
  W("vehicles","SHIP","เรือสำราญ","🚢"),
  W("vehicles","MOTORCYCLE","มอเตอร์ไซค์","🏍️"),
  W("vehicles","TRACTOR","รถแทรกเตอร์","🚜"),
  W("vehicles","AMBULANCE","รถพยาบาล","🚑"),
  W("vehicles","FIRETRUCK","รถดับเพลิง","🚒"),
  W("vehicles","POLICE CAR","รถตำรวจ","🚓"),
  W("vehicles","ROCKET","จรวด","🚀"),
  W("vehicles","SUBMARINE","เรือดำน้ำ","🤿"),
  W("vehicles","VAN","รถตู้","🚐"),
  W("vehicles","SCOOTER","สกู๊ตเตอร์","🛵"),
  W("vehicles","TUK-TUK","รถตุ๊กตุ๊ก","🛺"),

  // ── Jobs 20 ──────────────────────────────
  W("jobs","DOCTOR","แพทย์","👨‍⚕️"),
  W("jobs","NURSE","พยาบาล","👩‍⚕️"),
  W("jobs","TEACHER","ครู","👨‍🏫"),
  W("jobs","FARMER","ชาวนา","👨‍🌾"),
  W("jobs","COOK","พ่อครัว","👨‍🍳"),
  W("jobs","PILOT","นักบิน","👨‍✈️"),
  W("jobs","POLICE","ตำรวจ","👮"),
  W("jobs","FIREFIGHTER","นักดับเพลิง","👨‍🚒"),
  W("jobs","ARTIST","ศิลปิน","👨‍🎨"),
  W("jobs","ENGINEER","วิศวกร","👨‍💻"),
  W("jobs","SINGER","นักร้อง","🎤"),
  W("jobs","ACTOR","นักแสดง","🎭"),
  W("jobs","SOLDIER","ทหาร","💂"),
  W("jobs","WAITER","พนักงานเสิร์ฟ","🧑‍🍳"),
  W("jobs","SCIENTIST","นักวิทยาศาสตร์","🔬"),
  W("jobs","DRIVER","คนขับรถ","🚗"),
  W("jobs","BUILDER","ช่างก่อสร้าง","🏗️"),
  W("jobs","DENTIST","ทันตแพทย์","🦷"),
  W("jobs","BAKER","เบเกอร์","🥐"),
  W("jobs","CHEF","เชฟ","👨‍🍳"),

  // ── Clothes 20 ───────────────────────────
  W("clothes","SHIRT","เสื้อเชิ้ต","👔"),
  W("clothes","TSHIRT","เสื้อยืด","👕"),
  W("clothes","PANTS","กางเกง","👖"),
  W("clothes","DRESS","ชุดเดรส","👗"),
  W("clothes","SHOES","รองเท้า","👟"),
  W("clothes","SOCKS","ถุงเท้า","🧦"),
  W("clothes","HAT","หมวก","🧢"),
  W("clothes","GLASSES","แว่นตา","👓"),
  W("clothes","SCARF","ผ้าพันคอ","🧣"),
  W("clothes","GLOVES","ถุงมือ","🧤"),
  W("clothes","JACKET","แจ็กเก็ต","🧥"),
  W("clothes","SKIRT","กระโปรง","👗"),
  W("clothes","BOOTS","บูท","👢"),
  W("clothes","SANDALS","รองเท้าแตะ","👡"),
  W("clothes","UMBRELLA","ร่ม","☂️"),
  W("clothes","BELT","เข็มขัด","👔"),
  W("clothes","TIE","เนคไท","👔"),
  W("clothes","COAT","เสื้อโค้ท","🥼"),
  W("clothes","SWIMSUIT","ชุดว่ายน้ำ","🩱"),
  W("clothes","UNIFORM","เครื่องแบบ","👗"),

  // ── Home 20 ──────────────────────────────
  W("home","BED","เตียง","🛏️"),
  W("home","CHAIR","เก้าอี้","🪑"),
  W("home","TABLE","โต๊ะ","🪑"),
  W("home","DOOR","ประตู","🚪"),
  W("home","WINDOW","หน้าต่าง","🪟"),
  W("home","TV","โทรทัศน์","📺"),
  W("home","PHONE","โทรศัพท์","📱"),
  W("home","CLOCK","นาฬิกา","🕐"),
  W("home","LAMP","โคมไฟ","💡"),
  W("home","SOFA","โซฟา","🛋️"),
  W("home","MIRROR","กระจก","🪞"),
  W("home","BATH","อ่างอาบน้ำ","🛁"),
  W("home","FRIDGE","ตู้เย็น","🧊"),
  W("home","STOVE","เตา","🔥"),
  W("home","SINK","อ่างล้างจาน","🚰"),
  W("home","TOILET","ห้องน้ำ","🚽"),
  W("home","SHOWER","ฝักบัว","🚿"),
  W("home","BOOKSHELF","ชั้นวางหนังสือ","📚"),
  W("home","COMPUTER","คอมพิวเตอร์","💻"),
  W("home","KITCHEN","ห้องครัว","🍳"),

  // ── Nature 20 ────────────────────────────
  W("nature","TREE","ต้นไม้","🌳"),
  W("nature","FLOWER","ดอกไม้","🌸"),
  W("nature","MOUNTAIN","ภูเขา","⛰️"),
  W("nature","RIVER","แม่น้ำ","🏞️"),
  W("nature","OCEAN","มหาสมุทร","🌊"),
  W("nature","GRASS","หญ้า","🌿"),
  W("nature","LEAF","ใบไม้","🍃"),
  W("nature","ROCK","หิน","🪨"),
  W("nature","MOON","พระจันทร์","🌕"),
  W("nature","STAR","ดาว","⭐"),
  W("nature","SUN","ดวงอาทิตย์","☀️"),
  W("nature","CLOUD","เมฆ","☁️"),
  W("nature","LAKE","ทะเลสาบ","🏔️"),
  W("nature","FOREST","ป่าไม้","🌲"),
  W("nature","DESERT","ทะเลทราย","🏜️"),
  W("nature","ISLAND","เกาะ","🏝️"),
  W("nature","CAVE","ถ้ำ","🕳️"),
  W("nature","WATERFALL","น้ำตก","💧"),
  W("nature","VOLCANO","ภูเขาไฟ","🌋"),
  W("nature","RAINBOW","รุ้งกินน้ำ","🌈"),

  // ── Sports 20 ────────────────────────────
  W("sports","FOOTBALL","ฟุตบอล","⚽"),
  W("sports","BASKETBALL","บาสเกตบอล","🏀"),
  W("sports","TENNIS","เทนนิส","🎾"),
  W("sports","SWIMMING","ว่ายน้ำ","🏊"),
  W("sports","RUNNING","วิ่ง","🏃"),
  W("sports","CYCLING","ปั่นจักรยาน","🚴"),
  W("sports","BOXING","มวย","🥊"),
  W("sports","GOLF","กอล์ฟ","⛳"),
  W("sports","VOLLEYBALL","วอลเลย์บอล","🏐"),
  W("sports","BASEBALL","เบสบอล","⚾"),
  W("sports","BADMINTON","แบดมินตัน","🏸"),
  W("sports","SKATEBOARD","สเก็ตบอร์ด","🛹"),
  W("sports","SKIING","เล่นสกี","🎿"),
  W("sports","SURFING","เล่นเซิร์ฟ","🏄"),
  W("sports","YOGA","โยคะ","🧘"),
  W("sports","TABLE TENNIS","ปิงปอง","🏓"),
  W("sports","DANCING","เต้นรำ","💃"),
  W("sports","TROPHY","ถ้วยรางวัล","🏆"),
  W("sports","MEDAL","เหรียญ","🏅"),
  W("sports","JUMP","กระโดด","🤸"),

  // ── เพิ่มภายหลัง (ต่อท้ายเสมอ เพื่อให้ id ของคำเดิมไม่เปลี่ยน) ──
  // Animals +9
  W("animals","GIRAFFE","ยีราฟ","🦒",{habitat:"forest"}),
  W("animals","ZEBRA","ม้าลาย","🦓",{habitat:"forest"}),
  W("animals","CHICKEN","ไก่","🐔",{habitat:"farm"}),
  W("animals","GOAT","แพะ","🐐",{habitat:"farm"}),
  W("animals","DEER","กวาง","🦌",{habitat:"forest"}),
  W("animals","CROCODILE","จระเข้","🐊"),
  W("animals","KANGAROO","จิงโจ้","🦘",{habitat:"forest"}),
  W("animals","ANT","มด","🐜",{habitat:"forest"}),
  W("animals","SPIDER","แมงมุม","🕷️",{habitat:"forest"}),
  // Food +10
  W("food","FRIED RICE","ข้าวผัด","🍛"),
  W("food","PAD THAI","ผัดไทย","🍝"),
  W("food","SOM TAM","ส้มตำ","🥗"),
  W("food","FRENCH FRIES","เฟรนช์ฟรายส์","🍟"),
  W("food","FRIED CHICKEN","ไก่ทอด","🍗"),
  W("food","YOGURT","โยเกิร์ต","🥛"),
  W("food","BUTTER","เนย","🧈"),
  W("food","SUGAR","น้ำตาล","🍬"),
  W("food","SALT","เกลือ","🧂"),
  W("food","FISH SAUCE","น้ำปลา","🐟"),
  // Home +10 (ของใช้ประจำวัน)
  W("home","TOOTHBRUSH","แปรงสีฟัน","🪥"),
  W("home","TOWEL","ผ้าเช็ดตัว","🧻"),
  W("home","SOAP","สบู่","🧼"),
  W("home","PILLOW","หมอน","🛏️"),
  W("home","BLANKET","ผ้าห่ม","🧣"),
  W("home","KEY","กุญแจ","🔑"),
  W("home","CUP","แก้ว","🥤"),
  W("home","PLATE","จาน","🍽️"),
  W("home","SPOON","ช้อน","🥄"),
  W("home","FORK","ส้อม","🍴"),
  // Nature +2
  W("nature","SKY","ท้องฟ้า","🌤️"),
  W("nature","FIRE","ไฟ","🔥"),
  // Family 12
  W("family","MOTHER","แม่","👩"),
  W("family","FATHER","พ่อ","👨"),
  W("family","SISTER","พี่สาว/น้องสาว","👧"),
  W("family","BROTHER","พี่ชาย/น้องชาย","👦"),
  W("family","GRANDMOTHER","ยาย/ย่า","👵"),
  W("family","GRANDFATHER","ตา/ปู่","👴"),
  W("family","BABY","เด็กทารก","👶"),
  W("family","FAMILY","ครอบครัว","👨‍👩‍👧‍👦"),
  W("family","AUNT","ป้า/น้า","👩‍🦱"),
  W("family","UNCLE","ลุง/อา","👨‍🦱"),
  W("family","SON","ลูกชาย","🧒"),
  W("family","DAUGHTER","ลูกสาว","👧"),
  // Actions 20
  W("actions","RUN","วิ่ง","🏃"),
  W("actions","WALK","เดิน","🚶"),
  W("actions","EAT","กิน","🍽️"),
  W("actions","DRINK","ดื่ม","🥤"),
  W("actions","SLEEP","นอน","😴"),
  W("actions","READ","อ่าน","📖"),
  W("actions","WRITE","เขียน","✍️"),
  W("actions","SING","ร้องเพลง","🎤"),
  W("actions","DANCE","เต้น","💃"),
  W("actions","SWIM","ว่ายน้ำ","🏊"),
  W("actions","PLAY","เล่น","🎮"),
  W("actions","COOK","ทำอาหาร","🍳"),
  W("actions","WASH","ล้าง","🧼"),
  W("actions","DRAW","วาดรูป","🎨"),
  W("actions","SIT","นั่ง","🪑"),
  W("actions","STAND","ยืน","🧍"),
  W("actions","LAUGH","หัวเราะ","😂"),
  W("actions","CRY","ร้องไห้","😢"),
  W("actions","CLIMB","ปีน","🧗"),
  W("actions","LISTEN","ฟัง","👂"),
  // Feelings 10
  W("feelings","HAPPY","มีความสุข","😊"),
  W("feelings","SAD","เศร้า","😢"),
  W("feelings","ANGRY","โกรธ","😠"),
  W("feelings","SCARED","กลัว","😨"),
  W("feelings","TIRED","เหนื่อย","😩"),
  W("feelings","HUNGRY","หิว","🤤"),
  W("feelings","THIRSTY","กระหายน้ำ","🥵"),
  W("feelings","SICK","ป่วย","🤒"),
  W("feelings","SURPRISED","ประหลาดใจ","😲"),
  W("feelings","EXCITED","ตื่นเต้น","🤩"),
  // Shapes 8
  W("shapes","CIRCLE","วงกลม","🔵"),
  W("shapes","SQUARE","สี่เหลี่ยมจัตุรัส","🟦"),
  W("shapes","TRIANGLE","สามเหลี่ยม","🔺"),
  W("shapes","STAR","ดาว","⭐"),
  W("shapes","HEART","หัวใจ","❤️"),
  W("shapes","RECTANGLE","สี่เหลี่ยมผืนผ้า","▬"),
  W("shapes","OVAL","วงรี","🥚"),
  W("shapes","DIAMOND","สี่เหลี่ยมข้าวหลามตัด","🔶"),
  // Toys 12
  W("toys","BALL","ลูกบอล","⚽"),
  W("toys","DOLL","ตุ๊กตา","🪆"),
  W("toys","KITE","ว่าว","🪁"),
  W("toys","ROBOT","หุ่นยนต์","🤖"),
  W("toys","PUZZLE","จิ๊กซอว์","🧩"),
  W("toys","BLOCKS","ตัวต่อ","🧱"),
  W("toys","TEDDY BEAR","ตุ๊กตาหมี","🧸"),
  W("toys","BALLOON","ลูกโป่ง","🎈"),
  W("toys","DRUM","กลอง","🥁"),
  W("toys","GUITAR","กีตาร์","🎸"),
  W("toys","PIANO","เปียโน","🎹"),
  W("toys","YO-YO","โยโย่","🪀"),
  // Places 14
  W("places","SCHOOL","โรงเรียน","🏫"),
  W("places","HOSPITAL","โรงพยาบาล","🏥"),
  W("places","MARKET","ตลาด","🏪"),
  W("places","TEMPLE","วัด","🛕"),
  W("places","PARK","สวนสาธารณะ","🏞️"),
  W("places","ZOO","สวนสัตว์","🦁"),
  W("places","BEACH","ชายหาด","🏖️"),
  W("places","FARM","ฟาร์ม","🚜"),
  W("places","RESTAURANT","ร้านอาหาร","🍽️"),
  W("places","BANK","ธนาคาร","🏦"),
  W("places","AIRPORT","สนามบิน","✈️"),
  W("places","LIBRARY","ห้องสมุด","📚"),
  W("places","SUPERMARKET","ซูเปอร์มาร์เก็ต","🛒"),
  W("places","PLAYGROUND","สนามเด็กเล่น","🛝"),

  // ── ชุดขยาย v2.1 (ต่อท้ายเสมอ) ทำให้แต่ละหมวดมี ~30 คำ ──
  // Colors +4 → 15
  W("colors","GOLD","สีทอง","🟡"), W("colors","SILVER","สีเงิน","⚪"), W("colors","LIGHT BLUE","สีฟ้า","🩵"), W("colors","DARK GREEN","สีเขียวเข้ม","🟢"),
  // Fruits +5 → 30
  W("fruits","DRAGON FRUIT","แก้วมังกร","🐉"), W("fruits","ROSE APPLE","ชมพู่","🍎"), W("fruits","TAMARIND","มะขาม","🟤"), W("fruits","PLUM","ลูกพลัม","🟣"), W("fruits","STAR FRUIT","มะเฟือง","⭐"),
  // School +10 → 30
  W("school","BLACKBOARD","กระดานดำ","🖤"), W("school","MARKER","ปากกาเมจิก","🖊️"), W("school","GLUE","กาว","🧴"), W("school","PAPER","กระดาษ","📄"), W("school","PAINTBRUSH","พู่กัน","🖌️"),
  W("school","SCHOOL BUS","รถโรงเรียน","🚌"), W("school","LUNCH BOX","กล่องข้าว","🍱"), W("school","BELL","กระดิ่ง","🔔"), W("school","FLAG","ธง","🇹🇭"), W("school","TAPE","เทปกาว","📏"),
  // Body +10 → 30
  W("body","KNEE","เข่า","🦵"), W("body","ELBOW","ข้อศอก","💪"), W("body","CHIN","คาง","🙂"), W("body","CHEEK","แก้ม","☺️"), W("body","LIPS","ริมฝีปาก","👄"),
  W("body","EYEBROW","คิ้ว","🤨"), W("body","TOE","นิ้วเท้า","🦶"), W("body","THUMB","นิ้วโป้ง","👍"), W("body","NAIL","เล็บ","💅"), W("body","WRIST","ข้อมือ","⌚"),
  // Weather +10 → 25
  W("weather","CLOUDY","มีเมฆมาก","☁️"), W("weather","WINDY","ลมแรง","🍃"), W("weather","RAINY","ฝนตกทั้งวัน","🌧️"), W("weather","FLOOD","น้ำท่วม","🌊"), W("weather","ICE","น้ำแข็ง","🧊"),
  W("weather","SUMMER","ฤดูร้อน","☀️"), W("weather","WINTER","ฤดูหนาว","❄️"), W("weather","SPRING","ฤดูใบไม้ผลิ","🌸"), W("weather","AUTUMN","ฤดูใบไม้ร่วง","🍂"), W("weather","SNOWMAN","ตุ๊กตาหิมะ","⛄"),
  // Numbers +5 → 25
  W("numbers","THIRTEEN","สิบสาม","1️⃣3️⃣"), W("numbers","FOURTEEN","สิบสี่","1️⃣4️⃣"), W("numbers","FIFTEEN","สิบห้า","1️⃣5️⃣"), W("numbers","SIXTY","หกสิบ","6️⃣0️⃣"), W("numbers","SEVENTY","เจ็ดสิบ","7️⃣0️⃣"),
  // Vehicles +10 → 30
  W("vehicles","SPACESHIP","ยานอวกาศ","🛸"), W("vehicles","SAILBOAT","เรือใบ","⛵"), W("vehicles","FERRY","เรือข้ามฟาก","⛴️"), W("vehicles","PICKUP TRUCK","รถกระบะ","🛻"), W("vehicles","GARBAGE TRUCK","รถขยะ","🚛"),
  W("vehicles","CRANE","รถเครน","🏗️"), W("vehicles","HOT AIR BALLOON","บอลลูน","🎈"), W("vehicles","TRAM","รถราง","🚋"), W("vehicles","SPEEDBOAT","เรือเร็ว","🚤"), W("vehicles","SKYTRAIN","รถไฟฟ้า","🚝"),
  // Jobs +10 → 30
  W("jobs","VET","สัตวแพทย์","🐾"), W("jobs","MAIL CARRIER","บุรุษไปรษณีย์","📮"), W("jobs","FISHERMAN","ชาวประมง","🎣"), W("jobs","MECHANIC","ช่างซ่อมรถ","🔧"), W("jobs","HAIRDRESSER","ช่างทำผม","💇"),
  W("jobs","DANCER","นักเต้น","💃"), W("jobs","FOOTBALL PLAYER","นักฟุตบอล","⚽"), W("jobs","SHOPKEEPER","เจ้าของร้าน","🏪"), W("jobs","ASTRONAUT","นักบินอวกาศ","👩‍🚀"), W("jobs","MONK","พระ","🧘"),
  // Clothes +10 → 30
  W("clothes","SHORTS","กางเกงขาสั้น","🩳"), W("clothes","SWEATER","เสื้อกันหนาว","🧶"), W("clothes","RAINCOAT","เสื้อกันฝน","🧥"), W("clothes","PAJAMAS","ชุดนอน","🛌"), W("clothes","CAP","หมวกแก๊ป","🧢"),
  W("clothes","SLIPPERS","รองเท้าแตะในบ้าน","🩴"), W("clothes","APRON","ผ้ากันเปื้อน","🥼"), W("clothes","MASK","หน้ากาก","😷"), W("clothes","WATCH","นาฬิกาข้อมือ","⌚"), W("clothes","NECKLACE","สร้อยคอ","📿"),
  // Nature +8 → 30
  W("nature","SAND","ทราย","🏖️"), W("nature","WAVE","คลื่น","🌊"), W("nature","HILL","เนินเขา","⛰️"), W("nature","FIELD","ทุ่งนา","🌾"), W("nature","POND","บ่อน้ำ","🪷"),
  W("nature","SEED","เมล็ด","🌱"), W("nature","CACTUS","กระบองเพชร","🌵"), W("nature","BAMBOO","ไม้ไผ่","🎋"),
  // Sports +10 → 30
  W("sports","KARATE","คาราเต้","🥋"), W("sports","TAEKWONDO","เทควันโด","🥋"), W("sports","ICE SKATING","สเก็ตน้ำแข็ง","⛸️"), W("sports","FISHING","ตกปลา","🎣"), W("sports","HIKING","เดินป่า","🥾"),
  W("sports","BOWLING","โบว์ลิ่ง","🎳"), W("sports","CHESS","หมากรุก","♟️"), W("sports","HORSE RIDING","ขี่ม้า","🏇"), W("sports","RUGBY","รักบี้","🏉"), W("sports","JUMP ROPE","กระโดดเชือก","🪢"),
  // Family +8 → 20
  W("family","PARENTS","พ่อแม่","👫"), W("family","GRANDPARENTS","ปู่ย่าตายาย","👴👵"), W("family","COUSIN","ลูกพี่ลูกน้อง","🧑‍🤝‍🧑"), W("family","TWINS","ฝาแฝด","👯"),
  W("family","HUSBAND","สามี","🤵"), W("family","WIFE","ภรรยา","👰"), W("family","FRIEND","เพื่อน","🫂"), W("family","NEIGHBOR","เพื่อนบ้าน","🏘️"),
  // Actions +10 → 30
  W("actions","OPEN","เปิด","🚪"), W("actions","CLOSE","ปิด","🔒"), W("actions","PUSH","ผลัก","👐"), W("actions","PULL","ดึง","🪢"), W("actions","THROW","ขว้าง","🤾"),
  W("actions","CATCH","รับ","🧤"), W("actions","KICK","เตะ","🦵"), W("actions","HUG","กอด","🤗"), W("actions","SMILE","ยิ้ม","😊"), W("actions","CLAP","ปรบมือ","👏"),
  // Feelings +8 → 18
  W("feelings","BORED","เบื่อ","😑"), W("feelings","SHY","อาย","😳"), W("feelings","PROUD","ภูมิใจ","😌"), W("feelings","NERVOUS","ประหม่า","😬"),
  W("feelings","SLEEPY","ง่วง","😴"), W("feelings","CALM","สงบ","😇"), W("feelings","LONELY","เหงา","🥺"), W("feelings","BRAVE","กล้าหาญ","🦁"),
  // Shapes +4 → 12
  W("shapes","PENTAGON","ห้าเหลี่ยม","⬠"), W("shapes","HEXAGON","หกเหลี่ยม","⬡"), W("shapes","CUBE","ลูกบาศก์","🧊"), W("shapes","CRESCENT","จันทร์เสี้ยว","🌙"),
  // Toys +10 → 22
  W("toys","TOY CAR","รถของเล่น","🚗"), W("toys","BUBBLES","ฟองสบู่","🫧"), W("toys","SLIDE","กระดานลื่น","🛝"), W("toys","SWING","ชิงช้า","🎠"), W("toys","SEESAW","ไม้กระดก","⚖️"),
  W("toys","ROCKING HORSE","ม้าโยก","🐴"), W("toys","PUPPET","หุ่นเชิด","🧙"), W("toys","DICE","ลูกเต๋า","🎲"), W("toys","BOARD GAME","เกมกระดาน","🎯"), W("toys","MARBLES","ลูกแก้ว","🔮"),
  // Places +12 → 26
  W("places","CINEMA","โรงหนัง","🎬"), W("places","POST OFFICE","ไปรษณีย์","📮"), W("places","POLICE STATION","สถานีตำรวจ","🚓"), W("places","FIRE STATION","สถานีดับเพลิง","🚒"),
  W("places","PHARMACY","ร้านขายยา","💊"), W("places","GAS STATION","ปั๊มน้ำมัน","⛽"), W("places","BUS STOP","ป้ายรถเมล์","🚏"), W("places","TRAIN STATION","สถานีรถไฟ","🚉"),
  W("places","SWIMMING POOL","สระว่ายน้ำ","🏊"), W("places","SHOPPING MALL","ห้างสรรพสินค้า","🏬"), W("places","CAFE","ร้านกาแฟ","☕"), W("places","BAKERY","ร้านขนมปัง","🥐"),
  // ── ชุดขยายใหญ่ v2.2 (ต่อท้ายเสมอ) ──
  W("animals","WOLF","หมาป่า","🐺"),
  W("animals","CAMEL","อูฐ","🐫"),
  W("animals","HIPPO","ฮิปโป","🦛"),
  W("animals","RHINO","แรด","🦏"),
  W("animals","GORILLA","กอริลลา","🦍"),
  W("animals","LEOPARD","เสือดาว","🐆"),
  W("animals","CHEETAH","ชีตาห์","🐆"),
  W("animals","BUFFALO","ควาย","🐃"),
  W("animals","DONKEY","ลา","🫏"),
  W("animals","SQUIRREL","กระรอก","🐿️"),
  W("animals","BAT","ค้างคาว","🦇"),
  W("animals","HEDGEHOG","เม่นแคระ","🦔"),
  W("animals","KOALA","โคอาลา","🐨"),
  W("animals","SLOTH","สลอธ","🦥"),
  W("animals","RACCOON","แรคคูน","🦝"),
  W("animals","OTTER","นาก","🦦"),
  W("animals","SEAL","แมวน้ำ","🦭"),
  W("animals","WALRUS","วอลรัส","🦭"),
  W("animals","POLAR BEAR","หมีขั้วโลก","🐻‍❄️"),
  W("animals","REINDEER","กวางเรนเดียร์","🦌"),
  W("animals","MOOSE","มูส","🫎"),
  W("animals","BISON","ไบซัน","🦬"),
  W("animals","LLAMA","ลามะ","🦙"),
  W("animals","PARROT","นกแก้ว","🦜"),
  W("animals","PEACOCK","นกยูง","🦚"),
  W("animals","FLAMINGO","นกฟลามิงโก","🦩"),
  W("animals","EAGLE","นกอินทรี","🦅"),
  W("animals","SWAN","หงส์","🦢"),
  W("animals","GOOSE","ห่าน","🪿"),
  W("animals","TURKEY","ไก่งวง","🦃"),
  W("animals","ROOSTER","ไก่ตัวผู้","🐓"),
  W("animals","PIGEON","นกพิราบ","🕊️"),
  W("animals","SPARROW","นกกระจอก","🐦"),
  W("animals","CROW","อีกา","🐦‍⬛"),
  W("animals","HUMMINGBIRD","นกฮัมมิงเบิร์ด","🐦"),
  W("animals","OSTRICH","นกกระจอกเทศ","🦤"),
  W("animals","LIZARD","จิ้งจก","🦎"),
  W("animals","GECKO","ตุ๊กแก","🦎"),
  W("animals","CHAMELEON","กิ้งก่า","🦎"),
  W("animals","TORTOISE","เต่าบก","🐢"),
  W("animals","DINOSAUR","ไดโนเสาร์","🦕"),
  W("animals","JELLYFISH","แมงกะพรุน","🪼"),
  W("animals","STARFISH","ปลาดาว","⭐"),
  W("animals","SEAHORSE","ม้าน้ำ","🐠"),
  W("animals","SHRIMP","กุ้ง","🦐"),
  W("animals","LOBSTER","กุ้งมังกร","🦞"),
  W("animals","SQUID","หมึกกล้วย","🦑"),
  W("animals","CLOWNFISH","ปลาการ์ตูน","🐠"),
  W("animals","EEL","ปลาไหล","🐍"),
  W("animals","LADYBUG","เต่าทอง","🐞"),
  W("animals","DRAGONFLY","แมลงปอ","🪰"),
  W("animals","GRASSHOPPER","ตั๊กแตน","🦗"),
  W("animals","MOSQUITO","ยุง","🦟"),
  W("animals","FLY","แมลงวัน","🪰"),
  W("animals","COCKROACH","แมลงสาบ","🪳"),
  W("animals","WORM","หนอน","🪱"),
  W("animals","SNAIL","หอยทาก","🐌"),
  W("animals","CATERPILLAR","หนอนผีเสื้อ","🐛"),
  W("animals","SCORPION","แมงป่อง","🦂"),
  W("animals","PUPPY","ลูกหมา","🐶"),
  W("animals","KITTEN","ลูกแมว","🐱"),
  W("food","STEAK","สเต๊ก","🥩"),
  W("food","CHICKEN RICE","ข้าวมันไก่","🍗"),
  W("food","TOM YUM","ต้มยำ","🍲"),
  W("food","MANGO STICKY RICE","ข้าวเหนียวมะม่วง","🥭"),
  W("food","SPRING ROLL","ปอเปี๊ยะ","🥟"),
  W("food","DUMPLING","เกี๊ยว","🥟"),
  W("food","PORRIDGE","โจ๊ก","🥣"),
  W("food","OMELET","ไข่เจียว","🍳"),
  W("food","BOILED EGG","ไข่ต้ม","🥚"),
  W("food","TOAST","ขนมปังปิ้ง","🍞"),
  W("food","CEREAL","ซีเรียล","🥣"),
  W("food","JAM","แยม","🍓"),
  W("food","PEANUT","ถั่วลิสง","🥜"),
  W("food","POPCORN","ป๊อปคอร์น","🍿"),
  W("food","CHIPS","มันฝรั่งทอดกรอบ","🥔"),
  W("food","PUDDING","พุดดิ้ง","🍮"),
  W("food","CUPCAKE","คัพเค้ก","🧁"),
  W("food","PIE","พาย","🥧"),
  W("food","WAFFLE","วาฟเฟิล","🧇"),
  W("food","BUBBLE TEA","ชานมไข่มุก","🧋"),
  W("food","LEMONADE","น้ำมะนาว","🍋"),
  W("food","SODA","น้ำอัดลม","🥤"),
  W("food","SMOOTHIE","สมูทตี้","🥤"),
  W("food","COCOA","โกโก้","☕"),
  W("food","SOY MILK","นมถั่วเหลือง","🥛"),
  W("food","SAUSAGE","ไส้กรอก","🌭"),
  W("food","BACON","เบคอน","🥓"),
  W("food","HAM","แฮม","🍖"),
  W("food","MEATBALL","ลูกชิ้น","🧆"),
  W("food","GRILLED PORK","หมูปิ้ง","🍢"),
  W("food","FISH BALL","ลูกชิ้นปลา","🍡"),
  W("food","TOFU","เต้าหู้","🧈"),
  W("food","SEAWEED","สาหร่าย","🌿"),
  W("food","SALAD DRESSING","น้ำสลัด","🥗"),
  W("food","KETCHUP","ซอสมะเขือเทศ","🍅"),
  W("food","SOY SAUCE","ซีอิ๊ว","🫗"),
  W("food","CHILI","พริก","🌶️"),
  W("food","GARLIC","กระเทียม","🧄"),
  W("food","ONION","หัวหอม","🧅"),
  W("food","PEPPER","พริกไทย","🧂"),
  W("food","FLOUR","แป้ง","🌾"),
  W("food","OIL","น้ำมัน","🫙"),
  W("food","BREAKFAST","อาหารเช้า","🍳"),
  W("food","LUNCH","อาหารกลางวัน","🍱"),
  W("food","DINNER","อาหารเย็น","🍽️"),
  W("actions","JUMP","กระโดด","🤸"),
  W("actions","STOP","หยุด","✋"),
  W("actions","GO","ไป","🏃‍♂️"),
  W("actions","COME","มา","👋"),
  W("actions","LOOK","มอง","👀"),
  W("actions","SEE","เห็น","👁️"),
  W("actions","HEAR","ได้ยิน","👂"),
  W("actions","SMELL","ดม","👃"),
  W("actions","TOUCH","แตะ","👆"),
  W("actions","TASTE","ชิม","👅"),
  W("actions","SPEAK","พูด","🗣️"),
  W("actions","SAY","บอก","💬"),
  W("actions","ASK","ถาม","❓"),
  W("actions","ANSWER","ตอบ","💡"),
  W("actions","HELP","ช่วย","🤝"),
  W("actions","GIVE","ให้","🎁"),
  W("actions","TAKE","หยิบ/เอา","✊"),
  W("actions","BUY","ซื้อ","🛒"),
  W("actions","SELL","ขาย","🏷️"),
  W("actions","PAY","จ่ายเงิน","💵"),
  W("actions","WAIT","รอ","⏳"),
  W("actions","START","เริ่ม","▶️"),
  W("actions","FINISH","เสร็จ","🏁"),
  W("actions","WIN","ชนะ","🏆"),
  W("actions","LOSE","แพ้","😞"),
  W("actions","FLY","บิน","✈️"),
  W("actions","DRIVE","ขับรถ","🚗"),
  W("actions","RIDE","ขี่","🚴"),
  W("actions","CARRY","ถือ/แบก","🎒"),
  W("actions","BUILD","สร้าง","🏗️"),
  W("actions","BREAK","ทำแตก","💥"),
  W("actions","FIX","ซ่อม","🔧"),
  W("actions","CUT","ตัด","✂️"),
  W("actions","PAINT","ระบายสี","🎨"),
  W("actions","COLOR","ระบายสี","🖍️"),
  W("actions","FOLD","พับ","📄"),
  W("actions","CLEAN","ทำความสะอาด","🧹"),
  W("actions","SWEEP","กวาด","🧹"),
  W("actions","WIPE","เช็ด","🧽"),
  W("actions","POUR","เท","🫗"),
  W("actions","MIX","ผสม","🥣"),
  W("actions","BAKE","อบ","🧁"),
  W("actions","FRY","ทอด","🍳"),
  W("actions","BOIL","ต้ม","♨️"),
  W("actions","FEED","ให้อาหาร","🍼"),
  W("actions","WATER","รดน้ำ","🚿"),
  W("actions","PLANT","ปลูก","🌱"),
  W("actions","PICK","เก็บ/เด็ด","🍓"),
  W("actions","DIG","ขุด","⛏️"),
  W("actions","WAKE UP","ตื่น","⏰"),
  W("actions","GET UP","ลุกจากเตียง","🛏️"),
  W("actions","BRUSH","แปรง","🪥"),
  W("actions","SHOWER","อาบน้ำ","🚿"),
  W("actions","DRESS","แต่งตัว","👕"),
  W("actions","COMB","หวีผม","💇"),
  W("actions","STUDY","เรียน","📚"),
  W("actions","LEARN","เรียนรู้","🧠"),
  W("actions","TEACH","สอน","👩‍🏫"),
  W("actions","THINK","คิด","💭"),
  W("actions","KNOW","รู้","✅"),
  W("actions","REMEMBER","จำได้","📌"),
  W("actions","FORGET","ลืม","🙈"),
  W("actions","COUNT","นับ","🔢"),
  W("actions","SPELL","สะกด","🔤"),
  W("actions","LOVE","รัก","❤️"),
  W("actions","LIKE","ชอบ","👍"),
  W("actions","WANT","อยากได้","🙏"),
  W("actions","NEED","ต้องการ","📝"),
  W("actions","SHARE","แบ่งปัน","🤲"),
  W("actions","WAVE","โบกมือ","👋"),
  W("jobs","LAWYER","ทนายความ","⚖️"),
  W("jobs","ACCOUNTANT","นักบัญชี","🧮"),
  W("jobs","PROGRAMMER","โปรแกรมเมอร์","💻"),
  W("jobs","DESIGNER","นักออกแบบ","🎨"),
  W("jobs","PHOTOGRAPHER","ช่างภาพ","📷"),
  W("jobs","JOURNALIST","นักข่าว","📰"),
  W("jobs","WRITER","นักเขียน","✍️"),
  W("jobs","MUSICIAN","นักดนตรี","🎸"),
  W("jobs","PAINTER","จิตรกร","🖌️"),
  W("jobs","ARCHITECT","สถาปนิก","📐"),
  W("jobs","PLUMBER","ช่างประปา","🔧"),
  W("jobs","ELECTRICIAN","ช่างไฟ","⚡"),
  W("jobs","CARPENTER","ช่างไม้","🪚"),
  W("jobs","GARDENER","คนสวน","🌻"),
  W("jobs","CLEANER","พนักงานทำความสะอาด","🧹"),
  W("jobs","SECURITY GUARD","รปภ.","💂"),
  W("jobs","CASHIER","แคชเชียร์","💳"),
  W("jobs","STREET VENDOR","พ่อค้าแม่ค้าริมทาง","🛒"),
  W("jobs","TAXI DRIVER","คนขับแท็กซี่","🚕"),
  W("jobs","FLIGHT ATTENDANT","แอร์โฮสเตส","🧑‍✈️"),
  W("jobs","CAPTAIN","กัปตัน","⚓"),
  W("jobs","FARMER'S HELPER","ลูกจ้างไร่นา","🌾"),
  W("jobs","KING","พระราชา","🤴"),
  W("jobs","QUEEN","พระราชินี","👸"),
  W("jobs","PRINCE","เจ้าชาย","🤴"),
  W("jobs","PRINCESS","เจ้าหญิง","👸"),
  W("jobs","SUPERHERO","ซูเปอร์ฮีโร่","🦸"),
  W("jobs","PIRATE","โจรสลัด","🏴‍☠️"),
  W("jobs","CLOWN","ตัวตลก","🤡"),
  W("jobs","MAGICIAN","นักมายากล","🎩"),
  W("home","LIVING ROOM","ห้องนั่งเล่น","🛋️"),
  W("home","BEDROOM","ห้องนอน","🛏️"),
  W("home","BATHROOM","ห้องน้ำ","🛁"),
  W("home","GARAGE","โรงรถ","🚗"),
  W("home","GARDEN","สวน","🌷"),
  W("home","BALCONY","ระเบียง","🪴"),
  W("home","ROOF","หลังคา","🏠"),
  W("home","WALL","กำแพง","🧱"),
  W("home","FLOOR","พื้น","🧹"),
  W("home","STAIRS","บันได","🪜"),
  W("home","FENCE","รั้ว","🏡"),
  W("home","CURTAIN","ผ้าม่าน","🪟"),
  W("home","CARPET","พรม","🧶"),
  W("home","FAN","พัดลม","🌀"),
  W("home","AIR CONDITIONER","แอร์","❄️"),
  W("home","WASHING MACHINE","เครื่องซักผ้า","🫧"),
  W("home","MICROWAVE","ไมโครเวฟ","📦"),
  W("home","OVEN","เตาอบ","🔥"),
  W("home","KETTLE","กาต้มน้ำ","🫖"),
  W("home","RICE COOKER","หม้อหุงข้าว","🍚"),
  W("home","PAN","กระทะ","🍳"),
  W("home","POT","หม้อ","🍲"),
  W("home","KNIFE","มีด","🔪"),
  W("home","BOWL","ชาม","🥣"),
  W("home","GLASS","แก้วน้ำ","🥛"),
  W("home","BOTTLE","ขวด","🍼"),
  W("home","CHOPSTICKS","ตะเกียบ","🥢"),
  W("home","TRASH CAN","ถังขยะ","🗑️"),
  W("home","BROOM","ไม้กวาด","🧹"),
  W("home","BUCKET","ถัง","🪣"),
  W("home","HANGER","ไม้แขวนเสื้อ","🧥"),
  W("home","WARDROBE","ตู้เสื้อผ้า","🚪"),
  W("home","DRAWER","ลิ้นชัก","🗄️"),
  W("home","SHELF","ชั้นวาง","📚"),
  W("home","CANDLE","เทียน","🕯️"),
  W("home","VASE","แจกัน","🏺"),
  W("home","PHOTO","รูปถ่าย","🖼️"),
  W("home","DOORBELL","กริ่งประตู","🔔"),
  W("home","LIGHT","ไฟ","💡"),
  W("home","SWITCH","สวิตช์","🔘"),
  W("places","HOME","บ้าน","🏠"),
  W("places","VILLAGE","หมู่บ้าน","🏘️"),
  W("places","CITY","เมือง","🏙️"),
  W("places","STREET","ถนน","🛣️"),
  W("places","BRIDGE","สะพาน","🌉"),
  W("places","GARDEN","สวนดอกไม้","🌷"),
  W("places","HOTEL","โรงแรม","🏨"),
  W("places","MUSEUM","พิพิธภัณฑ์","🏛️"),
  W("places","AQUARIUM","อควาเรียม","🐠"),
  W("places","AMUSEMENT PARK","สวนสนุก","🎡"),
  W("places","STADIUM","สนามกีฬา","🏟️"),
  W("places","CHURCH","โบสถ์","⛪"),
  W("places","MOSQUE","มัสยิด","🕌"),
  W("places","PALACE","พระราชวัง","🏰"),
  W("places","CASTLE","ปราสาท","🏰"),
  W("places","TOWER","หอคอย","🗼"),
  W("places","OFFICE","สำนักงาน","🏢"),
  W("places","FACTORY","โรงงาน","🏭"),
  W("places","HARBOR","ท่าเรือ","⚓"),
  W("places","ISLAND","เกาะ","🏝️"),
  W("places","JUNGLE","ป่าดงดิบ","🌴"),
  W("places","FLOATING MARKET","ตลาดน้ำ","🛶"),
  W("places","NIGHT MARKET","ตลาดนัดกลางคืน","🌃"),
  W("places","CONVENIENCE STORE","ร้านสะดวกซื้อ","🏪"),
  W("school","CLASSMATE","เพื่อนร่วมชั้น","🧑‍🤝‍🧑"),
  W("school","PRINCIPAL","ผู้อำนวยการ","🧑‍💼"),
  W("school","LESSON","บทเรียน","📖"),
  W("school","TEST","การสอบ","📝"),
  W("school","GRADE","คะแนน/เกรด","💯"),
  W("school","ENGLISH","ภาษาอังกฤษ","🇬🇧"),
  W("school","MATH","คณิตศาสตร์","➕"),
  W("school","SCIENCE","วิทยาศาสตร์","🔬"),
  W("school","ART","ศิลปะ","🎨"),
  W("school","MUSIC","ดนตรี","🎵"),
  W("school","P.E.","พลศึกษา","🏃"),
  W("school","HISTORY","ประวัติศาสตร์","🏛️"),
  W("school","LIBRARY CARD","บัตรห้องสมุด","🪪"),
  W("school","DICTIONARY","พจนานุกรม","📕"),
  W("school","WHITEBOARD","กระดานไวท์บอร์ด","⬜"),
  W("school","PROJECTOR","โปรเจกเตอร์","📽️"),
  W("school","PENCIL CASE","กล่องดินสอ","✏️"),
  W("school","SHARPENER","กบเหลาดินสอ","🔪"),
  W("school","STICKER","สติกเกอร์","⭐"),
  W("school","CANTEEN","โรงอาหาร","🍽️"),
  W("body","FACE","ใบหน้า","🙂"),
  W("body","HEAD","หัว","🗣️"),
  W("body","BODY","ร่างกาย","🧍"),
  W("body","TEETH","ฟัน (หลายซี่)","😁"),
  W("body","BEARD","เครา","🧔"),
  W("body","MUSTACHE","หนวด","👨"),
  W("body","ANKLE","ข้อเท้า","🦶"),
  W("body","HIP","สะโพก","🕺"),
  W("body","CHEST","หน้าอก","👕"),
  W("body","BLOOD","เลือด","🩸"),
  W("nature","SEA","ทะเล","🌊"),
  W("nature","STREAM","ลำธาร","🏞️"),
  W("nature","SOIL","ดิน","🟤"),
  W("nature","MUD","โคลน","🟫"),
  W("nature","STONE","ก้อนหิน","🪨"),
  W("nature","SHELL","เปลือกหอย","🐚"),
  W("nature","CORAL","ปะการัง","🪸"),
  W("nature","BRANCH","กิ่งไม้","🌿"),
  W("nature","ROOT","ราก","🌱"),
  W("nature","BUSH","พุ่มไม้","🌳"),
  W("nature","PALM TREE","ต้นมะพร้าว","🌴"),
  W("nature","LOTUS","ดอกบัว","🪷"),
  W("nature","ROSE","กุหลาบ","🌹"),
  W("nature","SUNFLOWER","ทานตะวัน","🌻"),
  W("nature","ORCHID","กล้วยไม้","🌸"),
  W("nature","PLANET","ดาวเคราะห์","🪐"),
  W("nature","EARTH","โลก","🌍"),
  W("nature","SPACE","อวกาศ","🚀"),
  W("nature","AIR","อากาศ","💨"),
  W("nature","SMOKE","ควัน","💨"),
  W("vehicles","AIRPLANE","เครื่องบิน","✈️"),
  W("vehicles","JET","เครื่องบินเจ็ต","🛩️"),
  W("vehicles","SUBWAY","รถไฟใต้ดิน","🚇"),
  W("vehicles","LORRY","รถบรรทุกใหญ่","🚚"),
  W("vehicles","RACE CAR","รถแข่ง","🏎️"),
  W("vehicles","JEEP","รถจี๊ป","🚙"),
  W("vehicles","CANOE","เรือแคนู","🛶"),
  W("vehicles","LONGTAIL BOAT","เรือหางยาว","🚤"),
  W("vehicles","WHEELCHAIR","รถเข็นผู้ป่วย","🦽"),
  W("vehicles","STROLLER","รถเข็นเด็ก","🍼"),
  W("vehicles","WHEEL","ล้อ","🛞"),
  W("vehicles","ENGINE","เครื่องยนต์","⚙️"),
  W("vehicles","TRAFFIC LIGHT","ไฟจราจร","🚦"),
  W("vehicles","SEAT BELT","เข็มขัดนิรภัย","🔒"),
  W("vehicles","HELMET","หมวกกันน็อก","⛑️"),
  W("clothes","JEANS","กางเกงยีนส์","👖"),
  W("clothes","HOODIE","เสื้อฮู้ด","🧥"),
  W("clothes","VEST","เสื้อกั๊ก","🦺"),
  W("clothes","SUIT","สูท","🤵"),
  W("clothes","UNDERWEAR","ชุดชั้นใน","🩲"),
  W("clothes","BIKINI","บิกินี่","👙"),
  W("clothes","SNEAKERS","รองเท้าผ้าใบ","👟"),
  W("clothes","HIGH HEELS","รองเท้าส้นสูง","👠"),
  W("clothes","RING","แหวน","💍"),
  W("clothes","EARRINGS","ต่างหู","💎"),
  W("clothes","BRACELET","กำไล","📿"),
  W("clothes","SUNGLASSES","แว่นกันแดด","🕶️"),
  W("clothes","BUTTON","กระดุม","🔘"),
  W("clothes","POCKET","กระเป๋าเสื้อ/กางเกง","👖"),
  W("clothes","ZIPPER","ซิป","🤐"),
  W("sports","RUNNING SHOES","รองเท้าวิ่ง","👟"),
  W("sports","GOAL","ประตู (กีฬา)","🥅"),
  W("sports","RACKET","ไม้แร็กเก็ต","🎾"),
  W("sports","BAT","ไม้ตี","🏏"),
  W("sports","NET","ตาข่าย","🥅"),
  W("sports","WHISTLE","นกหวีด","📣"),
  W("sports","TEAM","ทีม","👥"),
  W("sports","COACH","โค้ช","🧑‍🏫"),
  W("sports","RACE","การแข่งวิ่ง","🏁"),
  W("sports","MARATHON","มาราธอน","🏃‍♀️"),
  W("sports","EXERCISE","ออกกำลังกาย","🏋️"),
  W("sports","STRETCH","ยืดเส้น","🙆"),
  W("sports","PUSH-UP","วิดพื้น","💪"),
  W("sports","DIVING","ดำน้ำ","🤿"),
  W("sports","KAYAKING","พายเรือคายัค","🛶"),
  W("toys","LEGO","เลโก้","🧱"),
  W("toys","TRAIN SET","รถไฟของเล่น","🚂"),
  W("toys","SPINNING TOP","ลูกข่าง","🌀"),
  W("toys","WATER GUN","ปืนฉีดน้ำ","🔫"),
  W("toys","SANDBOX","กระบะทราย","🏖️"),
  W("toys","TRAMPOLINE","แทรมโพลีน","🤸"),
  W("toys","SCOOTER","สกู๊ตเตอร์","🛴"),
  W("toys","ROLLER SKATES","รองเท้าสเก็ต","🛼"),
  W("toys","CRAYONS","สีเทียน (ชุด)","🖍️"),
  W("toys","STICKER BOOK","สมุดสติกเกอร์","📒"),
  W("toys","PLAYDOUGH","แป้งโดว์","🟣"),
  W("toys","MAGNET","แม่เหล็ก","🧲"),
  W("toys","BALLOON ANIMAL","ลูกโป่งรูปสัตว์","🐩"),
  W("feelings","LOVE","ความรัก","🥰"),
  W("feelings","WORRIED","กังวล","😟"),
  W("feelings","CONFUSED","งง","😕"),
  W("feelings","SILLY","ตลก/บ๊อง","🤪"),
  W("feelings","GRUMPY","หงุดหงิด","😤"),
  W("feelings","CURIOUS","อยากรู้อยากเห็น","🧐"),
  W("feelings","THANKFUL","ขอบคุณ/ซาบซึ้ง","🙏"),
  W("feelings","SORRY","เสียใจ/ขอโทษ","😔"),
  W("feelings","HURT","เจ็บ","🤕"),
  W("feelings","FULL","อิ่ม","😋"),
  W("feelings","COLD","หนาว (รู้สึก)","🥶"),
  W("feelings","HOT","ร้อน (รู้สึก)","🥵"),
  W("colors","BEIGE","สีเบจ","🟫"),
  W("colors","TURQUOISE","สีเทอร์ควอยซ์","🩵"),
  W("colors","VIOLET","สีม่วงอ่อน","💜"),
  W("colors","NAVY","สีกรมท่า","🟦"),
  W("colors","RAINBOW COLORS","สีรุ้ง","🌈"),
  W("shapes","OVAL EGG","รูปไข่","🥚"),
  W("shapes","LINE","เส้นตรง","➖"),
  W("shapes","ARROW","ลูกศร","➡️"),
  W("numbers","SIXTEEN","สิบหก","1️⃣6️⃣"),
  W("numbers","SEVENTEEN","สิบเจ็ด","1️⃣7️⃣"),
  W("numbers","EIGHTEEN","สิบแปด","1️⃣8️⃣"),
  W("numbers","NINETEEN","สิบเก้า","1️⃣9️⃣"),
  W("numbers","EIGHTY","แปดสิบ","8️⃣0️⃣"),
  W("numbers","NINETY","เก้าสิบ","9️⃣0️⃣"),
  W("numbers","FIRST","ที่หนึ่ง","🥇"),
  W("numbers","SECOND","ที่สอง","🥈"),
  W("numbers","THIRD","ที่สาม","🥉"),
  W("numbers","HALF","ครึ่ง","🌗"),
  W("family","ME","ฉัน","🙋"),
  W("family","BOY","เด็กผู้ชาย","👦"),
  W("family","GIRL","เด็กผู้หญิง","👧"),
  W("family","MAN","ผู้ชาย","👨"),
  W("family","WOMAN","ผู้หญิง","👩"),
  W("fruits","CANTALOUPE","แคนตาลูป","🍈"),
  W("fruits","APRICOT","แอปริคอต","🍑"),
  W("fruits","FIG","มะเดื่อ","🟣"),
  W("fruits","RASPBERRY","ราสเบอร์รี่","🍓"),
  W("fruits","CRANBERRY","แครนเบอร์รี่","🔴"),
  W("fruits","PASSION FRUIT","เสาวรส","🟣"),
  W("fruits","MANGOSTEEN","มังคุด","🟣"),
  W("fruits","SAPODILLA","ละมุด","🟤"),
  W("fruits","SUGARCANE","อ้อย","🎋"),
  W("fruits","RAISIN","ลูกเกด","🍇"),
  W("weather","TORNADO","พายุทอร์นาโด","🌪️"),
  W("weather","TYPHOON","ไต้ฝุ่น","🌀"),
  W("weather","DRIZZLE","ฝนปรอยๆ","🌦️"),
  W("weather","HAIL","ลูกเห็บ","🧊"),
  W("weather","TEMPERATURE","อุณหภูมิ","🌡️"),
  W("vegetables","CABBAGE","กะหล่ำปลี","🥬"),
  W("vegetables","LETTUCE","ผักกาดหอม","🥬"),
  W("vegetables","SPINACH","ผักโขม","🥬"),
  W("vegetables","KALE","คะน้า","🥬"),
  W("vegetables","MORNING GLORY","ผักบุ้ง","🌿"),
  W("vegetables","CUCUMBER","แตงกวา","🥒"),
  W("vegetables","PUMPKIN","ฟักทอง","🎃"),
  W("vegetables","EGGPLANT","มะเขือ","🍆"),
  W("vegetables","BELL PEPPER","พริกหวาน","🫑"),
  W("vegetables","CORN COB","ฝักข้าวโพด","🌽"),
  W("vegetables","PEAS","ถั่วลันเตา","🫛"),
  W("vegetables","BEANS","ถั่วฝักยาว","🫘"),
  W("vegetables","BEAN SPROUTS","ถั่วงอก","🌱"),
  W("vegetables","CAULIFLOWER","กะหล่ำดอก","🥦"),
  W("vegetables","CELERY","ขึ้นฉ่าย","🥬"),
  W("vegetables","RADISH","หัวไชเท้า","🥕"),
  W("vegetables","SWEET POTATO","มันเทศ","🍠"),
  W("vegetables","TARO","เผือก","🟣"),
  W("vegetables","CASSAVA","มันสำปะหลัง","🥔"),
  W("vegetables","GINGER","ขิง","🫚"),
  W("vegetables","GALANGAL","ข่า","🫚"),
  W("vegetables","LEMONGRASS","ตะไคร้","🌾"),
  W("vegetables","BASIL","โหระพา/กะเพรา","🌿"),
  W("vegetables","CORIANDER","ผักชี","🌿"),
  W("vegetables","SPRING ONION","ต้นหอม","🧅"),
  W("vegetables","LIME","มะนาว (เขียว)","🍋‍🟩"),
  W("vegetables","BITTER GOURD","มะระ","🥒"),
  W("vegetables","WINTER MELON","ฟัก","🍈"),
  W("vegetables","BABY CORN","ข้าวโพดอ่อน","🌽"),
  W("vegetables","ASPARAGUS","หน่อไม้ฝรั่ง","🌱"),
  W("vegetables","BAMBOO SHOOT","หน่อไม้","🎋"),
  W("vegetables","SHIITAKE","เห็ดหอม","🍄"),
  W("vegetables","STRAW MUSHROOM","เห็ดฟาง","🍄"),
  W("vegetables","BEETROOT","บีทรูท","🟥"),
  W("vegetables","TURNIP","หัวผักกาด","⚪"),
  W("vegetables","OKRA","กระเจี๊ยบ","🫛"),
  W("vegetables","ZUCCHINI","ซูกินี","🥒"),
  W("vegetables","ARTICHOKE","อาร์ติโชก","🌸"),
  W("vegetables","SEAWEED SALAD","ยำสาหร่าย","🥗"),
  W("vegetables","VEGETABLES","ผัก","🥦"),
  W("technology","SMARTPHONE","สมาร์ตโฟน","📱"),
  W("technology","TABLET","แท็บเล็ต","📱"),
  W("technology","LAPTOP","แล็ปท็อป","💻"),
  W("technology","KEYBOARD","คีย์บอร์ด","⌨️"),
  W("technology","MOUSE","เมาส์","🖱️"),
  W("technology","SCREEN","หน้าจอ","🖥️"),
  W("technology","HEADPHONES","หูฟัง","🎧"),
  W("technology","SPEAKER","ลำโพง","🔊"),
  W("technology","CAMERA","กล้อง","📷"),
  W("technology","PRINTER","เครื่องพิมพ์","🖨️"),
  W("technology","BATTERY","แบตเตอรี่","🔋"),
  W("technology","CHARGER","ที่ชาร์จ","🔌"),
  W("technology","CABLE","สายไฟ/สายชาร์จ","🔌"),
  W("technology","WIFI","ไวไฟ","📶"),
  W("technology","INTERNET","อินเทอร์เน็ต","🌐"),
  W("technology","EMAIL","อีเมล","📧"),
  W("technology","VIDEO","วิดีโอ","🎬"),
  W("technology","GAME","เกม","🎮"),
  W("technology","ROBOT VACUUM","หุ่นยนต์ดูดฝุ่น","🤖"),
  W("technology","REMOTE","รีโมต","📺"),
  W("technology","CLOCK APP","นาฬิกาปลุก (มือถือ)","⏰"),
  W("technology","PASSWORD","รหัสผ่าน","🔑"),
  W("technology","SCREENSHOT","ภาพหน้าจอ","📸"),
  W("technology","DRONE","โดรน","🛸"),
  W("technology","SATELLITE","ดาวเทียม","🛰️"),
  W("music","VIOLIN","ไวโอลิน","🎻"),
  W("music","TRUMPET","ทรัมเป็ต","🎺"),
  W("music","FLUTE","ขลุ่ย","🪈"),
  W("music","SAXOPHONE","แซกโซโฟน","🎷"),
  W("music","XYLOPHONE","ระนาดฝรั่ง","🎹"),
  W("music","TAMBOURINE","แทมบูรีน","🪘"),
  W("music","HARP","พิณ","🪕"),
  W("music","UKULELE","อูคูเลเล่","🎸"),
  W("music","ACCORDION","หีบเพลง","🪗"),
  W("music","MARACAS","มาราคัส","🪇"),
  W("music","RANAT","ระนาด","🎼"),
  W("music","KHIM","ขิม","🎼"),
  W("music","SONG","เพลง","🎵"),
  W("music","SINGER","นักร้อง","🎤"),
  W("music","CONCERT","คอนเสิร์ต","🎤"),
  W("music","MICROPHONE","ไมโครโฟน","🎤"),
  W("music","RHYTHM","จังหวะ","🥁"),
  W("music","LOUD","เสียงดัง","📢"),
  W("music","QUIET","เงียบ","🤫"),
  W("music","DANCE FLOOR","ฟลอร์เต้น","🪩"),
  W("opposites","BIG","ใหญ่","🐘"),
  W("opposites","SMALL","เล็ก","🐭"),
  W("opposites","TALL","สูง","🦒"),
  W("opposites","SHORT","เตี้ย/สั้น","🐧"),
  W("opposites","LONG","ยาว","🐍"),
  W("opposites","FAST","เร็ว","🐆"),
  W("opposites","SLOW","ช้า","🐢"),
  W("opposites","HOT","ร้อน","🔥"),
  W("opposites","COLD","เย็น","🧊"),
  W("opposites","NEW","ใหม่","✨"),
  W("opposites","OLD","เก่า","🧓"),
  W("opposites","YOUNG","เด็ก/อ่อนวัย","👶"),
  W("opposites","HAPPY","มีความสุข","😊"),
  W("opposites","SAD","เศร้า","😢"),
  W("opposites","CLEAN","สะอาด","🧼"),
  W("opposites","DIRTY","สกปรก","🐷"),
  W("opposites","WET","เปียก","💧"),
  W("opposites","DRY","แห้ง","🌵"),
  W("opposites","FULL","เต็ม","🥛"),
  W("opposites","EMPTY","ว่างเปล่า","🫙"),
  W("opposites","OPEN","เปิดอยู่","🚪"),
  W("opposites","CLOSED","ปิดอยู่","🔒"),
  W("opposites","UP","ขึ้น","⬆️"),
  W("opposites","DOWN","ลง","⬇️"),
  W("opposites","IN","ข้างใน","📥"),
  W("opposites","OUT","ข้างนอก","📤"),
  W("opposites","LEFT","ซ้าย","⬅️"),
  W("opposites","RIGHT","ขวา","➡️"),
  W("opposites","FRONT","ข้างหน้า","🔼"),
  W("opposites","BACK","ข้างหลัง","🔽"),
  W("opposites","NEAR","ใกล้","📍"),
  W("opposites","FAR","ไกล","🗺️"),
  W("opposites","HEAVY","หนัก","🏋️"),
  W("opposites","LIGHT","เบา","🪶"),
  W("opposites","HARD","แข็ง","🪨"),
  W("opposites","SOFT","นุ่ม","🧸"),
  W("opposites","LOUD","ดัง","📢"),
  W("opposites","QUIET","เงียบ","🤫"),
  W("opposites","EASY","ง่าย","👌"),
  W("opposites","DIFFICULT","ยาก","🧩"),
  W("opposites","RICH","รวย","💰"),
  W("opposites","POOR","จน","🪙"),
  W("opposites","STRONG","แข็งแรง","💪"),
  W("opposites","WEAK","อ่อนแอ","🤒"),
  W("opposites","THICK","หนา","📚"),
  W("opposites","THIN","บาง/ผอม","📄"),
  W("opposites","SWEET","หวาน","🍬"),
  W("opposites","SOUR","เปรี้ยว","🍋"),
  W("opposites","SAME","เหมือนกัน","👯"),
  W("opposites","DIFFERENT","ต่างกัน","🔀"),
  W("time","MONDAY","วันจันทร์","💛"),
  W("time","TUESDAY","วันอังคาร","💗"),
  W("time","WEDNESDAY","วันพุธ","💚"),
  W("time","THURSDAY","วันพฤหัสบดี","🧡"),
  W("time","FRIDAY","วันศุกร์","💙"),
  W("time","SATURDAY","วันเสาร์","💜"),
  W("time","SUNDAY","วันอาทิตย์","❤️"),
  W("time","JANUARY","มกราคม","🎆"),
  W("time","FEBRUARY","กุมภาพันธ์","💝"),
  W("time","MARCH","มีนาคม","🌼"),
  W("time","APRIL","เมษายน","💦"),
  W("time","MAY","พฤษภาคม","🌧️"),
  W("time","JUNE","มิถุนายน","☔"),
  W("time","JULY","กรกฎาคม","🌴"),
  W("time","AUGUST","สิงหาคม","💙"),
  W("time","SEPTEMBER","กันยายน","🍂"),
  W("time","OCTOBER","ตุลาคม","🎃"),
  W("time","NOVEMBER","พฤศจิกายน","🏮"),
  W("time","DECEMBER","ธันวาคม","🎄"),
  W("time","TODAY","วันนี้","📅"),
  W("time","TOMORROW","พรุ่งนี้","➡️"),
  W("time","YESTERDAY","เมื่อวาน","⬅️"),
  W("time","MORNING","ตอนเช้า","🌅"),
  W("time","AFTERNOON","ตอนบ่าย","☀️"),
  W("time","EVENING","ตอนเย็น","🌇"),
  W("time","NIGHT","กลางคืน","🌙"),
  W("time","WEEK","สัปดาห์","🗓️"),
  W("time","MONTH","เดือน","📆"),
  W("time","YEAR","ปี","🎉"),
  W("time","HOUR","ชั่วโมง","⏰"),
  W("time","MINUTE","นาที","⏱️"),
  W("time","O'CLOCK","นาฬิกา (ตรง)","🕐"),
  W("time","BIRTHDAY","วันเกิด","🎂"),
  W("time","HOLIDAY","วันหยุด","🏖️"),
  W("time","WEEKEND","สุดสัปดาห์","🎉"),
  W("countries","THAILAND","ประเทศไทย","🇹🇭"),
  W("countries","JAPAN","ญี่ปุ่น","🇯🇵"),
  W("countries","CHINA","จีน","🇨🇳"),
  W("countries","KOREA","เกาหลี","🇰🇷"),
  W("countries","INDIA","อินเดีย","🇮🇳"),
  W("countries","VIETNAM","เวียดนาม","🇻🇳"),
  W("countries","LAOS","ลาว","🇱🇦"),
  W("countries","MYANMAR","พม่า","🇲🇲"),
  W("countries","CAMBODIA","กัมพูชา","🇰🇭"),
  W("countries","MALAYSIA","มาเลเซีย","🇲🇾"),
  W("countries","SINGAPORE","สิงคโปร์","🇸🇬"),
  W("countries","AUSTRALIA","ออสเตรเลีย","🇦🇺"),
  W("countries","ENGLAND","อังกฤษ","🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
  W("countries","AMERICA","อเมริกา","🇺🇸"),
  W("countries","FRANCE","ฝรั่งเศส","🇫🇷"),
  W("countries","ITALY","อิตาลี","🇮🇹"),
  W("countries","EGYPT","อียิปต์","🇪🇬"),
  W("countries","BRAZIL","บราซิล","🇧🇷"),
  W("countries","WORLD","โลก","🌍"),
  W("countries","FLAG","ธงชาติ","🚩"),
];

// เติมคำอ่าน + ประโยคตัวอย่างจาก lexicon.js
INITIAL_WORDS.forEach(w => Object.assign(w, lexOf(w) || {}));

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ═══════════════════════════════════════════════════════
// SAVED WORDS — localStorage (ถ้าใช้ไม่ได้ แอปยังทำงานด้วยคำเริ่มต้น)
// ═══════════════════════════════════════════════════════
const STORAGE_KEY = "smart-vocabplay:words:v1";

function loadSavedWords() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_WORDS;
    const data = JSON.parse(raw);
    const ok = Array.isArray(data) && data.every(w =>
      w && typeof w === "object" && typeof w.id === "number" &&
      typeof w.word === "string" && typeof w.cat === "string");
    if (!ok) return INITIAL_WORDS;
    // คำที่บันทึกไว้ก่อนมี lexicon → เติมคำอ่าน/ประโยคให้ (ค่าที่ผู้ใช้แก้เองมาก่อน)
    let merged = data.map(w => ({ ...(lexOf(w) || {}), ...w }));
    // หมวดใหม่ที่เพิ่มในเวอร์ชันหลัง (ผู้ใช้เก่ายังไม่มี) → เติมทั้งหมวดให้ ใช้ id ต่อจากที่มี
    const have = new Set(merged.map(w => w.cat));
    let nextId = Math.max(0, ...merged.map(w => w.id)) + 1;
    INITIAL_WORDS.forEach(w => { if (!have.has(w.cat)) merged.push({ ...w, id: nextId++ }); });
    return merged;
  } catch (_) {
    return INITIAL_WORDS;
  }
}

function saveWords(words) {
  try {
    if (words === INITIAL_WORDS) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════
export default function App() {
  // Sound unlock — iOS must show this first
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [screen, setScreen] = useState("home");   // home|category|game|manage
  const [activeCat, setActiveCat] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [words, setWords] = useState(loadSavedWords);
  const [profiles, setProfiles] = useState(loadProfiles);
  const [progress, setProgress] = useState(() => loadProgress(loadProfiles().current));
  const [showProfiles, setShowProfiles] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const [updateReg, setUpdateReg] = useState(null);   // service worker เวอร์ชันใหม่รออยู่
  useEffect(() => { const h = e => setUpdateReg(e.detail); window.addEventListener("vp-update", h); return () => window.removeEventListener("vp-update", h); }, []);
  const [installHidden, setInstallHidden] = useState(() => { try { return localStorage.getItem("smart-vocabplay:install-hidden") === "1"; } catch (_) { return false; } });
  const [soundOn, setSoundOn] = useState(true);
  const [bilingual, setBilingual] = useState(true);
  const [rate, setRate] = useState(0.85);
  // ด่านผู้ปกครอง: ก่อนเข้าตั้งค่า/จัดการคำ ต้องตอบโจทย์คูณ (กันเด็กกดมั่ว) · ผ่านแล้วจำ 10 นาที
  const [parentGate, setParentGate] = useState(() => { try { return localStorage.getItem("smart-vocabplay:gate") !== "0"; } catch (_) { return true; } });
  useEffect(() => { try { localStorage.setItem("smart-vocabplay:gate", parentGate ? "1" : "0"); } catch (_) {} }, [parentGate]);
  const [gateFn, setGateFn] = useState(null);
  const gateOk = useRef(0);
  const guard = useCallback(fn => { if (!parentGate || gateOk.current > Date.now()) fn(); else setGateFn(() => fn); }, [parentGate]);
  // ตัวหนังสือใหญ่ (เด็กเล็ก/สายตา): ขยายทั้งแอป 12%
  const [bigText, setBigText] = useState(() => { try { return localStorage.getItem("smart-vocabplay:bigtext") === "1"; } catch (_) { return false; } });
  useEffect(() => { try { localStorage.setItem("smart-vocabplay:bigtext", bigText ? "1" : "0"); document.body.style.zoom = bigText ? "1.12" : ""; } catch (_) {} }, [bigText]);
  // แนะนำวิธีใช้ครั้งแรก (หลังเลือกเพื่อนคู่หู)
  const [onboard, setOnboard] = useState(() => { try { return localStorage.getItem("smart-vocabplay:onboarded") !== "1"; } catch (_) { return true; } });
  const finishOnboard = () => { setOnboard(false); try { localStorage.setItem("smart-vocabplay:onboarded", "1"); } catch (_) {} };
  const [showSettings, setShowSettings] = useState(false);
  const [incomingSet, setIncomingSet] = useState(() => readIncomingSet());   // #set=... จาก QR/ลิงก์
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem("smart-vocabplay:music") === "1"; } catch (_) { return false; } });
  useEffect(() => { try { localStorage.setItem("smart-vocabplay:music", musicOn ? "1" : "0"); } catch (_) {} if (musicOn && soundOn && soundUnlocked) startMusic(); else stopMusic(); }, [musicOn, soundOn, soundUnlocked]);
  useEffect(() => { const h = () => { if (document.hidden) stopMusic(); else if (musicOn && soundOn && soundUnlocked) startMusic(); }; document.addEventListener("visibilitychange", h); return () => document.removeEventListener("visibilitychange", h); }, [musicOn, soundOn, soundUnlocked]);
  const [fxOn, setFxOn] = useState(() => { try { return localStorage.getItem("smart-vocabplay:fx") !== "0"; } catch (_) { return true; } });
  const [nativeVoice, setNativeVoiceOn] = useState(() => { try { return localStorage.getItem("smart-vocabplay:native") !== "0"; } catch (_) { return true; } });
  useEffect(() => { setNativeVoice(nativeVoice); try { localStorage.setItem("smart-vocabplay:native", nativeVoice ? "1" : "0"); } catch (_) {} }, [nativeVoice]);
  useEffect(() => { setFxEnabled(fxOn); try { localStorage.setItem("smart-vocabplay:fx", fxOn ? "1" : "0"); } catch (_) {} }, [fxOn]);
  useEffect(() => { installRipple(); }, []);
  // ธีมแอป (ซื้อในร้าน): ตั้ง data-theme บน <html> → CSS ใน index.html เปลี่ยนพื้นหลัง/ออโรรา/สีหลัก
  useEffect(() => { try { injectM3Css(); applyM3Theme(progress.theme || "aurora"); } catch (_) {} }, [progress.theme]);
  const [realPics, setRealPics] = useState(() => { try { return localStorage.getItem("smart-vocabplay:realpics") !== "0"; } catch (_) { return true; } });
  useEffect(() => { try { localStorage.setItem("smart-vocabplay:realpics", realPics ? "1" : "0"); } catch (_) {} }, [realPics]);
  const [toast, setToast] = useState(null);

  // บันทึกคำศัพท์ / ความคืบหน้า ทุกครั้งที่เปลี่ยน
  useEffect(() => { saveWords(words); }, [words]);
  useEffect(() => { saveProgress(progress, profiles.current); }, [progress, profiles.current]);
  useEffect(() => { saveProfiles(profiles); }, [profiles]);

  // PWA: จับ event ติดตั้ง (Android/Chrome)
  useEffect(() => {
    const h = e => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  useEffect(() => { setSfxEnabled(soundOn); }, [soundOn]);

  // streak: นับวันที่เล่นต่อเนื่อง (ครั้งแรกหลังแตะเริ่ม)
  useEffect(() => {
    if (!soundUnlocked) return;
    setProgress(p => {
      const n = ensureDaily(bumpStreak(p));
      if (n !== p && n.streak.count > 1) setTimeout(() => showToast(`🔥 เล่นต่อเนื่อง ${n.streak.count} วันแล้ว!`), 400);
      return n;
    });
  }, [soundUnlocked]);

  // Load voices on mount
  useEffect(() => {
    if (window.speechSynthesis) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 1800);
  }, []);

  const speak = useCallback((en, th) => {
    if (!soundOn || !soundUnlocked) return;
    speakWord(en, th, rate, bilingual);
  }, [soundOn, soundUnlocked, rate, bilingual]);
  // พูดด้วยความเร็วที่กำหนดเอง (ช้าๆ / ฟังอย่างเดียว) · th = null = พูดแค่อังกฤษ
  // ผู้ช่วยเสียงไทย: อ่านคำสั่ง/คำอธิบายเป็นไทยให้เด็กที่ยังอ่านไทยไม่คล่อง (เรียกใน onClick เท่านั้น)
  const [thaiGuide, setThaiGuide] = useState(() => { try { return localStorage.getItem("smart-vocabplay:thaiguide") !== "0"; } catch (_) { return true; } });
  useEffect(() => { try { localStorage.setItem("smart-vocabplay:thaiguide", thaiGuide ? "1" : "0"); } catch (_) {} }, [thaiGuide]);
  const speakTh = useCallback((th) => {
    if (!thaiGuide || !soundOn || !soundUnlocked || !th) return;
    const clip = clipUrl(th); if (clip) { try { window.speechSynthesis?.cancel(); } catch (_) {} playClips([clip], { rate: 1 }); return; }
    if (!window.speechSynthesis) return;
    const ss = window.speechSynthesis; if (ss.speaking || ss.pending) ss.cancel();
    const u = new SpeechSynthesisUtterance(th); u.lang = "th-TH"; u.rate = Math.min(1, rate + 0.1); const v = getVoice("th"); if (v) u.voice = v; ss.speak(u);
  }, [thaiGuide, soundOn, soundUnlocked, rate]);
  // อ่านหลายประโยคต่อกัน (บทสนทนา) — คิวทั้งหมดทันทีใน onClick ไม่ใช้ timer
  const speakSeq = useCallback((items) => {
    if (!soundOn || !soundUnlocked) return;
    // ไฟล์เสียงจริงครบทุกท่อน → เล่นต่อกัน (ไม่งั้นใช้เสียงเครื่องทั้งชุด เพื่อให้โทนเดียวกัน)
    const segs = items.flatMap(({ en, th }) => bilingual && th ? [clipUrl(en), clipUrl(th)] : [clipUrl(en)]);
    if (segs.length && segs.every(Boolean)) { try { window.speechSynthesis?.cancel(); } catch (_) {} playClips(segs, { rate: rate + 0.1 }); return; }
    if (!window.speechSynthesis) return;
    const ss = window.speechSynthesis;
    if (ss.speaking || ss.pending) ss.cancel();
    items.forEach(({ en, th }) => {
      const u = new SpeechSynthesisUtterance(en); u.lang = "en-US"; u.rate = rate; const v = getVoice("en"); if (v) u.voice = v; ss.speak(u);
      if (bilingual && th) { const t = new SpeechSynthesisUtterance(th); t.lang = "th-TH"; t.rate = rate; const tv = getVoice("th"); if (tv) t.voice = tv; ss.speak(t); }
    });
  }, [soundOn, soundUnlocked, rate, bilingual]);
  const speakAt = useCallback((en, th, r) => {
    if (!soundOn || !soundUnlocked) return;
    speakWord(en, th, r ?? rate, bilingual && !!th);
  }, [soundOn, soundUnlocked, rate, bilingual]);

  // Navigation
  const [navTab, setNavTab] = useState("home");
  const [fullscreenOn, setFullscreenOn] = useState(() => { try { return localStorage.getItem("smart-vocabplay:fullscreen") !== "0"; } catch (_) { return true; } });
  useEffect(() => { try { localStorage.setItem("smart-vocabplay:fullscreen", fullscreenOn ? "1" : "0"); } catch (_) {} }, [fullscreenOn]);
  // เต็มจอเมื่อเข้าเกม (เรียกใน onClick เท่านั้น · iOS Safari ไม่รองรับ → ข้ามเงียบๆ · PWA ที่ติดตั้งแล้วเต็มจออยู่แล้ว)
  const enterFullscreen = () => { if (!fullscreenOn) return; try { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).catch(() => {}); } catch (_) {} };
  const exitFullscreen = () => { try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (_) {} };
  const HUBS = ["home", "learnhub", "playhub", "me"];
  const goTab = t => { sfx.tap(); setNavTab(t); setActiveCat(null); setActiveGame(null); setActiveDialog(null); setActiveStory(null); setScreen(t === "home" ? "home" : t); exitFullscreen(); };
  const goHome     = () => { setScreen("home"); setNavTab("home"); setActiveCat(null); setActiveGame(null); exitFullscreen(); };
  const goCat      = cat => { setActiveCat(cat); setScreen("category"); };
  const GUIDE = { quiz:"ฟังคำ แล้วแตะรูปที่ตรงกัน", spell:"ฟังคำ แล้วแตะตัวอักษรเรียงให้ถูก", memory:"พลิกการ์ดทีละสองใบ หาเสียงกับรูปที่เป็นคู่กัน", speed:"ฟังแล้วรีบแตะรูปให้เร็วที่สุดใน 30 วินาที", habitat:"แตะสัตว์ แล้วแตะบ้านของมัน", match:"แตะลำโพงฟังคำ แล้วแตะรูปที่ตรงกัน", colormix:"เลือกสองสีผสมให้ได้สีเป้าหมาย", count:"นับจำนวนแล้วเลือกตัวเลข", bodydr:"ฟังแล้วแตะส่วนของร่างกาย", dress:"เลือกเสื้อผ้าให้เหมาะกับอากาศ", boss:"ด่านบอส ฟังแล้วแตะรูป สิบข้อ มีหัวใจสามดวง ตอบถูกเจ็ดข้อขึ้นไปจึงชนะ", listen:"แตะลำโพงเพื่อฟัง แล้วเลือกรูปที่ได้ยิน", sentence:"แตะคำเรียงให้เป็นประโยคภาษาอังกฤษ", speak:"แตะไมค์ แล้วพูดคำภาษาอังกฤษตาม", phonics:"ฟังคำ แล้วเลือกตัวอักษรตัวแรก", grammar:"เลือกคำที่ถูกต้องเติมในประโยค", time:"ดูนาฬิกาแล้วเลือกเวลาภาษาอังกฤษ", money:"รวมเงินแล้วเลือกจำนวนบาท", calendar:"ตอบคำถามเรื่องวันและเดือน", numbers100:"ฟังตัวเลขแล้วเลือก", test:"ข้อสอบยี่สิบข้อ ตั้งใจทำนะ", droleplay:"แอปจะพูดอีกฝ่าย ถึงตาหนูให้แตะไมค์แล้วพูดตาม", dfill:"เลือกคำเติมในบทสนทนา", squiz:"ตอบคำถามจากนิทานที่อ่าน", mole:"ฟังคำ แล้วตีตัวตุ่นที่ถือรูปตรงกันให้ทัน", balloon:"ฟังคำ แล้วเจาะลูกโป่งที่มีรูปตรงกันก่อนลอยพ้นจอ", ninja:"ปาดนิ้วผ่านรูปที่ตรงกับเสียง ระวังอย่าฟันผิด", bingo:"ฟังคำ แล้วแตะรูปในตาราง ให้ครบสามช่องเป็นแถว", runner:"วิ่งไปชนป้ายรูปที่ได้ยิน ปัดนิ้วซ้ายขวาเพื่อเปลี่ยนเลน เก็บเหรียญด้วยนะ", feed:"เพื่อนคู่หูหิวแล้ว ฟังคำแล้วป้อนอาหารที่ถูกให้เลย" };
  const goGame     = gid => { setActiveGame(gid); setScreen("game"); enterFullscreen(); speakTh(GUIDE[gid]); };
  const goManage   = () => guard(() => setScreen("manage"));
  const openSettings = () => guard(() => setShowSettings(true));
  const goStickers = () => setScreen("stickers");
  const goShop     = () => setScreen("shop");
  const goRoom     = () => setScreen("room");
  const goReport   = () => setScreen("report");
  const goCredits  = () => setScreen("credits");
  const goLearn    = () => { setScreen("learn"); enterFullscreen(); speakTh("การ์ดคำศัพท์ แตะการ์ดเพื่อดูความหมาย ถ้ารู้แล้วแตะปุ่มสีเขียว"); };
  const goPath     = () => setScreen("path");
  const [activeDialog, setActiveDialog] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const goTalk     = () => { setActiveDialog(null); setScreen("talk"); };
  const goStories  = () => { setActiveStory(null); setScreen("stories"); };
  const goPhonics  = () => setScreen("phonics");
  const goGrammar  = () => setScreen("grammar");
  const goDaily    = () => setScreen("daily");
  const goTest     = () => setScreen("test");
  const goVersus   = () => setScreen("versus");
  const startPseudoGame = (cat, gid) => { setActiveCat(cat); setActiveGame(gid); setScreen("game"); enterFullscreen(); speakTh(GUIDE[gid]); };
  // เส้นทางบทเรียน: เปิดขั้นของบท (learn / quiz / listen) ด้วยหมวดเสมือน unit:<id>
  const goUnitStep = (u, step) => {
    setActiveCat({ ...u.cat, id: `unit:${u.id}`, label: `บทที่ ${u.n} · ${u.cat.label}`, unit: u });
    if (step === "learn") { setActiveGame(null); setScreen("learn"); speakTh(`บทที่ ${u.n} เรียนการ์ดคำศัพท์ก่อนนะ`); }
    else { setActiveGame(step); setScreen("game"); speakTh(GUIDE[step]); }
    enterFullscreen();
  };
  const switchProfile = id => {
    if (id === profiles.current) { setShowProfiles(false); return; }
    setProfiles(pf => ({ ...pf, current: id }));
    setProgress(ensureDaily(bumpStreak(loadProgress(id))));
    setShowProfiles(false);
    const pf = profiles.list.find(x => x.id === id); if (pf) showToast(`สวัสดี ${pf.name} ${pf.avatar}`);
  };
  const addProfile = (name, avatar) => {
    const id = "p" + Date.now().toString(36);
    setProfiles(pf => ({ list: [...pf.list, { id, name, avatar }], current: id }));
    setProgress(ensureDaily(bumpStreak({ ...EMPTY_PROGRESS })));
    setShowProfiles(false); showToast(`ยินดีต้อนรับ ${name} ${avatar}`);
  };
  const removeProfile = id => {
    deleteProgress(id);
    setProfiles(pf => {
      const list = pf.list.filter(x => x.id !== id);
      const current = pf.current === id ? list[0].id : pf.current;
      if (pf.current === id) setProgress(ensureDaily(bumpStreak(loadProgress(current))));
      return { list, current };
    });
  };
  const goReview   = () => { setActiveCat(REVIEW_CAT); setActiveGame("quiz"); setScreen("game"); enterFullscreen(); speakTh("มาทบทวนคำที่เคยพลาดกัน ฟังแล้วแตะรูปให้ถูกนะ"); };
  const goBack     = () => {
    if (screen === "game" || screen === "learn" || screen === "versus") exitFullscreen();
    if (screen === "game" && activeCat?.id === "review") { goHome(); }
    else if (screen === "talk" && activeDialog) { setActiveDialog(null); }
    else if (screen === "stories" && activeStory) { setActiveStory(null); }
    else if (screen === "game" && activeCat?.id === "phonics:all") { setScreen("phonics"); setActiveCat(null); setActiveGame(null); }
    else if (screen === "game" && activeCat?.back) { setScreen(activeCat.back); setActiveCat(null); setActiveGame(null); }
    else if ((screen === "game" || screen === "learn") && activeCat?.unit) { setScreen("path"); setActiveGame(null); setActiveCat(null); }
    else if (screen === "game" || screen === "learn") { setScreen("category"); setActiveGame(null); }
    else if (screen === "category") { setScreen(navTab === "home" ? "home" : navTab); }
    else                       { setScreen(navTab === "home" ? "home" : navTab); }
  };
  // ปุ่ม Back ของ Android/เบราว์เซอร์ → ย้อนในแอป (ปิดแผ่น/กลับหน้าก่อน) แทนที่จะปิดแอป
  //  วิธี: เมื่อไม่ได้อยู่หน้าแท็บหลัก ดัน history state เฝ้าไว้ 1 ชั้น · popstate = ผู้ใช้กด Back → ทำ goBack แล้ว effect จะดันใหม่ถ้ายังไม่ถึงราก
  const atRoot = HUBS.includes(screen) && !showSettings && !showProfiles;
  useEffect(() => {
    try { if (!atRoot && !window.history.state?.vp) window.history.pushState({ vp: 1 }, ""); } catch (_) {}
  }, [atRoot, screen, showSettings, showProfiles, activeDialog, activeStory, activeCat]);
  useEffect(() => {
    const h = () => {
      if (showSettings) setShowSettings(false);
      else if (showProfiles) setShowProfiles(false);
      else if (!HUBS.includes(screen)) goBack();
    };
    window.addEventListener("popstate", h); return () => window.removeEventListener("popstate", h);
  });
  // เปลี่ยนหน้าแล้วเลื่อนขึ้นบนสุดเสมอ (ไม่งั้นเปิดหมวดจากท้ายหน้าแรกจะเห็นตรงกลางหน้า)
  useEffect(() => { try { window.scrollTo(0, 0); } catch (_) {} }, [screen, activeCat, activeDialog, activeStory]);
  const immersive = ["game", "learn", "versus"].includes(screen);
  const showNav = !immersive && screen !== "credits" && !showSettings && !showProfiles;   // ซ่อนแท็บล่างตอนเปิดแผ่นตั้งค่า/โปรไฟล์
  // พื้นโหมดเกม: สีหมวดผสมกับ surface ของธีม (M3 tonal) → ยังรู้ว่าอยู่หมวดไหน แต่โทนเดียวกับทั้งแอปและใช้ได้ในโหมดมืด
  const immersiveBg = `linear-gradient(180deg, color-mix(in oklab, ${CAT_ACCENT[activeCat?.id] ? accentOf(activeCat.id).fill : "var(--md-primary)"} 16%, var(--md-surface)) 0%, var(--md-surface) 32%)`;
  const headerTitle = ({ home:"", learnhub:"เรียน", playhub:"เล่น", me:"ของฉัน", manage:"จัดการคำศัพท์", stickers:"สมุดสติกเกอร์", shop:"ร้านค้า", room:"ห้องเพื่อนคู่หู", report:"รายงานผู้ปกครอง", credits:"เครดิตรูปภาพ", path:"เส้นทางบทเรียน", talk:"บทสนทนา", stories:"นิทานภาพ", phonics:"โฟนิกส์", grammar:"ไวยากรณ์", daily:"ชีวิตประจำวัน", test:"สอบวัดระดับ", versus:"แข่ง 2 คน" })[screen] ?? (activeCat?.label || "");

  // คำที่ถึงกำหนดทบทวนวันนี้ (SRS) + คำที่เคยพลาด เรียงจากพลาดบ่อยสุด
  const missedWords = useMemo(() => {
    const m = progress.mistakes || {}, srs = progress.srs || {};
    return words.filter(w => m[w.id] > 0 || isDue(srs, w.id)).sort((a, b) => (m[b.id] || 0) - (m[a.id] || 0));
  }, [words, progress.mistakes, progress.srs]);
  const stickerCount = useMemo(() => words.filter(w => (progress.stickers[w.id] || 0) >= STICKER_NEED).length, [words, progress.stickers]);

  const catWords = useMemo(
    () => !activeCat ? [] : activeCat.unit ? activeCat.unit.words : activeCat.id === "review" ? missedWords.slice(0, 10) : (activeCat.id === "phonics:all" || activeCat.back) ? words : words.filter(w => w.cat === activeCat.id),
    [words, activeCat, missedWords]
  );
  const units = useMemo(() => buildUnits(words, CATEGORIES), [words]);

  // ตัวเลขบนไอคอนแอป (เมื่อติดตั้งแล้ว) = จำนวนคำที่ถึงเวลาทบทวน
  useEffect(() => {
    try { if (navigator.setAppBadge) { missedWords.length ? navigator.setAppBadge(missedWords.length) : navigator.clearAppBadge?.(); } } catch (_) {}
  }, [missedWords.length]);

  // ── Sound unlock screen ──────────────────
  // หน้า audit (dev): เปิด ?audit=1 → ตัวเลขความครบของเนื้อหา (รูป/ภาพออกแบบ/อีโมจิ · เสียงคนจริง · คำอ่าน/ประโยค) อ่านโดย scripts/audit.cjs
  if (typeof window !== "undefined" && /[?&]audit=1/.test(window.location.search)) {
    const rows = INITIAL_WORDS.map(w => {
      const t = imageTitleOf(w); const photo = !!(t && cachedImageUrl(t)); const concept = !photo && !!conceptFor(w);
      const lx = lexOf(w); const parts = w.word.toLowerCase().split(/[\s-]+/);
      const audio = !!audioManifest[w.word.toLowerCase()] || (parts.length > 1 && parts.every(x => audioManifest[x]));
      return { key:`${w.cat}|${w.word}`, visual: photo ? "photo" : concept ? "concept" : "emoji", audio, read: !!lx?.read, sen: !!lx?.sen };
    });
    const cnt = k => rows.filter(r => r.visual === k).length;
    const byCat = {}; rows.forEach(r => { const c = r.key.split("|")[0]; byCat[c] = byCat[c] || { n:0, emoji:[] }; byCat[c].n++; if (r.visual === "emoji") byCat[c].emoji.push(r.key.split("|")[1]); });
    const report = { version: APP_VERSION, words: rows.length, photo: cnt("photo"), concept: cnt("concept"), emoji: cnt("emoji"), emojiWords: rows.filter(r => r.visual === "emoji").map(r => r.key),
      audio: rows.filter(r => r.audio).length, noAudio: rows.filter(r => !r.audio).map(r => r.key), noRead: rows.filter(r => !r.read).map(r => r.key), noSentence: rows.filter(r => !r.sen).map(r => r.key),
      dialogues: DIALOGUES.length, stories: STORIES.length, grammar: GRAMMAR.length, phonics: PHONICS.length, games: Object.keys(GAME_META).length, byCat,
      ttsClips: ttsManifest.length, sentenceClips: rows.filter(r => { const w = INITIAL_WORDS.find(x => `${x.cat}|${x.word}` === r.key); const lx = lexOf(w); return lx?.sen && clipUrl(lx.sen); }).length };
    return <pre id="audit" style={{ fontFamily:"monospace",fontSize:11,padding:12,whiteSpace:"pre-wrap" }}>{JSON.stringify(report, null, 1)}</pre>;
  }
  // หน้าตรวจภาพออกแบบทั้งชุด (dev): เปิด ?concepts=1 → ตารางทุกคำที่มีภาพใน Concept.jsx
  if (typeof window !== "undefined" && /[?&]concepts=1/.test(window.location.search)) {
    const list = INITIAL_WORDS.filter(w => conceptFor(w));
    return <div style={{ fontFamily:FONT,padding:12,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,background:T.card }}>
      {list.map(w => <div key={w.id} style={{ textAlign:"center",fontSize:11 }}><div style={{ aspectRatio:"16/11",borderRadius:16,overflow:"hidden",boxShadow:"0 4px 12px rgba(0,0,0,.12)" }}>{conceptFor(w)}</div><b>{w.cat}|{w.word}</b> {w.meaning}</div>)}
      <div style={{ gridColumn:"1/-1" }}>ทั้งหมด {list.length} ภาพ</div>
    </div>;
  }
  if (!soundUnlocked) {
    return (
      <SoundUnlockScreen onUnlock={() => {
        // CRITICAL: call unlockAudio() synchronously inside the button's onClick
        unlockAudio();
        unlockSfx();
        sfx.coin();
        setSoundUnlocked(true);
      }} />
    );
  }

  const SCREENS = (
    <>
        {screen === "home" && (
          <HomeScreen categories={CATEGORIES} words={words} onPickCat={goCat}
            progress={progress} setProgress={setProgress} stickerCount={stickerCount}
            missedCount={missedWords.length} onReview={goReview} onStickers={goStickers} onShop={goShop} onRoom={goRoom} onPath={goPath} onTalk={goTalk} onStories={goStories} onPhonics={goPhonics} onGrammar={goGrammar} onDaily={goDaily} onTest={goTest} onVersus={goVersus} onQuickGame={startPseudoGame} speak={speak}
            units={units} profile={profiles.list.find(x => x.id === profiles.current)} onProfiles={() => setShowProfiles(true)}
            install={!installHidden ? { evt: installEvt, onInstall: async () => { try { installEvt.prompt(); const r = await installEvt.userChoice; if (r?.outcome === "accepted") showToast("ติดตั้งแล้ว 📲"); } catch (_) {} setInstallEvt(null); },
              onDismiss: () => { setInstallHidden(true); try { localStorage.setItem("smart-vocabplay:install-hidden", "1"); } catch (_) {} } } : null} />
        )}
        {screen === "category" && activeCat && (
          <CategoryScreen cat={activeCat} words={catWords} onPickGame={goGame} onLearn={goLearn} progress={progress} showToast={showToast} />
        )}
        {screen === "learnhub" && (
          <LearnHub words={words} categories={CATEGORIES} progress={progress} units={units} onPath={goPath} onCat={goCat} onTalk={goTalk} onStories={goStories} onPhonics={goPhonics} onGrammar={goGrammar} onDaily={goDaily} />
        )}
        {screen === "playhub" && (
          <PlayHub words={words} categories={CATEGORIES} progress={progress} missedCount={missedWords.length} onCat={goCat} onReview={goReview} onVersus={goVersus} onTest={goTest} />
        )}
        {screen === "me" && (
          <MeHub words={words} progress={progress} setProgress={setProgress} stickerCount={stickerCount} profile={profiles.list.find(x => x.id === profiles.current)}
            onProfiles={() => setShowProfiles(true)} onStickers={goStickers} onShop={goShop} onRoom={goRoom} onReport={goReport} onManage={goManage} onSettings={openSettings} onCredits={goCredits} speak={speak} />
        )}
        {screen === "learn" && activeCat && (
          <FlashCards cat={activeCat} words={catWords} speak={speak} speakAt={speakAt} setProgress={setProgress} showToast={showToast}
            onDone={() => { if (activeCat.unit) setProgress(p => markUnitStep(p, activeCat.unit.id, "learn")); goBack(); }} />
        )}
        {screen === "path" && (
          <PathScreen units={units} progress={progress} onStep={goUnitStep} />
        )}
        {screen === "talk" && !activeDialog && (
          <TalkScreen words={words} progress={progress} onOpen={setActiveDialog} />
        )}
        {screen === "talk" && activeDialog && (
          <DialogueScreen key={activeDialog.id} d={activeDialog} words={words} speak={speak} speakAt={speakAt} speakSeq={speakSeq} showToast={showToast} progress={progress} setProgress={setProgress} onBack={() => setActiveDialog(null)} />
        )}
        {screen === "stories" && !activeStory && (
          <StoriesScreen words={words} progress={progress} onOpen={setActiveStory} />
        )}
        {screen === "stories" && activeStory && (
          <StoryReader key={activeStory.id} s={activeStory} words={words} speak={speak} speakAt={speakAt} showToast={showToast} progress={progress} setProgress={setProgress} onBack={() => setActiveStory(null)} />
        )}
        {screen === "grammar" && (
          <GrammarScreen words={words} speak={speak} progress={progress}
            onPractice={g => startPseudoGame({ id:`grammar:${g.id}`, label:`ไวยากรณ์ · ${g.title}`, thai:g.titleTh, emoji:g.emoji, color:T.tertiary, games:["grammar"], lesson:g, back:"grammar" }, "grammar")} />
        )}
        {screen === "daily" && (
          <DailyScreen words={words} speak={speak} speakAt={speakAt} progress={progress}
            onGame={k => startPseudoGame({ id:`daily:${k}`, label:{ time:"บอกเวลา", money:"นับเงินบาท", calendar:"วัน-เดือน", numbers100:"ตัวเลข 1–100" }[k], thai:"ชีวิตประจำวัน", emoji:"🧭", color:T.primary, games:[k], kind:k, back:"daily" }, k)} />
        )}
        {screen === "test" && (
          <CertificateScreen progress={progress} profile={profiles.list.find(x => x.id === profiles.current)} words={words}
            onStart={() => startPseudoGame({ id:"test:placement", label:"สอบวัดระดับ", thai:"สอบ", emoji:"📝", color:T.primary, games:["test"], back:"test", allWords: words,
              onTestDone: (score, total) => setProgress(p => ({ ...p, cert: { score, total, date: new Date().toLocaleDateString("th-TH", { day:"numeric", month:"long", year:"numeric" }) } })) }, "test")} />
        )}
        {screen === "versus" && (
          <VersusScreen words={words} categories={CATEGORIES} speak={speak} setProgress={setProgress} showToast={showToast} onExit={goHome} />
        )}
        {screen === "phonics" && (
          <PhonicsScreen words={words} speak={speak} speakAt={speakAt} showToast={showToast} progress={progress} setProgress={setProgress}
            onGame={() => { setActiveCat({ id:"phonics:all", label:"โฟนิกส์ · เสียงแรก", thai:"โฟนิกส์", emoji:"🔤", color:"#06b6d4", games:["phonics"] }); setActiveGame("phonics"); setScreen("game"); }} />
        )}
        {screen === "game" && activeCat && activeGame && (
          <GameRouter
            gameId={activeGame} cat={activeCat}
            words={catWords} speak={speak}
            showToast={showToast} onBack={goBack}
            progress={progress} setProgress={setProgress} allWords={words} speakAt={speakAt}
          />
        )}
        {screen === "room" && (
          <PetRoom progress={progress} setProgress={setProgress} speak={speak} showToast={showToast} onShop={goShop} />
        )}
        {screen === "shop" && (
          <ShopScreen progress={progress} setProgress={setProgress} showToast={showToast} />
        )}
        {screen === "report" && (
          <ReportScreen words={words} categories={CATEGORIES} progress={progress} profile={profiles.list.find(x => x.id === profiles.current)} />
        )}
        {screen === "credits" && (
          <CreditsScreen words={words} />
        )}
        {screen === "stickers" && (
          <StickerBook words={words} categories={CATEGORIES} progress={progress} speak={speak} showToast={showToast} />
        )}
        {screen === "manage" && (
          <ManageScreen
            words={words} setWords={setWords}
            categories={CATEGORIES}
            showToast={showToast} speak={speak}
            onReset={() => { setWords(INITIAL_WORDS); showToast("คืนค่าคำศัพท์เริ่มต้นแล้ว ✓"); }}
          />
        )}
    </>
  );
  return (
    <PicCtx.Provider value={realPics}>
    {fxOn && !immersive && <Ambient />}
    <div style={{ fontFamily: FONT, color: T.ink, minHeight: "100dvh", paddingBottom: showNav ? 100 : 0, position:"relative", zIndex:1 }}>
      {/* HEADER (ไม่แสดงในโหมดเต็มจอ) */}
      {!immersive && (
        <Header screen={screen} title={headerTitle} onBack={screen !== "home" && !HUBS.includes(screen) ? goBack : null}
          profile={profiles.list.find(x => x.id === profiles.current)} onProfiles={() => setShowProfiles(true)}
          soundOn={soundOn} onToggleSound={() => setSoundOn(v => !v)} onSettings={openSettings} coins={progress.coins} streak={progress.streak.count} />
      )}

      {/* CONTENT */}
      {immersive ? (
        <div style={{ position:"fixed",inset:0,zIndex:60,display:"flex",flexDirection:"column",background:immersiveBg,overflow:"hidden",animation: fxOn ? "vpZoomIn .5s cubic-bezier(.2,.8,.2,1) both" : "none" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,padding:"calc(env(safe-area-inset-top, 0px) + 8px) 10px 6px",flexShrink:0 }}>
            <button onClick={goBack} aria-label="ย้อนกลับ" className="m3-press" style={M3.iconBtn({ background:"color-mix(in oklab, var(--md-surface) 55%, transparent)",color:T.ink,fontSize:24,backdropFilter:"blur(8px)" })}>‹</button>
            <div style={{ flex:1,minWidth:0,...TYPE.titleM,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{headerTitle}</div>
            <button onClick={() => setSoundOn(v => !v)} aria-label="เสียง" className="m3-press" style={M3.iconBtn({ background:"color-mix(in oklab, var(--md-surface) 55%, transparent)",color:T.ink,fontSize:18 })}>{soundOn ? "🔊" : "🔇"}</button>
          </div>
          <div style={{ flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
            {SCREENS}
          </div>
        </div>
      ) : (
        <div key={screen + ":" + (activeCat?.id || "") + (activeDialog?.id || "") + (activeStory?.id || "")} style={{ paddingTop: screen === "home" ? 0 : 64, animation: fxOn ? "vpPage .45s cubic-bezier(.2,.8,.2,1) both" : "none" }}>
          {SCREENS}
        </div>
      )}

      {/* BOTTOM NAV */}
      {showNav && <BottomNav tab={navTab} onTab={goTab} />}

      {/* SETTINGS */}
      {showProfiles && (
        <ProfileSheet profiles={profiles} onSwitch={switchProfile} onAdd={addProfile} onDelete={removeProfile} onClose={() => setShowProfiles(false)} />
      )}

      {gateFn && <ParentGate onPass={() => { gateOk.current = Date.now() + 10 * 60 * 1000; const fn = gateFn; setGateFn(null); fn(); }} onClose={() => setGateFn(null)} />}
      {onboard && progress.pet && !incomingSet && <OnboardingSheet speakTh={speakTh} onDone={finishOnboard} />}
      {incomingSet && soundUnlocked && <ImportSetSheet encoded={incomingSet} words={words} setWords={setWords} showToast={showToast} onClose={() => setIncomingSet(null)} />}
      {showSettings && (
        <SettingsSheet
          soundOn={soundOn} setSoundOn={setSoundOn}
          bilingual={bilingual} setBilingual={setBilingual}
          rate={rate} setRate={setRate}
          onResetProgress={() => { setProgress(ensureDaily({ ...EMPTY_PROGRESS })); setShowSettings(false); showToast("เริ่มใหม่แล้ว ✓"); }}
          onReport={() => { setShowSettings(false); goReport(); }}
          onCredits={() => { setShowSettings(false); goCredits(); }}
          realPics={realPics} setRealPics={setRealPics}
          fullscreenOn={fullscreenOn} setFullscreenOn={setFullscreenOn}
          thaiGuide={thaiGuide} setThaiGuide={setThaiGuide}
          fxOn={fxOn} setFxOn={setFxOn} musicOn={musicOn} setMusicOn={setMusicOn}
          nativeVoice={nativeVoice} setNativeVoiceOn={setNativeVoiceOn}
          bigText={bigText} setBigText={setBigText} parentGate={parentGate} setParentGate={setParentGate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* UPDATE BANNER — มีเวอร์ชันใหม่ */}
      {updateReg && (
        <div style={{ position:"fixed",left:12,right:12,bottom:16,zIndex:8900,background:T.ink,color:"#fff",borderRadius:16,padding:"10px 12px 10px 16px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 10px 30px rgba(0,0,0,0.3)",maxWidth:456,margin:"0 auto" }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontWeight:800,fontSize:13 }}>🎁 มีเวอร์ชันใหม่ของแอป</div>
            <div style={{ fontSize:11,opacity:0.8 }}>ตอนนี้ v{APP_VERSION} · แตะอัปเดตเพื่อโหลดของใหม่</div>
          </div>
          <button onClick={() => { try { updateReg.waiting?.postMessage("SKIP_WAITING"); } catch (_) {} setTimeout(() => window.location.reload(), 1500); }}
            style={{ minHeight:44,padding:"0 14px",borderRadius:16,border:"none",background:T.ok,color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer" }}>อัปเดต</button>
          <button onClick={() => setUpdateReg(null)} style={{ width:44,height:44,borderRadius:16,border:"none",background:"transparent",color:T.ink3,fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="err"?"#EF4444": toast.type==="warn"?"#F59E0B":"#10B981",
          color:"#fff", padding:"8px 20px", borderRadius:999,
          fontWeight:700, fontSize:14, zIndex:9000,
          pointerEvents:"none", whiteSpace:"nowrap",
          boxShadow:"0 4px 16px rgba(0,0,0,0.2)",
        }}>{toast.msg}</div>
      )}
    </div>
    </PicCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════
// SOUND UNLOCK SCREEN (iOS fix)
// ═══════════════════════════════════════════════════════
function SoundUnlockScreen({ onUnlock }) {
  return (
    <div style={{ minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center",fontFamily:FONT,background:T.bg,color:T.ink,position:"relative",overflow:"hidden" }}>
      <Shape kind="burst" size={520} fill={T.primaryC} spin style={{ position:"absolute",top:-260,right:-200,opacity:.9 }} />
      <Shape kind="clover" size={300} fill={T.tertiaryC} spin style={{ position:"absolute",bottom:-140,left:-120,opacity:.9 }} />
      <Shape kind="cookie6" size={120} fill={T.secondaryC} style={{ position:"absolute",top:"18%",left:"8%",opacity:.8 }} />
      <div style={{ position:"relative",animation:"vpInScale .8s both" }}>
        <Shape kind="cookie12" size={168} fill={T.primary} morph><span style={{ fontSize:84,lineHeight:1,animation:"vpWiggle 3s 1s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 6px 10px rgba(0,0,0,.2))" }}>📚</span></Shape>
      </div>
      <h1 style={{ ...TYPE.displayS,margin:"26px 0 8px",position:"relative",color:T.ink }}>Smart VocabPlay</h1>
      <p style={{ ...TYPE.bodyL,color:T.ink2,margin:"0 0 32px",maxWidth:340,position:"relative" }}>
        เรียนอังกฤษแบบเด็กยุคใหม่ · {INITIAL_WORDS.length.toLocaleString()} คำพร้อมรูปจริงและเสียงเจ้าของภาษา · บทสนทนา · นิทาน · โฟนิกส์ · 24 เกม · เพื่อนคู่หูที่โตไปกับหนู
      </p>
      <button onClick={e => { fx.burst(e.clientX, e.clientY, { count: 28 }); onUnlock(); }} className="m3-press" style={M3.filled({ minHeight:64,padding:"0 40px",fontSize:19,fontWeight:700,position:"relative",boxShadow:MD.shadow })}>
        🔊 แตะเพื่อเริ่มเลย
      </button>
      <p style={{ ...TYPE.bodyS,color:T.ink3,marginTop:20,position:"relative" }}>
        แตะปุ่มเพื่อเปิดเสียงบนมือถือ<br/>
        <span style={{ fontWeight:700 }}>v{APP_VERSION}</span>{BUILD_TIME && <span> · build {BUILD_TIME}</span>}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════
function Header({ screen, title, onBack, profile, onProfiles, soundOn, onToggleSound, onSettings, coins, streak }) {
  const SettingsIcon = <svg width="24" height="24" viewBox="0 0 24 24"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.4l-.4 2.7c-.6.2-1.2.6-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .3.2.5.5.5h4c.2 0 .5-.2.5-.4l.4-2.7c.6-.2 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" fill="currentColor" /></svg>;
  if (screen === "home") return (
    <div style={{ display:"flex",alignItems:"center",gap:8,padding:"calc(env(safe-area-inset-top, 0px) + 10px) 12px 0",maxWidth:560,margin:"0 auto",minHeight:64 }}>
      <button onClick={() => { sfx.tap(); onProfiles(); }} className="m3-press" style={{ display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",padding:"4px 6px 4px 4px",minHeight:48,textAlign:"left",fontFamily:FONT,borderRadius:999 }}>
        <Shape kind="cookie9" size={44} fill={T.primaryC}><span style={{ fontSize:22 }}>{profile?.avatar || "🧒"}</span></Shape>
        <div><div style={{ ...TYPE.labelM,color:T.ink2 }}>สวัสดี 👋</div><div style={{ ...TYPE.titleM,color:T.ink,lineHeight:1.1 }}>{profile?.name || "หนู"} <span style={{ fontSize:11,color:T.ink3 }}>▾</span></div></div>
      </button>
      <div style={{ flex:1 }} />
      <div style={M3.assist()}>🪙 {coins}{streak > 0 && <span style={{ color:T.error }}> · 🔥{streak}</span>}</div>
      <button onClick={onSettings} aria-label="ตั้งค่า" style={M3.iconBtn()}>{SettingsIcon}</button>
    </div>
  );
  return <M3TopBar title={title} onBack={onBack} actions={<>
    <button onClick={onToggleSound} aria-label="เสียง" style={M3.iconBtn()}>{soundOn ? "🔊" : "🔇"}</button>
    <button onClick={onSettings} aria-label="ตั้งค่า" style={M3.iconBtn()}>{SettingsIcon}</button>
  </>} />;
}

// แถบนำทางล่างแบบแคปซูลลอย
function BottomNav({ tab, onTab }) {
  return <M3NavBar tabs={[["home","หน้าแรก"],["learnhub","เรียน"],["playhub","เล่น"],["me","ของฉัน"]]} tab={tab} onTab={onTab} />;
}

const IB = { width:48,height:48,borderRadius:24,background:T.surfHigh,color:T.ink,fontSize:19 };
const Btn = ({ onClick, children, style={} }) => (
  <button onClick={onClick} style={{ border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",...style }}>
    {children}
  </button>
);

// ═══════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════
// QR ลิงก์เว็บเกม: ให้เพื่อน/ผู้ปกครองสแกนเปิดบนมือถือ
function QrCard() {
  const svg = useMemo(() => {
    try { const url = (typeof location !== "undefined" ? location.origin + location.pathname : "https://xarif09.github.io/Smart-VocabPlay-/"); const q = qrcode(0, "M"); q.addData(url, "Byte"); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (_) { return ""; }
  }, []);
  if (!svg) return null;
  return (
    <div style={{ ...M3.card({ margin:"8px 0",padding:12 }),display:"flex",alignItems:"center",gap:14 }}>
      <div aria-label="QR code เปิดเกม" style={{ width:96,height:96,flex:"none",background:"#fff",borderRadius:12,padding:2,overflow:"hidden" }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:800,fontSize:15,color:T.ink }}>📱 สแกนเล่นบนมือถือ</div>
        <div style={{ fontSize:12,color:T.ink2,marginTop:2 }}>ให้เพื่อนหรือพ่อแม่สแกนเพื่อเปิดเกมนี้ได้เลย</div>
      </div>
    </div>
  );
}
function HomeScreen({ categories, words, onPickCat, progress, setProgress, stickerCount, missedCount, onReview, onStickers, onShop, onRoom, onPath, onTalk, onStories, onPhonics, onGrammar, onDaily, onTest, onVersus, speak, units, profile, onProfiles, install, onQuickGame }) {
  const careNow = progress.pet ? tickCare(progress.care) : null;
  const careAvg = careNow ? (careNow.hunger + careNow.clean + careNow.fun + careNow.energy) / 4 : 100;
  const unitsDone = units.filter(u => unitDone(progress.path, u)).length;
  const nextUnit = units.find(u => !unitDone(progress.path, u));
  const pet = getPet(progress);
  const thumbOf = cat => (imageTitleOf(coverWord(cat)) ? coverWord(cat) : words.find(w => w.cat === cat.id && imageTitleOf(w)));
  const tiles = [["💬","บทสนทนา",`${DIALOGUES.length} สถานการณ์`,T.grad,onTalk],["📖","นิทานภาพ",`${STORIES.length} เรื่อง`,T.grad,onStories],["🔤","โฟนิกส์","A–Z + เกม",T.grad,onPhonics],
    ["✍️","ไวยากรณ์",`${GRAMMAR.length} บทเรียน`,T.grad,onGrammar],["🧭","ชีวิตประจำวัน","เวลา เงิน วัน",T.grad,onDaily],["📝","สอบวัดระดับ",progress.cert?`ได้ระดับ ${LEVELS_TEST.find(l=>progress.cert.score>=l.min)?.level}`:"20 ข้อ + ใบประกาศ",T.grad,onTest]];
  // เกมแนะนำ: หมวดของบทถัดไป · เกมแรกที่ยังไม่ได้ดาว (เน้นเกมฟัง-แตะรูป)
  const fCat = (nextUnit && categories.find(c => c.id === nextUnit.cat.id)) || categories[0];
  const fGames = fCat.games.filter(g => g !== "boss");   // ลำดับของหมวด: เกมเฉพาะหมวดมาก่อน
  const fGame = fGames.find(g => !progress.stars[`${fCat.id}:${g}`]) || fGames[0];
  const fWord = thumbOf(fCat);
  const go = (cat, g) => { sfx.tap(); onQuickGame ? onQuickGame(cat, g) : onPickCat(cat); };
  const bubbles = [["droleplay","บทสนทนา",onTalk],["squiz","นิทานภาพ",onStories],["phonics","โฟนิกส์",onPhonics],["grammar","ไวยากรณ์",onGrammar],["time","ชีวิตประจำวัน",onDaily],["test","สอบวัดระดับ",onTest]];
  const sec = t => <div style={{ ...TYPE.titleL,color:T.ink,margin:"22px 4px 12px",display:"flex",alignItems:"baseline",gap:8 }}>{t}</div>;
  return (
    <div style={{ padding:"6px 16px 24px",maxWidth:560,margin:"0 auto" }}>
      {!progress.pet ? (
        <PetCard progress={progress} setProgress={setProgress} stickerCount={stickerCount} totalWords={words.length} onStickers={onStickers} onShop={onShop} speak={speak} profile={profile} onProfiles={onProfiles} />
      ) : (
        /* เวทีหลัก v3.16: เพื่อนคู่หูตัวใหญ่ + ลูกโป่งคำพูด + แถบเลเวลเหลือง + ปุ่มเล่นเลยสีแดดนูน */
        <>
        <div style={{ position:"relative",borderRadius:28,overflow:"hidden",background:MD.heroGrad,color:"#fff",padding:20,marginBottom:14,boxShadow:`0 6px 0 ${T.primaryEdge}`,animation:"vpInUp .6s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button onClick={() => { sfx.tap(); speak(`Hi! Let's play ${fCat.label}!`, `มาเล่น${fCat.thai}กันเถอะ`); }} className="m3-press" aria-label="เพื่อนคู่หู" style={{ flex:"none",width:120,height:120,borderRadius:"50%",border:"none",cursor:"pointer",background:"radial-gradient(circle, rgba(255,255,255,.38), transparent 70%)",display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>
              <PetAvatar pet={pet} hat={progress.hat} outfit={progress.outfit} size={84} mood={careNow?.sleeping ? "sleepy" : careAvg < 40 || missedCount > 5 ? "sad" : "happy"} bounce />
            </button>
            <div style={{ flex:1,minWidth:0,background:"#fff",color:T.ink,borderRadius:"20px 20px 20px 6px",padding:"12px 14px",fontFamily:HFONT,fontSize:17,fontWeight:600,lineHeight:1.3 }}>
              มาเล่น <span style={{ color:accentOf(fCat.id).edge }}>{fCat.thai}</span> กัน!
              <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:6 }}><CatIcon id={fCat.id} size={26} /><span style={{ fontFamily:WFONT,fontSize:18,fontWeight:600,color:T.ink2 }}>{fCat.label}</span></div>
            </div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10,margin:"14px 2px 16px" }}>
            <span style={{ fontFamily:HFONT,fontSize:14,fontWeight:600,whiteSpace:"nowrap" }}>{pet.name} · Lv.{pet.level}</span>
            <div style={{ flex:1,height:12,borderRadius:6,background:"rgba(255,255,255,.25)",overflow:"hidden" }}><div style={{ width:`${pet.pct}%`,height:"100%",background:T.secondary,borderRadius:6 }} /></div>
          </div>
          <button onClick={() => go(fCat, fGame)} className="vp-3d" style={{ "--edge":T.secondaryEdge,"--d":"6px",width:"100%",minHeight:76,borderRadius:24,border:"none",background:T.secondary,color:T.onSecondary,cursor:"pointer",display:"flex",alignItems:"center",gap:12,padding:"8px 18px 8px 10px",fontFamily:HFONT }}>
            <span style={{ width:58,height:58,borderRadius:18,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flex:"none" }}><GameIcon id={fGame} size={48} /></span>
            <span style={{ flex:1,textAlign:"left" }}><span style={{ display:"block",fontWeight:600,fontSize:26,lineHeight:1.05 }}>▶ เล่นเลย!</span><span style={{ fontSize:14,fontWeight:500,opacity:.85 }}>{GAME_META[fGame]?.label}</span></span>
          </button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4 }}>
          <button onClick={() => { sfx.tap(); onPath(); }} className="vp-3d" style={{ "--edge":T.cardEdge,"--d":"4px",minHeight:64,borderRadius:22,border:`2px solid ${T.cardBorder}`,background:T.card,color:T.ink,cursor:"pointer",fontFamily:HFONT,padding:"8px 10px",textAlign:"left",display:"flex",alignItems:"center",gap:8 }}>
            <GameIcon id="quiz" size={38} /><span><span style={{ display:"block",fontWeight:600,fontSize:15 }}>เส้นทางบทเรียน</span><span style={{ fontSize:13,color:T.ink2,fontFamily:FONT }}>{nextUnit ? `บทที่ ${nextUnit.n}` : "ครบแล้ว"} · {unitsDone}/{units.length}</span></span>
          </button>
          <button onClick={() => { sfx.tap(); if (missedCount) onReview(); }} className="vp-3d" style={{ "--edge":missedCount ? T.tertiaryEdge : T.cardEdge,"--d":"4px",minHeight:64,borderRadius:22,border:missedCount ? "none" : `2px solid ${T.cardBorder}`,background:missedCount ? T.tertiary : T.card,color:missedCount ? T.onTertiary : T.ink,cursor:"pointer",fontFamily:HFONT,padding:"8px 10px",textAlign:"left",display:"flex",alignItems:"center",gap:8 }}>
            <GameIcon id="listen" size={38} /><span><span style={{ display:"block",fontWeight:600,fontSize:15 }}>ทบทวนวันนี้</span><span style={{ fontSize:13,opacity:.85,fontFamily:FONT }}>{missedCount ? `${missedCount} คำ` : "ไม่มีค้าง"}</span></span>
          </button>
        </div>
        <div style={{ display:"flex",gap:8,margin:"12px 0 0" }}>
          {[[`📒 ${stickerCount}/${words.length}`, onStickers], [`🏠 ห้อง${careAvg < 40 ? " ❗" : ""}`, onRoom], ["🛍️ ร้านค้า", onShop]].map(([t, fn]) => (
            <button key={t} onClick={() => { sfx.tap(); fn(); }} className="vp-3d" style={{ "--edge":T.cardEdge,"--d":"3px",flex:1,minHeight:44,padding:"0 8px",borderRadius:999,border:`2px solid ${T.cardBorder}`,background:T.card,color:T.ink,fontFamily:HFONT,fontWeight:500,fontSize:14,cursor:"pointer",whiteSpace:"nowrap" }}>{t}</button>
          ))}
        </div>
        </>
      )}
      {install && <InstallBanner deferred={install.evt} onInstall={install.onInstall} onDismiss={install.onDismiss} />}

      {/* ชั้นเกม: เลื่อนแนวนอน การ์ดเกมใหญ่ */}
      {progress.pet && <>
        {sec(<>เกมสนุก <span style={{ ...TYPE.labelM,color:T.ink2 }}>{fCat.label}</span></>)}
        <div style={{ display:"flex",gap:12,overflowX:"auto",scrollSnapType:"x mandatory",margin:"0 -16px",padding:"2px 16px 12px",scrollbarWidth:"none" }}>
          {fGames.filter(g => g !== "boss").map((g, i) => {
            const st = progress.stars[`${fCat.id}:${g}`] || 0;
            const ac = accentOf(fCat.id);
            return <button key={g} onClick={() => go(fCat, g)} className="vp-3d" style={{ "--edge":ac.edge,flex:"none",width:132,minHeight:160,scrollSnapAlign:"start",borderRadius:24,border:"none",background:ac.fill,color:ac.on,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:"12px 8px",fontFamily:HFONT }}>
              <span style={{ width:84,height:84,borderRadius:"50%",background:"rgba(255,255,255,.95)",display:"flex",alignItems:"center",justifyContent:"center" }}><GameIcon id={g} size={62} /></span>
              <span style={{ fontWeight:600,fontSize:15,lineHeight:1.15,textAlign:"center" }}>{GAME_META[g]?.label}</span>
              <span style={{ fontSize:17,letterSpacing:1,lineHeight:1 }}>{[0,1,2].map(k => <span key={k} style={{ color:k < st ? T.secondary : "rgba(255,255,255,.45)" }}>★</span>)}</span>
            </button>;
          })}
        </div>

        {/* ฟองกิจกรรม */}
        {sec("เรียนแบบอื่น")}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
          {bubbles.map(([id, t, fn]) => (
            <button key={t} onClick={() => { sfx.tap(); fn(); }} className="m3-press" style={{ background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"4px 0",fontFamily:FONT }}>
              <span className="vp-3d" style={{ "--edge":T.cardEdge,"--d":"4px",width:84,height:84,borderRadius:"50%",background:T.card,border:`2px solid ${T.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"center" }}><GameIcon id={id} size={56} /></span>
              <span style={{ ...TYPE.labelL,color:T.ink,textAlign:"center" }}>{t}</span>
            </button>
          ))}
        </div>
        <button onClick={() => { sfx.tap(); onVersus(); }} className="vp-3d" style={{ "--edge":T.tertiaryEdge,width:"100%",minHeight:68,background:T.tertiary,color:T.onTertiary,border:"none",borderRadius:24,padding:"8px 16px 8px 10px",margin:"18px 0 8px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",fontFamily:FONT,textAlign:"left" }}>
          <span style={{ fontSize:32 }}>⚔️</span>
          <div style={{ flex:1,fontFamily:HFONT }}><div style={{ fontWeight:600,fontSize:18 }}>แข่ง 2 คน จอเดียว</div><div style={{ fontSize:13,opacity:.92 }}>ใครแตะรูปถูกก่อนชนะ!</div></div>
          <span style={{ fontSize:22 }}>›</span>
        </button>
        <MissionsCard progress={progress} setProgress={setProgress} />
      </>}

      {/* โลกคำศัพท์: วงกลมรูปจริง + วงแหวนดาว */}
      {sec(<>โลกคำศัพท์ <span style={{ ...TYPE.labelM,color:T.ink2 }}>{words.length} คำ</span></>)}
      <Reveal step={30} style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px 8px" }}>
        {categories.map(cat => <CatBubble key={cat.id} cat={cat} words={words} progress={progress} onClick={() => { sfx.tap(); onPickCat(cat); }} />)}
      </Reveal>
      <div style={{ marginTop:18 }}><QrCard /></div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HUBS — แท็บ เรียน / เล่น / ของฉัน
// ═══════════════════════════════════════════════════════
// หมวดเป็นวงกลมรูปจริง + วงแหวนดาว (ใช้ทั้งหน้าแรกและแท็บ)
function CatBubble({ cat, words, progress, onClick, size = "min(27vw, 120px)" }) {
  const got = cat.games.reduce((a, g) => a + (progress.stars[`${cat.id}:${g}`] || 0), 0);
  const pct = Math.round(got / Math.max(1, cat.games.length * 3) * 100);
  const tw = imageTitleOf(coverWord(cat)) ? coverWord(cat) : words.find(w => w.cat === cat.id && imageTitleOf(w));
  const ac = accentOf(cat.id);
  return (
    <button onClick={onClick} className="m3-press" style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontFamily:HFONT }}>
      <span style={{ position:"relative",width:size,aspectRatio:"1",borderRadius:"50%",padding:6,background:`conic-gradient(${ac.fill} ${pct}%, ${T.surfHigh} 0)`,boxShadow:`0 4px 0 ${T.cardEdge}` }}>
        <span style={{ position:"relative",display:"block",width:"100%",height:"100%",borderRadius:"50%",overflow:"hidden",background:ac.fill,border:"3px solid #fff" }}>
          {tw ? <CoverFill w={tw} /> : <span style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}><CatIcon id={cat.id} size={56} /></span>}
        </span>
        <span style={{ position:"absolute",right:-2,bottom:-2,borderRadius:"50%",border:"3px solid #fff",display:"flex",background:"#fff" }}><CatIcon id={cat.id} size={30} /></span>
        {progress.boss[cat.id] && <span style={{ position:"absolute",left:-2,top:-4,fontSize:22 }}>👑</span>}
      </span>
      <span style={{ fontWeight:600,fontSize:15,color:T.ink,lineHeight:1.1 }}>{cat.label}</span>
      <span style={{ fontSize:13,fontWeight:500,color:T.ink2,fontFamily:FONT }}>{cat.thai} · {words.filter(w => w.cat === cat.id).length} คำ</span>
    </button>
  );
}
// รูปปกเต็มวง (cover จริง ไม่มีแถบเทา) · ใช้ในวงกลมหมวด/หัวหน้าหมวด
function CoverFill({ w, pos = "center 40%" }) {
  const { url } = useWordImage(w);
  const [err, setErr] = useState(false);
  if (!url || err) { const c = conceptFor(w); return c ? <span style={{ position:"absolute",inset:0 }}>{c}</span> : <span style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44 }}>{w?.emoji}</span>; }
  return <img src={url} alt={w.word} onError={() => setErr(true)} loading="lazy" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:pos }} />;
}
// การ์ดใหญ่สำหรับแท็บ: ไอคอนเด่น ตัวหนังสือน้อย แตะง่าย
const TONES = () => [[T.primaryC,T.onPrimaryC],[T.secondaryC,T.onSecondaryC],[T.tertiaryC,T.onTertiaryC]];
function BigTile({ icon, title, sub, i = 0, onClick, wide, children, fill }) {
  // การ์ดขาวนูน (หรือสีทึบเมื่อมี fill) · ไอคอนใหญ่ ตัวหนังสือน้อย
  const solid = fill || (wide && i === 0 ? { fill:T.primary, edge:T.primaryEdge, on:T.onPrimary } : null);
  return (
    <button onClick={() => { sfx.tap(); onClick(); }} className="vp-3d" style={{ "--edge":solid ? solid.edge : T.cardEdge,"--d":"5px",gridColumn:wide ? "1 / -1" : undefined,position:"relative",overflow:"hidden",minHeight:wide ? 108 : 148,borderRadius:24,border:solid ? "none" : `2px solid ${T.cardBorder}`,background:solid ? solid.fill : T.card,color:solid ? solid.on : T.ink,cursor:"pointer",display:"flex",flexDirection:wide ? "row" : "column",alignItems:"center",justifyContent:wide ? "flex-start" : "center",gap:wide ? 14 : 8,padding:wide ? "14px 18px" : "14px 8px 12px",textAlign:wide ? "left" : "center",fontFamily:HFONT }}>
      <span style={{ position:"relative",flex:"none" }}>{icon}</span>
      <span style={{ position:"relative",flex:wide ? 1 : undefined,minWidth:0 }}>
        <span style={{ display:"block",fontWeight:600,fontSize:wide ? 19 : 17,lineHeight:1.2 }}>{title}</span>
        {sub && <span style={{ display:"block",fontSize:13,fontWeight:500,color:solid ? "inherit" : T.ink2,opacity:solid ? .88 : 1,marginTop:3,lineHeight:1.3,fontFamily:FONT }}>{sub}</span>}
        {children}
      </span>
    </button>
  );
}
const HubGrid = ({ children }) => <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>{children}</div>;
const HubTitle = ({ children }) => <div style={{ ...TYPE.titleL,color:T.ink,margin:"22px 4px 12px" }}>{children}</div>;
function LearnHub({ words, categories, progress, units, onPath, onCat, onTalk, onStories, onPhonics, onGrammar, onDaily }) {
  const unitsDone = units.filter(u => unitDone(progress.path, u)).length;
  const nextUnit = units.find(u => !unitDone(progress.path, u));
  return (
    <div style={{ padding:"8px 16px 24px",maxWidth:560,margin:"0 auto" }}>
      <HubGrid>
        <BigTile wide i={0} icon={<span style={{ fontSize:52 }}>🗺️</span>} title="เส้นทางบทเรียน A1 → A2" sub={nextUnit ? `ต่อบทที่ ${nextUnit.n} · ${nextUnit.cat.thai}` : "ครบทุกบทแล้ว 🎓"} onClick={onPath}>
          <span style={{ display:"block",marginTop:10,height:12,borderRadius:6,background:"rgba(255,255,255,.28)",overflow:"hidden" }}><span style={{ display:"block",height:"100%",width:`${units.length ? Math.round(unitsDone / units.length * 100) : 0}%`,minWidth:8,background:T.secondary,borderRadius:6 }} /></span>
          <span style={{ display:"block",fontSize:11,opacity:.8,marginTop:3 }}>ผ่านแล้ว {unitsDone}/{units.length} บท</span>
        </BigTile>
        <BigTile i={1} icon={<GameIcon id="droleplay" size={64} />} title="บทสนทนา" sub={`${DIALOGUES.length} สถานการณ์`} onClick={onTalk} />
        <BigTile i={2} icon={<GameIcon id="squiz" size={64} />} title="นิทานภาพ" sub={`${STORIES.length} เรื่อง`} onClick={onStories} />
        <BigTile i={0} icon={<GameIcon id="phonics" size={64} />} title="โฟนิกส์ A–Z" sub="เสียงตัวอักษร" onClick={onPhonics} />
        <BigTile i={1} icon={<GameIcon id="grammar" size={64} />} title="ไวยากรณ์เด็ก" sub={`${GRAMMAR.length} บท`} onClick={onGrammar} />
        <BigTile wide i={2} icon={<GameIcon id="time" size={60} />} title="ชีวิตประจำวัน" sub="บอกเวลา · เงินบาท · วัน-เดือน · ตัวเลข" onClick={onDaily} />
      </HubGrid>
      <HubTitle>การ์ดคำศัพท์ตามหมวด</HubTitle>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px 8px" }}>
        {categories.map(c => <CatBubble key={c.id} cat={c} words={words} progress={progress} onClick={() => { sfx.tap(); onCat(c); }} />)}
      </div>
    </div>
  );
}
function PlayHub({ words, categories, progress, missedCount, onCat, onReview, onVersus, onTest }) {
  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const crowns = Object.keys(progress.boss).length;
  return (
    <div style={{ padding:"8px 16px 24px",maxWidth:560,margin:"0 auto" }}>
      <div style={{ position:"relative",overflow:"hidden",borderRadius:28,background:T.secondary,color:T.onSecondary,padding:"18px 20px",marginBottom:14,display:"flex",alignItems:"center",gap:16,boxShadow:`0 5px 0 ${T.secondaryEdge}`,fontFamily:HFONT }}>
        <span style={{ width:80,height:80,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44 }}>⭐</span>
        <div style={{ position:"relative" }}>
          <div style={{ fontWeight:600,fontSize:34,lineHeight:1 }}>{totalStars} <span style={{ fontSize:18 }}>ดาว</span></div>
          <div style={{ fontSize:13,opacity:.9,marginTop:4 }}>👑 ชนะบอส {crowns}/{categories.length} หมวด · 🪙 {progress.coins}</div>
        </div>
      </div>
      <HubGrid>
        <BigTile i={2} icon={<span style={{ fontSize:54 }}>🔁</span>} title="ทบทวนวันนี้" sub={missedCount ? `${missedCount} คำถึงเวลาทบทวน` : "ยังไม่มีคำค้าง 🎉"} onClick={() => missedCount && onReview()} />
        <BigTile i={1} icon={<GameIcon id="test" size={64} />} title="สอบวัดระดับ + ใบประกาศ" sub={progress.cert ? `ล่าสุด ${progress.cert.score}/${progress.cert.total}` : "20 ข้อ"} onClick={onTest} />
        <BigTile wide i={0} icon={<span style={{ fontSize:52 }}>⚔️</span>} title="แข่ง 2 คน จอเดียว" sub="ฟังเสียง ใครแตะรูปถูกก่อนชนะ!" onClick={onVersus} />
      </HubGrid>
      <HubTitle>เลือกหมวดเพื่อเล่นเกม</HubTitle>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px 8px" }}>
        {categories.map(c => <CatBubble key={c.id} cat={c} words={words} progress={progress} onClick={() => { sfx.tap(); onCat(c); }} />)}
      </div>
    </div>
  );
}
function MeHub({ words, progress, setProgress, stickerCount, profile, onProfiles, onStickers, onShop, onRoom, onReport, onManage, onSettings, onCredits, speak }) {
  const pet = getPet(progress);
  const mastered = words.filter(w => isMastered(progress.srs, w.id)).length;
  const Stat = ({ v, l, e }) => <div style={{ textAlign:"center",background:T.card,color:T.ink,borderRadius:20,padding:"10px 4px" }}><div style={{ fontSize:22 }}>{e}</div><div style={{ fontWeight:900,fontSize:18,color:T.ink }}>{v}</div><div style={{ fontSize:11,color:T.ink2 }}>{l}</div></div>;
  const Row = ({ e, t, sub, fn }) => <button onClick={() => { sfx.tap(); fn(); }} className="m3-press" style={{ ...M3.listItem(),marginBottom:6,minHeight:60 }}><span style={{ fontSize:24,width:36,textAlign:"center" }}>{e}</span><span style={{ flex:1,minWidth:0,textAlign:"left" }}><span style={{ display:"block",...TYPE.titleS,color:T.ink }}>{t}</span><span style={{ display:"block",...TYPE.bodyS,color:T.ink2 }}>{sub}</span></span><span style={{ color:T.ink3,fontSize:22 }}>›</span></button>;
  return (
    <div style={{ padding:"8px 16px 24px",maxWidth:560,margin:"0 auto" }}>
      <div style={{ position:"relative",overflow:"hidden",borderRadius:28,background:MD.heroGrad,color:"#fff",padding:"18px 18px 14px",marginBottom:14,boxShadow:`0 5px 0 ${T.primaryEdge}`,fontFamily:HFONT }}>
                <div style={{ position:"relative",display:"flex",alignItems:"center",gap:14 }}>
          <Shape kind="cookie12" size={96} fill={T.card}><span style={{ fontSize:48 }}>{profile?.avatar}</span></Shape>
          <div style={{ flex:1,minWidth:0 }}><div style={{ fontWeight:900,fontSize:24,lineHeight:1.1 }}>{profile?.name}</div><div style={{ fontSize:13,opacity:.85 }}>{pet ? `เพื่อนคู่หู ${pet.name} · Lv.${pet.level}` : "ยังไม่เลือกเพื่อนคู่หู"}</div></div>
          <button onClick={() => { sfx.tap(); onProfiles(); }} className="m3-press" style={M3.tonal({ minHeight:44,padding:"0 16px",fontSize:13 })}>สลับ</button>
        </div>
        <div style={{ position:"relative",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:14 }}>
          <Stat e="🪙" v={progress.coins} l="เหรียญ" /><Stat e="⭐" v={Object.values(progress.stars).reduce((a,b)=>a+b,0)} l="ดาว" /><Stat e="🔥" v={progress.streak.count} l="วันต่อเนื่อง" /><Stat e="🧠" v={mastered} l="จำได้แม่น" />
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
        <BigTile i={0} icon={<span style={{ fontSize:48 }}>🏠</span>} title="ห้องเพื่อนคู่หู" onClick={onRoom} />
        <BigTile i={1} icon={<span style={{ fontSize:48 }}>📒</span>} title="สมุดสติกเกอร์" sub={`${stickerCount}/${words.length}`} onClick={onStickers} />
        <BigTile i={2} icon={<span style={{ fontSize:48 }}>🛍️</span>} title="ร้านค้า" onClick={onShop} />
      </div>
      <HubTitle>สำหรับผู้ปกครอง</HubTitle>
      <Row e="📊" t="รายงานผู้ปกครอง" sub="ความแม่นยำ หมวดที่อ่อน คำที่พลาดบ่อย" fn={onReport} />
      <Row e="✏️" t="จัดการคำศัพท์" sub="ค้นหา เพิ่ม แก้ ลบ แปลอัตโนมัติ" fn={onManage} />
      <Row e="⚙️" t="ตั้งค่า" sub="เสียง · รูปจริง · เต็มจอ · ล้างความคืบหน้า" fn={onSettings} />
      <Row e="🖼️" t="เครดิตรูปภาพ" sub="ที่มาและสัญญาอนุญาตของรูปจาก Wikimedia" fn={onCredits} />
      <div style={{ textAlign:"center",fontSize:11,color:T.ink3,marginTop:10 }}>Smart VocabPlay v{APP_VERSION}{BUILD_TIME && ` · build ${BUILD_TIME}`}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CATEGORY SCREEN
// ═══════════════════════════════════════════════════════
function CategoryScreen({ cat, words, onPickGame, onLearn, progress, showToast }) {
  const starOf = g => progress.stars[`${cat.id}:${g}`] || 0;
  const needForBoss = cat.games.filter(g => g !== "speak" && !ARCADE_GAMES.includes(g));   // พูดตาม/เกมอาร์เคดไม่บังคับ
  const bossOpen = needForBoss.every(g => starOf(g) >= 1);
  const learnedN = words.filter(w => progress.learned[w.id] || progress.srs[w.id]).length;
  const crowned = !!progress.boss[cat.id];
  const Stars = ({ n }) => <span style={{ fontSize:13,letterSpacing:1,flexShrink:0 }}>{[1,2,3].map(i => <span key={i} style={{ opacity:i<=n?1:0.2 }}>⭐</span>)}</span>;
  return (
    <div style={{ padding:"8px 16px 24px",maxWidth:520,margin:"0 auto" }}>
      <div style={{ position:"relative",borderRadius:28,overflow:"hidden",height:180,marginBottom:16,background:accentOf(cat.id).fill,boxShadow:`0 5px 0 ${accentOf(cat.id).edge}` }}>
        {(imageTitleOf(coverWord(cat)) || words.find(w => imageTitleOf(w))) && <CoverFill w={imageTitleOf(coverWord(cat)) ? coverWord(cat) : words.find(w => imageTitleOf(w))} />}
        <span style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,transparent 35%,rgba(20,14,40,.78))" }} />
        <div style={{ position:"absolute",left:16,right:16,bottom:14,color:"#fff",display:"flex",alignItems:"flex-end",gap:12 }}>
          <span style={{ flexShrink:0,borderRadius:"50%",border:"3px solid #fff",display:"flex",background:"#fff" }}><CatIcon id={cat.id} size={52} /></span>
          <div style={{ flex:1,fontFamily:HFONT }}>
            <div style={{ fontWeight:600,fontSize:26,lineHeight:1.1 }}>{cat.label} {crowned && "👑"}</div>
            <div style={{ fontSize:15,fontWeight:500,opacity:0.92 }}>{cat.thai} · {words.length} คำ · ⭐ {cat.games.reduce((a,g)=>a+starOf(g),0)}/{cat.games.length*3}</div>
          </div>
        </div>
      </div>

      {/* โหมดเรียน */}
      <button onClick={()=>{ sfx.tap(); onLearn(); }}
        className="vp-3d" style={{ "--edge":T.primaryEdge,width:"100%",background:T.primary,color:T.onPrimary,borderRadius:22,padding:"10px 16px 10px 10px",minHeight:68,marginBottom:18,display:"flex",alignItems:"center",gap:12,border:"none",cursor:"pointer",textAlign:"left",fontFamily:HFONT }}>
        <span style={{ width:48,height:48,borderRadius:16,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center" }}><GameIcon id="squiz" size={40} /></span>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:600,fontSize:19 }}>เรียนคำศัพท์ก่อนเล่น</div>
        </div>
        <span style={{ background:"rgba(255,255,255,.22)",borderRadius:999,padding:"4px 10px",fontSize:14,fontWeight:600 }}>{learnedN}/{words.length}</span>
        <span style={{ fontSize:20,flexShrink:0,opacity:0.8 }}>›</span>
      </button>

      <p style={M3.sectionTitle({ margin:"0 4px 12px" })}>เลือกเกม</p>
      <Reveal step={40} style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {cat.games.map((gid,i)=>{
          const g=GAME_META[gid]; if(!g) return null;
          const st=starOf(gid);
          return (
            <button key={gid} onClick={()=>{ sfx.tap(); onPickGame(gid); }}
              className="vp-3d" style={{ "--edge":T.cardEdge,position:"relative",minHeight:156,borderRadius:24,border:`2px solid ${T.cardBorder}`,background:T.card,color:T.ink,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"14px 8px 12px",fontFamily:HFONT }}>
              <GameIcon id={gid} size={68} />
              <span style={{ fontWeight:600,fontSize:16,lineHeight:1.15,textAlign:"center" }}>{g.label}</span>
              <span style={{ fontSize:13,fontWeight:500,color:T.ink2,textAlign:"center",lineHeight:1.25,fontFamily:FONT }}>{g.thai}</span>
              <span style={{ fontSize:20,letterSpacing:1,lineHeight:1 }}>{[0,1,2].map(k => <span key={k} style={{ color:k < st ? T.secondary : T.cardEdge }}>★</span>)}</span>
            </button>
          );
        })}
      </Reveal>
      <div style={{ marginTop:10 }}>
        {/* ด่านบอส */}
        <button onClick={()=>{ if(bossOpen){ sfx.tap(); onPickGame("boss"); } else { sfx.bad(); showToast("เก็บดาวให้ได้ทุกเกมในหมวดก่อนนะ ⭐","warn"); } }}
          className="m3-press" style={{ width:"100%",background:bossOpen?MD.inverseSurface:T.surfHigh,color:bossOpen?MD.inverseOnSurface:T.ink3,borderRadius:28,padding:"13px 16px",minHeight:72,marginTop:6,display:"flex",alignItems:"center",gap:12,border:"none",cursor:"pointer",textAlign:"left",fontFamily:FONT }}>
          <span style={{ fontSize:28,width:36,textAlign:"center",flexShrink:0 }}>{bossOpen?"👑":"🔒"}</span>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontWeight:900,fontSize:15 }}>{crowned?"ด่านบอส · ชนะแล้ว 👑":"ด่านบอส"}</div>
            <div style={{ fontSize:11,opacity:0.85,marginTop:1 }}>{bossOpen?"ฟังแล้วแตะรูป 10 ข้อ 3 หัวใจ · ชนะได้ +50 🪙":`ปลดล็อกเมื่อได้ ⭐ ครบทุกเกม ยกเว้นพูดตาม (${needForBoss.filter(g=>starOf(g)>=1).length}/${needForBoss.length})`}</div>
          </div>
          <span style={{ fontSize:20,flexShrink:0,opacity:0.6 }}>›</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WORD MANAGEMENT SCREEN
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// แชร์ชุดคำด้วย QR / ลิงก์ (โหมดครู/ผู้ปกครอง) — ไม่มีเซิร์ฟเวอร์ ข้อมูลอยู่ในลิงก์
// ═══════════════════════════════════════════════════════
const INITIAL_IDS = new Set(INITIAL_WORDS.map(w => w.id));
const isCustomWord = w => !INITIAL_IDS.has(w.id) || !INITIAL_WORDS.find(x => x.id === w.id && x.word === w.word && x.cat === w.cat);
function ShareSetSheet({ words, filtered, filterActive, showToast, onClose }) {
  const custom = words.filter(isCustomWord);
  const [mode, setMode] = useState(custom.length ? "custom" : "filtered");
  const [name, setName] = useState(""); const [from, setFrom] = useState("");
  const source = mode === "custom" ? custom : filtered;
  const [link, setLinkState] = useState(""); const [svg, setSvg] = useState(""); const [list, setList] = useState([]);
  // QR สแกนง่ายต้องไม่ยาวเกิน ~1,500 ตัวอักษร → ลดจำนวนคำลงอัตโนมัติจนพอดี
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!source.length) { setList([]); setLinkState(""); setSvg(""); return; }
      let n = Math.min(source.length, 60), url = "", chosen = [];
      for (;;) { chosen = source.slice(0, n); url = setLink(await encodeSet({ name, from, words: chosen })); if (url.length <= 1500 || n <= 3) break; n = Math.max(3, Math.floor(n * 0.7)); }
      if (!alive) return;
      setList(chosen); setLinkState(url);
      try { const q = qrcode(0, "L"); q.addData(url, "Byte"); q.make(); setSvg(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })); } catch (_) { setSvg(""); }
    })().catch(() => { if (alive) { setLinkState(""); setSvg(""); } });
    return () => { alive = false; };
  }, [mode, name, from, words, filtered]);
  const copy = async () => { try { await navigator.clipboard.writeText(link); showToast("คัดลอกลิงก์แล้ว ✓"); } catch (_) { showToast("คัดลอกไม่ได้ กดค้างที่ลิงก์เพื่อคัดลอก", "warn"); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: `ชุดคำ ${name || ""}`.trim(), text: `ชุดคำศัพท์ ${list.length} คำ จาก Smart VocabPlay`, url: link }); else copy(); } catch (_) {} };
  const inp = { flex:1,minWidth:0,width:"50%",minHeight:44,borderRadius:14,border:`1px solid ${MD.outlineV}`,background:T.card,color:T.ink,padding:"0 12px",fontFamily:FONT,fontSize:14 };
  return (
    <M3Sheet onClose={onClose}>
      <h3 style={{ ...TYPE.headlineS,color:T.ink,margin:"0 0 4px" }}>แชร์ชุดคำด้วย QR</h3>
      <div style={{ ...TYPE.bodyS,color:T.ink2,marginBottom:12 }}>ให้เด็กคนอื่น/ผู้ปกครองสแกนแล้วกด "เพิ่มเข้าแอป" ได้เลย · ข้อมูลอยู่ในลิงก์ทั้งหมด ไม่ผ่านเซิร์ฟเวอร์ · สูงสุด 60 คำต่อชุด</div>
      <div style={{ display:"flex",gap:6,marginBottom:10 }}>
        <button onClick={() => setMode("custom")} className="m3-press" style={M3.chip(mode === "custom", { flex:1,minHeight:44,borderRadius:999 })}>คำที่เพิ่มเอง ({custom.length})</button>
        <button onClick={() => setMode("filtered")} className="m3-press" style={M3.chip(mode === "filtered", { flex:1,minHeight:44,borderRadius:999 })}>{filterActive ? "คำที่กรองอยู่" : "คำที่แสดงอยู่"} ({filtered.length})</button>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:12 }}>
        <input placeholder="ชื่อชุด เช่น ป.2 สัปดาห์ 3" value={name} onChange={e => setName(e.target.value)} style={inp} />
        <input placeholder="จากใคร เช่น ครูแอน" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
      </div>
      {source.length === 0
        ? <div style={{ ...card({ background:T.surfHigh }),padding:16,textAlign:"center",color:T.ink2 }}>ยังไม่มีคำในชุดนี้ · เพิ่มคำเองก่อน หรือค้นหา/เลือกหมวดเพื่อแชร์คำที่กรองอยู่</div>
        : <>
          <div style={{ ...card({ background:"#fff" }),padding:12,display:"flex",justifyContent:"center" }}>
            {svg ? <div style={{ width:"min(78vw, 320px)" }} dangerouslySetInnerHTML={{ __html: svg }} /> : <div style={{ color:T.ink3,padding:30 }}>กำลังสร้าง QR…</div>}
          </div>
          <div style={{ ...TYPE.labelM,color:T.ink2,textAlign:"center",margin:"8px 0 10px" }}>{list.length} คำ{list.length < source.length ? ` (จาก ${source.length} · ลดให้ QR สแกนได้ · ค้นหา/เลือกหมวดเพื่อเลือกคำที่ต้องการ)` : ""}{name ? ` · ${name}` : ""}{from ? ` · ${from}` : ""}</div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={share} className="m3-press" style={M3.filled({ flex:1,minHeight:48 })}>📤 ส่งลิงก์</button>
            <button onClick={copy} className="m3-press" style={M3.tonal({ flex:1,minHeight:48 })}>📋 คัดลอกลิงก์</button>
          </div>
          <div style={{ ...TYPE.bodyS,color:T.ink3,marginTop:8,wordBreak:"break-all",maxHeight:60,overflow:"hidden" }}>{link.slice(0, 120)}…</div>
        </>}
    </M3Sheet>
  );
}
function ImportSetSheet({ encoded, words, setWords, showToast, onClose }) {
  const [set, setSet] = useState(undefined);
  useEffect(() => { decodeSet(encoded).then(setSet).catch(() => setSet(null)); }, [encoded]);
  const dup = w => words.find(x => x.cat === w.cat && x.word.toUpperCase() === w.word.toUpperCase());
  const fresh = set ? set.words.filter(w => !dup(w)) : [];
  const add = () => {
    let maxId = Math.max(0, ...words.map(w => w.id));
    const added = fresh.map(w => ({ id: ++maxId, cat: w.cat, word: w.word.toUpperCase(), meaning: w.meaning, emoji: w.emoji || "📦", read: w.read, sen: w.sen, senTh: w.senTh }));
    setWords([...words, ...added]); sfx.coin(); showToast(`เพิ่ม ${added.length} คำแล้ว ✓`); onClose();
  };
  return (
    <M3Sheet onClose={onClose} z={260}>
      <h3 style={{ ...TYPE.headlineS,color:T.ink,margin:"0 0 4px" }}>📥 ได้รับชุดคำ</h3>
      {set === undefined && <div style={{ color:T.ink2 }}>กำลังอ่าน…</div>}
      {set === null && <div style={{ color:T.error }}>ลิงก์นี้อ่านไม่ได้ (อาจถูกตัดตอนคัดลอก) ขอให้ส่งใหม่อีกครั้ง</div>}
      {set && <>
        <div style={{ ...TYPE.bodyM,color:T.ink2,marginBottom:10 }}>{set.name ? <b style={{ color:T.ink }}>{set.name}</b> : "ชุดคำ"}{set.from ? ` · จาก ${set.from}` : ""} · {set.words.length} คำ{fresh.length < set.words.length ? ` (มีอยู่แล้ว ${set.words.length - fresh.length} คำ)` : ""}</div>
        <div style={{ ...card({ background:T.surfHigh }),padding:"6px 12px",maxHeight:"34vh",overflowY:"auto",marginBottom:12 }}>
          {set.words.map((w, i) => <div key={i} style={{ display:"flex",gap:8,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${MD.outlineV}`,opacity: dup(w) ? .5 : 1 }}><span style={{ fontSize:20 }}>{w.emoji}</span><div style={{ flex:1 }}><b style={{ color:T.ink }}>{w.word}</b> <span style={{ color:T.ink2,fontSize:13 }}>{w.meaning}</span></div><span style={{ ...TYPE.labelS,color:T.ink3 }}>{w.cat}</span></div>)}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={add} disabled={!fresh.length} className="m3-press" style={M3.filled({ flex:2,minHeight:52,...(fresh.length ? {} : { background:T.surfHighest,color:T.ink3 }) })}>➕ เพิ่ม {fresh.length} คำเข้าแอป</button>
          <button onClick={onClose} className="m3-press" style={M3.tonal({ flex:1,minHeight:52 })}>ไม่เอา</button>
        </div>
      </>}
    </M3Sheet>
  );
}

function ManageScreen({ words, setWords, categories, showToast, speak, onReset }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const EMPTY_DRAFT = { word:"", meaning:"", emoji:"📦", cat: categories[0]?.id, read:"", sen:"", senTh:"" };
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const filtered = words.filter(w => {
    const s = search.toLowerCase();
    const matchSearch = !s || w.word.toLowerCase().includes(s) || (w.meaning||"").includes(s);
    const matchCat = filterCat==="all" || w.cat===filterCat;
    return matchSearch && matchCat;
  });

  const deleteWord = id => {
    setWords(words.filter(w=>w.id!==id));
    showToast("ลบแล้ว ✓");
  };

  const [translating, setTranslating] = useState(false);
  // แปลอัตโนมัติด้วย MyMemory (ฟรี ไม่ต้องมี key) — เติมความหมายให้ ถ้าเน็ตไม่มีก็พิมพ์เองได้
  const autoTranslate = async () => {
    const q = draft.word.trim(); if (!q) return showToast("พิมพ์คำอังกฤษก่อน","warn");
    setTranslating(true);
    try {
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.toLowerCase())}&langpair=en|th`);
      const j = await r.json();
      const t = (j?.responseData?.translatedText || "").trim();
      if (t && !/^[a-z\s]+$/i.test(t)) { setDraft(d => ({ ...d, meaning: t })); showToast(`แปลว่า "${t}" ✓`); }
      else showToast("แปลไม่ได้ ลองพิมพ์เอง","warn");
    } catch (_) { showToast("ต่อเน็ตไม่ได้ พิมพ์ความหมายเองนะ","warn"); }
    setTranslating(false);
  };

  const saveNew = () => {
    if(!draft.word.trim()) return showToast("ใส่คำก่อน","warn");
    if(!draft.meaning.trim()) return showToast("ใส่ความหมายก่อน","warn");
    const maxId = Math.max(0,...words.map(w=>w.id));
    setWords([...words,{ id:maxId+1, ...draft, word:draft.word.toUpperCase() }]);
    showToast(`เพิ่ม "${draft.word.toUpperCase()}" ✓`);
    setDraft(EMPTY_DRAFT);
    setShowAdd(false);
  };

  const saveEdit = (id, changes) => {
    setWords(words.map(w => w.id===id ? { ...w,...changes } : w));
    showToast("บันทึกแล้ว ✓");
    setEditingId(null);
  };

  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:560,margin:"0 auto" }}>
      {/* Header + Add button */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
        <div>
          <div style={{ fontWeight:800,fontSize:18,color:T.ink }}>คลังคำศัพท์</div>
          <div style={{ fontSize:12,color:T.ink2 }}>{words.length} คำรวม · แสดง {filtered.length}</div>
        </div>
        <div style={{ display:"flex",gap:6 }}>
          <button onClick={()=>{ sfx.tap(); setShowShare(true); }} className="m3-press" style={M3.tonal({ minHeight:44,padding:"0 14px",fontSize:13 })}>📤 แชร์ QR</button>
          <button onClick={()=>setShowAdd(s=>!s)} className="m3-press" style={M3.filled({ minHeight:44,padding:"0 16px",fontSize:13 })}>+ เพิ่มคำ</button>
        </div>
      </div>
      {showShare && <ShareSetSheet words={words} filtered={filtered} filterActive={!!search || filterCat !== "all"} showToast={showToast} onClose={() => setShowShare(false)} />}

      {/* Add form */}
      {showAdd && (
        <div style={{ background:T.card,borderRadius:16,padding:14,marginBottom:14,boxShadow:"0 2px 12px rgba(0,0,0,0.1)",border:"2px solid #fecdd3" }}>
          <div style={{ fontWeight:700,fontSize:14,color:T.ink,marginBottom:10 }}>➕ เพิ่มคำใหม่</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <input placeholder="คำ EN (เช่น APPLE)" value={draft.word}
              onChange={e=>setDraft({...draft,word:e.target.value.toUpperCase()})}
              style={inputStyle} />
            <div style={{ display:"flex",gap:6 }}>
              <input placeholder="ความหมาย TH" value={draft.meaning}
                onChange={e=>setDraft({...draft,meaning:e.target.value})}
                style={{ ...inputStyle,flex:1,minWidth:0 }} />
              <button onClick={autoTranslate} disabled={translating} title="แปลอัตโนมัติ"
                style={{ minWidth:44,minHeight:44,borderRadius:14,border:"none",background:T.primaryC,color:T.onPrimaryC,fontSize:16,cursor:"pointer",flexShrink:0 }}>{translating?"…":"✨"}</button>
            </div>
            <input placeholder="อีโมจิ 🍎" value={draft.emoji} maxLength={4}
              onChange={e=>setDraft({...draft,emoji:e.target.value})}
              style={{ ...inputStyle,textAlign:"center",fontSize:20 }} />
            <select value={draft.cat} onChange={e=>setDraft({...draft,cat:e.target.value})} style={inputStyle}>
              {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <input placeholder="คำอ่าน (แอป-เปิ้ล)" value={draft.read} onChange={e=>setDraft({...draft,read:e.target.value})} style={{ ...inputStyle,gridColumn:"1 / -1" }} />
            <input placeholder="ประโยคตัวอย่าง EN" value={draft.sen} onChange={e=>setDraft({...draft,sen:e.target.value})} style={inputStyle} />
            <input placeholder="คำแปลประโยค TH" value={draft.senTh} onChange={e=>setDraft({...draft,senTh:e.target.value})} style={inputStyle} />
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={saveNew} style={{ flex:1,minHeight:44,background:"#EF4444",color:"#fff",borderRadius:14,padding:"9px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>บันทึก</button>
            <button onClick={()=>setShowAdd(false)} style={{ flex:1,minHeight:44,background:T.surfHigh,color:T.ink2,borderRadius:14,padding:"9px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex",gap:8,marginBottom:12 }}>
        <input placeholder="🔍 ค้นหา..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{ flex:1,...inputStyle }} />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ ...inputStyle,width:"auto",flexShrink:0 }}>
          <option value="all">ทุกหมวด ({words.length})</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label} ({words.filter(w=>w.cat===c.id).length})</option>)}
        </select>
      </div>

      {/* Word list */}
      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
        {filtered.map(w=>{
          const cat = categories.find(c=>c.id===w.cat);
          const isEditing = editingId===w.id;
          return (
            <div key={w.id} style={{ background:T.card,borderRadius:14,padding:"10px 12px",boxShadow:"0 1px 6px rgba(0,0,0,0.06)",border:"none" }}>
              {isEditing
                ? <EditWordRow word={w} categories={categories} onSave={changes=>saveEdit(w.id,changes)} onCancel={()=>setEditingId(null)} />
                : <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <Pic w={w} size={20} radius={10} style={{ flexShrink:0 }} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:800,fontSize:14,color:T.ink }}>{w.word} {w.read && <span style={{ fontWeight:600,fontSize:12,color:T.primary }}>{w.read}</span>}</div>
                      <div style={{ fontSize:12,color:T.ink2,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                        <span>{w.meaning}</span>
                        <span style={{ background:`${cat?.color||"#999"}20`,color:cat?.color||"#666",padding:"1px 6px",borderRadius:6,fontSize:10,fontWeight:600 }}>{cat?.emoji} {cat?.label}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                      <Btn onClick={()=>speak(w.word,w.meaning)} style={{ width:44,height:44,borderRadius:16,background:T.primaryC,fontSize:18 }}>🔊</Btn>
                      <Btn onClick={()=>setEditingId(w.id)} style={{ width:44,height:44,borderRadius:16,background:T.tertiaryC,fontSize:18 }}>✏️</Btn>
                      <Btn onClick={()=>{if(window.confirm(`ลบ "${w.word}"?`))deleteWord(w.id);}} style={{ width:44,height:44,borderRadius:16,background:T.errorC,fontSize:18 }}>🗑️</Btn>
                    </div>
                  </div>
              }
            </div>
          );
        })}
        {filtered.length===0 && <div style={{ textAlign:"center",padding:"40px 0",color:T.ink3,fontSize:14 }}>ไม่พบคำที่ค้นหา</div>}
      </div>

      {/* Reset to default words */}
      <button onClick={()=>{ if(window.confirm("คืนค่าคำศัพท์เริ่มต้น?\nคำที่เพิ่ม/แก้/ลบไว้จะหายทั้งหมด")) onReset(); }}
        style={{ width:"100%",minHeight:44,marginTop:20,background:T.card,color:T.ink2,border:"1px dashed #d1d5db",borderRadius:16,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer" }}>
        ↺ คืนค่าคำศัพท์เริ่มต้น
      </button>
    </div>
  );
}

const inputStyle = { border:"1px solid var(--md-outline-variant)",borderRadius:14,padding:"8px 10px",minHeight:44,fontSize:14,fontFamily:"inherit",width:"100%",outline:"none",background:T.surfHigh };

function EditWordRow({ word, categories, onSave, onCancel }) {
  const [d, setD] = useState({ word:word.word, meaning:word.meaning, emoji:word.emoji, cat:word.cat, read:word.read||"", sen:word.sen||"", senTh:word.senTh||"" });
  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6 }}>
        <input value={d.word} onChange={e=>setD({...d,word:e.target.value.toUpperCase()})} style={inputStyle} placeholder="คำ EN" />
        <input value={d.meaning} onChange={e=>setD({...d,meaning:e.target.value})} style={inputStyle} placeholder="ความหมาย" />
        <input value={d.emoji} maxLength={4} onChange={e=>setD({...d,emoji:e.target.value})} style={{ ...inputStyle,textAlign:"center",fontSize:20 }} />
        <select value={d.cat} onChange={e=>setD({...d,cat:e.target.value})} style={inputStyle}>
          {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
        <input value={d.read} onChange={e=>setD({...d,read:e.target.value})} style={{ ...inputStyle,gridColumn:"1 / -1" }} placeholder="คำอ่าน (แอป-เปิ้ล)" />
        <input value={d.sen} onChange={e=>setD({...d,sen:e.target.value})} style={inputStyle} placeholder="ประโยคตัวอย่าง EN" />
        <input value={d.senTh} onChange={e=>setD({...d,senTh:e.target.value})} style={inputStyle} placeholder="คำแปลประโยค TH" />
      </div>
      <div style={{ display:"flex",gap:6 }}>
        <button onClick={()=>onSave(d)} style={{ flex:1,minHeight:44,background:T.ok,color:"#fff",borderRadius:14,padding:"8px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer" }}>บันทึก ✓</button>
        <button onClick={onCancel} style={{ flex:1,minHeight:44,background:T.surfHigh,color:T.ink2,borderRadius:14,padding:"8px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer" }}>ยกเลิก</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GAME ROUTER — ครอบทุกเกมด้วยระบบรางวัล (ดาว/เหรียญ/สติกเกอร์)
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// ARCADE GAMES (v3.7) — เกมแอ็กชันที่ปรับจากกลไกยอดนิยม: ตีตัวตุ่น · ลูกโป่ง · ฟันคำ · บิงโก
//  ทุกเกมรายงานผ่าน track.correct/wrong/finish เหมือนเดิม · ใช้รูปจริง (PicFill) + เสียง
// ═══════════════════════════════════════════════════════
const ARCADE_GAMES = ["mole", "balloon", "ninja", "bingo", "runner", "feed"];
const pickOthers = (words, w, n) => shuffle(words.filter(x => x.id !== w.id)).slice(0, n);

// ── ตีตัวตุ่น: ได้ยินคำ → ตุ่นโผล่พร้อมรูป ตีตัวที่ตรงให้ทัน (40 วิ) ──
function MoleGame({ words, speak, track }) {
  const DUR = 40;
  const [time, setTime] = useState(DUR); const [on, setOn] = useState(false);
  const [cur, setCur] = useState(null); const [holes, setHoles] = useState(Array(6).fill(null));
  const [score, setScore] = useState(0); const scoreRef = useRef(0); const curRef = useRef(null); const tick = useRef(0);
  const newTarget = useCallback(() => { const w = words[Math.floor(Math.random() * words.length)]; curRef.current = w; setCur(w); speak(w.word, w.meaning); }, [words, speak]);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setTime(x => { if (x <= 1) { clearInterval(t); setOn(false); const s = scoreRef.current; track.finish(s, Math.max(s, 1), { stars: s >= 12 ? 3 : s >= 7 ? 2 : s >= 1 ? 1 : 0, label:`ตีถูก ${s} ตัวใน ${DUR} วิ` }); return 0; } return x - 1; }), 1000);
    const pop = setInterval(() => {
      tick.current++;
      setHoles(h => {
        const free = h.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (!free.length) return h;
        const i = free[Math.floor(Math.random() * free.length)];
        const target = curRef.current; const showTarget = target && !h.some(v => v && v.w.id === target.id) && (tick.current % 2 === 0);
        const w = showTarget ? target : pickOthers(words, target || words[0], 1)[0];
        const nh = [...h]; nh[i] = { w, key: Date.now() + i };
        setTimeout(() => setHoles(hh => { const c = [...hh]; if (c[i] && c[i].key === nh[i].key) c[i] = null; return c; }), 1500 - Math.min(600, tick.current * 8));
        return nh;
      });
    }, 650);
    return () => { clearInterval(t); clearInterval(pop); };
  }, [on, words]);
  const hit = (i, e) => { const m = holes[i]; if (!m || !cur) return; if (m.w.id === cur.id) { scoreRef.current += 1; setScore(s => s + 1); track.correct(cur, e); setHoles(h => { const c = [...h]; c[i] = null; return c; }); newTarget(); } else { track.wrong(cur); sfx.bad(); } };
  return (
    <GameCard>
      <Bar left={`⏱ ${time}s`} right={`⭐${score}`} />
      <div style={GS.body}>
        {!on ? <div style={{ textAlign:"center",padding:"26px 0" }}>
          <Shape kind="burst" size={110} fill={T.tertiaryC}><span style={{ fontSize:54 }}>🔨</span></Shape>
          <p style={{ ...TYPE.headlineS,color:T.ink,margin:"12px 0 4px" }}>ตีตัวตุ่น</p>
          <p style={{ ...TYPE.bodyM,color:T.ink2,margin:"0 0 18px" }}>ฟังคำ แล้วตีตุ่นที่ถือรูปตรงกัน · ตุ่นโผล่เร็วขึ้นเรื่อยๆ<br/>7 ตัว = ⭐⭐ · 12 ตัว = ⭐⭐⭐</p>
          <Pill onClick={() => { setTime(DUR); setScore(0); scoreRef.current = 0; tick.current = 0; setHoles(Array(6).fill(null)); setOn(true); newTarget(); }}>▶ เริ่ม!</Pill>
        </div> : <>
          <SoundPrompt onClick={() => cur && speak(cur.word, cur.meaning)} size={64} w={cur} pulse={false} />
          <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10 }}>
            {holes.map((m, i) => (
              <button key={i} onPointerDown={e => hit(i, e)} style={{ position:"relative",height:"min(19vh, 170px)",borderRadius:24,border:"none",background:`radial-gradient(ellipse at 50% 85%, ${MD.inverseSurface} 0 38%, transparent 40%), ${T.surfHigh}`,overflow:"hidden",cursor:"pointer",padding:0 }}>
                {m && <span key={m.key} style={{ position:"absolute",left:"6%",right:"6%",bottom:"6%",top:"6%",borderRadius:20,overflow:"hidden",background:T.card,boxShadow:MD.shadow,animation:"vpMolePop .25s cubic-bezier(.34,1.56,.64,1) both" }}><PicFill w={m.w} emojiSize={40} /></span>}
              </button>
            ))}
          </div>
        </>}
      </div>
    </GameCard>
  );
}

// ── ลูกโป่ง: รูปอยู่บน ลูกโป่งคำลอยขึ้น เจาะลูกที่ถูกก่อนลอยพ้นจอ ──
function BalloonGame({ words, speak, track }) {
  const ROUNDS = 10; const COLORS = ["#f472b6", "#60a5fa", "#fbbf24", "#34d399", "#a78bfa", "#fb923c"];
  const [round, setRound] = useState(0); const [hearts, setHearts] = useState(3); const [score, setScore] = useState(0);
  const [cur, setCur] = useState(null); const [bal, setBal] = useState([]); const [on, setOn] = useState(false); const [popped, setPopped] = useState({});
  const busy = useRef(false); const scoreRef = useRef(0); const heartsRef = useRef(3); const roundRef = useRef(0);
  const launch = useCallback(() => {
    const w = words[Math.floor(Math.random() * words.length)]; setCur(w); speak(w.word, w.meaning);
    const list = shuffle([w, ...pickOthers(words, w, 2)]).map((x, i) => ({ w: x, key: `${roundRef.current}-${i}`, col: i, color: COLORS[(roundRef.current + i) % COLORS.length], delay: i * 0.35, dur: Math.max(3.2, 6 - roundRef.current * 0.3) }));
    setBal(list); setPopped({}); busy.current = false;
  }, [words, speak]);
  const endOrNext = () => { roundRef.current += 1; if (heartsRef.current <= 0 || roundRef.current >= ROUNDS) { setOn(false); track.finish(scoreRef.current, ROUNDS, { stars: starsFor(scoreRef.current, ROUNDS) }); } else { setRound(roundRef.current); launch(); } };
  const loseHeart = () => { heartsRef.current -= 1; setHearts(heartsRef.current); };
  const tap = (b, e) => {
    if (busy.current || popped[b.key]) return;
    if (b.w.id === cur.id) { busy.current = true; setPopped(p => ({ ...p, [b.key]: true })); scoreRef.current += 1; setScore(scoreRef.current); track.correct(cur, e); afterSpeech(endOrNext, 700, 2500); }
    else { setPopped(p => ({ ...p, [b.key]: true })); track.wrong(cur); loseHeart(); if (heartsRef.current <= 0) { busy.current = true; setTimeout(endOrNext, 500); } }
  };
  const escaped = b => { if (busy.current || popped[b.key] || b.w.id !== cur?.id) return; busy.current = true; track.wrong(cur); loseHeart(); setTimeout(endOrNext, 400); };
  return (
    <GameCard>
      <Bar left={`🎈 ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`} right={<Hearts n={hearts} />} />
      <div style={{ ...GS.body,paddingBottom:8 }}>
        {!on ? <div style={{ textAlign:"center",padding:"26px 0" }}>
          <Shape kind="cookie9" size={110} fill={T.secondaryC}><span style={{ fontSize:54 }}>🎈</span></Shape>
          <p style={{ ...TYPE.headlineS,color:T.ink,margin:"12px 0 4px" }}>เจาะลูกโป่ง</p>
          <p style={{ ...TYPE.bodyM,color:T.ink2,margin:"0 0 18px" }}>ฟังเสียง แล้วเจาะลูกโป่งที่มีรูปตรงกันก่อนลอยพ้นจอ · มี 3 หัวใจ · ลอยเร็วขึ้นทุกรอบ</p>
          <Pill onClick={() => { roundRef.current = 0; scoreRef.current = 0; heartsRef.current = 3; setRound(0); setScore(0); setHearts(3); setOn(true); launch(); }}>▶ เริ่ม!</Pill>
        </div> : <>
          <SoundPrompt onClick={() => cur && speak(cur.word, cur.meaning)} size={72} w={cur} />
          <div style={{ position:"relative",height:"min(52vh,440px)",overflow:"hidden",borderRadius:20,background:`linear-gradient(180deg, ${T.secondaryC}, ${T.surf})`,marginTop:8 }}>
            {bal.map(b => !popped[b.key] && (
              <button key={b.key} onPointerDown={e => tap(b, e)} onAnimationEnd={() => escaped(b)}
                style={{ position:"absolute",left:`${b.col * 33.2}%`,bottom:-200,width:"33.4%",minWidth:90,border:"none",background:"transparent",cursor:"pointer",padding:0,animation:`vpRise ${b.dur}s ${b.delay}s linear both` }}>
                <span style={{ display:"block",width:"100%",aspectRatio:"0.85",borderRadius:"50% 50% 50% 50% / 45% 45% 55% 55%",background:b.color,boxShadow:"inset -6px -8px 14px rgba(0,0,0,.15)",padding:"3%",boxSizing:"border-box" }}><span style={{ position:"relative",display:"block",width:"100%",height:"100%",borderRadius:"46%",overflow:"hidden",background:T.card }}><PicFill w={b.w} emojiSize={30} /></span></span>
                <span style={{ display:"block",width:2,height:26,margin:"0 auto",background:"rgba(0,0,0,.25)" }} />
              </button>
            ))}
            {bal.map(b => popped[b.key] && b.w.id === cur?.id && <span key={"p" + b.key} style={{ position:"absolute",left:`${12 + b.col * 23}%`,top:"40%",fontSize:34,animation:"vpStarPop .5s both" }}>✨</span>)}
          </div>
          <div style={{ textAlign:"center",...TYPE.labelM,color:T.ink2,marginTop:6 }}>⭐{score} · เจาะลูกโป่งรูปที่ได้ยิน</div>
        </>}
      </div>
    </GameCard>
  );
}

// ── ฟันคำ (นินจา): คำลอยขึ้นมา ปาดนิ้วผ่านรูปที่ตรงกับเสียง ──
function NinjaGame({ words, speak, track }) {
  const ROUNDS = 8;
  const [round, setRound] = useState(0); const [hearts, setHearts] = useState(3); const [score, setScore] = useState(0);
  const [cur, setCur] = useState(null); const [items, setItems] = useState([]); const [on, setOn] = useState(false); const [cut, setCut] = useState({});
  const busy = useRef(false); const scoreRef = useRef(0); const heartsRef = useRef(3); const roundRef = useRef(0); const down = useRef(false); const lastHit = useRef(null);
  const launch = useCallback(() => {
    const w = words[Math.floor(Math.random() * words.length)]; setCur(w); speak(w.word, w.meaning);
    setItems(shuffle([w, ...pickOthers(words, w, 2)]).map((x, i) => ({ w: x, key: `${roundRef.current}-${i}`, x: 1 + i * 33.5, delay: i * 0.25, dur: Math.max(2.4, 3.6 - roundRef.current * 0.15) })));
    setCut({}); busy.current = false; lastHit.current = null;
  }, [words, speak]);
  const loseHeart = () => { heartsRef.current -= 1; setHearts(heartsRef.current); };
  const endOrNext = () => { roundRef.current += 1; if (heartsRef.current <= 0 || roundRef.current >= ROUNDS) { setOn(false); track.finish(scoreRef.current, ROUNDS, { stars: starsFor(scoreRef.current, ROUNDS) }); } else { setRound(roundRef.current); launch(); } };
  const slice = (it, e) => {
    if (busy.current || cut[it.key] || lastHit.current === it.key) return; lastHit.current = it.key;
    setCut(c => ({ ...c, [it.key]: true }));
    if (it.w.id === cur.id) { busy.current = true; scoreRef.current += 1; setScore(scoreRef.current); track.correct(cur, e); fx.burst?.(e.clientX, e.clientY, { count: 18 }); afterSpeech(endOrNext, 600, 2500); }
    else { track.wrong(cur); loseHeart(); if (heartsRef.current <= 0) { busy.current = true; setTimeout(endOrNext, 500); } }
  };
  const onMove = e => { if (!down.current) return; const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-ninja]"); if (el) { const it = items.find(i => i.key === el.dataset.ninja); if (it) slice(it, e); } };
  const fell = it => { if (busy.current || cut[it.key] || it.w.id !== cur?.id) return; busy.current = true; track.wrong(cur); loseHeart(); setTimeout(endOrNext, 400); };
  return (
    <GameCard>
      <Bar left={`🗡️ ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`} right={<Hearts n={hearts} />} />
      <div style={{ ...GS.body,paddingBottom:8 }}>
        {!on ? <div style={{ textAlign:"center",padding:"26px 0" }}>
          <Shape kind="cookie6" size={110} fill={T.errorC}><span style={{ fontSize:54 }}>🗡️</span></Shape>
          <p style={{ ...TYPE.headlineS,color:T.ink,margin:"12px 0 4px" }}>นินจาฟันคำ</p>
          <p style={{ ...TYPE.bodyM,color:T.ink2,margin:"0 0 18px" }}>รูปจะกระเด็นขึ้นมา ปาดนิ้วผ่านรูปที่ตรงกับเสียง · ฟันผิดเสียหัวใจ · ปล่อยให้คำที่ถูกตกก็เสียหัวใจ</p>
          <Pill onClick={() => { roundRef.current = 0; scoreRef.current = 0; heartsRef.current = 3; setRound(0); setScore(0); setHearts(3); setOn(true); launch(); }}>▶ เริ่ม!</Pill>
        </div> : <>
          <SoundPrompt onClick={() => cur && speak(cur.word, cur.meaning)} size={72} w={cur} />
          <div onPointerDown={e => { down.current = true; onMove(e); }} onPointerMove={onMove} onPointerUp={() => { down.current = false; lastHit.current = null; }} onPointerLeave={() => { down.current = false; }}
            style={{ position:"relative",height:"min(40vh,340px)",overflow:"hidden",borderRadius:20,background:`linear-gradient(180deg, ${T.surf}, ${T.tertiaryC})`,marginTop:8,touchAction:"none",userSelect:"none" }}>
            {items.map(it => (
              <span key={it.key} data-ninja={cut[it.key] ? undefined : it.key} onAnimationEnd={() => fell(it)}
                style={{ position:"absolute",left:`${it.x}%`,bottom:-150,width:"32%",aspectRatio:"1",borderRadius:20,overflow:"hidden",border:`3px solid ${cut[it.key] ? T.outlineV : T.primary}`,background:T.card,boxShadow:cut[it.key] ? "none" : MD.shadow,animation:`vpFly ${it.dur}s ${it.delay}s ease-out both`,opacity:cut[it.key] ? 0.35 : 1,transform:cut[it.key] ? "rotate(18deg)" : "none",pointerEvents:"auto" }}>
                <PicFill w={it.w} emojiSize={36} />
              </span>
            ))}
          </div>
          <div style={{ textAlign:"center",...TYPE.labelM,color:T.ink2,marginTop:6 }}>⭐{score} · ปาดนิ้วผ่านรูปที่ได้ยิน</div>
        </>}
      </div>
    </GameCard>
  );
}

// ── บิงโก: ตาราง 3×3 รูป ฟังคำแล้วแตะช่อง ครบแถวได้โบนัส ──
function BingoGame({ words, speak, track }) {
  const grid = useMemo(() => shuffle(words).slice(0, 9), [words]);
  const [marked, setMarked] = useState({}); const [cur, setCur] = useState(null); const [hearts, setHearts] = useState(3); const [lines, setLines] = useState(0); const [on, setOn] = useState(false);
  const scoreRef = useRef(0); const heartsRef = useRef(3); const markedRef = useRef({});
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const countLines = m => LINES.filter(l => l.every(i => m[grid[i].id])).length;
  const next = useCallback(() => { const left = grid.filter(w => !markedRef.current[w.id]); if (!left.length) return; const w = left[Math.floor(Math.random() * left.length)]; setCur(w); speak(w.word, w.meaning); }, [grid, speak]);
  const finish = () => { setOn(false); track.finish(scoreRef.current, 9, { stars: scoreRef.current >= 9 ? 3 : scoreRef.current >= 6 ? 2 : scoreRef.current >= 3 ? 1 : 0, label:`ถูก ${scoreRef.current}/9 · บิงโก ${countLines(markedRef.current)} แถว` }); };
  const tap = (w, e) => {
    if (!cur || markedRef.current[w.id]) return;
    if (w.id === cur.id) {
      markedRef.current = { ...markedRef.current, [w.id]: true }; setMarked(markedRef.current); scoreRef.current += 1; track.correct(cur, e);
      const nl = countLines(markedRef.current); if (nl > lines) { setLines(nl); fx.win?.(1); sfx.win(); }
      if (Object.keys(markedRef.current).length >= 9) { setTimeout(finish, 900); } else afterSpeech(next, 500, 2500);
    } else { track.wrong(cur); heartsRef.current -= 1; setHearts(heartsRef.current); if (heartsRef.current <= 0) setTimeout(finish, 500); }
  };
  return (
    <GameCard>
      <Bar left={`🎱 บิงโก ${lines} แถว`} right={<Hearts n={hearts} />} />
      <div style={GS.body}>
        {!on ? <div style={{ textAlign:"center",padding:"26px 0" }}>
          <Shape kind="clover" size={110} fill={T.okC}><span style={{ fontSize:54 }}>🎱</span></Shape>
          <p style={{ ...TYPE.headlineS,color:T.ink,margin:"12px 0 4px" }}>บิงโกฟังคำ</p>
          <p style={{ ...TYPE.bodyM,color:T.ink2,margin:"0 0 18px" }}>ฟังคำ แล้วแตะรูปในตาราง · ครบ 3 ช่องเป็นแถว = บิงโก! · กดผิดเสียหัวใจ</p>
          <Pill onClick={() => { setOn(true); next(); }}>▶ เริ่ม!</Pill>
        </div> : <>
          <SoundPrompt onClick={() => cur && speak(cur.word, cur.meaning)} size={64} w={cur} pulse={false} />
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
            {grid.map(w => (
              <button key={w.id} onClick={e => tap(w, e)} style={{ position:"relative",aspectRatio:"1",borderRadius:20,border:"none",overflow:"hidden",background:T.surfHigh,cursor:"pointer",padding:0,outline:marked[w.id] ? `4px solid ${MD.ok}` : "none",outlineOffset:-4 }}>
                <PicFill w={w} emojiSize={36} />
                {marked[w.id] && <span style={{ position:"absolute",inset:0,background:"color-mix(in oklab, var(--md-ok) 55%, transparent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,animation:"vpStarPop .5s both" }}>✓</span>}
              </button>
            ))}
          </div>
        </>}
      </div>
    </GameCard>
  );
}

function GameRouter({ gameId, cat, words, speak, speakAt, showToast, onBack, progress, setProgress, allWords }) {
  const [result, setResult] = useState(null);
  const [run, setRun] = useState(0);
  const correctRef = useRef([]);
  const pRef = useRef(progress); pRef.current = progress;

  const track = useMemo(() => ({
    correct: (w, e) => { sfx.ok(); fx.correct(e, ["+1 ⭐","เยี่ยม!","Great!","Perfect!","สุดยอด!"][Math.floor(Math.random()*5)]); if (w) correctRef.current.push(w.id); },
    wrong: w => {
      sfx.bad(); fx.wrong();
      setProgress(p => ({ ...p, wrongTotal: (p.wrongTotal || 0) + 1,
        ...(w ? { mistakes: { ...p.mistakes, [w.id]: (p.mistakes[w.id] || 0) + 1 }, srs: srsWrong(p.srs || {}, w.id) } : {}) }));
    },
    finish: (score, total, opts = {}) => {
      const p = pRef.current;
      const stars = opts.stars ?? starsFor(score, total);
      const key = `${cat.id}:${gameId}`;
      const ids = correctRef.current;
      const stickers = { ...p.stickers };
      const newStickers = [];
      ids.forEach(id => {
        const before = stickers[id] || 0;
        stickers[id] = before + 1;
        if (before < STICKER_NEED && stickers[id] >= STICKER_NEED) newStickers.push(id);
      });
      const mistakes = { ...p.mistakes };
      ids.forEach(id => { if (mistakes[id]) { mistakes[id] -= 1; if (mistakes[id] <= 0) delete mistakes[id]; } });
      const coins = score * 2 + stars * 10 + (opts.bonus || 0);
      const lvBefore = petLevel(p.totalCorrect);
      const totalCorrect = p.totalCorrect + ids.length;
      const cleared = !!opts.boss && !!opts.cleared;
      let srs = p.srs || {};
      [...new Set(ids)].forEach(id => { srs = srsCorrect(srs, id); });
      let next = {
        ...p, coins: p.coins + coins, stickers, mistakes, totalCorrect, games: p.games + 1, srs,
        stars: { ...p.stars, [key]: Math.max(p.stars[key] || 0, stars) },
        boss: cleared ? { ...p.boss, [cat.id]: true } : p.boss,
      };
      // ภารกิจประจำวัน
      next = bumpDaily(next, "games", 1);
      next = bumpDaily(next, "correct", ids.length);
      next = bumpDaily(next, "stars", stars);
      next = bumpDaily(next, "stickers", newStickers.length);
      if (cat.id === "review") next = bumpDaily(next, "review", 1);
      if (gameId === "speak") next = bumpDaily(next, "speak", 1);
      if (gameId === "sentence") next = bumpDaily(next, "sentence", 1);
      if (gameId === "droleplay" || gameId === "dfill") next = bumpDaily(next, "dialog", 1);
      if (gameId === "squiz") next = bumpDaily(next, "story", 1);
      if (gameId === "phonics") next = bumpDaily(next, "phonics", 1);
      if (gameId === "grammar") next = bumpDaily(next, "grammar", 1);
      if (["time","money","calendar","numbers100"].includes(gameId)) next = bumpDaily(next, "daily", 1);
      if (cat.unit && stars >= 1) next = markUnitStep(next, cat.unit.id, gameId);
      setProgress(next);
      if (stars >= 2) { sfx.win(); fx.win(stars); } else if (stars === 1) { sfx.coin(); fx.confetti(40); } else sfx.lose();
      if (petLevel(totalCorrect) > lvBefore) setTimeout(() => fx.levelUp(), 700);
      setResult({ score, total, stars, coins, newStickers, gotIds: [...new Set(ids)].slice(0, 8), label: opts.label, boss: !!opts.boss, cleared, levelUp: petLevel(totalCorrect) > lvBefore });
    },
  }), [gameId, cat.id, setProgress]);

  const replay = () => { correctRef.current = []; setResult(null); setRun(r => r + 1); };
  const p = { words, speak, speakAt, showToast, onBack, cat, track, allWords, key: run, pet: getPet(progress), hat: progress.hat, outfit: progress.outfit };
  let game = null;
  const catPool = cat.unit ? allWords.filter(w => w.cat === cat.unit.cat.id) : words;
  if (gameId === "quiz")     game = <QuizGame {...p} pool={cat.id === "review" ? allWords : catPool} />;
  if (gameId === "listen")   game = <ListenGame {...p} pool={catPool} />;
  if (gameId === "speak")    game = <SpeakGame {...p} />;
  if (gameId === "sentence") game = <SentenceGame {...p} />;
  if (gameId === "spell")    game = <SpellGame {...p} />;
  if (gameId === "memory")   game = <MemoryGame {...p} />;
  if (gameId === "speed")    game = <SpeedGame {...p} />;
  if (gameId === "mole")     game = <MoleGame {...p} />;
  if (gameId === "balloon")  game = <BalloonGame {...p} />;
  if (gameId === "ninja")    game = <NinjaGame {...p} />;
  if (gameId === "bingo")    game = <BingoGame {...p} />;
  if (gameId === "feed")     game = <FeedGame {...p} />;
  if (gameId === "runner")   game = <GameCard><div style={GS.body}><Suspense fallback={<div style={{ textAlign:"center",padding:40,...TYPE.titleM,color:T.ink2 }}>🏃 กำลังสร้างโลก 3 มิติ…</div>}>
    <Runner3D key={run} words={words} speak={speak} track={track} catId={cat.id} sfx={sfx} Prompt={SoundPrompt}
      ui={{ imageUrl: w => { const t = imageTitleOf(w); return t ? bundledImageUrl(t) : null; }, say: w => speak(w.word, w.meaning), correct: w => track.correct(w), wrong: w => track.wrong(w), unlock: unlockSfx,
        tokens: { card:T.card, ink:T.ink, primary:T.primary, onPrimary:T.onPrimary, shadow:MD.shadow } }} />
  </Suspense></div></GameCard>;
  if (gameId === "habitat")  game = <HabitatGame {...p} />;
  if (gameId === "match")    game = <MatchGame {...p} />;
  if (gameId === "colormix") game = <ColorMixGame {...p} />;
  if (gameId === "count")    game = <CountGame {...p} />;
  if (gameId === "bodydr")   game = <BodyDoctorGame {...p} />;
  if (gameId === "dress")    game = <DressGame {...p} />;
  if (gameId === "boss")     game = <BossGame {...p} />;
  if (gameId === "droleplay") game = <RolePlayGame {...p} />;
  if (gameId === "dfill")    game = <FillGame {...p} />;
  if (gameId === "squiz")    game = <StoryQuizGame {...p} />;
  if (gameId === "phonics")  game = <PhonicsGame {...p} />;
  if (gameId === "grammar")  game = <GrammarGame {...p} />;
  if (["time","money","calendar","numbers100"].includes(gameId)) game = <DailyGame {...p} />;
  if (gameId === "test")     game = <TestGame {...p} />;
  return (
    <>
      {game}
      {result && <ResultScreen r={result} words={allWords} speak={speak} pet={getPet(progress)} onReplay={replay} onExit={onBack} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════
// RESULT SCREEN — ดาว / เหรียญ / สติกเกอร์ใหม่ / คอนเฟตตี
// ═══════════════════════════════════════════════════════
function ResultScreen({ r, words, speak, pet, onReplay, onExit }) {
  const msg = r.boss
    ? (r.cleared ? "ชนะบอสแล้ว!" : "บอสยังแกร่งอยู่ ลองใหม่นะ")
    : r.stars === 3 ? "สุดยอดไปเลย!" : r.stars === 2 ? "เก่งมาก!" : r.stars === 1 ? "ดีแล้ว สู้ต่อ!" : "ลองใหม่อีกครั้งนะ";
  const big = r.boss ? (r.cleared ? "👑" : "🛡️") : r.stars >= 2 ? "🎉" : r.stars === 1 ? "🙂" : "💪";
  const newW = r.newStickers.map(id => words.find(w => w.id === id)).filter(Boolean);
  const gotW = (r.gotIds || []).map(id => words.find(w => w.id === id)).filter(Boolean);
  const petLine = !pet ? null : r.levelUp ? `เลเวลอัป! ตอนนี้ Lv.${pet.level} แล้ว` : r.stars >= 2 ? "เย้! เก่งที่สุดเลย" : r.stars === 1 ? "ดีขึ้นเรื่อยๆ นะ" : "ไม่เป็นไร ลองอีกที!";
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:MD.scrim,display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"m3Fade .2s both" }}>
      <div style={{ position:"absolute",inset:0,background:r.stars>=2?"radial-gradient(circle at 50% 30%, rgba(255,209,102,.35), transparent 60%)":"none",pointerEvents:"none" }} />
      <div style={{ background:T.surfHigh,color:T.ink,borderRadius:36,padding:"26px 18px 18px",maxWidth:380,width:"100%",textAlign:"center",boxShadow:MD.shadow,animation:"vpInScale .6s cubic-bezier(.2,.8,.2,1) both",maxHeight:"90dvh",overflowY:"auto",position:"relative",overflow:"hidden",fontFamily:FONT }}>
        {r.stars >= 2 && <div style={{ position:"absolute",left:"50%",top:60,width:360,height:360,marginLeft:-180,borderRadius:"50%",background:"conic-gradient(from 0deg, rgba(255,209,102,.25) 0 15deg, transparent 15deg 30deg)",animation:"vpSpin 14s linear infinite",pointerEvents:"none",maskImage:"radial-gradient(circle, #000 20%, transparent 70%)",WebkitMaskImage:"radial-gradient(circle, #000 20%, transparent 70%)" }} />}
        {pet ? (
          <div style={{ position:"relative",display:"flex",justifyContent:"center",animation:r.stars>=1?"vpBounce 1.2s ease-in-out infinite":"vpFloatY 2.4s ease-in-out infinite" }}>
            <Shape kind="cookie12" size={132} fill={r.stars>=2?T.tertiaryC:T.primaryC} morph spin={r.stars>=2}>
              <PetAvatar pet={pet} size={74} mood={r.stars >= 2 ? "excited" : r.stars === 1 ? "happy" : "sad"} talk />
            </Shape>
            <span style={{ position:"absolute",right:"18%",top:-6,fontSize:40,animation:"vpStarPop .7s .3s both" }}>{big}</span>
          </div>
        ) : <div style={{ fontSize:72,lineHeight:1,position:"relative",animation:"vpFloatY 2.4s ease-in-out infinite" }}>{big}</div>}
        <h2 style={{ margin:"12px 0 4px",fontSize:26,fontWeight:900,color:T.ink,position:"relative",letterSpacing:-.3 }}>{msg}</h2>
        <div style={{ color:T.ink2,fontSize:14,fontWeight:600,position:"relative" }}>{r.label || `ตอบถูก ${r.score}/${r.total}`}</div>
        <div style={{ display:"flex",justifyContent:"center",gap:4,margin:"14px 0 10px",position:"relative" }}>
          {[1,2,3].map(i => (
            <span key={i} style={{ fontSize:i===2?56:44,lineHeight:1,marginTop:i===2?-10:0,animation:i<=r.stars?`vpStarPop .7s ${0.3+i*0.28}s both`:"none",filter:i<=r.stars?"drop-shadow(0 4px 10px rgba(245,158,11,.7))":"grayscale(1) opacity(0.2)" }}>⭐</span>
          ))}
        </div>
        <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:T.grad,color:T.onTertiaryC,fontWeight:900,fontSize:20,padding:"10px 22px",borderRadius:999,boxShadow:"0 10px 24px rgba(251,146,60,.4)",position:"relative",animation:"vpInScale .5s 1.2s both" }}>
          <span className="vp-shimmer" style={{ position:"absolute",inset:0,borderRadius:999,pointerEvents:"none" }} />
          +<CountUp to={r.coins} ms={1200} /> 🪙
        </div>

        {newW.length > 0 && (
          <div style={{ marginTop:14,background:T.secondaryC,color:T.onSecondaryC,borderRadius:20,padding:"10px 12px" }}>
            <div style={{ fontWeight:800,fontSize:13,marginBottom:6 }}>✨ สติกเกอร์ใหม่ {newW.length} ใบ!</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center" }}>
              {newW.map(w => (
                <button key={w.id} onClick={() => { sfx.tap(); speak(w.word, w.meaning); }}
                  data-thumb style={{ position:"relative",width:64,height:64,borderRadius:16,overflow:"hidden",background:T.card,border:`3px solid ${T.primary}`,padding:0,cursor:"pointer",animation:"vpPop .4s both" }}>
                  <PicFill w={w} emojiSize={28} />
                </button>
              ))}
            </div>
          </div>
        )}

        {pet && <div style={{ margin:"12px auto 0",display:"table",background:T.card,color:T.ink,borderRadius:"20px 20px 20px 6px",padding:"8px 14px",fontSize:14,fontWeight:700 }}><b style={{ color:T.primary }}>{pet.name}:</b> {petLine} {r.levelUp && "🎊"}</div>}
        {gotW.length > 0 && (
          <div style={{ marginTop:12,textAlign:"left" }}>
            <div style={{ fontWeight:800,fontSize:13,color:T.ink2,margin:"0 4px 6px" }}>✅ คำที่ตอบถูก · แตะฟังอีกครั้ง</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6 }}>
              {gotW.map(w => <button key={w.id} onClick={() => { sfx.tap(); speak(w.word, w.meaning); }} data-thumb className="m3-press" style={{ position:"relative",display:"flex",flexDirection:"column",padding:0,border:"none",borderRadius:14,overflow:"hidden",background:T.card,cursor:"pointer",fontFamily:FONT }}>
                <span style={{ position:"relative",display:"block",width:"100%",aspectRatio:"1" }}><PicFill w={w} emojiSize={26} /></span>
                <span style={{ fontSize:11,fontWeight:800,color:T.ink,padding:"2px 2px 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{w.word}</span>
              </button>)}
            </div>
          </div>
        )}

        <div style={{ display:"flex",gap:8,marginTop:16 }}>
          <button onClick={onReplay} className="m3-press" style={M3.filled({ flex:1,minHeight:52,fontSize:15 })}>🔄 เล่นอีก</button>
          <button onClick={onExit} className="m3-press" style={M3.tonal({ flex:1,minHeight:52,fontSize:15 })}>กลับ ›</button>
        </div>
      </div>
    </div>
  );
}

const CONF_COLORS = ["#f43f5e","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"];
function Confetti({ count = 56 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    l: Math.random()*100, d: Math.random()*0.9, r: Math.random()*360, c: CONF_COLORS[i % CONF_COLORS.length],
    s: 6 + Math.random()*7, t: 1.8 + Math.random()*1.2, round: i % 3 === 0,
  })), [count]);
  return (
    <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9500,overflow:"hidden" }}>
      {pieces.map((p, i) => (
        <span key={i} style={{ position:"absolute",top:-20,left:`${p.l}%`,width:p.s,height:p.round?p.s:p.s*1.5,background:p.c,borderRadius:p.round?"50%":2,transform:`rotate(${p.r}deg)`,animation:`vpFall ${p.t}s ${p.d}s ease-in forwards` }} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SHARED GAME UI
// ═══════════════════════════════════════════════════════
const GS = { // game styles (immersive)
  wrap: { padding:"6px 12px 24px",maxWidth:520,margin:"0 auto" },
  card: { background:MD.surfLowest,color:MD.onSurface,borderRadius:28,border:`2px solid ${MD.cardBorder}`,boxShadow:`0 5px 0 ${MD.cardEdge}`,overflow:"hidden" },
  bar: { display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px 8px",fontSize:15,fontWeight:600,fontFamily:HFONT,color:MD.onSurface },
  body: { padding:"6px 16px 18px" },
  soundBtn: { ...M3.tonal({ minHeight:48,padding:"0 22px",fontSize:14 }),margin:"0 auto 12px",display:"flex" },
};

function GameCard({ children }) { return <div style={GS.wrap}><div style={GS.card}>{children}</div></div>; }
function Bar({ left, right }) { return <div style={GS.bar}><span>{left}</span><span>{right}</span></div>; }
// ── รูปจริง (Wikipedia) หรืออีโมจิ ──
const PicCtx = createContext(true);
if (typeof document !== "undefined" && !document.getElementById("vp-pet-css")) { const st = document.createElement("style"); st.id = "vp-pet-css"; st.textContent = PET_CSS; document.head.appendChild(st); }   // เปิด/ปิดรูปจริงจากตั้งค่า
function useWordImage(w) {
  const on = useContext(PicCtx);
  const title = on ? imageTitleOf(w) : null;
  const [url, setUrl] = useState(() => (title ? cachedImageUrl(title) : ""));
  useEffect(() => {
    if (!title) { setUrl(""); return; }
    const c = cachedImageUrl(title);
    if (c !== undefined) { setUrl(c); return; }
    let alive = true; setUrl(undefined);
    fetchImageUrl(title).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [title]);
  return { url: url || "", title, loading: title && url === undefined };
}
// รูปคำศัพท์: มีรูปจริง → แสดงรูป (อีโมจิเล็กๆ มุมขวาล่าง) · ไม่มี/โหลดไม่ได้ → อีโมจิ
function Pic({ w, size = 72, radius = 18, style = {}, fill = false }) {
  const { url } = useWordImage(w);
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [url]);
  const concept = (!url || err) ? conceptFor(w) : null;
  // คำที่ไม่มีรูปถ่าย/ภาพออกแบบ → อีโมจิตัวใหญ่เต็มกล่องสีอ่อน (ไม่ทิ้งที่ว่าง)
  if ((!url || err) && !concept) return fill
    ? <span data-emoji-box style={{ display:"flex",alignItems:"center",justifyContent:"center",width:"100%",maxWidth:"100%",height:"min(46vh, 430px, 92vw)",borderRadius:22,background:`linear-gradient(135deg, ${T.secondaryC}, ${T.tertiaryC})`,fontSize:"min(26vh, 220px, 60vw)",lineHeight:1,...style }}><span style={{ filter:"drop-shadow(0 8px 14px rgba(0,0,0,.18))" }}>{w?.emoji}</span></span>
    : <span data-emoji-box style={{ fontSize:size,lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center",...style }}>{w?.emoji}</span>;
  const box = fill ? "100%" : size * 2.2;
  const [asp, setAsp] = useState(0);   // สัดส่วนจริงของรูป (กว้าง/สูง) → กรอบเปลี่ยนตามรูป ไม่มีขอบว่าง ไม่เบลอ
  useEffect(() => setAsp(0), [url]);
  const MAXH = "min(46vh, 430px, 92vw)";
  const fa = asp ? Math.min(1.3, Math.max(0.72, asp)) : 4/3;
  const fillBox = fill ? { width:"100%", maxWidth:`calc(${MAXH} * ${fa})`, aspectRatio:String(fa) } : { width:box, aspectRatio:String(fa) };
  if (concept) return (
    <span style={{ position:"relative",display:"inline-block",maxWidth:"100%",...(fill ? { width:"100%",height:MAXH } : fillBox),borderRadius:fill?22:radius,overflow:"hidden",boxShadow:"0 10px 28px rgba(15,23,42,0.18)",...style }}>
      {concept}
    </span>
  );
  return (
    <span style={{ position:"relative",display:"inline-block",maxWidth:"100%",...fillBox,borderRadius:fill?22:radius,overflow:"hidden",background:T.surfHighest,...style }}>
      <img src={url} alt={w.word} onLoad={e => { const im = e.currentTarget; if (im.naturalWidth) setAsp(im.naturalWidth / im.naturalHeight); }} onError={() => setErr(true)} loading="lazy" style={{ position:"relative",width:"100%",height:"100%",objectFit:"contain",display:"block" }} />
      {size >= 30 && <span style={{ position:"absolute",right:4,bottom:3,fontSize:Math.max(14, size*0.3),lineHeight:1,filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>{w.emoji}</span>}
    </span>
  );
}
// รูปปก: เต็มกรอบ (cover) แต่ถ้าสัดส่วนรูปต่างจากกรอบมาก (แนวตั้ง/แนวนอนสลับ) → แสดงเต็มใบ (contain) บนพื้นเบลอ จุดโฟกัสไม่ล้นขอบ
function CoverImg({ url, word, onError }) {
  const [safe, setSafe] = useState(false);
  const chk = e => {
    const im = e.currentTarget, p = im.parentElement; if (!p || !im.naturalWidth) return;
    const fr = p.clientWidth / Math.max(1, p.clientHeight), ir = im.naturalWidth / im.naturalHeight;
    setSafe(Math.max(fr / ir, ir / fr) > 1.3);
  };
  return <img src={url} alt={word} onLoad={chk} onError={onError} loading="lazy" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:safe?"contain":"cover",objectPosition:"center 40%",borderRadius:"inherit",background:T.surfHighest }} />;
}
// รูปเล็กสำหรับตัวเลือก 4 ช่อง / การ์ดจับคู่: เต็มช่อง
function PicFill({ w, emojiSize = 40, fit }) {
  const { url } = useWordImage(w);
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [url]);
  const concept = (!url || err) ? conceptFor(w) : null;
  if (concept) return <span style={{ position:"absolute",inset:0,borderRadius:"inherit",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center" }}>{concept}</span>;
  if (!url || err) return <span data-emoji-box style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:`clamp(${emojiSize}px, 48%, 120px)`,lineHeight:1,background:`linear-gradient(135deg, ${T.secondaryC}, ${T.tertiaryC})` }}>{w?.emoji}</span>;
  // รูปปก/ภาพรวม (cover) ตัดขอบได้ · รูปคำศัพท์เดี่ยวใช้ contain ไม่ให้ตัวสัตว์ขาด
  // รูปในช่อง: ถ้าสัดส่วนใกล้กรอบ (≤1.12 เท่า) → เต็มกรอบ (ตัดขอบนิดหน่อย) · ต่างมาก → แสดงทั้งรูปบนพื้นเรียบ ไม่เบลอ ไม่ตัดตัว
  return <CoverImg url={url} word={w.word} onError={() => setErr(true)} />;
}
function Emoji({ e, w, size=72, fill=true }) {
  return <div style={{ textAlign:"center",lineHeight:1,padding:"6px 0 8px",display:"flex",justifyContent:"center" }}>{w ? <Pic w={w} size={size} fill={fill} /> : <span style={{ fontSize:size*1.3 }}>{e}</span>}</div>;
}
// ปุ่มลำโพงใหญ่ สำหรับเกม "ฟังแล้วเลือกรูป" (เด็กที่ยังอ่านไม่ออกเล่นได้)
function SoundPrompt({ onClick, pulse = true, size = 80, w, word, sub }) {
  // โจทย์ = เสียง + คำเขียนเสมอ: การ์ดขาว ปุ่มลำโพงม่วงนูน · คำอังกฤษตัวใหญ่ Fredoka
  const t = word ?? w?.word, m = sub ?? w?.meaning;
  const fs = !t ? 0 : t.length > 12 ? "clamp(22px,6.4vw,28px)" : t.length > 7 ? "clamp(26px,8vw,34px)" : "clamp(32px,10vw,44px)";
  return <button onClick={onClick} aria-label="ฟังคำ" style={{ display:"flex",alignItems:"center",gap:14,width:t ? "100%" : size,maxWidth:t ? 480 : size,margin:"2px auto 12px",padding:t ? "8px 16px 8px 8px" : 0,borderRadius:28,background:t ? T.card : "transparent",color:T.ink,border:t ? "2px solid #E3D9FF" : "none",boxShadow:t ? "0 4px 0 #E3D9FF" : "none",cursor:"pointer",textAlign:"left",fontFamily:HFONT }}>
    <span className="vp-3d" style={{ "--edge":T.primaryEdge,"--d":"5px",flex:"none",width:size,height:size,borderRadius:size/2,display:"flex",alignItems:"center",justifyContent:"center",background:T.primary,color:T.onPrimary,animation:pulse?"vpBounce 1.5s ease-in-out infinite":"none" }}>
      <svg width={size*0.46} height={size*0.46} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><path d="M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
    </span>
    {t && <span style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column" }}>
      <span style={{ fontFamily:WFONT,fontWeight:700,fontSize:fs,lineHeight:1.05,letterSpacing:.5,wordBreak:"break-word",color:T.ink }}>{t}</span>
      {m && <span style={{ fontSize:16,fontWeight:500,color:T.ink2,marginTop:3,fontFamily:FONT }}>{m}</span>}
    </span>}
  </button>;
}
function SndBtn({ onClick }) { return <button onClick={onClick} className="m3-press" style={GS.soundBtn}>🔊 ฟัง EN+TH</button>; }
function Pill({ onClick, disabled, bg, children }) {
  return <button onClick={onClick} disabled={disabled} className="m3-press" style={{ ...M3.filled({ minHeight:48,padding:"0 20px",fontSize:14 }),...(bg ? { background:bg } : {}),...(disabled ? { background:T.surfHighest,color:T.ink3,cursor:"not-allowed" } : {}) }}>{children}</button>;
}
function Hearts({ n, max=3 }) {
  return <span>{Array.from({ length: max }, (_, i) => <span key={i} style={{ opacity:i<n?1:0.2 }}>❤️</span>)}</span>;
}

// ═══════════════════════════════════════════════════════
// QUIZ — 10 ข้อต่อรอบ
// ═══════════════════════════════════════════════════════
function QuizGame({ words, speak, track, onBack, limit=10, pool }) {
  const qs = useMemo(() => shuffle(words).slice(0, limit), [words, limit]);
  const src = pool && pool.length >= 4 ? pool : words;
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [lock, setLock] = useState(false);
  const cur = qs[idx];
  const choices = useMemo(() => {
    if(!cur) return [];
    return shuffle([cur,...shuffle(src.filter(w=>w.id!==cur.id)).slice(0,3)]);
  }, [idx, cur?.id, src]);

  useEffect(()=>{ if(idx>0 && cur) speak(cur.word,cur.meaning); },[idx]); // eslint-disable-line
  if(!cur) return <NoWords onBack={onBack} />;
  const pick = (c, e) => {
    if(lock) return;
    setLock(true); setPicked(c.id);
    const ok = c.id===cur.id;
    if(ok){ setScore(s=>s+1); track.correct(cur, e); speak(cur.word,cur.meaning); }
    else track.wrong(cur);
    afterSpeech(()=>{
      if(idx+1<qs.length){ setIdx(i=>i+1); setPicked(null); setLock(false); }
      else track.finish(ok?score+1:score, qs.length);
    },950);
  };
  return (
    <GameCard>
      <Bar left={`${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <SoundPrompt onClick={()=>speak(cur.word,cur.meaning)} pulse={!lock} w={cur} />
        <p style={{ textAlign:"center",fontSize:13,fontWeight:700,color:T.ink2,margin:"0 0 8px",minHeight:20 }}>{lock ? <b style={{ color:T.primary,fontSize:14 }}>{cur.word} · {cur.read} · {cur.meaning}</b> : "👂 ฟังแล้วแตะรูปที่ตรงกัน"}</p>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          {choices.map(c=>{
            const ic=c.id===cur.id,ip=picked===c.id,sr=lock&&(ic||ip);
            let bg=T.card,bo=T.cardBorder,ed=T.cardEdge,op=1;
            if(sr&&ic){bg=T.okC;bo=T.ok;ed=T.okEdge;}
            if(sr&&ip&&!ic){bg=T.errorC;bo=T.error;ed=T.errorEdge;}
            if(lock&&!ip&&!ic){op=.45;}
            return <button key={c.id} onClick={e=>pick(c, e)} disabled={lock}
              style={{ background:bg,border:`3px solid ${bo}`,boxShadow:`0 5px 0 ${ed}`,borderRadius:20,padding:0,aspectRatio:"4/3",position:"relative",overflow:"hidden",cursor:"pointer",opacity:op,transform:sr&&ic?"scale(1.03)":"none",transition:"transform .15s, opacity .2s",animation:sr&&ip&&!ic?"vpWiggle .3s":"none" }}>
              <PicFill w={c} emojiSize={44} />
            </button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// SPELL — 8 คำต่อรอบ
// ═══════════════════════════════════════════════════════
function SpellGame({ words, speak, track, onBack }) {
  const qs = useMemo(() => shuffle(words).slice(0, 8), [words]);
  const [idx, setIdx] = useState(0);
  const [pool, setPool] = useState([]);
  const [picked, setPicked] = useState([]);
  const [score, setScore] = useState(0);
  const [hint, setHint] = useState(true);   // โหมดช่วย: เงาตัวอักษร + ไฮไลต์ตัวถัดไป (เด็กที่ยังอ่านไม่คล่อง)
  const cur = qs[idx];

  useEffect(()=>{
    if(!cur) return;
    setPool(shuffle(cur.word.split("").map((ch,i)=>({id:i,ch}))));
    setPicked([]);
    speak(cur.word,cur.meaning);
  },[idx,cur?.id]);

  if(!cur) return <NoWords onBack={onBack} />;
  const ans=picked.map(p=>p.ch).join("");
  const correct=ans===cur.word;
  const wrong=ans.length===cur.word.length&&!correct;
  const ts=cur.word.length<=4?52:cur.word.length<=6?46:44;
  const tf=cur.word.length<=4?20:cur.word.length<=6?17:15;

  const tapLetter=l=>{
    if(correct||wrong) return;
    const np=[...picked,l];
    setPicked(np); setPool(pool.filter(x=>x.id!==l.id));
    const a=np.map(p=>p.ch).join("");
    if(a===cur.word){ track.correct(cur); speak(cur.word,cur.meaning); }
    else if(a.length===cur.word.length) track.wrong(cur);
    else if(/[A-Za-z]/.test(l.ch)) speak(l.ch.toLowerCase(),null);   // แตะแล้วได้ยินชื่อตัวอักษร
    else sfx.tap();
  };
  const removePick=i=>{
    if(correct) return;
    const r=picked[i]; setPicked(picked.filter((_,j)=>j!==i)); setPool([...pool,r]);
  };

  return (
    <GameCard>
      <Bar left={`${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <Emoji e={cur.emoji} w={cur} size={56} />
        <p style={{ textAlign:"center",fontWeight:600,fontSize:14,color:T.ink2,margin:"0 0 2px" }}>{cur.meaning}</p>
        {cur.read && <p style={{ textAlign:"center",fontWeight:700,fontSize:13,color:T.primary,margin:"0 0 8px" }}>{cur.read}</p>}
        <SndBtn onClick={()=>speak(cur.word,cur.meaning)} />

        <div style={{
          minHeight:ts+12,display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",alignItems:"center",
          padding:"8px",borderRadius:16,marginBottom:10,
          background:correct?T.okC:wrong?T.errorC:T.surfHigh,
          border:`2px dashed ${correct?T.ok:wrong?T.error:T.outlineV}`,
        }}>
          {hint && !correct && !wrong
            ? cur.word.split("").map((ch,i)=> i<picked.length
              ? <button key={"h"+i} onClick={()=>removePick(i)} style={{ width:ts,height:ts,borderRadius:16,background:T.primary,color:T.onPrimary,fontWeight:900,fontSize:tf,border:"none",cursor:"pointer",flexShrink:0 }}>{picked[i].ch}</button>
              : <span key={"h"+i} style={{ width:ts,height:ts,borderRadius:16,border:`2px dashed ${i===picked.length?T.ok:T.outlineV}`,color:T.ink3,opacity:.45,fontWeight:900,fontSize:tf,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{ch===" "?"␣":ch}</span>)
            : picked.length===0
            ?<span style={{color:T.ink3,fontSize:11}}>เลือกตัวอักษร</span>
            :picked.map((l,i)=>(
              <button key={l.id+"p"+i} onClick={()=>removePick(i)}
                style={{ width:ts,height:ts,borderRadius:16,background:correct?T.grad:wrong?T.grad:T.grad,color:"#fff",fontWeight:900,fontSize:tf,border:"none",cursor:"pointer",flexShrink:0,boxShadow:"0 6px 14px rgba(0,0,0,.18)",animation:correct?`vpStarPop .5s ${i*0.08}s both`:wrong?"vpWiggle .4s":"vpInScale .35s cubic-bezier(.2,.8,.2,1) both" }}>
                {l.ch}
              </button>
            ))
          }
        </div>

        <div style={{ display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",minHeight:ts+6,marginBottom:10 }}>
          {pool.map((l,i)=>(
            <button key={l.id} onClick={()=>tapLetter(l)} className="vp-card-hover"
              style={{ width:ts,height:ts,borderRadius:16,background:hint&&l.ch===cur.word[picked.length]?T.okC:T.card,color:T.primary,fontWeight:900,fontSize:tf,border:`3px solid ${hint&&l.ch===cur.word[picked.length]?T.ok:T.primaryC}`,cursor:"pointer",flexShrink:0,boxShadow:"0 4px 12px rgba(109,93,252,.18)",animation:`vpInUp .4s ${i*0.04}s both` }}>
              {l.ch}
            </button>
          ))}
        </div>

        {correct&&<div style={{ textAlign:"center",background:T.okC,borderRadius:14,padding:"8px",marginBottom:8,fontSize:13,fontWeight:700,color:T.onOkC }}>🎉 {cur.word} = {cur.meaning}</div>}

        <div style={{ display:"flex",gap:8 }}>
          <Pill onClick={()=>{setPool(shuffle(cur.word.split("").map((ch,i)=>({id:i,ch}))));setPicked([]);}} bg={T.ink3}>🔄 ใหม่</Pill>
          <Pill onClick={()=>{ sfx.tap(); setHint(h=>!h); }} bg={hint?T.ok:T.ink3}>💡 ช่วย</Pill>
          <Pill onClick={()=>{ if(correct)setScore(s=>s+1); if(idx+1<qs.length)setIdx(i=>i+1); else track.finish(correct?score+1:score, qs.length); }} disabled={!correct} bg={T.primary}>ถัดไป ›</Pill>
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// MEMORY
// ═══════════════════════════════════════════════════════
function MemoryGame({ words, speak, track, onBack }) {
  const PAIRS=Math.min(6,words.length);
  const mk=useCallback(()=>{
    const ch=shuffle(words).slice(0,PAIRS);
    return shuffle([
      ...ch.map((w,i)=>({uid:`w${i}`,type:"sound",label:w.word,mid:i,ref:w})),
      ...ch.map((w,i)=>({uid:`e${i}`,type:"emoji",label:w.emoji,mid:i,ref:w})),
    ]);
  },[words]);
  const [cards]=useState(mk);
  const [open,setOpen]=useState([]);
  const [matched,setMatched]=useState([]);
  const [moves,setMoves]=useState(0);
  const [lock,setLock]=useState(false);
  const won=matched.length===PAIRS&&PAIRS>0;

  useEffect(()=>{
    if(!won) return;
    const perfect=PAIRS, good=PAIRS*2;
    track.finish(PAIRS,PAIRS,{ stars: moves<=perfect+2?3:moves<=good?2:1, bonus: Math.max(0,good-moves)*2, label:`จับคู่ครบใน ${moves} ครั้ง` });
  },[won]);

  if(!words.length) return <NoWords onBack={onBack} />;

  const flip=c=>{
    if(lock||matched.includes(c.mid)||open.find(x=>x.uid===c.uid)) return;
    const nf=[...open,c]; setOpen(nf);
    if(c.type==="sound") speak(c.ref.word,null);
    if(nf.length===2){
      setMoves(m=>m+1); setLock(true);
      const[a,b]=nf;
      if(a.mid===b.mid&&a.type!==b.type){
        track.correct(a.ref);
        setTimeout(()=>{ setMatched(m=>[...m,a.mid]); setOpen([]); setLock(false); },600);
      } else { sfx.tap(); setTimeout(()=>{ setOpen([]); setLock(false); },900); }
    } else if(c.type!=="sound") sfx.tap();
  };

  return (
    <GameCard>
      <Bar left={`${matched.length}/${PAIRS} คู่`} right={`${moves} ครั้ง`} />
      <div style={GS.body}>
        <p style={{ textAlign:"center",fontSize:12,color:T.ink2,margin:"0 0 10px" }}>พลิกการ์ดทีละ 2 ใบ หาคู่ 🔊 คำ + รูป</p>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,margin:"0 -8px" }}>
          {cards.map(c=>{
            const sf=!!open.find(x=>x.uid===c.uid)||matched.includes(c.mid);
            const im=matched.includes(c.mid);
            return <button key={c.uid} onClick={()=>flip(c)} disabled={lock||im}
              style={{ aspectRatio:"3/4",borderRadius:16,cursor:"pointer",border:"none",background:"transparent",padding:0,perspective:600,position:"relative",animation:im?"vpStarPop .6s both":"none" }}>
              <span style={{ position:"absolute",inset:0,transformStyle:"preserve-3d",transition:"transform .5s cubic-bezier(.2,.8,.2,1)",transform:sf?"rotateY(180deg)":"rotateY(0deg)" }}>
                <span style={{ position:"absolute",inset:0,borderRadius:16,backfaceVisibility:"hidden",background:T.grad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:22,boxShadow:"0 6px 16px rgba(109,93,252,.35)",border:"2px solid rgba(255,255,255,.35)" }}>✦</span>
                <span style={{ position:"absolute",inset:0,borderRadius:16,backfaceVisibility:"hidden",transform:"rotateY(180deg)",background:im?T.okC:"#fff",border:`2px solid ${im?T.ok:T.primary}`,display:"flex",alignItems:"center",justifyContent:"center",padding:3,overflow:"hidden",fontSize:c.type==="emoji"?26:10,fontWeight:800,color:im?T.onOkC:T.primary,wordBreak:"break-all",textAlign:"center",boxShadow:im?"0 0 18px rgba(16,185,129,.5)":"0 6px 16px rgba(0,0,0,.12)" }}>
                  {c.type==="emoji" ? <span style={{ position:"absolute",inset:0 }}><PicFill w={c.ref} emojiSize={26} /></span> : <span style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}><span style={{ fontSize:30,lineHeight:1 }}>🔊</span><span style={{ fontSize:c.label.length>8?12:15,fontWeight:900,color:im?T.onOkC:T.primary,wordBreak:"break-word",textAlign:"center",lineHeight:1.1 }}>{c.label}</span></span>}
                </span>
              </span>
            </button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// SPEED
// ═══════════════════════════════════════════════════════
function SpeedGame({ words, speak, showToast, track }) {
  const T=30;
  const [time,setTime]=useState(T);
  const [active,setActive]=useState(false);
  const [score,setScore]=useState(0);
  const [cur,setCur]=useState(null);
  const [opts,setOpts]=useState([]);
  const ref=useRef(null);
  const scoreRef=useRef(0);

  const next=useCallback(()=>{
    const w=words[Math.floor(Math.random()*words.length)];
    setCur(w); setOpts(shuffle([w,...shuffle(words.filter(x=>x.id!==w.id)).slice(0,3)]));
    speak(w.word,w.meaning);
  },[words,speak]);

  useEffect(()=>{
    if(!active) return;
    ref.current=setInterval(()=>setTime(t=>{
      if(t<=1){
        clearInterval(ref.current); setActive(false);
        const s=scoreRef.current;
        track.finish(s, Math.max(s,1), { stars: s>=12?3:s>=7?2:s>=1?1:0, label:`ตอบถูก ${s} คำใน ${T} วิ` });
        return 0;
      }
      return t-1;
    }),1000);
    return ()=>clearInterval(ref.current);
  },[active]);

  return (
    <GameCard>
      <Bar left={`${time}s`} right={`⭐${score}`} />
      <div style={GS.body}>
        {!active
          ?<div style={{textAlign:"center",padding:"30px 0"}}>
            <div style={{fontSize:48,marginBottom:8}}>⚡</div>
            <p style={{fontWeight:800,fontSize:17,color:T.ink,margin:"0 0 4px"}}>Speed Round</p>
            <p style={{color:T.ink2,fontSize:13,margin:"0 0 20px"}}>ฟัง→แตะรูปให้เร็วใน {T} วิ!<br/>7 คำ = ⭐⭐ · 12 คำ = ⭐⭐⭐</p>
            <Pill onClick={()=>{setTime(T);setScore(0);scoreRef.current=0;setActive(true);next();}} bg={T.tertiary}>▶ เริ่ม!</Pill>
          </div>
          :<div>
            <SoundPrompt onClick={()=>cur&&speak(cur.word,cur.meaning)} size={72} w={cur} />
            <div style={{ display:"flex",justifyContent:"center",margin:"0 0 10px" }}>
              <svg width="74" height="74" viewBox="0 0 74 74" style={{ animation:time<=5?"vpWiggle .4s infinite":"none" }}>
                <circle cx="37" cy="37" r="30" fill="none" stroke={T.surfHigh} strokeWidth="8" />
                <circle cx="37" cy="37" r="30" fill="none" stroke={time>10?T.tertiary:T.error} strokeWidth="8" strokeLinecap="round" strokeDasharray={2*Math.PI*30} strokeDashoffset={2*Math.PI*30*(1-time/T)} transform="rotate(-90 37 37)" style={{ transition:"stroke-dashoffset 1s linear, stroke .3s" }} />
                <text x="37" y="43" textAnchor="middle" fontSize="20" fontWeight="900" fill={time>10?T.onTertiaryC:T.onErrorC} fontFamily="Prompt, system-ui">{time}</text>
              </svg>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {opts.map(o=>(
                <button key={o.id} onClick={()=>{ if(o.id===cur.id){scoreRef.current+=1;setScore(s=>s+1);track.correct(cur);next();}else{track.wrong(cur);showToast("❌","err");} }}
                  style={{background:T.card,border:`3px solid ${T.cardBorder}`,boxShadow:`0 5px 0 ${T.cardEdge}`,borderRadius:20,padding:0,aspectRatio:"4/3",position:"relative",overflow:"hidden",cursor:"pointer"}}>
                  <PicFill w={o} emojiSize={40} />
                </button>
              ))}
            </div>
          </div>
        }
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// HABITAT
// ═══════════════════════════════════════════════════════
function HabitatGame({ words, speak, showToast, track }) {
  const ZN=[
    {id:"farm",label:"ฟาร์ม",e:"🚜",bg:T.tertiaryC,bo:T.tertiary},
    {id:"forest",label:"ป่า",e:"🌳",bg:"#dcfce7",bo:T.ok},
    {id:"ocean",label:"ทะเล",e:"🌊",bg:T.secondaryC,bo:"#7dd3fc"},
  ];
  const base=useMemo(()=>shuffle(words.filter(w=>w.habitat)).slice(0,9),[words]);
  const [pool,setPool]=useState(base);
  const [placed,setPlaced]=useState({farm:[],forest:[],ocean:[]});
  const [sel,setSel]=useState(null);
  const wrongs=useRef(0);
  const done=pool.length===0&&base.length>0;
  useEffect(()=>{ if(done) track.finish(base.length,base.length,{ stars: starsByWrong(wrongs.current) }); },[done]);

  return (
    <GameCard>
      <Bar left="Habitat Hunt ⭐" right={`${base.length-pool.length}/${base.length}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:T.ink2,margin:"0 0 8px"}}>แตะสัตว์ → แตะที่อยู่ของมัน</p>
        {pool.length===0
          ? <div style={{background:T.okC,color:T.onOkC,borderRadius:20,padding:24,textAlign:"center",fontWeight:800,marginBottom:10}}>✅ ครบทุกตัว!</div>
          : (()=>{ const a = sel && pool.find(x=>x.id===sel.id) ? sel : pool[0]; if (a !== sel) setTimeout(()=>setSel(a),0); return (
            <button onClick={()=>{sfx.tap();setSel(a);speak(a.word,a.meaning);}} style={{display:"block",width:"100%",border:"none",background:"transparent",padding:0,cursor:"pointer",marginBottom:10}}>
              <PicBox w={a} h="min(30vh, 280px)" />
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,padding:"0 4px"}}><span style={{...TYPE.titleL,color:T.ink}}>🔊 {a.word}</span><span style={{...TYPE.labelM,color:T.ink3}}>เหลือ {pool.length} ตัว</span></div>
            </button>); })()}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
          {ZN.map(z=>(
            <button key={z.id} onClick={()=>{
              if(!sel) return;
              if(sel.habitat===z.id){track.correct(sel);setPlaced(p=>({...p,[z.id]:[...p[z.id],sel]}));setPool(p=>p.filter(x=>x.id!==sel.id));speak(sel.word,sel.meaning);setSel(null);}
              else{wrongs.current+=1;track.wrong(sel);showToast("ลองอีก 🐾","warn");setSel(null);}
            }} style={{background:z.bg,border:`2px solid ${z.bo}`,borderRadius:16,padding:"8px 4px",minHeight:100,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
              <span style={{fontSize:34}}>{z.e}</span>
              <span style={{fontSize:13,fontWeight:800,color:T.ink}}>{z.label}</span>
              <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:2,marginTop:3}}>
                {placed[z.id].map(a=><span key={a.id} data-thumb style={{position:"relative",width:28,height:28,borderRadius:8,overflow:"hidden",display:"inline-block"}}><PicFill w={a} emojiSize={18} /></span>)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// MATCH (Picture Match)
// ═══════════════════════════════════════════════════════
function MatchGame({ words, speak, showToast, track, onBack }) {
  const RS=4;
  const [round,setRound]=useState(0);
  const total=Math.max(1,Math.ceil(words.length/RS));
  const rw=useMemo(()=>words.slice(round*RS,round*RS+RS),[round,words]);
  const [pics,setPics]=useState([]);
  const [sel,setSel]=useState(null);
  const [matches,setMatches]=useState({});
  const wrongs=useRef(0);
  useEffect(()=>{setPics(shuffle(rw));setMatches({});setSel(null);},[round,rw.length]);
  const done=rw.length>0&&rw.every(w=>matches[w.id]===w.id);
  if(!rw.length) return <NoWords onBack={onBack}/>;
  const H=Math.round(Math.min((typeof innerHeight!=="undefined"?innerHeight:800)*0.15,124));
  return (
    <GameCard>
      <Bar left={`รอบ${round+1}/${total}`} right={`${Object.keys(matches).length}/${rw.length}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",...TYPE.titleS,color:T.ink2,margin:"0 0 10px"}}>👆 แตะ 🔊 ฟังคำ แล้วแตะรูปที่ตรงกัน</p>
        {rw.map((w,i)=>{
          const p=pics[i];
          const im=matches[w.id]===w.id;
          const is=sel===w.id;
          const pu=p&&Object.values(matches).includes(p.id);
          return <div key={w.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,height:H}}>
            <button onClick={()=>{if(!im){sfx.tap();setSel(w.id);speak(w.word,w.meaning);}}} disabled={im}
              style={{flex:1,minWidth:0,height:H,borderRadius:18,background:im?T.okC:is?T.primary:T.secondaryC,border:`3px solid ${im?T.ok:is?T.primary:T.outlineV}`,color:im?T.onOkC:is?T.onPrimary:T.onSecondaryC,cursor:"pointer",padding:"4px 6px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,transition:"background .15s, transform .15s",transform:is?"scale(1.03)":"none"}}>
              <span style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:"clamp(22px,6vw,28px)",lineHeight:1}}>🔊</span><span style={{fontWeight:900,fontSize:w.word.length>8?"clamp(13px,4vw,17px)":w.word.length>5?"clamp(16px,4.9vw,21px)":"clamp(20px,6.2vw,28px)",lineHeight:1.05,overflowWrap:"anywhere",textAlign:"center"}}>{w.word}</span></span>
              {w.meaning&&<span style={{fontSize:"clamp(12px,3.4vw,15px)",fontWeight:600,opacity:.85,lineHeight:1.1}}>{w.meaning}</span>}
            </button>
            <span style={{color:T.ink3,fontSize:22,fontWeight:900,flexShrink:0}}>→</span>
            {p&&<button onClick={()=>{
              if(sel==null||pu) return;
              if(sel===p.id){track.correct(p);setMatches(m=>({...m,[sel]:p.id}));speak(p.word,p.meaning);}
              else{wrongs.current+=1;track.wrong(rw.find(x=>x.id===sel));showToast("ลองอีก 💡","warn");}
              setSel(null);
            }} disabled={pu}
              style={{width:"44%",height:H,borderRadius:18,background:pu?T.okC:T.surfHigh,border:`3px solid ${pu?T.ok:T.outlineV}`,fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",position:"relative",overflow:"hidden",padding:0,opacity:pu?0.55:1}}>
              <PicFill w={p} emojiSize={44} />
            </button>}
          </div>;
        })}
        {done&&<div style={{textAlign:"center",marginTop:6}}>
          {round+1<total
            ?<Pill onClick={()=>setRound(r=>r+1)} bg={T.ok}>รอบถัดไป →</Pill>
            :<Pill onClick={()=>track.finish(words.length,words.length,{ stars: starsByWrong(wrongs.current) })} bg={T.ok}>จบ ✓</Pill>}
        </div>}
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// COLOR MIX — 5 รอบ
// ═══════════════════════════════════════════════════════
function ColorMixGame({ words, speak, showToast, track }) {
  const MAX=5;
  const REC={PURPLE:{mix:["RED","BLUE"],th:"สีม่วง"},GREEN:{mix:["BLUE","YELLOW"],th:"สีเขียว"},ORANGE:{mix:["RED","YELLOW"],th:"สีส้ม"}};
  const TG=Object.keys(REC);
  const [round,setRound]=useState(1);
  const [tg,setTg]=useState(TG[0]);
  const [picked,setPicked]=useState([]);
  const [score,setScore]=useState(0);
  useEffect(()=>{
    const t=TG[Math.floor(Math.random()*TG.length)];
    setTg(t);setPicked([]);
    const tw=words.find(w=>w.word===t); if(tw) speak(tw.word,tw.meaning);
  },[round]);
  const tw=words.find(w=>w.word===tg);
  const bases=words.filter(w=>["RED","BLUE","YELLOW"].includes(w.word));
  return (
    <GameCard>
      <Bar left={`รอบ ${round}/${MAX}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:T.ink2,margin:"0 0 10px"}}>ผสม 2 สีให้ได้สีเป้าหมาย</p>
        <div style={{background:T.surfHigh,borderRadius:16,padding:"12px",textAlign:"center",marginBottom:10}}>
          <div style={{fontSize:11,color:T.ink3,marginBottom:6}}>เป้าหมาย</div>
          {tw && <PicBox w={tw} h="min(31vh, 290px)" />}
          <div style={{fontWeight:800,fontSize:17,color:T.ink}}>{tg}</div>
          <div style={{fontSize:12,color:T.ink2}}>{tw?.meaning}</div>
        </div>
        <div style={{background:T.primaryC,borderRadius:16,minHeight:68,padding:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10}}>
          {picked.length===0?<span style={{color:T.ink3,fontSize:12}}>เลือก 2 สีด้านล่าง</span>
            :picked.map((p,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                {i>0&&<span style={{position:"absolute",marginLeft:-26,fontWeight:800,color:T.ink2,fontSize:18}}>+</span>}
                <span style={{fontSize:36}}>{p.emoji}</span>
                <span style={{fontSize:10,fontWeight:700}}>{p.word}</span>
              </div>
            ))
          }
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:6,margin:"0 -6px"}}>
          {bases.map(w=>(
            <button key={w.id} onClick={()=>{
              if(picked.length>=2||picked.find(p=>p.id===w.id)) return;
              const np=[...picked,w]; setPicked(np); speak(w.word,w.meaning);
              if(np.length===2){
                const r=REC[tg].mix.sort().join(","); const g=np.map(x=>x.word).sort().join(",");
                if(r===g){ track.correct(tw); setScore(s=>s+1); showToast(`✨ ${tg}=${REC[tg].th}`); if(round>=MAX) setTimeout(()=>track.finish(score+1,MAX),700); else setTimeout(()=>setRound(rd=>rd+1),900); }
                else { track.wrong(tw); showToast("ลองอีก 🎨","warn"); setTimeout(()=>setPicked([]),600); }
              } else sfx.tap();
            }} disabled={picked.length>=2||!!picked.find(p=>p.id===w.id)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"stretch",gap:4,background:T.card,border:"none",borderRadius:18,padding:0,cursor:"pointer",opacity:picked.find(p=>p.id===w.id)?0.3:1}}>
              <PicBox w={w} h="min(15vh, 130px)" r={16} />
              <span style={{fontSize:13,fontWeight:800,color:T.ink}}>{w.word}</span>
            </button>
          ))}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// COUNT — 8 รอบ
// ═══════════════════════════════════════════════════════
function CountGame({ words, speak, showToast, track, allWords }) {
  const MAX=8;
  const SH=["🍎","⭐","🐱","🎈","🌸","🚗","🍊","🐶"];
  const [round,setRound]=useState(1);
  const [target,setT]=useState(1);
  const [shape,setShape]=useState("🍎");
  const [score,setScore]=useState(0);
  const wrongs=useRef(0);
  const nw=words.filter(w=>w.num!==undefined&&w.num>=1&&w.num<=8);
  const maxN=Math.min(8,Math.max(...nw.map(w=>w.num),4));
  const objs = useMemo(() => (allWords || []).filter(w => ["animals","fruits","toys","vehicles"].includes(w.cat) && imageTitleOf(w)), [allWords]);
  const [obj, setObj] = useState(null);
  useEffect(()=>{const t=Math.floor(Math.random()*maxN)+1;setT(t);setShape(SH[Math.floor(Math.random()*SH.length)]);const o=objs.length?objs[Math.floor(Math.random()*objs.length)]:null;setObj(o);speak(o?`How many ${o.word.toLowerCase()}s?`:"How many?","นับสิ มีกี่ตัว");},[round]);
  return (
    <GameCard>
      <Bar left={`รอบ ${round}/${MAX}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:T.ink2,margin:"0 0 8px"}}>นับแล้วเลือกตัวเลข</p>
        <div style={{background:T.okC,borderRadius:20,padding:4,display:"grid",gridTemplateColumns:`repeat(${target<=4?2:3},1fr)`,gap:4,marginBottom:10}}>
          {Array.from({length:target}).map((_,i)=> obj
            ? <span key={i} style={{position:"relative",display:"block",height:target<=4?"min(15vh,140px)":"min(11vh,105px)",borderRadius:14,overflow:"hidden",background:T.card,animation:`vpPop .35s ${i*0.06}s both`}}><PicFill w={obj} emojiSize={40} /></span>
            : <span key={i} style={{fontSize:48,textAlign:"center"}}>{shape}</span>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {nw.sort((a,b)=>a.num-b.num).slice(0,8).map(w=>(
            <button key={w.id} onClick={()=>{
              if(w.num===target){ track.correct(w); setScore(s=>s+1); speak(w.word,w.meaning); if(round>=MAX) afterSpeech(()=>track.finish(score+1,MAX,{ stars: starsByWrong(wrongs.current) }),600); else afterSpeech(()=>setRound(r=>r+1),600); }
              else { wrongs.current+=1; track.wrong(w); showToast("ลองอีก","warn"); }
            }}
              style={{background:T.card,border:`2px solid ${T.ok}`,borderRadius:16,padding:"6px 3px",minHeight:64,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,cursor:"pointer"}}>
              <span style={{fontSize:30,fontWeight:900,color:T.ink,lineHeight:1}}>{w.num}</span>
              <span style={{fontWeight:800,fontSize:11,color:T.ink2}}>{w.word}</span>
            </button>
          ))}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// BODY DOCTOR — 8 รอบ
// ═══════════════════════════════════════════════════════
function BodyDoctorGame({ words, speak, showToast, track }) {
  const MAX=8;
  const [round,setRound]=useState(1);
  const [target,setTarget]=useState(null);
  const [score,setScore]=useState(0);
  const [fb,setFb]=useState(null);
  const wrongs=useRef(0);
  const [bodyOpts, setBodyOpts] = useState([]);
  useEffect(()=>{const t=words[Math.floor(Math.random()*words.length)];setTarget(t);setFb(null);if(t){setBodyOpts(shuffle([t,...shuffle(words.filter(x=>x.id!==t.id)).slice(0,5)]));speak(`Touch the ${t.word}`,`แตะที่ ${t.meaning}`);}},[round]);
  return (
    <GameCard>
      <Bar left={`รอบ ${round}/${MAX}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{textAlign:"center",marginBottom:10}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.tertiaryC,borderRadius:999,padding:"6px 14px",marginBottom:4}}>
            <span>🔊</span><span style={{fontWeight:800,fontSize:16,color:T.onTertiaryC}}>Touch the {target?.word}!</span>
          </div>
          <br/>
          <button onClick={()=>target&&speak(`Touch the ${target.word}`,`แตะที่ ${target.meaning}`)} style={{fontSize:12,color:T.primary,fontWeight:700,background:"none",border:"none",cursor:"pointer",minHeight:44,padding:"0 14px"}}>🔊 ฟังอีกครั้ง</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          {bodyOpts.map(w=>(
            <button key={w.id} onClick={()=>{
              if(!target||fb) return;
              if(w.id===target.id){ track.correct(w); setScore(s=>s+1); setFb("ok"); speak(w.word,w.meaning); if(round>=MAX) afterSpeech(()=>track.finish(score+1,MAX,{ stars: starsByWrong(wrongs.current) }),800); else afterSpeech(()=>setRound(r=>r+1),800); }
              else { wrongs.current+=1; track.wrong(target); setFb("no"); showToast("ลองอีก 🩺","warn"); setTimeout(()=>setFb(null),500); }
            }} style={{background:fb==="ok"&&w.id===target?.id?T.okC:T.tertiaryC,border:`2px solid ${fb==="ok"&&w.id===target?.id?T.ok:T.tertiaryC}`,borderRadius:18,padding:5,minHeight:60,display:"flex",flexDirection:"column",alignItems:"stretch",gap:4,cursor:"pointer",opacity:fb==="no"&&w.id!==target?.id?0.5:1}}>
              <PicBox w={w} h="min(16vh, 150px)" r={14} />
              <span style={{fontWeight:800,fontSize:13,color:T.ink}}>{w.word}</span>
            </button>
          ))}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// DRESS UP — 6 รอบ
// ═══════════════════════════════════════════════════════
function DressGame({ words, speak, showToast, track }) {
  const MAX=6;
  const ALL=["☂️","🧥","🧣","🧤","👕","🩳","🕶️","🥾","👖","🧢"];
  const CLOTH={"☂️":"UMBRELLA","🧥":"JACKET","🧣":"SCARF","🧤":"GLOVES","👕":"TSHIRT","🩳":"SHORTS","🕶️":"SUNGLASSES","🥾":"BOOTS","👖":"PANTS","🧢":"HAT"};
  const clothW = e => ({ cat:"clothes", word:CLOTH[e]||"", emoji:e });
  const [round,setRound]=useState(1);
  const [target,setTarget]=useState(null);
  const [opts,setOpts]=useState([]);
  const [score,setScore]=useState(0);
  const [picked,setPicked]=useState(null);
  const wrongs=useRef(0);
  useEffect(()=>{
    const t=words[Math.floor(Math.random()*words.length)];setTarget(t);setPicked(null);
    if(t){const c=(t.wear||[]).slice(0,2);const w=ALL.filter(x=>!c.includes(x));setOpts(shuffle([...c.map(e=>({e,ok:true})),...shuffle(w).slice(0,2).map(e=>({e,ok:false}))]));speak(`It's ${t.word}!`,`อากาศ ${t.meaning}`);}
  },[round]);
  return (
    <GameCard>
      <Bar left={`รอบ ${round}/${MAX}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:T.ink2,margin:"0 0 10px"}}>เลือกเสื้อผ้าให้เหมาะกับอากาศ</p>
        <div style={{background:T.secondaryC,borderRadius:16,padding:"14px",textAlign:"center",marginBottom:12}}>
          {target && <PicBox w={target} h="min(31vh, 290px)" />}
          <div style={{fontWeight:800,fontSize:18,color:T.ink,marginTop:6}}>{target?.word}</div>
          <div style={{fontSize:12,color:T.ink2}}>{target?.meaning}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          {opts.map((o,i)=>(
            <button key={i} onClick={()=>{
              if(picked)return; setPicked(o.e);
              if(o.ok){ track.correct(target); setScore(s=>s+1); showToast("👏 เก่ง!"); if(round>=MAX) setTimeout(()=>track.finish(score+1,MAX,{ stars: starsByWrong(wrongs.current) }),800); else setTimeout(()=>setRound(r=>r+1),800); }
              else { wrongs.current+=1; track.wrong(target); showToast("ลองอีก 🧥","warn"); setTimeout(()=>setPicked(null),500); }
            }} disabled={!!picked}
              style={{minHeight:56,borderRadius:18,padding:5,fontSize:30,display:"flex",flexDirection:"column",alignItems:"stretch",justifyContent:"center",gap:4,background:picked===o.e&&o.ok?T.okC:picked===o.e&&!o.ok?T.errorC:T.secondaryC,border:`2px solid ${picked===o.e&&o.ok?T.ok:picked===o.e&&!o.ok?T.error:T.outlineV}`,cursor:"pointer"}}>
              <PicBox w={clothW(o.e)} h="min(17vh, 150px)" r={14} emojiSize={54} />
              <span style={{fontSize:12,fontWeight:800,color:T.ink}}>{CLOTH[o.e]}</span>
            </button>
          ))}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// BOSS — 10 ข้อ 3 หัวใจ สลับโจทย์ 3 แบบ (รูป→คำ · ไทย→คำ · คำ→รูป)
// ปลดล็อกเมื่อได้ดาวครบทุกเกมในหมวด · ชนะ = ตอบถูก ≥7 และหัวใจไม่หมด
// ═══════════════════════════════════════════════════════
function BossGame({ words, speak, track, cat, onBack }) {
  const N=10, WIN=7;
  const qs=useMemo(()=>{
    const modes=["rev"];
    return shuffle(words).slice(0,N).map((w,i)=>({ w, mode: modes[i%3] }));
  },[words]);
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [hearts,setHearts]=useState(3);
  const [picked,setPicked]=useState(null);
  const [lock,setLock]=useState(false);
  const q=qs[idx];
  const choices=useMemo(()=>{
    if(!q) return [];
    return shuffle([q.w,...shuffle(words.filter(w=>w.id!==q.w.id)).slice(0,3)]);
  },[idx,q?.w.id,words]);
  useEffect(()=>{ if(idx>0 && q) speak(q.w.word,q.w.meaning); },[idx]); // eslint-disable-line
  if(!q||words.length<4) return <NoWords onBack={onBack} />;

  const end=(s,h)=>{
    const cleared=h>0&&s>=WIN;
    track.finish(s,N,{ boss:true, cleared, stars: cleared?(s>=9?3:2):(s>0?1:0), bonus: cleared?50:0, label:`ตอบถูก ${s}/${N} · เหลือ ${h} ❤️` });
  };
  const pick=c=>{
    if(lock) return;
    setLock(true); setPicked(c.id);
    const ok=c.id===q.w.id;
    const ns=ok?score+1:score, nh=ok?hearts:hearts-1;
    if(ok){ setScore(ns); track.correct(q.w); speak(q.w.word,q.w.meaning); }
    else { setHearts(nh); track.wrong(q.w); }
    afterSpeech(()=>{
      if(nh<=0||idx+1>=qs.length) end(ns,nh);
      else { setIdx(i=>i+1); setPicked(null); setLock(false); }
    },950);
  };
  const prompt = <><SoundPrompt onClick={()=>speak(q.w.word,q.w.meaning)} pulse={!lock} w={q.w} /><p style={{ textAlign:"center",fontSize:13,fontWeight:700,color:T.ink2,margin:"0 0 8px" }}>👂 ฟังแล้วแตะรูปที่ตรงกัน</p></>;
  return (
    <GameCard>
      <div style={{ background:"linear-gradient(160deg,#1f2937,#4c1d95 60%,#7c3aed)",color:"#fff",padding:"12px 16px 10px",position:"relative",overflow:"hidden" }}>
        <span style={{ position:"absolute",inset:0,background:"radial-gradient(circle at 80% 20%, rgba(168,85,247,.5), transparent 55%)" }} />
        <div style={{ display:"flex",alignItems:"center",gap:12,position:"relative" }}>
          <div style={{ width:64,height:64,borderRadius:20,background:"rgba(255,255,255,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,animation:lock&&picked&&picked!==q.w.id?"vpWiggle .5s":lock&&picked===q.w.id?"vpStarPop .6s":"vpFloatY 2.6s ease-in-out infinite",filter:"drop-shadow(0 6px 10px rgba(0,0,0,.4))",flexShrink:0 }}>
            {["👹","🐲","👾","🤖","🦖","🧙","🦁","🐙"][(cat.label?.length || 0) % 8]}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:800 }}><span>👑 บอส {cat.label}</span><span>{idx+1}/{N}</span></div>
            <div style={{ height:12,background:"rgba(0,0,0,.35)",borderRadius:999,marginTop:6,overflow:"hidden",border:"1px solid rgba(255,255,255,.25)" }}>
              <div style={{ height:"100%",width:`${Math.max(0,100-(score/WIN)*100)}%`,background:T.grad,borderRadius:999,transition:"width .6s cubic-bezier(.2,.8,.2,1)",boxShadow:"0 0 12px rgba(244,63,94,.8)" }} />
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",marginTop:6,fontSize:13 }}><span style={{ opacity:.85 }}>HP บอส {Math.max(0,WIN-score)}/{WIN}</span><Hearts n={hearts} /></div>
          </div>
        </div>
      </div>
      <div style={GS.body}>
        {prompt}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {choices.map(c=>{
            const ic=c.id===q.w.id,ip=picked===c.id,sr=lock&&(ic||ip);
            let bg=T.card,bo=T.cardBorder,tc=T.ink;
            if(sr&&ic){bg=T.okC;bo=T.ok;tc=T.onOkC;}
            if(sr&&ip&&!ic){bg=T.errorC;bo=T.error;tc=T.onErrorC;}
            if(lock&&!ip&&!ic){bg=T.surfHigh;bo=T.outlineV;tc=T.ink3;}
            return <button key={c.id} onClick={()=>pick(c)} disabled={lock}
              style={{ background:bg,border:`3px solid ${bo}`,boxShadow:`0 5px 0 ${T.cardEdge}`,borderRadius:20,padding:q.mode==="rev"?0:"12px 6px",aspectRatio:"4/3",fontWeight:800,fontSize:q.mode==="rev"?30:15,color:tc,cursor:"pointer",position:"relative",overflow:"hidden" }}>
              {q.mode==="rev"?<PicFill w={c} emojiSize={34} />:c.word}
            </button>;
          })}
        </div>
        <div style={{ textAlign:"center",fontSize:11,color:T.ink3,marginTop:10 }}>ตอบถูก {WIN}/{N} และหัวใจไม่หมด = ชนะ 👑 +50 🪙</div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// PET CARD (หน้าแรก) — เพื่อนคู่หู / เหรียญ / streak / สติกเกอร์
// ═══════════════════════════════════════════════════════
function PetCard({ progress, setProgress, stickerCount, totalWords, onStickers, onShop, speak, profile, onProfiles }) {
  const pet = getPet(progress);
  if (!pet) {
    return (
      <div style={{ background:T.grad,borderRadius:20,padding:16,marginBottom:14,border:"2px solid #e9d5ff",textAlign:"center" }}>
        {profile && <div style={{ textAlign:"right",marginBottom:4 }}><button onClick={() => { sfx.tap(); onProfiles(); }} style={{ minHeight:44,display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.85)",border:"none",borderRadius:999,padding:"0 10px",fontSize:12,fontWeight:800,color:T.ink2,cursor:"pointer" }}>{profile.avatar} {profile.name} ▾</button></div>}
        <div style={{ fontWeight:900,fontSize:16,color:T.ink }}>เลือกเพื่อนคู่หูของ{profile?.name || "หนู"} 🥚</div>
        <div style={{ fontSize:12,color:T.ink2,margin:"2px 0 12px" }}>ยิ่งตอบถูก เพื่อนยิ่งโต!</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
          {PETS.map(p => (
            <button key={p.id} onClick={() => { sfx.coin(); speak("Hello! Let's play!", "สวัสดี มาเล่นกันเถอะ"); setProgress(x => ({ ...x, pet: p.id })); }}
              style={{ background:T.card,border:"2px solid #e5e7eb",borderRadius:16,padding:"10px 4px",minHeight:72,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
              <Pet kind={p.id} stage={1} mood="happy" size={56} />
              <span style={{ fontSize:12,fontWeight:800,color:T.ink2 }}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const line = pet.stage===0 ? `ไข่กำลังจะฟัก! ตอบถูกอีก ${Math.max(0,(pet.next??0)-pet.xp)} ข้อ`
    : pet.next==null ? "โตเต็มที่แล้ว เก่งมาก!" : `อีก ${pet.next-pet.xp} ข้อ ถึง Lv.${pet.level+1}`;
  const chip = { display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.8)",borderRadius:999,padding:"4px 10px",fontSize:12,fontWeight:800,color:T.ink2 };
  const bgCss = SHOP_ITEMS.find(i => i.id === progress.bg)?.css || T.grad;
  const dark = progress.bg === "bgSpace";
  return (
    <div style={{ background:bgCss,borderRadius:20,padding:"14px 14px 12px",marginBottom:14,border:"2px solid #e9d5ff" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
        <button onClick={() => { sfx.tap(); speak(`Hi! I'm ${pet.id === "cat" ? "a cat" : pet.id === "dog" ? "a dog" : pet.id === "bunny" ? "a bunny" : "a dragon"}!`, `สวัสดี ฉันชื่อ${pet.name}`); }}
          style={{ width:80,height:80,borderRadius:22,background:T.card,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(139,92,246,0.25)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>
          <PetAvatar pet={pet} hat={progress.hat} outfit={progress.outfit} size={pet.stage===0?38:pet.stage===1?42:pet.stage===2?46:50} bounce />
        </button>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontWeight:900,fontSize:17,color:dark?"#fff":T.ink }}>{pet.name}</span>
            <span style={{ fontSize:12,fontWeight:800,color:dark?T.primary:T.primary }}>Lv.{pet.level}</span>
            {profile && <button onClick={() => { sfx.tap(); onProfiles(); }} style={{ marginLeft:"auto",minHeight:44,display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.85)",border:"none",borderRadius:999,padding:"0 10px",fontSize:12,fontWeight:800,color:T.ink2,cursor:"pointer" }}>{profile.avatar} {profile.name} ▾</button>}
          </div>
          <div style={{ fontSize:11,color:dark?"#e9d5ff":T.ink2,marginBottom:5 }}>{line}</div>
          <div style={{ height:8,background:"rgba(255,255,255,0.9)",borderRadius:999,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${pet.pct}%`,background:T.grad,borderRadius:999,transition:"width .6s" }} />
          </div>
        </div>
      </div>
      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:10,alignItems:"center" }}>
        <span style={chip}>🪙 {progress.coins}</span>
        <span style={chip}>🔥 {progress.streak.count} วัน</span>
        <div style={{ display:"flex",gap:6,marginLeft:"auto" }}>
          <button onClick={() => { sfx.tap(); onShop(); }} style={{ ...chip,background:T.tertiary,color:"#fff",border:"none",cursor:"pointer",minHeight:44,padding:"0 12px" }}>🛍️ ร้านค้า</button>
          <button onClick={() => { sfx.tap(); onStickers(); }} style={{ ...chip,background:T.primary,color:"#fff",border:"none",cursor:"pointer",minHeight:44,padding:"0 12px" }}>📒 {stickerCount}/{totalWords}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// STICKER BOOK
// ═══════════════════════════════════════════════════════
function StickerBook({ words, categories, progress, speak, showToast }) {
  const have = id => (progress.stickers[id] || 0) >= STICKER_NEED;
  const total = words.filter(w => have(w.id)).length;
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:560,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>📒 สมุดสติกเกอร์</div>
        <div style={{ fontSize:13,opacity:0.9 }}>เก็บได้ {total} / {words.length} ใบ · ตอบคำไหนถูก {STICKER_NEED} ครั้ง จะได้สติกเกอร์คำนั้น</div>
        <div style={{ height:8,background:"color-mix(in oklab, var(--md-on-primary-container) 18%, transparent)",borderRadius:999,marginTop:8,overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${words.length?Math.round(total/words.length*100):0}%`,background:T.card,borderRadius:999 }} />
        </div>
      </div>
      {categories.map(cat => {
        const ws = words.filter(w => w.cat === cat.id);
        if (!ws.length) return null;
        const got = ws.filter(w => have(w.id)).length;
        return (
          <div key={cat.id} style={{ marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <CatIcon id={cat.id} size={28} />
              <span style={{ fontWeight:800,fontSize:14,color:T.ink }}>{cat.label}</span>
              <span style={{ fontSize:11,fontWeight:700,color:cat.color,background:`${cat.color}18`,padding:"2px 8px",borderRadius:999 }}>{got}/{ws.length}</span>
              {got === ws.length && <span>🏅</span>}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6 }}>
              {ws.map(w => {
                const n = Math.min(STICKER_NEED, progress.stickers[w.id] || 0);
                const ok = n >= STICKER_NEED;
                return (
                  <button key={w.id} onClick={() => { if (ok) { sfx.tap(); speak(w.word, w.meaning); showToast(`${w.word} · ${w.read || ""} · ${w.meaning}`); } else showToast(`ตอบ ${w.word} ถูกอีก ${STICKER_NEED - n} ครั้ง`, "warn"); }}
                    className="m3-press" style={{ aspectRatio:"1",minHeight:56,borderRadius:18,border:"none",background:ok?T.card:T.surfHigh,outline:ok?`2px solid ${cat.color}66`:"none",outlineOffset:-2,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:2 }}>
                    {ok ? <span style={{ position:"relative",width:"100%",flex:1,minHeight:0,borderRadius:12,overflow:"hidden",display:"block" }}><PicFill w={w} emojiSize={26} /></span> : <span style={{ fontSize:26,filter:"grayscale(1) opacity(0.35)" }}>❓</span>}
                    {ok
                      ? <span style={{ fontSize:10,fontWeight:800,color:T.ink2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%" }}>{w.word}</span>
                      : <span style={{ display:"flex",gap:2 }}>{[0,1,2].map(i => <span key={i} style={{ width:6,height:6,borderRadius:3,background:i<n?cat.color:T.outlineV }} />)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SETTINGS SHEET
// ═══════════════════════════════════════════════════════
function SettingsSheet({ soundOn, setSoundOn, bilingual, setBilingual, rate, setRate, onResetProgress, onReport, onCredits, onClose, realPics, setRealPics, fullscreenOn, setFullscreenOn, thaiGuide, setThaiGuide, fxOn, setFxOn, musicOn, setMusicOn, nativeVoice, setNativeVoiceOn, bigText, setBigText, parentGate, setParentGate }) {
  const [vr, setVr] = useState(() => voiceReport());
  useEffect(() => { loadVoices(); setVr(voiceReport()); const t = setTimeout(() => { loadVoices(); setVr(voiceReport()); }, 800); return () => clearTimeout(t); }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <M3Sheet onClose={onClose}>
        <h3 style={{ ...TYPE.headlineS,color:T.ink,margin:"0 0 4px" }}>ตั้งค่า</h3>
        <div style={{ fontSize:11,color:T.ink3,marginBottom:14 }}>Smart VocabPlay <b>v{APP_VERSION}</b>{BUILD_TIME && ` · build ${BUILD_TIME}`} · ถ้าเลขไม่ตรงกับที่แจ้งไว้ ให้ปิดแอปแล้วเปิดใหม่ หรือกด "อัปเดต" เมื่อมีแถบขึ้น</div>
        <TRow label="เปิดเสียง" desc="เสียงพูด + เสียงเอฟเฟกต์ทุกเกม" on={soundOn} set={setSoundOn} />
        <TRow label="เสียงสองภาษา EN→TH" desc="อ่านอังกฤษแล้วต่อด้วยไทย" on={bilingual} set={setBilingual} />
        <TRow label="เสียงเจ้าของภาษา" desc={`คำศัพท์ ${nativeCount()} คำ (Wikimedia Commons) · ประโยค/บทสนทนา/นิทาน/คำแปลไทย ${ttsClipCount().toLocaleString()} ท่อน (เสียง neural) · โหลดครั้งแรกแล้วจำไว้ใช้ออฟไลน์ · ที่ไม่มีใช้เสียงเครื่องแทน`} on={nativeVoice} set={setNativeVoiceOn} />
        <TRow label="ดนตรีประกอบ" desc="เพลงกล่องดนตรีเบาๆ ตลอดแอป (สร้างในเครื่อง ไม่ใช้เน็ต) · ปิดอัตโนมัติเมื่อสลับแอป" on={musicOn} set={setMusicOn} />
        <TRow label="เอฟเฟกต์และแอนิเมชัน" desc="ระเบิดดาว คอนเฟตตี สั่นจอ พื้นหลังเคลื่อนไหว · ปิดถ้าเครื่องช้า" on={fxOn} set={setFxOn} />
        <TRow label="ผู้ช่วยเสียงไทย" desc="อ่านวิธีเล่นเป็นภาษาไทยทุกครั้งที่เข้าเกม (สำหรับเด็กที่ยังอ่านไทยไม่คล่อง)" on={thaiGuide} set={setThaiGuide} />
        <TRow label="เต็มจอเมื่อเข้าเกม" desc="ซ่อนแถบเบราว์เซอร์ตอนเล่น (Android/คอม · iPhone ใช้ได้เมื่อติดตั้งเป็นแอป)" on={fullscreenOn} set={setFullscreenOn} />
        <TRow label="รูปภาพจริง" desc={`รูปถ่ายจาก Wikipedia ${bundledCount()} รูปมากับแอป (ไม่ต้องใช้เน็ต) · ปิด = ใช้อีโมจิ`} on={realPics} set={setRealPics} />
        <TRow label="ตัวหนังสือใหญ่" desc="ขยายทุกอย่างในแอป 12% สำหรับเด็กเล็กหรือจอเล็ก" on={bigText} set={setBigText} />
        <TRow label="ด่านผู้ปกครอง" desc="ก่อนเข้าตั้งค่า/จัดการคำศัพท์ ต้องตอบโจทย์คูณ กันเด็กกดล้างข้อมูลหรือแก้คำเอง (ผ่านแล้วจำ 10 นาที)" on={parentGate} set={setParentGate} />
        <button onClick={onCredits} style={{ width:"100%",minHeight:44,marginBottom:10,borderRadius:16,background:T.surfHigh,color:T.ink2,border:"1px solid var(--md-outline-variant)",fontWeight:700,fontSize:12,cursor:"pointer" }}>🖼️ เครดิตรูปภาพ (ที่มา / สัญญาอนุญาต)</button>
        <div style={{ background:vr.th.length?"#ecfdf5":T.tertiaryC,border:`1px solid ${vr.th.length?"#a7f3d0":T.tertiary}`,borderRadius:14,padding:"10px 14px",marginBottom:10,fontSize:12,color:T.ink2 }}>
          <div style={{ fontWeight:800,marginBottom:2 }}>{vr.th.length ? `✅ เสียงไทยพร้อมใช้: ${vr.thPick}` : "⚠️ ยังไม่พบเสียงภาษาไทยในเครื่องนี้"}</div>
          {vr.th.length
            ? <div style={{ color:T.ink2 }}>พบเสียงทั้งหมด {vr.total} เสียง (อังกฤษ {vr.en}, ไทย {vr.th.length}) · ถ้ายังไม่ได้ยินไทย ลองกด "ทดสอบเสียง" ด้านล่าง</div>
            : <div style={{ color:T.onTertiaryC,lineHeight:1.5 }}>
                แอปจะอ่านได้แค่อังกฤษจนกว่าจะติดตั้งเสียงไทย:<br/>
                {ios
                  ? <>iPhone/iPad: <b>การตั้งค่า → การช่วยการเข้าถึง → เนื้อหาที่พูด → เสียง → ไทย</b> → ดาวน์โหลดเสียง (เช่น Kanya) แล้วเปิดแอปใหม่</>
                  : <>Android: <b>การตั้งค่า → ระบบ → ภาษาและการป้อนข้อมูล → การอ่านออกเสียง (Text-to-speech) → Speech Services by Google → ติดตั้งข้อมูลเสียง → ไทย</b> แล้วเปิดแอปใหม่</>}
                {vr.total === 0 && <><br/>(ยังโหลดรายชื่อเสียงไม่ขึ้น ลองกด "ทดสอบเสียง" 1 ครั้งแล้วเปิดตั้งค่าใหม่)</>}
              </div>}
        </div>
        <div style={{ background:T.surfHigh,borderRadius:14,padding:"12px 14px",marginBottom:10 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
            <div style={{ fontWeight:700,fontSize:14,color:T.ink }}>ความเร็วเสียง</div>
            <span style={{ fontWeight:800,color:T.error,fontSize:15 }}>{rate.toFixed(2)}x</span>
          </div>
          <input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={e=>setRate(+e.target.value)} style={{ width:"100%",height:44 }} />
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:T.ink3,marginTop:3 }}>
            <span>🐢 ช้า</span><span>ปกติ</span><span>เร็ว 🐇</span>
          </div>
        </div>
        <button onClick={()=>{ sfx.coin(); speakWord("Hello! How are you?","สวัสดี เป็นอย่างไรบ้าง",rate,bilingual); }}
          style={{ width:"100%",minHeight:48,padding:"12px",borderRadius:16,background:T.error,color:"#fff",fontWeight:800,fontSize:15,border:"none",cursor:"pointer",marginBottom:10 }}>
          🔊 ทดสอบเสียง EN+TH
        </button>
        <button onClick={onReport} style={{ width:"100%",minHeight:48,padding:"12px",borderRadius:16,background:T.secondaryC,color:"#1d4ed8",fontWeight:800,fontSize:14,border:"2px solid #bfdbfe",cursor:"pointer",marginBottom:10 }}>
          📊 รายงานผู้ปกครอง
        </button>
        <button onClick={onClose} style={{ width:"100%",minHeight:44,padding:"11px",borderRadius:16,background:T.surfHigh,color:T.ink2,fontWeight:700,fontSize:14,border:"none",cursor:"pointer" }}>
          ✓ เสร็จสิ้น
        </button>
        <button onClick={()=>{ if(window.confirm("ล้างความคืบหน้าทั้งหมด?\nดาว เหรียญ สติกเกอร์ streak และเพื่อนคู่หู จะเริ่มใหม่หมด")) onResetProgress(); }}
          style={{ width:"100%",minHeight:44,marginTop:14,background:T.card,color:T.ink3,border:"1px dashed #d1d5db",borderRadius:16,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer" }}>
          ↺ ล้างดาว / เหรียญ / สติกเกอร์ (เริ่มใหม่)
        </button>
    </M3Sheet>
  );
}

// ด่านผู้ปกครอง: โจทย์คูณสุ่ม + แป้นตัวเลข · ตอบผิดสุ่มใหม่
function ParentGate({ onPass, onClose }) {
  const mk = () => { const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7); return { a, b }; };
  const [q, setQ] = useState(mk); const [ans, setAns] = useState(""); const [shake, setShake] = useState(false);
  const push = d => { const n = (ans + d).slice(0, 3); setAns(n); if (+n === q.a * q.b) { sfx.ok(); onPass(); } else if (n.length >= String(q.a * q.b).length) { sfx.bad(); setShake(true); setTimeout(() => { setShake(false); setAns(""); setQ(mk()); }, 500); } };
  return (
    <M3Sheet onClose={onClose} z={320}>
      <h3 style={{ ...TYPE.headlineS,color:T.ink,margin:"0 0 2px" }}>🔒 ผู้ปกครองเท่านั้น</h3>
      <div style={{ ...TYPE.bodyS,color:T.ink2,marginBottom:12 }}>ตอบโจทย์เพื่อเข้าตั้งค่า (ปิดด่านนี้ได้ในตั้งค่า)</div>
      <div style={{ ...card({ background:T.primaryC,color:T.onPrimaryC }),padding:"16px 18px",textAlign:"center",marginBottom:12,animation: shake ? "vpWiggle .4s" : "none" }}>
        <div style={{ ...TYPE.displayS }}>{q.a} × {q.b} = <span style={{ display:"inline-block",minWidth:60,borderBottom:`3px solid ${MD.primary}` }}>{ans || " "}</span></div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
        {["1","2","3","4","5","6","7","8","9","ลบ","0","ปิด"].map(k => (
          <button key={k} data-key={k} onClick={() => { if (k === "ปิด") onClose(); else if (k === "ลบ") setAns(a => a.slice(0, -1)); else push(k); }} className="m3-press"
            style={k === "ปิด" ? M3.text({ minHeight:56,fontSize:16 }) : k === "ลบ" ? M3.tonal({ minHeight:56,fontSize:16 }) : M3.filled({ minHeight:56,fontSize:22,background:T.surfHigh,color:T.ink })}>{k}</button>
        ))}
      </div>
    </M3Sheet>
  );
}
// แนะนำวิธีใช้ครั้งแรก 3 ขั้น (อ่านไทยให้ฟังด้วย)
const ONBOARD_STEPS = [
  { icon:"📚", shape:"cookie12", title:"เรียนคำศัพท์ก่อน", th:"แตะหมวดที่ชอบ แล้วกดเรียนคำศัพท์ก่อนเล่น การ์ดมีรูปจริง เสียงอ่าน และคำแปล" },
  { icon:"🎮", shape:"burst", title:"เล่นเกมเก็บดาว", th:"เล่นเกมในหมวดให้ครบ ได้ดาวและเหรียญ สะสมดาวครบจะปลดล็อกด่านบอส" },
  { icon:"🐾", shape:"clover", title:"ดูแลเพื่อนคู่หู", th:"เพื่อนคู่หูจะโตขึ้นเมื่อหนูตอบถูก อย่าลืมให้อาหารและเล่นกับเขาทุกวันนะ" },
];
function OnboardingSheet({ speakTh, onDone }) {
  const [i, setI] = useState(0); const st = ONBOARD_STEPS[i];
  return (
    <M3Sheet onClose={onDone} z={310}>
      <div style={{ textAlign:"center",padding:"6px 0 4px" }}>
        <Shape kind={st.shape} size={132} fill={T.primaryC} morph><span style={{ fontSize:64 }}>{st.icon}</span></Shape>
        <div style={{ ...TYPE.headlineS,color:T.ink,marginTop:12 }}>{st.title}</div>
        <div style={{ ...TYPE.bodyL,color:T.ink2,margin:"6px auto 14px",maxWidth:360 }}>{st.th}</div>
        <div style={{ display:"flex",justifyContent:"center",gap:6,marginBottom:14 }}>{ONBOARD_STEPS.map((_, k) => <span key={k} style={{ width:k===i?22:8,height:8,borderRadius:999,background:k===i?MD.primary:MD.outlineV,transition:"width .25s" }} />)}</div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={() => { sfx.tap(); speakTh(st.th); }} className="m3-press" style={M3.tonal({ minHeight:52,padding:"0 18px" })}>🔊 ฟัง</button>
          {i < ONBOARD_STEPS.length - 1
            ? <button onClick={() => { sfx.tap(); const n = i + 1; setI(n); speakTh(ONBOARD_STEPS[n].th); }} className="m3-press" style={M3.filled({ flex:1,minHeight:52 })}>ถัดไป ›</button>
            : <button onClick={() => { sfx.coin(); onDone(); }} className="m3-press" style={M3.filled({ flex:1,minHeight:52 })}>เริ่มใช้งาน ›</button>}
        </div>
        <button onClick={onDone} style={{ ...M3.text({ minHeight:44,fontSize:13,marginTop:6 }),color:T.ink3 }}>ข้าม</button>
      </div>
    </M3Sheet>
  );
}
function TRow({ label, desc, on, set }) {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 4px 10px 12px",borderBottom:"1px solid var(--md-outline-variant)" }}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ ...TYPE.titleS,color:T.ink }}>{label}</div>
        <div style={{ ...TYPE.bodyS,color:T.ink2 }}>{desc}</div>
      </div>
      <M3Switch on={on} onChange={v => { sfx.tap(); set(v); }} label={label} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// NO WORDS
// ═══════════════════════════════════════════════════════
function NoWords({ onBack }) {
  return (
    <div style={{ padding:32,textAlign:"center" }}>
      <div style={{ fontSize:46,marginBottom:10 }}>📭</div>
      <p style={{ color:T.ink2,fontWeight:600,fontSize:14 }}>ยังไม่มีคำพอสำหรับเกมนี้ (ต้องมีอย่างน้อย 4 คำ)</p>
      <button onClick={onBack} style={{ marginTop:14,minHeight:44,background:T.primary,color:"#fff",borderRadius:16,padding:"10px 22px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>กลับ</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PET AVATAR — อีโมจิเพื่อนคู่หู + หมวกที่ซื้อจากร้าน
// ═══════════════════════════════════════════════════════
// ตัวละคร SVG (src/Pet.jsx) · mood: idle/happy/sad/sleepy/excited · ขนาดอิงจาก size เดิม (อีโมจิ) ×1.6
function PetAvatar({ pet, hat, outfit, size = 48, bounce = false, mood = "idle", talk = false }) {
  const h = SHOP_ITEMS.find(i => i.id === hat);
  const hour = new Date().getHours();
  const m = mood !== "idle" ? mood : (hour >= 21 || hour < 6) ? "sleepy" : "idle";
  return <Pet kind={pet?.id || "cat"} stage={pet?.stage ?? 0} mood={m} size={size * 1.6} hat={h?.emoji} outfit={outfit || []} talk={talk} />;
}

// ═══════════════════════════════════════════════════════
// FLASH CARDS — โหมดเรียน (แบบ Quizlet) พลิกการ์ด · รู้แล้ว/ยังไม่แม่น ป้อนเข้า SRS
// ═══════════════════════════════════════════════════════
function FlashCards({ words, cat, speak, speakAt, setProgress, showToast, onDone }) {
  const deck = useMemo(() => shuffle(words).slice(0, 12), [words]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [know, setKnow] = useState(0);
  const w = deck[i];
  if (!w) return <NoWords onBack={onDone} />;
  const mark = ok => {
    ok ? sfx.ok() : sfx.tap();
    setProgress(p => {
      const q = bumpDaily(p, "cards", 1);
      return { ...q, learned: { ...q.learned, [w.id]: true }, srs: ok ? srsCorrect(q.srs, w.id) : srsWrong(q.srs, w.id) };
    });
    const k = know + (ok ? 1 : 0);
    if (i + 1 < deck.length) { setKnow(k); setI(i + 1); setFlip(false); }
    else { showToast(`📖 เรียนครบ ${deck.length} ใบ · รู้แล้ว ${k} คำ`); onDone(); }
  };
  const btn = { flex:1,minHeight:44,borderRadius:16,border:"none",background:T.surfHigh,color:T.ink2,fontWeight:700,fontSize:13,cursor:"pointer" };
  return (
    <div style={{ padding:"10px",maxWidth:440,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:T.ink2,padding:"0 4px 8px" }}>
        <span>📖 การ์ดที่ {i+1}/{deck.length}</span><span>😎 รู้แล้ว {know}</span>
      </div>
      <button onClick={() => { sfx.tap(); if (!flip) speak(w.word, w.meaning); setFlip(f => !f); }}
        style={{ width:"100%",minHeight:"min(62vh, 520px)",borderRadius:28,border:"none",background:"transparent",cursor:"pointer",padding:0,perspective:1200,position:"relative",fontFamily:FONT }}>
        <span key={w.id} style={{ position:"absolute",inset:0,transformStyle:"preserve-3d",transition:"transform .65s cubic-bezier(.2,.8,.2,1)",transform:flip?"rotateY(180deg)":"rotateY(0deg)",animation:"vpInScale .45s both" }}>
          <span style={{ position:"absolute",inset:0,borderRadius:28,backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",background:T.card,border:`3px solid ${cat.color}50`,boxShadow:"0 18px 44px rgba(0,0,0,.18)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:20 }}>
            <Pic w={w} size={84} fill style={{ height:"min(42vh, 400px)" }} />
            <span style={{ fontSize:34,fontWeight:900,color:T.ink,letterSpacing:1 }}>{w.word}</span>
            {w.read && <span style={{ fontSize:18,fontWeight:700,color:T.primary }}>{w.read}</span>}
            <span style={{ fontSize:11,color:T.ink3,marginTop:8 }}>แตะการ์ดเพื่อพลิกดูความหมาย</span>
          </span>
          <span style={{ position:"absolute",inset:0,borderRadius:28,backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",transform:"rotateY(180deg)",background:`linear-gradient(160deg, ${cat.color}22, #fff 60%)`,border:`3px solid ${cat.color}80`,boxShadow:"0 18px 44px rgba(0,0,0,.18)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:20,overflowY:"auto" }}>
            <Pic w={w} size={44} radius={14} />
            <span style={{ fontSize:30,fontWeight:900,color:T.ink }}>{w.meaning}</span>
            {w.read && <span style={{ fontSize:14,color:T.primary,fontWeight:700 }}>{w.word} · {w.read}</span>}
            {w.sen && <div style={{ marginTop:10,background:T.card,borderRadius:14,padding:"10px 14px",width:"100%" }}>
              <div style={{ fontSize:16,fontWeight:700,color:T.ink }}>{w.sen}</div>
              <div style={{ fontSize:13,color:T.ink2,marginTop:2 }}>{w.senTh}</div>
            </div>}
            {imageTitleOf(w) && <a href={wikiPageUrl(imageTitleOf(w))} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize:10,color:T.ink3,marginTop:6 }}>รูป: Wikipedia — {imageTitleOf(w)} ↗</a>}
          </span>
        </span>
      </button>
      <div style={{ display:"flex",gap:6,marginTop:10 }}>
        <button onClick={() => speak(w.word, w.meaning)} style={btn}>🔊 คำ</button>
        <button onClick={() => speakAt(w.word, w.meaning, 0.55)} style={btn}>🐢 ช้าๆ</button>
        {w.sen && <button onClick={() => speak(w.sen, w.senTh)} style={btn}>💬 ประโยค</button>}
      </div>
      <div style={{ display:"flex",gap:8,marginTop:10 }}>
        <button onClick={() => mark(false)} style={{ flex:1,minHeight:54,borderRadius:16,border:"none",background:T.tertiaryC,color:T.onTertiaryC,fontWeight:800,fontSize:15,cursor:"pointer",border:"2px solid #fdba74" }}>😅 ยังไม่แม่น</button>
        <button onClick={() => mark(true)} style={{ flex:1,minHeight:54,borderRadius:16,border:"none",background:T.ok,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer" }}>😎 รู้แล้ว</button>
      </div>
      <p style={{ textAlign:"center",fontSize:11,color:T.ink3,marginTop:10 }}>คำที่ "ยังไม่แม่น" จะกลับมาให้ทบทวนวันนี้ · คำที่ "รู้แล้ว" จะเว้นระยะนานขึ้นเรื่อยๆ</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LISTEN — ฟังอย่างเดียว (ไม่มีรูป) แล้วเลือกรูป · 10 ข้อ
// ═══════════════════════════════════════════════════════
// ป้อนอาหารเพื่อนคู่หู (หมวดอาหาร/ผลไม้/ผัก): ฟังคำ+เห็นคำ → แตะรูปอาหาร → บินเข้าปากเพื่อนคู่หู
function FeedGame({ words, speak, track, pet, hat, outfit, onBack }) {
  const N = 10;
  const qs = useMemo(() => shuffle(words).slice(0, N), [words]);
  const [i, setI] = useState(0); const [score, setScore] = useState(0);
  const [fly, setFly] = useState(null); const [mood, setMood] = useState("happy"); const [lock, setLock] = useState(false); const [wrongId, setWrongId] = useState(null);
  const cur = qs[i];
  const opts = useMemo(() => cur ? shuffle([cur, ...pickOthers(words, cur, 3)]) : [], [i, cur?.id]);
  useEffect(() => { if (i > 0 && cur) speak(cur.word, cur.meaning); }, [i]); // eslint-disable-line
  if (!cur || words.length < 4) return <NoWords onBack={onBack} />;
  const tap = (o, e) => {
    if (lock) return;
    if (o.id === cur.id) {
      setLock(true); setFly(o.id); setMood("excited"); setScore(s => s + 1); track.correct(cur, e); speak(`Yummy! ${cur.word}!`, `อร่อย ${cur.meaning}`);
      afterSpeech(() => { setFly(null); setMood("happy"); setLock(false); if (i + 1 < qs.length) setI(i + 1); else track.finish(score + 1, qs.length); }, 1300);
    } else { setWrongId(o.id); setMood("sad"); track.wrong(cur); sfx.bad(); setTimeout(() => { setWrongId(null); setMood("happy"); }, 700); }
  };
  return (
    <GameCard>
      <Bar left={`😋 ${i + 1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <SoundPrompt onClick={() => speak(cur.word, cur.meaning)} w={cur} pulse={!lock} />
        <div style={{ position:"relative",display:"flex",justifyContent:"center",margin:"4px 0 10px" }}>
          <span style={{ position:"absolute",left:"8%",top:6,background:T.card,color:T.ink,borderRadius:"18px 18px 6px 18px",padding:"6px 12px",fontWeight:800,fontSize:14,boxShadow:MD.shadow,zIndex:1 }}>{mood === "sad" ? "ไม่ใช่อันนี้~" : mood === "excited" ? "อร่อย! 😋" : "หิวแล้ว~"}</span>
          <div style={{ animation:mood === "excited" ? "vpBounce .5s ease-in-out 2" : mood === "sad" ? "vpWiggle .5s" : "vpFloatY 2.4s ease-in-out infinite" }}>
            <Shape kind="cookie12" size={136} fill={mood === "excited" ? T.tertiaryC : T.primaryC} morph={mood === "excited"}>
              {pet ? <PetAvatar pet={pet} hat={hat} outfit={outfit} size={78} mood={mood === "excited" ? "excited" : mood === "sad" ? "sad" : "happy"} talk={mood === "excited"} /> : <span style={{ fontSize:80 }}>😋</span>}
            </Shape>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {opts.map(o => (
            <button key={o.id} onClick={e => tap(o, e)} disabled={lock} aria-label="รูปอาหาร" style={{ position:"relative",aspectRatio:"4/3",padding:0,borderRadius:20,overflow:"hidden",border:`3px solid ${wrongId === o.id ? T.error : T.primaryC}`,background:T.card,cursor:"pointer",
              transition:"transform .9s cubic-bezier(.5,-0.3,.7,1), opacity .9s",transform:fly === o.id ? "translateY(-200px) scale(.25) rotate(360deg)" : wrongId === o.id ? "translateX(6px)" : "none",opacity:fly === o.id ? 0 : lock && fly !== o.id ? .5 : 1,animation:wrongId === o.id ? "vpWiggle .4s" : "none" }}>
              <PicFill w={o} emojiSize={44} />
            </button>
          ))}
        </div>
      </div>
    </GameCard>
  );
}
function ListenGame({ words, speakAt, track, onBack, pool }) {
  const qs = useMemo(() => shuffle(words).slice(0, 10), [words]);
  const src = pool && pool.length >= 4 ? pool : words;
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [lock, setLock] = useState(false);
  const [played, setPlayed] = useState(false);
  const cur = qs[idx];
  const choices = useMemo(() => cur ? shuffle([cur, ...shuffle(src.filter(w => w.id !== cur.id)).slice(0, 3)]) : [], [idx, cur?.id, src]);
  if (!cur || src.length < 4) return <NoWords onBack={onBack} />;
  const pick = c => {
    if (lock || !played) return;
    setLock(true); setPicked(c.id);
    const ok = c.id === cur.id;
    if (ok) { setScore(s => s + 1); track.correct(cur); } else track.wrong(cur);
    afterSpeech(() => {
      if (idx + 1 < qs.length) { setIdx(i => i + 1); setPicked(null); setLock(false); setPlayed(false); }
      else track.finish(ok ? score + 1 : score, qs.length);
    }, 1000);
  };
  return (
    <GameCard>
      <Bar left={`👂 ${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <SoundPrompt onClick={() => { setPlayed(true); speakAt(cur.word, null, 0.8); }} pulse={!played} w={cur} />
        <p style={{ textAlign:"center",fontSize:13,fontWeight:700,color:T.ink2,margin:"0 0 4px" }}>{played ? "ได้ยินคำว่าอะไร? เลือกรูป" : "แตะลำโพงเพื่อฟัง (ฟังซ้ำได้)"}</p>
        {lock && <p style={{ textAlign:"center",fontSize:14,color:T.primary,fontWeight:800,margin:"0 0 8px" }}>{cur.word} · {cur.read} · {cur.meaning}</p>}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8 }}>
          {choices.map(c => {
            const ic = c.id === cur.id, ip = picked === c.id, sr = lock && (ic || ip);
            let bg = T.card, bo = T.cardBorder, ed = T.cardEdge;
            if (sr && ic) { bg = T.okC; bo = T.ok; ed = T.okEdge; }
            if (sr && ip && !ic) { bg = T.errorC; bo = T.error; ed = T.errorEdge; }
            return <button key={c.id} onClick={() => pick(c)} disabled={lock || !played}
              style={{ background:bg,border:`3px solid ${bo}`,boxShadow:`0 5px 0 ${ed}`,borderRadius:20,aspectRatio:"4/3",fontSize:44,cursor:"pointer",opacity:played?1:0.5,position:"relative",overflow:"hidden",padding:0 }}><PicFill w={c} emojiSize={44} /></button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// SPEAK — พูดตาม (Web Speech Recognition) · 8 คำ
// ═══════════════════════════════════════════════════════
const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
function SpeakGame({ words, speak, track, onBack }) {
  const qs = useMemo(() => shuffle(words).slice(0, 8), [words]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [st, setSt] = useState("idle");   // idle | listening | ok | no | err
  const [heard, setHeard] = useState("");
  const [gotIt, setGotIt] = useState(false);
  const [pct, setPct] = useState(0);
  const cur = qs[idx];
  if (!cur) return <NoWords onBack={onBack} />;
  if (!SR) return (
    <GameCard><div style={{ padding:28,textAlign:"center" }}>
      <div style={{ fontSize:50 }}>🎤</div>
      <p style={{ fontWeight:800,fontSize:15,color:T.ink }}>เบราว์เซอร์นี้ยังฟังเสียงพูดไม่ได้</p>
      <p style={{ fontSize:13,color:T.ink2 }}>ลองเปิดใน Chrome (Android) หรือ Safari (iPhone) แล้วอนุญาตให้ใช้ไมโครโฟน</p>
      <Pill onClick={onBack} bg={T.primary}>กลับ</Pill>
    </div></GameCard>
  );
  const listen = () => {
    try {
      const r = new SR(); r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 5;
      const target = cur.word.toLowerCase();
      r.onresult = e => {
        const alts = [...e.results[0]].map(a => a.transcript.toLowerCase().trim().replace(/[^a-z ]/g, ""));
        setHeard(alts[0] || "");
        // คะแนนความใกล้เคียง: ตรงตัว/มีคำอยู่ในประโยค = 100% · ไม่งั้นวัดจากตัวสะกด (ผ่านที่ ≥ 70%)
        const best = Math.max(...alts.map(a => (a === target || a.split(" ").includes(target)) ? 1 : Math.max(similarity(a, target), ...a.split(" ").map(x => similarity(x, target)))));
        setPct(Math.round(best * 100));
        if (best >= 0.7) { setSt("ok"); if (!gotIt) { setGotIt(true); setScore(s => s + 1); track.correct(cur); } else sfx.ok(); }
        else { setSt("no"); track.wrong(cur); }
      };
      r.onerror = ev => setSt(ev?.error === "not-allowed" ? "err" : "no");
      r.onend = () => setSt(s => (s === "listening" ? "no" : s));
      r.start(); setSt("listening"); setHeard("");
    } catch (_) { setSt("err"); }
  };
  const next = () => {
    if (idx + 1 < qs.length) { setIdx(i => i + 1); setSt("idle"); setHeard(""); setGotIt(false); setPct(0); }
    else track.finish(score, qs.length);
  };
  const micBg = st === "listening" ? T.error : st === "ok" ? T.ok : T.grad;
  return (
    <GameCard>
      <Bar left={`🎤 ${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <Emoji e={cur.emoji} w={cur} size={52} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:30,fontWeight:900,color:T.ink,letterSpacing:1 }}>{cur.word}</div>
          <div style={{ fontSize:16,fontWeight:700,color:T.primary }}>{cur.read}</div>
          <div style={{ fontSize:13,color:T.ink2 }}>{cur.meaning}</div>
        </div>
        <SndBtn onClick={() => speak(cur.word, null)} />
        <button onClick={listen} disabled={st === "listening"}
          style={{ width:110,height:110,borderRadius:55,margin:"4px auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:46,background:micBg,border:"none",cursor:"pointer",boxShadow:"0 8px 24px rgba(239,68,68,0.3)",animation:st==="listening"?"vpBounce .6s infinite":"none" }}>
          {st === "ok" ? "✅" : "🎤"}
        </button>
        <p style={{ textAlign:"center",fontSize:13,fontWeight:700,margin:"0 0 6px",color:st==="ok"?T.ok:st==="no"?T.error:T.ink2 }}>
          {st === "idle" && "แตะไมค์ แล้วพูดคำนี้"}
          {st === "listening" && "กำลังฟัง... พูดเลย!"}
          {st === "ok" && (pct >= 95 ? "เยี่ยม! ชัดเจนมาก 🎉 100%" : `ดีมาก! ใกล้เคียง ${pct}% 👏`)}
          {st === "no" && (heard ? `ได้ยินว่า "${heard}" (${pct}%) ลองอีกครั้งนะ` : "ไม่ได้ยินเสียง ลองพูดดังๆ อีกที")}
          {st === "err" && "ต้องอนุญาตให้ใช้ไมโครโฟนก่อนนะ"}
        </p>
        <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
          {(st === "no" || st === "err") && <Pill onClick={listen} bg={T.tertiary}>🎤 ลองอีก</Pill>}
          <Pill onClick={next} bg={gotIt ? T.ok : T.ink3}>{gotIt ? "ถัดไป ›" : "ข้าม ›"}</Pill>
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// SENTENCE — เรียงประโยคจากคำที่สลับไว้ · 6 ประโยค
// ═══════════════════════════════════════════════════════
function SentenceGame({ words, speak, track, onBack }) {
  const qs = useMemo(() => shuffle(words.filter(w => w.sen)).slice(0, 6), [words]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [pool, setPool] = useState([]);
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState(true);
  const cur = qs[idx];
  const tokens = useMemo(() => (cur ? cur.sen.split(" ") : []), [cur?.id]);
  useEffect(() => { setPool(shuffle(tokens.map((t, i) => ({ id: i, t })))); setPicked([]); setDone(false); }, [idx, tokens]);
  if (!cur) return <NoWords onBack={onBack} />;
  const ans = picked.map(p => p.t).join(" ");
  const full = picked.length === tokens.length;
  const correct = full && ans === cur.sen;
  const tap = l => {
    if (done) return;
    const np = [...picked, l]; setPicked(np); setPool(pool.filter(x => x.id !== l.id));
    if (np.length < tokens.length) speak(l.t.replace(/[.,!?]/g, ""), null);   // แตะคำ → ได้ยินคำนั้น
    if (np.length === tokens.length) {
      setDone(true);
      if (np.map(p => p.t).join(" ") === cur.sen) { track.correct(cur); setScore(s => s + 1); speak(cur.sen, cur.senTh); }
      else track.wrong(cur);
    }
  };
  const nextTok = tokens[picked.length];
  const undo = i => { if (done) return; const r = picked[i]; setPicked(picked.filter((_, j) => j !== i)); setPool([...pool, r]); };
  const chip = (bg, bo, c) => ({ minHeight:44,padding:"8px 12px",borderRadius:16,background:bg,border:`2px solid ${bo}`,color:c,fontWeight:800,fontSize:15,cursor:"pointer" });
  return (
    <GameCard>
      <Bar left={`🧩 ${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ textAlign:"center",marginBottom:8 }}>
          <PicBox w={cur} h="min(31vh, 290px)" />
          <div style={{ fontSize:15,fontWeight:700,color:T.ink2,marginTop:8 }}>{cur.senTh}</div>
          <div style={{ fontSize:11,color:T.ink3 }}>เรียงคำให้เป็นประโยคภาษาอังกฤษ</div>
        </div>
        <SndBtn onClick={() => speak(cur.sen, null)} />
        <div style={{ minHeight:64,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:10,borderRadius:14,marginBottom:10,background:done?(correct?T.okC:T.errorC):T.surfHigh,border:`2px dashed ${done?(correct?T.ok:T.error):T.outlineV}` }}>
          {picked.length === 0 && <span style={{ color:T.ink3,fontSize:12 }}>แตะคำด้านล่างตามลำดับ</span>}
          {picked.map((l, i) => <button key={l.id} onClick={() => undo(i)} style={chip(done?(correct?T.ok:T.error):T.primary,"transparent","#fff")}>{l.t}</button>)}
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",minHeight:50,marginBottom:10 }}>
          {pool.map(l => { const nx = hint && l.t === nextTok; return <button key={l.id} onClick={() => tap(l)} style={{ ...chip(nx ? T.okC : T.secondaryC, nx ? T.ok : T.primaryC, nx ? T.onOkC : T.onPrimaryC), animation:nx ? "vpBounce 1.6s ease-in-out infinite" : "none" }}>🔊 {l.t}</button>; })}
        </div>
        {done && !correct && <div style={{ textAlign:"center",fontSize:13,color:T.onErrorC,marginBottom:8 }}>ที่ถูกคือ: <b>{cur.sen}</b></div>}
        {done && correct && <div style={{ textAlign:"center",fontSize:13,color:T.onOkC,fontWeight:700,marginBottom:8 }}>🎉 {cur.sen}</div>}
        <div style={{ display:"flex",gap:8 }}>
          <Pill onClick={() => { setPool(shuffle(tokens.map((t, i) => ({ id: i, t })))); setPicked([]); setDone(false); }} bg={T.ink3}>🔄 ใหม่</Pill>
          <Pill onClick={() => { sfx.tap(); setHint(h => !h); }} bg={hint ? T.ok : T.ink3}>💡 ช่วย</Pill>
          <Pill onClick={() => { if (idx + 1 < qs.length) setIdx(i => i + 1); else track.finish(score, qs.length); }} disabled={!done} bg={T.primary}>ถัดไป ›</Pill>
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// MISSIONS CARD — ภารกิจประจำวัน 3 อย่าง (แบบ Duolingo)
// ═══════════════════════════════════════════════════════
function MissionsCard({ progress, setProgress }) {
  const d = progress.daily || EMPTY_DAILY;
  const ms = missionsForDate(d.date || today());
  const doneAll = ms.every(m => d.claimed[m.id]);
  return (
    <div style={{ ...M3.card(),padding:"14px 16px",marginBottom:14 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
        <span style={{ ...TYPE.titleM,color:T.ink,display:"inline-flex",alignItems:"center",gap:8 }}><Shape kind="cookie6" size={28} fill={T.tertiaryC}><span style={{ fontSize:14 }}>🎯</span></Shape>ภารกิจวันนี้</span>
        <span style={{ ...TYPE.labelM,color:T.ink3 }}>{doneAll ? "ครบแล้ว เก่งมาก! 🎉" : "รีเซ็ตทุกวัน"}</span>
      </div>
      {ms.map(m => {
        const n = Math.min(m.goal, d.counters[m.key] || 0);
        const ready = n >= m.goal && !d.claimed[m.id];
        const claimed = !!d.claimed[m.id];
        return (
          <div key={m.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0" }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ ...TYPE.titleS,color:claimed?T.ink3:T.ink,textDecoration:claimed?"line-through":"none" }}>{m.label}</div>
              <div style={{ height:8,background:T.surfHighest,borderRadius:999,marginTop:5,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${(n/m.goal)*100}%`,background:claimed?T.outlineV:T.primary,borderRadius:999,transition:"width .4s" }} />
              </div>
            </div>
            {claimed
              ? <span style={{ fontSize:20 }}>✅</span>
              : ready
                ? <button onClick={() => { sfx.coin(); setProgress(p => ({ ...p, coins:p.coins+m.reward, daily:{ ...p.daily, claimed:{ ...p.daily.claimed, [m.id]:true } } })); }}
                    className="m3-press" style={M3.filled({ minHeight:44,padding:"0 14px",fontSize:13,animation:"vpBounce 1s infinite" })}>รับ +{m.reward} 🪙</button>
                : <span style={{ fontSize:12,fontWeight:800,color:T.ink3,minWidth:44,textAlign:"right" }}>{n}/{m.goal}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SHOP — ร้านค้าแต่งเพื่อนคู่หู
// ═══════════════════════════════════════════════════════
function ShopScreen({ progress, setProgress, showToast }) {
  const pet = getPet(progress);
  const [tab, setTab] = useState("hat");
  const items = SHOP_ITEMS.filter(i => i.type === tab);
  const bg = SHOP_ITEMS.find(i => i.id === progress.bg)?.css || T.grad;
  const buy = it => {
    if (progress.coins < it.cost) { sfx.bad(); showToast(`เหรียญไม่พอ ขาดอีก ${it.cost - progress.coins} 🪙`, "warn"); return; }
    sfx.coin(); fx.burst(innerWidth/2, 160, { count: 24 }); setProgress(p => it.type === "outfit"
      ? { ...p, coins:p.coins-it.cost, owned:{ ...p.owned, [it.id]:true }, outfit:[...(p.outfit || []), it.id] }
      : { ...p, coins:p.coins-it.cost, owned:{ ...p.owned, [it.id]:true }, [it.type]: it.id });
    showToast(`ซื้อ ${it.name} แล้ว ✓`);
  };
  const wear = it => { sfx.tap(); setProgress(p => it.type === "outfit"
    ? { ...p, outfit: (p.outfit || []).includes(it.id) ? (p.outfit || []).filter(x => x !== it.id) : [...(p.outfit || []), it.id] }
    : { ...p, [it.type]: p[it.type] === it.id ? null : it.id }); };
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:bg,borderRadius:28,padding:16,textAlign:"center",marginBottom:12 }}>
        <PetAvatar pet={pet} hat={progress.hat} outfit={progress.outfit} size={76} bounce mood="happy" />
        <div style={{ fontWeight:900,fontSize:16,color:progress.bg==="bgSpace"?"#fff":T.ink,marginTop:4 }}>{pet?.name || "เพื่อนคู่หู"}</div>
        <div style={{ ...M3.assist(),marginTop:6,fontWeight:700 }}>🪙 {progress.coins}</div>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:12 }}>
        {[["hat","🎩 หมวก"],["outfit","👕 ชุด"],["bg","🖼️ พื้นหลัง"],["theme","🎨 ธีมแอป"]].map(([k,l]) => (
          <button key={k} onClick={() => { sfx.tap(); setTab(k); }} className="m3-press" style={{ ...M3.chip(tab===k,{ flex:1,minHeight:44,borderRadius:tab===k?999:12,fontSize:13,padding:"0 6px" }) }}>{l}</button>
        ))}
      </div>
      {tab === "theme" && <div style={{ fontSize:12,color:T.ink2,marginBottom:10,textAlign:"center" }}>ธีมเปลี่ยนสีทั้งแอป (พื้นหลัง · hero · แท็บ) · "ออโรรา" คือธีมเริ่มต้นฟรี</div>}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {items.map(it => {
          const owned = !!progress.owned[it.id] || it.cost === 0; const on = it.type === "outfit" ? (progress.outfit || []).includes(it.id) : (progress[it.type] || (it.type === "theme" ? "aurora" : null)) === it.id;
          return (
            <div key={it.id} style={{ ...card(on ? { background:T.secondaryC,color:T.onSecondaryC } : {}),padding:12,textAlign:"center",outline:on?`2px solid ${MD.primary}`:"none",outlineOffset:-2 }}>
              <div style={{ height:64,borderRadius:18,background:it.css||it.preview||T.surfHigh,display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,marginBottom:6 }}>{it.emoji}</div>
              <div style={{ fontWeight:800,fontSize:13,color:T.ink }}>{it.name}</div>
              {owned
                ? <button onClick={() => wear(it)} className="m3-press" style={on ? M3.filled({ marginTop:6,width:"100%",minHeight:44,fontSize:13,padding:"0 8px" }) : M3.tonal({ marginTop:6,width:"100%",minHeight:44,fontSize:13,padding:"0 8px" })}>{on ? "ใส่อยู่ ✓ (แตะถอด)" : "ใส่"}</button>
                : <button onClick={() => buy(it)} className="m3-press" style={progress.coins>=it.cost ? M3.tertiaryBtn({ marginTop:6,width:"100%",minHeight:44,fontSize:13,padding:"0 8px" }) : M3.tonal({ marginTop:6,width:"100%",minHeight:44,fontSize:13,padding:"0 8px",background:T.surfHighest,color:T.ink3 })}>ซื้อ 🪙 {it.cost}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PARENT REPORT — รายงานผู้ปกครอง
// ═══════════════════════════════════════════════════════
function WeeklyCard({ progress, profile, words }) {
  const wk = weekStats(progress, 7);
  const sum = k => wk.reduce((a, d) => a + d[k], 0);
  const active = wk.filter(d => d.active).length;
  const max = Math.max(1, ...wk.map(d => d.correct));
  const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const mastered = words.filter(w => isMastered(progress.srs, w.id)).length;
  const share = async () => {
    try {
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1080; const g = c.getContext("2d");
      const cs = getComputedStyle(document.documentElement); const col = k => cs.getPropertyValue(`--md-${k}`).trim() || "#999";
      g.fillStyle = col("primary-container"); g.fillRect(0, 0, 1080, 1080);
      g.fillStyle = col("surface-container-lowest"); g.beginPath(); g.roundRect(60, 60, 960, 960, 56); g.fill();
      g.fillStyle = col("on-surface"); g.textAlign = "left";
      g.font = "900 56px Prompt, system-ui, sans-serif"; g.fillText("สรุปสัปดาห์นี้", 110, 170);
      g.font = "500 36px Prompt, system-ui, sans-serif"; g.fillStyle = col("on-surface-variant"); g.fillText(`${profile?.avatar || ""} ${profile?.name || "นักเรียน"} · ${wk[0].date} → ${wk[6].date}`, 110, 225);
      const stats = [[sum("correct"), "ตอบถูก"], [sum("cards"), "การ์ดที่เรียน"], [sum("games"), "รอบที่เล่น"], [active, "วันที่เล่น /7"]];
      stats.forEach(([v, l], k) => { const x = 110 + (k % 2) * 440, y = 290 + Math.floor(k / 2) * 170; g.fillStyle = col("secondary-container"); g.beginPath(); g.roundRect(x, y, 400, 140, 32); g.fill(); g.fillStyle = col("on-secondary-container"); g.font = "900 64px Prompt, system-ui, sans-serif"; g.fillText(String(v), x + 30, y + 80); g.font = "500 30px Prompt, system-ui, sans-serif"; g.fillText(l, x + 30, y + 120); });
      // กราฟแท่ง 7 วัน
      g.fillStyle = col("on-surface"); g.font = "700 34px Prompt, system-ui, sans-serif"; g.fillText("ตอบถูกต่อวัน", 110, 690);
      wk.forEach((d, k) => { const h = Math.round((d.correct / max) * 180); const x = 110 + k * 125; g.fillStyle = d.correct ? col("primary") : col("surface-container-highest"); g.beginPath(); g.roundRect(x, 900 - h, 90, Math.max(h, 12), 18); g.fill(); g.fillStyle = col("on-surface-variant"); g.font = "500 28px Prompt, system-ui, sans-serif"; g.textAlign = "center"; g.fillText(DOW[d.dow], x + 45, 950); if (d.correct) g.fillText(String(d.correct), x + 45, 885 - h); g.textAlign = "left"; });
      g.fillStyle = col("outline"); g.font = "400 26px Prompt, system-ui, sans-serif"; g.fillText(`จำได้แม่นสะสม ${mastered} คำ · Smart VocabPlay`, 110, 1000);
      const blob = await new Promise(r => c.toBlob(r, "image/png"));
      const file = new File([blob], `vocabplay-week-${wk[6].date}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "สรุปสัปดาห์ Smart VocabPlay" }); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    } catch (_) {}
  };
  return (
    <div style={{ ...card({ background:T.secondaryC,color:T.onSecondaryC }),padding:16,marginBottom:12 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
        <div style={{ ...TYPE.titleM }}>📅 สัปดาห์นี้</div>
        <button onClick={() => { sfx.tap(); share(); }} className="m3-press" style={M3.filled({ minHeight:40,padding:"0 16px",fontSize:13 })}>แชร์รูปสรุป</button>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12 }}>
        {[[sum("correct"), "ตอบถูก"], [sum("cards"), "การ์ด"], [sum("games"), "รอบ"], [`${active}/7`, "วันที่เล่น"]].map(([v, l]) => <div key={l} style={{ textAlign:"center" }}><div style={{ ...TYPE.headlineS }}>{v}</div><div style={{ ...TYPE.labelS,opacity:.8 }}>{l}</div></div>)}
      </div>
      <div style={{ display:"flex",alignItems:"flex-end",gap:6,height:64 }}>
        {wk.map(d => <div key={d.date} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end" }}>
          <div style={{ width:"100%",maxWidth:28,height:`${Math.max(8, (d.correct / max) * 46)}px`,borderRadius:8,background:d.correct ? T.primary : "color-mix(in oklab, var(--md-on-secondary-container) 15%, transparent)" }} title={`${d.date}: ${d.correct}`} />
          <span style={{ ...TYPE.labelS,opacity:.8 }}>{DOW[d.dow]}</span>
        </div>)}
      </div>
    </div>
  );
}
function ReportScreen({ words, categories, progress, profile }) {
  const total = progress.totalCorrect || 0, wrong = progress.wrongTotal || 0;
  const acc = total + wrong ? Math.round((total / (total + wrong)) * 100) : 0;
  const mastered = words.filter(w => isMastered(progress.srs, w.id));
  const learned = words.filter(w => progress.srs[w.id] || progress.learned[w.id]);
  const stickers = words.filter(w => (progress.stickers[w.id] || 0) >= STICKER_NEED).length;
  const weak = words.filter(w => progress.mistakes[w.id] > 0).sort((a, b) => progress.mistakes[b.id] - progress.mistakes[a.id]).slice(0, 10);
  const Stat = ({ v, l, c }) => <div style={{ background:T.card,borderRadius:14,padding:"10px 8px",textAlign:"center",border:"none" }}><div style={{ fontSize:22,fontWeight:900,color:c }}>{v}</div><div style={{ fontSize:11,color:T.ink2 }}>{l}</div></div>;
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:560,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:12 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>📊 รายงานผู้ปกครอง</div>
        <div style={{ fontSize:13,opacity:0.9 }}>ความคืบหน้าทั้งหมดของลูก · อัปเดตอัตโนมัติ</div>
      </div>
      <WeeklyCard progress={progress} profile={profile} words={words} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12 }}>
        <Stat v={mastered.length} l={`คำที่จำได้แม่น / ${words.length}`} c={T.ok} />
        <Stat v={learned.length} l="คำที่เคยเรียน" c="#2563eb" />
        <Stat v={`${acc}%`} l="ความแม่นยำ" c={T.tertiary} />
        <Stat v={total} l="ตอบถูกสะสม" c={T.primary} />
        <Stat v={progress.games || 0} l="รอบที่เล่นจบ" c={T.accent} />
        <Stat v={`${progress.streak.count} วัน`} l="เล่นต่อเนื่อง" c={T.tertiary} />
      </div>
      <div style={{ background:T.card,borderRadius:16,padding:14,marginBottom:12,border:"none" }}>
        <div style={{ fontWeight:800,fontSize:14,color:T.ink,marginBottom:8 }}>ความคืบหน้าแต่ละหมวด</div>
        {categories.map(c => {
          const ws = words.filter(w => w.cat === c.id); if (!ws.length) return null;
          const m = ws.filter(w => isMastered(progress.srs, w.id)).length;
          const st = c.games.reduce((a, g) => a + (progress.stars[`${c.id}:${g}`] || 0), 0);
          return (
            <div key={c.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 0" }}>
              <CatIcon id={c.id} size={24} />
              <span style={{ fontSize:12,fontWeight:700,color:T.ink2,width:72 }}>{c.label}{progress.boss[c.id] ? " 👑" : ""}</span>
              <div style={{ flex:1,height:8,background:T.surfHigh,borderRadius:999,overflow:"hidden" }}><div style={{ height:"100%",width:`${(m/ws.length)*100}%`,background:c.color,borderRadius:999 }} /></div>
              <span style={{ fontSize:11,color:T.ink2,width:88,textAlign:"right" }}>{m}/{ws.length} · ⭐{st}</span>
            </div>
          );
        })}
      </div>
      <div style={{ background:T.card,borderRadius:16,padding:14,border:"none" }}>
        <div style={{ fontWeight:800,fontSize:14,color:T.ink,marginBottom:4 }}>คำที่ยังพลาดบ่อย</div>
        <div style={{ fontSize:11,color:T.ink3,marginBottom:8 }}>ลองชวนลูกทบทวนคำพวกนี้ด้วยกัน</div>
        {weak.length === 0 && <div style={{ fontSize:13,color:"#059669",fontWeight:700 }}>ยังไม่มี เก่งมาก! 🎉</div>}
        {weak.map(w => (
          <div key={w.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderTop:"1px solid #f9fafb" }}>
            <span style={{ fontSize:24 }}>{w.emoji}</span>
            <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:13,color:T.ink }}>{w.word} <span style={{ color:T.primary,fontWeight:600 }}>{w.read}</span></div><div style={{ fontSize:12,color:T.ink2 }}>{w.meaning}</div></div>
            <span style={{ fontSize:11,fontWeight:800,color:T.error,background:T.errorC,padding:"2px 8px",borderRadius:999 }}>พลาด {progress.mistakes[w.id]}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11,color:T.ink3,textAlign:"center",marginTop:12 }}>"จำได้แม่น" = ตอบถูกต่อเนื่องจนระบบเว้นระยะทบทวน ≥ 7 วัน</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROFILE SHEET — สลับ/เพิ่ม/ลบโปรไฟล์ (พี่น้องใช้เครื่องเดียวกัน)
// ═══════════════════════════════════════════════════════
function ProfileSheet({ profiles, onSwitch, onAdd, onDelete, onClose }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[1]);
  return (
    <M3Sheet onClose={onClose}>
        <h3 style={{ ...TYPE.headlineS,color:T.ink,margin:"0 0 6px" }}>ใครกำลังเล่น?</h3>
        <p style={{ fontSize:12,color:T.ink2,margin:"0 0 14px" }}>แต่ละคนมีดาว เหรียญ สติกเกอร์ เพื่อนคู่หู แยกกัน · คำศัพท์ใช้ร่วมกัน</p>
        {profiles.list.map(pf => {
          const on = pf.id === profiles.current;
          return (
            <div key={pf.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:14,marginBottom:8,background:on?T.primaryC:T.surfHigh,border:`2px solid ${on?T.primary:"transparent"}` }}>
              <button onClick={() => { sfx.tap(); onSwitch(pf.id); }} style={{ flex:1,display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",minHeight:44,textAlign:"left",padding:0 }}>
                <span style={{ fontSize:30 }}>{pf.avatar}</span>
                <span style={{ fontWeight:800,fontSize:15,color:T.ink }}>{pf.name}</span>
                {on && <span style={{ fontSize:11,fontWeight:800,color:T.primary,background:T.card,padding:"2px 8px",borderRadius:999 }}>กำลังเล่น</span>}
              </button>
              {profiles.list.length > 1 && (
                <button onClick={() => { if (window.confirm(`ลบโปรไฟล์ "${pf.name}"?\\nดาว เหรียญ สติกเกอร์ของคนนี้จะหายทั้งหมด`)) onDelete(pf.id); }}
                  style={{ width:44,height:44,borderRadius:16,background:T.errorC,border:"none",cursor:"pointer",fontSize:16 }}>🗑️</button>
              )}
            </div>
          );
        })}
        {!adding ? (
          <button onClick={() => { sfx.tap(); setAdding(true); }} style={{ width:"100%",minHeight:48,borderRadius:14,border:"2px dashed #c4b5fd",background:T.card,color:T.primary,fontWeight:800,fontSize:14,cursor:"pointer",marginTop:4 }}>＋ เพิ่มคนใหม่</button>
        ) : (
          <div style={{ background:T.primaryC,borderRadius:16,padding:12,marginTop:4 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ (เช่น น้องมีนา)" maxLength={12} style={{ ...inputStyle,marginBottom:8 }} />
            <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10 }}>
              {AVATARS.map(a => <button key={a} onClick={() => { sfx.tap(); setAvatar(a); }} style={{ minHeight:48,borderRadius:16,fontSize:26,border:`2px solid ${avatar===a?T.primary:T.outlineV}`,background:avatar===a?T.primaryC:"#fff",cursor:"pointer" }}>{a}</button>)}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={() => { if (!name.trim()) return; sfx.coin(); onAdd(name.trim(), avatar); setAdding(false); setName(""); }} style={{ flex:1,minHeight:44,borderRadius:16,border:"none",background:T.primary,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer" }}>สร้าง ✓</button>
              <button onClick={() => setAdding(false)} style={{ flex:1,minHeight:44,borderRadius:16,border:"none",background:T.card,color:T.ink2,fontWeight:700,fontSize:14,cursor:"pointer" }}>ยกเลิก</button>
            </div>
          </div>
        )}
        <button onClick={onClose} style={{ width:"100%",minHeight:44,marginTop:12,borderRadius:16,background:T.surfHigh,color:T.ink2,fontWeight:700,fontSize:14,border:"none",cursor:"pointer" }}>✓ เสร็จสิ้น</button>
    </M3Sheet>
  );
}

// ═══════════════════════════════════════════════════════
// LEARNING PATH — แผนที่บทเรียน A1 → A2 ปลดล็อกทีละบท
// ═══════════════════════════════════════════════════════
function PathScreen({ units, progress, onStep }) {
  const path = progress.path || {};
  const firstOpen = units.findIndex(u => !unitDone(path, u));
  const [openId, setOpenId] = useState(firstOpen >= 0 ? units[firstOpen].id : units[0]?.id);
  const doneCount = units.filter(u => unitDone(path, u)).length;
  const LV = { A1: ["A1 · เริ่มต้น", T.ok], "A1+": ["A1+ · ต่อยอด", T.primary], A2: ["A2 · เก่งแล้ว", T.primary] };
  const STEP = { learn: ["📖", "เรียนการ์ด"], quiz: ["🏆", "ทำแบบทดสอบ"], listen: ["👂", "ฟังแล้วเลือก"] };
  return (
    <div style={{ padding:"14px 12px 60px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:16,position:"relative",overflow:"hidden" }}>
        <Shape kind="clover" size={160} fill={T.tertiaryC} spin style={{ position:"absolute",top:-60,right:-50,opacity:.9 }} />
        <div style={{ fontWeight:900,fontSize:20 }}>🗺️ เส้นทางบทเรียน</div>
        <div style={{ fontSize:13,opacity:0.9 }}>ผ่านแล้ว {doneCount}/{units.length} บท · บทละ 3 ขั้น เรียน → ทดสอบ → ฟัง</div>
        <div style={{ position:"relative",marginTop:10 }}><WavyProgress value={units.length?doneCount/units.length*100:0} height={14} color={T.primary} track={"color-mix(in oklab, var(--md-on-primary-container) 18%, transparent)"} /></div>
      </div>
      {units.map((u, i) => {
        const done = unitDone(path, u);
        const unlocked = i === 0 || unitDone(path, units[i - 1]);
        const steps = unitSteps(path, u);
        const open = openId === u.id;
        const showLv = i === 0 || units[i - 1].level !== u.level;
        const side = i % 2 === 0 ? "flex-start" : "flex-end";
        return (
          <div key={u.id}>
            {showLv && <div style={{ textAlign:"center",margin:"8px 0 12px" }}><span style={{ background:LV[u.level][1],color:"#fff",fontWeight:900,fontSize:12,padding:"4px 14px",borderRadius:999 }}>{LV[u.level][0]}</span></div>}
            <div style={{ display:"flex",justifyContent:open?"center":side,padding:"0 24px",marginBottom:10 }}>
              {!open ? (
                <button onClick={() => { if (!unlocked) { sfx.bad(); return; } sfx.tap(); setOpenId(u.id); }}
                  style={{ width:84,height:84,borderRadius:42,border:"none",cursor:unlocked?"pointer":"not-allowed",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,
                    background:done?T.ok:unlocked?u.cat.color:T.outlineV,color:"#fff",boxShadow:unlocked&&!done?`0 8px 20px ${u.cat.color}66`:"none",animation:unlocked&&!done?"vpBounce 1.6s infinite":"none" }}>
                  <span style={{ fontSize:30 }}>{done ? "✓" : unlocked ? u.cat.emoji : "🔒"}</span>
                  <span style={{ fontSize:10,fontWeight:800,opacity:0.95 }}>บท {u.n}</span>
                </button>
              ) : (
                <div style={{ width:"100%",background:T.card,borderRadius:20,padding:14,border:`2px solid ${u.cat.color}60`,boxShadow:"0 8px 24px rgba(0,0,0,0.08)" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                    <span style={{ fontSize:34 }}>{u.cat.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:900,fontSize:16,color:T.ink }}>บทที่ {u.n} · {u.cat.thai}</div>
                      <div style={{ fontSize:11,color:T.ink2 }}>{u.words.length} คำ: {u.words.slice(0,5).map(w=>w.word).join(", ")}{u.words.length>5?"…":""}</div>
                    </div>
                    <span style={{ fontSize:12,fontWeight:800,color:done?T.ok:T.ink3 }}>{steps}/3</span>
                  </div>
                  {UNIT_STEPS.map((s, k) => {
                    const sd = !!path[u.id]?.[s];
                    const prevDone = k === 0 || !!path[u.id]?.[UNIT_STEPS[k - 1]];
                    return (
                      <button key={s} onClick={() => { if (!unlocked || !prevDone) { sfx.bad(); return; } sfx.tap(); onStep(u, s); }}
                        style={{ width:"100%",minHeight:52,borderRadius:14,marginBottom:6,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:10,padding:"0 12px",textAlign:"left",
                          background:sd?T.okC:prevDone&&unlocked?T.primaryC:T.surfHigh,color:sd?T.onOkC:prevDone&&unlocked?T.primary:T.ink3 }}>
                        <span style={{ fontSize:22 }}>{sd ? "✅" : prevDone && unlocked ? STEP[s][0] : "🔒"}</span>
                        <span style={{ flex:1,fontWeight:800,fontSize:14 }}>{k+1}. {STEP[s][1]}</span>
                        <span style={{ fontSize:18,opacity:0.5 }}>›</span>
                      </button>
                    );
                  })}
                  {done && <div style={{ textAlign:"center",fontSize:12,color:"#059669",fontWeight:800,marginTop:4 }}>🎉 ผ่านบทนี้แล้ว เล่นซ้ำได้</div>}
                </div>
              )}
            </div>
            {i < units.length - 1 && !open && <div style={{ textAlign:"center",color:T.outlineV,fontSize:18,lineHeight:1,marginBottom:6 }}>⋮</div>}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// INSTALL BANNER — ติดตั้งเป็นแอป (PWA) · Android ใช้ prompt · iPhone บอกวิธี
// ═══════════════════════════════════════════════════════
function InstallBanner({ deferred, onInstall, onDismiss }) {
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone || (!deferred && !ios)) return null;
  return (
    <div style={{ background:T.secondaryC,color:T.onSecondaryC,borderRadius:24,padding:"10px 12px",marginBottom:14,display:"flex",alignItems:"center",gap:10 }}>
      <Shape kind="cookie9" size={44} fill={T.primaryC}><span style={{ fontSize:22 }}>📲</span></Shape>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ ...TYPE.titleS }}>ติดตั้งลงหน้าจอมือถือ เล่นออฟไลน์ได้</div>
        <div style={{ ...TYPE.bodyS,opacity:.85 }}>{deferred ? "เปิดเร็วเหมือนแอป ไม่ต้องพิมพ์ลิงก์" : "Safari: แตะปุ่มแชร์ ⬆️ แล้วเลือก \"เพิ่มไปยังหน้าจอโฮม\""}</div>
      </div>
      {deferred && <button onClick={onInstall} className="m3-press" style={M3.filled({ minHeight:44,padding:"0 16px",fontSize:13 })}>ติดตั้ง</button>}
      <button onClick={onDismiss} aria-label="ปิด" style={M3.iconBtn({ width:44,height:44,color:T.onSecondaryC })}>✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREDITS — ที่มาและสัญญาอนุญาตของรูปจาก Wikimedia Commons (public/img/credits.json)
// ═══════════════════════════════════════════════════════
function CreditsScreen({ words }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}img/credits.json`).then(r => r.json()).catch(() => ({})),
      fetch(`${import.meta.env.BASE_URL}audio/credits.json`).then(r => r.json()).catch(() => ({})),
    ]).then(([img, au]) => setList([...Object.entries(img), ...Object.entries(au).map(([w, c]) => [w, { ...c, audio: true }])])).catch(() => setList([]));
  }, []);
  const wordOf = title => words.find(w => imageTitleOf(w) === title);
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:560,margin:"0 auto" }}>
      <div style={{ background:T.card,borderRadius:16,padding:14,border:"none",marginBottom:12,fontSize:13,color:T.ink2,lineHeight:1.6 }}>
        รูปถ่ายและเสียงอ่านคำศัพท์มาจาก <b>Wikipedia / Wikimedia Commons</b> ภายใต้สัญญาอนุญาตแบบเปิด (CC BY / CC BY-SA / สาธารณสมบัติ ฯลฯ) ผู้สร้างและสัญญาอนุญาตของแต่ละรายการอยู่ด้านล่าง (🔊 = ไฟล์เสียง) · แตะเพื่อเปิดหน้าต้นทาง
      </div>
      <div style={{ background:T.card,borderRadius:16,padding:14,marginBottom:12,fontSize:12,color:T.ink2,lineHeight:1.6 }}>
        <b style={{ color:T.ink }}>โมเดล 3 มิติในเกม Word Runner 3D</b><br/>
        🦊 Fox — model by PixelMannen (CC0), rigging &amp; animation by tomkranis (CC-BY 4.0), glTF conversion by AsoboStudio &amp; scurest (CC-BY 4.0) · จาก KhronosGroup glTF-Sample-Assets<br/>
        🤖 RobotExpressive — model by Tomás Laulhé (Quaternius), modifications by Don McCurdy (CC0 1.0) · จากตัวอย่าง three.js<br/>
        🐕🦌🐴🐰🦝 Shiba Inu, Deer, Horse, Platformer Character, Rae the Red Panda — models by Quaternius (quaternius.com, CC0) · 🧙 Mage — KayKit by Kay Lousberg (kaylousberg.com, CC0)<br/>
        🌄 ท้องฟ้า HDRI · พื้นผิว PBR · หิน พุ่มไม้ เฟิร์น เสาไฟ ม้านั่ง ผลไม้ — จาก <b>Poly Haven</b> (polyhaven.com) สัญญาอนุญาต CC0 · เอนจิน three.js (MIT)
      </div>
      {list === null && <div style={{ textAlign:"center",color:T.ink3 }}>กำลังโหลด…</div>}
      {list && list.length === 0 && <div style={{ textAlign:"center",color:T.ink3 }}>ยังไม่มีรายการ</div>}
      {list && list.map(([title, c]) => {
        const w = c.audio ? words.find(x => x.word.toLowerCase() === title) : wordOf(title);
        return (
          <a key={(c.audio ? "a:" : "i:") + title} href={c.source || c.page || "#"} target="_blank" rel="noreferrer" style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid var(--md-outline-variant)",textDecoration:"none",color:"inherit",minHeight:44 }}>
            {c.audio ? <div style={{ width:44,height:33,borderRadius:6,flexShrink:0,background:T.secondaryC,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🔊</div>
              : c.file && <img src={`${import.meta.env.BASE_URL}img/${c.file}`} alt="" loading="lazy" style={{ width:44,height:33,objectFit:"cover",borderRadius:6,flexShrink:0 }} />}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:800,fontSize:13,color:T.ink }}>{w ? `${w.emoji} ${w.word}` : title} <span style={{ fontWeight:500,color:T.ink3 }}>· {title}</span></div>
              <div style={{ fontSize:11,color:T.ink2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{c.artist || "—"} · {c.license || "ดูที่ต้นทาง"}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CONTENT HELPERS — หาคำจาก key "หมวด|คำ" หรือรายการ inline "WORD|ไทย|อีโมจิ"
// ═══════════════════════════════════════════════════════
function wordByKey(words, key) {
  if (!key) return null;
  const parts = key.split("|");
  if (parts.length === 3) return { id: `x:${parts[0]}`, word: parts[0], meaning: parts[1], emoji: parts[2], cat: "x" };
  if (parts.length === 2) return words.find(w => w.cat === parts[0] && w.word === parts[1]) || null;
  return null;
}
// กล่องรูปขนาดกำหนด: รูปจริงเต็มกล่อง (contain + พื้นเบลอ) ใช้เป็นรูปหลัก/รูปตัวเลือกขนาดใหญ่
function PicBox({ w, h = "min(30vh, 280px)", r = 22, style = {}, emojiSize = 64 }) {
  return <span style={{ position:"relative",display:"block",width:"100%",height:h,borderRadius:r,overflow:"hidden",background:T.surfHigh,...style }}><PicFill w={w} emojiSize={emojiSize} /></span>;
}
function picOf(words, key, size) {
  const w = wordByKey(words, key);
  if (w) return <Pic w={w} size={size} radius={16} />;
  return <span style={{ fontSize:size }}>{key}</span>;
}
// หาคำศัพท์จาก token ในประโยค (ตัดเครื่องหมาย · ตัด s ท้ายคำ)
// หารูปประกอบประโยค: เลือกคำนามที่มีรูป (ไล่จากท้ายประโยค ข้ามกริยา/คุณศัพท์) · ไม่เจอ → คำใดก็ได้ที่มีรูป
const NON_NOUN = new Set(["actions","opposites","feelings","numbers","time"]);
function sentencePic(words, text) {
  const toks = (text || "").replace(/[()]/g, " ").split(/\s+/).filter(t => t && t !== "___").reverse();
  let any = null;
  for (const t of toks) { const w = lookupToken(words || [], t); if (!w || !imageTitleOf(w)) continue; if (!NON_NOUN.has(w.cat)) return w; any = any || w; }
  return any;
}
function lookupToken(words, tok) {
  const t = tok.replace(/[^A-Za-z'-]/g, "").toUpperCase();
  if (!t) return null;
  const cands = [t, t.replace(/S$/, ""), t.replace(/ES$/, ""), t.replace(/IES$/, "Y"), t.replace(/ING$/, ""), t.replace(/ED$/, "")];
  for (const c of cands) { const w = words.find(x => x.word === c); if (w) return w; }
  return null;
}

// ═══════════════════════════════════════════════════════
// TALK — รายการบทสนทนา
// ═══════════════════════════════════════════════════════
function TalkScreen({ words, progress, onOpen }) {
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>💬 บทสนทนาในชีวิตจริง</div>
        <div style={{ fontSize:13,opacity:0.9 }}>{DIALOGUES.length} สถานการณ์ · ฟัง → เล่นบทบาท (พูดเอง) → เติมคำ</div>
      </div>
      {DIALOGUES.map(d => {
        const done = ["droleplay","dfill"].filter(g => (progress.stars[`dialog:${d.id}:${g}`] || 0) >= 1).length;
        return (
          <button key={d.id} onClick={() => { sfx.tap(); onOpen(d); }}
            style={{ width:"100%",minHeight:104,background:T.card,border:"none",borderRadius:20,padding:6,marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ position:"relative",width:"34%",height:92,borderRadius:16,overflow:"hidden",flexShrink:0,background:T.surfHigh }}>{wordByKey(words, d.scene) ? <PicFill w={wordByKey(words, d.scene)} emojiSize={36} /> : <span style={{ fontSize:36 }}>{d.emoji}</span>}</div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:800,fontSize:15,color:T.ink }}>{d.emoji} {d.title}</div>
              <div style={{ fontSize:12,color:T.ink2 }}>{d.titleTh} · {d.lines.length} ประโยค</div>
            </div>
            <span style={{ fontSize:12,fontWeight:800,color:done===2?T.ok:T.ink3 }}>{done===2?"✓ ครบ":`${done}/2`}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DIALOGUE — 3 โหมด: ฟัง · เล่นบทบาท · เติมคำ
// ═══════════════════════════════════════════════════════
function DialogueScreen({ d, words, speak, speakAt, speakSeq, showToast, progress, setProgress, onBack }) {
  const [mode, setMode] = useState("listen");
  const [role, setRole] = useState(null);
  const cat = useMemo(() => ({ id:`dialog:${d.id}`, label:d.title, thai:d.titleTh, emoji:d.emoji, color:T.tertiary, games:["droleplay","dfill"], dialog:d, role }), [d, role]);
  const vocab = useMemo(() => { const set = new Set(); d.lines.forEach(l => l.en.split(" ").forEach(t => { const w = lookupToken(words, t); if (w) set.add(w); })); return [...set]; }, [d, words]);
  const tabs = [["listen","👂 ฟัง"],["roleplay","🎭 เล่นบทบาท"],["fill","🧩 เติมคำ"]];
  const nameOf = who => (who === "A" ? d.a : d.b);
  return (
    <div style={{ padding:"10px 10px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.tertiaryC,borderRadius:24,padding:8,marginBottom:10 }}>
        {wordByKey(words, d.scene) && <PicBox w={wordByKey(words, d.scene)} h="min(31vh, 290px)" r={18} />}
        <div style={{ padding:"8px 6px 2px" }}><div style={{ fontWeight:900,fontSize:16,color:T.ink }}>{d.emoji} {d.title}</div><div style={{ fontSize:12,color:T.ink2 }}>{d.titleTh} · {nameOf("A")} กับ {nameOf("B")}</div></div>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:10 }}>
        {tabs.map(([k,l]) => <button key={k} onClick={() => { sfx.tap(); setMode(k); }} style={{ flex:1,minHeight:44,borderRadius:16,border:"none",fontWeight:800,fontSize:13,cursor:"pointer",background:mode===k?T.tertiary:T.surfHigh,color:mode===k?"#fff":T.ink2 }}>{l}</button>)}
      </div>

      {mode === "listen" && (
        <div>
          <button onClick={() => speakSeq(d.lines.map(l => ({ en:l.en, th:l.th })))} style={{ width:"100%",minHeight:48,borderRadius:14,border:"none",background:T.ink,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",marginBottom:10 }}>▶ ฟังทั้งบทสนทนา</button>
          {d.lines.map((l, i) => {
            const left = l.who === "A";
            return (
              <div key={i} style={{ display:"flex",justifyContent:left?"flex-start":"flex-end",marginBottom:8 }}>
                <button onClick={() => speak(l.en, l.th)} style={{ maxWidth:"85%",textAlign:"left",border:"none",cursor:"pointer",borderRadius:left?"4px 18px 18px 18px":"18px 4px 18px 18px",padding:"10px 14px",minHeight:44,background:left?"#fff":T.tertiaryC,boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize:10,fontWeight:800,color:left?T.tertiary:T.onTertiaryC,marginBottom:2 }}>{nameOf(l.who)} 🔊</div>
                  <div style={{ fontSize:15,fontWeight:700,color:T.ink }}>{l.en}</div>
                  <div style={{ fontSize:12,color:T.ink2,marginTop:2 }}>{l.th}</div>
                </button>
              </div>
            );
          })}
          {vocab.length > 0 && <div style={{ marginTop:12,background:T.card,borderRadius:16,padding:12,border:"none" }}>
            <div style={{ fontWeight:800,fontSize:13,color:T.ink,marginBottom:6 }}>คำศัพท์ในบทนี้ ({vocab.length})</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
              {vocab.map(w => <button key={w.id} onClick={() => speak(w.word, w.meaning)} style={{ minHeight:44,borderRadius:999,border:"1px solid var(--md-outline-variant)",background:T.surfHigh,padding:"0 12px",fontSize:13,fontWeight:700,color:T.ink2,cursor:"pointer" }}>{w.emoji} {w.word} <span style={{ color:T.ink3,fontWeight:500 }}>{w.meaning}</span></button>)}
            </div>
          </div>}
        </div>
      )}

      {mode === "roleplay" && !role && (
        <div style={{ background:T.card,borderRadius:18,padding:16,textAlign:"center",border:"none" }}>
          <div style={{ fontWeight:900,fontSize:16,color:T.ink,marginBottom:4 }}>🎭 หนูจะเป็นใคร?</div>
          <div style={{ fontSize:12,color:T.ink2,marginBottom:12 }}>แอปจะพูดอีกฝ่าย ส่วนประโยคของหนูต้องพูดเองใส่ไมค์ 🎤</div>
          <div style={{ display:"flex",gap:10 }}>
            {["A","B"].map(r => <button key={r} onClick={() => { sfx.tap(); setRole(r); }} style={{ flex:1,minHeight:64,borderRadius:16,border:"2px solid #fed7aa",background:T.tertiaryC,fontWeight:900,fontSize:16,color:T.onTertiaryC,cursor:"pointer" }}>{r === "A" ? "🅰️" : "🅱️"} {nameOf(r)}</button>)}
          </div>
        </div>
      )}
      {mode === "roleplay" && role && (
        <GameRouter key={role} gameId="droleplay" cat={cat} words={vocab.length >= 4 ? vocab : words.slice(0, 8)} speak={speak} speakAt={speakAt} showToast={showToast}
          onBack={() => setRole(null)} progress={progress} setProgress={setProgress} allWords={words} />
      )}
      {mode === "fill" && (
        <GameRouter gameId="dfill" cat={cat} words={vocab.length >= 4 ? vocab : words.slice(0, 8)} speak={speak} speakAt={speakAt} showToast={showToast}
          onBack={() => setMode("listen")} progress={progress} setProgress={setProgress} allWords={words} />
      )}
    </div>
  );
}

// เล่นบทบาท: แอปพูดอีกฝ่าย · ประโยคของเราพูดใส่ไมค์ (ไม่มีไมค์ → แตะ "พูดแล้ว")
function RolePlayGame({ cat, speak, track, onBack }) {
  const d = cat.dialog, role = cat.role;
  const [i, setI] = useState(0);
  const [st, setSt] = useState("idle");
  const [heard, setHeard] = useState("");
  const [pct, setPct] = useState(0);
  const [score, setScore] = useState(0);
  const [gotIt, setGotIt] = useState(false);
  const line = d.lines[i];
  const mine = line.who === role;
  const myTotal = d.lines.filter(l => l.who === role).length;
  const nameOf = who => (who === "A" ? d.a : d.b);
  const next = () => {
    if (i + 1 < d.lines.length) { setI(i + 1); setSt("idle"); setHeard(""); setPct(0); setGotIt(false); }
    else track.finish(score, myTotal, { label:`พูดได้ ${score}/${myTotal} ประโยค` });
  };
  const listen = () => {
    if (!SR) { if (!gotIt) { setGotIt(true); setScore(s => s + 1); sfx.ok(); } setSt("ok"); return; }
    try {
      const r = new SR(); r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 5;
      const target = line.en.toLowerCase().replace(/[^a-z ]/g, "").trim();
      r.onresult = e => {
        const alts = [...e.results[0]].map(a => a.transcript.toLowerCase().replace(/[^a-z ]/g, "").trim());
        setHeard(alts[0] || "");
        const best = Math.max(...alts.map(a => similarity(a.replace(/ /g, ""), target.replace(/ /g, ""))));
        setPct(Math.round(best * 100));
        if (best >= 0.6) { setSt("ok"); if (!gotIt) { setGotIt(true); setScore(s => s + 1); sfx.ok(); } }
        else { setSt("no"); sfx.bad(); }
      };
      r.onerror = () => setSt("no"); r.onend = () => setSt(s => (s === "listening" ? "no" : s));
      r.start(); setSt("listening"); setHeard("");
    } catch (_) { setSt("no"); }
  };
  return (
    <GameCard>
      <Bar left={`🎭 ${i+1}/${d.lines.length}`} right={`⭐${score}/${myTotal}`} />
      <div style={GS.body}>
        {/* บทก่อนหน้า (ย่อ) */}
        {i > 0 && <div style={{ fontSize:11,color:T.ink3,marginBottom:8,textAlign:d.lines[i-1].who==="A"?"left":"right" }}>{nameOf(d.lines[i-1].who)}: {d.lines[i-1].en}</div>}
        <div style={{ background:mine?T.tertiaryC:"#fff",border:`2px solid ${mine?T.tertiary:T.outlineV}`,borderRadius:18,padding:14,marginBottom:10 }}>
          <div style={{ fontSize:11,fontWeight:800,color:mine?T.onTertiaryC:T.tertiary,marginBottom:4 }}>{mine ? `🫵 ตาหนู (${nameOf(role)}) พูดว่า:` : `${nameOf(line.who)} พูด:`}</div>
          <div style={{ fontSize:18,fontWeight:800,color:T.ink }}>{line.en}</div>
          <div style={{ fontSize:13,color:T.ink2,marginTop:2 }}>{line.th}</div>
        </div>
        {!mine ? (
          <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
            <Pill onClick={() => speak(line.en, null)} bg={T.primary}>🔊 ฟัง</Pill>
            <Pill onClick={next} bg={T.ok}>ถัดไป ›</Pill>
          </div>
        ) : (
          <div style={{ textAlign:"center" }}>
            <SndBtn onClick={() => speak(line.en, null)} />
            <button onClick={listen} disabled={st === "listening"}
              style={{ width:96,height:96,borderRadius:48,margin:"0 auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,background:st==="listening"?T.error:st==="ok"?T.ok:T.grad,border:"none",cursor:"pointer",boxShadow:"0 8px 24px rgba(239,68,68,0.3)",animation:st==="listening"?"vpBounce .6s infinite":"none" }}>
              {st === "ok" ? "✅" : "🎤"}
            </button>
            <p style={{ fontSize:13,fontWeight:700,margin:"0 0 8px",color:st==="ok"?T.ok:st==="no"?T.error:T.ink2 }}>
              {st === "idle" && (SR ? "แตะไมค์แล้วพูดประโยคนี้" : "เครื่องนี้ไม่มีไมค์สำหรับเช็คเสียง · พูดออกเสียงแล้วแตะปุ่มด้านบน")}
              {st === "listening" && "กำลังฟัง..."}
              {st === "ok" && (pct ? `เยี่ยม! ใกล้เคียง ${pct}% 👏` : "เยี่ยม! 👏")}
              {st === "no" && (heard ? `ได้ยินว่า "${heard}" (${pct}%) ลองอีกที` : "ไม่ได้ยิน ลองพูดดังๆ")}
            </p>
            <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
              {st === "no" && <Pill onClick={listen} bg={T.tertiary}>🎤 ลองอีก</Pill>}
              <Pill onClick={next} bg={gotIt ? T.ok : T.ink3}>{gotIt ? "ถัดไป ›" : "ข้าม ›"}</Pill>
            </div>
          </div>
        )}
      </div>
    </GameCard>
  );
}

// เติมคำ: ประโยคเว้นช่อง เลือกคำจาก 3 ตัวเลือก (ตัวหลอกมาจากช่องว่างประโยคอื่นในบทเดียวกัน)
// ตัวเลือกที่เป็นข้อความ (นิทาน/บทสนทนา): ถ้าทุกตัวเลือกหารูปได้ → แสดงเป็นรูป (เด็กที่อ่านไม่ออกเล่นได้) · ตัวหนังสือโชว์หลังตอบ
function picForText(words, text) {
  const toks = (text || "").replace(/[()?!.,]/g, " ").split(/\s+/).filter(Boolean).reverse();
  for (const t of toks) { const w = lookupToken(words || [], t); if (w && (imageTitleOf(w) || conceptFor(w))) return w; }
  return null;
}
function ChoiceList({ opts, answer, picked, onPick, allWords, cols = 1, tone = "primary" }) {
  const pics = opts.map(o => picForText(allWords, o));
  const usePics = pics.every(Boolean) && new Set(pics.map(w => w.id)).size === pics.length;
  const C = tone === "tertiary" ? { bg:T.tertiaryC, bo:T.tertiary, c:T.onTertiaryC } : { bg:T.primaryC, bo:T.primaryC, c:T.primary };
  return <div style={{ display:"grid",gridTemplateColumns:usePics ? (opts.length === 3 ? "1fr 1fr 1fr" : "1fr 1fr") : `repeat(${cols},1fr)`,gap:8 }}>
    {opts.map((o, k) => {
      const ic = o === answer, ip = picked === o;
      let { bg, bo, c } = C;
      if (picked && ic) { bg = T.okC; bo = T.ok; c = T.onOkC; }
      if (picked && ip && !ic) { bg = T.errorC; bo = T.error; c = T.onErrorC; }
      if (usePics) return <button key={o} data-ok={ic ? "1" : undefined} onClick={() => onPick(o)} disabled={!!picked} aria-label={picked ? o : "รูปตัวเลือก"} style={{ display:"flex",flexDirection:"column",padding:0,borderRadius:16,border:`3px solid ${bo}`,background:bg,color:c,overflow:"hidden",cursor:"pointer" }}>
        <span style={{ position:"relative",display:"block",width:"100%",aspectRatio:"4/3" }}><PicFill w={pics[k]} emojiSize={40} /></span>
        {picked && <span style={{ fontWeight:800,fontSize:14,padding:"4px 2px" }}>{o}</span>}
      </button>;
      return <button key={o} data-ok={ic ? "1" : undefined} onClick={() => onPick(o)} disabled={!!picked} style={{ minHeight:50,borderRadius:16,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:800,fontSize:16,cursor:"pointer",padding:"0 14px" }}>{o}</button>;
    })}
  </div>;
}
function FillGame({ cat, speak, track, onBack, allWords }) {
  const d = cat.dialog;
  const qs = useMemo(() => shuffle(d.lines.filter(l => l.blank)).slice(0, 8), [d]);
  const allBlanks = useMemo(() => [...new Set(d.lines.filter(l => l.blank).map(l => l.blank))], [d]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const q = qs[i];
  const opts = useMemo(() => q ? shuffle([q.blank, ...shuffle(allBlanks.filter(b => b.toLowerCase() !== q.blank.toLowerCase())).slice(0, 2)]) : [], [i, q]);
  if (!q) return <NoWords onBack={onBack} />;
  const parts = q.en.split(new RegExp(`\\b${q.blank}\\b`));
  const pick = o => {
    if (picked) return;
    setPicked(o);
    const ok = o === q.blank;
    if (ok) { setScore(s => s + 1); track.correct(null); speak(q.en, q.th); } else track.wrong(null);
    afterSpeech(() => { if (i + 1 < qs.length) { setI(i + 1); setPicked(null); } else track.finish(ok ? score + 1 : score, qs.length); }, 1300);
  };
  return (
    <GameCard>
      <Bar left={`🧩 ${i+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ fontSize:11,fontWeight:800,color:T.tertiary,marginBottom:4 }}>{q.who === "A" ? d.a : d.b} พูดว่า:</div>
        <div style={{ fontSize:19,fontWeight:800,color:T.ink,lineHeight:1.5,marginBottom:4 }}>
          {parts[0]}<span style={{ display:"inline-block",minWidth:70,borderBottom:"3px solid #f59e0b",color:picked?(picked===q.blank?T.ok:T.error):T.tertiary,textAlign:"center",padding:"0 4px" }}>{picked || "______"}</span>{parts[1]}
        </div>
        <div style={{ fontSize:13,color:T.ink2,marginBottom:12 }}>{q.th}</div>
        <ChoiceList opts={opts} answer={q.blank} picked={picked} onPick={pick} allWords={allWords} tone="tertiary" />
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// STORIES — รายการนิทาน + ตัวอ่าน (แตะคำเพื่อดูความหมาย) + คำถามท้ายเรื่อง
// ═══════════════════════════════════════════════════════
function StoriesScreen({ words, progress, onOpen }) {
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>📖 นิทานภาพ</div>
        <div style={{ fontSize:13,opacity:0.9 }}>{STORIES.length} เรื่อง · อ่านพร้อมเสียง · แตะคำที่ไม่รู้ · ตอบคำถามท้ายเรื่อง</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {STORIES.map(s => {
          const done = (progress.stars[`story:${s.id}:squiz`] || 0) >= 1;
          return (
            <button key={s.id} onClick={() => { sfx.tap(); onOpen(s); }} style={{ background:T.card,border:"none",borderRadius:18,padding:10,cursor:"pointer",textAlign:"left",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",minHeight:160,display:"flex",flexDirection:"column",gap:6 }}>
              <div style={{ width:"100%",aspectRatio:"4/3",borderRadius:16,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:T.surfHigh,position:"relative" }}>
                <PicFill w={wordByKey(words, s.cover || s.pages[0].pic) || { emoji:s.emoji, word:s.title }} emojiSize={40} />
                {done && <span style={{ position:"absolute",top:6,right:6,background:T.ok,color:"#fff",fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:999 }}>✓ อ่านแล้ว</span>}
              </div>
              <div style={{ fontWeight:800,fontSize:14,color:T.ink }}>{s.emoji} {s.title}</div>
              <div style={{ fontSize:11,color:T.ink2 }}>{s.titleTh} · {s.pages.length} หน้า · {s.level}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StoryReader({ s, words, speak, speakAt, showToast, progress, setProgress, onBack }) {
  const [i, setI] = useState(0);
  const [showTh, setShowTh] = useState(true);
  const [popup, setPopup] = useState(null);   // คำที่แตะ
  const [quiz, setQuiz] = useState(false);
  const [auto, setAuto] = useState(false);   // กำลังอ่านทั้งเรื่องอัตโนมัติ
  const page = s.pages[i];
  const cat = useMemo(() => ({ id:`story:${s.id}`, label:s.title, thai:s.titleTh, emoji:s.emoji, color:T.primary, games:["squiz"], story:s }), [s]);
  useEffect(() => () => { try { if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel(); } catch (_) {} }, []);
  // อ่านทั้งเรื่องต่อเนื่อง: คิวทุกหน้าทันทีใน onClick (กฎ iOS) · onstart ของแต่ละหน้า → เปลี่ยนหน้า/ไฮไลต์ · จบ → ปิดโหมด
  const readAll = (from = 0) => {
    const pages = s.pages.slice(from);
    const segs = pages.flatMap(pg => showTh ? [clipUrl(pg.en), clipUrl(pg.th)] : [clipUrl(pg.en)]);
    if (segs.length && segs.every(Boolean)) {   // เสียง neural ครบ → เล่นไฟล์ต่อกัน เปลี่ยนหน้าตอนเริ่มแต่ละหน้า
      try { window.speechSynthesis?.cancel(); } catch (_) {}
      setAuto(true); setPopup(null); const per = showTh ? 2 : 1;
      playClips(segs, { rate: 1, onStart: i => setI(from + Math.floor(i / per)), onDone: () => setAuto(false) });
      return;
    }
    const ss = window.speechSynthesis; if (!ss) return;
    ss.cancel(); setAuto(true); setPopup(null);
    pages.forEach((pg, k) => {
      const u = new SpeechSynthesisUtterance(pg.en); u.lang = "en-US"; u.rate = 0.82; const v = getVoice("en"); if (v) u.voice = v;
      u.onstart = () => setI(from + k);
      if (k === pages.length - 1 && !showTh) u.onend = () => setAuto(false);
      ss.speak(u);
      if (showTh) { const t = new SpeechSynthesisUtterance(pg.th); t.lang = "th-TH"; t.rate = 0.9; const tv = getVoice("th"); if (tv) t.voice = tv; if (k === pages.length - 1) t.onend = () => setAuto(false); ss.speak(t); }
    });
  };
  const stopAll = () => { try { window.speechSynthesis?.cancel(); } catch (_) {} stopNative(); setAuto(false); };
  if (quiz) return <GameRouter gameId="squiz" cat={cat} words={words.slice(0, 8)} speak={speak} speakAt={speakAt} showToast={showToast} onBack={onBack} progress={progress} setProgress={setProgress} allWords={words} />;
  const tokens = page.en.split(" ");
  return (
    <div style={{ padding:"10px 10px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:700,color:T.ink2,padding:"0 4px 8px" }}>
        <span>{s.emoji} {s.title}</span><span>หน้า {i+1}/{s.pages.length}</span>
      </div>
      <div style={{ height:6,background:T.surfHigh,borderRadius:999,marginBottom:10,overflow:"hidden" }}><div style={{ height:"100%",width:`${((i+1)/s.pages.length)*100}%`,background:T.primary,borderRadius:999,transition:"width .3s" }} /></div>
      <button onClick={() => { sfx.tap(); if (auto) stopAll(); else readAll(i); }} className="m3-press" style={{ ...(auto ? M3.tonal({ width:"100%",minHeight:52,marginBottom:10 }) : M3.filled({ width:"100%",minHeight:52,marginBottom:10 })) }}>
        {auto ? "⏹ หยุดอ่าน" : `▶ ฟังทั้งเรื่อง${i > 0 ? ` (ต่อจากหน้า ${i + 1})` : ""}`}
      </button>
      <div style={{ background:T.card,borderRadius:22,overflow:"hidden",boxShadow:"0 8px 28px rgba(0,0,0,0.08)",border:"none",outline:auto?`3px solid ${MD.primary}`:"none",transition:"outline .2s" }}>
        <div style={{ width:"100%",aspectRatio:"4/3",position:"relative",background:T.surfHigh,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <PicFill w={wordByKey(words, page.pic) || { emoji:page.pic, word:"" }} emojiSize={80} />
          {auto && <span style={{ position:"absolute",top:8,left:8,...M3.assist({ minHeight:30,fontSize:12,background:MD.primary,color:MD.onPrimary }) }}>🔊 กำลังอ่าน · หน้า {i + 1}/{s.pages.length}</span>}
        </div>
        <div style={{ padding:"14px 16px 10px" }}>
          <div style={{ fontSize:20,fontWeight:800,color:T.ink,lineHeight:1.6 }}>
            {tokens.map((t, k) => {
              const w = lookupToken(words, t);
              return <span key={k}>{w
                ? <button onClick={() => { sfx.tap(); setPopup(w); speak(w.word, w.meaning); }} style={{ background:"none",border:"none",padding:0,font:"inherit",color:T.primary,textDecoration:"underline dotted",cursor:"pointer",minHeight:44 }}>{t}</button>
                : t}{" "}</span>;
            })}
          </div>
          {showTh && <div style={{ fontSize:14,color:T.ink2,marginTop:6 }}>{page.th}</div>}
          {popup && (
            <div style={{ marginTop:10,background:T.primaryC,borderRadius:14,padding:"8px 12px",display:"flex",alignItems:"center",gap:10 }}>
              <Pic w={popup} size={20} radius={8} />
              <div style={{ flex:1 }}><b style={{ color:T.ink }}>{popup.word}</b> <span style={{ color:T.primary,fontSize:12 }}>{popup.read}</span><div style={{ fontSize:13,color:T.ink2 }}>{popup.meaning}</div></div>
              <button onClick={() => setPopup(null)} style={{ width:44,height:44,border:"none",background:"transparent",color:T.ink3,fontSize:18,cursor:"pointer" }}>✕</button>
            </div>
          )}
        </div>
        <div style={{ display:"flex",gap:6,padding:"0 12px 12px" }}>
          <button onClick={() => speak(page.en, showTh ? page.th : null)} style={{ flex:1,minHeight:44,borderRadius:16,border:"none",background:T.primaryC,color:T.onPrimaryC,fontWeight:800,fontSize:13,cursor:"pointer" }}>🔊 อ่านหน้านี้</button>
          <button onClick={() => speakAt(page.en, null, 0.6)} style={{ flex:1,minHeight:44,borderRadius:16,border:"none",background:T.surfHigh,color:T.ink2,fontWeight:800,fontSize:13,cursor:"pointer" }}>🐢 ช้าๆ</button>
          <button onClick={() => { sfx.tap(); setShowTh(v => !v); }} style={{ minWidth:44,minHeight:44,borderRadius:16,border:"none",background:showTh?T.tertiaryC:T.surfHigh,color:T.onTertiaryC,fontWeight:800,fontSize:13,cursor:"pointer" }}>ไทย</button>
        </div>
      </div>
      <div style={{ display:"flex",gap:8,marginTop:12 }}>
        <button onClick={() => { sfx.tap(); stopAll(); setPopup(null); setI(Math.max(0, i - 1)); }} disabled={i === 0} style={{ flex:1,minHeight:50,borderRadius:14,border:"none",background:i===0?T.surfHigh:"#fff",color:i===0?T.outlineV:T.ink2,fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>‹ ก่อนหน้า</button>
        {i + 1 < s.pages.length
          ? <button onClick={() => { sfx.tap(); stopAll(); setPopup(null); setI(i + 1); }} style={{ flex:2,minHeight:50,borderRadius:14,border:"none",background:T.primary,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer" }}>หน้าถัดไป ›</button>
          : <button onClick={() => { sfx.coin(); setQuiz(true); }} style={{ flex:2,minHeight:50,borderRadius:14,border:"none",background:T.ok,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer" }}>🎯 ตอบคำถามท้ายเรื่อง</button>}
      </div>
      <p style={{ textAlign:"center",fontSize:11,color:T.ink3,marginTop:10 }}>แตะคำสีม่วงเพื่อฟังและดูความหมาย</p>
    </div>
  );
}

// คำถามท้ายเรื่อง 3 ข้อ
function StoryQuizGame({ cat, speak, track, onBack, allWords }) {
  const s = cat.story;
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const q = s.quiz[i];
  const opts = useMemo(() => shuffle(q.options), [i]);
  const pick = o => {
    if (picked) return; setPicked(o);
    const ok = o === q.answer;
    if (ok) { setScore(x => x + 1); track.correct(null); } else track.wrong(null);
    afterSpeech(() => { if (i + 1 < s.quiz.length) { setI(i + 1); setPicked(null); } else track.finish(ok ? score + 1 : score, s.quiz.length, { label:`ตอบถูก ${ok ? score + 1 : score}/${s.quiz.length} ข้อ` }); }, 1100);
  };
  return (
    <GameCard>
      <Bar left={`🎯 ข้อ ${i+1}/${s.quiz.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ fontSize:12,color:T.ink3,marginBottom:4 }}>{s.emoji} {s.title}</div>
        <div style={{ fontSize:18,fontWeight:800,color:T.ink }}>{q.q}</div>
        <div style={{ fontSize:13,color:T.ink2,marginBottom:10 }}>{q.qTh}</div>
        <SndBtn onClick={() => speak(q.q, q.qTh)} />
        <ChoiceList opts={opts} answer={q.answer} picked={picked} onPick={pick} allWords={allWords} />
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// PHONICS — ตัวอักษร A–Z เสียง + คำตัวอย่าง + เกมเสียงแรก
// ═══════════════════════════════════════════════════════
function PhonicsScreen({ words, speak, speakAt, showToast, progress, setProgress, onGame }) {
  const [sel, setSel] = useState(PHONICS[0]);
  const ex = sel.words.map(k => wordByKey(words, k)).filter(Boolean);
  const best = progress.stars["phonics:all:phonics"] || 0;
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:12 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>🔤 โฟนิกส์ A–Z</div>
        <div style={{ fontSize:13,opacity:0.9 }}>รู้เสียงของตัวอักษร → อ่านคำใหม่ได้เอง · แตะตัวอักษรเพื่อฟังชื่อและเสียง</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:12 }}>
        {PHONICS.map(p => <button key={p.L} onClick={() => { sfx.tap(); setSel(p); speak(p.L, null); }} style={{ minHeight:44,borderRadius:14,border:`2px solid ${sel.L===p.L?T.primary:T.outlineV}`,background:sel.L===p.L?T.primaryC:"#fff",fontWeight:900,fontSize:16,color:T.ink,cursor:"pointer" }}>{p.L}</button>)}
      </div>
      <div style={{ background:T.card,borderRadius:20,padding:16,border:"none",boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <div style={{ width:84,height:84,borderRadius:20,background:T.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,fontWeight:900,color:T.primary }}>{sel.L}{sel.L.toLowerCase()}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13,color:T.ink2 }}>ชื่อตัวอักษร: <b style={{ color:T.ink }}>{sel.name}</b></div>
            <div style={{ fontSize:13,color:T.ink2 }}>เสียง: <b style={{ color:T.primary,fontSize:16 }}>{sel.sound}</b></div>
            <div style={{ display:"flex",gap:6,marginTop:6 }}>
              <button onClick={() => speak(sel.L, `ตัว ${sel.name}`)} style={{ minHeight:44,padding:"0 12px",borderRadius:14,border:"none",background:T.primaryC,color:T.onPrimaryC,fontWeight:800,fontSize:12,cursor:"pointer" }}>🔊 ชื่อ</button>
              {ex[0] && <button onClick={() => speakAt(`${sel.L}. ${ex[0].word}. ${sel.L} is for ${ex[0].word.toLowerCase()}.`, `${sel.sound} ${ex[0].meaning}`, 0.8)} style={{ minHeight:44,padding:"0 12px",borderRadius:14,border:"none",background:"#cffafe",color:"#155e75",fontWeight:800,fontSize:12,cursor:"pointer" }}>🔊 {sel.L} is for {ex[0].word}</button>}
            </div>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.max(1, ex.length)},1fr)`,gap:6,margin:"14px -8px 0" }}>
          {ex.map(w => (
            <button key={w.id} onClick={() => speak(w.word, w.meaning)} style={{ background:T.surfHigh,border:"none",borderRadius:14,padding:3,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"stretch",textAlign:"center",gap:4,minHeight:44 }}>
              <PicBox w={w} h={112} r={12} emojiSize={40} />
              <div style={{ fontWeight:900,fontSize:13,color:T.ink }}><span style={{ color:T.primary }}>{w.word[0]}</span>{w.word.slice(1)}</div>
              <div style={{ fontSize:11,color:T.ink2 }}>{w.meaning}</div>
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => { sfx.tap(); onGame(); }} style={{ width:"100%",minHeight:60,marginTop:14,borderRadius:16,border:"none",background:T.grad,color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 6px 18px rgba(6,182,212,0.3)" }}>
        🎯 เกมเสียงแรก — ฟังคำแล้วเลือกตัวอักษรตัวแรก {best > 0 && `· ⭐${best}`}
      </button>
    </div>
  );
}

// เกมเสียงแรก: ฟังคำ (ไม่โชว์ตัวสะกด) → เลือกตัวอักษรตัวแรกจาก 4 ตัว · 10 ข้อ
function PhonicsGame({ words, speakAt, track, onBack }) {
  const pool = useMemo(() => PHONICS.flatMap(p => p.words.map(k => ({ L:p.L, w:wordByKey(words, k) })).filter(x => x.w)), [words]);
  const qs = useMemo(() => shuffle(pool).slice(0, 10), [pool]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [played, setPlayed] = useState(false);
  const q = qs[i];
  const opts = useMemo(() => q ? shuffle([q.L, ...shuffle(PHONICS.map(p => p.L).filter(L => L !== q.L)).slice(0, 3)]) : [], [i, q]);
  if (!q) return <NoWords onBack={onBack} />;
  const pick = L => {
    if (picked || !played) return; setPicked(L);
    const ok = L === q.L;
    if (ok) { setScore(s => s + 1); track.correct(q.w); } else track.wrong(q.w);
    afterSpeech(() => { if (i + 1 < qs.length) { setI(i + 1); setPicked(null); setPlayed(false); } else track.finish(ok ? score + 1 : score, qs.length); }, 1100);
  };
  return (
    <GameCard>
      <Bar left={`🔤 ${i+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ display:"flex",justifyContent:"center",marginBottom:6 }}><Pic w={q.w} size={60} fill style={{ height:"min(36vh, 340px)" }} /></div>
        <SndBtn onClick={() => { setPlayed(true); speakAt(q.w.word, null, 0.75); }} />
        <p style={{ textAlign:"center",fontSize:13,fontWeight:700,color:T.ink2,margin:"0 0 10px",minHeight:20 }}>
          {picked ? <span style={{ color:T.primary }}>{q.w.word} · {q.w.read} · {q.w.meaning}</span> : played ? "คำนี้ขึ้นต้นด้วยตัวอะไร?" : "แตะฟังก่อน แล้วเลือกตัวอักษรตัวแรก"}
        </p>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
          {opts.map(L => {
            const ic = L === q.L, ip = picked === L;
            let bg = "#f0fdfa", bo = "#99f6e4", c = "#134e4a";
            if (picked && ic) { bg = T.okC; bo = T.ok; c = T.onOkC; }
            if (picked && ip && !ic) { bg = T.errorC; bo = T.error; c = T.onErrorC; }
            return <button key={L} onClick={() => pick(L)} disabled={!!picked || !played} style={{ minHeight:64,borderRadius:14,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:900,fontSize:28,cursor:"pointer",opacity:played?1:0.5 }}>{L}</button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// GRAMMAR — บทเรียนไวยากรณ์เด็ก: กฎ 3 ข้อ + แบบฝึก
// ═══════════════════════════════════════════════════════
function GrammarScreen({ words, speak, progress, onPractice }) {
  const [open, setOpen] = useState(null);
  const g = GRAMMAR.find(x => x.id === open);
  if (g) return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <button onClick={() => { sfx.tap(); setOpen(null); }} style={{ minHeight:44,border:"none",background:"none",color:T.ink2,fontWeight:700,fontSize:13,cursor:"pointer",padding:0,marginBottom:6 }}>‹ บทเรียนทั้งหมด</button>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:12 }}>
        <div style={{ fontWeight:900,fontSize:22 }}>{g.emoji} {g.title}</div><div style={{ fontSize:13,opacity:0.9 }}>{g.titleTh}</div>
      </div>
      {g.rules.map((r, i) => {
        const w = wordByKey(words, r.pic);
        return (
          <div key={i} style={{ background:T.card,borderRadius:18,padding:14,marginBottom:10,border:"none",display:"flex",gap:12,alignItems:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            {w && <span style={{ position:"relative",width:"34%",height:108,borderRadius:16,overflow:"hidden",flexShrink:0,background:T.surfHigh }}><PicFill w={w} emojiSize={40} /></span>}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:11,fontWeight:800,color:T.tertiary,marginBottom:2 }}>กฎข้อ {i+1}</div>
              <div style={{ fontSize:14,fontWeight:700,color:T.ink,lineHeight:1.5 }}>{r.th}</div>
              <button onClick={() => speak(r.en.replace(/·/g, "."), null)} style={{ marginTop:6,minHeight:44,border:"none",background:T.tertiaryC,color:T.onTertiaryC,borderRadius:14,padding:"0 12px",fontWeight:700,fontSize:14,cursor:"pointer",textAlign:"left",lineHeight:1.4 }}>🔊 {r.en}</button>
            </div>
          </div>
        );
      })}
      <button onClick={() => { sfx.tap(); onPractice(g); }} className="m3-press" style={M3.filled({ width:"100%",minHeight:56,fontSize:15,marginTop:4 })}>✍️ ฝึกทำ {g.practice.length} ข้อ</button>
    </div>
  );
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>✍️ ไวยากรณ์เด็ก</div>
        <div style={{ fontSize:13,opacity:0.9 }}>{GRAMMAR.length} บทเรียนสั้นๆ กฎ 3 ข้อ + แบบฝึก · อธิบายเป็นไทย</div>
      </div>
      {GRAMMAR.map(g => {
        const st = progress.stars[`grammar:${g.id}:grammar`] || 0;
        return (
          <button key={g.id} onClick={() => { sfx.tap(); setOpen(g.id); }} style={{ width:"100%",minHeight:64,background:T.card,border:"none",borderRadius:16,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize:28,width:36,textAlign:"center" }}>{g.emoji}</span>
            <div style={{ flex:1,minWidth:0 }}><div style={{ fontWeight:800,fontSize:15,color:T.ink }}>{g.title}</div><div style={{ fontSize:12,color:T.ink2 }}>{g.titleTh}</div></div>
            <span style={{ fontSize:13 }}>{[1,2,3].map(i => <span key={i} style={{ opacity:i<=st?1:0.2 }}>⭐</span>)}</span>
          </button>
        );
      })}
    </div>
  );
}

// แบบฝึกไวยากรณ์ (ใช้ซ้ำกับข้อไวยากรณ์ในสอบวัดระดับ)
function GrammarGame({ allWords, cat, speak, track, onBack }) {
  const g = cat.lesson;
  const qs = useMemo(() => shuffle(g.practice), [g]);
  const [i, setI] = useState(0); const [score, setScore] = useState(0); const [picked, setPicked] = useState(null);
  const q = qs[i];
  const parts = q.q.split("___");
  const pick = o => {
    if (picked) return; setPicked(o);
    const ok = o === q.answer;
    if (ok) { setScore(s => s + 1); track.correct(null); speak(q.q.replace("___", q.answer).replace(/\(.*?\)/, ""), q.th); } else track.wrong(null);
    afterSpeech(() => { if (i + 1 < qs.length) { setI(i + 1); setPicked(null); } else track.finish(ok ? score + 1 : score, qs.length); }, 1300);
  };
  const gRule = (() => { const g = GRAMMAR.find(x => `grammar:${x.id}` === cat?.id); const r = g?.rules?.[i % (g.rules.length || 1)]; return r ? wordByKey(allWords || [], r.pic) : null; })();
  const gPic = sentencePic(allWords, q.q) || gRule;
  return (
    <GameCard>
      <Bar left={`✍️ ${i+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ fontSize:11,fontWeight:800,color:T.tertiary,marginBottom:4 }}>{g.emoji} {g.title}</div>
        {gPic && <div style={{ marginBottom:10 }}><PicBox w={gPic} h="min(31vh, 290px)" /></div>}
        <div style={{ fontSize:20,fontWeight:800,color:T.ink,lineHeight:1.5 }}>
          {parts[0]}<span style={{ display:"inline-block",minWidth:56,borderBottom:"3px solid #f59e0b",textAlign:"center",color:picked?(picked===q.answer?T.ok:T.error):T.tertiary }}>{picked || "___"}</span>{parts[1]}
        </div>
        <div style={{ fontSize:13,color:T.ink2,margin:"4px 0 12px" }}>{q.th}</div>
        <div style={{ display:"grid",gridTemplateColumns:`repeat(${q.options.length},1fr)`,gap:8 }}>
          {q.options.map(o => {
            const ic = o === q.answer, ip = picked === o;
            let bg = T.tertiaryC, bo = T.tertiary, c = T.onTertiaryC;
            if (picked && ic) { bg = T.okC; bo = T.ok; c = T.onOkC; }
            if (picked && ip && !ic) { bg = T.errorC; bo = T.error; c = T.onErrorC; }
            return <button key={o} onClick={() => pick(o)} disabled={!!picked} style={{ minHeight:56,borderRadius:14,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:900,fontSize:20,cursor:"pointer" }}>{o}</button>;
          })}
        </div>
        {picked && picked !== q.answer && <div style={{ textAlign:"center",fontSize:13,color:T.onErrorC,marginTop:10 }}>ที่ถูกคือ <b>{q.answer}</b></div>}
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// DAILY LIFE — เวลา · เงินบาท · วัน-เดือน · ตัวเลข 1–100 (เรียน + เกม)
// ═══════════════════════════════════════════════════════
function ClockFace({ h, m, size = 150 }) {
  const r = size / 2, hh = ((h % 12) + m / 60) * 30, mm = m * 6;
  const hand = (deg, len, w, c) => { const a = (deg - 90) * Math.PI / 180; return <line x1={r} y1={r} x2={r + Math.cos(a) * len} y2={r + Math.sin(a) * len} stroke={c} strokeWidth={w} strokeLinecap="round" />; };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:"block",margin:"0 auto" }}>
      <circle cx={r} cy={r} r={r - 3} fill="#fff" stroke={T.ink} strokeWidth="4" />
      {Array.from({ length: 12 }, (_, i) => { const a = (i * 30 - 90) * Math.PI / 180; const x = r + Math.cos(a) * (r - 20), y = r + Math.sin(a) * (r - 20); return <text key={i} x={x} y={y + 5} textAnchor="middle" fontSize={size*0.1} fontWeight="800" fill={T.ink2}>{i === 0 ? 12 : i}</text>; })}
      {hand(hh, r * 0.5, 6, T.ink)}{hand(mm, r * 0.72, 4, T.error)}
      <circle cx={r} cy={r} r={5} fill={T.ink} />
    </svg>
  );
}
const TIME_OPTS = [0, 15, 30, 45];

function DailyScreen({ words, speak, speakAt, progress, onGame }) {
  const [tab, setTab] = useState("time");
  const [t, setT] = useState({ h: 7, m: 0 });
  const [num, setNum] = useState(null);
  const tabs = [["time","🕐 เวลา"],["money","💰 เงินบาท"],["calendar","📅 วัน-เดือน"],["numbers100","🔢 ตัวเลข"]];
  const best = k => progress.stars[`daily:${k}:${k}`] || 0;
  const btn = { minHeight:44,borderRadius:16,border:"none",background:T.surfHigh,color:T.ink2,fontWeight:800,fontSize:14,cursor:"pointer",padding:"0 14px" };
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:12 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>🧭 ภาษาอังกฤษในชีวิตประจำวัน</div>
        <div style={{ fontSize:13,opacity:0.9 }}>บอกเวลา · นับเงินบาท · วันและเดือน · ตัวเลขถึง 100</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12 }}>
        {tabs.map(([k,l]) => <button key={k} onClick={() => { sfx.tap(); setTab(k); }} style={{ minHeight:44,borderRadius:16,border:"none",fontWeight:800,fontSize:12,cursor:"pointer",background:tab===k?T.primary:T.surfHigh,color:tab===k?"#fff":T.ink2 }}>{l}</button>)}
      </div>
      <div style={{ background:T.card,borderRadius:20,padding:16,border:"none",boxShadow:"0 4px 16px rgba(0,0,0,0.06)",marginBottom:12 }}>
        {tab === "time" && (
          <div style={{ textAlign:"center" }}>
            <ClockFace h={t.h} m={t.m} />
            <div style={{ fontSize:26,fontWeight:900,color:T.ink,marginTop:8 }}>{String(t.h).padStart(2,"0")}:{String(t.m).padStart(2,"0")}</div>
            <button onClick={() => speak(`It's ${timeWord(t.h, t.m)}.`, timeThai(t.h, t.m))} style={{ ...btn,background:"#e0f2fe",color:"#075985",marginTop:6,fontSize:16 }}>🔊 It's {timeWord(t.h, t.m)}</button>
            <div style={{ fontSize:13,color:T.ink2,marginTop:4 }}>{timeThai(t.h, t.m)}</div>
            <div style={{ display:"flex",gap:6,justifyContent:"center",marginTop:12,flexWrap:"wrap" }}>
              <button onClick={() => { sfx.tap(); setT(x => ({ ...x, h: x.h === 1 ? 12 : x.h - 1 })); }} style={btn}>− ชั่วโมง</button>
              <button onClick={() => { sfx.tap(); setT(x => ({ ...x, h: x.h === 12 ? 1 : x.h + 1 })); }} style={btn}>+ ชั่วโมง</button>
              <button onClick={() => { sfx.tap(); setT(x => ({ ...x, m: (x.m + 15) % 60 })); }} style={btn}>+15 นาที</button>
            </div>
            <div style={{ fontSize:11,color:T.ink3,marginTop:10,lineHeight:1.6 }}>o'clock = ตรง · half past = ครึ่ง · quarter past = 15 นาที · quarter to = อีก 15 นาทีจะถึง</div>
          </div>
        )}
        {tab === "money" && (
          <div>
            <div style={{ fontSize:13,color:T.ink2,marginBottom:8 }}>แตะเพื่อฟังชื่อเงินแต่ละแบบ</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
              {MONEY.map(mo => (
                <button key={mo.v} onClick={() => speak(`${numberWord(mo.v)} baht`, `${numberThai(mo.v)}บาท`)} style={{ minHeight:72,borderRadius:14,border:"2px solid #fde68a",background:T.tertiaryC,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2 }}>
                  <span style={{ fontSize:26 }}>{mo.emoji}</span><b style={{ fontSize:14,color:T.onTertiaryC }}>{mo.v} ฿</b><span style={{ fontSize:9,color:T.ink2 }}>{numberWord(mo.v)}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize:12,color:T.ink2,marginTop:12,lineHeight:1.7 }}>
              <b>ถามราคา:</b> How much is it? — It's <b>twenty-five baht</b>.<br/><b>จ่ายเงิน:</b> Here you are. — Thank you! Here is your change. (นี่เงินทอน)
            </div>
            <button onClick={() => speak("How much is it? It's twenty-five baht. Here you are. Thank you!", "ราคาเท่าไหร่ ยี่สิบห้าบาท นี่ค่ะ ขอบคุณ")} style={{ ...btn,marginTop:8,width:"100%" }}>🔊 ฟังบทสนทนาซื้อของ</button>
          </div>
        )}
        {tab === "calendar" && (
          <div>
            <div style={{ fontWeight:800,fontSize:13,color:T.ink,marginBottom:6 }}>7 วัน</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:12 }}>
              {DAYS.map(([en, th, read, e]) => <button key={en} onClick={() => speak(en, th)} style={{ minHeight:44,borderRadius:16,border:"1px solid var(--md-outline-variant)",background:T.surfHigh,cursor:"pointer",textAlign:"left",padding:"4px 10px" }}><b style={{ fontSize:14,color:T.ink }}>{e} {en}</b><div style={{ fontSize:11,color:T.ink2 }}>{read} · {th}</div></button>)}
            </div>
            <div style={{ fontWeight:800,fontSize:13,color:T.ink,marginBottom:6 }}>12 เดือน</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6 }}>
              {MONTHS.map(([en, th, read], i) => <button key={en} onClick={() => speak(en, th)} style={{ minHeight:44,borderRadius:16,border:"1px solid var(--md-outline-variant)",background:T.surfHigh,cursor:"pointer",padding:"4px 6px" }}><b style={{ fontSize:12,color:T.ink }}>{i+1}. {en}</b><div style={{ fontSize:10,color:T.ink2 }}>{th}</div></button>)}
            </div>
            <div style={{ fontSize:12,color:T.ink2,marginTop:12,lineHeight:1.7 }}><b>What day is it today?</b> — It's Monday.<br/><b>When is your birthday?</b> — In May.</div>
          </div>
        )}
        {tab === "numbers100" && (
          <div>
            <div style={{ fontSize:13,color:T.ink2,marginBottom:8 }}>แตะตัวเลขเพื่อฟัง {num != null && <b style={{ color:T.primary }}>· {num} = {numberWord(num)} ({numberThai(num)})</b>}</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:3 }}>
              {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <button key={n} onClick={() => { setNum(n); speak(numberWord(n), numberThai(n)); }} style={{ minHeight:30,height:30,borderRadius:6,border:"none",background:num===n?T.primary:n%10===0?T.secondaryC:T.surfHigh,color:num===n?"#fff":T.ink,fontWeight:700,fontSize:10,cursor:"pointer",padding:0 }}>{n}</button>)}
            </div>
            <div style={{ fontSize:11,color:T.ink3,marginTop:8 }}>ปุ่มเล็กเพราะต้องใส่ 100 ตัว — แตะตัวไหนก็ได้ใกล้ๆ แล้วใช้ปุ่มด้านล่างเลื่อนทีละ 1</div>
            <div style={{ display:"flex",gap:6,justifyContent:"center",marginTop:8 }}>
              <button onClick={() => { const n = Math.max(1, (num || 1) - 1); setNum(n); speak(numberWord(n), numberThai(n)); }} style={btn}>‹ ก่อนหน้า</button>
              <button onClick={() => { const n = Math.min(100, (num || 0) + 1); setNum(n); speak(numberWord(n), numberThai(n)); }} style={btn}>ถัดไป ›</button>
            </div>
          </div>
        )}
      </div>
      <button onClick={() => { sfx.tap(); onGame(tab); }} style={{ width:"100%",minHeight:56,borderRadius:16,border:"none",background:T.grad,color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 6px 18px rgba(14,165,233,0.3)" }}>
        🎯 เล่นเกม{tabs.find(x => x[0] === tab)[1].slice(2)} {best(tab) > 0 && `· ⭐${best(tab)}`}
      </button>
    </div>
  );
}

// เกมชีวิตประจำวัน 4 แบบ ในคอมโพเนนต์เดียว (kind = time | money | calendar | numbers100) · 8 ข้อ
function DailyGame({ cat, speak, speakAt, track, onBack }) {
  const kind = cat.kind;
  const qs = useMemo(() => Array.from({ length: 8 }, () => {
    if (kind === "time") {
      const h = 1 + Math.floor(Math.random() * 12), m = TIME_OPTS[Math.floor(Math.random() * 4)];
      const ans = timeWord(h, m); const pool = new Set([ans]);
      while (pool.size < 4) pool.add(timeWord(1 + Math.floor(Math.random() * 12), TIME_OPTS[Math.floor(Math.random() * 4)]));
      return { kind, h, m, answer: ans, options: shuffle([...pool]), prompt: "What time is it?", th: "กี่โมงแล้ว?" };
    }
    if (kind === "money") {
      const n = 2 + Math.floor(Math.random() * 3); const items = Array.from({ length: n }, () => MONEY[Math.floor(Math.random() * MONEY.length)]);
      const total = items.reduce((a, x) => a + x.v, 0); const ans = `${numberWord(total)} baht`; const pool = new Set([ans]);
      while (pool.size < 4) pool.add(`${numberWord(Math.max(1, total + [-10,-5,-2,-1,1,2,5,10,20][Math.floor(Math.random()*9)]))} baht`);
      return { kind, items, total, answer: ans, options: shuffle([...pool]), prompt: "How much is it?", th: "ทั้งหมดกี่บาท?" };
    }
    if (kind === "calendar") {
      if (Math.random() < 0.5) {
        const i = Math.floor(Math.random() * 7); const ans = DAYS[(i + 1) % 7][0]; const pool = new Set([ans]);
        while (pool.size < 4) pool.add(DAYS[Math.floor(Math.random() * 7)][0]);
        return { kind, prompt: `Today is ${DAYS[i][0]}. Tomorrow is ___.`, th: `วันนี้${DAYS[i][1]} พรุ่งนี้คือวันอะไร`, emoji: DAYS[i][3], answer: ans, options: shuffle([...pool]) };
      }
      const i = Math.floor(Math.random() * 12); const ans = MONTHS[(i + 1) % 12][0]; const pool = new Set([ans]);
      while (pool.size < 4) pool.add(MONTHS[Math.floor(Math.random() * 12)][0]);
      return { kind, prompt: `What month comes after ${MONTHS[i][0]}?`, th: `เดือนถัดจาก${MONTHS[i][1]}คือ?`, emoji: "📅", answer: ans, options: shuffle([...pool]) };
    }
    const n = 1 + Math.floor(Math.random() * 100); const pool = new Set([n]);
    while (pool.size < 4) pool.add(Math.max(1, Math.min(100, n + [-10,-1,1,10,-11,11,-20,20][Math.floor(Math.random()*8)])));
    return { kind, n, answer: String(n), options: shuffle([...pool].map(String)), prompt: "ฟังแล้วเลือกตัวเลข", th: numberWord(n) };
  }), [kind]);
  const [i, setI] = useState(0); const [score, setScore] = useState(0); const [picked, setPicked] = useState(null); const [played, setPlayed] = useState(kind !== "numbers100");
  const q = qs[i];
  const say = () => {
    setPlayed(true);
    if (kind === "numbers100") speakAt(numberWord(q.n), null, 0.8);
    else if (kind === "time") speak(q.prompt, q.th);
    else if (kind === "money") speak(q.prompt, q.th);
    else speak(q.prompt.replace("___", "what?"), q.th);
  };
  const pick = o => {
    if (picked || !played) return; setPicked(o);
    const ok = o === q.answer;
    if (ok) { setScore(s => s + 1); track.correct(null); if (kind === "time") speak(`It's ${q.answer}.`, timeThai(q.h, q.m)); else if (kind === "money") speak(`It's ${q.answer}.`, `${numberThai(q.total)}บาท`); else if (kind === "calendar") speak(q.answer, null); }
    else track.wrong(null);
    afterSpeech(() => { if (i + 1 < qs.length) { setI(i + 1); setPicked(null); setPlayed(kind !== "numbers100"); } else track.finish(ok ? score + 1 : score, qs.length); }, 1300);
  };
  const icon = { time:"🕐", money:"💰", calendar:"📅", numbers100:"🔢" }[kind];
  return (
    <GameCard>
      <Bar left={`${icon} ${i+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        {kind === "time" && <ClockFace h={q.h} m={q.m} size={140} />}
        {kind === "money" && <div style={{ display:"flex",justifyContent:"center",gap:6,flexWrap:"wrap",padding:"10px 0" }}>{q.items.map((it, k) => <div key={k} style={{ background:T.tertiaryC,border:"2px solid #fde68a",borderRadius:16,padding:"6px 10px",textAlign:"center" }}><div style={{ fontSize:28 }}>{it.emoji}</div><b style={{ fontSize:13,color:T.onTertiaryC }}>{it.v} ฿</b></div>)}</div>}
        {kind === "calendar" && <div style={{ textAlign:"center",fontSize:48,padding:"6px 0" }}>{q.emoji}</div>}
        {kind === "numbers100" && <div style={{ textAlign:"center",fontSize:48,padding:"6px 0" }}>👂</div>}
        <SndBtn onClick={say} />
        <div style={{ textAlign:"center",fontSize:17,fontWeight:800,color:T.ink }}>{kind === "numbers100" ? (picked ? `${q.n} = ${q.th}` : "ฟังแล้วเลือกตัวเลข") : q.prompt}</div>
        <div style={{ textAlign:"center",fontSize:12,color:T.ink2,marginBottom:10 }}>{kind === "numbers100" ? (played ? "เลือกตัวเลขที่ได้ยิน" : "แตะฟังก่อน") : q.th}</div>
        <div style={{ display:"grid",gridTemplateColumns:kind==="numbers100"?"repeat(4,1fr)":"1fr 1fr",gap:8 }}>
          {q.options.map(o => {
            const ic = o === q.answer, ip = picked === o;
            let bg = "#f0f9ff", bo = "#bae6fd", c = T.onPrimaryC;
            if (picked && ic) { bg = T.okC; bo = T.ok; c = T.onOkC; }
            if (picked && ip && !ic) { bg = T.errorC; bo = T.error; c = T.onErrorC; }
            return <button key={o} onClick={() => pick(o)} disabled={!!picked || !played} style={{ minHeight:52,borderRadius:16,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:800,fontSize:kind==="numbers100"?22:14,cursor:"pointer",opacity:played?1:0.5,padding:"6px" }}>{o}</button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// PLACEMENT TEST — 20 ข้อผสม (รูป→คำ · ฟัง · เติมประโยค · ไวยากรณ์) → ระดับ + ใบประกาศ
// ═══════════════════════════════════════════════════════
function buildTest(words) {
  const withPic = words.filter(w => imageTitleOf(w) && w.cat !== "x");
  const pick4 = (w, pool) => shuffle([w, ...shuffle(pool.filter(x => x.id !== w.id && x.cat === w.cat)).slice(0, 3)]);
  const q = [];
  shuffle(withPic).slice(0, 8).forEach(w => q.push({ type:"pic", w, options: pick4(w, words) }));
  shuffle(words).slice(0, 4).forEach(w => q.push({ type:"listen", w, options: pick4(w, words) }));
  shuffle(DIALOGUES.flatMap(d => d.lines.filter(l => l.blank).map(l => ({ ...l, scene: d.scene, all: d.lines.filter(x => x.blank).map(x => x.blank) })))).slice(0, 4)
    .forEach(l => q.push({ type:"fill", line: l, options: shuffle([l.blank, ...shuffle(l.all.filter(b => b !== l.blank)).slice(0, 2)]) }));
  shuffle(GRAMMAR.flatMap(g => g.practice.map((p, k) => ({ ...p, rulePic: g.rules[k % g.rules.length]?.pic })))).slice(0, 4).forEach(p => q.push({ type:"grammar", p }));
  return shuffle(q);
}
function TestGame({ cat, speak, speakAt, track, onBack, allWords }) {
  const qs = useMemo(() => buildTest(cat.allWords), [cat.allWords]);
  const [i, setI] = useState(0); const [score, setScore] = useState(0); const [picked, setPicked] = useState(null); const [played, setPlayed] = useState(false);
  const q = qs[i];
  const answerOf = () => q.type === "pic" || q.type === "listen" ? q.w.word : q.type === "fill" ? q.line.blank : q.p.answer;
  const options = q.type === "pic" || q.type === "listen" ? q.options.map(w => w.word) : q.options || q.p.options;
  const pick = o => {
    if (picked || (q.type === "listen" && !played)) return; setPicked(o);
    const ok = o === answerOf();
    if (ok) { setScore(s => s + 1); track.correct(q.w || null); sfx.ok(); } else { track.wrong(q.w || null); }
    afterSpeech(() => {
      if (i + 1 < qs.length) { setI(i + 1); setPicked(null); setPlayed(false); }
      else { const s = ok ? score + 1 : score; track.finish(s, qs.length, { label:`ตอบถูก ${s}/${qs.length} ข้อ`, stars: s >= 18 ? 3 : s >= 14 ? 2 : s >= 8 ? 1 : 0 }); cat.onTestDone?.(s, qs.length); /* หลัง finish เพื่อไม่ให้ถูกเขียนทับ */ }
    }, 1000);
  };
  const label = { pic:"ฟังแล้วแตะรูปที่ตรงกัน", listen:"ฟังแล้วแตะรูปที่ได้ยิน", fill:"เติมคำในบทสนทนา", grammar:"ไวยากรณ์" }[q.type];
  const tPic = (() => { if (q.type === "fill") return wordByKey(allWords || [], q.line.scene || "") || null; if (q.type !== "grammar") return null; return sentencePic(allWords, q.p.q) || wordByKey(allWords || [], q.p.rulePic || ""); })();
  return (
    <GameCard>
      <Bar left={`📝 ข้อ ${i+1}/${qs.length}`} right={`✓ ${score}`} />
      <div style={{ height:5,background:T.surfHigh }}><div style={{ height:"100%",width:`${(i/qs.length)*100}%`,background:T.primary,transition:"width .3s" }} /></div>
      <div style={GS.body}>
        <div style={{ fontSize:11,fontWeight:800,color:T.primary,marginBottom:6 }}>{label}</div>
        {q.type === "pic" && <SoundPrompt onClick={() => { setPlayed(true); speak(q.w.word, q.w.meaning); }} pulse={!played} w={q.w} />}
        {tPic && <div style={{ marginBottom:10 }}><PicBox w={tPic} h="min(31vh, 290px)" /></div>}
        {q.type === "listen" && <SoundPrompt onClick={() => { setPlayed(true); speakAt(q.w.word, null, 0.8); }} pulse={!played} w={q.w} />}
        {q.type === "fill" && <div style={{ fontSize:18,fontWeight:800,color:T.ink,marginBottom:10,lineHeight:1.5 }}>{q.line.en.split(new RegExp(`\\b${q.line.blank}\\b`))[0]}<span style={{ borderBottom:"3px solid #6366f1",minWidth:60,display:"inline-block",textAlign:"center",color:T.primary }}>{picked || "____"}</span>{q.line.en.split(new RegExp(`\\b${q.line.blank}\\b`))[1]}<div style={{ fontSize:12,color:T.ink2,fontWeight:500 }}>{q.line.th}</div></div>}
        {q.type === "grammar" && <div style={{ fontSize:18,fontWeight:800,color:T.ink,marginBottom:10,lineHeight:1.5 }}>{q.p.q.split("___")[0]}<span style={{ borderBottom:"3px solid #6366f1",minWidth:50,display:"inline-block",textAlign:"center",color:T.primary }}>{picked || "___"}</span>{q.p.q.split("___")[1]}<div style={{ fontSize:12,color:T.ink2,fontWeight:500 }}>{q.p.th}</div></div>}
        <div style={{ display:"grid",gridTemplateColumns:options.length>3?"1fr 1fr":`repeat(${options.length},1fr)`,gap:8 }}>
          {options.map(o => {
            const ic = o === answerOf(), ip = picked === o;
            let bg = T.secondaryC, bo = T.primaryC, c = T.onPrimaryC;
            if (picked && ic) { bg = T.okC; bo = T.ok; c = T.onOkC; }
            if (picked && ip && !ic) { bg = T.errorC; bo = T.error; c = T.onErrorC; }
            const ow = q.type === "listen" || q.type === "pic" ? q.options.find(x => x.word === o) : null;
            return <button key={o} onClick={() => pick(o)} disabled={!!picked || (q.type === "listen" && !played)} style={{ ...(ow ? { display:"flex",flexDirection:"column",alignItems:"stretch",gap:4,padding:4 } : {}),minHeight:52,borderRadius:16,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:800,fontSize:15,cursor:"pointer",opacity:(q.type==="listen"&&!played)?0.5:1 }}>{ow && <PicBox w={ow} h="auto" r={12} emojiSize={40} style={{ aspectRatio:"4/3" }} />}{(!ow || picked) && o}</button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

function CertificateScreen({ progress, profile, words, onStart }) {
  const cert = progress.cert;
  const lv = cert ? LEVELS_TEST.find(l => cert.score >= l.min) : null;
  const mastered = words.filter(w => isMastered(progress.srs, w.id)).length;
  const canvasRef = useRef(null);
  const save = async () => {
    try {
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1350; const g = c.getContext("2d");
      const gr = g.createLinearGradient(0, 0, 1080, 1350); gr.addColorStop(0, T.tertiaryC); gr.addColorStop(1, T.secondaryC); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1350);
      g.strokeStyle = T.tertiary; g.lineWidth = 18; g.strokeRect(50, 50, 980, 1250);
      g.fillStyle = T.ink; g.textAlign = "center";
      g.font = "900 64px system-ui, sans-serif"; g.fillText("ใบประกาศนียบัตร", 540, 220);
      g.font = "700 40px system-ui, sans-serif"; g.fillStyle = T.ink2; g.fillText("Smart VocabPlay · Certificate of Achievement", 540, 285);
      g.font = "400 44px system-ui, sans-serif"; g.fillStyle = T.ink2; g.fillText("ขอมอบให้", 540, 420);
      g.font = "900 96px system-ui, sans-serif"; g.fillStyle = T.ink; g.fillText(`${profile?.avatar || ""} ${profile?.name || "นักเรียน"}`, 540, 540);
      g.font = "400 40px system-ui, sans-serif"; g.fillStyle = T.ink2; g.fillText("ผ่านการทดสอบวัดระดับภาษาอังกฤษ ระดับ", 540, 650);
      g.font = "900 180px system-ui, sans-serif"; g.fillStyle = T.primary; g.fillText(lv.level, 540, 850);
      g.font = "700 48px system-ui, sans-serif"; g.fillStyle = T.ink2; g.fillText(`${lv.emoji} ${lv.th} · คะแนน ${cert.score}/${cert.total}`, 540, 930);
      g.font = "400 36px system-ui, sans-serif"; g.fillStyle = T.ink2; g.fillText(`คำศัพท์ที่จำได้แม่น ${mastered} คำ · ดาวสะสม ${Object.values(progress.stars).reduce((a, b) => a + b, 0)} ดวง`, 540, 1010);
      g.fillText(`วันที่ ${cert.date}`, 540, 1130);
      g.font = "400 30px system-ui, sans-serif"; g.fillStyle = T.ink3; g.fillText("xarif09.github.io/Smart-VocabPlay-", 540, 1230);
      const blob = await new Promise(r => c.toBlob(r, "image/png"));
      const file = new File([blob], `vocabplay-certificate-${lv.level}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "ใบประกาศ Smart VocabPlay" }); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    } catch (_) {}
  };
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>📝 สอบวัดระดับ</div>
        <div style={{ fontSize:13,opacity:0.9 }}>20 ข้อ ผสม รูป→คำ · ฟัง · เติมประโยค · ไวยากรณ์ · ได้ระดับ Starter / A1 / A1+ / A2 + ใบประกาศ</div>
      </div>
      {cert && lv && (
        <div ref={canvasRef} style={{ background:"linear-gradient(160deg,#fdf2f8,#eef2ff)",border:"6px double #f59e0b",borderRadius:20,padding:"22px 16px",textAlign:"center",marginBottom:12,boxShadow:"0 8px 28px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize:12,letterSpacing:2,color:T.ink3,fontWeight:700 }}>CERTIFICATE</div>
          <div style={{ fontSize:20,fontWeight:900,color:T.ink,marginTop:2 }}>ใบประกาศนียบัตร</div>
          <div style={{ fontSize:13,color:T.ink2,marginTop:10 }}>ขอมอบให้</div>
          <div style={{ fontSize:26,fontWeight:900,color:T.ink }}>{profile?.avatar} {profile?.name}</div>
          <div style={{ fontSize:13,color:T.ink2,marginTop:8 }}>ผ่านการทดสอบวัดระดับภาษาอังกฤษ</div>
          <div style={{ fontSize:64,fontWeight:900,color:T.primary,lineHeight:1.1 }}>{lv.level}</div>
          <div style={{ fontSize:15,fontWeight:800,color:T.ink2 }}>{lv.emoji} {lv.th} · {cert.score}/{cert.total} คะแนน</div>
          <div style={{ fontSize:12,color:T.ink2,marginTop:6 }}>{lv.desc}</div>
          <div style={{ fontSize:11,color:T.ink3,marginTop:10 }}>วันที่ {cert.date} · จำได้แม่น {mastered} คำ</div>
          <button onClick={save} style={{ marginTop:12,minHeight:48,padding:"0 18px",borderRadius:16,border:"none",background:T.primary,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer" }}>💾 บันทึก / แชร์ใบประกาศ</button>
        </div>
      )}
      <button onClick={() => { sfx.tap(); onStart(); }} style={{ width:"100%",minHeight:56,borderRadius:16,border:"none",background:T.ok,color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer" }}>{cert ? "📝 สอบใหม่อีกครั้ง" : "📝 เริ่มสอบ 20 ข้อ"}</button>
      <div style={{ marginTop:12,background:T.card,borderRadius:16,padding:12,border:"none",fontSize:12,color:T.ink2,lineHeight:1.7 }}>
        {LEVELS_TEST.slice().reverse().map(l => <div key={l.level}><b>{l.emoji} {l.level} {l.th}</b> · {l.min}{l.level==="A2"?"–20":`–${LEVELS_TEST[LEVELS_TEST.findIndex(x=>x.level===l.level)-1].min-1}`} คะแนน — {l.desc}</div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// VERSUS — แข่ง 2 คน จอเดียว (ครึ่งบนกลับหัวให้คนตรงข้าม)
// ═══════════════════════════════════════════════════════
function VersusScreen({ words, categories, speak, setProgress, showToast, onExit }) {
  const [stage, setStage] = useState("setup");
  const [catId, setCatId] = useState("all");
  const [names, setNames] = useState(["ผู้เล่น 1", "ผู้เล่น 2"]);
  const pool = useMemo(() => (catId === "all" ? words : words.filter(w => w.cat === catId)).filter(w => w.cat !== "x"), [words, catId]);
  const [rounds, setRounds] = useState([]);
  const [r, setR] = useState(0);
  const [score, setScore] = useState([0, 0]);
  const [locked, setLocked] = useState([false, false]);
  const [winner, setWinner] = useState(null);   // ของรอบ
  useEffect(() => { if (stage === "play" && r > 0 && rounds[r]) speak(rounds[r].w.word, null); }, [r]); // eslint-disable-line
  const start = () => {
    if (pool.length < 4) { showToast("หมวดนี้คำไม่พอ", "warn"); return; }
    const rs = shuffle(pool).slice(0, 10).map(w => ({ w, opts: shuffle([w, ...shuffle(pool.filter(x => x.id !== w.id)).slice(0, 3)]) }));
    setRounds(rs); setR(0); setScore([0, 0]); setLocked([false, false]); setWinner(null); setStage("play"); sfx.coin(); speak(rs[0].w.word, null);
  };
  const tap = (p, o) => {
    if (winner != null || locked[p]) return;
    const cur = rounds[r];
    if (o.id === cur.w.id) { sfx.ok(); setWinner(p); setScore(s => { const n = [...s]; n[p] += 1; return n; }); speak(cur.w.word, cur.w.meaning); nextSoon(); }
    else { sfx.bad(); const nl = [...locked]; nl[p] = true; setLocked(nl); if (nl[0] && nl[1]) { setWinner(-1); nextSoon(); } }
  };
  const nextSoon = () => afterSpeech(() => {
    if (r + 1 < rounds.length) { setR(x => x + 1); setLocked([false, false]); setWinner(null); }
    else { setStage("end"); sfx.win(); setProgress(pr => ({ ...pr, coins: pr.coins + 20 })); }
  }, 1200);
  if (stage === "setup") return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:T.primaryC,color:T.onPrimaryC,borderRadius:28,padding:18,marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>⚔️ แข่ง 2 คน จอเดียว</div>
        <div style={{ fontSize:13,opacity:0.9 }}>วางมือถือตรงกลาง นั่งตรงข้ามกัน · ฟังเสียงเดียวกัน ใครแตะรูปที่ถูกก่อนได้คะแนน · 10 รอบ</div>
      </div>
      <div style={{ background:T.card,borderRadius:18,padding:14,border:"none",marginBottom:12 }}>
        {[0, 1].map(p => <input key={p} value={names[p]} maxLength={12} onChange={e => setNames(n => { const x = [...n]; x[p] = e.target.value; return x; })} placeholder={`ชื่อผู้เล่น ${p+1}`} style={{ ...inputStyle,marginBottom:8 }} />)}
        <select value={catId} onChange={e => setCatId(e.target.value)} style={inputStyle}>
          <option value="all">ทุกหมวด ({words.length} คำ)</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label} ({words.filter(w => w.cat === c.id).length})</option>)}
        </select>
      </div>
      <button onClick={start} style={{ width:"100%",minHeight:56,borderRadius:16,border:"none",background:T.error,color:"#fff",fontWeight:900,fontSize:16,cursor:"pointer" }}>▶ เริ่มแข่ง!</button>
    </div>
  );
  if (stage === "end") {
    const w = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1;
    return (
      <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto",textAlign:"center" }}>
        <Confetti />
        <div style={{ fontSize:70 }}>{w == null ? "🤝" : "🏆"}</div>
        <h2 style={{ fontWeight:900,fontSize:24,color:T.ink,margin:"6px 0" }}>{w == null ? "เสมอกัน!" : `${names[w]} ชนะ!`}</h2>
        <div style={{ fontSize:16,color:T.ink2,marginBottom:14 }}>{names[0]} {score[0]} — {score[1]} {names[1]}</div>
        <div style={{ fontSize:13,color:T.onTertiaryC,background:T.tertiaryC,display:"inline-block",padding:"6px 14px",borderRadius:999,fontWeight:800 }}>+20 🪙 สำหรับเจ้าของเครื่อง</div>
        <div style={{ display:"flex",gap:8,marginTop:18 }}>
          <button onClick={start} style={{ flex:1,minHeight:50,borderRadius:14,border:"none",background:T.error,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer" }}>🔄 แข่งอีก</button>
          <button onClick={onExit} style={{ flex:1,minHeight:50,borderRadius:14,border:"none",background:T.surfHigh,color:T.ink2,fontWeight:800,fontSize:15,cursor:"pointer" }}>กลับ</button>
        </div>
      </div>
    );
  }
  const cur = rounds[r];
  const short = typeof innerHeight !== "undefined" && innerHeight < 740;   // จอเตี้ย: รูปซ้าย ปุ่มขวา
  const half = (p, flip) => (
    <div style={{ flex:1,display:"flex",flexDirection:"column",transform:flip?"rotate(180deg)":"none",padding:"8px 10px",background:p===0?T.tertiaryC:T.secondaryC }}>
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:800,color:T.ink2 }}><span>{names[p]}</span><span>⭐ {score[p]}</span></div>
      <div style={{ flex:1,minHeight:0,display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:6,margin:"6px 0 0" }}>
        {cur.opts.map(o => {
          const show = winner != null; const ic = o.id === cur.w.id;
          return <button key={o.id} onClick={() => tap(p, o)} disabled={locked[p] || winner != null} aria-label={show ? o.word : "รูปตัวเลือก"} style={{ position:"relative",overflow:"hidden",minHeight:0,padding:0,borderRadius:16,border:`3px solid ${show&&ic?T.ok:p===0?T.tertiary:T.primary}`,background:T.card,cursor:"pointer",opacity:locked[p]||(show&&!ic)?0.4:1 }}><PicFill w={o} emojiSize={44} />{show && ic && <span style={{ position:"absolute",left:0,right:0,bottom:0,padding:"2px 4px",background:T.okC,color:T.onOkC,fontWeight:900,fontSize:14,textAlign:"center" }}>{o.word}</span>}</button>;
        })}
      </div>
      {locked[p] && winner == null && <div style={{ textAlign:"center",fontSize:12,color:T.error,fontWeight:800 }}>ผิด! รอรอบหน้า</div>}
      {winner === p && <div style={{ textAlign:"center",fontSize:12,color:T.ok,fontWeight:800 }}>ถูก! +1 🎉</div>}
    </div>
  );
  return (
    <div style={{ position:"fixed",inset:0,top:54,display:"flex",flexDirection:"column",background:T.card,zIndex:50 }}>
      {half(1, true)}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:14,padding:"6px 12px",background:T.ink,color:"#fff" }}>
        <span style={{ fontSize:12,fontWeight:800 }}>รอบ {r+1}/10</span>
        <button onClick={() => speak(cur.w.word, null)} aria-label="ฟังคำ" style={{ minHeight:52,minWidth:72,borderRadius:26,border:"none",background:T.primary,color:T.onPrimary,fontSize:20,fontWeight:900,padding:"0 16px",cursor:"pointer",fontFamily:FONT }}>🔊 {cur.w.word}</button>
        <button onClick={onExit} style={{ minHeight:44,borderRadius:16,border:"none",background:"transparent",color:T.ink3,fontSize:12,fontWeight:700,cursor:"pointer" }}>ออก</button>
      </div>
      {half(0, false)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PET ROOM — ห้องเพื่อนคู่หู: ดูแล (ให้อาหาร/อาบน้ำ/เล่น/นอน) + แต่งห้อง
//  เพื่อนพูดภาษาอังกฤษทุกครั้งที่ดูแล · ค่าสถานะลดตามเวลาจริง (tickCare)
// ═══════════════════════════════════════════════════════
function PetRoom({ progress, setProgress, speak, showToast, onShop }) {
  const pet = getPet(progress);
  const care = useMemo(() => tickCare(progress.care), [progress.care]);
  const [anim, setAnim] = useState(null);      // eat | wash | play | sleep
  const [feedOpen, setFeedOpen] = useState(false);
  const [tab, setTab] = useState("care");       // care | room
  const [bubble, setBubble] = useState(null);
  // sync tick ทุก 60 วิ
  useEffect(() => { const t = setInterval(() => setProgress(p => ({ ...p, care: tickCare(p.care) })), 60000); setProgress(p => ({ ...p, care: tickCare(p.care) })); return () => clearInterval(t); }, []);
  if (!pet) return <div style={{ padding:24,textAlign:"center",color:T.ink2 }}>เลือกเพื่อนคู่หูที่หน้าแรกก่อนนะ</div>;
  const mood = anim === "eat" || anim === "play" ? "excited" : anim === "sleep" || care.sleeping ? "sleepy" : careMood(care);
  const say = (en, th) => { setBubble(en); speak(en, th); setTimeout(() => setBubble(null), 2600); };
  const doAction = (a, food) => {
    if (care.sleeping && a.id !== "sleep") { showToast(`${pet.name} กำลังนอน ปลุกก่อนนะ 💤`, "warn"); return; }
    if (a.id === "sleep") {
      setProgress(p => ({ ...p, care: { ...tickCare(p.care), sleeping: !tickCare(p.care).sleeping } }));
      if (!care.sleeping) say(a.en, a.th); else say("Good morning!", "อรุณสวัสดิ์");
      setAnim("sleep"); setTimeout(() => setAnim(null), 1200); return;
    }
    const cost = food ? food.cost : a.cost;
    if (cost && progress.coins < cost) { sfx.bad(); showToast(`เหรียญไม่พอ (ต้องการ ${cost} 🪙) ไปเล่นเกมเก็บเหรียญก่อนนะ`, "warn"); return; }
    if (a.energyCost && care.energy < a.energyCost) { showToast(`${pet.name} เหนื่อยแล้ว ให้นอนก่อน 😴`, "warn"); return; }
    const gain = food ? food.gain : a.gain;
    sfx.coin(); fx.burst(innerWidth / 2, 240, { count: 16 }); setAnim(a.anim); setTimeout(() => setAnim(null), 1400);
    setProgress(p => {
      const c = tickCare(p.care); const today = new Date().toDateString();
      const first = c.lastCareDay !== today;
      const n = { ...c, [a.stat]: Math.min(CARE_MAX, c[a.stat] + gain), energy: Math.max(0, c.energy - (a.energyCost || 0)), lastCareDay: today, streakCare: first ? (c.streakCare || 0) + 1 : c.streakCare, fedToday: a.id === "feed" ? (first ? 1 : (c.fedToday || 0) + 1) : (first ? 0 : c.fedToday) };
      const bonus = first ? 5 : 0; if (bonus) setTimeout(() => showToast(`ดูแลเพื่อนวันแรกของวัน +${bonus} 🪙`), 300);
      return bumpDaily({ ...p, coins: p.coins - cost + bonus, care: n, totalCorrect: p.totalCorrect + (a.id === "play" ? 1 : 0) }, "care", 1);
    });
    if (food) say(`Yummy ${food.en}! Thank you!`, `${food.name}อร่อยจัง ขอบคุณนะ`); else say(a.en, a.th);
    setFeedOpen(false);
  };
  const Stat = ({ icon, label, v, color }) => (
    <div style={{ flex:1,minWidth:0 }}>
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:800,color:T.ink2 }}><span>{icon} {label}</span><span style={{ color:v<30?T.error:T.ink2 }}>{Math.round(v)}</span></div>
      <div style={{ height:8,background:"rgba(148,163,184,.25)",borderRadius:999,overflow:"hidden",marginTop:3 }}><div style={{ height:"100%",width:`${v}%`,background:v<30?T.grad:color,borderRadius:999,transition:"width .6s" }} /></div>
    </div>
  );
  const on = slot => ROOM_ITEMS.find(i => i.id === progress.roomOn?.[slot]);
  const avg = (care.hunger + care.clean + care.fun + care.energy) / 4;
  return (
    <div style={{ padding:"8px 16px 24px",maxWidth:520,margin:"0 auto" }}>
      {/* ห้อง */}
      <div style={{ position:"relative",borderRadius:28,overflow:"hidden",height:300,boxShadow:T.shadowLg,background:care.sleeping?"linear-gradient(180deg,#1e1b4b 0%,#312e81 60%,#3b2a5a 100%)":"linear-gradient(180deg,#fde68a 0%,#fef3c7 55%,#d9b38c 55%,#c99a6b 100%)",transition:"background 1s" }}>
        {care.sleeping && [...Array(12)].map((_, i) => <span key={i} style={{ position:"absolute",left:`${(i*41)%100}%`,top:`${(i*29)%50}%`,width:3,height:3,borderRadius:2,background:T.card,opacity:.8,animation:`vpBlink ${2+i%3}s infinite` }} />)}
        {/* ผนัง: หน้าต่าง/รูป/ทีวี */}
        {on("wall") && <span style={{ position:"absolute",left:"50%",top:16,transform:"translateX(-50%)",fontSize:52,filter:"drop-shadow(0 4px 8px rgba(0,0,0,.2))" }}>{on("wall").emoji}</span>}
        {on("ceiling") && <span style={{ position:"absolute",left:14,top:8,fontSize:36,animation:"vpFloatY 3s ease-in-out infinite" }}>{on("ceiling").emoji}</span>}
        {on("ceiling") && <span style={{ position:"absolute",right:14,top:8,fontSize:36,animation:"vpFloatY 3s 1s ease-in-out infinite" }}>{on("ceiling").emoji}</span>}
        {/* พื้น */}
        {on("floor") && <span style={{ position:"absolute",left:"50%",bottom:18,transform:"translateX(-50%) scaleX(2.6) scaleY(.7)",fontSize:60,opacity:.85 }}>{on("floor").emoji}</span>}
        {on("left") && <span style={{ position:"absolute",left:12,bottom:42,fontSize:54,filter:"drop-shadow(0 6px 8px rgba(0,0,0,.2))" }}>{on("left").emoji}</span>}
        {on("right") && <span style={{ position:"absolute",right:12,bottom:42,fontSize:54,filter:"drop-shadow(0 6px 8px rgba(0,0,0,.2))" }}>{on("right").emoji}</span>}
        {/* เพื่อน */}
        <div style={{ position:"absolute",left:"50%",bottom:34,transform:"translateX(-50%)",animation:anim==="play"?"petHop .4s ease-in-out infinite":anim==="eat"?"vpWiggle .5s infinite":"none" }}>
          <PetAvatar pet={pet} hat={progress.hat} outfit={progress.outfit} size={92} mood={mood} talk={!!bubble} bounce />
        </div>
        {/* เอฟเฟกต์การกระทำ */}
        {anim === "wash" && [...Array(8)].map((_, i) => <span key={i} style={{ position:"absolute",left:`${35+(i*9)%30}%`,bottom:60+(i*17)%80,fontSize:20+i%3*6,animation:`vpFloatY ${1+i%3*.3}s infinite`,opacity:.9 }}>🫧</span>)}
        {anim === "eat" && <span style={{ position:"absolute",left:"58%",bottom:120,fontSize:30,animation:"vpInScale .4s both" }}>😋</span>}
        {anim === "play" && <span style={{ position:"absolute",left:"30%",bottom:150,fontSize:34,animation:"vpFloatY .5s infinite" }}>⚽</span>}
        {(anim === "sleep" || care.sleeping) && <span style={{ position:"absolute",left:"60%",bottom:170,fontSize:22,color:T.primary,fontWeight:900,animation:"petZ 2s infinite" }}>z z</span>}
        {bubble && <div style={{ position:"absolute",left:"50%",top:70,transform:"translateX(-50%)",background:T.card,borderRadius:16,padding:"8px 14px",fontWeight:800,fontSize:14,color:T.ink,boxShadow:T.shadow,animation:"vpInScale .3s both",maxWidth:"80%",textAlign:"center" }}>{bubble}<span style={{ position:"absolute",left:"50%",bottom:-8,transform:"translateX(-50%)",borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:"8px solid #fff" }} /></div>}
        <div style={{ position:"absolute",top:12,left:14,background:"rgba(255,255,255,.85)",borderRadius:999,padding:"4px 12px",fontSize:12,fontWeight:800,color:T.ink }}>{pet.name} · Lv.{pet.level} · {avg >= 75 ? "😊 มีความสุข" : avg >= 40 ? "🙂 สบายดี" : "😢 ต้องการดูแล"}</div>
        <div style={{ position:"absolute",top:12,right:14,background:"rgba(255,255,255,.85)",borderRadius:999,padding:"4px 12px",fontSize:12,fontWeight:800,color:T.onTertiaryC }}>🪙 {progress.coins}</div>
      </div>

      {/* สถานะ */}
      <div style={{ ...card(),padding:"12px 14px",margin:"12px 0",display:"flex",gap:12 }}>
        <Stat icon="🍎" label="อิ่ม" v={care.hunger} color={T.grad} />
        <Stat icon="🫧" label="สะอาด" v={care.clean} color={T.grad} />
        <Stat icon="⚽" label="สนุก" v={care.fun} color={T.grad} />
        <Stat icon="⚡" label="พลัง" v={care.energy} color={T.grad} />
      </div>

      <div style={{ display:"flex",gap:6,marginBottom:10 }}>
        {[["care","💖 ดูแล"],["room","🛋️ แต่งห้อง"]].map(([k,l]) => <button key={k} onClick={() => { sfx.tap(); setTab(k); }} style={{ flex:1,minHeight:44,borderRadius:16,border:"none",fontWeight:800,fontSize:14,cursor:"pointer",background:tab===k?T.grad:"rgba(148,163,184,.18)",color:tab===k?"#fff":T.ink,fontFamily:FONT }}>{l}</button>)}
      </div>

      {tab === "care" && !feedOpen && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
          {CARE_ACTIONS.map(a => (
            <button key={a.id} className="vp-card-hover" onClick={() => a.id === "feed" ? (sfx.tap(), setFeedOpen(true)) : doAction(a)} style={{ ...card(),minHeight:88,padding:"10px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontFamily:FONT }}>
              <span style={{ fontSize:30 }}>{a.id === "sleep" && care.sleeping ? "☀️" : a.emoji}</span>
              <span style={{ fontSize:12,fontWeight:800,color:T.ink }}>{a.id === "sleep" && care.sleeping ? "ปลุก" : a.label}</span>
              <span style={{ fontSize:10,color:T.ink3 }}>{a.id === "feed" ? "ใช้เหรียญ" : a.id === "sleep" ? "ฟื้นพลัง" : `+${a.gain}`}</span>
            </button>
          ))}
        </div>
      )}
      {tab === "care" && feedOpen && (
        <div style={{ ...card(),padding:12 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}><b style={{ color:T.ink }}>🍽️ เลือกอาหาร (แตะแล้วฟังชื่อภาษาอังกฤษ)</b><button onClick={() => setFeedOpen(false)} style={{ minHeight:44,border:"none",background:"none",color:T.ink3,fontWeight:800,cursor:"pointer" }}>ปิด</button></div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
            {FOODS.map(f => <button key={f.id} onClick={() => doAction(CARE_ACTIONS[0], f)} style={{ minHeight:84,borderRadius:16,border:"1px solid rgba(148,163,184,.3)",background:"rgba(255,255,255,.6)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,fontFamily:FONT }}><span style={{ fontSize:30 }}>{f.emoji}</span><b style={{ fontSize:12,color:T.ink }}>{f.en.toUpperCase()}</b><span style={{ fontSize:10,color:T.ink3 }}>{f.name} · 🪙{f.cost} · +{f.gain}</span></button>)}
          </div>
        </div>
      )}
      {tab === "room" && (
        <div>
          <div style={{ fontSize:12,color:T.ink2,marginBottom:8 }}>ซื้อแล้วแตะเพื่อวาง/เก็บ · แต่ละตำแหน่งวางได้ 1 ชิ้น (ผนัง · เพดาน · พื้น · ซ้าย · ขวา)</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
            {ROOM_ITEMS.map(it => {
              const owned = !!progress.room?.[it.id]; const placed = progress.roomOn?.[it.slot] === it.id;
              return (
                <button key={it.id} onClick={() => {
                  if (!owned) { if (progress.coins < it.cost) { sfx.bad(); showToast(`เหรียญไม่พอ ขาด ${it.cost - progress.coins} 🪙`, "warn"); return; } sfx.coin(); fx.burst(innerWidth/2, 200, { count: 18 }); setProgress(p => ({ ...p, coins:p.coins-it.cost, room:{ ...(p.room||{}), [it.id]:true }, roomOn:{ ...(p.roomOn||{}), [it.slot]: it.id } })); showToast(`ซื้อ${it.name}แล้ว ✓`); }
                  else { sfx.tap(); setProgress(p => ({ ...p, roomOn:{ ...(p.roomOn||{}), [it.slot]: placed ? null : it.id } })); }
                }} style={{ ...card(),minHeight:92,padding:"8px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:FONT,border:placed?"2px solid #a855f7":undefined }}>
                  <span style={{ fontSize:30 }}>{it.emoji}</span>
                  <span style={{ fontSize:11,fontWeight:800,color:T.ink }}>{it.name}</span>
                  <span style={{ fontSize:10,fontWeight:800,color:placed?T.primary:owned?T.ink3:"#b45309" }}>{placed ? "วางอยู่ ✓" : owned ? "แตะเพื่อวาง" : `🪙 ${it.cost}`}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ fontSize:11,color:T.ink3,textAlign:"center",marginTop:12 }}>ค่าสถานะลดลงตามเวลาจริง · ดูแลครั้งแรกของวันได้ +5 🪙 · ดูแลต่อเนื่อง {care.streakCare || 0} วัน</div>
    </div>
  );
}

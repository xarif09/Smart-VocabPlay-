import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { imageTitleOf, cachedImageUrl, fetchImageUrl, wikiPageUrl, bundledCount } from "./images.js";
import { DIALOGUES, STORIES, PHONICS } from "./content.js";
import { loadProgress, saveProgress, bumpStreak, starsFor, starsByWrong, STICKER_NEED, PETS, getPet, petLevel, EMPTY_PROGRESS,
  srsCorrect, srsWrong, isDue, isMastered, missionsForDate, ensureDaily, bumpDaily, EMPTY_DAILY, SHOP_ITEMS, today,
  loadProfiles, saveProfiles, deleteProgress, AVATARS, buildUnits, UNIT_STEPS, unitDone, unitSteps, markUnitStep, similarity } from "./progress.js";
import { lexOf } from "./lexicon.js";
import { sfx, unlockSfx, setSfxEnabled } from "./sfx.js";

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

// Speak EN then TH — must be called from onClick
function speakWord(en, th, rate = 0.85, bilingual = true) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

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
        const thU = new SpeechSynthesisUtterance(th);
        thU.lang = "th-TH";
        thU.rate = rate;
        thU.volume = 1;
        const thV = getVoice("th");
        if (thV) thU.voice = thV;
        window.speechSynthesis.speak(thU);
      };
      enU.onend = doThai;
      // iOS sometimes doesn't fire onend — fallback timer
      const ms = Math.max(800, Math.ceil((en.length * 100) / rate));
      setTimeout(doThai, ms + 300);
    }

    window.speechSynthesis.speak(enU);
  }, 50); // 50ms gap after cancel() — iOS needs this
}

// ═══════════════════════════════════════════════════════
// VOCABULARY DATA — 300+ words
// ═══════════════════════════════════════════════════════
const CATEGORIES = [
  { id:"animals",  label:"Animals",  thai:"สัตว์",      emoji:"🦁", color:"#F59E0B", games:["quiz","spell","memory","habitat"] },
  { id:"fruits",   label:"Fruits",   thai:"ผลไม้",      emoji:"🍎", color:"#EF4444", games:["quiz","spell","memory","speed"] },
  { id:"food",     label:"Food",     thai:"อาหาร",      emoji:"🍕", color:"#F97316", games:["quiz","spell","memory"] },
  { id:"colors",   label:"Colors",   thai:"สี",         emoji:"🎨", color:"#8B5CF6", games:["quiz","match","colormix"] },
  { id:"school",   label:"School",   thai:"โรงเรียน",   emoji:"🎒", color:"#3B82F6", games:["quiz","spell","memory"] },
  { id:"body",     label:"Body",     thai:"ร่างกาย",    emoji:"👁️", color:"#EC4899", games:["quiz","bodydr"] },
  { id:"weather",  label:"Weather",  thai:"อากาศ",      emoji:"🌈", color:"#06B6D4", games:["quiz","dress"] },
  { id:"numbers",  label:"Numbers",  thai:"ตัวเลข",     emoji:"🔢", color:"#10B981", games:["quiz","count"] },
  { id:"vehicles", label:"Vehicles", thai:"ยานพาหนะ",   emoji:"🚗", color:"#6366F1", games:["quiz","spell","memory"] },
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
];

// หมวดพิเศษ "ทบทวนคำที่พลาด" (ไม่อยู่ในตารางหมวด)
const REVIEW_CAT = { id:"review", label:"ทบทวนคำที่พลาด", thai:"ทบทวน", emoji:"🔁", color:"#F97316", games:["quiz"] };

// เกมเสริมที่ทุกหมวดมี (ฟัง / เรียงประโยค / พูดตาม)
const EXTRA_GAMES = ["listen", "sentence", "speak"];
CATEGORIES.forEach(c => c.games.push(...EXTRA_GAMES));

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
  const [showSettings, setShowSettings] = useState(false);
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
  // อ่านหลายประโยคต่อกัน (บทสนทนา) — คิวทั้งหมดทันทีใน onClick ไม่ใช้ timer
  const speakSeq = useCallback((items) => {
    if (!soundOn || !soundUnlocked || !window.speechSynthesis) return;
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
  const goHome     = () => { setScreen("home"); setActiveCat(null); setActiveGame(null); };
  const goCat      = cat => { setActiveCat(cat); setScreen("category"); };
  const goGame     = gid => { setActiveGame(gid); setScreen("game"); };
  const goManage   = () => setScreen("manage");
  const goStickers = () => setScreen("stickers");
  const goShop     = () => setScreen("shop");
  const goReport   = () => setScreen("report");
  const goCredits  = () => setScreen("credits");
  const goLearn    = () => setScreen("learn");
  const goPath     = () => setScreen("path");
  const [activeDialog, setActiveDialog] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const goTalk     = () => { setActiveDialog(null); setScreen("talk"); };
  const goStories  = () => { setActiveStory(null); setScreen("stories"); };
  const goPhonics  = () => setScreen("phonics");
  // เส้นทางบทเรียน: เปิดขั้นของบท (learn / quiz / listen) ด้วยหมวดเสมือน unit:<id>
  const goUnitStep = (u, step) => {
    setActiveCat({ ...u.cat, id: `unit:${u.id}`, label: `บทที่ ${u.n} · ${u.cat.label}`, unit: u });
    if (step === "learn") { setActiveGame(null); setScreen("learn"); }
    else { setActiveGame(step); setScreen("game"); }
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
  const goReview   = () => { setActiveCat(REVIEW_CAT); setActiveGame("quiz"); setScreen("game"); };
  const goBack     = () => {
    if (screen === "game" && activeCat?.id === "review") { goHome(); }
    else if (screen === "talk" && activeDialog) { setActiveDialog(null); }
    else if (screen === "stories" && activeStory) { setActiveStory(null); }
    else if (screen === "game" && activeCat?.id === "phonics:all") { setScreen("phonics"); setActiveCat(null); setActiveGame(null); }
    else if ((screen === "game" || screen === "learn") && activeCat?.unit) { setScreen("path"); setActiveGame(null); setActiveCat(null); }
    else if (screen === "game" || screen === "learn") { setScreen("category"); setActiveGame(null); }
    else if (screen === "category") { goHome(); }
    else                       { goHome(); }
  };

  // คำที่ถึงกำหนดทบทวนวันนี้ (SRS) + คำที่เคยพลาด เรียงจากพลาดบ่อยสุด
  const missedWords = useMemo(() => {
    const m = progress.mistakes || {}, srs = progress.srs || {};
    return words.filter(w => m[w.id] > 0 || isDue(srs, w.id)).sort((a, b) => (m[b.id] || 0) - (m[a.id] || 0));
  }, [words, progress.mistakes, progress.srs]);
  const stickerCount = useMemo(() => words.filter(w => (progress.stickers[w.id] || 0) >= STICKER_NEED).length, [words, progress.stickers]);

  const catWords = useMemo(
    () => !activeCat ? [] : activeCat.unit ? activeCat.unit.words : activeCat.id === "review" ? missedWords.slice(0, 10) : activeCat.id === "phonics:all" ? words : words.filter(w => w.cat === activeCat.id),
    [words, activeCat, missedWords]
  );
  const units = useMemo(() => buildUnits(words, CATEGORIES), [words]);

  // ตัวเลขบนไอคอนแอป (เมื่อติดตั้งแล้ว) = จำนวนคำที่ถึงเวลาทบทวน
  useEffect(() => {
    try { if (navigator.setAppBadge) { missedWords.length ? navigator.setAppBadge(missedWords.length) : navigator.clearAppBadge?.(); } } catch (_) {}
  }, [missedWords.length]);

  // ── Sound unlock screen ──────────────────
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

  return (
    <PicCtx.Provider value={realPics}>
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#fafafa", minHeight: "100dvh" }}>
      {/* TOPBAR */}
      <Topbar
        screen={screen} catLabel={activeCat?.label}
        onBack={screen !== "home" ? goBack : null}
        onHome={goHome}
        soundOn={soundOn} onToggleSound={() => setSoundOn(s => !s)}
        onSettings={() => setShowSettings(true)}
        onManage={goManage}
        streak={progress.streak.count}
      />

      {/* CONTENT — padded below topbar */}
      <div style={{ paddingTop: 54 }}>
        {screen === "home" && (
          <HomeScreen categories={CATEGORIES} words={words} onPickCat={goCat}
            progress={progress} setProgress={setProgress} stickerCount={stickerCount}
            missedCount={missedWords.length} onReview={goReview} onStickers={goStickers} onShop={goShop} onPath={goPath} onTalk={goTalk} onStories={goStories} onPhonics={goPhonics} speak={speak}
            units={units} profile={profiles.list.find(x => x.id === profiles.current)} onProfiles={() => setShowProfiles(true)}
            install={!installHidden ? { evt: installEvt, onInstall: async () => { try { installEvt.prompt(); const r = await installEvt.userChoice; if (r?.outcome === "accepted") showToast("ติดตั้งแล้ว 📲"); } catch (_) {} setInstallEvt(null); },
              onDismiss: () => { setInstallHidden(true); try { localStorage.setItem("smart-vocabplay:install-hidden", "1"); } catch (_) {} } } : null} />
        )}
        {screen === "category" && activeCat && (
          <CategoryScreen cat={activeCat} words={catWords} onPickGame={goGame} onLearn={goLearn} progress={progress} showToast={showToast} />
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
        {screen === "shop" && (
          <ShopScreen progress={progress} setProgress={setProgress} showToast={showToast} />
        )}
        {screen === "report" && (
          <ReportScreen words={words} categories={CATEGORIES} progress={progress} />
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
      </div>

      {/* SETTINGS */}
      {showProfiles && (
        <ProfileSheet profiles={profiles} onSwitch={switchProfile} onAdd={addProfile} onDelete={removeProfile} onClose={() => setShowProfiles(false)} />
      )}

      {showSettings && (
        <SettingsSheet
          soundOn={soundOn} setSoundOn={setSoundOn}
          bilingual={bilingual} setBilingual={setBilingual}
          rate={rate} setRate={setRate}
          onResetProgress={() => { setProgress(ensureDaily({ ...EMPTY_PROGRESS })); setShowSettings(false); showToast("เริ่มใหม่แล้ว ✓"); }}
          onReport={() => { setShowSettings(false); goReport(); }}
          onCredits={() => { setShowSettings(false); goCredits(); }}
          realPics={realPics} setRealPics={setRealPics}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* UPDATE BANNER — มีเวอร์ชันใหม่ */}
      {updateReg && (
        <div style={{ position:"fixed",left:12,right:12,bottom:16,zIndex:8900,background:"#1f2937",color:"#fff",borderRadius:16,padding:"10px 12px 10px 16px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 10px 30px rgba(0,0,0,0.3)",maxWidth:456,margin:"0 auto" }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontWeight:800,fontSize:13 }}>🎁 มีเวอร์ชันใหม่ของแอป</div>
            <div style={{ fontSize:11,opacity:0.8 }}>ตอนนี้ v{APP_VERSION} · แตะอัปเดตเพื่อโหลดของใหม่</div>
          </div>
          <button onClick={() => { try { updateReg.waiting?.postMessage("SKIP_WAITING"); } catch (_) {} setTimeout(() => window.location.reload(), 1500); }}
            style={{ minHeight:44,padding:"0 14px",borderRadius:12,border:"none",background:"#10b981",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer" }}>อัปเดต</button>
          <button onClick={() => setUpdateReg(null)} style={{ width:44,height:44,borderRadius:12,border:"none",background:"transparent",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
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
    <div style={{
      minHeight:"100dvh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:"linear-gradient(160deg,#fdf2f8,#eff6ff)",
      padding:24, textAlign:"center",
    }}>
      <div style={{ fontSize:80, marginBottom:16 }}>📚</div>
      <h1 style={{ fontSize:28, fontWeight:900, color:"#1f2937", margin:"0 0 8px" }}>
        Smart VocabPlay
      </h1>
      <p style={{ fontSize:15, color:"#6b7280", margin:"0 0 32px", lineHeight:1.6 }}>
        403 คำพร้อมรูปจริง · บทสนทนา 💬 · นิทานภาพ 📖 · โฟนิกส์ 🔤<br/>เกม 18 แบบ · พูดตาม 🎤 · เก็บดาว ⭐ · เลี้ยงเพื่อนคู่หู 🐣
      </p>
      <button
        onClick={onUnlock}
        style={{
          background:"linear-gradient(135deg,#EF4444,#F97316)",
          color:"#fff", border:"none", borderRadius:20,
          padding:"18px 40px", fontSize:20, fontWeight:800,
          boxShadow:"0 8px 24px rgba(239,68,68,0.4)",
          cursor:"pointer", letterSpacing:0.5,
        }}
      >
        🔊 แตะเพื่อเริ่มเลย!
      </button>
      <p style={{ fontSize:11, color:"#9ca3af", marginTop:16 }}>
        * แตะปุ่มนี้เพื่อเปิดใช้เสียงบนมือถือ<br/>
        <span style={{ fontWeight:700,color:"#6b7280" }}>v{APP_VERSION}</span>{BUILD_TIME && <span> · build {BUILD_TIME}</span>}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════
function Topbar({ screen, catLabel, onBack, onHome, soundOn, onToggleSound, onSettings, onManage, streak }) {
  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, height:54, zIndex:100,
      background:"rgba(255,255,255,0.96)", backdropFilter:"blur(8px)",
      borderBottom:"1px solid #e5e7eb",
      display:"flex", alignItems:"center", gap:8, padding:"0 10px",
    }}>
      {/* Left */}
      {onBack
        ? <Btn onClick={onBack} style={{ fontSize:24, width:44, height:44, borderRadius:22, background:"#f3f4f6" }}>‹</Btn>
        : <button onClick={onHome} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", padding:0, minHeight:44 }}>
            <div style={{ width:30,height:30,borderRadius:10,background:"linear-gradient(135deg,#F43F5E,#F97316)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📚</div>
            <span style={{ fontWeight:800, fontSize:14, color:"#1f2937" }}>VocabPlay</span>
          </button>
      }

      {/* Centre */}
      <div style={{ flex:1, overflow:"hidden" }}>
        {catLabel && <span style={{ fontWeight:700,fontSize:13,color:"#374151",display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{catLabel}</span>}
        {screen==="home" && streak>0 && <span style={{ fontSize:12,fontWeight:800,color:"#ea580c",whiteSpace:"nowrap" }}>🔥 {streak} วัน</span>}
        {screen==="manage" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>จัดการคำศัพท์</span>}
        {screen==="stickers" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>สมุดสติกเกอร์</span>}
        {screen==="shop" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>ร้านค้า</span>}
        {screen==="report" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>รายงานผู้ปกครอง</span>}
        {screen==="credits" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>เครดิตรูปภาพ</span>}
        {screen==="path" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>เส้นทางบทเรียน</span>}
        {screen==="talk" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>บทสนทนา</span>}
        {screen==="stories" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>นิทานภาพ</span>}
        {screen==="phonics" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>โฟนิกส์</span>}
      </div>

      {/* Right */}
      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
        <Btn onClick={onToggleSound} style={IB}>{soundOn?"🔊":"🔇"}</Btn>
        <Btn onClick={onSettings} style={IB}>⚙️</Btn>
        {screen==="home"
          ? <Btn onClick={onManage} style={{ ...IB, background:"#1f2937", fontSize:12, color:"#fff", fontWeight:700, borderRadius:12, padding:"0 10px", width:"auto" }}>✏️ จัดการ</Btn>
          : null
        }
      </div>
    </div>
  );
}
const IB = { width:44,height:44,borderRadius:22,background:"#f3f4f6",fontSize:19 };
const Btn = ({ onClick, children, style={} }) => (
  <button onClick={onClick} style={{ border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",...style }}>
    {children}
  </button>
);

// ═══════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════
function HomeScreen({ categories, words, onPickCat, progress, setProgress, stickerCount, missedCount, onReview, onStickers, onShop, onPath, onTalk, onStories, onPhonics, speak, units, profile, onProfiles, install }) {
  const unitsDone = units.filter(u => unitDone(progress.path, u)).length;
  const nextUnit = units.find(u => !unitDone(progress.path, u));
  return (
    <div style={{ padding:"14px 10px 40px",maxWidth:480,margin:"0 auto" }}>
      <PetCard progress={progress} setProgress={setProgress} stickerCount={stickerCount} totalWords={words.length} onStickers={onStickers} onShop={onShop} speak={speak} profile={profile} onProfiles={onProfiles} />
      {install && <InstallBanner deferred={install.evt} onInstall={install.onInstall} onDismiss={install.onDismiss} />}

      {/* เส้นทางบทเรียน */}
      {progress.pet && (
        <button onClick={()=>{ sfx.tap(); onPath(); }}
          style={{ width:"100%",minHeight:64,background:"linear-gradient(135deg,#10b981,#3b82f6)",color:"#fff",border:"none",borderRadius:16,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",boxShadow:"0 6px 18px rgba(16,185,129,0.3)" }}>
          <span style={{ fontSize:28 }}>🗺️</span>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontWeight:900,fontSize:15 }}>เส้นทางบทเรียน A1 → A2</div>
            <div style={{ fontSize:11,opacity:0.9 }}>{nextUnit ? `ผ่านแล้ว ${unitsDone}/${units.length} บท · ต่อไป: บทที่ ${nextUnit.n} ${nextUnit.cat.thai}` : `ผ่านครบทุกบทแล้ว! 🎓`}</div>
          </div>
          <span style={{ fontSize:20,opacity:0.8 }}>›</span>
        </button>
      )}
      {/* เรียนรู้มากกว่าคำศัพท์ */}
      {progress.pet && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14 }}>
          {[["💬","บทสนทนา",`${DIALOGUES.length} สถานการณ์`,"#f97316",onTalk],["📖","นิทานภาพ",`${STORIES.length} เรื่อง`,"#8b5cf6",onStories],["🔤","โฟนิกส์","A–Z + เกม","#06b6d4",onPhonics]].map(([e,t,sub,c,fn]) => (
            <button key={t} onClick={()=>{ sfx.tap(); fn(); }} style={{ minHeight:88,background:"#fff",border:`2px solid ${c}40`,borderRadius:16,padding:"10px 6px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <span style={{ fontSize:26 }}>{e}</span>
              <span style={{ fontWeight:800,fontSize:13,color:"#1f2937" }}>{t}</span>
              <span style={{ fontSize:10,color:c,fontWeight:700 }}>{sub}</span>
            </button>
          ))}
        </div>
      )}
      {progress.pet && <MissionsCard progress={progress} setProgress={setProgress} />}

      {missedCount > 0 && (
        <button onClick={()=>{ sfx.tap(); onReview(); }}
          style={{ width:"100%",minHeight:56,background:"#fff7ed",border:"2px solid #fdba74",borderRadius:16,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left" }}>
          <span style={{ fontSize:28 }}>🔁</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800,fontSize:14,color:"#9a3412" }}>ทบทวนวันนี้</div>
            <div style={{ fontSize:11,color:"#c2410c" }}>มี {missedCount} คำถึงเวลาทบทวน (คำที่พลาด + คำที่ครบกำหนด)</div>
          </div>
          <span style={{ color:"#fb923c",fontSize:20 }}>›</span>
        </button>
      )}

      <p style={{ textAlign:"center",margin:"0 0 10px",fontSize:13,color:"#6b7280" }}>แตะหมวดที่อยากเรียน 👇</p>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {categories.map((cat,i) => {
          const n = words.filter(w=>w.cat===cat.id).length;
          const got = cat.games.reduce((a,g)=>a+(progress.stars[`${cat.id}:${g}`]||0),0);
          const max = cat.games.length*3;
          const crown = !!progress.boss[cat.id];
          return (
            <button key={cat.id} onClick={()=>{ sfx.tap(); onPickCat(cat); }}
              style={{
                background:"#fff", borderRadius:18, padding:"14px 10px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.07)",
                border:`2px solid ${cat.color}30`,
                display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                cursor:"pointer", opacity:n===0?0.5:1, position:"relative",
                animationDelay:`${i*25}ms`,
              }}>
              {crown && <span style={{ position:"absolute",top:6,right:8,fontSize:18 }}>👑</span>}
              <div style={{ width:50,height:50,borderRadius:15,background:`${cat.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>{cat.emoji}</div>
              <span style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{cat.label}</span>
              <span style={{ fontSize:11,color:"#6b7280" }}>{cat.thai}</span>
              <span style={{ fontSize:11,fontWeight:700,color:cat.color,background:`${cat.color}18`,padding:"2px 10px",borderRadius:999 }}>{n} คำ</span>
              <span style={{ fontSize:11,fontWeight:800,color:got>0?"#d97706":"#d1d5db" }}>⭐ {got}/{max}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CATEGORY SCREEN
// ═══════════════════════════════════════════════════════
function CategoryScreen({ cat, words, onPickGame, onLearn, progress, showToast }) {
  const starOf = g => progress.stars[`${cat.id}:${g}`] || 0;
  const needForBoss = cat.games.filter(g => g !== "speak");   // พูดตามไม่บังคับ (บางเครื่องไม่รองรับ)
  const bossOpen = needForBoss.every(g => starOf(g) >= 1);
  const learnedN = words.filter(w => progress.learned[w.id] || progress.srs[w.id]).length;
  const crowned = !!progress.boss[cat.id];
  const Stars = ({ n }) => <span style={{ fontSize:13,letterSpacing:1,flexShrink:0 }}>{[1,2,3].map(i => <span key={i} style={{ opacity:i<=n?1:0.2 }}>⭐</span>)}</span>;
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:`${cat.color}15`,borderRadius:18,padding:14,display:"flex",alignItems:"center",gap:12,marginBottom:18,border:`2px solid ${cat.color}30` }}>
        <div style={{ width:52,height:52,borderRadius:14,background:`${cat.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0 }}>{cat.emoji}</div>
        <div>
          <div style={{ fontWeight:800,fontSize:17,color:"#1f2937" }}>{cat.thai} {crowned && "👑"}</div>
          <div style={{ fontSize:12,color:"#6b7280" }}>{words.length} คำ · ⭐ {cat.games.reduce((a,g)=>a+starOf(g),0)}/{cat.games.length*3}</div>
        </div>
      </div>

      {/* โหมดเรียน */}
      <button onClick={()=>{ sfx.tap(); onLearn(); }}
        style={{ width:"100%",background:"linear-gradient(135deg,#7c3aed,#ec4899)",color:"#fff",borderRadius:16,padding:"13px 14px",minHeight:64,marginBottom:16,display:"flex",alignItems:"center",gap:12,border:"none",cursor:"pointer",textAlign:"left",boxShadow:"0 6px 18px rgba(124,58,237,0.3)" }}>
        <span style={{ fontSize:28,width:36,textAlign:"center",flexShrink:0 }}>📖</span>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:900,fontSize:15 }}>เรียนคำศัพท์ก่อนเล่น</div>
          <div style={{ fontSize:11,opacity:0.9,marginTop:1 }}>การ์ดพลิกได้ · คำอ่านไทย · ประโยคตัวอย่าง · เรียนแล้ว {learnedN}/{words.length} คำ</div>
        </div>
        <span style={{ fontSize:20,flexShrink:0,opacity:0.8 }}>›</span>
      </button>

      <p style={{ fontWeight:700,fontSize:11,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,margin:"0 0 10px" }}>เลือกเกม</p>
      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {cat.games.map((gid,i)=>{
          const g=GAME_META[gid]; if(!g) return null;
          return (
            <button key={gid} onClick={()=>{ sfx.tap(); onPickGame(gid); }}
              style={{ background:"#fff",borderRadius:14,padding:"13px 14px",minHeight:60,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",display:"flex",alignItems:"center",gap:12,border:"1px solid #f3f4f6",cursor:"pointer",textAlign:"left" }}>
              <span style={{ fontSize:26,width:36,textAlign:"center",flexShrink:0 }}>{g.emoji}</span>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{g.label}</div>
                <div style={{ fontSize:11,color:"#6b7280",marginTop:1 }}>{g.thai}</div>
              </div>
              <Stars n={starOf(gid)} />
              <span style={{ color:"#d1d5db",fontSize:20,flexShrink:0 }}>›</span>
            </button>
          );
        })}

        {/* ด่านบอส */}
        <button onClick={()=>{ if(bossOpen){ sfx.tap(); onPickGame("boss"); } else { sfx.bad(); showToast("เก็บดาวให้ได้ทุกเกมในหมวดก่อนนะ ⭐","warn"); } }}
          style={{ background:bossOpen?"linear-gradient(135deg,#1f2937,#4c1d95)":"#f3f4f6",color:bossOpen?"#fff":"#9ca3af",borderRadius:14,padding:"13px 14px",minHeight:64,marginTop:6,display:"flex",alignItems:"center",gap:12,border:"none",cursor:"pointer",textAlign:"left",boxShadow:bossOpen?"0 6px 18px rgba(76,29,149,0.35)":"none" }}>
          <span style={{ fontSize:28,width:36,textAlign:"center",flexShrink:0 }}>{bossOpen?"👑":"🔒"}</span>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontWeight:900,fontSize:15 }}>{crowned?"ด่านบอส · ชนะแล้ว 👑":"ด่านบอส"}</div>
            <div style={{ fontSize:11,opacity:0.85,marginTop:1 }}>{bossOpen?"10 ข้อ 3 หัวใจ สลับโจทย์ 3 แบบ · ชนะได้ +50 🪙":`ปลดล็อกเมื่อได้ ⭐ ครบทุกเกม ยกเว้นพูดตาม (${needForBoss.filter(g=>starOf(g)>=1).length}/${needForBoss.length})`}</div>
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
function ManageScreen({ words, setWords, categories, showToast, speak, onReset }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
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
          <div style={{ fontWeight:800,fontSize:18,color:"#1f2937" }}>คลังคำศัพท์</div>
          <div style={{ fontSize:12,color:"#6b7280" }}>{words.length} คำรวม · แสดง {filtered.length}</div>
        </div>
        <button onClick={()=>setShowAdd(s=>!s)}
          style={{ background:"#EF4444",color:"#fff",borderRadius:12,padding:"8px 16px",minHeight:44,fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>
          + เพิ่มคำ
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background:"#fff",borderRadius:16,padding:14,marginBottom:14,boxShadow:"0 2px 12px rgba(0,0,0,0.1)",border:"2px solid #fecdd3" }}>
          <div style={{ fontWeight:700,fontSize:14,color:"#1f2937",marginBottom:10 }}>➕ เพิ่มคำใหม่</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <input placeholder="คำ EN (เช่น APPLE)" value={draft.word}
              onChange={e=>setDraft({...draft,word:e.target.value.toUpperCase()})}
              style={inputStyle} />
            <div style={{ display:"flex",gap:6 }}>
              <input placeholder="ความหมาย TH" value={draft.meaning}
                onChange={e=>setDraft({...draft,meaning:e.target.value})}
                style={{ ...inputStyle,flex:1,minWidth:0 }} />
              <button onClick={autoTranslate} disabled={translating} title="แปลอัตโนมัติ"
                style={{ minWidth:44,minHeight:44,borderRadius:10,border:"none",background:"#ede9fe",color:"#5b21b6",fontSize:16,cursor:"pointer",flexShrink:0 }}>{translating?"…":"✨"}</button>
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
            <button onClick={saveNew} style={{ flex:1,minHeight:44,background:"#EF4444",color:"#fff",borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>บันทึก</button>
            <button onClick={()=>setShowAdd(false)} style={{ flex:1,minHeight:44,background:"#f3f4f6",color:"#374151",borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>ยกเลิก</button>
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
            <div key={w.id} style={{ background:"#fff",borderRadius:14,padding:"10px 12px",boxShadow:"0 1px 6px rgba(0,0,0,0.06)",border:"1px solid #f3f4f6" }}>
              {isEditing
                ? <EditWordRow word={w} categories={categories} onSave={changes=>saveEdit(w.id,changes)} onCancel={()=>setEditingId(null)} />
                : <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <Pic w={w} size={20} radius={10} style={{ flexShrink:0 }} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{w.word} {w.read && <span style={{ fontWeight:600,fontSize:12,color:"#7c3aed" }}>{w.read}</span>}</div>
                      <div style={{ fontSize:12,color:"#6b7280",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                        <span>{w.meaning}</span>
                        <span style={{ background:`${cat?.color||"#999"}20`,color:cat?.color||"#666",padding:"1px 6px",borderRadius:6,fontSize:10,fontWeight:600 }}>{cat?.emoji} {cat?.label}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                      <Btn onClick={()=>speak(w.word,w.meaning)} style={{ width:44,height:44,borderRadius:12,background:"#ede9fe",fontSize:18 }}>🔊</Btn>
                      <Btn onClick={()=>setEditingId(w.id)} style={{ width:44,height:44,borderRadius:12,background:"#fef3c7",fontSize:18 }}>✏️</Btn>
                      <Btn onClick={()=>{if(window.confirm(`ลบ "${w.word}"?`))deleteWord(w.id);}} style={{ width:44,height:44,borderRadius:12,background:"#fee2e2",fontSize:18 }}>🗑️</Btn>
                    </div>
                  </div>
              }
            </div>
          );
        })}
        {filtered.length===0 && <div style={{ textAlign:"center",padding:"40px 0",color:"#9ca3af",fontSize:14 }}>ไม่พบคำที่ค้นหา</div>}
      </div>

      {/* Reset to default words */}
      <button onClick={()=>{ if(window.confirm("คืนค่าคำศัพท์เริ่มต้น?\nคำที่เพิ่ม/แก้/ลบไว้จะหายทั้งหมด")) onReset(); }}
        style={{ width:"100%",minHeight:44,marginTop:20,background:"#fff",color:"#6b7280",border:"1px dashed #d1d5db",borderRadius:12,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer" }}>
        ↺ คืนค่าคำศัพท์เริ่มต้น
      </button>
    </div>
  );
}

const inputStyle = { border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 10px",minHeight:44,fontSize:14,fontFamily:"inherit",width:"100%",outline:"none",background:"#f9fafb" };

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
        <button onClick={()=>onSave(d)} style={{ flex:1,minHeight:44,background:"#10b981",color:"#fff",borderRadius:10,padding:"8px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer" }}>บันทึก ✓</button>
        <button onClick={onCancel} style={{ flex:1,minHeight:44,background:"#f3f4f6",color:"#374151",borderRadius:10,padding:"8px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer" }}>ยกเลิก</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GAME ROUTER — ครอบทุกเกมด้วยระบบรางวัล (ดาว/เหรียญ/สติกเกอร์)
// ═══════════════════════════════════════════════════════
function GameRouter({ gameId, cat, words, speak, speakAt, showToast, onBack, progress, setProgress, allWords }) {
  const [result, setResult] = useState(null);
  const [run, setRun] = useState(0);
  const correctRef = useRef([]);
  const pRef = useRef(progress); pRef.current = progress;

  const track = useMemo(() => ({
    correct: w => { sfx.ok(); if (w) correctRef.current.push(w.id); },
    wrong: w => {
      sfx.bad();
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
      if (cat.unit && stars >= 1) next = markUnitStep(next, cat.unit.id, gameId);
      setProgress(next);
      if (stars >= 2) sfx.win(); else if (stars === 1) sfx.coin(); else sfx.lose();
      setResult({ score, total, stars, coins, newStickers, label: opts.label, boss: !!opts.boss, cleared, levelUp: petLevel(totalCorrect) > lvBefore });
    },
  }), [gameId, cat.id, setProgress]);

  const replay = () => { correctRef.current = []; setResult(null); setRun(r => r + 1); };
  const p = { words, speak, speakAt, showToast, onBack, cat, track, key: run };
  let game = null;
  const catPool = cat.unit ? allWords.filter(w => w.cat === cat.unit.cat.id) : words;
  if (gameId === "quiz")     game = <QuizGame {...p} pool={cat.id === "review" ? allWords : catPool} />;
  if (gameId === "listen")   game = <ListenGame {...p} pool={catPool} />;
  if (gameId === "speak")    game = <SpeakGame {...p} />;
  if (gameId === "sentence") game = <SentenceGame {...p} />;
  if (gameId === "spell")    game = <SpellGame {...p} />;
  if (gameId === "memory")   game = <MemoryGame {...p} />;
  if (gameId === "speed")    game = <SpeedGame {...p} />;
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
  const petLine = !pet ? null : r.levelUp ? `เลเวลอัป! ตอนนี้ Lv.${pet.level} แล้ว` : r.stars >= 2 ? "เย้! เก่งที่สุดเลย" : r.stars === 1 ? "ดีขึ้นเรื่อยๆ นะ" : "ไม่เป็นไร ลองอีกที!";
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(17,24,39,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      {(r.stars >= 2 || r.cleared) && <Confetti />}
      <div style={{ background:"#fff",borderRadius:24,padding:"22px 18px 18px",maxWidth:380,width:"100%",textAlign:"center",boxShadow:"0 20px 50px rgba(0,0,0,0.3)",animation:"vpPop .4s ease-out",maxHeight:"90dvh",overflowY:"auto" }}>
        <div style={{ fontSize:60,lineHeight:1 }}>{big}</div>
        <h2 style={{ margin:"10px 0 4px",fontSize:22,fontWeight:900,color:"#1f2937" }}>{msg}</h2>
        <div style={{ color:"#6b7280",fontSize:14,fontWeight:600 }}>{r.label || `ตอบถูก ${r.score}/${r.total}`}</div>
        <div style={{ display:"flex",justifyContent:"center",gap:6,margin:"12px 0" }}>
          {[1,2,3].map(i => (
            <span key={i} style={{ fontSize:42,lineHeight:1,animation:`vpPop .45s ${i*0.22}s both`,filter:i<=r.stars?"drop-shadow(0 2px 4px rgba(245,158,11,.5))":"grayscale(1) opacity(0.25)" }}>⭐</span>
          ))}
        </div>
        <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#fef3c7",color:"#92400e",fontWeight:900,fontSize:18,padding:"8px 18px",borderRadius:999 }}>+{r.coins} 🪙</div>

        {newW.length > 0 && (
          <div style={{ marginTop:14,background:"#f5f3ff",borderRadius:16,padding:"10px 12px" }}>
            <div style={{ fontWeight:800,fontSize:13,color:"#5b21b6",marginBottom:6 }}>✨ สติกเกอร์ใหม่ {newW.length} ใบ!</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center" }}>
              {newW.map(w => (
                <button key={w.id} onClick={() => { sfx.tap(); speak(w.word, w.meaning); }}
                  style={{ minWidth:52,minHeight:52,borderRadius:14,background:"#fff",border:"2px solid #c4b5fd",fontSize:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",animation:"vpPop .4s both" }}>
                  {w.emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {pet && (
          <div style={{ marginTop:12,display:"flex",alignItems:"center",gap:10,background:"#f9fafb",borderRadius:14,padding:"8px 12px",textAlign:"left" }}>
            <span style={{ fontSize:34,animation:"vpBounce 1.2s infinite" }}>{pet.emoji}</span>
            <div style={{ fontSize:13,color:"#374151" }}><b>{pet.name}:</b> "{petLine}" {r.levelUp && "🎊"}</div>
          </div>
        )}

        <div style={{ display:"flex",gap:8,marginTop:16 }}>
          <button onClick={onReplay} style={{ flex:1,minHeight:48,borderRadius:14,background:"#6366f1",color:"#fff",fontWeight:800,fontSize:15,border:"none",cursor:"pointer" }}>🔄 เล่นอีก</button>
          <button onClick={onExit} style={{ flex:1,minHeight:48,borderRadius:14,background:"#f3f4f6",color:"#374151",fontWeight:800,fontSize:15,border:"none",cursor:"pointer" }}>กลับ ›</button>
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
const GS = { // game styles
  wrap: { padding:"10px",maxWidth:440,margin:"0 auto" },
  card: { background:"#fff",borderRadius:18,boxShadow:"0 2px 14px rgba(0,0,0,0.08)",overflow:"hidden",border:"1px solid #f3f4f6" },
  bar: { display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",background:"#f9fafb",borderBottom:"1px solid #f3f4f6",fontSize:13,fontWeight:700,color:"#374151" },
  body: { padding:"12px 14px" },
  soundBtn: { display:"flex",alignItems:"center",gap:5,margin:"0 auto 10px",background:"#f3f4f6",borderRadius:999,padding:"8px 18px",minHeight:44,fontWeight:700,fontSize:13,color:"#374151",border:"none",cursor:"pointer" },
};

function GameCard({ children }) { return <div style={GS.wrap}><div style={GS.card}>{children}</div></div>; }
function Bar({ left, right }) { return <div style={GS.bar}><span>{left}</span><span>{right}</span></div>; }
// ── รูปจริง (Wikipedia) หรืออีโมจิ ──
const PicCtx = createContext(true);   // เปิด/ปิดรูปจริงจากตั้งค่า
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
function Pic({ w, size = 72, radius = 18, style = {} }) {
  const { url } = useWordImage(w);
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [url]);
  if (!url || err) return <span style={{ fontSize:size,lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center",...style }}>{w?.emoji}</span>;
  const box = size * 2.2;
  return (
    <span style={{ position:"relative",display:"inline-block",width:box,maxWidth:"100%",aspectRatio:"4/3",borderRadius:radius,overflow:"hidden",background:"#f3f4f6",boxShadow:"0 2px 10px rgba(0,0,0,0.12)",...style }}>
      <img src={url} alt={w.word} onError={() => setErr(true)} loading="lazy" style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }} />
      {size >= 30 && <span style={{ position:"absolute",right:4,bottom:3,fontSize:Math.max(14, size*0.3),lineHeight:1,filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>{w.emoji}</span>}
    </span>
  );
}
// รูปเล็กสำหรับตัวเลือก 4 ช่อง / การ์ดจับคู่: เต็มช่อง
function PicFill({ w, emojiSize = 40 }) {
  const { url } = useWordImage(w);
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [url]);
  if (!url || err) return <span style={{ fontSize:emojiSize,lineHeight:1 }}>{w?.emoji}</span>;
  return <img src={url} alt={w.word} onError={() => setErr(true)} loading="lazy" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit" }} />;
}
function Emoji({ e, w, size=72 }) {
  return <div style={{ textAlign:"center",lineHeight:1,padding:"12px 0 6px",display:"flex",justifyContent:"center" }}>{w ? <Pic w={w} size={size} /> : <span style={{ fontSize:size }}>{e}</span>}</div>;
}
function SndBtn({ onClick }) { return <button onClick={onClick} style={GS.soundBtn}>🔊 ฟัง EN+TH</button>; }
function Pill({ onClick, disabled, bg="#6366f1", children }) {
  return <button onClick={onClick} disabled={disabled} style={{ background:disabled?"#e5e7eb":bg,color:disabled?"#9ca3af":"#fff",borderRadius:12,padding:"10px 16px",minHeight:44,fontWeight:700,fontSize:14,border:"none",cursor:disabled?"not-allowed":"pointer" }}>{children}</button>;
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

  if(!cur) return <NoWords onBack={onBack} />;
  const pick = c => {
    if(lock) return;
    setLock(true); setPicked(c.id);
    const ok = c.id===cur.id;
    if(ok){ setScore(s=>s+1); track.correct(cur); speak(cur.word,cur.meaning); }
    else track.wrong(cur);
    setTimeout(()=>{
      if(idx+1<qs.length){ setIdx(i=>i+1); setPicked(null); setLock(false); }
      else track.finish(ok?score+1:score, qs.length);
    },950);
  };
  return (
    <GameCard>
      <Bar left={`${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <Emoji e={cur.emoji} w={cur} />
        <SndBtn onClick={()=>speak(cur.word,cur.meaning)} />
        <p style={{ textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 10px",minHeight:18 }}>{lock ? <b style={{ color:"#7c3aed",fontSize:14 }}>{cur.word} · {cur.read} · {cur.meaning}</b> : "เลือกคำที่ตรงกับรูป"}</p>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {choices.map(c=>{
            const ic=c.id===cur.id,ip=picked===c.id,sr=lock&&(ic||ip);
            let bg="#fffbeb",bo="#fbbf24",tc="#92400e";
            if(sr&&ic){bg="#d1fae5";bo="#6ee7b7";tc="#065f46";}
            if(sr&&ip&&!ic){bg="#fee2e2";bo="#fca5a5";tc="#991b1b";}
            if(lock&&!ip&&!ic){bg="#f9fafb";bo="#e5e7eb";tc="#9ca3af";}
            return <button key={c.id} onClick={()=>pick(c)} disabled={lock}
              style={{ background:bg,border:`2px solid ${bo}`,borderRadius:12,padding:"14px 6px",minHeight:52,fontWeight:800,fontSize:15,color:tc,cursor:"pointer" }}>
              {c.word}
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
        <p style={{ textAlign:"center",fontWeight:600,fontSize:14,color:"#374151",margin:"0 0 2px" }}>{cur.meaning}</p>
        {cur.read && <p style={{ textAlign:"center",fontWeight:700,fontSize:13,color:"#7c3aed",margin:"0 0 8px" }}>{cur.read}</p>}
        <SndBtn onClick={()=>speak(cur.word,cur.meaning)} />

        <div style={{
          minHeight:ts+12,display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",alignItems:"center",
          padding:"8px",borderRadius:12,marginBottom:10,
          background:correct?"#d1fae5":wrong?"#fee2e2":"#f9fafb",
          border:`2px dashed ${correct?"#6ee7b7":wrong?"#fca5a5":"#d1d5db"}`,
        }}>
          {picked.length===0
            ?<span style={{color:"#9ca3af",fontSize:11}}>เลือกตัวอักษร</span>
            :picked.map((l,i)=>(
              <button key={l.id+"p"+i} onClick={()=>removePick(i)}
                style={{ width:ts,height:ts,borderRadius:10,background:correct?"#10b981":wrong?"#ef4444":"#8b5cf6",color:"#fff",fontWeight:800,fontSize:tf,border:"none",cursor:"pointer",flexShrink:0 }}>
                {l.ch}
              </button>
            ))
          }
        </div>

        <div style={{ display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",minHeight:ts+6,marginBottom:10 }}>
          {pool.map(l=>(
            <button key={l.id} onClick={()=>tapLetter(l)}
              style={{ width:ts,height:ts,borderRadius:10,background:"#ede9fe",color:"#5b21b6",fontWeight:800,fontSize:tf,border:"2px solid #c4b5fd",cursor:"pointer",flexShrink:0 }}>
              {l.ch}
            </button>
          ))}
        </div>

        {correct&&<div style={{ textAlign:"center",background:"#d1fae5",borderRadius:10,padding:"8px",marginBottom:8,fontSize:13,fontWeight:700,color:"#065f46" }}>🎉 {cur.word} = {cur.meaning}</div>}

        <div style={{ display:"flex",gap:8 }}>
          <Pill onClick={()=>{setPool(shuffle(cur.word.split("").map((ch,i)=>({id:i,ch}))));setPicked([]);}} bg="#9ca3af">🔄 ใหม่</Pill>
          <Pill onClick={()=>{ if(correct)setScore(s=>s+1); if(idx+1<qs.length)setIdx(i=>i+1); else track.finish(correct?score+1:score, qs.length); }} disabled={!correct} bg="#8b5cf6">ถัดไป ›</Pill>
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
      ...ch.map((w,i)=>({uid:`w${i}`,type:"word",label:w.word,mid:i,ref:w})),
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
    if(nf.length===2){
      setMoves(m=>m+1); setLock(true);
      const[a,b]=nf;
      if(a.mid===b.mid&&a.type!==b.type){
        track.correct(a.ref); speak(a.ref.word,a.ref.meaning);
        setTimeout(()=>{ setMatched(m=>[...m,a.mid]); setOpen([]); setLock(false); },600);
      } else { sfx.tap(); setTimeout(()=>{ setOpen([]); setLock(false); },900); }
    } else sfx.tap();
  };

  return (
    <GameCard>
      <Bar left={`${matched.length}/${PAIRS} คู่`} right={`${moves} ครั้ง`} />
      <div style={GS.body}>
        <p style={{ textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 10px" }}>พลิกการ์ดทีละ 2 ใบ หาคู่ คำ + รูป</p>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7 }}>
          {cards.map(c=>{
            const sf=!!open.find(x=>x.uid===c.uid)||matched.includes(c.mid);
            const im=matched.includes(c.mid);
            return <button key={c.uid} onClick={()=>flip(c)} disabled={lock||im}
              style={{
                aspectRatio:"3/4",borderRadius:11,cursor:"pointer",
                border:`2px solid ${im?"#6ee7b7":sf?"#a78bfa":"#e5e7eb"}`,
                background:im?"#d1fae5":sf?"#ede9fe":"#6366f1",
                fontSize:c.type==="emoji"?24:10,fontWeight:800,
                color:sf?(im?"#065f46":"#5b21b6"):"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",
                padding:3,wordBreak:"break-all",textAlign:"center",overflow:"hidden",
              }}>
              {sf?c.label:"✦"}
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
            <p style={{fontWeight:800,fontSize:17,color:"#1f2937",margin:"0 0 4px"}}>Speed Round</p>
            <p style={{color:"#6b7280",fontSize:13,margin:"0 0 20px"}}>ฟัง→แตะคำให้เร็วใน {T} วิ!<br/>7 คำ = ⭐⭐ · 12 คำ = ⭐⭐⭐</p>
            <Pill onClick={()=>{setTime(T);setScore(0);scoreRef.current=0;setActive(true);next();}} bg="#f59e0b">▶ เริ่ม!</Pill>
          </div>
          :<div>
            <Emoji e={cur?.emoji} w={cur} size={60} />
            <SndBtn onClick={()=>cur&&speak(cur.word,cur.meaning)} />
            <div style={{height:7,background:"#f3f4f6",borderRadius:999,margin:"0 0 10px",overflow:"hidden"}}>
              <div style={{height:"100%",background:time>10?"#f59e0b":"#ef4444",width:`${(time/T)*100}%`,transition:"width 1s linear",borderRadius:999}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {opts.map(o=>(
                <button key={o.id} onClick={()=>{ if(o.id===cur.id){scoreRef.current+=1;setScore(s=>s+1);track.correct(cur);next();}else{track.wrong(cur);showToast("❌","err");} }}
                  style={{background:"#fffbeb",border:"2px solid #fbbf24",borderRadius:12,padding:"13px 6px",minHeight:52,fontWeight:800,fontSize:15,color:"#92400e",cursor:"pointer"}}>
                  {o.word}
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
    {id:"farm",label:"ฟาร์ม",e:"🚜",bg:"#fef3c7",bo:"#fcd34d"},
    {id:"forest",label:"ป่า",e:"🌳",bg:"#dcfce7",bo:"#86efac"},
    {id:"ocean",label:"ทะเล",e:"🌊",bg:"#e0f2fe",bo:"#7dd3fc"},
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
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 8px"}}>แตะสัตว์ → แตะที่อยู่ของมัน</p>
        <div style={{background:"#f9fafb",borderRadius:12,padding:8,display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center",minHeight:70,marginBottom:10}}>
          {pool.length===0?<span style={{color:"#10b981",fontWeight:700,alignSelf:"center"}}>✅ ครบทุกตัว!</span>
            :pool.map(a=>(
              <button key={a.id} onClick={()=>{sfx.tap();setSel(a);speak(a.word,a.meaning);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:sel?.id===a.id?"#ede9fe":"#fff",border:`2px solid ${sel?.id===a.id?"#8b5cf6":"#e5e7eb"}`,borderRadius:10,padding:"6px 8px",minHeight:56,cursor:"pointer"}}>
                <span style={{fontSize:26}}>{a.emoji}</span>
                <span style={{fontSize:9,fontWeight:700,color:"#374151"}}>{a.word}</span>
              </button>
            ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
          {ZN.map(z=>(
            <button key={z.id} onClick={()=>{
              if(!sel) return;
              if(sel.habitat===z.id){track.correct(sel);setPlaced(p=>({...p,[z.id]:[...p[z.id],sel]}));setPool(p=>p.filter(x=>x.id!==sel.id));speak(sel.word,sel.meaning);setSel(null);}
              else{wrongs.current+=1;track.wrong(sel);showToast("ลองอีก 🐾","warn");setSel(null);}
            }} style={{background:z.bg,border:`2px solid ${z.bo}`,borderRadius:12,padding:"8px 4px",minHeight:100,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
              <span style={{fontSize:22}}>{z.e}</span>
              <span style={{fontSize:10,fontWeight:700,color:"#374151"}}>{z.label}</span>
              <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:2,marginTop:3}}>
                {placed[z.id].map(a=><span key={a.id} style={{fontSize:18}}>{a.emoji}</span>)}
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
  const H=56;
  return (
    <GameCard>
      <Bar left={`รอบ${round+1}/${total}`} right={`${Object.keys(matches).length}/${rw.length}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 10px"}}>แตะคำ → แตะรูปที่ตรงกัน</p>
        {rw.map((w,i)=>{
          const p=pics[i];
          const im=matches[w.id]===w.id;
          const is=sel===w.id;
          const pu=p&&Object.values(matches).includes(p.id);
          return <div key={w.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,height:H}}>
            <button onClick={()=>{if(!im){sfx.tap();setSel(w.id);speak(w.word,w.meaning);}}} disabled={im}
              style={{flex:1,height:H,borderRadius:12,background:im?"#d1fae5":is?"#4f46e5":"#eff6ff",border:`2px solid ${im?"#6ee7b7":is?"#4f46e5":"#bfdbfe"}`,fontWeight:800,fontSize:14,color:im?"#065f46":is?"#fff":"#1e40af",cursor:"pointer"}}>
              {w.word}
            </button>
            <span style={{color:"#d1d5db",fontSize:18,flexShrink:0}}>→</span>
            {p&&<button onClick={()=>{
              if(sel==null||pu) return;
              if(sel===p.id){track.correct(p);setMatches(m=>({...m,[sel]:p.id}));speak(p.word,p.meaning);}
              else{wrongs.current+=1;track.wrong(rw.find(x=>x.id===sel));showToast("ลองอีก 💡","warn");}
              setSel(null);
            }} disabled={pu}
              style={{width:H*1.5,height:H,borderRadius:12,background:pu?"#d1fae5":"#f0fdf4",border:`2px solid ${pu?"#6ee7b7":"#86efac"}`,fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",position:"relative",overflow:"hidden",padding:0,opacity:pu?0.55:1}}>
              <PicFill w={p} emojiSize={28} />
            </button>}
          </div>;
        })}
        {done&&<div style={{textAlign:"center",marginTop:6}}>
          {round+1<total
            ?<Pill onClick={()=>setRound(r=>r+1)} bg="#10b981">รอบถัดไป →</Pill>
            :<Pill onClick={()=>track.finish(words.length,words.length,{ stars: starsByWrong(wrongs.current) })} bg="#10b981">จบ ✓</Pill>}
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
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 10px"}}>ผสม 2 สีให้ได้สีเป้าหมาย</p>
        <div style={{background:"#f9fafb",borderRadius:12,padding:"12px",textAlign:"center",marginBottom:10}}>
          <div style={{fontSize:10,color:"#9ca3af",marginBottom:4}}>เป้าหมาย</div>
          <div style={{fontSize:50}}>{tw?.emoji}</div>
          <div style={{fontWeight:800,fontSize:17,color:"#1f2937"}}>{tg}</div>
          <div style={{fontSize:12,color:"#6b7280"}}>{tw?.meaning}</div>
        </div>
        <div style={{background:"#f5f3ff",borderRadius:12,minHeight:68,padding:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10}}>
          {picked.length===0?<span style={{color:"#9ca3af",fontSize:12}}>เลือก 2 สีด้านล่าง</span>
            :picked.map((p,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                {i>0&&<span style={{position:"absolute",marginLeft:-26,fontWeight:800,color:"#6b7280",fontSize:18}}>+</span>}
                <span style={{fontSize:36}}>{p.emoji}</span>
                <span style={{fontSize:10,fontWeight:700}}>{p.word}</span>
              </div>
            ))
          }
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:12}}>
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
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"#fff",border:"2px solid #e5e7eb",borderRadius:14,padding:"10px 14px",cursor:"pointer",opacity:picked.find(p=>p.id===w.id)?0.3:1}}>
              <span style={{fontSize:36}}>{w.emoji}</span>
              <span style={{fontSize:10,fontWeight:700,color:"#374151"}}>{w.word}</span>
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
function CountGame({ words, speak, showToast, track }) {
  const MAX=8;
  const SH=["🍎","⭐","🐱","🎈","🌸","🚗","🍊","🐶"];
  const [round,setRound]=useState(1);
  const [target,setT]=useState(1);
  const [shape,setShape]=useState("🍎");
  const [score,setScore]=useState(0);
  const wrongs=useRef(0);
  const nw=words.filter(w=>w.num!==undefined&&w.num>=1&&w.num<=8);
  const maxN=Math.min(8,Math.max(...nw.map(w=>w.num),4));
  useEffect(()=>{const t=Math.floor(Math.random()*maxN)+1;setT(t);setShape(SH[Math.floor(Math.random()*SH.length)]);speak("How many?","นับสิ");},[round]);
  return (
    <GameCard>
      <Bar left={`รอบ ${round}/${MAX}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 8px"}}>นับแล้วเลือกตัวเลข</p>
        <div style={{background:"#f0fdf4",borderRadius:12,padding:"12px",display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",minHeight:110,marginBottom:10}}>
          {Array.from({length:target}).map((_,i)=><span key={i} style={{fontSize:32}}>{shape}</span>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {nw.sort((a,b)=>a.num-b.num).slice(0,8).map(w=>(
            <button key={w.id} onClick={()=>{
              if(w.num===target){ track.correct(w); setScore(s=>s+1); speak(w.word,w.meaning); if(round>=MAX) setTimeout(()=>track.finish(score+1,MAX,{ stars: starsByWrong(wrongs.current) }),600); else setTimeout(()=>setRound(r=>r+1),600); }
              else { wrongs.current+=1; track.wrong(w); showToast("ลองอีก","warn"); }
            }}
              style={{background:"#fff",border:"2px solid #6ee7b7",borderRadius:11,padding:"9px 3px",minHeight:56,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
              <span style={{fontSize:22}}>{w.emoji}</span>
              <span style={{fontWeight:800,fontSize:10,color:"#374151"}}>{w.word}</span>
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
  useEffect(()=>{const t=words[Math.floor(Math.random()*words.length)];setTarget(t);setFb(null);if(t)speak(`Touch the ${t.word}`,`แตะที่ ${t.meaning}`);},[round]);
  return (
    <GameCard>
      <Bar left={`รอบ ${round}/${MAX}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{textAlign:"center",marginBottom:10}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#fce7f3",borderRadius:999,padding:"6px 14px",marginBottom:4}}>
            <span>🔊</span><span style={{fontWeight:800,fontSize:14,color:"#9d174d"}}>Touch the {target?.word}!</span>
          </div>
          <br/>
          <button onClick={()=>target&&speak(`Touch the ${target.word}`,`แตะที่ ${target.meaning}`)} style={{fontSize:12,color:"#be185d",fontWeight:700,background:"none",border:"none",cursor:"pointer",minHeight:44,padding:"0 14px"}}>🔊 ฟังอีกครั้ง</button>
        </div>
        <div style={{fontSize:46,textAlign:"center",marginBottom:10}}>🧒</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
          {words.slice(0,9).map(w=>(
            <button key={w.id} onClick={()=>{
              if(!target||fb) return;
              if(w.id===target.id){ track.correct(w); setScore(s=>s+1); setFb("ok"); speak(w.word,w.meaning); if(round>=MAX) setTimeout(()=>track.finish(score+1,MAX,{ stars: starsByWrong(wrongs.current) }),800); else setTimeout(()=>setRound(r=>r+1),800); }
              else { wrongs.current+=1; track.wrong(target); setFb("no"); showToast("ลองอีก 🩺","warn"); setTimeout(()=>setFb(null),500); }
            }} style={{background:fb==="ok"&&w.id===target?.id?"#d1fae5":"#fdf2f8",border:`2px solid ${fb==="ok"&&w.id===target?.id?"#6ee7b7":"#fbcfe8"}`,borderRadius:12,padding:"9px 4px",minHeight:60,display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",opacity:fb==="no"&&w.id!==target?.id?0.5:1}}>
              <span style={{fontSize:26}}>{w.emoji}</span>
              <span style={{fontWeight:800,fontSize:9,color:"#374151"}}>{w.word}</span>
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
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 10px"}}>เลือกเสื้อผ้าให้เหมาะกับอากาศ</p>
        <div style={{background:"#ecfeff",borderRadius:12,padding:"14px",textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:54}}>{target?.emoji}</div>
          <div style={{fontWeight:800,fontSize:17,color:"#1f2937"}}>{target?.word}</div>
          <div style={{fontSize:12,color:"#6b7280"}}>{target?.meaning}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
          {opts.map((o,i)=>(
            <button key={i} onClick={()=>{
              if(picked)return; setPicked(o.e);
              if(o.ok){ track.correct(target); setScore(s=>s+1); showToast("👏 เก่ง!"); if(round>=MAX) setTimeout(()=>track.finish(score+1,MAX,{ stars: starsByWrong(wrongs.current) }),800); else setTimeout(()=>setRound(r=>r+1),800); }
              else { wrongs.current+=1; track.wrong(target); showToast("ลองอีก 🧥","warn"); setTimeout(()=>setPicked(null),500); }
            }} disabled={!!picked}
              style={{aspectRatio:"1",minHeight:56,borderRadius:12,fontSize:30,display:"flex",alignItems:"center",justifyContent:"center",background:picked===o.e&&o.ok?"#d1fae5":picked===o.e&&!o.ok?"#fee2e2":"#ecfeff",border:`2px solid ${picked===o.e&&o.ok?"#6ee7b7":picked===o.e&&!o.ok?"#fca5a5":"#a5f3fc"}`,cursor:"pointer"}}>
              {o.e}
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
    const modes=["pic","th","rev"];
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
    setTimeout(()=>{
      if(nh<=0||idx+1>=qs.length) end(ns,nh);
      else { setIdx(i=>i+1); setPicked(null); setLock(false); }
    },950);
  };
  const prompt = q.mode==="pic" ? <Emoji e={q.w.emoji} w={q.w} />
    : q.mode==="th" ? <div style={{ textAlign:"center",padding:"18px 0 10px" }}><div style={{ fontSize:12,color:"#9ca3af" }}>คำนี้ภาษาอังกฤษคือ?</div><div style={{ fontSize:30,fontWeight:900,color:"#1f2937" }}>{q.w.meaning}</div></div>
    : <div style={{ textAlign:"center",padding:"18px 0 10px" }}><div style={{ fontSize:12,color:"#9ca3af" }}>รูปไหนคือ</div><div style={{ fontSize:30,fontWeight:900,color:"#1f2937",letterSpacing:1 }}>{q.w.word}</div></div>;
  return (
    <GameCard>
      <div style={{ ...GS.bar,background:"linear-gradient(135deg,#1f2937,#4c1d95)",color:"#fff",borderBottom:"none" }}>
        <span>👑 บอส {cat.label} · {idx+1}/{N}</span><Hearts n={hearts} />
      </div>
      <div style={GS.body}>
        {prompt}
        <SndBtn onClick={()=>speak(q.w.word,q.w.meaning)} />
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {choices.map(c=>{
            const ic=c.id===q.w.id,ip=picked===c.id,sr=lock&&(ic||ip);
            let bg="#f5f3ff",bo="#c4b5fd",tc="#4c1d95";
            if(sr&&ic){bg="#d1fae5";bo="#6ee7b7";tc="#065f46";}
            if(sr&&ip&&!ic){bg="#fee2e2";bo="#fca5a5";tc="#991b1b";}
            if(lock&&!ip&&!ic){bg="#f9fafb";bo="#e5e7eb";tc="#9ca3af";}
            return <button key={c.id} onClick={()=>pick(c)} disabled={lock}
              style={{ background:bg,border:`2px solid ${bo}`,borderRadius:12,padding:q.mode==="rev"?0:"12px 6px",minHeight:q.mode==="rev"?84:56,fontWeight:800,fontSize:q.mode==="rev"?30:15,color:tc,cursor:"pointer",position:"relative",overflow:"hidden" }}>
              {q.mode==="rev"?<PicFill w={c} emojiSize={34} />:c.word}
            </button>;
          })}
        </div>
        <div style={{ textAlign:"center",fontSize:11,color:"#9ca3af",marginTop:10 }}>ตอบถูก {WIN}/{N} และหัวใจไม่หมด = ชนะ 👑 +50 🪙</div>
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
      <div style={{ background:"linear-gradient(135deg,#fdf2f8,#eef2ff)",borderRadius:20,padding:16,marginBottom:14,border:"2px solid #e9d5ff",textAlign:"center" }}>
        {profile && <div style={{ textAlign:"right",marginBottom:4 }}><button onClick={() => { sfx.tap(); onProfiles(); }} style={{ minHeight:44,display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.85)",border:"none",borderRadius:999,padding:"0 10px",fontSize:12,fontWeight:800,color:"#374151",cursor:"pointer" }}>{profile.avatar} {profile.name} ▾</button></div>}
        <div style={{ fontWeight:900,fontSize:16,color:"#1f2937" }}>เลือกเพื่อนคู่หูของ{profile?.name || "หนู"} 🥚</div>
        <div style={{ fontSize:12,color:"#6b7280",margin:"2px 0 12px" }}>ยิ่งตอบถูก เพื่อนยิ่งโต!</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
          {PETS.map(p => (
            <button key={p.id} onClick={() => { sfx.coin(); speak("Hello! Let's play!", "สวัสดี มาเล่นกันเถอะ"); setProgress(x => ({ ...x, pet: p.id })); }}
              style={{ background:"#fff",border:"2px solid #e5e7eb",borderRadius:16,padding:"10px 4px",minHeight:72,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
              <span style={{ fontSize:32 }}>{p.stages[1]}</span>
              <span style={{ fontSize:12,fontWeight:800,color:"#374151" }}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const line = pet.stage===0 ? `ไข่กำลังจะฟัก! ตอบถูกอีก ${Math.max(0,(pet.next??0)-pet.xp)} ข้อ`
    : pet.next==null ? "โตเต็มที่แล้ว เก่งมาก!" : `อีก ${pet.next-pet.xp} ข้อ ถึง Lv.${pet.level+1}`;
  const chip = { display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.8)",borderRadius:999,padding:"4px 10px",fontSize:12,fontWeight:800,color:"#374151" };
  const bgCss = SHOP_ITEMS.find(i => i.id === progress.bg)?.css || "linear-gradient(135deg,#fdf2f8,#eef2ff)";
  const dark = progress.bg === "bgSpace";
  return (
    <div style={{ background:bgCss,borderRadius:20,padding:"14px 14px 12px",marginBottom:14,border:"2px solid #e9d5ff" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
        <button onClick={() => { sfx.tap(); speak(`Hi! I'm ${pet.id === "cat" ? "a cat" : pet.id === "dog" ? "a dog" : pet.id === "bunny" ? "a bunny" : "a dragon"}!`, `สวัสดี ฉันชื่อ${pet.name}`); }}
          style={{ width:80,height:80,borderRadius:22,background:"#fff",border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(139,92,246,0.25)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>
          <PetAvatar pet={pet} hat={progress.hat} size={pet.stage===0?38:pet.stage===1?42:pet.stage===2?46:50} bounce />
        </button>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontWeight:900,fontSize:17,color:dark?"#fff":"#1f2937" }}>{pet.name}</span>
            <span style={{ fontSize:12,fontWeight:800,color:dark?"#c4b5fd":"#7c3aed" }}>Lv.{pet.level}</span>
            {profile && <button onClick={() => { sfx.tap(); onProfiles(); }} style={{ marginLeft:"auto",minHeight:44,display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.85)",border:"none",borderRadius:999,padding:"0 10px",fontSize:12,fontWeight:800,color:"#374151",cursor:"pointer" }}>{profile.avatar} {profile.name} ▾</button>}
          </div>
          <div style={{ fontSize:11,color:dark?"#e9d5ff":"#6b7280",marginBottom:5 }}>{line}</div>
          <div style={{ height:8,background:"rgba(255,255,255,0.9)",borderRadius:999,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${pet.pct}%`,background:"linear-gradient(90deg,#a78bfa,#ec4899)",borderRadius:999,transition:"width .6s" }} />
          </div>
        </div>
      </div>
      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:10,alignItems:"center" }}>
        <span style={chip}>🪙 {progress.coins}</span>
        <span style={chip}>🔥 {progress.streak.count} วัน</span>
        <div style={{ display:"flex",gap:6,marginLeft:"auto" }}>
          <button onClick={() => { sfx.tap(); onShop(); }} style={{ ...chip,background:"#f59e0b",color:"#fff",border:"none",cursor:"pointer",minHeight:44,padding:"0 12px" }}>🛍️ ร้านค้า</button>
          <button onClick={() => { sfx.tap(); onStickers(); }} style={{ ...chip,background:"#7c3aed",color:"#fff",border:"none",cursor:"pointer",minHeight:44,padding:"0 12px" }}>📒 {stickerCount}/{totalWords}</button>
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
      <div style={{ background:"linear-gradient(135deg,#7c3aed,#ec4899)",borderRadius:20,padding:16,color:"#fff",marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>📒 สมุดสติกเกอร์</div>
        <div style={{ fontSize:13,opacity:0.9 }}>เก็บได้ {total} / {words.length} ใบ · ตอบคำไหนถูก {STICKER_NEED} ครั้ง จะได้สติกเกอร์คำนั้น</div>
        <div style={{ height:8,background:"rgba(255,255,255,0.3)",borderRadius:999,marginTop:8,overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${words.length?Math.round(total/words.length*100):0}%`,background:"#fff",borderRadius:999 }} />
        </div>
      </div>
      {categories.map(cat => {
        const ws = words.filter(w => w.cat === cat.id);
        if (!ws.length) return null;
        const got = ws.filter(w => have(w.id)).length;
        return (
          <div key={cat.id} style={{ marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <span style={{ fontSize:20 }}>{cat.emoji}</span>
              <span style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{cat.label}</span>
              <span style={{ fontSize:11,fontWeight:700,color:cat.color,background:`${cat.color}18`,padding:"2px 8px",borderRadius:999 }}>{got}/{ws.length}</span>
              {got === ws.length && <span>🏅</span>}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6 }}>
              {ws.map(w => {
                const n = Math.min(STICKER_NEED, progress.stickers[w.id] || 0);
                const ok = n >= STICKER_NEED;
                return (
                  <button key={w.id} onClick={() => { if (ok) { sfx.tap(); speak(w.word, w.meaning); showToast(`${w.word} · ${w.read || ""} · ${w.meaning}`); } else showToast(`ตอบ ${w.word} ถูกอีก ${STICKER_NEED - n} ครั้ง`, "warn"); }}
                    style={{ aspectRatio:"1",minHeight:56,borderRadius:14,border:`2px solid ${ok?cat.color+"60":"#e5e7eb"}`,background:ok?"#fff":"#f3f4f6",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:2 }}>
                    <span style={{ fontSize:26,filter:ok?"none":"grayscale(1) opacity(0.35)" }}>{ok ? w.emoji : "❓"}</span>
                    {ok
                      ? <span style={{ fontSize:8,fontWeight:800,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%" }}>{w.word}</span>
                      : <span style={{ display:"flex",gap:2 }}>{[0,1,2].map(i => <span key={i} style={{ width:6,height:6,borderRadius:3,background:i<n?cat.color:"#d1d5db" }} />)}</span>}
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
function SettingsSheet({ soundOn, setSoundOn, bilingual, setBilingual, rate, setRate, onResetProgress, onReport, onCredits, onClose, realPics, setRealPics }) {
  const [vr, setVr] = useState(() => voiceReport());
  useEffect(() => { loadVoices(); setVr(voiceReport()); const t = setTimeout(() => { loadVoices(); setVr(voiceReport()); }, 800); return () => clearTimeout(t); }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end",background:"rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:"22px 22px 0 0",padding:"20px 20px 36px",maxWidth:480,width:"100%",margin:"0 auto",maxHeight:"90dvh",overflowY:"auto" }}>
        <div style={{ width:38,height:4,background:"#e5e7eb",borderRadius:999,margin:"0 auto 18px" }}/>
        <h3 style={{ fontWeight:800,fontSize:17,color:"#1f2937",margin:"0 0 4px" }}>⚙️ ตั้งค่า</h3>
        <div style={{ fontSize:11,color:"#9ca3af",marginBottom:14 }}>Smart VocabPlay <b>v{APP_VERSION}</b>{BUILD_TIME && ` · build ${BUILD_TIME}`} · ถ้าเลขไม่ตรงกับที่แจ้งไว้ ให้ปิดแอปแล้วเปิดใหม่ หรือกด "อัปเดต" เมื่อมีแถบขึ้น</div>
        <TRow label="เปิดเสียง" desc="เสียงพูด + เสียงเอฟเฟกต์ทุกเกม" on={soundOn} set={setSoundOn} />
        <TRow label="เสียงสองภาษา EN→TH" desc="อ่านอังกฤษแล้วต่อด้วยไทย" on={bilingual} set={setBilingual} />
        <TRow label="รูปภาพจริง" desc={`รูปถ่ายจาก Wikipedia ${bundledCount()} รูปมากับแอป (ไม่ต้องใช้เน็ต) · ปิด = ใช้อีโมจิ`} on={realPics} set={setRealPics} />
        <button onClick={onCredits} style={{ width:"100%",minHeight:44,marginBottom:10,borderRadius:12,background:"#f9fafb",color:"#6b7280",border:"1px solid #e5e7eb",fontWeight:700,fontSize:12,cursor:"pointer" }}>🖼️ เครดิตรูปภาพ (ที่มา / สัญญาอนุญาต)</button>
        <div style={{ background:vr.th.length?"#ecfdf5":"#fff7ed",border:`1px solid ${vr.th.length?"#a7f3d0":"#fdba74"}`,borderRadius:14,padding:"10px 14px",marginBottom:10,fontSize:12,color:"#374151" }}>
          <div style={{ fontWeight:800,marginBottom:2 }}>{vr.th.length ? `✅ เสียงไทยพร้อมใช้: ${vr.thPick}` : "⚠️ ยังไม่พบเสียงภาษาไทยในเครื่องนี้"}</div>
          {vr.th.length
            ? <div style={{ color:"#6b7280" }}>พบเสียงทั้งหมด {vr.total} เสียง (อังกฤษ {vr.en}, ไทย {vr.th.length}) · ถ้ายังไม่ได้ยินไทย ลองกด "ทดสอบเสียง" ด้านล่าง</div>
            : <div style={{ color:"#9a3412",lineHeight:1.5 }}>
                แอปจะอ่านได้แค่อังกฤษจนกว่าจะติดตั้งเสียงไทย:<br/>
                {ios
                  ? <>iPhone/iPad: <b>การตั้งค่า → การช่วยการเข้าถึง → เนื้อหาที่พูด → เสียง → ไทย</b> → ดาวน์โหลดเสียง (เช่น Kanya) แล้วเปิดแอปใหม่</>
                  : <>Android: <b>การตั้งค่า → ระบบ → ภาษาและการป้อนข้อมูล → การอ่านออกเสียง (Text-to-speech) → Speech Services by Google → ติดตั้งข้อมูลเสียง → ไทย</b> แล้วเปิดแอปใหม่</>}
                {vr.total === 0 && <><br/>(ยังโหลดรายชื่อเสียงไม่ขึ้น ลองกด "ทดสอบเสียง" 1 ครั้งแล้วเปิดตั้งค่าใหม่)</>}
              </div>}
        </div>
        <div style={{ background:"#f9fafb",borderRadius:14,padding:"12px 14px",marginBottom:10 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
            <div style={{ fontWeight:700,fontSize:14,color:"#1f2937" }}>ความเร็วเสียง</div>
            <span style={{ fontWeight:800,color:"#ef4444",fontSize:15 }}>{rate.toFixed(2)}x</span>
          </div>
          <input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={e=>setRate(+e.target.value)} style={{ width:"100%",height:44 }} />
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"#9ca3af",marginTop:3 }}>
            <span>🐢 ช้า</span><span>ปกติ</span><span>เร็ว 🐇</span>
          </div>
        </div>
        <button onClick={()=>{ sfx.coin(); speakWord("Hello! How are you?","สวัสดี เป็นอย่างไรบ้าง",rate,bilingual); }}
          style={{ width:"100%",minHeight:48,padding:"12px",borderRadius:12,background:"#ef4444",color:"#fff",fontWeight:800,fontSize:15,border:"none",cursor:"pointer",marginBottom:10 }}>
          🔊 ทดสอบเสียง EN+TH
        </button>
        <button onClick={onReport} style={{ width:"100%",minHeight:48,padding:"12px",borderRadius:12,background:"#eff6ff",color:"#1d4ed8",fontWeight:800,fontSize:14,border:"2px solid #bfdbfe",cursor:"pointer",marginBottom:10 }}>
          📊 รายงานผู้ปกครอง
        </button>
        <button onClick={onClose} style={{ width:"100%",minHeight:44,padding:"11px",borderRadius:12,background:"#f3f4f6",color:"#374151",fontWeight:700,fontSize:14,border:"none",cursor:"pointer" }}>
          ✓ เสร็จสิ้น
        </button>
        <button onClick={()=>{ if(window.confirm("ล้างความคืบหน้าทั้งหมด?\nดาว เหรียญ สติกเกอร์ streak และเพื่อนคู่หู จะเริ่มใหม่หมด")) onResetProgress(); }}
          style={{ width:"100%",minHeight:44,marginTop:14,background:"#fff",color:"#9ca3af",border:"1px dashed #d1d5db",borderRadius:12,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer" }}>
          ↺ ล้างดาว / เหรียญ / สติกเกอร์ (เริ่มใหม่)
        </button>
      </div>
    </div>
  );
}

function TRow({ label, desc, on, set }) {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"#f9fafb",borderRadius:12,marginBottom:9 }}>
      <div>
        <div style={{ fontWeight:700,fontSize:14,color:"#1f2937" }}>{label}</div>
        <div style={{ fontSize:11,color:"#6b7280" }}>{desc}</div>
      </div>
      <button onClick={()=>{ sfx.tap(); set(!on); }} style={{ width:60,height:44,background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <span style={{ width:48,height:28,borderRadius:999,background:on?"#10b981":"#d1d5db",position:"relative",display:"block" }}>
          <span style={{ position:"absolute",top:3,width:22,height:22,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.15)",left:on?23:3,transition:"left 0.2s" }}/>
        </span>
      </button>
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
      <p style={{ color:"#6b7280",fontWeight:600,fontSize:14 }}>ยังไม่มีคำพอสำหรับเกมนี้ (ต้องมีอย่างน้อย 4 คำ)</p>
      <button onClick={onBack} style={{ marginTop:14,minHeight:44,background:"#6366f1",color:"#fff",borderRadius:12,padding:"10px 22px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>กลับ</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PET AVATAR — อีโมจิเพื่อนคู่หู + หมวกที่ซื้อจากร้าน
// ═══════════════════════════════════════════════════════
function PetAvatar({ pet, hat, size = 48, bounce = false }) {
  const h = SHOP_ITEMS.find(i => i.id === hat);
  return (
    <span style={{ position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",width:size*1.3,height:size*1.3,lineHeight:1,animation:bounce?"vpBounce 2s infinite":"none" }}>
      <span style={{ fontSize:size }}>{pet?.emoji || "🥚"}</span>
      {h && <span style={{ position:"absolute",top:-size*0.22,left:"50%",transform:"translateX(-50%) rotate(-8deg)",fontSize:size*0.5 }}>{h.emoji}</span>}
    </span>
  );
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
  const btn = { flex:1,minHeight:44,borderRadius:12,border:"none",background:"#f3f4f6",color:"#374151",fontWeight:700,fontSize:13,cursor:"pointer" };
  return (
    <div style={{ padding:"10px",maxWidth:440,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#6b7280",padding:"0 4px 8px" }}>
        <span>📖 การ์ดที่ {i+1}/{deck.length}</span><span>😎 รู้แล้ว {know}</span>
      </div>
      <button onClick={() => { sfx.tap(); if (!flip) speak(w.word, w.meaning); setFlip(f => !f); }}
        style={{ width:"100%",minHeight:300,borderRadius:24,border:`3px solid ${cat.color}50`,background:flip?`${cat.color}12`:"#fff",boxShadow:"0 8px 28px rgba(0,0,0,0.1)",cursor:"pointer",padding:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,transition:"background .25s" }}>
        {!flip ? (
          <>
            <Pic w={w} size={84} radius={20} />
            <span style={{ fontSize:34,fontWeight:900,color:"#1f2937",letterSpacing:1 }}>{w.word}</span>
            {w.read && <span style={{ fontSize:18,fontWeight:700,color:"#7c3aed" }}>{w.read}</span>}
            <span style={{ fontSize:11,color:"#9ca3af",marginTop:8 }}>แตะการ์ดเพื่อดูความหมาย</span>
          </>
        ) : (
          <>
            <Pic w={w} size={44} radius={14} />
            <span style={{ fontSize:30,fontWeight:900,color:"#1f2937" }}>{w.meaning}</span>
            {w.read && <span style={{ fontSize:14,color:"#7c3aed",fontWeight:700 }}>{w.word} · {w.read}</span>}
            {w.sen && <div style={{ marginTop:10,background:"#fff",borderRadius:14,padding:"10px 14px",width:"100%" }}>
              <div style={{ fontSize:16,fontWeight:700,color:"#1f2937" }}>{w.sen}</div>
              <div style={{ fontSize:13,color:"#6b7280",marginTop:2 }}>{w.senTh}</div>
            </div>}
            {imageTitleOf(w) && <a href={wikiPageUrl(imageTitleOf(w))} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize:10,color:"#9ca3af",marginTop:6 }}>รูป: Wikipedia — {imageTitleOf(w)} ↗</a>}
          </>
        )}
      </button>
      <div style={{ display:"flex",gap:6,marginTop:10 }}>
        <button onClick={() => speak(w.word, w.meaning)} style={btn}>🔊 คำ</button>
        <button onClick={() => speakAt(w.word, w.meaning, 0.55)} style={btn}>🐢 ช้าๆ</button>
        {w.sen && <button onClick={() => speak(w.sen, w.senTh)} style={btn}>💬 ประโยค</button>}
      </div>
      <div style={{ display:"flex",gap:8,marginTop:10 }}>
        <button onClick={() => mark(false)} style={{ flex:1,minHeight:54,borderRadius:16,border:"none",background:"#fff7ed",color:"#c2410c",fontWeight:800,fontSize:15,cursor:"pointer",border:"2px solid #fdba74" }}>😅 ยังไม่แม่น</button>
        <button onClick={() => mark(true)} style={{ flex:1,minHeight:54,borderRadius:16,border:"none",background:"#10b981",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer" }}>😎 รู้แล้ว</button>
      </div>
      <p style={{ textAlign:"center",fontSize:11,color:"#9ca3af",marginTop:10 }}>คำที่ "ยังไม่แม่น" จะกลับมาให้ทบทวนวันนี้ · คำที่ "รู้แล้ว" จะเว้นระยะนานขึ้นเรื่อยๆ</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LISTEN — ฟังอย่างเดียว (ไม่มีรูป) แล้วเลือกรูป · 10 ข้อ
// ═══════════════════════════════════════════════════════
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
    setTimeout(() => {
      if (idx + 1 < qs.length) { setIdx(i => i + 1); setPicked(null); setLock(false); setPlayed(false); }
      else track.finish(ok ? score + 1 : score, qs.length);
    }, 1000);
  };
  return (
    <GameCard>
      <Bar left={`👂 ${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <button onClick={() => { setPlayed(true); speakAt(cur.word, null, 0.8); }}
          style={{ width:120,height:120,borderRadius:60,margin:"6px auto 10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:52,background:played?"#ede9fe":"linear-gradient(135deg,#8b5cf6,#ec4899)",border:"none",cursor:"pointer",boxShadow:"0 8px 24px rgba(139,92,246,0.35)",animation:played?"none":"vpBounce 1.5s infinite" }}>
          🔊
        </button>
        <p style={{ textAlign:"center",fontSize:13,fontWeight:700,color:"#374151",margin:"0 0 4px" }}>{played ? "ได้ยินคำว่าอะไร? เลือกรูป" : "แตะลำโพงเพื่อฟัง (ฟังซ้ำได้)"}</p>
        {lock && <p style={{ textAlign:"center",fontSize:14,color:"#7c3aed",fontWeight:800,margin:"0 0 8px" }}>{cur.word} · {cur.read} · {cur.meaning}</p>}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8 }}>
          {choices.map(c => {
            const ic = c.id === cur.id, ip = picked === c.id, sr = lock && (ic || ip);
            let bg = "#f5f3ff", bo = "#ddd6fe";
            if (sr && ic) { bg = "#d1fae5"; bo = "#6ee7b7"; }
            if (sr && ip && !ic) { bg = "#fee2e2"; bo = "#fca5a5"; }
            return <button key={c.id} onClick={() => pick(c)} disabled={lock || !played}
              style={{ background:bg,border:`2px solid ${bo}`,borderRadius:14,minHeight:96,fontSize:44,cursor:"pointer",opacity:played?1:0.5,position:"relative",overflow:"hidden",padding:0 }}><PicFill w={c} emojiSize={44} /></button>;
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
      <p style={{ fontWeight:800,fontSize:15,color:"#1f2937" }}>เบราว์เซอร์นี้ยังฟังเสียงพูดไม่ได้</p>
      <p style={{ fontSize:13,color:"#6b7280" }}>ลองเปิดใน Chrome (Android) หรือ Safari (iPhone) แล้วอนุญาตให้ใช้ไมโครโฟน</p>
      <Pill onClick={onBack} bg="#6366f1">กลับ</Pill>
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
  const micBg = st === "listening" ? "#ef4444" : st === "ok" ? "#10b981" : "linear-gradient(135deg,#f59e0b,#ef4444)";
  return (
    <GameCard>
      <Bar left={`🎤 ${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <Emoji e={cur.emoji} w={cur} size={52} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:30,fontWeight:900,color:"#1f2937",letterSpacing:1 }}>{cur.word}</div>
          <div style={{ fontSize:16,fontWeight:700,color:"#7c3aed" }}>{cur.read}</div>
          <div style={{ fontSize:13,color:"#6b7280" }}>{cur.meaning}</div>
        </div>
        <SndBtn onClick={() => speak(cur.word, null)} />
        <button onClick={listen} disabled={st === "listening"}
          style={{ width:110,height:110,borderRadius:55,margin:"4px auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:46,background:micBg,border:"none",cursor:"pointer",boxShadow:"0 8px 24px rgba(239,68,68,0.3)",animation:st==="listening"?"vpBounce .6s infinite":"none" }}>
          {st === "ok" ? "✅" : "🎤"}
        </button>
        <p style={{ textAlign:"center",fontSize:13,fontWeight:700,margin:"0 0 6px",color:st==="ok"?"#059669":st==="no"?"#dc2626":"#374151" }}>
          {st === "idle" && "แตะไมค์ แล้วพูดคำนี้"}
          {st === "listening" && "กำลังฟัง... พูดเลย!"}
          {st === "ok" && (pct >= 95 ? "เยี่ยม! ชัดเจนมาก 🎉 100%" : `ดีมาก! ใกล้เคียง ${pct}% 👏`)}
          {st === "no" && (heard ? `ได้ยินว่า "${heard}" (${pct}%) ลองอีกครั้งนะ` : "ไม่ได้ยินเสียง ลองพูดดังๆ อีกที")}
          {st === "err" && "ต้องอนุญาตให้ใช้ไมโครโฟนก่อนนะ"}
        </p>
        <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
          {(st === "no" || st === "err") && <Pill onClick={listen} bg="#f59e0b">🎤 ลองอีก</Pill>}
          <Pill onClick={next} bg={gotIt ? "#10b981" : "#9ca3af"}>{gotIt ? "ถัดไป ›" : "ข้าม ›"}</Pill>
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
    if (np.length === tokens.length) {
      setDone(true);
      if (np.map(p => p.t).join(" ") === cur.sen) { track.correct(cur); setScore(s => s + 1); speak(cur.sen, cur.senTh); }
      else track.wrong(cur);
    } else sfx.tap();
  };
  const undo = i => { if (done) return; const r = picked[i]; setPicked(picked.filter((_, j) => j !== i)); setPool([...pool, r]); };
  const chip = (bg, bo, c) => ({ minHeight:44,padding:"8px 12px",borderRadius:12,background:bg,border:`2px solid ${bo}`,color:c,fontWeight:800,fontSize:15,cursor:"pointer" });
  return (
    <GameCard>
      <Bar left={`🧩 ${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ textAlign:"center",marginBottom:8 }}>
          <span style={{ fontSize:40 }}>{cur.emoji}</span>
          <div style={{ fontSize:14,fontWeight:700,color:"#374151" }}>{cur.senTh}</div>
          <div style={{ fontSize:11,color:"#9ca3af" }}>เรียงคำให้เป็นประโยคภาษาอังกฤษ</div>
        </div>
        <SndBtn onClick={() => speak(cur.sen, null)} />
        <div style={{ minHeight:64,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:10,borderRadius:14,marginBottom:10,background:done?(correct?"#d1fae5":"#fee2e2"):"#f9fafb",border:`2px dashed ${done?(correct?"#6ee7b7":"#fca5a5"):"#d1d5db"}` }}>
          {picked.length === 0 && <span style={{ color:"#9ca3af",fontSize:12 }}>แตะคำด้านล่างตามลำดับ</span>}
          {picked.map((l, i) => <button key={l.id} onClick={() => undo(i)} style={chip(done?(correct?"#10b981":"#ef4444"):"#6366f1","transparent","#fff")}>{l.t}</button>)}
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",minHeight:50,marginBottom:10 }}>
          {pool.map(l => <button key={l.id} onClick={() => tap(l)} style={chip("#eef2ff","#c7d2fe","#3730a3")}>{l.t}</button>)}
        </div>
        {done && !correct && <div style={{ textAlign:"center",fontSize:13,color:"#991b1b",marginBottom:8 }}>ที่ถูกคือ: <b>{cur.sen}</b></div>}
        {done && correct && <div style={{ textAlign:"center",fontSize:13,color:"#065f46",fontWeight:700,marginBottom:8 }}>🎉 {cur.sen}</div>}
        <div style={{ display:"flex",gap:8 }}>
          <Pill onClick={() => { setPool(shuffle(tokens.map((t, i) => ({ id: i, t })))); setPicked([]); setDone(false); }} bg="#9ca3af">🔄 ใหม่</Pill>
          <Pill onClick={() => { if (idx + 1 < qs.length) setIdx(i => i + 1); else track.finish(score, qs.length); }} disabled={!done} bg="#8b5cf6">ถัดไป ›</Pill>
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
    <div style={{ background:"#fff",borderRadius:18,padding:"12px 14px",marginBottom:14,border:"2px solid #fde68a",boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
        <span style={{ fontWeight:900,fontSize:15,color:"#1f2937" }}>🎯 ภารกิจวันนี้</span>
        <span style={{ fontSize:11,color:"#9ca3af" }}>{doneAll ? "ครบแล้ว เก่งมาก! 🎉" : "รีเซ็ตทุกวัน"}</span>
      </div>
      {ms.map(m => {
        const n = Math.min(m.goal, d.counters[m.key] || 0);
        const ready = n >= m.goal && !d.claimed[m.id];
        const claimed = !!d.claimed[m.id];
        return (
          <div key={m.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0" }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:13,fontWeight:700,color:claimed?"#9ca3af":"#374151",textDecoration:claimed?"line-through":"none" }}>{m.label}</div>
              <div style={{ height:6,background:"#f3f4f6",borderRadius:999,marginTop:4,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${(n/m.goal)*100}%`,background:claimed?"#d1d5db":"#f59e0b",borderRadius:999,transition:"width .4s" }} />
              </div>
            </div>
            {claimed
              ? <span style={{ fontSize:20 }}>✅</span>
              : ready
                ? <button onClick={() => { sfx.coin(); setProgress(p => ({ ...p, coins:p.coins+m.reward, daily:{ ...p.daily, claimed:{ ...p.daily.claimed, [m.id]:true } } })); }}
                    style={{ minHeight:44,padding:"0 12px",borderRadius:12,background:"#f59e0b",color:"#fff",border:"none",fontWeight:800,fontSize:13,cursor:"pointer",animation:"vpBounce 1s infinite" }}>รับ +{m.reward} 🪙</button>
                : <span style={{ fontSize:12,fontWeight:800,color:"#9ca3af",minWidth:44,textAlign:"right" }}>{n}/{m.goal}</span>}
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
  const bg = SHOP_ITEMS.find(i => i.id === progress.bg)?.css || "linear-gradient(135deg,#fdf2f8,#eef2ff)";
  const buy = it => {
    if (progress.coins < it.cost) { sfx.bad(); showToast(`เหรียญไม่พอ ขาดอีก ${it.cost - progress.coins} 🪙`, "warn"); return; }
    sfx.coin(); setProgress(p => ({ ...p, coins:p.coins-it.cost, owned:{ ...p.owned, [it.id]:true }, [it.type]: it.id }));
    showToast(`ซื้อ ${it.name} แล้ว ✓`);
  };
  const wear = it => { sfx.tap(); setProgress(p => ({ ...p, [it.type]: p[it.type] === it.id ? null : it.id })); };
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:bg,borderRadius:20,padding:16,textAlign:"center",border:"2px solid #e9d5ff",marginBottom:12 }}>
        <PetAvatar pet={pet} hat={progress.hat} size={64} bounce />
        <div style={{ fontWeight:900,fontSize:16,color:progress.bg==="bgSpace"?"#fff":"#1f2937",marginTop:4 }}>{pet?.name || "เพื่อนคู่หู"}</div>
        <div style={{ display:"inline-flex",background:"#fef3c7",color:"#92400e",fontWeight:900,borderRadius:999,padding:"4px 14px",marginTop:6 }}>🪙 {progress.coins}</div>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:12 }}>
        {[["hat","🎩 หมวก"],["bg","🖼️ พื้นหลัง"]].map(([k,l]) => (
          <button key={k} onClick={() => { sfx.tap(); setTab(k); }} style={{ flex:1,minHeight:44,borderRadius:12,border:"none",fontWeight:800,fontSize:14,cursor:"pointer",background:tab===k?"#7c3aed":"#f3f4f6",color:tab===k?"#fff":"#374151" }}>{l}</button>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {items.map(it => {
          const owned = !!progress.owned[it.id]; const on = progress[it.type] === it.id;
          return (
            <div key={it.id} style={{ background:"#fff",borderRadius:16,padding:12,border:`2px solid ${on?"#7c3aed":"#f3f4f6"}`,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ height:64,borderRadius:12,background:it.css||"#f9fafb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,marginBottom:6 }}>{it.emoji}</div>
              <div style={{ fontWeight:800,fontSize:13,color:"#1f2937" }}>{it.name}</div>
              {owned
                ? <button onClick={() => wear(it)} style={{ marginTop:6,width:"100%",minHeight:44,borderRadius:10,border:"none",fontWeight:800,fontSize:13,cursor:"pointer",background:on?"#ede9fe":"#f3f4f6",color:on?"#5b21b6":"#374151" }}>{on ? "ใส่อยู่ ✓ (แตะถอด)" : "ใส่"}</button>
                : <button onClick={() => buy(it)} style={{ marginTop:6,width:"100%",minHeight:44,borderRadius:10,border:"none",fontWeight:800,fontSize:13,cursor:"pointer",background:progress.coins>=it.cost?"#f59e0b":"#e5e7eb",color:progress.coins>=it.cost?"#fff":"#9ca3af" }}>ซื้อ 🪙 {it.cost}</button>}
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
function ReportScreen({ words, categories, progress }) {
  const total = progress.totalCorrect || 0, wrong = progress.wrongTotal || 0;
  const acc = total + wrong ? Math.round((total / (total + wrong)) * 100) : 0;
  const mastered = words.filter(w => isMastered(progress.srs, w.id));
  const learned = words.filter(w => progress.srs[w.id] || progress.learned[w.id]);
  const stickers = words.filter(w => (progress.stickers[w.id] || 0) >= STICKER_NEED).length;
  const weak = words.filter(w => progress.mistakes[w.id] > 0).sort((a, b) => progress.mistakes[b.id] - progress.mistakes[a.id]).slice(0, 10);
  const Stat = ({ v, l, c }) => <div style={{ background:"#fff",borderRadius:14,padding:"10px 8px",textAlign:"center",border:"1px solid #f3f4f6" }}><div style={{ fontSize:22,fontWeight:900,color:c }}>{v}</div><div style={{ fontSize:11,color:"#6b7280" }}>{l}</div></div>;
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:560,margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(135deg,#0ea5e9,#6366f1)",borderRadius:20,padding:16,color:"#fff",marginBottom:12 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>📊 รายงานผู้ปกครอง</div>
        <div style={{ fontSize:13,opacity:0.9 }}>ความคืบหน้าทั้งหมดของลูก · อัปเดตอัตโนมัติ</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12 }}>
        <Stat v={mastered.length} l={`คำที่จำได้แม่น / ${words.length}`} c="#059669" />
        <Stat v={learned.length} l="คำที่เคยเรียน" c="#2563eb" />
        <Stat v={`${acc}%`} l="ความแม่นยำ" c="#d97706" />
        <Stat v={total} l="ตอบถูกสะสม" c="#7c3aed" />
        <Stat v={progress.games || 0} l="รอบที่เล่นจบ" c="#db2777" />
        <Stat v={`${progress.streak.count} วัน`} l="เล่นต่อเนื่อง" c="#ea580c" />
      </div>
      <div style={{ background:"#fff",borderRadius:16,padding:14,marginBottom:12,border:"1px solid #f3f4f6" }}>
        <div style={{ fontWeight:800,fontSize:14,color:"#1f2937",marginBottom:8 }}>ความคืบหน้าแต่ละหมวด</div>
        {categories.map(c => {
          const ws = words.filter(w => w.cat === c.id); if (!ws.length) return null;
          const m = ws.filter(w => isMastered(progress.srs, w.id)).length;
          const st = c.games.reduce((a, g) => a + (progress.stars[`${c.id}:${g}`] || 0), 0);
          return (
            <div key={c.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 0" }}>
              <span style={{ fontSize:18,width:24 }}>{c.emoji}</span>
              <span style={{ fontSize:12,fontWeight:700,color:"#374151",width:72 }}>{c.label}{progress.boss[c.id] ? " 👑" : ""}</span>
              <div style={{ flex:1,height:8,background:"#f3f4f6",borderRadius:999,overflow:"hidden" }}><div style={{ height:"100%",width:`${(m/ws.length)*100}%`,background:c.color,borderRadius:999 }} /></div>
              <span style={{ fontSize:11,color:"#6b7280",width:88,textAlign:"right" }}>{m}/{ws.length} · ⭐{st}</span>
            </div>
          );
        })}
      </div>
      <div style={{ background:"#fff",borderRadius:16,padding:14,border:"1px solid #f3f4f6" }}>
        <div style={{ fontWeight:800,fontSize:14,color:"#1f2937",marginBottom:4 }}>คำที่ยังพลาดบ่อย</div>
        <div style={{ fontSize:11,color:"#9ca3af",marginBottom:8 }}>ลองชวนลูกทบทวนคำพวกนี้ด้วยกัน</div>
        {weak.length === 0 && <div style={{ fontSize:13,color:"#059669",fontWeight:700 }}>ยังไม่มี เก่งมาก! 🎉</div>}
        {weak.map(w => (
          <div key={w.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderTop:"1px solid #f9fafb" }}>
            <span style={{ fontSize:24 }}>{w.emoji}</span>
            <div style={{ flex:1 }}><div style={{ fontWeight:800,fontSize:13,color:"#1f2937" }}>{w.word} <span style={{ color:"#7c3aed",fontWeight:600 }}>{w.read}</span></div><div style={{ fontSize:12,color:"#6b7280" }}>{w.meaning}</div></div>
            <span style={{ fontSize:11,fontWeight:800,color:"#dc2626",background:"#fee2e2",padding:"2px 8px",borderRadius:999 }}>พลาด {progress.mistakes[w.id]}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11,color:"#9ca3af",textAlign:"center",marginTop:12 }}>"จำได้แม่น" = ตอบถูกต่อเนื่องจนระบบเว้นระยะทบทวน ≥ 7 วัน</div>
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
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end",background:"rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:"22px 22px 0 0",padding:"20px 20px 36px",maxWidth:480,width:"100%",margin:"0 auto",maxHeight:"90dvh",overflowY:"auto" }}>
        <div style={{ width:38,height:4,background:"#e5e7eb",borderRadius:999,margin:"0 auto 18px" }}/>
        <h3 style={{ fontWeight:800,fontSize:17,color:"#1f2937",margin:"0 0 6px" }}>👤 ใครกำลังเล่น?</h3>
        <p style={{ fontSize:12,color:"#6b7280",margin:"0 0 14px" }}>แต่ละคนมีดาว เหรียญ สติกเกอร์ เพื่อนคู่หู แยกกัน · คำศัพท์ใช้ร่วมกัน</p>
        {profiles.list.map(pf => {
          const on = pf.id === profiles.current;
          return (
            <div key={pf.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:14,marginBottom:8,background:on?"#ede9fe":"#f9fafb",border:`2px solid ${on?"#8b5cf6":"transparent"}` }}>
              <button onClick={() => { sfx.tap(); onSwitch(pf.id); }} style={{ flex:1,display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",minHeight:44,textAlign:"left",padding:0 }}>
                <span style={{ fontSize:30 }}>{pf.avatar}</span>
                <span style={{ fontWeight:800,fontSize:15,color:"#1f2937" }}>{pf.name}</span>
                {on && <span style={{ fontSize:11,fontWeight:800,color:"#7c3aed",background:"#fff",padding:"2px 8px",borderRadius:999 }}>กำลังเล่น</span>}
              </button>
              {profiles.list.length > 1 && (
                <button onClick={() => { if (window.confirm(`ลบโปรไฟล์ "${pf.name}"?\\nดาว เหรียญ สติกเกอร์ของคนนี้จะหายทั้งหมด`)) onDelete(pf.id); }}
                  style={{ width:44,height:44,borderRadius:12,background:"#fee2e2",border:"none",cursor:"pointer",fontSize:16 }}>🗑️</button>
              )}
            </div>
          );
        })}
        {!adding ? (
          <button onClick={() => { sfx.tap(); setAdding(true); }} style={{ width:"100%",minHeight:48,borderRadius:14,border:"2px dashed #c4b5fd",background:"#fff",color:"#7c3aed",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:4 }}>＋ เพิ่มคนใหม่</button>
        ) : (
          <div style={{ background:"#f5f3ff",borderRadius:16,padding:12,marginTop:4 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ (เช่น น้องมีนา)" maxLength={12} style={{ ...inputStyle,marginBottom:8 }} />
            <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10 }}>
              {AVATARS.map(a => <button key={a} onClick={() => { sfx.tap(); setAvatar(a); }} style={{ minHeight:48,borderRadius:12,fontSize:26,border:`2px solid ${avatar===a?"#8b5cf6":"#e5e7eb"}`,background:avatar===a?"#ede9fe":"#fff",cursor:"pointer" }}>{a}</button>)}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={() => { if (!name.trim()) return; sfx.coin(); onAdd(name.trim(), avatar); setAdding(false); setName(""); }} style={{ flex:1,minHeight:44,borderRadius:12,border:"none",background:"#7c3aed",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer" }}>สร้าง ✓</button>
              <button onClick={() => setAdding(false)} style={{ flex:1,minHeight:44,borderRadius:12,border:"none",background:"#fff",color:"#374151",fontWeight:700,fontSize:14,cursor:"pointer" }}>ยกเลิก</button>
            </div>
          </div>
        )}
        <button onClick={onClose} style={{ width:"100%",minHeight:44,marginTop:12,borderRadius:12,background:"#f3f4f6",color:"#374151",fontWeight:700,fontSize:14,border:"none",cursor:"pointer" }}>✓ เสร็จสิ้น</button>
      </div>
    </div>
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
  const LV = { A1: ["A1 · เริ่มต้น", "#10b981"], "A1+": ["A1+ · ต่อยอด", "#3b82f6"], A2: ["A2 · เก่งแล้ว", "#8b5cf6"] };
  const STEP = { learn: ["📖", "เรียนการ์ด"], quiz: ["🏆", "ทำแบบทดสอบ"], listen: ["👂", "ฟังแล้วเลือก"] };
  return (
    <div style={{ padding:"14px 12px 60px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(135deg,#10b981,#3b82f6)",borderRadius:20,padding:16,color:"#fff",marginBottom:16 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>🗺️ เส้นทางบทเรียน</div>
        <div style={{ fontSize:13,opacity:0.9 }}>ผ่านแล้ว {doneCount}/{units.length} บท · บทละ 3 ขั้น เรียน → ทดสอบ → ฟัง</div>
        <div style={{ height:8,background:"rgba(255,255,255,0.3)",borderRadius:999,marginTop:8,overflow:"hidden" }}><div style={{ height:"100%",width:`${units.length?doneCount/units.length*100:0}%`,background:"#fff",borderRadius:999 }} /></div>
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
                    background:done?"#10b981":unlocked?u.cat.color:"#e5e7eb",color:"#fff",boxShadow:unlocked&&!done?`0 8px 20px ${u.cat.color}66`:"none",animation:unlocked&&!done?"vpBounce 1.6s infinite":"none" }}>
                  <span style={{ fontSize:30 }}>{done ? "✓" : unlocked ? u.cat.emoji : "🔒"}</span>
                  <span style={{ fontSize:10,fontWeight:800,opacity:0.95 }}>บท {u.n}</span>
                </button>
              ) : (
                <div style={{ width:"100%",background:"#fff",borderRadius:20,padding:14,border:`2px solid ${u.cat.color}60`,boxShadow:"0 8px 24px rgba(0,0,0,0.08)" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                    <span style={{ fontSize:34 }}>{u.cat.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:900,fontSize:16,color:"#1f2937" }}>บทที่ {u.n} · {u.cat.thai}</div>
                      <div style={{ fontSize:11,color:"#6b7280" }}>{u.words.length} คำ: {u.words.slice(0,5).map(w=>w.word).join(", ")}{u.words.length>5?"…":""}</div>
                    </div>
                    <span style={{ fontSize:12,fontWeight:800,color:done?"#059669":"#9ca3af" }}>{steps}/3</span>
                  </div>
                  {UNIT_STEPS.map((s, k) => {
                    const sd = !!path[u.id]?.[s];
                    const prevDone = k === 0 || !!path[u.id]?.[UNIT_STEPS[k - 1]];
                    return (
                      <button key={s} onClick={() => { if (!unlocked || !prevDone) { sfx.bad(); return; } sfx.tap(); onStep(u, s); }}
                        style={{ width:"100%",minHeight:52,borderRadius:14,marginBottom:6,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:10,padding:"0 12px",textAlign:"left",
                          background:sd?"#d1fae5":prevDone&&unlocked?"#f5f3ff":"#f3f4f6",color:sd?"#065f46":prevDone&&unlocked?"#4c1d95":"#9ca3af" }}>
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
            {i < units.length - 1 && !open && <div style={{ textAlign:"center",color:"#d1d5db",fontSize:18,lineHeight:1,marginBottom:6 }}>⋮</div>}
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
    <div style={{ background:"#eff6ff",border:"2px solid #bfdbfe",borderRadius:16,padding:"10px 12px",marginBottom:14,display:"flex",alignItems:"center",gap:10 }}>
      <span style={{ fontSize:28 }}>📲</span>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:800,fontSize:13,color:"#1e40af" }}>ติดตั้งลงหน้าจอมือถือ เล่นออฟไลน์ได้</div>
        <div style={{ fontSize:11,color:"#3b82f6" }}>{deferred ? "เปิดเร็วเหมือนแอป ไม่ต้องพิมพ์ลิงก์" : "Safari: แตะปุ่มแชร์ ⬆️ แล้วเลือก \"เพิ่มไปยังหน้าจอโฮม\""}</div>
      </div>
      {deferred && <button onClick={onInstall} style={{ minHeight:44,padding:"0 14px",borderRadius:12,border:"none",background:"#2563eb",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer" }}>ติดตั้ง</button>}
      <button onClick={onDismiss} style={{ width:44,height:44,borderRadius:12,border:"none",background:"transparent",color:"#93c5fd",fontSize:20,cursor:"pointer" }}>✕</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREDITS — ที่มาและสัญญาอนุญาตของรูปจาก Wikimedia Commons (public/img/credits.json)
// ═══════════════════════════════════════════════════════
function CreditsScreen({ words }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}img/credits.json`).then(r => r.json()).then(j => setList(Object.entries(j))).catch(() => setList([]));
  }, []);
  const wordOf = title => words.find(w => imageTitleOf(w) === title);
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:560,margin:"0 auto" }}>
      <div style={{ background:"#fff",borderRadius:16,padding:14,border:"1px solid #f3f4f6",marginBottom:12,fontSize:13,color:"#374151",lineHeight:1.6 }}>
        รูปถ่ายประกอบคำศัพท์มาจาก <b>Wikipedia / Wikimedia Commons</b> ภายใต้สัญญาอนุญาตแบบเปิด (CC BY / CC BY-SA / สาธารณสมบัติ ฯลฯ) ผู้สร้างและสัญญาอนุญาตของแต่ละรูปอยู่ด้านล่าง · แตะเพื่อเปิดหน้าต้นทาง
      </div>
      {list === null && <div style={{ textAlign:"center",color:"#9ca3af" }}>กำลังโหลด…</div>}
      {list && list.length === 0 && <div style={{ textAlign:"center",color:"#9ca3af" }}>ยังไม่มีรายการ</div>}
      {list && list.map(([title, c]) => {
        const w = wordOf(title);
        return (
          <a key={title} href={c.source || c.page || "#"} target="_blank" rel="noreferrer" style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid #f3f4f6",textDecoration:"none",color:"inherit",minHeight:44 }}>
            {c.file && <img src={`${import.meta.env.BASE_URL}img/${c.file}`} alt="" loading="lazy" style={{ width:44,height:33,objectFit:"cover",borderRadius:6,flexShrink:0 }} />}
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:800,fontSize:13,color:"#1f2937" }}>{w ? `${w.emoji} ${w.word}` : title} <span style={{ fontWeight:500,color:"#9ca3af" }}>· {title}</span></div>
              <div style={{ fontSize:11,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{c.artist || "—"} · {c.license || "ดูที่ต้นทาง"}</div>
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
function picOf(words, key, size) {
  const w = wordByKey(words, key);
  if (w) return <Pic w={w} size={size} radius={16} />;
  return <span style={{ fontSize:size }}>{key}</span>;
}
// หาคำศัพท์จาก token ในประโยค (ตัดเครื่องหมาย · ตัด s ท้ายคำ)
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
      <div style={{ background:"linear-gradient(135deg,#f97316,#ec4899)",borderRadius:20,padding:16,color:"#fff",marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>💬 บทสนทนาในชีวิตจริง</div>
        <div style={{ fontSize:13,opacity:0.9 }}>{DIALOGUES.length} สถานการณ์ · ฟัง → เล่นบทบาท (พูดเอง) → เติมคำ</div>
      </div>
      {DIALOGUES.map(d => {
        const done = ["droleplay","dfill"].filter(g => (progress.stars[`dialog:${d.id}:${g}`] || 0) >= 1).length;
        return (
          <button key={d.id} onClick={() => { sfx.tap(); onOpen(d); }}
            style={{ width:"100%",minHeight:72,background:"#fff",border:"1px solid #f3f4f6",borderRadius:16,padding:"10px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ width:56,height:42,borderRadius:12,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#f9fafb" }}>{picOf(words, d.scene, 24)}</div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:800,fontSize:15,color:"#1f2937" }}>{d.emoji} {d.title}</div>
              <div style={{ fontSize:12,color:"#6b7280" }}>{d.titleTh} · {d.lines.length} ประโยค</div>
            </div>
            <span style={{ fontSize:12,fontWeight:800,color:done===2?"#059669":"#9ca3af" }}>{done===2?"✓ ครบ":`${done}/2`}</span>
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
  const cat = useMemo(() => ({ id:`dialog:${d.id}`, label:d.title, thai:d.titleTh, emoji:d.emoji, color:"#f97316", games:["droleplay","dfill"], dialog:d, role }), [d, role]);
  const vocab = useMemo(() => { const set = new Set(); d.lines.forEach(l => l.en.split(" ").forEach(t => { const w = lookupToken(words, t); if (w) set.add(w); })); return [...set]; }, [d, words]);
  const tabs = [["listen","👂 ฟัง"],["roleplay","🎭 เล่นบทบาท"],["fill","🧩 เติมคำ"]];
  const nameOf = who => (who === "A" ? d.a : d.b);
  return (
    <div style={{ padding:"10px 10px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,background:"#fff7ed",border:"2px solid #fed7aa",borderRadius:18,padding:"10px 12px",marginBottom:10 }}>
        <div style={{ width:64,height:48,borderRadius:12,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>{picOf(words, d.scene, 26)}</div>
        <div style={{ flex:1,minWidth:0 }}><div style={{ fontWeight:900,fontSize:16,color:"#1f2937" }}>{d.emoji} {d.title}</div><div style={{ fontSize:12,color:"#6b7280" }}>{d.titleTh} · {nameOf("A")} กับ {nameOf("B")}</div></div>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:10 }}>
        {tabs.map(([k,l]) => <button key={k} onClick={() => { sfx.tap(); setMode(k); }} style={{ flex:1,minHeight:44,borderRadius:12,border:"none",fontWeight:800,fontSize:13,cursor:"pointer",background:mode===k?"#f97316":"#f3f4f6",color:mode===k?"#fff":"#374151" }}>{l}</button>)}
      </div>

      {mode === "listen" && (
        <div>
          <button onClick={() => speakSeq(d.lines.map(l => ({ en:l.en, th:l.th })))} style={{ width:"100%",minHeight:48,borderRadius:14,border:"none",background:"#1f2937",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",marginBottom:10 }}>▶ ฟังทั้งบทสนทนา</button>
          {d.lines.map((l, i) => {
            const left = l.who === "A";
            return (
              <div key={i} style={{ display:"flex",justifyContent:left?"flex-start":"flex-end",marginBottom:8 }}>
                <button onClick={() => speak(l.en, l.th)} style={{ maxWidth:"85%",textAlign:"left",border:"none",cursor:"pointer",borderRadius:left?"4px 18px 18px 18px":"18px 4px 18px 18px",padding:"10px 14px",minHeight:44,background:left?"#fff":"#fde68a",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize:10,fontWeight:800,color:left?"#f97316":"#92400e",marginBottom:2 }}>{nameOf(l.who)} 🔊</div>
                  <div style={{ fontSize:15,fontWeight:700,color:"#1f2937" }}>{l.en}</div>
                  <div style={{ fontSize:12,color:"#6b7280",marginTop:2 }}>{l.th}</div>
                </button>
              </div>
            );
          })}
          {vocab.length > 0 && <div style={{ marginTop:12,background:"#fff",borderRadius:16,padding:12,border:"1px solid #f3f4f6" }}>
            <div style={{ fontWeight:800,fontSize:13,color:"#1f2937",marginBottom:6 }}>คำศัพท์ในบทนี้ ({vocab.length})</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
              {vocab.map(w => <button key={w.id} onClick={() => speak(w.word, w.meaning)} style={{ minHeight:44,borderRadius:999,border:"1px solid #e5e7eb",background:"#f9fafb",padding:"0 12px",fontSize:13,fontWeight:700,color:"#374151",cursor:"pointer" }}>{w.emoji} {w.word} <span style={{ color:"#9ca3af",fontWeight:500 }}>{w.meaning}</span></button>)}
            </div>
          </div>}
        </div>
      )}

      {mode === "roleplay" && !role && (
        <div style={{ background:"#fff",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #f3f4f6" }}>
          <div style={{ fontWeight:900,fontSize:16,color:"#1f2937",marginBottom:4 }}>🎭 หนูจะเป็นใคร?</div>
          <div style={{ fontSize:12,color:"#6b7280",marginBottom:12 }}>แอปจะพูดอีกฝ่าย ส่วนประโยคของหนูต้องพูดเองใส่ไมค์ 🎤</div>
          <div style={{ display:"flex",gap:10 }}>
            {["A","B"].map(r => <button key={r} onClick={() => { sfx.tap(); setRole(r); }} style={{ flex:1,minHeight:64,borderRadius:16,border:"2px solid #fed7aa",background:"#fff7ed",fontWeight:900,fontSize:16,color:"#9a3412",cursor:"pointer" }}>{r === "A" ? "🅰️" : "🅱️"} {nameOf(r)}</button>)}
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
        {i > 0 && <div style={{ fontSize:11,color:"#9ca3af",marginBottom:8,textAlign:d.lines[i-1].who==="A"?"left":"right" }}>{nameOf(d.lines[i-1].who)}: {d.lines[i-1].en}</div>}
        <div style={{ background:mine?"#fde68a":"#fff",border:`2px solid ${mine?"#f59e0b":"#e5e7eb"}`,borderRadius:18,padding:14,marginBottom:10 }}>
          <div style={{ fontSize:11,fontWeight:800,color:mine?"#92400e":"#f97316",marginBottom:4 }}>{mine ? `🫵 ตาหนู (${nameOf(role)}) พูดว่า:` : `${nameOf(line.who)} พูด:`}</div>
          <div style={{ fontSize:18,fontWeight:800,color:"#1f2937" }}>{line.en}</div>
          <div style={{ fontSize:13,color:"#6b7280",marginTop:2 }}>{line.th}</div>
        </div>
        {!mine ? (
          <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
            <Pill onClick={() => speak(line.en, null)} bg="#6366f1">🔊 ฟัง</Pill>
            <Pill onClick={next} bg="#10b981">ถัดไป ›</Pill>
          </div>
        ) : (
          <div style={{ textAlign:"center" }}>
            <SndBtn onClick={() => speak(line.en, null)} />
            <button onClick={listen} disabled={st === "listening"}
              style={{ width:96,height:96,borderRadius:48,margin:"0 auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,background:st==="listening"?"#ef4444":st==="ok"?"#10b981":"linear-gradient(135deg,#f59e0b,#ef4444)",border:"none",cursor:"pointer",boxShadow:"0 8px 24px rgba(239,68,68,0.3)",animation:st==="listening"?"vpBounce .6s infinite":"none" }}>
              {st === "ok" ? "✅" : "🎤"}
            </button>
            <p style={{ fontSize:13,fontWeight:700,margin:"0 0 8px",color:st==="ok"?"#059669":st==="no"?"#dc2626":"#374151" }}>
              {st === "idle" && (SR ? "แตะไมค์แล้วพูดประโยคนี้" : "เครื่องนี้ไม่มีไมค์สำหรับเช็คเสียง · พูดออกเสียงแล้วแตะปุ่มด้านบน")}
              {st === "listening" && "กำลังฟัง..."}
              {st === "ok" && (pct ? `เยี่ยม! ใกล้เคียง ${pct}% 👏` : "เยี่ยม! 👏")}
              {st === "no" && (heard ? `ได้ยินว่า "${heard}" (${pct}%) ลองอีกที` : "ไม่ได้ยิน ลองพูดดังๆ")}
            </p>
            <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
              {st === "no" && <Pill onClick={listen} bg="#f59e0b">🎤 ลองอีก</Pill>}
              <Pill onClick={next} bg={gotIt ? "#10b981" : "#9ca3af"}>{gotIt ? "ถัดไป ›" : "ข้าม ›"}</Pill>
            </div>
          </div>
        )}
      </div>
    </GameCard>
  );
}

// เติมคำ: ประโยคเว้นช่อง เลือกคำจาก 3 ตัวเลือก (ตัวหลอกมาจากช่องว่างประโยคอื่นในบทเดียวกัน)
function FillGame({ cat, speak, track, onBack }) {
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
    setTimeout(() => { if (i + 1 < qs.length) { setI(i + 1); setPicked(null); } else track.finish(ok ? score + 1 : score, qs.length); }, 1300);
  };
  return (
    <GameCard>
      <Bar left={`🧩 ${i+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ fontSize:11,fontWeight:800,color:"#f97316",marginBottom:4 }}>{q.who === "A" ? d.a : d.b} พูดว่า:</div>
        <div style={{ fontSize:19,fontWeight:800,color:"#1f2937",lineHeight:1.5,marginBottom:4 }}>
          {parts[0]}<span style={{ display:"inline-block",minWidth:70,borderBottom:"3px solid #f59e0b",color:picked?(picked===q.blank?"#059669":"#dc2626"):"#f59e0b",textAlign:"center",padding:"0 4px" }}>{picked || "______"}</span>{parts[1]}
        </div>
        <div style={{ fontSize:13,color:"#6b7280",marginBottom:12 }}>{q.th}</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr",gap:8 }}>
          {opts.map(o => {
            const ic = o === q.blank, ip = picked === o;
            let bg = "#fff7ed", bo = "#fdba74", c = "#9a3412";
            if (picked && ic) { bg = "#d1fae5"; bo = "#6ee7b7"; c = "#065f46"; }
            if (picked && ip && !ic) { bg = "#fee2e2"; bo = "#fca5a5"; c = "#991b1b"; }
            return <button key={o} onClick={() => pick(o)} disabled={!!picked} style={{ minHeight:50,borderRadius:12,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:800,fontSize:16,cursor:"pointer" }}>{o}</button>;
          })}
        </div>
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
      <div style={{ background:"linear-gradient(135deg,#8b5cf6,#3b82f6)",borderRadius:20,padding:16,color:"#fff",marginBottom:14 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>📖 นิทานภาพ</div>
        <div style={{ fontSize:13,opacity:0.9 }}>{STORIES.length} เรื่อง · อ่านพร้อมเสียง · แตะคำที่ไม่รู้ · ตอบคำถามท้ายเรื่อง</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        {STORIES.map(s => {
          const done = (progress.stars[`story:${s.id}:squiz`] || 0) >= 1;
          return (
            <button key={s.id} onClick={() => { sfx.tap(); onOpen(s); }} style={{ background:"#fff",border:"1px solid #f3f4f6",borderRadius:18,padding:10,cursor:"pointer",textAlign:"left",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",minHeight:160,display:"flex",flexDirection:"column",gap:6 }}>
              <div style={{ width:"100%",aspectRatio:"4/3",borderRadius:12,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"#f9fafb",position:"relative" }}>
                <PicFill w={wordByKey(words, s.pages[0].pic) || { emoji:s.emoji, word:s.title }} emojiSize={40} />
                {done && <span style={{ position:"absolute",top:6,right:6,background:"#10b981",color:"#fff",fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:999 }}>✓ อ่านแล้ว</span>}
              </div>
              <div style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{s.emoji} {s.title}</div>
              <div style={{ fontSize:11,color:"#6b7280" }}>{s.titleTh} · {s.pages.length} หน้า · {s.level}</div>
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
  const page = s.pages[i];
  const cat = useMemo(() => ({ id:`story:${s.id}`, label:s.title, thai:s.titleTh, emoji:s.emoji, color:"#8b5cf6", games:["squiz"], story:s }), [s]);
  if (quiz) return <GameRouter gameId="squiz" cat={cat} words={words.slice(0, 8)} speak={speak} speakAt={speakAt} showToast={showToast} onBack={onBack} progress={progress} setProgress={setProgress} allWords={words} />;
  const tokens = page.en.split(" ");
  return (
    <div style={{ padding:"10px 10px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:700,color:"#6b7280",padding:"0 4px 8px" }}>
        <span>{s.emoji} {s.title}</span><span>หน้า {i+1}/{s.pages.length}</span>
      </div>
      <div style={{ height:6,background:"#f3f4f6",borderRadius:999,marginBottom:10,overflow:"hidden" }}><div style={{ height:"100%",width:`${((i+1)/s.pages.length)*100}%`,background:"#8b5cf6",borderRadius:999,transition:"width .3s" }} /></div>
      <div style={{ background:"#fff",borderRadius:22,overflow:"hidden",boxShadow:"0 8px 28px rgba(0,0,0,0.08)",border:"1px solid #f3f4f6" }}>
        <div style={{ width:"100%",aspectRatio:"4/3",position:"relative",background:"#f9fafb",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <PicFill w={wordByKey(words, page.pic) || { emoji:page.pic, word:"" }} emojiSize={80} />
        </div>
        <div style={{ padding:"14px 16px 10px" }}>
          <div style={{ fontSize:20,fontWeight:800,color:"#1f2937",lineHeight:1.6 }}>
            {tokens.map((t, k) => {
              const w = lookupToken(words, t);
              return <span key={k}>{w
                ? <button onClick={() => { sfx.tap(); setPopup(w); speak(w.word, w.meaning); }} style={{ background:"none",border:"none",padding:0,font:"inherit",color:"#7c3aed",textDecoration:"underline dotted",cursor:"pointer",minHeight:44 }}>{t}</button>
                : t}{" "}</span>;
            })}
          </div>
          {showTh && <div style={{ fontSize:14,color:"#6b7280",marginTop:6 }}>{page.th}</div>}
          {popup && (
            <div style={{ marginTop:10,background:"#f5f3ff",borderRadius:14,padding:"8px 12px",display:"flex",alignItems:"center",gap:10 }}>
              <Pic w={popup} size={20} radius={8} />
              <div style={{ flex:1 }}><b style={{ color:"#1f2937" }}>{popup.word}</b> <span style={{ color:"#7c3aed",fontSize:12 }}>{popup.read}</span><div style={{ fontSize:13,color:"#374151" }}>{popup.meaning}</div></div>
              <button onClick={() => setPopup(null)} style={{ width:44,height:44,border:"none",background:"transparent",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
            </div>
          )}
        </div>
        <div style={{ display:"flex",gap:6,padding:"0 12px 12px" }}>
          <button onClick={() => speak(page.en, showTh ? page.th : null)} style={{ flex:1,minHeight:44,borderRadius:12,border:"none",background:"#ede9fe",color:"#5b21b6",fontWeight:800,fontSize:13,cursor:"pointer" }}>🔊 อ่านหน้านี้</button>
          <button onClick={() => speakAt(page.en, null, 0.6)} style={{ flex:1,minHeight:44,borderRadius:12,border:"none",background:"#f3f4f6",color:"#374151",fontWeight:800,fontSize:13,cursor:"pointer" }}>🐢 ช้าๆ</button>
          <button onClick={() => { sfx.tap(); setShowTh(v => !v); }} style={{ minWidth:44,minHeight:44,borderRadius:12,border:"none",background:showTh?"#fef3c7":"#f3f4f6",color:"#92400e",fontWeight:800,fontSize:13,cursor:"pointer" }}>ไทย</button>
        </div>
      </div>
      <div style={{ display:"flex",gap:8,marginTop:12 }}>
        <button onClick={() => { sfx.tap(); setPopup(null); setI(Math.max(0, i - 1)); }} disabled={i === 0} style={{ flex:1,minHeight:50,borderRadius:14,border:"none",background:i===0?"#f3f4f6":"#fff",color:i===0?"#d1d5db":"#374151",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>‹ ก่อนหน้า</button>
        {i + 1 < s.pages.length
          ? <button onClick={() => { sfx.tap(); setPopup(null); setI(i + 1); }} style={{ flex:2,minHeight:50,borderRadius:14,border:"none",background:"#8b5cf6",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer" }}>หน้าถัดไป ›</button>
          : <button onClick={() => { sfx.coin(); setQuiz(true); }} style={{ flex:2,minHeight:50,borderRadius:14,border:"none",background:"#10b981",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer" }}>🎯 ตอบคำถามท้ายเรื่อง</button>}
      </div>
      <p style={{ textAlign:"center",fontSize:11,color:"#9ca3af",marginTop:10 }}>แตะคำสีม่วงเพื่อฟังและดูความหมาย</p>
    </div>
  );
}

// คำถามท้ายเรื่อง 3 ข้อ
function StoryQuizGame({ cat, speak, track, onBack }) {
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
    setTimeout(() => { if (i + 1 < s.quiz.length) { setI(i + 1); setPicked(null); } else track.finish(ok ? score + 1 : score, s.quiz.length, { label:`ตอบถูก ${ok ? score + 1 : score}/${s.quiz.length} ข้อ` }); }, 1100);
  };
  return (
    <GameCard>
      <Bar left={`🎯 ข้อ ${i+1}/${s.quiz.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ fontSize:12,color:"#9ca3af",marginBottom:4 }}>{s.emoji} {s.title}</div>
        <div style={{ fontSize:18,fontWeight:800,color:"#1f2937" }}>{q.q}</div>
        <div style={{ fontSize:13,color:"#6b7280",marginBottom:10 }}>{q.qTh}</div>
        <SndBtn onClick={() => speak(q.q, q.qTh)} />
        <div style={{ display:"grid",gap:8 }}>
          {opts.map(o => {
            const ic = o === q.answer, ip = picked === o;
            let bg = "#f5f3ff", bo = "#ddd6fe", c = "#4c1d95";
            if (picked && ic) { bg = "#d1fae5"; bo = "#6ee7b7"; c = "#065f46"; }
            if (picked && ip && !ic) { bg = "#fee2e2"; bo = "#fca5a5"; c = "#991b1b"; }
            return <button key={o} onClick={() => pick(o)} disabled={!!picked} style={{ minHeight:50,borderRadius:12,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:800,fontSize:15,cursor:"pointer",textAlign:"left",padding:"0 14px" }}>{o}</button>;
          })}
        </div>
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
      <div style={{ background:"linear-gradient(135deg,#06b6d4,#8b5cf6)",borderRadius:20,padding:16,color:"#fff",marginBottom:12 }}>
        <div style={{ fontWeight:900,fontSize:20 }}>🔤 โฟนิกส์ A–Z</div>
        <div style={{ fontSize:13,opacity:0.9 }}>รู้เสียงของตัวอักษร → อ่านคำใหม่ได้เอง · แตะตัวอักษรเพื่อฟังชื่อและเสียง</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:12 }}>
        {PHONICS.map(p => <button key={p.L} onClick={() => { sfx.tap(); setSel(p); speak(p.L, null); }} style={{ minHeight:44,borderRadius:10,border:`2px solid ${sel.L===p.L?"#8b5cf6":"#e5e7eb"}`,background:sel.L===p.L?"#ede9fe":"#fff",fontWeight:900,fontSize:16,color:"#1f2937",cursor:"pointer" }}>{p.L}</button>)}
      </div>
      <div style={{ background:"#fff",borderRadius:20,padding:16,border:"1px solid #f3f4f6",boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <div style={{ width:84,height:84,borderRadius:20,background:"linear-gradient(135deg,#ede9fe,#cffafe)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,fontWeight:900,color:"#4c1d95" }}>{sel.L}{sel.L.toLowerCase()}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13,color:"#6b7280" }}>ชื่อตัวอักษร: <b style={{ color:"#1f2937" }}>{sel.name}</b></div>
            <div style={{ fontSize:13,color:"#6b7280" }}>เสียง: <b style={{ color:"#7c3aed",fontSize:16 }}>{sel.sound}</b></div>
            <div style={{ display:"flex",gap:6,marginTop:6 }}>
              <button onClick={() => speak(sel.L, `ตัว ${sel.name}`)} style={{ minHeight:44,padding:"0 12px",borderRadius:10,border:"none",background:"#ede9fe",color:"#5b21b6",fontWeight:800,fontSize:12,cursor:"pointer" }}>🔊 ชื่อ</button>
              {ex[0] && <button onClick={() => speakAt(`${sel.L}. ${ex[0].word}. ${sel.L} is for ${ex[0].word.toLowerCase()}.`, `${sel.sound} ${ex[0].meaning}`, 0.8)} style={{ minHeight:44,padding:"0 12px",borderRadius:10,border:"none",background:"#cffafe",color:"#155e75",fontWeight:800,fontSize:12,cursor:"pointer" }}>🔊 {sel.L} is for {ex[0].word}</button>}
            </div>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.max(1, ex.length)},1fr)`,gap:8,marginTop:14 }}>
          {ex.map(w => (
            <button key={w.id} onClick={() => speak(w.word, w.meaning)} style={{ background:"#f9fafb",border:"1px solid #f3f4f6",borderRadius:14,padding:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,minHeight:44 }}>
              <Pic w={w} size={34} radius={10} />
              <div style={{ fontWeight:900,fontSize:13,color:"#1f2937" }}><span style={{ color:"#7c3aed" }}>{w.word[0]}</span>{w.word.slice(1)}</div>
              <div style={{ fontSize:11,color:"#6b7280" }}>{w.meaning}</div>
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => { sfx.tap(); onGame(); }} style={{ width:"100%",minHeight:60,marginTop:14,borderRadius:16,border:"none",background:"linear-gradient(135deg,#06b6d4,#3b82f6)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 6px 18px rgba(6,182,212,0.3)" }}>
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
    setTimeout(() => { if (i + 1 < qs.length) { setI(i + 1); setPicked(null); setPlayed(false); } else track.finish(ok ? score + 1 : score, qs.length); }, 1100);
  };
  return (
    <GameCard>
      <Bar left={`🔤 ${i+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{ display:"flex",justifyContent:"center",marginBottom:6 }}><Pic w={q.w} size={60} /></div>
        <SndBtn onClick={() => { setPlayed(true); speakAt(q.w.word, null, 0.75); }} />
        <p style={{ textAlign:"center",fontSize:13,fontWeight:700,color:"#374151",margin:"0 0 10px",minHeight:20 }}>
          {picked ? <span style={{ color:"#7c3aed" }}>{q.w.word} · {q.w.read} · {q.w.meaning}</span> : played ? "คำนี้ขึ้นต้นด้วยตัวอะไร?" : "แตะฟังก่อน แล้วเลือกตัวอักษรตัวแรก"}
        </p>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
          {opts.map(L => {
            const ic = L === q.L, ip = picked === L;
            let bg = "#f0fdfa", bo = "#99f6e4", c = "#134e4a";
            if (picked && ic) { bg = "#d1fae5"; bo = "#6ee7b7"; c = "#065f46"; }
            if (picked && ip && !ic) { bg = "#fee2e2"; bo = "#fca5a5"; c = "#991b1b"; }
            return <button key={L} onClick={() => pick(L)} disabled={!!picked || !played} style={{ minHeight:64,borderRadius:14,border:`2px solid ${bo}`,background:bg,color:c,fontWeight:900,fontSize:28,cursor:"pointer",opacity:played?1:0.5 }}>{L}</button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

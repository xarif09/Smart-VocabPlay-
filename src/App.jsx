import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { loadProgress, saveProgress, bumpStreak, starsFor, starsByWrong, STICKER_NEED, PETS, getPet, petLevel, EMPTY_PROGRESS,
  srsCorrect, srsWrong, isDue, isMastered, missionsForDate, ensureDaily, bumpDaily, EMPTY_DAILY, SHOP_ITEMS, today } from "./progress.js";
import { lexOf } from "./lexicon.js";
import { sfx, unlockSfx, setSfxEnabled } from "./sfx.js";

// ═══════════════════════════════════════════════════════
// SPEECH ENGINE — iOS-safe
// ═══════════════════════════════════════════════════════
// iOS Safari rules:
// 1. speechSynthesis.speak() MUST be called synchronously inside a user gesture
// 2. Voices may not load until after first speak attempt
// 3. cancel() + immediate speak() can drop speech — use 50ms gap

let voices = [];
let audioUnlocked = false;

function loadVoices() {
  voices = window.speechSynthesis?.getVoices() || [];
}

function getVoice(langPrefix) {
  return voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) || null;
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
  W("vehicles","CABLE CAR","รถกระเช้า","🚡"),

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
  W("jobs","JUDGE","ผู้พิพากษา","⚖️"),
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
  W("sports","GYMNASTICS","ยิมนาสติก","🤸"),
  W("sports","ARCHERY","ยิงธนู","🏹"),
  W("sports","TROPHY","ถ้วยรางวัล","🏆"),
  W("sports","MEDAL","เหรียญ","🏅"),
  W("sports","JUMP","กระโดด","🤸"),
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
    // คำที่บันทึกไว้ก่อนมี lexicon → เติมคำอ่าน/ประโยคให้ (ค่าที่ผู้ใช้แก้เองมาก่อน)
    return ok ? data.map(w => ({ ...(lexOf(w) || {}), ...w })) : INITIAL_WORDS;
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
  const [progress, setProgress] = useState(loadProgress);
  const [soundOn, setSoundOn] = useState(true);
  const [bilingual, setBilingual] = useState(true);
  const [rate, setRate] = useState(0.85);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);

  // บันทึกคำศัพท์ / ความคืบหน้า ทุกครั้งที่เปลี่ยน
  useEffect(() => { saveWords(words); }, [words]);
  useEffect(() => { saveProgress(progress); }, [progress]);
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
  const goLearn    = () => setScreen("learn");
  const goReview   = () => { setActiveCat(REVIEW_CAT); setActiveGame("quiz"); setScreen("game"); };
  const goBack     = () => {
    if (screen === "game" && activeCat?.id === "review") { goHome(); }
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
    () => !activeCat ? [] : activeCat.id === "review" ? missedWords.slice(0, 10) : words.filter(w => w.cat === activeCat.id),
    [words, activeCat, missedWords]
  );

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
            missedCount={missedWords.length} onReview={goReview} onStickers={goStickers} onShop={goShop} speak={speak} />
        )}
        {screen === "category" && activeCat && (
          <CategoryScreen cat={activeCat} words={catWords} onPickGame={goGame} onLearn={goLearn} progress={progress} showToast={showToast} />
        )}
        {screen === "learn" && activeCat && (
          <FlashCards cat={activeCat} words={catWords} speak={speak} speakAt={speakAt} setProgress={setProgress} showToast={showToast} onDone={goBack} />
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
      {showSettings && (
        <SettingsSheet
          soundOn={soundOn} setSoundOn={setSoundOn}
          bilingual={bilingual} setBilingual={setBilingual}
          rate={rate} setRate={setRate}
          onResetProgress={() => { setProgress(ensureDaily({ ...EMPTY_PROGRESS })); setShowSettings(false); showToast("เริ่มใหม่แล้ว ✓"); }}
          onReport={() => { setShowSettings(false); goReport(); }}
          onClose={() => setShowSettings(false)}
        />
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
        การ์ดคำศัพท์ · คำอ่านไทย · ประโยคตัวอย่าง<br/>เกม 14 แบบ · พูดตาม 🎤 · เก็บดาว ⭐ · เลี้ยงเพื่อนคู่หู 🐣
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
        * แตะปุ่มนี้เพื่อเปิดใช้เสียงบนมือถือ
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
function HomeScreen({ categories, words, onPickCat, progress, setProgress, stickerCount, missedCount, onReview, onStickers, onShop, speak }) {
  return (
    <div style={{ padding:"14px 10px 40px",maxWidth:480,margin:"0 auto" }}>
      <PetCard progress={progress} setProgress={setProgress} stickerCount={stickerCount} totalWords={words.length} onStickers={onStickers} onShop={onShop} speak={speak} />
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
            <input placeholder="ความหมาย TH" value={draft.meaning}
              onChange={e=>setDraft({...draft,meaning:e.target.value})}
              style={inputStyle} />
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
                    <span style={{ fontSize:28,flexShrink:0 }}>{w.emoji}</span>
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
      setProgress(next);
      if (stars >= 2) sfx.win(); else if (stars === 1) sfx.coin(); else sfx.lose();
      setResult({ score, total, stars, coins, newStickers, label: opts.label, boss: !!opts.boss, cleared, levelUp: petLevel(totalCorrect) > lvBefore });
    },
  }), [gameId, cat.id, setProgress]);

  const replay = () => { correctRef.current = []; setResult(null); setRun(r => r + 1); };
  const p = { words, speak, speakAt, showToast, onBack, cat, track, key: run };
  let game = null;
  if (gameId === "quiz")     game = <QuizGame {...p} pool={cat.id === "review" ? allWords : words} />;
  if (gameId === "listen")   game = <ListenGame {...p} />;
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
function Emoji({ e, size=72 }) { return <div style={{ textAlign:"center",fontSize:size,lineHeight:1,padding:"12px 0 6px" }}>{e}</div>; }
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
        <Emoji e={cur.emoji} />
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
        <Emoji e={cur.emoji} size={64} />
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
            <Emoji e={cur?.emoji} size={68} />
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
              style={{width:H*1.3,height:H,borderRadius:12,background:pu?"#d1fae5":"#f0fdf4",border:`2px solid ${pu?"#6ee7b7":"#86efac"}`,fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
              {p.emoji}
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
  const prompt = q.mode==="pic" ? <Emoji e={q.w.emoji} />
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
              style={{ background:bg,border:`2px solid ${bo}`,borderRadius:12,padding:"12px 6px",minHeight:56,fontWeight:800,fontSize:q.mode==="rev"?30:15,color:tc,cursor:"pointer" }}>
              {q.mode==="rev"?c.emoji:c.word}
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
function PetCard({ progress, setProgress, stickerCount, totalWords, onStickers, onShop, speak }) {
  const pet = getPet(progress);
  if (!pet) {
    return (
      <div style={{ background:"linear-gradient(135deg,#fdf2f8,#eef2ff)",borderRadius:20,padding:16,marginBottom:14,border:"2px solid #e9d5ff",textAlign:"center" }}>
        <div style={{ fontWeight:900,fontSize:16,color:"#1f2937" }}>เลือกเพื่อนคู่หูของหนู 🥚</div>
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
          <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
            <span style={{ fontWeight:900,fontSize:17,color:dark?"#fff":"#1f2937" }}>{pet.name}</span>
            <span style={{ fontSize:12,fontWeight:800,color:dark?"#c4b5fd":"#7c3aed" }}>Lv.{pet.level}</span>
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
function SettingsSheet({ soundOn, setSoundOn, bilingual, setBilingual, rate, setRate, onResetProgress, onReport, onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end",background:"rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:"22px 22px 0 0",padding:"20px 20px 36px",maxWidth:480,width:"100%",margin:"0 auto",maxHeight:"90dvh",overflowY:"auto" }}>
        <div style={{ width:38,height:4,background:"#e5e7eb",borderRadius:999,margin:"0 auto 18px" }}/>
        <h3 style={{ fontWeight:800,fontSize:17,color:"#1f2937",margin:"0 0 18px" }}>⚙️ ตั้งค่าเสียง</h3>
        <TRow label="เปิดเสียง" desc="เสียงพูด + เสียงเอฟเฟกต์ทุกเกม" on={soundOn} set={setSoundOn} />
        <TRow label="เสียงสองภาษา EN→TH" desc="อ่านอังกฤษแล้วต่อด้วยไทย" on={bilingual} set={setBilingual} />
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
            <span style={{ fontSize:84,lineHeight:1 }}>{w.emoji}</span>
            <span style={{ fontSize:34,fontWeight:900,color:"#1f2937",letterSpacing:1 }}>{w.word}</span>
            {w.read && <span style={{ fontSize:18,fontWeight:700,color:"#7c3aed" }}>{w.read}</span>}
            <span style={{ fontSize:11,color:"#9ca3af",marginTop:8 }}>แตะการ์ดเพื่อดูความหมาย</span>
          </>
        ) : (
          <>
            <span style={{ fontSize:40,lineHeight:1 }}>{w.emoji}</span>
            <span style={{ fontSize:30,fontWeight:900,color:"#1f2937" }}>{w.meaning}</span>
            {w.read && <span style={{ fontSize:14,color:"#7c3aed",fontWeight:700 }}>{w.word} · {w.read}</span>}
            {w.sen && <div style={{ marginTop:10,background:"#fff",borderRadius:14,padding:"10px 14px",width:"100%" }}>
              <div style={{ fontSize:16,fontWeight:700,color:"#1f2937" }}>{w.sen}</div>
              <div style={{ fontSize:13,color:"#6b7280",marginTop:2 }}>{w.senTh}</div>
            </div>}
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
function ListenGame({ words, speakAt, track, onBack }) {
  const qs = useMemo(() => shuffle(words).slice(0, 10), [words]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [lock, setLock] = useState(false);
  const [played, setPlayed] = useState(false);
  const cur = qs[idx];
  const choices = useMemo(() => cur ? shuffle([cur, ...shuffle(words.filter(w => w.id !== cur.id)).slice(0, 3)]) : [], [idx, cur?.id, words]);
  if (!cur || words.length < 4) return <NoWords onBack={onBack} />;
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
              style={{ background:bg,border:`2px solid ${bo}`,borderRadius:14,minHeight:84,fontSize:44,cursor:"pointer",opacity:played?1:0.5 }}>{c.emoji}</button>;
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
        const ok = alts.some(a => a === target || a.includes(target) || (target.includes(a) && a.length >= Math.max(3, target.length - 1)));
        if (ok) { setSt("ok"); if (!gotIt) { setGotIt(true); setScore(s => s + 1); track.correct(cur); } else sfx.ok(); }
        else { setSt("no"); track.wrong(cur); }
      };
      r.onerror = ev => setSt(ev?.error === "not-allowed" ? "err" : "no");
      r.onend = () => setSt(s => (s === "listening" ? "no" : s));
      r.start(); setSt("listening"); setHeard("");
    } catch (_) { setSt("err"); }
  };
  const next = () => {
    if (idx + 1 < qs.length) { setIdx(i => i + 1); setSt("idle"); setHeard(""); setGotIt(false); }
    else track.finish(score, qs.length);
  };
  const micBg = st === "listening" ? "#ef4444" : st === "ok" ? "#10b981" : "linear-gradient(135deg,#f59e0b,#ef4444)";
  return (
    <GameCard>
      <Bar left={`🎤 ${idx+1}/${qs.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <Emoji e={cur.emoji} size={60} />
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
          {st === "ok" && "เยี่ยม! ออกเสียงถูกต้อง 🎉"}
          {st === "no" && (heard ? `ได้ยินว่า "${heard}" ลองอีกครั้งนะ` : "ไม่ได้ยินเสียง ลองพูดดังๆ อีกที")}
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

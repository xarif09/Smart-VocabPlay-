import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
// APP ROOT
// ═══════════════════════════════════════════════════════
export default function App() {
  // Sound unlock — iOS must show this first
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [screen, setScreen] = useState("home");   // home|category|game|manage
  const [activeCat, setActiveCat] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [words, setWords] = useState(INITIAL_WORDS);
  const [soundOn, setSoundOn] = useState(true);
  const [bilingual, setBilingual] = useState(true);
  const [rate, setRate] = useState(0.85);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);

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

  // Navigation
  const goHome     = () => { setScreen("home"); setActiveCat(null); setActiveGame(null); };
  const goCat      = cat => { setActiveCat(cat); setScreen("category"); };
  const goGame     = gid => { setActiveGame(gid); setScreen("game"); };
  const goManage   = () => setScreen("manage");
  const goBack     = () => {
    if (screen === "game")     { setScreen("category"); setActiveGame(null); }
    else if (screen === "category") { goHome(); }
    else                       { goHome(); }
  };

  const catWords = useMemo(
    () => activeCat ? words.filter(w => w.cat === activeCat.id) : [],
    [words, activeCat]
  );

  // ── Sound unlock screen ──────────────────
  if (!soundUnlocked) {
    return (
      <SoundUnlockScreen onUnlock={() => {
        // CRITICAL: call unlockAudio() synchronously inside the button's onClick
        unlockAudio();
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
        wordCount={words.length}
      />

      {/* CONTENT — padded below topbar */}
      <div style={{ paddingTop: 54 }}>
        {screen === "home" && (
          <HomeScreen categories={CATEGORIES} words={words} onPickCat={goCat} />
        )}
        {screen === "category" && activeCat && (
          <CategoryScreen cat={activeCat} words={catWords} onPickGame={goGame} speak={speak} />
        )}
        {screen === "game" && activeCat && activeGame && (
          <GameRouter
            gameId={activeGame} cat={activeCat}
            words={catWords} speak={speak}
            showToast={showToast} onBack={goBack}
          />
        )}
        {screen === "manage" && (
          <ManageScreen
            words={words} setWords={setWords}
            categories={CATEGORIES}
            showToast={showToast} speak={speak}
          />
        )}
      </div>

      {/* SETTINGS */}
      {showSettings && (
        <SettingsSheet
          soundOn={soundOn} setSoundOn={setSoundOn}
          bilingual={bilingual} setBilingual={setBilingual}
          rate={rate} setRate={setRate}
          speak={speak}
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
        เรียนคำศัพท์ภาษาอังกฤษ<br/>ผ่านเกมสนุกๆ 10 รูปแบบ
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
function Topbar({ screen, catLabel, onBack, onHome, soundOn, onToggleSound, onSettings, onManage, wordCount }) {
  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, height:54, zIndex:100,
      background:"rgba(255,255,255,0.96)", backdropFilter:"blur(8px)",
      borderBottom:"1px solid #e5e7eb",
      display:"flex", alignItems:"center", gap:8, padding:"0 10px",
    }}>
      {/* Left */}
      {onBack
        ? <Btn onClick={onBack} style={{ fontSize:22, width:36, height:36, borderRadius:18, background:"#f3f4f6" }}>‹</Btn>
        : <button onClick={onHome} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", padding:0 }}>
            <div style={{ width:30,height:30,borderRadius:10,background:"linear-gradient(135deg,#F43F5E,#F97316)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📚</div>
            <span style={{ fontWeight:800, fontSize:14, color:"#1f2937" }}>VocabPlay</span>
          </button>
      }

      {/* Centre */}
      <div style={{ flex:1, overflow:"hidden" }}>
        {catLabel && <span style={{ fontWeight:700,fontSize:13,color:"#374151",display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{catLabel}</span>}
        {screen==="home" && <span style={{ fontSize:11,color:"#9ca3af" }}>{wordCount} คำ · {CATEGORIES.length} หมวด</span>}
        {screen==="manage" && <span style={{ fontWeight:700,fontSize:13,color:"#374151" }}>จัดการคำศัพท์</span>}
      </div>

      {/* Right */}
      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
        <Btn onClick={onToggleSound} style={IB}>{soundOn?"🔊":"🔇"}</Btn>
        <Btn onClick={onSettings} style={IB}>⚙️</Btn>
        {screen==="home"
          ? <Btn onClick={onManage} style={{ ...IB, background:"#1f2937", fontSize:12, color:"#fff", fontWeight:700, borderRadius:10, padding:"0 10px", width:"auto" }}>✏️ จัดการ</Btn>
          : null
        }
      </div>
    </div>
  );
}
const IB = { width:36,height:36,borderRadius:18,background:"#f3f4f6",fontSize:18 };
const Btn = ({ onClick, children, style={} }) => (
  <button onClick={onClick} style={{ border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",...style }}>
    {children}
  </button>
);

// ═══════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════
function HomeScreen({ categories, words, onPickCat }) {
  return (
    <div style={{ padding:"14px 10px 40px" }}>
      <p style={{ textAlign:"center",margin:"0 0 14px",fontSize:13,color:"#6b7280" }}>แตะหมวดที่อยากเรียน 👇</p>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxWidth:480,margin:"0 auto" }}>
        {categories.map((cat,i) => {
          const n = words.filter(w=>w.cat===cat.id).length;
          return (
            <button key={cat.id} onClick={()=>onPickCat(cat)}
              style={{
                background:"#fff", borderRadius:18, padding:"14px 10px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.07)",
                border:`2px solid ${cat.color}30`,
                display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                cursor:"pointer", opacity:n===0?0.5:1,
                animationDelay:`${i*25}ms`,
              }}>
              <div style={{ width:50,height:50,borderRadius:15,background:`${cat.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>{cat.emoji}</div>
              <span style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{cat.label}</span>
              <span style={{ fontSize:11,color:"#6b7280" }}>{cat.thai}</span>
              <span style={{ fontSize:11,fontWeight:700,color:cat.color,background:`${cat.color}18`,padding:"2px 10px",borderRadius:999 }}>{n} คำ</span>
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
function CategoryScreen({ cat, words, onPickGame, speak }) {
  return (
    <div style={{ padding:"14px 12px 40px",maxWidth:480,margin:"0 auto" }}>
      <div style={{ background:`${cat.color}15`,borderRadius:18,padding:14,display:"flex",alignItems:"center",gap:12,marginBottom:18,border:`2px solid ${cat.color}30` }}>
        <div style={{ width:52,height:52,borderRadius:14,background:`${cat.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0 }}>{cat.emoji}</div>
        <div>
          <div style={{ fontWeight:800,fontSize:17,color:"#1f2937" }}>{cat.thai}</div>
          <div style={{ fontSize:12,color:"#6b7280" }}>{words.length} คำ</div>
        </div>
      </div>

      <p style={{ fontWeight:700,fontSize:11,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,margin:"0 0 10px" }}>เลือกเกม</p>
      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {cat.games.map((gid,i)=>{
          const g=GAME_META[gid]; if(!g) return null;
          return (
            <button key={gid} onClick={()=>onPickGame(gid)}
              style={{ background:"#fff",borderRadius:14,padding:"13px 14px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",display:"flex",alignItems:"center",gap:12,border:"1px solid #f3f4f6",cursor:"pointer",textAlign:"left" }}>
              <span style={{ fontSize:26,width:36,textAlign:"center",flexShrink:0 }}>{g.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{g.label}</div>
                <div style={{ fontSize:11,color:"#6b7280",marginTop:1 }}>{g.thai}</div>
              </div>
              <span style={{ color:"#d1d5db",fontSize:20,flexShrink:0 }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WORD MANAGEMENT SCREEN
// ═══════════════════════════════════════════════════════
function ManageScreen({ words, setWords, categories, showToast, speak }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ word:"", meaning:"", emoji:"📦", cat: categories[0]?.id });

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
    setDraft({ word:"",meaning:"",emoji:"📦",cat:categories[0]?.id });
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
          style={{ background:"#EF4444",color:"#fff",borderRadius:12,padding:"8px 16px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>
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
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={saveNew} style={{ flex:1,background:"#EF4444",color:"#fff",borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>บันทึก</button>
            <button onClick={()=>setShowAdd(false)} style={{ flex:1,background:"#f3f4f6",color:"#374151",borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>ยกเลิก</button>
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
                      <div style={{ fontWeight:800,fontSize:14,color:"#1f2937" }}>{w.word}</div>
                      <div style={{ fontSize:12,color:"#6b7280",display:"flex",alignItems:"center",gap:6 }}>
                        <span>{w.meaning}</span>
                        <span style={{ background:`${cat?.color||"#999"}20`,color:cat?.color||"#666",padding:"1px 6px",borderRadius:6,fontSize:10,fontWeight:600 }}>{cat?.emoji} {cat?.label}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                      <Btn onClick={()=>speak(w.word,w.meaning)} style={{ width:32,height:32,borderRadius:10,background:"#ede9fe",fontSize:16 }}>🔊</Btn>
                      <Btn onClick={()=>setEditingId(w.id)} style={{ width:32,height:32,borderRadius:10,background:"#fef3c7",fontSize:16 }}>✏️</Btn>
                      <Btn onClick={()=>{if(window.confirm(`ลบ "${w.word}"?`))deleteWord(w.id);}} style={{ width:32,height:32,borderRadius:10,background:"#fee2e2",fontSize:16 }}>🗑️</Btn>
                    </div>
                  </div>
              }
            </div>
          );
        })}
        {filtered.length===0 && <div style={{ textAlign:"center",padding:"40px 0",color:"#9ca3af",fontSize:14 }}>ไม่พบคำที่ค้นหา</div>}
      </div>
    </div>
  );
}

const inputStyle = { border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 10px",fontSize:13,fontFamily:"inherit",width:"100%",outline:"none",background:"#f9fafb" };

function EditWordRow({ word, categories, onSave, onCancel }) {
  const [d, setD] = useState({ word:word.word, meaning:word.meaning, emoji:word.emoji, cat:word.cat });
  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6 }}>
        <input value={d.word} onChange={e=>setD({...d,word:e.target.value.toUpperCase()})} style={inputStyle} placeholder="คำ EN" />
        <input value={d.meaning} onChange={e=>setD({...d,meaning:e.target.value})} style={inputStyle} placeholder="ความหมาย" />
        <input value={d.emoji} maxLength={4} onChange={e=>setD({...d,emoji:e.target.value})} style={{ ...inputStyle,textAlign:"center",fontSize:20 }} />
        <select value={d.cat} onChange={e=>setD({...d,cat:e.target.value})} style={inputStyle}>
          {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
      </div>
      <div style={{ display:"flex",gap:6 }}>
        <button onClick={()=>onSave(d)} style={{ flex:1,background:"#10b981",color:"#fff",borderRadius:10,padding:"8px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer" }}>บันทึก ✓</button>
        <button onClick={onCancel} style={{ flex:1,background:"#f3f4f6",color:"#374151",borderRadius:10,padding:"8px",fontWeight:700,fontSize:12,border:"none",cursor:"pointer" }}>ยกเลิก</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GAME ROUTER
// ═══════════════════════════════════════════════════════
function GameRouter({ gameId, cat, words, speak, showToast, onBack }) {
  const p = { words, speak, showToast, onBack, cat };
  if (gameId==="quiz")     return <QuizGame {...p} />;
  if (gameId==="spell")    return <SpellGame {...p} />;
  if (gameId==="memory")   return <MemoryGame {...p} />;
  if (gameId==="speed")    return <SpeedGame {...p} />;
  if (gameId==="habitat")  return <HabitatGame {...p} />;
  if (gameId==="match")    return <MatchGame {...p} />;
  if (gameId==="colormix") return <ColorMixGame {...p} />;
  if (gameId==="count")    return <CountGame {...p} />;
  if (gameId==="bodydr")   return <BodyDoctorGame {...p} />;
  if (gameId==="dress")    return <DressGame {...p} />;
  return null;
}

// ═══════════════════════════════════════════════════════
// SHARED GAME UI
// ═══════════════════════════════════════════════════════
const GS = { // game styles
  wrap: { padding:"10px",maxWidth:440,margin:"0 auto" },
  card: { background:"#fff",borderRadius:18,boxShadow:"0 2px 14px rgba(0,0,0,0.08)",overflow:"hidden",border:"1px solid #f3f4f6" },
  bar: { display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",background:"#f9fafb",borderBottom:"1px solid #f3f4f6",fontSize:13,fontWeight:700,color:"#374151" },
  body: { padding:"12px 14px" },
  soundBtn: { display:"flex",alignItems:"center",gap:5,margin:"0 auto 10px",background:"#f3f4f6",borderRadius:999,padding:"6px 14px",fontWeight:700,fontSize:12,color:"#374151",border:"none",cursor:"pointer" },
  winBox: { margin:"12px 14px",background:"#d1fae5",borderRadius:14,padding:14,textAlign:"center",border:"2px solid #6ee7b7" },
};

function GameCard({ children }) { return <div style={GS.wrap}><div style={GS.card}>{children}</div></div>; }
function Bar({ left, right }) { return <div style={GS.bar}><span>{left}</span><span>{right}</span></div>; }
function Emoji({ e, size=72 }) { return <div style={{ textAlign:"center",fontSize:size,lineHeight:1,padding:"12px 0 6px" }}>{e}</div>; }
function SndBtn({ onClick }) { return <button onClick={onClick} style={GS.soundBtn}>🔊 ฟัง EN+TH</button>; }
function WinBox({ children }) { return <div style={GS.winBox} >{children}</div>; }
function Pill({ onClick, disabled, bg="#6366f1", children }) {
  return <button onClick={onClick} disabled={disabled} style={{ background:disabled?"#e5e7eb":bg,color:disabled?"#9ca3af":"#fff",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13,border:"none",cursor:disabled?"not-allowed":"pointer" }}>{children}</button>;
}

// ═══════════════════════════════════════════════════════
// QUIZ
// ═══════════════════════════════════════════════════════
function QuizGame({ words, speak, showToast, onBack }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [lock, setLock] = useState(false);
  const cur = words[idx];
  const choices = useMemo(() => {
    if(!cur) return [];
    return shuffle([cur,...shuffle(words.filter(w=>w.id!==cur.id)).slice(0,3)]);
  }, [idx, cur?.id, words]);

  if(!cur) return <NoWords onBack={onBack} />;
  const pick = c => {
    if(lock) return;
    setLock(true); setPicked(c.id);
    if(c.id===cur.id){ setScore(s=>s+1); speak(cur.word,cur.meaning); }
    setTimeout(()=>{
      if(idx+1<words.length){ setIdx(i=>i+1); setPicked(null); setLock(false); }
      else{ showToast(`🏆 ${c.id===cur.id?score+1:score}/${words.length}`); setTimeout(onBack,1400); }
    },950);
  };
  return (
    <GameCard>
      <Bar left={`${idx+1}/${words.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <Emoji e={cur.emoji} />
        <SndBtn onClick={()=>speak(cur.word,cur.meaning)} />
        <p style={{ textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 10px" }}>เลือกคำที่ตรงกับรูป</p>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {choices.map(c=>{
            const ic=c.id===cur.id,ip=picked===c.id,sr=lock&&(ic||ip);
            let bg="#fffbeb",bo="#fbbf24",tc="#92400e";
            if(sr&&ic){bg="#d1fae5";bo="#6ee7b7";tc="#065f46";}
            if(sr&&ip&&!ic){bg="#fee2e2";bo="#fca5a5";tc="#991b1b";}
            if(lock&&!ip&&!ic){bg="#f9fafb";bo="#e5e7eb";tc="#9ca3af";}
            return <button key={c.id} onClick={()=>pick(c)} disabled={lock}
              style={{ background:bg,border:`2px solid ${bo}`,borderRadius:12,padding:"14px 6px",fontWeight:800,fontSize:15,color:tc,cursor:"pointer" }}>
              {c.word}
            </button>;
          })}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// SPELL
// ═══════════════════════════════════════════════════════
function SpellGame({ words, speak, showToast, onBack }) {
  const [idx, setIdx] = useState(0);
  const [pool, setPool] = useState([]);
  const [picked, setPicked] = useState([]);
  const [score, setScore] = useState(0);
  const cur = words[idx];

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
  const ts=cur.word.length<=4?48:cur.word.length<=6?40:34;
  const tf=cur.word.length<=4?20:cur.word.length<=6?16:13;

  const tapLetter=l=>{
    if(correct||wrong) return;
    setPicked([...picked,l]); setPool(pool.filter(x=>x.id!==l.id));
  };
  const removePick=i=>{
    if(correct) return;
    const r=picked[i]; setPicked(picked.filter((_,j)=>j!==i)); setPool([...pool,r]);
  };

  return (
    <GameCard>
      <Bar left={`${idx+1}/${words.length}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <Emoji e={cur.emoji} size={64} />
        <p style={{ textAlign:"center",fontWeight:600,fontSize:14,color:"#374151",margin:"0 0 8px" }}>{cur.meaning}</p>
        <SndBtn onClick={()=>speak(cur.word,cur.meaning)} />

        {/* Answer zone */}
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

        {/* Letter pool */}
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
          <Pill onClick={()=>{ if(correct)setScore(s=>s+1); if(idx+1<words.length)setIdx(i=>i+1); else{showToast(`ได้ ${correct?score+1:score}/${words.length} ⭐`);setTimeout(onBack,1400);} }} disabled={!correct} bg="#8b5cf6">ถัดไป ›</Pill>
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// MEMORY
// ═══════════════════════════════════════════════════════
function MemoryGame({ words, speak, onBack }) {
  const PAIRS=Math.min(6,words.length);
  const mk=useCallback(()=>{
    const ch=shuffle(words).slice(0,PAIRS);
    return shuffle([
      ...ch.map((w,i)=>({uid:`w${i}`,type:"word",label:w.word,mid:i,ref:w})),
      ...ch.map((w,i)=>({uid:`e${i}`,type:"emoji",label:w.emoji,mid:i,ref:w})),
    ]);
  },[words]);
  const [cards,setCards]=useState(mk);
  const [open,setOpen]=useState([]);
  const [matched,setMatched]=useState([]);
  const [moves,setMoves]=useState(0);
  const [lock,setLock]=useState(false);
  const won=matched.length===PAIRS&&PAIRS>0;

  if(!words.length) return <NoWords onBack={onBack} />;

  const flip=c=>{
    if(lock||matched.includes(c.mid)||open.find(x=>x.uid===c.uid)) return;
    const nf=[...open,c]; setOpen(nf);
    if(nf.length===2){
      setMoves(m=>m+1); setLock(true);
      const[a,b]=nf;
      if(a.mid===b.mid&&a.type!==b.type){
        speak(a.ref.word,a.ref.meaning);
        setTimeout(()=>{ setMatched(m=>[...m,a.mid]); setOpen([]); setLock(false); },600);
      } else { setTimeout(()=>{ setOpen([]); setLock(false); },900); }
    }
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
        {won&&<WinBox>
          <div style={{fontSize:28}}>🏆</div>
          <div style={{fontWeight:800,color:"#065f46",margin:"4px 0"}}>ครบใน {moves} ครั้ง!</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
            <Pill onClick={()=>{setCards(mk());setOpen([]);setMatched([]);setMoves(0);setLock(false);}} bg="#10b981">เล่นอีก</Pill>
            <Pill onClick={onBack} bg="#6b7280">เมนู</Pill>
          </div>
        </WinBox>}
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// SPEED
// ═══════════════════════════════════════════════════════
function SpeedGame({ words, speak, showToast, onBack }) {
  const T=30;
  const [time,setTime]=useState(T);
  const [active,setActive]=useState(false);
  const [score,setScore]=useState(0);
  const [cur,setCur]=useState(null);
  const [opts,setOpts]=useState([]);
  const ref=useRef(null);

  const next=useCallback(()=>{
    const w=words[Math.floor(Math.random()*words.length)];
    setCur(w); setOpts(shuffle([w,...shuffle(words.filter(x=>x.id!==w.id)).slice(0,3)]));
    speak(w.word,w.meaning);
  },[words,speak]);

  useEffect(()=>{
    if(!active) return;
    ref.current=setInterval(()=>setTime(t=>{ if(t<=1){clearInterval(ref.current);setActive(false);showToast(`⏱ ${score} คะแนน`);return 0;} return t-1; }),1000);
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
            <p style={{color:"#6b7280",fontSize:13,margin:"0 0 20px"}}>ฟัง→แตะคำให้เร็วใน {T} วิ!</p>
            <Pill onClick={()=>{setTime(T);setScore(0);setActive(true);next();}} bg="#f59e0b">▶ เริ่ม!</Pill>
          </div>
          :<div>
            <Emoji e={cur?.emoji} size={68} />
            <SndBtn onClick={()=>cur&&speak(cur.word,cur.meaning)} />
            <div style={{height:7,background:"#f3f4f6",borderRadius:999,margin:"0 0 10px",overflow:"hidden"}}>
              <div style={{height:"100%",background:time>10?"#f59e0b":"#ef4444",width:`${(time/T)*100}%`,transition:"width 1s linear",borderRadius:999}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {opts.map(o=>(
                <button key={o.id} onClick={()=>{ if(o.id===cur.id){setScore(s=>s+1);next();}else showToast("❌","err"); }}
                  style={{background:"#fffbeb",border:"2px solid #fbbf24",borderRadius:12,padding:"13px 6px",fontWeight:800,fontSize:15,color:"#92400e",cursor:"pointer"}}>
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
function HabitatGame({ words, speak, showToast, onBack }) {
  const ZN=[
    {id:"farm",label:"ฟาร์ม",e:"🚜",bg:"#fef3c7",bo:"#fcd34d"},
    {id:"forest",label:"ป่า",e:"🌳",bg:"#dcfce7",bo:"#86efac"},
    {id:"ocean",label:"ทะเล",e:"🌊",bg:"#e0f2fe",bo:"#7dd3fc"},
  ];
  const base=useMemo(()=>shuffle(words.filter(w=>w.habitat)).slice(0,9),[words]);
  const [pool,setPool]=useState(base);
  const [placed,setPlaced]=useState({farm:[],forest:[],ocean:[]});
  const [sel,setSel]=useState(null);
  const done=pool.length===0&&base.length>0;

  return (
    <GameCard>
      <Bar left="Habitat Hunt ⭐" right={`${base.length-pool.length}/${base.length}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 8px"}}>แตะสัตว์ → แตะที่อยู่ของมัน</p>
        <div style={{background:"#f9fafb",borderRadius:12,padding:8,display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center",minHeight:70,marginBottom:10}}>
          {pool.length===0?<span style={{color:"#10b981",fontWeight:700,alignSelf:"center"}}>✅ ครบทุกตัว!</span>
            :pool.map(a=>(
              <button key={a.id} onClick={()=>{setSel(a);speak(a.word,a.meaning);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:sel?.id===a.id?"#ede9fe":"#fff",border:`2px solid ${sel?.id===a.id?"#8b5cf6":"#e5e7eb"}`,borderRadius:10,padding:"6px 8px",cursor:"pointer"}}>
                <span style={{fontSize:26}}>{a.emoji}</span>
                <span style={{fontSize:9,fontWeight:700,color:"#374151"}}>{a.word}</span>
              </button>
            ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
          {ZN.map(z=>(
            <button key={z.id} onClick={()=>{
              if(!sel) return;
              if(sel.habitat===z.id){setPlaced(p=>({...p,[z.id]:[...p[z.id],sel]}));setPool(p=>p.filter(x=>x.id!==sel.id));speak(sel.word,sel.meaning);setSel(null);}
              else{showToast("ลองอีก 🐾","warn");setSel(null);}
            }} style={{background:z.bg,border:`2px solid ${z.bo}`,borderRadius:12,padding:"8px 4px",minHeight:100,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
              <span style={{fontSize:22}}>{z.e}</span>
              <span style={{fontSize:10,fontWeight:700,color:"#374151"}}>{z.label}</span>
              <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:2,marginTop:3}}>
                {placed[z.id].map(a=><span key={a.id} style={{fontSize:18}}>{a.emoji}</span>)}
              </div>
            </button>
          ))}
        </div>
        {done&&<WinBox><div style={{fontSize:26}}>🏆</div><div style={{fontWeight:800,color:"#065f46"}}>ทุกตัวกลับบ้านแล้ว!</div><div style={{marginTop:8}}><Pill onClick={onBack} bg="#10b981">กลับเมนู</Pill></div></WinBox>}
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// MATCH (Picture Match)
// ═══════════════════════════════════════════════════════
function MatchGame({ words, speak, showToast, onBack }) {
  const RS=4;
  const [round,setRound]=useState(0);
  const total=Math.max(1,Math.ceil(words.length/RS));
  const rw=useMemo(()=>words.slice(round*RS,round*RS+RS),[round,words]);
  const [pics,setPics]=useState([]);
  const [sel,setSel]=useState(null);
  const [matches,setMatches]=useState({});
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
            <button onClick={()=>{if(!im){setSel(w.id);speak(w.word,w.meaning);}}} disabled={im}
              style={{flex:1,height:H,borderRadius:12,background:im?"#d1fae5":is?"#4f46e5":"#eff6ff",border:`2px solid ${im?"#6ee7b7":is?"#4f46e5":"#bfdbfe"}`,fontWeight:800,fontSize:14,color:im?"#065f46":is?"#fff":"#1e40af",cursor:"pointer"}}>
              {w.word}
            </button>
            <span style={{color:"#d1d5db",fontSize:18,flexShrink:0}}>→</span>
            {p&&<button onClick={()=>{
              if(sel==null||pu) return;
              if(sel===p.id){setMatches(m=>({...m,[sel]:p.id}));speak(p.word,p.meaning);}
              else showToast("ลองอีก 💡","warn");
              setSel(null);
            }} disabled={pu}
              style={{width:H*1.3,height:H,borderRadius:12,background:pu?"#d1fae5":"#f0fdf4",border:`2px solid ${pu?"#6ee7b7":"#86efac"}`,fontSize:28,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
              {p.emoji}
            </button>}
          </div>;
        })}
        {done&&<WinBox><div style={{fontSize:26}}>🎊</div><div style={{fontWeight:800,color:"#065f46"}}>เก่งมาก!</div><div style={{marginTop:8}}>{round+1<total?<Pill onClick={()=>setRound(r=>r+1)} bg="#10b981">รอบถัดไป →</Pill>:<Pill onClick={onBack} bg="#10b981">จบ ✓</Pill>}</div></WinBox>}
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// COLOR MIX
// ═══════════════════════════════════════════════════════
function ColorMixGame({ words, speak, showToast, onBack }) {
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
      <Bar left={`รอบ${round}`} right={`⭐${score}`} />
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
                setTimeout(()=>{ if(r===g){setScore(s=>s+1);showToast(`✨ ${tg}=${REC[tg].th}`);setTimeout(()=>setRound(rd=>rd+1),700);}else{showToast("ลองอีก 🎨","warn");setTimeout(()=>setPicked([]),500);} },400);
              }
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
// COUNT
// ═══════════════════════════════════════════════════════
function CountGame({ words, speak, showToast, onBack }) {
  const SH=["🍎","⭐","🐱","🎈","🌸","🚗","🍊","🐶"];
  const [round,setRound]=useState(1);
  const [target,setT]=useState(1);
  const [shape,setShape]=useState("🍎");
  const [score,setScore]=useState(0);
  const nw=words.filter(w=>w.num!==undefined&&w.num>=1&&w.num<=8);
  const maxN=Math.min(8,Math.max(...nw.map(w=>w.num),4));
  useEffect(()=>{const t=Math.floor(Math.random()*maxN)+1;setT(t);setShape(SH[Math.floor(Math.random()*SH.length)]);speak("How many?","นับสิ");},[round]);
  return (
    <GameCard>
      <Bar left={`รอบ${round}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 8px"}}>นับแล้วเลือกตัวเลข</p>
        <div style={{background:"#f0fdf4",borderRadius:12,padding:"12px",display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",minHeight:110,marginBottom:10}}>
          {Array.from({length:target}).map((_,i)=><span key={i} style={{fontSize:32}}>{shape}</span>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
          {nw.sort((a,b)=>a.num-b.num).slice(0,8).map(w=>(
            <button key={w.id} onClick={()=>{if(w.num===target){setScore(s=>s+1);speak(w.word,w.meaning);setTimeout(()=>setRound(r=>r+1),600);}else showToast("ลองอีก","warn");}}
              style={{background:"#fff",border:"2px solid #6ee7b7",borderRadius:11,padding:"9px 3px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
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
// BODY DOCTOR
// ═══════════════════════════════════════════════════════
function BodyDoctorGame({ words, speak, showToast, onBack }) {
  const [round,setRound]=useState(1);
  const [target,setTarget]=useState(null);
  const [score,setScore]=useState(0);
  const [fb,setFb]=useState(null);
  useEffect(()=>{const t=words[Math.floor(Math.random()*words.length)];setTarget(t);setFb(null);if(t)speak(`Touch the ${t.word}`,`แตะที่ ${t.meaning}`);},[round]);
  return (
    <GameCard>
      <Bar left={`รอบ${round}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <div style={{textAlign:"center",marginBottom:10}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#fce7f3",borderRadius:999,padding:"6px 14px",marginBottom:4}}>
            <span>🔊</span><span style={{fontWeight:800,fontSize:14,color:"#9d174d"}}>Touch the {target?.word}!</span>
          </div>
          <br/>
          <button onClick={()=>target&&speak(`Touch the ${target.word}`,`แตะที่ ${target.meaning}`)} style={{fontSize:11,color:"#be185d",fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>🔊 ฟังอีกครั้ง</button>
        </div>
        <div style={{fontSize:46,textAlign:"center",marginBottom:10}}>🧒</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
          {words.slice(0,9).map(w=>(
            <button key={w.id} onClick={()=>{
              if(!target||fb) return;
              if(w.id===target.id){setScore(s=>s+1);setFb("ok");speak(w.word,w.meaning);setTimeout(()=>setRound(r=>r+1),800);}
              else{setFb("no");showToast("ลองอีก 🩺","warn");setTimeout(()=>setFb(null),500);}
            }} style={{background:fb==="ok"&&w.id===target?.id?"#d1fae5":"#fdf2f8",border:`2px solid ${fb==="ok"&&w.id===target?.id?"#6ee7b7":"#fbcfe8"}`,borderRadius:12,padding:"9px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",opacity:fb==="no"&&w.id!==target?.id?0.5:1}}>
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
// DRESS UP
// ═══════════════════════════════════════════════════════
function DressGame({ words, speak, showToast, onBack }) {
  const ALL=["☂️","🧥","🧣","🧤","👕","🩳","🕶️","🥾","👖","🧢"];
  const [round,setRound]=useState(1);
  const [target,setTarget]=useState(null);
  const [opts,setOpts]=useState([]);
  const [score,setScore]=useState(0);
  const [picked,setPicked]=useState(null);
  useEffect(()=>{
    const t=words[Math.floor(Math.random()*words.length)];setTarget(t);setPicked(null);
    if(t){const c=(t.wear||[]).slice(0,2);const w=ALL.filter(x=>!c.includes(x));setOpts(shuffle([...c.map(e=>({e,ok:true})),...shuffle(w).slice(0,2).map(e=>({e,ok:false}))]));speak(`It's ${t.word}!`,`อากาศ ${t.meaning}`);}
  },[round]);
  return (
    <GameCard>
      <Bar left={`รอบ${round}`} right={`⭐${score}`} />
      <div style={GS.body}>
        <p style={{textAlign:"center",fontSize:12,color:"#6b7280",margin:"0 0 10px"}}>เลือกเสื้อผ้าให้เหมาะกับอากาศ</p>
        <div style={{background:"#ecfeff",borderRadius:12,padding:"14px",textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:54}}>{target?.emoji}</div>
          <div style={{fontWeight:800,fontSize:17,color:"#1f2937"}}>{target?.word}</div>
          <div style={{fontSize:12,color:"#6b7280"}}>{target?.meaning}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
          {opts.map((o,i)=>(
            <button key={i} onClick={()=>{if(picked)return;setPicked(o.e);if(o.ok){setScore(s=>s+1);showToast("👏 เก่ง!");setTimeout(()=>setRound(r=>r+1),800);}else{showToast("ลองอีก 🧥","warn");setTimeout(()=>setPicked(null),500);}}} disabled={!!picked}
              style={{aspectRatio:"1",borderRadius:12,fontSize:30,display:"flex",alignItems:"center",justifyContent:"center",background:picked===o.e&&o.ok?"#d1fae5":picked===o.e&&!o.ok?"#fee2e2":"#ecfeff",border:`2px solid ${picked===o.e&&o.ok?"#6ee7b7":picked===o.e&&!o.ok?"#fca5a5":"#a5f3fc"}`,cursor:"pointer"}}>
              {o.e}
            </button>
          ))}
        </div>
      </div>
    </GameCard>
  );
}

// ═══════════════════════════════════════════════════════
// SETTINGS SHEET
// ═══════════════════════════════════════════════════════
function SettingsSheet({ soundOn, setSoundOn, bilingual, setBilingual, rate, setRate, speak, onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end",background:"rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:"22px 22px 0 0",padding:"20px 20px 36px",maxWidth:480,width:"100%",margin:"0 auto" }}>
        <div style={{ width:38,height:4,background:"#e5e7eb",borderRadius:999,margin:"0 auto 18px" }}/>
        <h3 style={{ fontWeight:800,fontSize:17,color:"#1f2937",margin:"0 0 18px" }}>⚙️ ตั้งค่าเสียง</h3>
        <TRow label="เปิดเสียง" desc="ทุกเกมและทุกปุ่ม" on={soundOn} set={setSoundOn} />
        <TRow label="เสียงสองภาษา EN→TH" desc="อ่านอังกฤษแล้วต่อด้วยไทย" on={bilingual} set={setBilingual} />
        <div style={{ background:"#f9fafb",borderRadius:14,padding:"12px 14px",marginBottom:10 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
            <div style={{ fontWeight:700,fontSize:14,color:"#1f2937" }}>ความเร็วเสียง</div>
            <span style={{ fontWeight:800,color:"#ef4444",fontSize:15 }}>{rate.toFixed(2)}x</span>
          </div>
          <input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={e=>setRate(+e.target.value)} style={{ width:"100%" }} />
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"#9ca3af",marginTop:3 }}>
            <span>🐢 ช้า</span><span>ปกติ</span><span>เร็ว 🐇</span>
          </div>
        </div>
        <button onClick={()=>speakWord("Hello! How are you?","สวัสดี เป็นอย่างไรบ้าง",rate,bilingual)}
          style={{ width:"100%",padding:"12px",borderRadius:12,background:"#ef4444",color:"#fff",fontWeight:800,fontSize:15,border:"none",cursor:"pointer",marginBottom:10 }}>
          🔊 ทดสอบเสียง EN+TH
        </button>
        <button onClick={onClose} style={{ width:"100%",padding:"11px",borderRadius:12,background:"#f3f4f6",color:"#374151",fontWeight:700,fontSize:14,border:"none",cursor:"pointer" }}>
          ✓ เสร็จสิ้น
        </button>
      </div>
    </div>
  );
}

function TRow({ label, desc, on, set }) {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",background:"#f9fafb",borderRadius:12,marginBottom:9 }}>
      <div>
        <div style={{ fontWeight:700,fontSize:14,color:"#1f2937" }}>{label}</div>
        <div style={{ fontSize:11,color:"#6b7280" }}>{desc}</div>
      </div>
      <button onClick={()=>set(!on)} style={{ width:48,height:28,borderRadius:999,background:on?"#10b981":"#d1d5db",border:"none",cursor:"pointer",position:"relative",flexShrink:0 }}>
        <div style={{ position:"absolute",top:3,width:22,height:22,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.15)",left:on?23:3,transition:"left 0.2s" }}/>
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
      <p style={{ color:"#6b7280",fontWeight:600,fontSize:14 }}>ยังไม่มีคำในหมวดนี้</p>
      <button onClick={onBack} style={{ marginTop:14,background:"#6366f1",color:"#fff",borderRadius:12,padding:"10px 22px",fontWeight:700,fontSize:13,border:"none",cursor:"pointer" }}>กลับ</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// IMAGES — รูปจริงประกอบคำศัพท์ ดึงจากรูปหลักของบทความ Wikipedia (REST summary API, CORS เปิด)
// key = "หมวด|คำ" → ชื่อบทความ Wikipedia ที่สื่อถึงคำนั้นตรงที่สุด · ไม่มีในนี้ = ใช้อีโมจิ
// (สี ตัวเลข ความรู้สึก ครอบครัว รูปทรง ใช้อีโมจิ เพราะสื่อชัดกว่ารูปถ่าย)
// รูปโหลดครั้งแรกจะถูก service worker แคชไว้ → เล่นออฟไลน์ก็ยังเห็น
// ═══════════════════════════════════════════════════════
import manifest from "./imgManifest.json";
const T = {};
const add = (cat, rows) => rows.forEach(([w, title]) => { T[`${cat}|${w}`] = title; });

add("animals", [
  ["CAT","Cat"],["DOG","Dog"],["FISH","Goldfish"],["BIRD","Bird"],["COW","Cattle"],["PIG","Pig"],["FROG","Frog"],["DUCK","Duck"],
  ["LION","Lion"],["BEAR","Brown bear"],["RABBIT","Rabbit"],["HORSE","Horse"],["SHEEP","Sheep"],["MONKEY","Monkey"],["ELEPHANT","Asian elephant"],
  ["TIGER","Tiger"],["PANDA","Giant panda"],["DOLPHIN","Dolphin"],["SHARK","Great white shark"],["WHALE","Humpback whale"],["OCTOPUS","Octopus"],
  ["CRAB","Crab"],["OWL","Owl"],["SNAKE","Snake"],["TURTLE","Turtle"],["BUTTERFLY","Butterfly"],["BEE","Honey bee"],["MOUSE","House mouse"],
  ["PENGUIN","Emperor penguin"],["FOX","Red fox"],["GIRAFFE","Giraffe"],["ZEBRA","Zebra"],["CHICKEN","Chicken"],["GOAT","Goat"],["DEER","Deer"],
  ["CROCODILE","Crocodile"],["KANGAROO","Kangaroo"],["ANT","Ant"],["SPIDER","Spider"],
]);
add("fruits", [
  ["APPLE","Apple"],["BANANA","Banana"],["ORANGE","Orange (fruit)"],["GRAPE","Grape"],["LEMON","Lemon"],["MANGO","Mango"],["CHERRY","Cherry"],
  ["PEACH","Peach"],["STRAWBERRY","Strawberry"],["WATERMELON","Watermelon"],["PINEAPPLE","Pineapple"],["KIWI","Kiwifruit"],["BLUEBERRY","Blueberry"],
  ["COCONUT","Coconut"],["PEAR","Pear"],["MELON","Cantaloupe"],["AVOCADO","Avocado"],["GUAVA","Guava"],["PAPAYA","Papaya"],["DURIAN","Durian"],
  ["LYCHEE","Lychee"],["RAMBUTAN","Rambutan"],["LONGAN","Longan"],["POMELO","Pomelo"],["JACKFRUIT","Jackfruit"],
]);
add("food", [
  ["RICE","Cooked rice"],["BREAD","Bread"],["EGG","Fried egg"],["MILK","Milk"],["PIZZA","Pizza"],["CAKE","Birthday cake"],["CARROT","Carrot"],
  ["CORN","Sweet corn"],["NOODLES","Noodle"],["SOUP","Soup"],["SALAD","Salad"],["SANDWICH","Sandwich"],["HAMBURGER","Hamburger"],["SUSHI","Sushi"],
  ["ICECREAM","Ice cream"],["COOKIE","Chocolate chip cookie"],["DONUT","Doughnut"],["CHOCOLATE","Chocolate"],["CHEESE","Cheese"],["CANDY","Candy"],
  ["HOTDOG","Hot dog"],["TACO","Taco"],["PASTA","Spaghetti"],["MUSHROOM","Edible mushroom"],["TOMATO","Tomato"],["POTATO","Potato"],
  ["BROCCOLI","Broccoli"],["HONEY","Honey"],["COFFEE","Coffee"],["TEA","Tea"],["JUICE","Orange juice"],["WATER","Drinking water"],
  ["CURRY","Green curry"],["PANCAKE","Pancake"],["RAMEN","Ramen"],["FRIED RICE","Fried rice"],["PAD THAI","Pad thai"],["SOM TAM","Som tam"],
  ["FRENCH FRIES","French fries"],["FRIED CHICKEN","Fried chicken"],["YOGURT","Yogurt"],["BUTTER","Butter"],["SUGAR","Sugar"],["SALT","Salt"],["FISH SAUCE","Fish sauce"],
]);
add("school", [
  ["PEN","Ballpoint pen"],["BOOK","Book"],["BAG","Backpack"],["PENCIL","Pencil"],["RULER","Ruler"],["SCISSORS","Scissors"],["NOTEBOOK","Notebook"],
  ["COMPUTER","Laptop"],["CALCULATOR","Calculator"],["GLOBE","Globe"],["CRAYON","Crayon"],["ERASER","Eraser"],["DESK","Desk"],["CHAIR","Chair"],
  ["CLASSROOM","Classroom"],["TEACHER","Teacher"],["STUDENT","Student"],["HOMEWORK","Homework"],["MAP","Map"],["PAINT","Watercolor painting"],
]);
add("body", [
  ["EYE","Human eye"],["EAR","Ear"],["NOSE","Human nose"],["HAND","Hand"],["FOOT","Foot"],["MOUTH","Human mouth"],["HAIR","Hair"],["TOOTH","Human tooth"],
  ["FINGER","Finger"],["LEG","Human leg"],["ARM","Arm"],["TONGUE","Tongue"],["BRAIN","Human brain"],["HEART","Heart"],["BONE","Bone"],
  ["SKIN","Human skin"],["BACK","Human back"],["NECK","Neck"],["SHOULDER","Shoulder"],["STOMACH","Stomach"],
]);
add("weather", [
  ["SUN","Sun"],["RAIN","Rain"],["SNOW","Snow"],["CLOUD","Cloud"],["WIND","Wind"],["STORM","Thunderstorm"],["RAINBOW","Rainbow"],["FOG","Fog"],
  ["SNOW","Snow"],["SUNNY","Sunlight"],["THUNDER","Lightning"],["WARM","Sunlight"],["DRY","Drought"],["HOT","Heat wave"],["COLD","Winter"],
]);
add("vehicles", [
  ["CAR","Car"],["BUS","Bus"],["TRAIN","Train"],["PLANE","Airliner"],["BOAT","Boat"],["BIKE","Bicycle"],["TRUCK","Truck"],["TAXI","Taxicab"],
  ["HELICOPTER","Helicopter"],["SHIP","Cruise ship"],["MOTORCYCLE","Motorcycle"],["TRACTOR","Tractor"],["AMBULANCE","Ambulance"],["FIRETRUCK","Fire engine"],
  ["POLICE CAR","Police car"],["ROCKET","Rocket"],["SUBMARINE","Submarine"],["VAN","Van"],["SCOOTER","Kick scooter"],["TUK-TUK","Auto rickshaw"],
]);
add("jobs", [
  ["DOCTOR","Physician"],["NURSE","Nursing"],["TEACHER","Teacher"],["FARMER","Farmer"],["COOK","Cook (profession)"],["PILOT","Aircraft pilot"],
  ["POLICE","Police officer"],["FIREFIGHTER","Firefighter"],["ARTIST","Painting"],["ENGINEER","Engineer"],["SINGER","Singing"],["ACTOR","Actor"],
  ["SOLDIER","Soldier"],["WAITER","Waiting staff"],["SCIENTIST","Scientist"],["DRIVER","Bus driver"],["BUILDER","Construction worker"],
  ["DENTIST","Dentist"],["BAKER","Baker"],["CHEF","Chef"],
]);
add("clothes", [
  ["SHIRT","Dress shirt"],["TSHIRT","T-shirt"],["PANTS","Jeans"],["DRESS","Dress"],["SHOES","Sneakers"],["SOCKS","Sock"],["HAT","Sun hat"],
  ["GLASSES","Glasses"],["SCARF","Scarf"],["GLOVES","Glove"],["JACKET","Jacket"],["SKIRT","Skirt"],["BOOTS","Boot"],["SANDALS","Sandal"],
  ["UMBRELLA","Umbrella"],["BELT","Belt (clothing)"],["TIE","Necktie"],["COAT","Coat (clothing)"],["SWIMSUIT","Swimsuit"],["UNIFORM","School uniform"],
]);
add("home", [
  ["BED","Bed"],["CHAIR","Chair"],["TABLE","Table (furniture)"],["DOOR","Door"],["WINDOW","Window"],["TV","Television set"],["PHONE","Smartphone"],
  ["CLOCK","Alarm clock"],["LAMP","Lamp"],["SOFA","Couch"],["MIRROR","Mirror"],["BATH","Bathtub"],["FRIDGE","Refrigerator"],["STOVE","Kitchen stove"],
  ["SINK","Sink"],["TOILET","Flush toilet"],["SHOWER","Shower"],["BOOKSHELF","Bookcase"],["COMPUTER","Desktop computer"],["KITCHEN","Kitchen"],
  ["TOOTHBRUSH","Toothbrush"],["TOWEL","Towel"],["SOAP","Soap"],["PILLOW","Pillow"],["BLANKET","Blanket"],["KEY","Key (lock)"],["CUP","Mug"],
  ["PLATE","Plate (dishware)"],["SPOON","Spoon"],["FORK","Fork"],
]);
add("nature", [
  ["TREE","Tree"],["FLOWER","Flower"],["MOUNTAIN","Mountain"],["RIVER","River"],["OCEAN","Ocean"],["GRASS","Grass"],["LEAF","Leaf"],["ROCK","Rock (geology)"],
  ["MOON","Moon"],["STAR","Star"],["SUN","Sun"],["CLOUD","Cumulus cloud"],["LAKE","Lake"],["FOREST","Forest"],["DESERT","Desert"],["ISLAND","Island"],
  ["CAVE","Cave"],["WATERFALL","Waterfall"],["VOLCANO","Volcano"],["RAINBOW","Rainbow"],["SKY","Sky"],["FIRE","Fire"],
]);
add("sports", [
  ["FOOTBALL","Association football"],["BASKETBALL","Basketball"],["TENNIS","Tennis"],["SWIMMING","Swimming (sport)"],["RUNNING","Running"],
  ["CYCLING","Cycling"],["BOXING","Muay Thai"],["GOLF","Golf"],["VOLLEYBALL","Volleyball"],["BASEBALL","Baseball"],["BADMINTON","Badminton"],
  ["SKATEBOARD","Skateboarding"],["SKIING","Skiing"],["SURFING","Surfing"],["YOGA","Yoga"],["TABLE TENNIS","Table tennis"],["DANCING","Dance"],
  ["TROPHY","Trophy"],["MEDAL","Gold medal"],["JUMP","Long jump"],
]);
add("actions", [
  ["RUN","Running"],["WALK","Walking"],["EAT","Eating"],["DRINK","Drinking"],["SLEEP","Sleep"],["READ","Reading"],["WRITE","Handwriting"],
  ["SING","Singing"],["DANCE","Dance"],["SWIM","Swimming"],["PLAY","Play (activity)"],["COOK","Cooking"],["WASH","Hand washing"],["DRAW","Drawing"],
  ["LAUGH","Laughter"],["CRY","Crying"],["CLIMB","Rock climbing"],
]);
add("toys", [
  ["BALL","Ball"],["DOLL","Doll"],["KITE","Kite"],["ROBOT","Robot"],["PUZZLE","Jigsaw puzzle"],["BLOCKS","Toy block"],["TEDDY BEAR","Teddy bear"],
  ["BALLOON","Toy balloon"],["DRUM","Drum kit"],["GUITAR","Guitar"],["PIANO","Piano"],["YO-YO","Yo-yo"],
]);
add("places", [
  ["SCHOOL","School"],["HOSPITAL","Hospital"],["MARKET","Marketplace"],["TEMPLE","Wat"],["PARK","Park"],["ZOO","Zoo"],["BEACH","Beach"],["FARM","Farm"],
  ["RESTAURANT","Restaurant"],["BANK","Bank"],["AIRPORT","Airport"],["LIBRARY","Library"],["SUPERMARKET","Supermarket"],["PLAYGROUND","Playground"],
]);

export const IMAGE_TITLES = T;
export const imageTitleOf = w => (w && T[`${w.cat}|${w.word}`]) || null;

// ── โหลด URL รูปจาก Wikipedia · จำผลไว้ใน localStorage (title → url หรือ "" ถ้าไม่มีรูป) ──
const CK = "smart-vocabplay:imgcache:v1";
let mem = null;
const load = () => { if (mem) return mem; try { mem = JSON.parse(window.localStorage.getItem(CK) || "{}") || {}; } catch (_) { mem = {}; } return mem; };
const save = () => { try { window.localStorage.setItem(CK, JSON.stringify(mem)); } catch (_) {} };
const inflight = {};

// รูปที่บรรจุมากับแอป (public/img จาก scripts/fetch-images.mjs) — ใช้ก่อนเสมอ ไม่ต้องต่อเน็ต
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
export function bundledImageUrl(title) { const f = manifest[title]; return f ? `${BASE}img/${f}` : null; }
export const bundledCount = () => Object.keys(manifest).length;

export function cachedImageUrl(title) { const b = bundledImageUrl(title); if (b) return b; const c = load(); return title in c ? c[title] : undefined; }

export function fetchImageUrl(title) {
  const c = load();
  if (title in c) return Promise.resolve(c[title]);
  if (inflight[title]) return inflight[title];
  const b = bundledImageUrl(title); if (b) return Promise.resolve(b);
  inflight[title] = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`)
    .then(r => { if (r.status === 404) return { none: true }; if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => {
      let url = j?.thumbnail?.source || "";
      if (url) url = url.replace(/\/(\d+)px-/, "/480px-");   // ขอขนาด 480px พอสำหรับมือถือ
      // จำผลเฉพาะเมื่อได้คำตอบจริง (มีรูป หรือบทความไม่มีรูป) · error ชั่วคราวไม่จำ
      if (url || j?.none || j?.title) { c[title] = url; save(); }
      return url;
    })
    .catch(() => "")   // ออฟไลน์/บล็อก → ไม่จำผล ลองใหม่คราวหน้า
    .finally(() => { delete inflight[title]; });
  return inflight[title];
}
export const wikiPageUrl = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

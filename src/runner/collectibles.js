// ── Vocabulary collectibles for the 3D runner (replace the old gold coins) ──
// Every pick-up IS a word of the current category: a real 3D model when one
// exists (Poly Haven / KayKit / Quaternius, CC0 — public/models/items, public/models/animals)
// otherwise a floating "bubble card" (the word's photo on a glossy disc + halo).
//
//   const col = createCollectibles({ THREE, BASE, words, texFor, glow });
//   await col.prepare(excludeIds?)   → preloads up to `maxModels` models of this category (never throws)
//   col.pick(n, excludeId)           → n word objects to spawn (models preferred)
//   col.spawn(word)                  → { obj, mixer?, word, kind:"model"|"card", update(dt,t) }
//   col.dispose()
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";

// WORD → item model slug (public/models/items/<slug>.glb)
export const ITEM_MODELS = {
  // fruits
  APPLE:"apple", KIWI:"kiwi", LEMON:"lemon", BANANA:"banana", AVOCADO:"avocado", LYCHEE:"lychee", PEAR:"pear",
  ORANGE:"orange", WATERMELON:"watermelon",
  // food
  CAKE:"cake", CUPCAKE:"carrot_cake", BREAD:"bread", CARROT:"carrot", CORN:"corn", MUSHROOM:"mushroom", TOMATO:"tomato", POTATO:"potato",
  CHEESE:"cheese", STEAK:"steak", HAM:"ham", HAMBURGER:"hamburger", SOUP:"soup", KETCHUP:"ketchup", ONION:"onion", GINGER:"ginger",
  // vegetables
  LIME:"lime", PUMPKIN:"pumpkin", LETTUCE:"lettuce", "SWEET POTATO":"sweet_potato", BEETROOT:"beetroot", "CORN COB":"corn", SHIITAKE:"mushroom",
  // home
  BED:"bed", CHAIR:"chair", SOFA:"sofa", LAMP:"lamp", TABLE:"table", PILLOW:"pillow", PHOTO:"photo", CARPET:"carpet", BOOKSHELF:"bookshelf",
  BATH:"bath", TOILET:"toilet", SINK:"sink", FORK:"fork", SPOON:"spoon", "TRASH CAN":"trash_can", DOOR:"door", WINDOW:"window", DRAWER:"drawer",
  "WASHING MACHINE":"washing_machine", TOWEL:"towel", SHOWER:"shower", CURTAIN:"curtain", SHELF:"shelf", KEY:"key", PHONE:"phone",
  CLOCK:"clock", TV:"tv", KETTLE:"kettle", BUCKET:"bucket", BROOM:"broom", VASE:"vase", CANDLE:"candle", MIRROR:"mirror",
  POT:"pot", PAN:"pan", PLATE:"plate", BOWL:"bowl", KNIFE:"knife", FRIDGE:"fridge", OVEN:"oven", STOVE:"stove", COMPUTER:"computer",
  // school / toys
  BOOK:"book", BAG:"bag", DESK:"desk", NOTEBOOK:"notebook", BLACKBOARD:"blackboard", BALL:"ball", "BOARD GAME":"board_game", GUITAR:"guitar",
  // clothes
  GLASSES:"glasses", BOOTS:"boots", HAT:"hat", GLOVES:"gloves", WATCH:"watch", NECKLACE:"necklace", RING:"ring",
  // vehicles
  CAR:"car", TAXI:"taxi", "POLICE CAR":"police_car", "TRAFFIC LIGHT":"traffic_light", BOAT:"boat", SAILBOAT:"sailboat", SHIP:"ship", SPACESHIP:"spaceship",
  // nature
  TREE:"tree", ROCK:"rock", STONE:"rock", BUSH:"bush", STAR:"star", CLOUD:"cloud", PLANET:"planet", CACTUS:"cactus",
  // sea animals (swim clip)
  DOLPHIN:"dolphin", WHALE:"whale", SHARK:"shark", FISH:"fish", CLOWNFISH:"clownfish",
};
// per-item tuning: s = size multiplier, rx = tilt toward the camera (flat things), ry = base yaw, spin = false → wobble only
const TUNE = {
  carpet:{ rx:1.1, s:1.15 }, plate:{ rx:.9 }, photo:{ spin:false, ry:0 }, book:{ rx:.5 }, pillow:{ rx:.4 }, window:{ spin:false, ry:0 },
  door:{ s:1.15, spin:false }, mirror:{ spin:false }, blackboard:{ spin:false }, tv:{ spin:false }, computer:{ rx:.25 },
  fork:{ s:1.1, rx:-1.4 }, spoon:{ s:1.1, rx:-1.4 }, knife:{ s:1.15 }, key:{ s:.95, rx:-1.4 }, watch:{ rx:-1.4 }, broom:{ s:1.25 }, ring:{ rx:.6, s:.8 }, necklace:{ rx:.7 },
  car:{ s:1.25 }, taxi:{ s:1.25 }, police_car:{ s:1.25 }, ship:{ s:1.35 }, sailboat:{ s:1.25 }, spaceship:{ s:1.2 }, boat:{ s:1.2 },
  bed:{ s:1.2 }, sofa:{ s:1.2 }, bath:{ s:1.2 }, fridge:{ s:1.1 }, tree:{ s:1.3 }, whale:{ s:1.5 }, shark:{ s:1.35 }, dolphin:{ s:1.3 },
  watermelon:{ s:1.1 }, pumpkin:{ s:1.05 }, banana:{ s:1.1 },
};
// WORD → runner-animal glb (re-used as collectibles in the Animals category)
export const ANIMAL_MODELS = {
  FOX:{ url:"models/fox.glb", idle:"Survey" }, DOG:{ url:"models/shiba.glb", idle:"Idle" }, PUPPY:{ url:"models/shiba.glb", idle:"Idle" },
  HORSE:{ url:"models/horse.glb", idle:"Idle" }, DEER:{ url:"models/animals/stag.glb", idle:"Idle" }, COW:{ url:"models/animals/cow.glb", idle:"Idle" },
  DONKEY:{ url:"models/animals/donkey.glb", idle:"Idle" }, LLAMA:{ url:"models/animals/llama.glb", idle:"Idle" }, WOLF:{ url:"models/animals/wolf.glb", idle:"Idle" },
  DINOSAUR:{ url:"models/animals/trex.glb", idle:"Idle" }, FROG:{ url:"models/animals/frog.glb", idle:"Idle" }, MOUSE:{ url:"models/animals/mouse.glb", idle:"Idle" },
  SNAKE:{ url:"models/animals/snake.glb", idle:"Idle" }, SPIDER:{ url:"models/animals/spider.glb", idle:"Idle" }, BEE:{ url:"models/animals/bee.glb", idle:"Flying" },
  CRAB:{ url:"models/animals/crab.glb", idle:"Idle" },
  DOLPHIN:{ url:"models/items/dolphin.glb", idle:"Swim", swim:true }, WHALE:{ url:"models/items/whale.glb", idle:"Swim", swim:true, s:1.5 },
  SHARK:{ url:"models/items/shark.glb", idle:"Swim", swim:true, s:1.35 }, FISH:{ url:"models/items/fish.glb", idle:"Swim", swim:true },
  CLOWNFISH:{ url:"models/items/clownfish.glb", idle:"Swimming_Normal", swim:true },
};
export const modelUrlFor = w => { const k = (w?.word || "").toUpperCase(); if (ANIMAL_MODELS[k]) return ANIMAL_MODELS[k].url; const s = ITEM_MODELS[k]; return s ? `models/items/${s}.glb` : null; };

const SIZE = 1.3;            // target largest dimension (world units) of a collectible
export const PICK_Y = 1.25;  // float height

export function createCollectibles({ THREE, BASE = "/", words = [], texFor, glow, maxModels = 10, timeoutMs = 15000 }) {
  const T = THREE;
  const loader = new GLTFLoader();
  const proto = new Map();          // url → { scene, anims, size, center, skinned }
  const owned = { geo:new Set(), mat:new Set(), tex:new Set() };
  const own = o => { o.traverse(m => { if (m.geometry) owned.geo.add(m.geometry); const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    ms.forEach(x => { owned.mat.add(x); for (const k in x) { const v = x[k]; if (v && v.isTexture) owned.tex.add(v); } }); }); return o; };
  const key = w => (w.word || "").toUpperCase();
  const timed = p => Promise.race([p, new Promise(r => setTimeout(() => r(null), timeoutMs))]);

  const withModel = words.filter(w => modelUrlFor(w));
  let ready = [];

  async function prepare(excludeIds = []) {
    const ex = new Set(excludeIds);
    const byUrl = new Map();
    for (const w of withModel.slice().sort(() => Math.random() - .5)) { if (ex.has(w.id)) continue; const u = modelUrlFor(w); if (!byUrl.has(u)) byUrl.set(u, w); if (byUrl.size >= maxModels) break; }
    const jobs = [...byUrl.entries()].map(([u, w]) => timed(loader.loadAsync(BASE + u).then(g => {
      if (!g) return null; const sc = g.scene; let skinned = false;
      sc.traverse(o => { if (o.isSkinnedMesh) skinned = true; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      sc.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(sc); const size = new T.Vector3(); box.getSize(size); const center = new T.Vector3(); box.getCenter(center);
      own(sc); proto.set(u, { scene:sc, anims:g.animations || [], max:Math.max(size.x, size.y, size.z) || 1, center, skinned });
      return w;
    }, () => null)));
    try { ready = (await Promise.all(jobs)).filter(Boolean); } catch { ready = []; }
    return ready;
  }

  // n words for a stretch of road: prefer the ones with a loaded model, fill with bubble cards
  function pick(n, excludeId) {
    const models = ready.filter(w => w.id !== excludeId).sort(() => Math.random() - .5);
    const cards = words.filter(w => w.id !== excludeId && !ready.includes(w)).sort(() => Math.random() - .5);
    const out = []; let mi = 0, ci = 0;
    for (let i = 0; i < n; i++) {
      const wantModel = models.length && (Math.random() < .75 || !cards.length);
      if (wantModel) out.push(models[mi++ % models.length]); else if (cards.length) out.push(cards[ci++ % cards.length]); else if (models.length) out.push(models[mi++ % models.length]);
    }
    return out;
  }

  function spawnModel(w) {
    const k = key(w); const u = modelUrlFor(w); const p = proto.get(u); if (!p) return null;
    const am = ANIMAL_MODELS[k]; const slug = ITEM_MODELS[k]; const tune = (!am && TUNE[slug]) || {};
    const inst = p.skinned ? skClone(p.scene) : p.scene.clone(true);
    const s = SIZE * (tune.s || am?.s || 1) / p.max * (am && !am.swim ? 1.15 : 1);
    inst.scale.setScalar(s); inst.position.set(-p.center.x * s, -p.center.y * s, -p.center.z * s);
    const tilt = new T.Group(); tilt.rotation.x = tune.rx || 0; tilt.add(inst);
    const side = Math.random() < .5 ? -1 : 1;   // animals: 3/4 side view, wobbling
    const spin = new T.Group(); spin.rotation.y = tune.ry ?? (am ? side * 1.1 : Math.random() * 6); spin.add(tilt);
    const obj = new T.Group(); obj.add(spin);
    let mixer = null;
    if (p.anims.length) { mixer = new T.AnimationMixer(inst); const clip = p.anims.find(a => a.name === am?.idle) || p.anims[0]; const a = mixer.clipAction(clip); a.play(); a.time = Math.random() * clip.duration; }
    const spinOn = tune.spin !== false && !am;
    const ph = Math.random() * 6;
    return { obj, mixer, word:w, kind:"model", update(dt, t) {
      if (spinOn) spin.rotation.y += dt * 1.6; else spin.rotation.y = (am ? side * 1.1 : tune.ry ?? 0) + Math.sin(t * 1.4 + ph) * .45;
      if (mixer) mixer.update(dt);
    } };
  }

  // glossy "bubble card": photo disc + white rim + halo, wobbles to stay readable
  const discGeo = new T.CircleGeometry(.5, 40), rimGeo = new T.TorusGeometry(.53, .055, 10, 48), backGeo = new T.CircleGeometry(.56, 40);
  const rimMat = new T.MeshPhysicalMaterial({ color:"#ffffff", roughness:.15, clearcoat:1, clearcoatRoughness:.05, emissive:"#ffffff", emissiveIntensity:.15 });
  const backMat = new T.MeshStandardMaterial({ color:"#fff7ed", roughness:.4 });
  const gloss = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    const g = x.createRadialGradient(44, 34, 2, 52, 44, 70); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(.3, "rgba(255,255,255,.1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
  const glossMat = new T.MeshBasicMaterial({ map:gloss, transparent:true, depthWrite:false, toneMapped:false });
  [discGeo, rimGeo, backGeo].forEach(g => owned.geo.add(g)); [rimMat, backMat, glossMat].forEach(m => owned.mat.add(m)); owned.tex.add(gloss);
  const HALO = ["#fde047", "#f9a8d4", "#67e8f9", "#bef264", "#c4b5fd"];
  let cardN = 0;
  async function spawnCard(w) {
    let tex = null, aspect = 1;
    try { const r = await texFor(w); tex = r.tex; aspect = r.aspect || 1; } catch { /* ignore */ }
    const obj = new T.Group(); const card = new T.Group(); obj.add(card);
    let mat; const res = [];
    if (tex) { const t = tex.clone(); t.needsUpdate = true; owned.tex.add(t); res.push(["tex", t]);          // cover-fit the photo into the circle
      if (aspect > 1) { t.repeat.set(1 / aspect, 1); t.offset.set((1 - 1 / aspect) / 2, 0); } else { t.repeat.set(1, aspect); t.offset.set(0, (1 - aspect) / 2); }
      mat = new T.MeshBasicMaterial({ map:t, toneMapped:false }); } else mat = new T.MeshBasicMaterial({ color:"#fde68a" });
    owned.mat.add(mat); res.push(["mat", mat]);
    const back = new T.Mesh(backGeo, backMat); back.position.z = -.02; card.add(back);
    const disc = new T.Mesh(discGeo, mat); card.add(disc);
    const rim = new T.Mesh(rimGeo, rimMat); rim.castShadow = true; card.add(rim);
    const shine = new T.Mesh(discGeo, glossMat); shine.position.z = .012; card.add(shine);
    if (glow) { const hm = new T.SpriteMaterial({ map:glow, color:HALO[cardN++ % HALO.length], transparent:true, opacity:.42, depthWrite:false, blending:T.AdditiveBlending, fog:false });
      owned.mat.add(hm); res.push(["mat", hm]); const halo = new T.Sprite(hm); halo.scale.set(1.9, 1.9, 1); halo.position.z = -.08; card.add(halo); }
    card.scale.setScalar(1.2);
    const ph = Math.random() * 6;
    return { obj, word:w, kind:"card", res, update(dt, t) { card.rotation.y = Math.sin(t * 1.6 + ph) * .5; card.rotation.z = Math.sin(t * 1.1 + ph) * .08; } };
  }

  async function spawn(w) { return (modelUrlFor(w) && proto.has(modelUrlFor(w)) && spawnModel(w)) || spawnCard(w); }

  // free one spawned pick-up's own texture/materials (cards clone the photo texture per instance)
  function release(it) { (it?.res || []).forEach(([k, x]) => { owned[k].delete(x); try { x.dispose(); } catch { /* ignore */ } }); if (it?.mixer) { it.mixer.stopAllAction(); it.mixer.uncacheRoot(it.mixer.getRoot()); } if (it) it.res = []; }

  function dispose() {
    owned.geo.forEach(g => g.dispose()); owned.mat.forEach(m => m.dispose()); owned.tex.forEach(t => t.dispose());
    proto.clear();
  }
  return { prepare, pick, spawn, release, dispose, get modelCount() { return ready.length; } };
}

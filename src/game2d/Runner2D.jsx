// Word Runner 2D — วิ่งด้านข้างในฉากการ์ตูน ฟังคำแล้วแตะรูปที่ตรง (ตัวละครกระโดดไปคว้า) · หลบสิ่งกีดขวาง (ชนแล้วเสียคะแนน) · เก็บเหรียญ · เล่น 5 นาที
import { useEffect, useRef, useState } from "react";
import { Scene, Fl, WordCard, Hud, FloatText, themeOf, pickChoices, shuffle } from "./kit.jsx";

const SESSION = 300;
export const RUNNERS = [
  { e:"🐕", name:"หมา" }, { e:"🐈", name:"แมว" }, { e:"🐇", name:"กระต่าย" }, { e:"🐅", name:"เสือ" }, { e:"🦖", name:"ไดโนเสาร์" },
  { e:"🐘", name:"ช้าง" }, { e:"🐎", name:"ม้า" }, { e:"🦘", name:"จิงโจ้" }, { e:"🐖", name:"หมู" }, { e:"🐧", name:"เพนกวิน", noFlip:true },
];
const OBST = { park:["🪨","🦔","🪵"], jungle:["🪵","🪨","🦔"], farm:["🪵","🦔","🪨"], city:["🚧","🛢️","🚧"], snow:["⛄","🪨","🪵"], candy:["🍩","🧁","🍩"], space:["☄️","🪨","☄️"], beach:["🦀","🪨","🐚"] };

export default function Runner2D({ words, speak, track, catId, sfx, Prompt, ui }) {
  const theme = themeOf(catId);
  const obstList = OBST[theme.id] || OBST.park;
  const [phase, setPhase] = useState("start");
  const [hero, setHero] = useState(RUNNERS[0]);
  const [, setTick] = useState(0);
  const [floats, setFloats] = useState([]);
  const stage = useRef(null); const size = useRef({ W: 360, H: 480 });
  const scroll = useRef(0);
  const G = useRef(null);
  const queue = useRef([]);
  const urlOf = w => ui.imageUrl(w);

  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => { size.current = { W: el.clientWidth, H: el.clientHeight }; });
    ro.observe(el); size.current = { W: el.clientWidth, H: el.clientHeight }; return () => ro.disconnect();
  }, []);

  const nextWord = () => {
    if (!queue.current.length) queue.current = shuffle(words.filter(w => urlOf(w) || w.emoji));
    return queue.current.pop() || words[0];
  };
  const addFloat = (text, x, y, good) => { const id = Math.random(); setFloats(f => [...f, { id, text, x, y, good }]); setTimeout(() => setFloats(f => f.filter(z => z.id !== id)), 950); };

  const spawnGate = (speakNow) => {
    const g = G.current; const { W } = size.current;
    const target = nextWord(); const other = pickChoices(words, target, 1, urlOf)[0] || target;
    const slots = shuffle(["low", "high"]);
    g.gate = { id: Math.random(), x: W + 30, wait: 0, target, done: false, wrong: false, cards: [{ w: target, slot: slots[0] }, { w: other, slot: slots[1] }].map(c => ({ ...c, url: urlOf(c.w), state: null })) };
    g.target = target;
    if (speakNow) ui.say(target);
  };

  const start = () => {
    ui.unlock && ui.unlock(); sfx.tap();
    G.current = { t: 0, left: SESSION, score: 0, correct: 0, total: 0, speed: 0, py: 0, vy: 0, hurt: 0, happy: 0, gate: null, target: null, obst: [], coins: [], nextObs: 3.2, nextCoin: 1.5, gap: 0, over: false };
    queue.current = [];
    setPhase("play");
    spawnGate(true);   // พูดคำแรกตรงใน onClick (iOS)
  };

  const finish = () => {
    const g = G.current; if (!g || g.over) return; g.over = true; setPhase("end"); sfx.win();
    setTimeout(() => track.finish(g.correct, Math.max(g.total, 1), { label: `ถูก ${g.correct}/${g.total} รูป · ⭐ ${g.score} คะแนน` }), 600);
  };

  // วนเกม
  useEffect(() => {
    if (phase !== "play") return;
    let raf, last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = G.current; const { W, H } = size.current;
      if (!g || g.over) return;
      g.t += dt; g.left = Math.max(0, SESSION - g.t);
      if (g.left <= 0) { finish(); return; }
      const v = W * (0.22 + Math.min(0.1, g.t / 2500));     // เร่งขึ้นช้าๆ
      scroll.current += v * dt;
      // ฟิสิกส์ตัวละคร
      const grav = H * 3.4;
      g.vy -= grav * dt; g.py = Math.max(0, g.py + g.vy * dt); if (g.py === 0 && g.vy < 0) g.vy = 0;
      g.hurt = Math.max(0, g.hurt - dt); g.happy = Math.max(0, g.happy - dt);
      const px = W * 0.14, P = H * 0.2;
      // ประตูรูป
      if (g.gate) {
        const park = W * 0.44;
        if (!g.gate.done && g.gate.x <= park) { g.gate.x = park; g.gate.wait += dt;   // ประตูหยุดรอให้เด็กเลือก
          if (g.gate.wait > 8) { g.gate.done = true; g.total += 1; if (!g.gate.wrong) track.wrong(g.gate.target); sfx.bad(); addFloat("หมดเวลา", park - 10, H * 0.35, false); }
        } else g.gate.x -= v * dt * (g.gate.done ? 1.6 : 1.4);
        if (g.gate.x < -H * 0.4) { g.gate = null; g.gap = 0; }
      } else { g.gap += dt; if (g.gap > 0.9) spawnGate(true); }
      // สิ่งกีดขวาง: ไม่ออกใกล้ประตูรูป
      g.nextObs -= dt;
      const gateNear = g.gate && g.gate.x > W * 0.45;
      if (g.nextObs <= 0 && !gateNear) { g.obst.push({ id: Math.random(), x: W + 20, e: obstList[Math.floor(Math.random() * obstList.length)], hit: false }); g.nextObs = 2.6 + Math.random() * 2.2; }
      const O = H * 0.13;
      g.obst.forEach(o => { o.x -= v * dt;
        if (!o.hit && o.x < px + P * 0.7 && o.x + O * 0.8 > px + P * 0.2 && g.py < O * 0.7) { o.hit = true; g.hurt = 0.7; g.score = Math.max(0, g.score - 5); sfx.bad(); addFloat("-5", px + P * 0.3, H * 0.45, false); if (navigator.vibrate) try { navigator.vibrate(80); } catch (_) {} }
      });
      g.obst = g.obst.filter(o => o.x > -O * 2);
      // เหรียญลอยเป็นโค้ง
      g.nextCoin -= dt;
      if (g.nextCoin <= 0 && (!g.gate || g.gate.done)) { for (let i = 0; i < 4; i++) g.coins.push({ id: Math.random(), x: W + 20 + i * H * 0.11, y: H * (0.12 + Math.sin(i / 3 * Math.PI) * 0.13), got: false }); g.nextCoin = 5 + Math.random() * 4; }
      const C = H * 0.075;
      g.coins.forEach(c => { c.x -= v * dt;
        const groundY = H * 0.2; const cy = c.y; const playerBottom = g.py, playerTop = g.py + P;
        if (!c.got && c.x < px + P * 0.8 && c.x + C > px + P * 0.2 && cy + C > playerBottom && cy < playerTop) { c.got = true; g.score += 1; sfx.coin(); }
        void groundY;
      });
      g.coins = g.coins.filter(c => c.x > -C * 2 && !c.got);
      setTick(t => (t + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const jump = (hFrac = 0.34) => { const g = G.current; if (!g || g.over) return; const { H } = size.current; if (g.py > 2) return; g.vy = Math.sqrt(2 * H * 3.4 * H * hFrac); sfx.tap(); };

  const pick = (card, e) => {
    const g = G.current; if (!g || !g.gate || g.gate.done || card.state) return;
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect(), sr = stage.current.getBoundingClientRect();
    if (card.w.id === g.gate.target.id) {
      card.state = "ok"; g.gate.done = true; g.total += 1; g.correct += 1; g.score += 10; g.happy = 0.8;
      jump(card.slot === "high" ? 0.45 : 0.2); track.correct(card.w, e); sfx.ok();
      ui.say(card.w);
      addFloat("+10", r.left - sr.left + r.width / 2 - 20, r.top - sr.top, true);
    } else {
      card.state = "no"; sfx.bad(); g.score = Math.max(0, g.score - 5);
      if (!g.gate.wrong) { g.gate.wrong = true; track.wrong(g.gate.target); }
      addFloat("-5", r.left - sr.left + r.width / 2 - 14, r.top - sr.top, false);
    }
  };

  const g = G.current; const { W, H } = size.current;
  const stageH = "max(340px, min(calc(100dvh - 270px), 620px))";
  const ground = H * 0.2, P = H * 0.2, px = W * 0.14;
  const CH = Math.min(H * 0.29, W * 0.5);
  const t = g ? g.t : 0;
  const bob = g && g.py === 0 ? Math.abs(Math.sin(t * 12)) * 5 : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {phase === "play" && g?.target && <Prompt w={g.target} onClick={() => ui.say(g.target)} />}
      <div ref={stage} onPointerDown={() => phase === "play" && jump()} style={{ position:"relative", height:stageH, borderRadius:24, overflow:"clip", touchAction:"manipulation", userSelect:"none" }}>
        <Scene theme={theme} scrollRef={scroll} groundAt={0.2} style={{ position:"absolute", inset:0 }}>
          {phase === "play" && g && <>
            <Hud time={g.left} score={g.score} onStop={finish} tokens={ui.tokens} />
            {/* เหรียญ */}
            {g.coins.map(c => <div key={c.id} style={{ position:"absolute", left:c.x, bottom:ground + c.y, animation:"vp2dBob 1s ease-in-out infinite" }}><Fl e="🪙" size={H * 0.075} /></div>)}
            {/* สิ่งกีดขวาง */}
            {g.obst.map(o => <div key={o.id} style={{ position:"absolute", left:o.x, bottom:ground - H * 0.01, opacity:o.hit ? 0.35 : 1, transition:"opacity .3s" }}><Fl e={o.e} size={H * 0.13} /></div>)}
            {/* ประตูรูป: เสา + ป้าย 2 ใบ (ล่าง/บน) */}
            {g.gate && <div style={{ position:"absolute", left:g.gate.x, bottom:ground, width:CH * 0.75, height:H * 0.78 }}>
              <div style={{ position:"absolute", left:"46%", width:"8%", bottom:0, height:"100%", background:"linear-gradient(90deg,#8d5a2b,#c58a4b,#8d5a2b)", borderRadius:6 }} />
              {g.gate.cards.map(c => <WordCard key={c.w.id} w={c.w} url={c.url} h={CH} state={c.state} onClick={e => pick(c, e)}
                style={{ position:"absolute", left:0, bottom: c.slot === "low" ? H * 0.01 : H * 0.37, animation: c.state === "no" ? "vp2dShake .35s" : undefined, opacity: g.gate.done && c.state !== "ok" ? 0.45 : 1,
                  transition: c.state === "ok" ? "transform .55s cubic-bezier(.5,-0.3,.7,1), opacity .55s" : undefined, zIndex: c.state === "ok" ? 4 : 1,
                  transform: c.state === "ok" ? `translate(${px - g.gate.x}px, ${(c.slot === "low" ? 0 : H * 0.37) - g.py}px) scale(.25)` : undefined }} />)}
            </div>}
            {/* ตัวละคร */}
            <div style={{ position:"absolute", left:px, bottom:ground + g.py + bob - H * 0.01, width:P, height:P, filter: g.hurt > 0 ? "saturate(.4) brightness(1.2)" : undefined,
              transform:`rotate(${g.py > 0 ? -8 : Math.sin(t * 12) * 4}deg)`, transformOrigin:"50% 90%" }}>
              <Fl e={hero.e} size={P} flip={!hero.noFlip} style={{ opacity: g.hurt > 0 && Math.floor(t * 12) % 2 ? 0.4 : 1 }} />
              {g.happy > 0 && <div style={{ position:"absolute", top:-P * 0.35, left:P * 0.3 }}><Fl e="✨" size={P * 0.45} /></div>}
            </div>
            {/* เงา */}
            <div style={{ position:"absolute", left:px + P * 0.15, bottom:ground - H * 0.02, width:P * 0.7, height:H * 0.025, borderRadius:"50%", background:"rgba(0,0,0,.18)", transform:`scale(${1 - Math.min(0.6, g.py / H)})` }} />
            <FloatText items={floats} />
            <button onPointerDown={e => { e.stopPropagation(); jump(); }} aria-label="กระโดด" style={{ position:"absolute", right:10, bottom:10, width:64, height:64, borderRadius:"50%", border:"none", zIndex:5,
              background:ui.tokens.primary, color:ui.tokens.onPrimary, fontSize:15, fontWeight:900, boxShadow:"0 5px 0 rgba(0,0,0,.25)", cursor:"pointer" }}>⤴<br/>กระโดด</button>
          </>}
          {phase === "start" && <StartCard title="Word Runner" sub="ฟังคำ แล้วแตะรูปให้ตัวละครกระโดดไปคว้า · แตะจอเพื่อกระโดดหลบสิ่งกีดขวาง · เล่น 5 นาที"
            options={RUNNERS} value={hero} onPick={h => { setHero(h); sfx.tap(); }} onStart={start} tokens={ui.tokens} />}
          {phase === "end" && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Fl e="🏆" size={140} style={{ animation:"vp2dPop .6s" }} /></div>}
        </Scene>
      </div>
    </div>
  );
}

// หน้าจอเริ่ม: เลือกตัวละคร + ปุ่มเริ่ม (ใช้ร่วมกันหลายเกม)
export function StartCard({ title, sub, options, value, onPick, onStart, tokens, pickLabel = "เลือกตัวละคร" }) {
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", padding:12, zIndex:5 }}>
      <div style={{ background:tokens.card, borderRadius:24, padding:"14px 12px", width:"min(100%, 440px)", boxShadow:`0 8px 0 rgba(0,0,0,.12), 0 16px 32px ${tokens.shadow || "rgba(0,0,0,.2)"}`, textAlign:"center" }}>
        <div style={{ fontWeight:900, fontSize:22, color:tokens.ink }}>{title}</div>
        <div style={{ fontSize:13, color:tokens.ink, opacity:.75, margin:"4px 0 10px", lineHeight:1.45 }}>{sub}</div>
        {options && <>
          <div style={{ fontSize:13, fontWeight:800, color:tokens.ink, marginBottom:6 }}>{pickLabel}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:6, marginBottom:12 }}>
            {options.map(o => <button key={o.e} onClick={() => onPick(o)} aria-label={o.name} style={{ minHeight:56, borderRadius:16, border:`3px solid ${o === value ? tokens.primary : "transparent"}`,
              background: o === value ? `${tokens.primary}22` : "transparent", padding:2, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Fl e={o.e} size={48} flip={!o.noFlip} /></button>)}
          </div></>}
        <button onClick={onStart} className="vp-3d" style={{ width:"100%", minHeight:60, borderRadius:999, border:"none", background:tokens.primary, color:tokens.onPrimary, fontSize:22, fontWeight:900, cursor:"pointer" }}>▶ เริ่ม!</button>
      </div>
    </div>
  );
}

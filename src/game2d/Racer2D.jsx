// Word Racer 2D — ขับรถบนถนน 2 เลน ฟังคำแล้วแตะป้ายรูปที่ถูก (รถเปลี่ยนเลนพุ่งเข้าป้าย) · หลบกรวยด้วยปุ่มขึ้น/ลง · เล่น 5 นาที
import { useEffect, useRef, useState } from "react";
import { Scene, Fl, WordCard, Hud, FloatText, themeOf, THEMES, pickChoices, shuffle } from "./kit.jsx";
import { StartCard } from "./Runner2D.jsx";

const SESSION = 300;
const CARS = [{ e:"🚗", name:"รถเก๋ง" }, { e:"🏎️", name:"รถแข่ง" }, { e:"🚕", name:"แท็กซี่" }, { e:"🚓", name:"รถตำรวจ" }, { e:"🚑", name:"รถพยาบาล" },
  { e:"🚒", name:"รถดับเพลิง" }, { e:"🛻", name:"กระบะ" }, { e:"🚌", name:"รถบัส" }, { e:"🚜", name:"รถไถ" }, { e:"🏍️", name:"มอเตอร์ไซค์" }];
const RIVALS = ["🚙", "🚐", "🚚", "🚗", "🚕"];

export default function Racer2D({ words, track, catId, sfx, Prompt, ui }) {
  const base = themeOf(catId);
  const theme = { ...(base.dark ? THEMES.space : base), ground: "#4a4f5a", groundTop: "#8bc34a" };
  const [phase, setPhase] = useState("start");
  const [car, setCar] = useState(CARS[1]);
  const [, setTick] = useState(0);
  const [floats, setFloats] = useState([]);
  const stage = useRef(null); const size = useRef({ W: 360, H: 480 });
  const scroll = useRef(0); const G = useRef(null); const queue = useRef([]);
  const urlOf = w => ui.imageUrl(w);

  useEffect(() => { const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => { size.current = { W: el.clientWidth, H: el.clientHeight }; }); ro.observe(el);
    size.current = { W: el.clientWidth, H: el.clientHeight }; return () => ro.disconnect(); }, []);

  const nextWord = () => { if (!queue.current.length) queue.current = shuffle(words.filter(w => urlOf(w) || w.emoji)); return queue.current.pop() || words[0]; };
  const addFloat = (text, x, y, good) => { const id = Math.random(); setFloats(f => [...f, { id, text, x, y, good }]); setTimeout(() => setFloats(f => f.filter(z => z.id !== id)), 950); };

  // ตำแหน่งเลน (สัดส่วนความสูงจากล่าง): เลน 0 = ใกล้ (ล่าง) · เลน 1 = ไกล (บน)
  const laneY = (lane, H) => lane === 0 ? H * 0.05 : H * 0.2;

  const spawnGate = speakNow => {
    const g = G.current; const { W } = size.current;
    const target = nextWord(); const other = pickChoices(words, target, 1, urlOf)[0] || target;
    const lanes = shuffle([0, 1]);
    g.gate = { x: W + 30, wait: 0, target, done: false, wrong: false, cards: [{ w: target, lane: lanes[0] }, { w: other, lane: lanes[1] }].map(c => ({ ...c, url: urlOf(c.w), state: null })) };
    g.target = target; if (speakNow) ui.say(target);
  };
  const start = () => {
    ui.unlock && ui.unlock(); sfx.tap();
    G.current = { t: 0, left: SESSION, score: 0, correct: 0, total: 0, lane: 0, laneF: 0, dash: 0, hurt: 0, gate: null, target: null, cones: [], rivals: [], nextCone: 3, nextRival: 1, gap: 0, over: false };
    queue.current = []; setPhase("play"); spawnGate(true);
  };
  const finish = () => { const g = G.current; if (!g || g.over) return; g.over = true; setPhase("end"); sfx.win();
    setTimeout(() => track.finish(g.correct, Math.max(g.total, 1), { label: `ถูก ${g.correct}/${g.total} ป้าย · ⭐ ${g.score} คะแนน` }), 600); };

  useEffect(() => {
    if (phase !== "play") return;
    let raf, last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = G.current; const { W, H } = size.current; if (!g || g.over) return;
      g.t += dt; g.left = Math.max(0, SESSION - g.t); if (g.left <= 0) { finish(); return; }
      const v = W * (0.45 + Math.min(0.15, g.t / 2000)) * (g.hurt > 0 ? 0.5 : 1);
      scroll.current += v * dt;
      g.laneF += (g.lane - g.laneF) * Math.min(1, dt * 10);
      g.hurt = Math.max(0, g.hurt - dt); g.dash = Math.max(0, g.dash - dt);
      const cx = W * 0.06, CW = H * 0.2;
      if (g.gate) {
        const park = W * 0.42;
        if (!g.gate.done && g.gate.x <= park) { g.gate.x = park; g.gate.wait += dt;
          if (g.gate.wait > 8) { g.gate.done = true; g.total += 1; if (!g.gate.wrong) track.wrong(g.gate.target); sfx.bad(); addFloat("หมดเวลา", park, H * 0.3, false); } }
        else g.gate.x -= v * dt * (g.gate.done ? 1.3 : 0.9);
        if (g.gate.x < -H * 0.4) { g.gate = null; g.gap = 0; }
      } else { g.gap += dt; if (g.gap > 0.8) spawnGate(true); }
      // กรวย (ต้องเปลี่ยนเลนหลบ) — ไม่ออกตอนป้ายรอ
      g.nextCone -= dt;
      if (g.nextCone <= 0 && (!g.gate || g.gate.done)) { g.cones.push({ id: Math.random(), x: W + 20, lane: Math.random() < 0.5 ? 0 : 1, hit: false }); g.nextCone = 2 + Math.random() * 2; }
      const K = H * 0.1;
      g.cones.forEach(c => { c.x -= v * dt;
        if (!c.hit && Math.round(g.laneF) === c.lane && Math.abs(g.laneF - c.lane) < 0.3 && c.x < cx + CW * 0.95 && c.x + K * 0.8 > cx + CW * 0.2) {
          c.hit = true; g.hurt = 0.8; g.score = Math.max(0, g.score - 5); sfx.bad(); addFloat("-5", cx + CW * 0.4, H * 0.5, false); } });
      g.cones = g.cones.filter(c => c.x > -K * 2);
      // รถคู่แข่งแซง (ตกแต่ง)
      g.nextRival -= dt;
      if (g.nextRival <= 0) { g.rivals.push({ id: Math.random(), x: -H * 0.3, e: RIVALS[Math.floor(Math.random() * RIVALS.length)], sp: 0.15 + Math.random() * 0.1 }); g.nextRival = 5 + Math.random() * 5; }
      g.rivals.forEach(r => { r.x += W * r.sp * dt; }); g.rivals = g.rivals.filter(r => r.x < W + 50);
      setTick(t => (t + 1) % 1e6); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const steer = lane => { const g = G.current; if (!g || g.over || g.lane === lane) return; g.lane = lane; sfx.tap(); };
  const pick = (card, e) => {
    const g = G.current; if (!g || !g.gate || g.gate.done || card.state) return; e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect(), sr = stage.current.getBoundingClientRect();
    if (card.w.id === g.gate.target.id) {
      card.state = "ok"; g.gate.done = true; g.total += 1; g.correct += 1; g.score += 10; g.lane = card.lane; g.dash = 0.6;
      track.correct(card.w, e); sfx.ok(); ui.say(card.w); addFloat("+10", r.left - sr.left + r.width / 2 - 20, r.top - sr.top, true);
    } else {
      card.state = "no"; sfx.bad(); g.score = Math.max(0, g.score - 5);
      if (!g.gate.wrong) { g.gate.wrong = true; track.wrong(g.gate.target); }
      addFloat("-5", r.left - sr.left + r.width / 2 - 14, r.top - sr.top, false);
    }
  };

  const g = G.current; const { W, H } = size.current;
  const stageH = "max(340px, min(calc(100dvh - 270px), 620px))";
  const CW = H * 0.2, cx = W * 0.06, CH = Math.min(H * 0.3, W * 0.5);
  const road = H * 0.33;
  const t = g ? g.t : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {phase === "play" && g?.target && <Prompt w={g.target} onClick={() => ui.say(g.target)} />}
      <div ref={stage} style={{ position:"relative", height:stageH, borderRadius:24, overflow:"clip", touchAction:"manipulation", userSelect:"none" }}>
        <Scene theme={theme} scrollRef={scroll} groundAt={0.33} style={{ position:"absolute", inset:0 }}>
          {/* เส้นถนน */}
          <div style={{ position:"absolute", left:0, right:0, bottom:H * 0.165, height:6, backgroundImage:"linear-gradient(90deg,#fff 0 50%,transparent 50% 100%)", backgroundSize:"60px 6px",
            backgroundPositionX: -(scroll.current % 60), opacity:.85 }} />
          <div style={{ position:"absolute", left:0, right:0, bottom:road - 8, height:8, background:"repeating-linear-gradient(90deg,#e53935 0 24px,#fff 24px 48px)", backgroundPositionX: -(scroll.current % 48) }} />
          {phase === "play" && g && <>
            <Hud time={g.left} score={g.score} onStop={finish} tokens={ui.tokens} />
            {g.rivals.map(r => <div key={r.id} style={{ position:"absolute", left:r.x, bottom:H * 0.22, opacity:.9 }}><Fl e={r.e} size={H * 0.13} flip /></div>)}
            {g.cones.map(c => <div key={c.id} style={{ position:"absolute", left:c.x, bottom:laneY(c.lane, H) + H * 0.01, opacity:c.hit ? .3 : 1, zIndex: c.lane === 0 ? 3 : 2 }}><Fl e="🚧" size={H * 0.1} /></div>)}
            {g.gate && g.gate.cards.map(c => <WordCard key={c.w.id} w={c.w} url={c.url} h={CH} state={c.state} onClick={e => pick(c, e)}
              style={{ position:"absolute", left:g.gate.x, bottom: c.lane === 0 ? H * 0.03 : H * 0.38, zIndex: c.lane === 0 ? 4 : 2,
                opacity: g.gate.done && c.state !== "ok" ? .45 : 1, transition: c.state === "ok" ? "transform .5s ease-in, opacity .5s" : undefined,
                transform: c.state === "ok" ? "scale(1.15) rotate(-6deg)" : undefined }} />)}
            {/* รถผู้เล่น */}
            <div style={{ position:"absolute", left: cx + (g.dash > 0 ? W * 0.08 * Math.sin(g.dash / 0.6 * Math.PI) : 0), bottom: laneY(0, H) + (laneY(1, H) - laneY(0, H)) * g.laneF, zIndex: 3,
              transform:`rotate(${(g.lane - g.laneF) * -14 + (g.hurt > 0 ? Math.sin(t * 40) * 6 : 0)}deg)`, filter: g.hurt > 0 ? "saturate(.5)" : undefined }}>
              <Fl e={car.e} size={CW} flip />
              <div style={{ position:"absolute", left:-CW * 0.25, bottom:CW * 0.12, width:CW * 0.3, height:CW * 0.12, borderRadius:8, background:"rgba(255,255,255,.7)", filter:"blur(3px)", opacity: .4 + .3 * Math.sin(t * 30) }} />
            </div>
            <FloatText items={floats} />
            <div style={{ position:"absolute", right:10, bottom:10, display:"flex", flexDirection:"column", gap:8, zIndex:6 }}>
              {[[1, "▲ บน"], [0, "▼ ล่าง"]].map(([ln, lab]) => <button key={ln} onPointerDown={e => { e.stopPropagation(); steer(ln); }} style={{ width:64, height:52, borderRadius:16, border:"none",
                background: g.lane === ln ? ui.tokens.primary : ui.tokens.card, color: g.lane === ln ? ui.tokens.onPrimary : ui.tokens.ink, fontWeight:900, fontSize:14, boxShadow:"0 4px 0 rgba(0,0,0,.2)", cursor:"pointer" }}>{lab}</button>)}
            </div>
          </>}
          {phase === "start" && <StartCard title="Word Racer" sub="ฟังคำ แล้วแตะป้ายรูปที่ถูก รถจะพุ่งเข้าไป · กด ▲▼ เปลี่ยนเลนหลบกรวย · เล่น 5 นาที"
            options={CARS} value={car} onPick={c => { setCar(c); sfx.tap(); }} onStart={start} tokens={ui.tokens} pickLabel="เลือกรถ" />}
          {phase === "end" && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Fl e="🏁" size={140} style={{ animation:"vp2dPop .6s" }} /></div>}
        </Scene>
      </div>
    </div>
  );
}

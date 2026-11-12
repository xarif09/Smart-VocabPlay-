// Find It! 2D — ห้องการ์ตูน (บ้าน/ห้องของเล่น/ห้องเรียน/ห้องแต่งตัว) มีของวางอยู่ ฟังคำแล้วแตะของชิ้นนั้น · เก็บครบ 5 ชิ้นจัดห้องใหม่ · เล่น 5 นาที
import { useEffect, useRef, useState } from "react";
import { Fl, fl, Hud, FloatText, shuffle, StartCard } from "./kit.jsx";

const SESSION = 300;
const ROOMS = {
  home:    { wall:["#ffe8c7","#ffd9a8"], pattern:"stripes", floor:["#c98b52","#a96d3a"], rug:"#ef8a80", label:"ห้องนั่งเล่น" },
  toys:    { wall:["#dff3ff","#c4e7ff"], pattern:"stars",   floor:["#ffd36b","#f2b93b"], rug:"#9c7bff", label:"ห้องของเล่น" },
  school:  { wall:["#e5f6e2","#cdebc7"], pattern:"plain",   floor:["#c9ced6","#aab1bb"], rug:"#4fc3f7", label:"ห้องเรียน", board:true },
  clothes: { wall:["#ffe3ef","#ffcde2"], pattern:"dots",    floor:["#d7a77a","#b98858"], rug:"#ffb74d", label:"ห้องแต่งตัว" },
};
// ตำแหน่งวางของ (x,y = จุดกึ่งกลาง % ของเวที · s = ขนาด % ของความกว้าง)
const SLOTS = [   // y = ตำแหน่งฐานของสิ่งของ (วางบนชั้น/ขอบหน้าต่าง/โต๊ะ/พื้น)
  { x:61, y:29, s:18 }, { x:84, y:29, s:18 }, { x:61, y:50, s:18 }, { x:84, y:50, s:18 },
  { x:20, y:49, s:16 }, { x:42, y:64, s:17 },
  { x:14, y:86, s:21 }, { x:38, y:95, s:21 }, { x:63, y:88, s:21 }, { x:87, y:96, s:20 },
];
const NOT_OBJECT = /ROOM|ROOF|GARDEN|KITCHEN|GARAGE|BALCONY|WALL|FLOOR|STAIRS|SCHOOL|CANTEEN|LIBRARY|PLAYGROUND|ASSEMBLY|HOMEWORK|LESSON|GRADE|HISTORY|MATH|SCIENCE|ENGLISH|MUSIC|ART|P\.E\.|TEACHER|STUDENT|PRINCIPAL|CLASSMATE|TEST|HOME/;
const PER_ROOM = 8, FIND_PER_ROOM = 5;

export default function FindRoom2D({ words, track, catId, sfx, Prompt, ui }) {
  const room = ROOMS[catId] || ROOMS.home;
  // ใช้เฉพาะคำที่มีภาพการ์ตูน และอีโมจิไม่ซ้ำกับคำอื่น (กันแตะถูกแต่ระบบว่าผิด)
  const pool = useRef(null);
  if (!pool.current) {
    const cnt = {}; words.forEach(w => { cnt[w.emoji] = (cnt[w.emoji] || 0) + 1; });
    pool.current = words.filter(w => fl(w.emoji) && cnt[w.emoji] === 1 && !NOT_OBJECT.test(w.word));
  }
  const [phase, setPhase] = useState("start");
  const [items, setItems] = useState([]);        // [{w, slot, state}]
  const [target, setTarget] = useState(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SESSION);
  const [found, setFound] = useState(0);
  const [floats, setFloats] = useState([]);
  const S = useRef({ correct: 0, total: 0, score: 0, over: false, t0: 0, wrong: false, inRoom: 0 });
  const stage = useRef(null); const timers = useRef([]);
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const addFloat = (text, x, y, good) => { const id = Math.random(); setFloats(f => [...f, { id, text, x, y, good }]); later(() => setFloats(f => f.filter(z => z.id !== id)), 950); };

  const newRoom = () => {
    const ws = shuffle(pool.current).slice(0, PER_ROOM); const slots = shuffle(SLOTS).slice(0, ws.length);
    const its = ws.map((w, i) => ({ w, slot: slots[i], state: null }));
    setItems(its); S.current.inRoom = 0; return its;
  };
  const nextTarget = (its, speakNow) => {
    const left = its.filter(i => i.state !== "ok"); const t = left[Math.floor(Math.random() * left.length)]?.w;
    S.current.wrong = false; setTarget(t || null); if (t && speakNow) ui.say(t);
  };
  const start = () => { ui.unlock && ui.unlock(); sfx.tap(); S.current = { correct: 0, total: 0, score: 0, over: false, t0: performance.now(), wrong: false, inRoom: 0 };
    setScore(0); setFound(0); setLeft(SESSION); setPhase("play"); const its = newRoom(); nextTarget(its, true); };
  const finish = () => { const s = S.current; if (s.over) return; s.over = true; setPhase("end"); sfx.win();
    later(() => track.finish(s.correct, Math.max(s.total, 1), { label: `หาเจอ ${s.correct}/${s.total} ชิ้น · ⭐ ${s.score} คะแนน` }), 600); };

  useEffect(() => { if (phase !== "play") return;
    const id = setInterval(() => { const l = Math.max(0, SESSION - (performance.now() - S.current.t0) / 1000); setLeft(l); if (l <= 0) { clearInterval(id); finish(); } }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const tap = (it, e) => {
    const s = S.current; if (!target || s.over || it.state === "ok") return;
    const r = e.currentTarget.getBoundingClientRect(), sr = stage.current.getBoundingClientRect();
    if (it.w.id === target.id) {
      s.total += 1; s.correct += 1; s.score += 10; s.inRoom += 1; setScore(s.score); setFound(f => f + 1);
      track.correct(it.w, e); sfx.ok(); ui.say(it.w); addFloat("+10", r.left - sr.left, r.top - sr.top, true);
      const its = items.map(x => x === it ? { ...x, state: "ok" } : x); setItems(its); setTarget(null);
      if (s.inRoom >= FIND_PER_ROOM) later(() => { const n = newRoom(); nextTarget(n, true); }, 1300);
      else later(() => nextTarget(its, true), 1100);
    } else {
      sfx.bad(); s.score = Math.max(0, s.score - 5); setScore(s.score); addFloat("-5", r.left - sr.left, r.top - sr.top, false);
      if (!s.wrong) { s.wrong = true; s.total += 1; track.wrong(target); }
      setItems(xs => xs.map(x => x === it ? { ...x, state: "no" } : x)); later(() => setItems(xs => xs.map(x => x.w.id === it.w.id && x.state === "no" ? { ...x, state: null } : x)), 450);
    }
  };

  const stageH = "max(360px, min(calc(100dvh - 270px), 640px))";
  const wallBg = room.pattern === "stripes" ? `repeating-linear-gradient(90deg, ${room.wall[0]} 0 22px, ${room.wall[1]} 22px 44px)`
    : room.pattern === "dots" ? `radial-gradient(${room.wall[1]} 3px, transparent 4px) 0 0/22px 22px, ${room.wall[0]}`
    : room.pattern === "stars" ? `radial-gradient(circle, #fff 2px, transparent 3px) 0 0/28px 28px, radial-gradient(circle, ${room.wall[1]} 6px, transparent 7px) 14px 14px/28px 28px, ${room.wall[0]}`
    : room.wall[0];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {phase === "play" && target && <Prompt w={target} onClick={() => ui.say(target)} />}
      {phase === "play" && !target && <div style={{ height:4 }} />}
      <div ref={stage} style={{ position:"relative", height:stageH, borderRadius:24, overflow:"clip", userSelect:"none", background:wallBg }}>
        {/* หน้าต่าง หรือ กระดานดำ */}
        {room.board
          ? <div style={{ position:"absolute", left:"5%", top:"14%", width:"36%", height:"30%", background:"#2e5d4b", border:"8px solid #8d6e63", borderRadius:8, boxShadow:"0 6px 0 rgba(0,0,0,.15)" }}>
              <div style={{ color:"#fff", opacity:.85, fontWeight:800, fontSize:18, padding:"8px 10px", fontFamily:"Fredoka, sans-serif" }}>A B C<br/>1 2 3</div></div>
          : <div style={{ position:"absolute", left:"5%", top:"12%", width:"30%", height:"30%", background:"linear-gradient(180deg,#8fd3ff,#e3f6ff)", border:"8px solid #fff", borderRadius:10, boxShadow:"0 6px 0 rgba(0,0,0,.12)", overflow:"hidden" }}>
              <div style={{ position:"absolute", left:"10%", top:"14%" }}><Fl e="☁️" size={40} /></div>
              <div style={{ position:"absolute", right:"8%", top:"8%", width:26, height:26, borderRadius:"50%", background:"#ffe082", boxShadow:"0 0 14px #ffe082" }} />
              <div style={{ position:"absolute", left:"48%", top:0, bottom:0, width:6, background:"#fff" }} /><div style={{ position:"absolute", top:"48%", left:0, right:0, height:6, background:"#fff" }} />
              <div style={{ position:"absolute", left:-6, top:-6, bottom:-6, width:"22%", background:"linear-gradient(90deg,#ef5350,#e57373)", borderRadius:"0 0 40% 0" }} />
              <div style={{ position:"absolute", right:-6, top:-6, bottom:-6, width:"22%", background:"linear-gradient(270deg,#ef5350,#e57373)", borderRadius:"0 0 0 40%" }} /></div>}
        {/* ขอบหน้าต่าง */}
        <div style={{ position:"absolute", left:"3%", top:"49%", width:"34%", height:10, background:"#fff", borderRadius:4, boxShadow:"0 3px 0 rgba(0,0,0,.12)" }} />
        {/* ชั้นวาง 2 ชั้น */}
        {[29, 50].map(y => <div key={y} style={{ position:"absolute", left:"50%", right:"3%", top:`${y}%`, height:12, background:"linear-gradient(180deg,#a1673a,#7b4a26)", borderRadius:4, boxShadow:"0 5px 0 rgba(0,0,0,.15)" }} />)}
        {/* พื้น */}
        <div style={{ position:"absolute", left:0, right:0, top:"66%", bottom:0, background:`repeating-linear-gradient(90deg, ${room.floor[0]} 0 48px, ${room.floor[1]} 48px 50px)`, boxShadow:"inset 0 8px 0 rgba(0,0,0,.12)" }} />
        <div style={{ position:"absolute", left:"10%", right:"10%", top:"76%", height:"20%", borderRadius:"50%", background:room.rug, opacity:.85, boxShadow:`inset 0 0 0 8px rgba(255,255,255,.35)` }} />
        {/* โต๊ะ */}
        <div style={{ position:"absolute", left:"28%", width:"28%", top:"64%", height:10, background:"#8d5a32", borderRadius:6 }} />
        {[30, 52].map(x => <div key={x} style={{ position:"absolute", left:`${x}%`, top:"65%", width:8, height:"11%", background:"#6d4424", borderRadius:3 }} />)}

        {phase === "play" && <>
          <Hud time={left} score={score} onStop={finish} tokens={ui.tokens} />
          {items.map((it, i) => <button key={it.w.id} onClick={e => tap(it, e)} aria-label={it.w.word} style={{ position:"absolute", left:`${it.slot.x}%`, top:`${it.slot.y}%`, width:`${it.slot.s}%`, aspectRatio:"1",
            transform:`translate(-50%,-100%) ${it.state === "ok" ? "scale(1.4)" : ""}`, opacity: it.state === "ok" ? 0 : 1, transition:"transform .45s, opacity .45s .2s",
            border:"none", background:"transparent", padding:0, cursor:"pointer", animation: it.state === "no" ? "vp2dShake .35s" : `vp2dBob ${2.4 + (i % 3) * 0.4}s ease-in-out ${i * 0.2}s infinite`,
            filter:"drop-shadow(0 6px 4px rgba(0,0,0,.22))" }}>
            <Fl e={it.w.emoji} size="100%" style={{ width:"100%", height:"100%" }} alt={it.w.word} /></button>)}
          {/* ตะกร้าของที่หาเจอ */}
          <div style={{ position:"absolute", left:8, bottom:8, display:"flex", alignItems:"center", gap:4, padding:"4px 10px 4px 4px", borderRadius:999, background:"rgba(255,255,255,.85)", fontWeight:900, color:"#2a2140", zIndex:5 }}>
            <Fl e="🧺" size={36} /> {found}</div>
          <FloatText items={floats} />
        </>}
        {phase === "start" && <StartCard title={`Find It! · ${room.label}`} sub="ห้องนี้มีของเยอะมาก ฟังคำแล้วแตะของชิ้นนั้นให้เจอ · หาครบ 5 ชิ้นจะจัดห้องใหม่ · เล่น 5 นาที" onStart={start} tokens={ui.tokens} />}
        {phase === "end" && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Fl e="🏆" size={140} style={{ animation:"vp2dPop .6s" }} /></div>}
      </div>
    </div>
  );
}

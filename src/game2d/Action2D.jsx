// Who Is Doing It? 2D — เวทีละครมีม่าน ไฟสปอตไลต์ นักแสดงการ์ตูน 4 ตัว ฟังคำกริยาแล้วแตะตัวที่ทำท่านั้น · เล่น 5 นาที
import { useEffect, useRef, useState } from "react";
import { Fl, fl, Hud, FloatText, shuffle, StartCard } from "./kit.jsx";

const SESSION = 300;

export default function Action2D({ words, track, sfx, Prompt, ui }) {
  const pool = useRef(null);
  if (!pool.current) { const cnt = {}; words.forEach(w => { cnt[w.emoji] = (cnt[w.emoji] || 0) + 1; }); pool.current = words.filter(w => fl(w.emoji) && cnt[w.emoji] === 1); }
  const [phase, setPhase] = useState("start");
  const [round, setRound] = useState(null);   // { target, actors:[{w,state}] }
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SESSION);
  const [floats, setFloats] = useState([]);
  const S = useRef({ correct: 0, total: 0, score: 0, over: false, t0: 0, wrong: false, busy: false });
  const queue = useRef([]); const stage = useRef(null); const timers = useRef([]);
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const addFloat = (text, x, y, good) => { const id = Math.random(); setFloats(f => [...f, { id, text, x, y, good }]); later(() => setFloats(f => f.filter(z => z.id !== id)), 950); };

  const newRound = speakNow => {
    if (!queue.current.length) queue.current = shuffle(pool.current);
    const target = queue.current.pop();
    const others = shuffle(pool.current.filter(w => w.id !== target.id)).slice(0, 3);
    S.current.wrong = false; S.current.busy = false;
    setRound({ target, actors: shuffle([target, ...others]).map(w => ({ w, state: null })) });
    if (speakNow) ui.say(target);
  };
  const start = () => { ui.unlock && ui.unlock(); sfx.tap(); S.current = { correct: 0, total: 0, score: 0, over: false, t0: performance.now(), wrong: false, busy: false };
    setScore(0); setLeft(SESSION); queue.current = []; setPhase("play"); newRound(true); };
  const finish = () => { const s = S.current; if (s.over) return; s.over = true; setPhase("end"); sfx.win();
    later(() => track.finish(s.correct, Math.max(s.total, 1), { label: `ตอบถูก ${s.correct}/${s.total} ท่า · ⭐ ${s.score} คะแนน` }), 600); };
  useEffect(() => { if (phase !== "play") return;
    const id = setInterval(() => { const l = Math.max(0, SESSION - (performance.now() - S.current.t0) / 1000); setLeft(l); if (l <= 0) { clearInterval(id); finish(); } }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const tap = (a, e) => {
    const s = S.current; if (!round || s.over || s.busy || a.state) return;
    const r = e.currentTarget.getBoundingClientRect(), sr = stage.current.getBoundingClientRect();
    if (a.w.id === round.target.id) {
      s.busy = true; s.total += 1; s.correct += 1; s.score += 10; setScore(s.score);
      track.correct(a.w, e); sfx.ok(); ui.say(a.w); addFloat("+10", r.left - sr.left + r.width / 2 - 20, r.top - sr.top, true);
      setRound(rd => ({ ...rd, actors: rd.actors.map(x => x === a ? { ...x, state: "ok" } : x) }));
      later(() => { if (!S.current.over) newRound(true); }, 1500);
    } else {
      sfx.bad(); s.score = Math.max(0, s.score - 5); setScore(s.score); addFloat("-5", r.left - sr.left + r.width / 2 - 14, r.top - sr.top, false);
      if (!s.wrong) { s.wrong = true; s.total += 1; track.wrong(round.target); }
      setRound(rd => ({ ...rd, actors: rd.actors.map(x => x === a ? { ...x, state: "no" } : x) }));
    }
  };

  const stageH = "max(360px, min(calc(100dvh - 270px), 640px))";
  const curtain = side => ({ position:"absolute", top:0, bottom:"8%", [side]:0, width:"9%", zIndex:3,
    background:"repeating-linear-gradient(90deg,#b71c1c 0 10px,#e53935 10px 18px,#c62828 18px 26px)", boxShadow:`${side === "left" ? 6 : -6}px 0 12px rgba(0,0,0,.35)`,
    borderRadius: side === "left" ? "0 0 60% 0" : "0 0 0 60%" });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {phase === "play" && round && <Prompt w={round.target} onClick={() => ui.say(round.target)} />}
      <div ref={stage} style={{ position:"relative", height:stageH, borderRadius:24, overflow:"clip", userSelect:"none",
        background:"radial-gradient(ellipse at 50% 30%, #4a2a7a 0%, #2a174a 55%, #170c2c 100%)" }}>
        {/* ไฟดาวบนฉากหลัง */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(#fff6 1px, transparent 1.5px)", backgroundSize:"26px 26px", opacity:.6 }} />
        {/* พื้นเวที */}
        <div style={{ position:"absolute", left:0, right:0, bottom:0, height:"16%", background:"repeating-linear-gradient(90deg,#a0642f 0 46px,#8a5326 46px 48px)", boxShadow:"inset 0 10px 0 #c7843f" }} />
        {/* ม่าน + ระบาย */}
        <div style={curtain("left")} /><div style={curtain("right")} />
        <div style={{ position:"absolute", left:0, right:0, top:0, height:"7%", zIndex:4, background:"#b71c1c",
          WebkitMaskImage:"radial-gradient(circle at 50% 0, #000 70%, transparent 71%)", maskImage:"radial-gradient(circle at 50% 0, #000 70%, transparent 71%)", WebkitMaskSize:"40px 100%", maskSize:"40px 100%" }} />
        <div style={{ position:"absolute", left:0, right:0, top:0, height:"3.5%", zIndex:4, background:"linear-gradient(180deg,#ffd54f,#ffb300)" }} />

        {phase === "play" && round && <>
          <Hud time={left} score={score} onStop={finish} tokens={ui.tokens} />
          <div style={{ position:"absolute", left:"10%", right:"10%", top:"12%", bottom:"5%", display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr", gap:"4%", zIndex:2 }}>
            {round.actors.map((a, i) => <button key={a.w.id} onClick={e => tap(a, e)} aria-label={a.w.word} style={{ position:"relative", border:"none", padding:0, cursor:"pointer", borderRadius:24,
              background: a.state === "ok" ? "radial-gradient(ellipse at 50% 85%, #fff59d 0%, #ffe08288 40%, transparent 70%)" : "radial-gradient(ellipse at 50% 85%, #fffde788 0%, #fff3e033 40%, transparent 70%)",
              outline: a.state === "ok" ? "4px solid #58CC02" : a.state === "no" ? "4px solid #FF4B4B" : "none", outlineOffset:-4, opacity: a.state === "no" ? .55 : 1,
              animation: a.state === "no" ? "vp2dShake .35s" : a.state === "ok" ? "vp2dPop .45s" : "none" }}>
              {/* ลำแสงสปอตไลต์ */}
              <div style={{ position:"absolute", left:"15%", right:"15%", top:0, bottom:"8%", background:"linear-gradient(180deg, rgba(255,255,220,.0), rgba(255,255,220,.22))", clipPath:"polygon(40% 0, 60% 0, 100% 100%, 0 100%)" }} />
              {/* แท่นยืน */}
              <div style={{ position:"absolute", left:"14%", right:"14%", bottom:"4%", height:"12%", borderRadius:"50%", background:"linear-gradient(180deg,#ffca28,#ff8f00)", boxShadow:"0 4px 0 #c56000" }} />
              <div style={{ position:"absolute", left:"50%", bottom:"9%", width:"72%", aspectRatio:"1", transform:"translateX(-50%)", animation:`vp2dBob ${1.8 + i * 0.3}s ease-in-out infinite` }}>
                <Fl e={a.w.emoji} size="100%" style={{ width:"100%", height:"100%", filter:"drop-shadow(0 8px 6px rgba(0,0,0,.35))" }} alt={a.w.word} />
              </div>
            </button>)}
          </div>
          <FloatText items={floats} />
        </>}
        {phase === "start" && <StartCard title="Who Is Doing It?" sub="บนเวทีมีนักแสดง 4 ตัว ฟังคำแล้วแตะตัวที่กำลังทำท่านั้น · เล่น 5 นาที" onStart={start} tokens={ui.tokens} />}
        {phase === "end" && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Fl e="🏆" size={140} style={{ animation:"vp2dPop .6s" }} /></div>}
      </div>
    </div>
  );
}

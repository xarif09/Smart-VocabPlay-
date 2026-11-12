// Penalty Kick 2D — สนามฟุตบอลการ์ตูน ฟังคำแล้วแตะรูปในประตู ลูกบอลพุ่งไป ผู้รักษาประตูพุ่งรับ · ถูก = เข้าประตู · เล่น 5 นาที
import { useEffect, useRef, useState } from "react";
import { Fl, WordCard, Hud, FloatText, pickChoices, shuffle } from "./kit.jsx";
import { StartCard, RUNNERS } from "./Runner2D.jsx";

const SESSION = 300;
const SHIRTS = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#8e24aa", "#fb8c00"];

export default function Penalty2D({ words, track, sfx, Prompt, ui }) {
  const [phase, setPhase] = useState("start");
  const [hero, setHero] = useState(RUNNERS[0]);
  const [round, setRound] = useState(null);      // { target, cards:[{w,url,state}], kicked, result }
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SESSION);
  const [floats, setFloats] = useState([]);
  const S = useRef({ correct: 0, total: 0, score: 0, over: false, t0: 0 });
  const queue = useRef([]); const stage = useRef(null); const timers = useRef([]);
  const [box, setBox] = useState({ W: 360, H: 480 });
  useEffect(() => { const el = stage.current; if (!el) return; const ro = new ResizeObserver(() => setBox({ W: el.clientWidth, H: el.clientHeight })); ro.observe(el); return () => ro.disconnect(); }, []);
  const urlOf = w => ui.imageUrl(w);
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const nextWord = () => { if (!queue.current.length) queue.current = shuffle(words.filter(w => urlOf(w) || w.emoji)); return queue.current.pop() || words[0]; };
  const addFloat = (text, x, y, good) => { const id = Math.random(); setFloats(f => [...f, { id, text, x, y, good }]); later(() => setFloats(f => f.filter(z => z.id !== id)), 950); };
  const newRound = speakNow => {
    const target = nextWord(); const others = pickChoices(words, target, 2, urlOf);
    const cards = shuffle([target, ...others]).map(w => ({ w, url: urlOf(w), state: null }));
    setRound({ target, cards, kicked: null, keeper: 1, result: null }); if (speakNow) ui.say(target);
  };
  const start = () => { ui.unlock && ui.unlock(); sfx.tap(); S.current = { correct: 0, total: 0, score: 0, over: false, t0: performance.now() }; setScore(0); setLeft(SESSION); queue.current = []; setPhase("play"); newRound(true); };
  const finish = () => { const s = S.current; if (s.over) return; s.over = true; setPhase("end"); sfx.win();
    later(() => track.finish(s.correct, Math.max(s.total, 1), { label: `ยิงเข้า ${s.correct}/${s.total} ลูก · ⭐ ${s.score} คะแนน` }), 600); };

  useEffect(() => { if (phase !== "play") return;
    const id = setInterval(() => { const l = Math.max(0, SESSION - (performance.now() - S.current.t0) / 1000); setLeft(l); if (l <= 0) { clearInterval(id); finish(); } }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const kick = (i, e) => {
    if (!round || round.kicked !== null || S.current.over) return;
    const card = round.cards[i]; const ok = card.w.id === round.target.id;
    const r = e.currentTarget.getBoundingClientRect(), sr = stage.current.getBoundingClientRect();
    const s = S.current; s.total += 1;
    // ผู้รักษาประตู: ถ้าถูกพุ่งไปอีกฝั่ง · ถ้าผิดพุ่งมารับ
    const keeper = ok ? (i === 0 ? 2 : i === 2 ? 0 : (Math.random() < 0.5 ? 0 : 2)) : i;
    sfx.tap();
    setRound(rd => ({ ...rd, kicked: i, keeper }));
    if (ok) { s.correct += 1; s.score += 10; track.correct(card.w, e); } else { s.score = Math.max(0, s.score - 5); track.wrong(round.target); }
    later(() => {
      setScore(s.score);
      setRound(rd => ({ ...rd, result: ok ? "goal" : "save", cards: rd.cards.map((c, j) => j === i ? { ...c, state: ok ? "ok" : "no" } : c) }));
      if (ok) { sfx.win(); ui.say(card.w); addFloat("+10", r.left - sr.left + r.width / 2 - 20, r.top - sr.top, true); }
      else { sfx.bad(); addFloat("-5", r.left - sr.left + r.width / 2 - 14, r.top - sr.top, false); }
    }, 520);
    later(() => { if (!S.current.over) newRound(true); }, ok ? 2300 : 2000);
  };

  const stageH = "max(360px, min(calc(100dvh - 270px), 640px))";
  const cw = Math.min(box.W * 0.305, box.H * 0.27 * 0.75, 160), cardW = cw;   // การ์ดสูงไม่เกิน 27% ของเวที
  const cardTop = box.H * 0.22, keeperTop = cardTop + cw * 4 / 3 + box.H * 0.015, kS = Math.min(box.W * 0.22, box.H * 0.17);
  const kicked = round?.kicked;
  // ตำแหน่งการ์ด (ซ้าย/กลาง/ขวา) เป็น % ของความกว้าง
  const colX = [18, 50, 82];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {phase === "play" && round && <Prompt w={round.target} onClick={() => ui.say(round.target)} />}
      <div ref={stage} style={{ position:"relative", height:stageH, borderRadius:24, overflow:"clip", userSelect:"none",
        background:"linear-gradient(180deg,#1b2a6b 0%,#2f4bb3 22%,#4caf50 22.1%,#43a047 100%)" }}>
        {/* อัฒจันทร์ + คนดู */}
        <div style={{ position:"absolute", left:0, right:0, top:0, height:"22%", background:"repeating-linear-gradient(180deg,#26357d 0 14%,#1f2c69 14% 16%)" }}>
          <div style={{ position:"absolute", inset:"8% 0 0 0", backgroundImage:`radial-gradient(circle at 50% 40%, #ffcc80 0 22%, transparent 24%), radial-gradient(circle at 50% 95%, ${SHIRTS[0]} 0 34%, transparent 36%),
            radial-gradient(circle at 50% 40%, #8d6e63 0 22%, transparent 24%), radial-gradient(circle at 50% 95%, ${SHIRTS[1]} 0 34%, transparent 36%)`,
            backgroundSize:"22px 22px, 22px 22px, 22px 22px, 22px 22px", backgroundPosition:"0 0, 0 0, 11px 11px, 11px 11px", animation: round?.result === "goal" ? "vp2dBob .35s ease-in-out 4" : "none" }} />
          {/* ไฟสนาม */}
          {[8, 92].map(x => <div key={x} style={{ position:"absolute", left:`${x}%`, top:"4%", width:26, height:14, marginLeft:-13, borderRadius:4, background:"#fffde7", boxShadow:"0 0 24px 10px rgba(255,253,231,.7)" }} />)}
        </div>
        {/* ลายหญ้า */}
        <div style={{ position:"absolute", left:0, right:0, top:"22%", bottom:0, background:"repeating-linear-gradient(180deg, rgba(255,255,255,.07) 0 9%, transparent 9% 18%)" }} />
        {/* ประตู */}
        <div style={{ position:"absolute", left:"3%", right:"3%", top:"18%", height: Math.max(box.H * 0.52, keeperTop + kS - box.H * 0.18 + 6), borderTop:"8px solid #fff", borderLeft:"8px solid #fff", borderRight:"8px solid #fff", borderRadius:"6px 6px 0 0",
          background:"repeating-linear-gradient(45deg, rgba(255,255,255,.28) 0 2px, transparent 2px 16px), repeating-linear-gradient(-45deg, rgba(255,255,255,.28) 0 2px, transparent 2px 16px), rgba(0,0,0,.08)",
          boxShadow:"0 6px 0 rgba(0,0,0,.15)" }} />
        {/* เส้นเขตโทษ + จุดโทษ */}
        <div style={{ position:"absolute", left:"-10%", right:"-10%", top:"70%", height:"40%", border:"4px solid rgba(255,255,255,.7)", borderBottom:"none", borderRadius:"50% 50% 0 0 / 30% 30% 0 0" }} />
        <div style={{ position:"absolute", left:"50%", top:"88%", width:14, height:8, marginLeft:-7, borderRadius:"50%", background:"rgba(255,255,255,.85)" }} />

        {phase === "play" && round && <>
          <Hud time={left} score={score} onStop={finish} tokens={ui.tokens} />
          {round.cards.map((c, i) => <WordCard key={c.w.id + i} w={c.w} url={c.url} h="auto" state={c.state} onClick={e => kick(i, e)}
            style={{ position:"absolute", width:cardW, height:"auto", left:`${colX[i]}%`, top:cardTop, transform:"translateX(-50%)", opacity: kicked !== null && kicked !== i ? .55 : 1, transition:"opacity .3s" }} />)}
          {/* ผู้รักษาประตู */}
          <div style={{ position:"absolute", left:`${colX[round.kicked === null ? 1 : round.keeper]}%`, top:keeperTop, width:kS, height:kS, marginLeft:-kS / 2,
            transition:"left .45s cubic-bezier(.3,1.4,.5,1), transform .45s", transform: round.kicked === null ? "none" : `rotate(${round.keeper < 1 ? -70 : round.keeper > 1 ? 70 : 0}deg)`,
            animation: round.kicked === null ? "vp2dBob 1.2s ease-in-out infinite" : "none" }}>
            <Fl e="🧍" size="100%" style={{ width:"100%", height:"100%" }} />
            <div style={{ position:"absolute", left:"-4%", top:"26%" }}><Fl e="🧤" size={34} /></div>
            <div style={{ position:"absolute", right:"-4%", top:"26%" }}><Fl e="🧤" size={34} flip /></div>
          </div>
          {/* ลูกบอล */}
          <div style={{ position:"absolute", width:"13%", aspectRatio:"1", marginLeft:"-6.5%",
            left: `${round.kicked === null ? 50 : round.result === "save" || (round.kicked !== null && round.keeper === round.kicked) ? colX[round.kicked] : colX[round.kicked]}%`,
            top: round.kicked === null ? "80%" : round.keeper === round.kicked ? keeperTop + kS * 0.2 : cardTop + cw * 0.5,
            transform: round.kicked === null ? "none" : `scale(.6) rotate(${round.kicked * 240 + 360}deg)`,
            transition: round.kicked === null ? "none" : "left .5s cubic-bezier(.2,.7,.4,1), top .5s cubic-bezier(.3,-0.4,.5,1), transform .5s", zIndex:4 }}>
            <Fl e="⚽" size="100%" style={{ width:"100%", height:"100%" }} />
          </div>
          {/* นักเตะ */}
          <div style={{ position:"absolute", left:"30%", top:"74%", width:"17%", aspectRatio:"1", transform: round.kicked !== null ? "rotate(-12deg) translateX(14%)" : "none", transition:"transform .2s" }}>
            <Fl e={hero.e} size="100%" style={{ width:"100%", height:"100%" }} flip={!hero.noFlip} />
          </div>
          {round.result && <div style={{ position:"absolute", left:0, right:0, top:"6%", textAlign:"center", zIndex:6, fontWeight:900, fontSize:40, letterSpacing:1,
            color: round.result === "goal" ? "#ffeb3b" : "#fff", textShadow:"0 4px 0 rgba(0,0,0,.35)", animation:"vp2dPop .4s" }}>{round.result === "goal" ? "GOAL! ⚽" : "เซฟ! 🧤"}</div>}
          <FloatText items={floats} />
        </>}
        {phase === "start" && <StartCard title="Penalty Kick" sub="ฟังคำ แล้วแตะรูปในประตูเพื่อยิง · ยิงถูกรูป = เข้าประตู! · เล่น 5 นาที" options={RUNNERS} value={hero}
          onPick={h => { setHero(h); sfx.tap(); }} onStart={start} tokens={ui.tokens} pickLabel="เลือกนักเตะ" />}
        {phase === "end" && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Fl e="🏆" size={140} style={{ animation:"vp2dPop .6s" }} /></div>}
      </div>
    </div>
  );
}

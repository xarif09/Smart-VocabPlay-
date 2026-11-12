// ชุดภาพ/ฉากสำหรับเกม 2 มิติ (แทนเกม 3 มิติ v3.21)
// ตัวการ์ตูน/สิ่งของ = Fluent Emoji 3D ของ Microsoft (MIT) แปลงเป็น WebP 256px ใน public/fluent/<codepoints>.webp
// ฉากหลัง = SVG วาดเป็นชั้นๆ (ท้องฟ้าไล่สี แสงแดด เมฆ ภูเขาไกล เนิน พื้น) ตามธีมของหมวด
import { useEffect, useRef } from "react";
import FLUENT from "../fluentList.json";

const BASE = import.meta.env.BASE_URL;
const HAVE = new Set(FLUENT);
export const cpOf = e => [...(e || "").replace(/️/g, "")].map(c => c.codePointAt(0).toString(16)).join("-");
// URL ของภาพการ์ตูนจากอีโมจิ (ตัดโทนสีผิวทิ้งถ้าไม่มีไฟล์) · ไม่มี → null
export function fl(e) {
  if (!e) return null;
  let cp = cpOf(e); if (HAVE.has(cp)) return `${BASE}fluent/${cp}.webp`;
  cp = cpOf(e.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")); if (HAVE.has(cp)) return `${BASE}fluent/${cp}.webp`;
  return null;
}
export function Fl({ e, size = 64, flip, style, alt = "", ...rest }) {
  const url = fl(e);
  const st = { width:size, height:size, objectFit:"contain", display:"block", pointerEvents:"none", userSelect:"none", transform: flip ? "scaleX(-1)" : undefined, ...style };
  return url ? <img src={url} alt={alt} draggable={false} style={st} {...rest} />
    : <span style={{ ...st, fontSize:size * 0.8, lineHeight:`${size}px`, textAlign:"center" }} {...rest}>{e}</span>;
}

// ── ธีมฉากตามหมวด ───────────────────────────────────────
const CAT_THEME = { animals:"jungle", nature:"jungle", fruits:"candy", food:"candy", colors:"candy", vegetables:"farm", vehicles:"city", places:"city", jobs:"city",
  weather:"snow", time:"snow", technology:"space", music:"space", shapes:"space", numbers:"space", opposites:"space", countries:"beach", school:"park",
  sports:"park", toys:"park", family:"park", feelings:"park", body:"park", clothes:"park", home:"park", actions:"park" };
export const themeOf = catId => THEMES[CAT_THEME[catId] || "park"];

export const THEMES = {
  park:   { sky:["#7cc8ff","#d9f1ff"], sun:"#fff6c9", far:"#9fd3a8", mid:"#6cc070", near:"#4caf50", ground:"#7a5230", groundTop:"#5fbf3f", dark:false,
            props:["🌳","🌷","🏡","🌻","🌳","🌼","🌲","🍄"], sky2:["☁️","☁️"] },
  jungle: { sky:["#6fc7ff","#e3f7ff"], sun:"#fff2b3", far:"#7cc6a0", mid:"#3fa564", near:"#2f8f4e", ground:"#6b4423", groundTop:"#3aa53a", dark:false,
            props:["🌴","🌿","🌳","🦋","🌺","🌴","🪨","🍄"], sky2:["☁️","🐦"] },
  farm:   { sky:["#86cfff","#fff4d6"], sun:"#fff2b3", far:"#b9dc8a", mid:"#8cc657", near:"#6fb043", ground:"#8a5a2b", groundTop:"#7cc04a", dark:false,
            props:["🌾","🏡","🌻","🌳","🌾","🪵","🌼","🌳"], sky2:["☁️","🐦"] },
  city:   { sky:["#8ccfff","#ffe9d2"], sun:"#fff0c2", far:"#a9bfd8", mid:"#7f9cc0", near:"#8bc34a", ground:"#59616e", groundTop:"#9aa3ad", dark:false,
            props:["🏢","🌳","🏫","🚦","🏢","🌳","🏰","🌳"], sky2:["☁️","🎈"], skyline:true },
  snow:   { sky:["#a8dcff","#f2fbff"], sun:"#ffffff", far:"#d7e9f7", mid:"#c3dcf0", near:"#eef6fd", ground:"#a7c7e3", groundTop:"#ffffff", dark:false,
            props:["🌲","⛄","🌲","🏔️","🌲","❄️","🌲","⛄"], sky2:["☁️","❄️"], snow:true },
  candy:  { sky:["#ffb3d9","#fff0f7"], sun:"#fff6c9", far:"#ffd0e8", mid:"#ff9ccf", near:"#ff7ab8", ground:"#b06aa8", groundTop:"#ffd1ec", dark:false,
            props:["🍭","🍬","🧁","🍩","🍭","🍦","🍬","🎈"], sky2:["☁️","🌈"] },
  space:  { sky:["#140a3a","#3b2a87"], sun:"#e8e3ff", far:"#3d2f8f", mid:"#5a3fb0", near:"#7a5bd6", ground:"#3a2a78", groundTop:"#9b84ff", dark:true,
            props:["🪐","🚀","🌟","🛸","🪐","☄️","🌙","🌟"], sky2:["⭐","✨"], stars:true },
  beach:  { sky:["#6fd0ff","#fff3d1"], sun:"#fff2b3", far:"#43b6e8", mid:"#2aa1d8", near:"#f4d9a0", ground:"#e2bd78", groundTop:"#f7e3b5", dark:false,
            props:["🌴","⛱️","🐚","🦀","🌴","🏝️","🐚","🌴"], sky2:["☁️","🐦"], sea:true },
};

Object.entries(THEMES).forEach(([k, t]) => { t.id = k; });

// เนินเขาแบบ path วนซ้ำได้ (ความกว้าง 800 ต่อหนึ่งช่วง)
const hills = (y, amp, n, seed) => {
  let d = `M0 ${y}`; const w = 800 / n;
  for (let i = 0; i < n; i++) { const a = amp * (0.7 + 0.3 * Math.sin(seed + i * 2.1)); d += ` Q${i * w + w / 2} ${y - a} ${(i + 1) * w} ${y}`; }
  return d + ` L800 400 L0 400 Z`;
};
const mountains = (y, amp, n, seed) => {
  let d = `M0 ${y}`; const w = 800 / n;
  for (let i = 0; i < n; i++) { const a = amp * (0.6 + 0.4 * Math.abs(Math.sin(seed + i * 1.7))); d += ` L${i * w + w / 2} ${y - a} L${(i + 1) * w} ${y}`; }
  return d + ` L800 400 L0 400 Z`;
};
const Skyline = ({ c }) => <g fill={c}>{[0,60,95,150,210,250,320,370,430,470,540,600,650,700,750].map((x, i) => {
  const h = 60 + ((i * 37) % 70); return <g key={i}><rect x={x} y={300 - h} width={40 + (i % 3) * 10} height={h} rx="3" />
    {Array.from({ length: Math.floor(h / 18) }).map((_, j) => <rect key={j} x={x + 8} y={300 - h + 8 + j * 18} width="6" height="7" fill="#fff8d6" opacity=".55" />)}</g>; })}</g>;

// ชั้นฉากหนึ่งชั้น กว้าง 2 ช่วง (เลื่อนวนได้)
function Strip({ children }) {
  return <svg viewBox="0 0 1600 400" preserveAspectRatio="none" style={{ position:"absolute", left:0, bottom:0, width:"200%", height:"100%" }}>
    <g>{children}</g><g transform="translate(800 0)">{children}</g></svg>;
}

/**
 * ฉากหลัง 2 มิติ · scrollRef.current = ระยะที่เลื่อนไป (px) → แต่ละชั้นเลื่อนช้าเร็วต่างกัน (parallax)
 * groundAt = ความสูงพื้น (สัดส่วนจากล่าง) · props = แสดงตัวประกอบบนเนิน
 */
export function Scene({ theme, scrollRef, groundAt = 0.2, props = true, children, style }) {
  const L = useRef([]);
  useEffect(() => {
    if (!scrollRef) return;
    let raf; const speeds = [0.05, 0.15, 0.35, 0.7, 1];
    const tick = () => { const s = scrollRef.current || 0;
      L.current.forEach((el, i) => { if (el) { const w = el.offsetWidth / 2 || 1; el.style.transform = `translate3d(${-((s * speeds[i]) % w)}px,0,0)`; } });
      raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [scrollRef]);
  const t = theme;
  const lay = (i, h, content) => <div ref={el => (L.current[i] = el)} style={{ position:"absolute", left:0, bottom:0, width:"200%", height:h, willChange:"transform" }}>{content}</div>;
  return (
    <div style={{ position:"relative", overflow:"clip", background:`linear-gradient(180deg, ${t.sky[0]}, ${t.sky[1]})`, ...style }}>
      {/* ดวงอาทิตย์/ดวงจันทร์ + แสงเรือง */}
      <div style={{ position:"absolute", right:"12%", top:"8%", width:"16%", aspectRatio:"1", borderRadius:"50%", background:`radial-gradient(circle, ${t.sun} 0 38%, ${t.sun}88 45%, transparent 70%)` }} />
      {t.stars && <svg viewBox="0 0 400 300" preserveAspectRatio="none" style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
        {Array.from({ length: 60 }).map((_, i) => <circle key={i} cx={(i * 97) % 400} cy={(i * 53) % 200} r={(i % 3) * 0.5 + 0.6} fill="#fff" opacity={0.4 + (i % 5) * 0.12}><animate attributeName="opacity" values="1;.3;1" dur={`${2 + (i % 4)}s`} repeatCount="indefinite" /></circle>)}</svg>}
      {/* เมฆ/นกลอย */}
      {lay(0, "100%", <div style={{ position:"absolute", inset:0 }}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="vp2d-float" style={{ position:"absolute", left:`${i * 16 + 3}%`, top:`${6 + (i % 3) * 9}%`, animationDelay:`${i * 0.7}s`, opacity: t.dark ? 0.9 : 0.95 }}>
        <Fl e={t.sky2[i % 2]} size={i % 2 ? 34 : 64} /></div>)}</div>)}
      {/* ภูเขาไกล */}
      {lay(1, "70%", <Strip>{t.skyline ? <Skyline c={t.far} /> : <path d={mountains(300, 150, 5, 1)} fill={t.far} />}<path d={mountains(330, 90, 7, 4)} fill={t.far} opacity=".55" /></Strip>)}
      {t.sea && <div style={{ position:"absolute", left:0, right:0, bottom:`${groundAt * 100 + 6}%`, height:"16%", background:`linear-gradient(180deg, ${t.far}, ${t.mid})` }}>
        <svg viewBox="0 0 400 20" preserveAspectRatio="none" style={{ position:"absolute", top:-6, width:"100%", height:12 }}><path d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 T250 10 T300 10 T350 10 T400 10 V20 H0Z" fill={t.far} /></svg></div>}
      {/* เนินกลาง + ตัวประกอบ */}
      {lay(2, `${groundAt * 100 + 34}%`, <><Strip><path d={hills(260, 90, 4, 2)} fill={t.mid} /></Strip>
        {props && <div style={{ position:"absolute", inset:0 }}>{t.props.map((e, i) => <div key={i} style={{ position:"absolute", left:`${i * 12.5 + 2}%`, bottom:`${42 + ((i * 7) % 14)}%` }}><Fl e={e} size={44 + ((i * 13) % 26)} /></div>)}</div>}</>)}
      {/* เนินใกล้ */}
      {lay(3, `${groundAt * 100 + 14}%`, <Strip><path d={hills(150, 60, 6, 5)} fill={t.near} /></Strip>)}
      {/* พื้น */}
      {lay(4, `${groundAt * 100}%`, <Strip><rect x="0" y="0" width="800" height="400" fill={t.ground} /><rect x="0" y="0" width="800" height="70" fill={t.groundTop} />
        {Array.from({ length: 16 }).map((_, i) => <ellipse key={i} cx={i * 50 + 25} cy={140 + (i % 3) * 70} rx="14" ry="5" fill="#000" opacity=".08" />)}
        {Array.from({ length: 20 }).map((_, i) => <path key={"g" + i} d={`M${i * 40 + 10} 6 q4 -16 8 0 q4 -12 8 0`} fill={t.groundTop} stroke={t.near} strokeWidth="2" />)}</Strip>)}
      {t.snow && <div className="vp2d-snow" style={{ position:"absolute", inset:0, pointerEvents:"none" }} />}
      {children}
      <style>{`
        @keyframes vp2dFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .vp2d-float{animation:vp2dFloat 4s ease-in-out infinite}
        @keyframes vp2dSnow{from{background-position:0 0,0 0}to{background-position:40px 400px,-30px 300px}}
        .vp2d-snow{background-image:radial-gradient(#fff 1.5px,transparent 2px),radial-gradient(#fff 1px,transparent 1.5px);background-size:60px 60px,40px 40px;animation:vp2dSnow 8s linear infinite;opacity:.8}
        @keyframes vp2dBob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6px) rotate(2deg)}}
        @keyframes vp2dPop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
        @keyframes vp2dShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
        @keyframes vp2dRise{from{transform:translateY(0);opacity:1}to{transform:translateY(-60px);opacity:0}}
      `}</style>
    </div>
  );
}

// ป้ายรูปคำศัพท์ 3:4 (รูปถ่าย → ภาพการ์ตูน → อีโมจิ)
export function WordCard({ w, url, h = 120, state, style, onClick }) {
  const ring = state === "ok" ? "#58CC02" : state === "no" ? "#FF4B4B" : "#ffffff";
  return (
    <button onClick={onClick} aria-label={w?.word} style={{ height:h, aspectRatio:"3/4", padding:0, border:`5px solid ${ring}`, borderRadius:16, overflow:"hidden", background:"#fff",
      boxShadow:"0 6px 0 rgba(0,0,0,.18), 0 10px 22px rgba(0,0,0,.18)", cursor:"pointer", position:"relative", animation: state === "no" ? "vp2dShake .35s" : undefined, ...style }}>
      {url ? <img src={url} alt={w?.word || ""} draggable={false} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 42%", display:"block" }} />
        : <span style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%", background:"linear-gradient(135deg,#fff4d6,#e3f2ff)" }}><Fl e={w?.emoji} size={h * 0.55} alt={w?.word || ""} /></span>}
    </button>
  );
}

// เวลา/คะแนนลอย
export function Hud({ time, score, onStop, tokens }) {
  const mm = Math.floor(time / 60), ss = String(Math.floor(time % 60)).padStart(2, "0");
  const pill = { display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:999, background:"rgba(255,255,255,.88)", fontWeight:800, fontSize:16, color:"#2a2140", boxShadow:"0 3px 0 rgba(0,0,0,.12)" };
  return <div style={{ position:"absolute", top:8, left:8, right:8, display:"flex", justifyContent:"space-between", alignItems:"center", zIndex:5, pointerEvents:"none" }}>
    <span style={pill}>⏱ {mm}:{ss}</span><span style={pill}>⭐ {score}</span>
    {onStop && <button onClick={onStop} style={{ ...pill, pointerEvents:"auto", border:"none", minHeight:44, cursor:"pointer", background:tokens?.card || "#fff" }}>⏹ จบ</button>}
  </div>;
}

// ลอยข้อความ +10 / -5
export function FloatText({ items }) {
  return items.map(f => <div key={f.id} style={{ position:"absolute", left:f.x, top:f.y, zIndex:6, fontWeight:900, fontSize:26, color: f.good ? "#2e9d00" : "#e23b3b",
    textShadow:"0 2px 0 #fff, 0 0 8px #fff", animation:"vp2dRise .9s ease-out forwards", pointerEvents:"none" }}>{f.text}</div>);
}

// หยิบคำที่มีรูป (ตัวเลือก) โดยไม่ซ้ำเป้า
export function pickChoices(words, target, n, urlOf) {
  const pool = words.filter(w => w.id !== target.id && w.word !== target.word);
  const withPic = pool.filter(w => urlOf(w)); const src = withPic.length >= n ? withPic : pool;
  const out = []; const used = new Set();
  while (out.length < n && used.size < src.length) { const w = src[Math.floor(Math.random() * src.length)]; if (!used.has(w.id)) { used.add(w.id); out.push(w); } }
  return out;
}
export const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

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

// ═══════════════════════════════════════════════════════
// Pet — ตัวละครเพื่อนคู่หูวาดด้วย SVG เคลื่อนไหวได้ (ไม่ใช้ไฟล์ภาพ)
//  4 ตัว: cat / dog / bunny / dragon · 4 ร่าง: ไข่ → เด็ก → โต → เต็มวัย
//  อารมณ์ (mood): idle · happy · sad · sleepy · excited · talk
//  หายใจ กระพริบตา หูขยับ หางแกว่ง · ร่างโตขึ้นมีมงกุฎ/ปีก/ดาว
// ═══════════════════════════════════════════════════════
import { useEffect, useState } from "react";

const SKIN = {
  cat:    { body:"#f8b26a", belly:"#fde7c8", ear:"#f7a1b5", line:"#8a4b1f", accent:"#f97316" },
  dog:    { body:"#c98a52", belly:"#f3dcc0", ear:"#8b5a2b", line:"#5c3a1a", accent:"#3b82f6" },
  bunny:  { body:"#f5f0ff", belly:"#ffe4f1", ear:"#ffb3d1", line:"#6b5b8a", accent:"#ec4899" },
  dragon: { body:"#5eead4", belly:"#ccfbf1", ear:"#2dd4bf", line:"#0f766e", accent:"#f43f5e" },
};

// ตา: ปกติ / ยิ้มหยี / เศร้า / หลับ / ตื่นเต้นวิ้ง
function Eyes({ mood, blink, c }) {
  const x1 = 38, x2 = 62, y = 46;
  if (mood === "sleepy" || blink) return <g stroke={c.line} strokeWidth="3" strokeLinecap="round" fill="none"><path d={`M${x1-6} ${y} q6 4 12 0`} /><path d={`M${x2-6} ${y} q6 4 12 0`} /></g>;
  if (mood === "happy" || mood === "excited") return <g stroke={c.line} strokeWidth="3.2" strokeLinecap="round" fill="none"><path d={`M${x1-6} ${y+2} q6 -7 12 0`} /><path d={`M${x2-6} ${y+2} q6 -7 12 0`} /></g>;
  if (mood === "sad") return <g><circle cx={x1} cy={y+1} r="4.5" fill={c.line} /><circle cx={x2} cy={y+1} r="4.5" fill={c.line} /><path d={`M${x1-7} ${y-6} l10 3`} stroke={c.line} strokeWidth="2.5" strokeLinecap="round" /><path d={`M${x2+7} ${y-6} l-10 3`} stroke={c.line} strokeWidth="2.5" strokeLinecap="round" /><circle cx={x1+6} cy={y+9} r="2" fill="#60a5fa" /></g>;
  return <g><ellipse cx={x1} cy={y} rx="4.6" ry="5.4" fill={c.line} /><ellipse cx={x2} cy={y} rx="4.6" ry="5.4" fill={c.line} /><circle cx={x1+1.6} cy={y-1.8} r="1.6" fill="#fff" /><circle cx={x2+1.6} cy={y-1.8} r="1.6" fill="#fff" /></g>;
}
function Mouth({ mood, c, talk }) {
  if (mood === "sad") return <path d="M44 62 q6 -5 12 0" stroke={c.line} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  if (mood === "sleepy") return <ellipse cx="50" cy="61" rx="3" ry="2" fill={c.line} />;
  if (talk || mood === "excited") return <ellipse cx="50" cy="61" rx="6" ry="4.5" fill="#7c2d12"><animate attributeName="ry" values="4.5;1.5;4.5" dur="0.35s" repeatCount="indefinite" /></ellipse>;
  if (mood === "happy") return <path d="M40 58 q10 10 20 0" stroke={c.line} strokeWidth="2.8" fill="#fb7185" strokeLinecap="round" />;
  return <path d="M44 59 q6 5 12 0" stroke={c.line} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
}
function Cheeks() { return <g opacity=".55"><ellipse cx="31" cy="55" rx="5" ry="3" fill="#fb7185" /><ellipse cx="69" cy="55" rx="5" ry="3" fill="#fb7185" /></g>; }

function Ears({ kind, c, wiggle }) {
  const anim = wiggle ? { style:{ animation:"petEar 2.6s ease-in-out infinite", transformOrigin:"50px 30px" } } : {};
  if (kind === "cat") return <g {...anim}><path d="M26 28 L22 6 L42 20 Z" fill={c.body} stroke={c.line} strokeWidth="2" strokeLinejoin="round" /><path d="M28 24 L26 12 L38 20 Z" fill={c.ear} /><path d="M74 28 L78 6 L58 20 Z" fill={c.body} stroke={c.line} strokeWidth="2" strokeLinejoin="round" /><path d="M72 24 L74 12 L62 20 Z" fill={c.ear} /></g>;
  if (kind === "dog") return <g {...anim}><ellipse cx="22" cy="34" rx="9" ry="17" fill={c.ear} stroke={c.line} strokeWidth="2" /><ellipse cx="78" cy="34" rx="9" ry="17" fill={c.ear} stroke={c.line} strokeWidth="2" /></g>;
  if (kind === "bunny") return <g {...anim}><ellipse cx="38" cy="8" rx="8" ry="20" fill={c.body} stroke={c.line} strokeWidth="2" /><ellipse cx="38" cy="9" rx="4" ry="14" fill={c.ear} /><ellipse cx="62" cy="8" rx="8" ry="20" fill={c.body} stroke={c.line} strokeWidth="2" /><ellipse cx="62" cy="9" rx="4" ry="14" fill={c.ear} /></g>;
  return <g {...anim}><path d="M30 24 L24 4 L40 16 Z" fill={c.ear} stroke={c.line} strokeWidth="2" strokeLinejoin="round" /><path d="M70 24 L76 4 L60 16 Z" fill={c.ear} stroke={c.line} strokeWidth="2" strokeLinejoin="round" /><path d="M50 12 L46 2 L54 2 Z" fill={c.accent} /></g>;
}
function Extras({ kind, stage, c }) {
  return <g>
    {kind === "dragon" && stage >= 2 && <g style={{ animation:"petWing 1.8s ease-in-out infinite", transformOrigin:"50px 60px" }}><path d="M12 62 q-14 -22 6 -28 q-2 14 8 20 Z" fill={c.ear} stroke={c.line} strokeWidth="2" /><path d="M88 62 q14 -22 -6 -28 q2 14 -8 20 Z" fill={c.ear} stroke={c.line} strokeWidth="2" /></g>}
    {kind === "cat" && stage >= 1 && <path d="M78 78 q18 -4 14 -22" stroke={c.body} strokeWidth="7" fill="none" strokeLinecap="round" style={{ animation:"petTail 1.6s ease-in-out infinite", transformOrigin:"78px 78px" }} />}
    {kind === "dog" && stage >= 1 && <path d="M80 76 q14 -10 10 -22" stroke={c.body} strokeWidth="7" fill="none" strokeLinecap="round" style={{ animation:"petTail .7s ease-in-out infinite", transformOrigin:"80px 76px" }} />}
    {kind === "bunny" && stage >= 1 && <circle cx="84" cy="80" r="7" fill="#fff" stroke={c.line} strokeWidth="2" />}
    {stage >= 3 && <g style={{ animation:"petFloat 2.4s ease-in-out infinite" }}><path d="M36 -2 l5 -10 l5 6 l4 -8 l4 8 l5 -6 l5 10 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="45" cy="-6" r="1.6" fill="#ef4444" /><circle cx="55" cy="-6" r="1.6" fill="#3b82f6" /></g>}
    {stage === 2 && <text x="84" y="22" fontSize="12" style={{ animation:"petFloat 2s ease-in-out infinite" }}>✨</text>}
  </g>;
}

export default function Pet({ kind = "cat", stage = 1, mood = "idle", size = 120, hat, talk = false, style }) {
  const c = SKIN[kind] || SKIN.cat;
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t1, t2; const loop = () => { t1 = setTimeout(() => { setBlink(true); t2 = setTimeout(() => { setBlink(false); loop(); }, 140); }, 2200 + Math.random() * 3000); };
    loop(); return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const bodyAnim = mood === "excited" ? "petHop .5s ease-in-out infinite" : mood === "sad" ? "none" : mood === "sleepy" ? "petBreathe 4s ease-in-out infinite" : "petBreathe 3s ease-in-out infinite";
  const scale = stage === 0 ? 0.8 : stage === 1 ? 0.9 : stage === 2 ? 1 : 1.08;
  return (
    <svg viewBox="-10 -20 120 130" width={size} height={size * 1.08} style={{ overflow:"visible", display:"block", ...style }}>
      <defs>
        <radialGradient id={`pb-${kind}`} cx="50%" cy="35%" r="70%"><stop offset="0%" stopColor="#fff" stopOpacity=".55" /><stop offset="60%" stopColor={c.body} stopOpacity="0" /></radialGradient>
        <filter id="petShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#1e1b4b" floodOpacity=".25" /></filter>
      </defs>
      <ellipse cx="50" cy="104" rx="30" ry="5" fill="#1e1b4b" opacity=".15"><animate attributeName="rx" values="30;27;30" dur="3s" repeatCount="indefinite" /></ellipse>
      <g style={{ animation: bodyAnim, transformOrigin:"50px 100px" }} filter="url(#petShadow)">
        <g style={{ transform:`scale(${scale})`, transformOrigin:"50px 100px" }}>
          {stage === 0 ? (
            // ไข่: โยกเบาๆ มีรอยแตกเล็กๆ ตา 2 ข้างโผล่
            <g style={{ animation:"petRock 2.2s ease-in-out infinite", transformOrigin:"50px 100px" }}>
              <path d="M50 10 C 78 10 86 50 84 70 C 82 92 66 100 50 100 C 34 100 18 92 16 70 C 14 50 22 10 50 10 Z" fill="#fde9c8" stroke="#c98a52" strokeWidth="2.5" />
              <path d="M50 10 C 78 10 86 50 84 70 C 82 92 66 100 50 100 C 34 100 18 92 16 70 C 14 50 22 10 50 10 Z" fill={`url(#pb-${kind})`} />
              <circle cx="36" cy="40" r="4" fill={c.ear} opacity=".7" /><circle cx="66" cy="52" r="3" fill={c.ear} opacity=".7" /><circle cx="58" cy="28" r="2.5" fill={c.ear} opacity=".7" />
              <path d="M40 66 l6 -6 l5 7 l6 -8 l5 6" stroke="#c98a52" strokeWidth="2" fill="none" strokeLinecap="round" />
              <Eyes mood={mood === "sad" ? "sad" : "idle"} blink={blink} c={c} />
            </g>
          ) : (
            <g>
              <Ears kind={kind} c={c} wiggle={mood !== "sleepy"} />
              <Extras kind={kind} stage={stage} c={c} />
              {/* ตัว */}
              <ellipse cx="50" cy="82" rx="30" ry="22" fill={c.body} stroke={c.line} strokeWidth="2.5" />
              <ellipse cx="50" cy="86" rx="18" ry="13" fill={c.belly} />
              {/* เท้า */}
              <ellipse cx="34" cy="100" rx="9" ry="5" fill={c.body} stroke={c.line} strokeWidth="2" /><ellipse cx="66" cy="100" rx="9" ry="5" fill={c.body} stroke={c.line} strokeWidth="2" />
              {/* หัว */}
              <circle cx="50" cy="48" r="30" fill={c.body} stroke={c.line} strokeWidth="2.5" />
              <circle cx="50" cy="48" r="30" fill={`url(#pb-${kind})`} />
              {kind === "dog" && <ellipse cx="50" cy="58" rx="12" ry="9" fill={c.belly} />}
              {kind === "dragon" && <ellipse cx="50" cy="58" rx="13" ry="9" fill={c.belly} />}
              <Cheeks />
              <Eyes mood={mood} blink={blink} c={c} />
              {/* จมูก */}
              {kind === "cat" && <path d="M46 54 l4 3 l4 -3 Z" fill="#fb7185" />}
              {kind === "dog" && <ellipse cx="50" cy="53" rx="4" ry="3" fill={c.line} />}
              {kind === "bunny" && <path d="M47 54 l3 2 l3 -2 Z" fill="#fb7185" />}
              {kind === "dragon" && <g><circle cx="46" cy="55" r="1.5" fill={c.line} /><circle cx="54" cy="55" r="1.5" fill={c.line} /></g>}
              {kind === "cat" && <g stroke={c.line} strokeWidth="1.5" strokeLinecap="round"><path d="M20 52 l14 2" /><path d="M20 58 l14 -1" /><path d="M80 52 l-14 2" /><path d="M80 58 l-14 -1" /></g>}
              <Mouth mood={mood} c={c} talk={talk} />
              {mood === "sleepy" && <text x="76" y="26" fontSize="14" fontWeight="800" fill="#6366f1" style={{ animation:"petZ 2s ease-in-out infinite" }}>z</text>}
              {mood === "excited" && <text x="2" y="20" fontSize="14" style={{ animation:"petFloat 1s ease-in-out infinite" }}>💖</text>}
              {/* หมวกจากร้านค้า */}
              {hat && <text x="50" y="22" fontSize="26" textAnchor="middle" style={{ transform:"rotate(-8deg)", transformOrigin:"50px 22px" }}>{hat}</text>}
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

export const PET_CSS = `
@keyframes petBreathe { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(1.035) translateY(-2px) } }
@keyframes petHop { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) scaleX(.96) } }
@keyframes petRock { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }
@keyframes petEar { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-4deg) } }
@keyframes petTail { 0%,100% { transform: rotate(-12deg) } 50% { transform: rotate(14deg) } }
@keyframes petWing { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(1.18) translateY(-3px) } }
@keyframes petFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes petZ { 0% { opacity: 0; transform: translate(0,0) scale(.6) } 50% { opacity: 1 } 100% { opacity: 0; transform: translate(10px,-16px) scale(1.3) } }
`;

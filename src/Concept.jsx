// ═══════════════════════════════════════════════════════
// CONCEPT — ภาพออกแบบเอง (SVG) สำหรับคำที่ถ่ายรูปไม่ได้: สี ตัวเลข รูปทรง วัน-เดือน-เวลา
// คำตรงข้ามเชิงตำแหน่ง/ปริมาณ และความรู้สึก (หน้าแสดงอารมณ์) · ใช้แทนอีโมจิใน <Pic>/<PicFill>
// ทุกภาพอยู่ใน viewBox 160×110 (16:11 เท่ารูปถ่าย) ขยายเต็มกรอบได้ · conceptFor(w) → JSX หรือ null
// ═══════════════════════════════════════════════════════
import React from "react";

const VB = "0 0 160 110";
const Frame = ({ bg = "#f1f5f9", bg2, children }) => (
  <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display:"block" }}>
    <defs>
      <linearGradient id="cp-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={bg} /><stop offset="1" stopColor={bg2 || bg} /></linearGradient>
      <radialGradient id="cp-gloss" cx="0.35" cy="0.3" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.85" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.1" /><stop offset="1" stopColor="#000" stopOpacity="0.12" /></radialGradient>
      <filter id="cp-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.22" /></filter>
    </defs>
    <rect width="160" height="110" fill="url(#cp-bg)" />
    {children}
  </svg>
);

// ── สี ──────────────────────────────────────────────────
const COLORS = {
  RED:"#ef4444", BLUE:"#2563eb", GREEN:"#22c55e", YELLOW:"#facc15", PURPLE:"#9333ea", ORANGE:"#f97316", PINK:"#ec4899", BROWN:"#92400e",
  BLACK:"#111827", WHITE:"#ffffff", GRAY:"#9ca3af", GOLD:"#d4a017", SILVER:"#c0c4cc", "LIGHT BLUE":"#7dd3fc", "DARK GREEN":"#166534",
  BEIGE:"#e7d2b0", TURQUOISE:"#2dd4bf", VIOLET:"#a78bfa", NAVY:"#1e3a8a",
};
// สิ่งของในชีวิตจริงที่มีสีนั้น (วาดง่ายๆ ให้เด็กเชื่อมโยง)
const COLOR_THINGS = {
  RED:"apple", BLUE:"sky", GREEN:"leaf", YELLOW:"sun", PURPLE:"grape", ORANGE:"orange", PINK:"flower", BROWN:"bear", BLACK:"night", WHITE:"cloud", GRAY:"stone",
  GOLD:"coin", SILVER:"spoon", "LIGHT BLUE":"sky", "DARK GREEN":"tree", BEIGE:"sand", TURQUOISE:"sea", VIOLET:"flower", NAVY:"night",
};
function Thing({ kind, c }) {
  switch (kind) {
    case "apple": return <g><circle cx="128" cy="78" r="14" fill={c} /><path d="M128 64 q2 -8 8 -9" stroke="#166534" strokeWidth="3" fill="none" /><ellipse cx="133" cy="60" rx="5" ry="2.5" fill="#22c55e" /></g>;
    case "sky": return <g><rect x="110" y="58" width="38" height="30" rx="6" fill={c} /><ellipse cx="124" cy="74" rx="8" ry="4" fill="#fff" /><ellipse cx="134" cy="70" rx="7" ry="4" fill="#fff" /></g>;
    case "leaf": return <path d="M112 90 q10 -34 36 -30 q-4 28 -36 30z" fill={c} stroke="#14532d" strokeWidth="1.5" />;
    case "sun": return <g><circle cx="128" cy="75" r="12" fill={c} />{[...Array(8)].map((_, i) => <line key={i} x1={128 + 16 * Math.cos(i * Math.PI / 4)} y1={75 + 16 * Math.sin(i * Math.PI / 4)} x2={128 + 21 * Math.cos(i * Math.PI / 4)} y2={75 + 21 * Math.sin(i * Math.PI / 4)} stroke={c} strokeWidth="3" strokeLinecap="round" />)}</g>;
    case "grape": return <g>{[[120,70],[130,70],[140,70],[125,79],[135,79],[130,88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5.5" fill={c} />)}<path d="M130 64 v-6" stroke="#166534" strokeWidth="2.5" /></g>;
    case "orange": return <g><circle cx="128" cy="77" r="14" fill={c} /><circle cx="128" cy="77" r="14" fill="url(#cp-gloss)" /><ellipse cx="134" cy="62" rx="5" ry="2.5" fill="#22c55e" /></g>;
    case "flower": return <g>{[...Array(6)].map((_, i) => <ellipse key={i} cx={128 + 9 * Math.cos(i * Math.PI / 3)} cy={76 + 9 * Math.sin(i * Math.PI / 3)} rx="6" ry="4" fill={c} transform={`rotate(${i * 60} ${128 + 9 * Math.cos(i * Math.PI / 3)} ${76 + 9 * Math.sin(i * Math.PI / 3)})`} />)}<circle cx="128" cy="76" r="4.5" fill="#fde047" /></g>;
    case "bear": return <g><circle cx="118" cy="66" r="5" fill={c} /><circle cx="138" cy="66" r="5" fill={c} /><circle cx="128" cy="76" r="13" fill={c} /><ellipse cx="128" cy="81" rx="5" ry="3.5" fill="#fde68a" /><circle cx="123" cy="73" r="1.5" fill="#111" /><circle cx="133" cy="73" r="1.5" fill="#111" /><circle cx="128" cy="79" r="1.5" fill="#111" /></g>;
    case "night": return <g><rect x="110" y="58" width="38" height="30" rx="6" fill={c} /><circle cx="134" cy="70" r="6" fill="#fef3c7" /><circle cx="137" cy="68" r="5.5" fill={c} /><circle cx="120" cy="66" r="1" fill="#fff" /><circle cx="124" cy="80" r="1" fill="#fff" /><circle cx="140" cy="82" r="1" fill="#fff" /></g>;
    case "cloud": return <g><ellipse cx="128" cy="78" rx="16" ry="8" fill={c} stroke="#cbd5e1" /><circle cx="122" cy="72" r="8" fill={c} /><circle cx="133" cy="70" r="9" fill={c} /></g>;
    case "stone": return <path d="M114 86 q-4 -16 14 -20 q18 -2 20 12 q0 10 -16 10z" fill={c} stroke="#6b7280" />;
    case "coin": return <g><circle cx="128" cy="76" r="14" fill={c} stroke="#a16207" strokeWidth="2" /><circle cx="128" cy="76" r="9" fill="none" stroke="#fde68a" strokeWidth="1.5" /><text x="128" y="81" textAnchor="middle" fontSize="12" fontWeight="800" fill="#854d0e">฿</text></g>;
    case "spoon": return <g transform="rotate(-30 128 76)"><ellipse cx="128" cy="64" rx="7" ry="10" fill={c} stroke="#64748b" /><rect x="126" y="72" width="4" height="24" rx="2" fill={c} stroke="#64748b" /></g>;
    case "tree": return <g><rect x="125" y="80" width="6" height="12" fill="#92400e" /><path d="M128 52 l16 28 h-32z" fill={c} /><path d="M128 44 l12 20 h-24z" fill={c} /></g>;
    case "sand": return <g><path d="M108 92 q20 -14 44 0z" fill={c} /><path d="M118 92 q10 -8 20 0z" fill="#d6b98c" /></g>;
    case "sea": return <g><rect x="110" y="62" width="38" height="28" rx="6" fill={c} /><path d="M112 74 q5 -4 10 0 t10 0 t10 0 t8 0" stroke="#fff" strokeWidth="2" fill="none" /><path d="M112 82 q5 -4 10 0 t10 0 t10 0 t8 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.7" /></g>;
    default: return null;
  }
}
function ColorCard({ word }) {
  const c = COLORS[word]; if (!c) return null;
  const dark = word === "WHITE" || word === "BEIGE" || word === "YELLOW" || word === "SILVER";
  return (
    <Frame bg="#ffffff" bg2="#f1f5f9">
      <circle cx="56" cy="55" r="36" fill={c} stroke={dark ? "#cbd5e1" : "none"} filter="url(#cp-sh)" />
      <circle cx="56" cy="55" r="36" fill="url(#cp-gloss)" />
      {[0.75, 0.55].map((k, i) => <circle key={i} cx={104 + i * 16} cy={32} r="6" fill={c} opacity={k} stroke="#e2e8f0" />)}
      <circle cx="136" cy="32" r="6" fill={c} stroke="#e2e8f0" />
      <Thing kind={COLOR_THINGS[word]} c={c} />
    </Frame>
  );
}

// ── ตัวเลข ──────────────────────────────────────────────
function Dots({ n }) {
  // ten-frame: 2 แถว × 5 ต่อ 10 · สูงสุด 20 จุด
  const cells = [];
  for (let i = 0; i < Math.min(n, 20); i++) {
    const frame = Math.floor(i / 10), j = i % 10, col = j % 5, row = Math.floor(j / 5);
    cells.push(<circle key={i} cx={92 + col * 13} cy={30 + frame * 34 + row * 13} r="5" fill={frame ? "#f97316" : "#6366f1"} />);
  }
  const frames = n > 10 ? 2 : 1;
  return <g>{[...Array(frames)].map((_, f) => <rect key={f} x="85" y={23 + f * 34} width="66" height="27" rx="6" fill="#fff" stroke="#cbd5e1" />)}{cells}</g>;
}
function Tens({ n }) { // 20–90: มัดละสิบเป็นแท่ง
  const k = Math.round(n / 10);
  return <g>{[...Array(k)].map((_, i) => <g key={i}><rect x={88 + (i % 5) * 13} y={i < 5 ? 26 : 60} width="9" height="28" rx="3" fill={i < 5 ? "#6366f1" : "#f97316"} />{[...Array(4)].map((_, j) => <line key={j} x1={88 + (i % 5) * 13} y1={(i < 5 ? 26 : 60) + 6 + j * 6} x2={97 + (i % 5) * 13} y2={(i < 5 ? 26 : 60) + 6 + j * 6} stroke="#fff" strokeOpacity="0.6" />)}</g>)}</g>;
}
const NUM_WORDS = { ZERO:0, ONE:1, TWO:2, THREE:3, FOUR:4, FIVE:5, SIX:6, SEVEN:7, EIGHT:8, NINE:9, TEN:10, ELEVEN:11, TWELVE:12, THIRTEEN:13, FOURTEEN:14, FIFTEEN:15, SIXTEEN:16, SEVENTEEN:17, EIGHTEEN:18, NINETEEN:19,
  TWENTY:20, THIRTY:30, FORTY:40, FIFTY:50, SIXTY:60, SEVENTY:70, EIGHTY:80, NINETY:90, HUNDRED:100, THOUSAND:1000, MILLION:1000000 };
function NumberCard({ w }) {
  const word = (w.word || "").toUpperCase(); const n = typeof w.num === "number" ? w.num : NUM_WORDS[word];
  if (word === "FIRST" || word === "SECOND" || word === "THIRD") {
    const pos = { FIRST:0, SECOND:1, THIRD:2 }[word];
    const steps = [[62, 40, 44, "#fbbf24", "1"], [20, 56, 36, "#cbd5e1", "2"], [104, 66, 30, "#d97706", "3"]];
    return <Frame bg="#fef9c3" bg2="#fde68a">{steps.map(([x, y, h, c, t], i) => <g key={i} opacity={i === pos ? 1 : 0.45}><rect x={x} y={y} width="38" height={h} rx="4" fill={c} filter={i === pos ? "url(#cp-sh)" : undefined} /><text x={x + 19} y={y + 20} textAnchor="middle" fontSize="16" fontWeight="900" fill="#1f2937">{t}</text>{i === pos && <circle cx={x + 19} cy={y - 14} r="9" fill="#f97316" stroke="#fff" strokeWidth="2" />}</g>)}</Frame>;
  }
  if (word === "HALF") return <Frame bg="#ecfeff" bg2="#cffafe"><circle cx="56" cy="55" r="34" fill="#fff" stroke="#0e7490" strokeWidth="3" /><path d="M56 21 A34 34 0 0 1 56 89 Z" fill="#06b6d4" /><text x="112" y="50" textAnchor="middle" fontSize="26" fontWeight="900" fill="#0e7490">1</text><line x1="98" y1="55" x2="126" y2="55" stroke="#0e7490" strokeWidth="3" /><text x="112" y="82" textAnchor="middle" fontSize="26" fontWeight="900" fill="#0e7490">2</text></Frame>;
  if (typeof n !== "number") return null;
  const label = n >= 1000 ? n.toLocaleString("en-US") : String(n);
  const fs = label.length > 7 ? 15 : label.length > 5 ? 22 : label.length > 3 ? 28 : label.length > 2 ? 34 : 46;
  return (
    <Frame bg="#eef2ff" bg2="#e0e7ff">
      <rect x="10" y="20" width="66" height="70" rx="14" fill="#fff" stroke="#c7d2fe" filter="url(#cp-sh)" />
      <text x="43" y={55 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="900" fill="#4338ca" fontFamily="Prompt, system-ui">{label}</text>
      {n <= 20 && n > 0 && <Dots n={n} />}
      {n === 0 && <g><rect x="85" y="23" width="66" height="27" rx="6" fill="#fff" stroke="#cbd5e1" strokeDasharray="3 3" /><text x="118" y="42" textAnchor="middle" fontSize="11" fill="#94a3b8">empty</text></g>}
      {n > 20 && n < 100 && <Tens n={n} />}
      {n === 100 && <g>{[...Array(100)].map((_, i) => <rect key={i} x={86 + (i % 10) * 6.4} y={25 + Math.floor(i / 10) * 6.4} width="5" height="5" rx="1" fill={i % 20 < 10 ? "#6366f1" : "#f97316"} />)}</g>}
      {n >= 1000 && <g>{[...Array(n >= 1e6 ? 6 : 3)].map((_, i) => <g key={i} transform={`translate(${88 + (i % 3) * 22} ${i < 3 ? 30 : 62})`}><rect width="16" height="16" fill="#6366f1" /><path d="M0 0 l5 -5 h16 l-5 5z" fill="#818cf8" /><path d="M16 0 l5 -5 v16 l-5 5z" fill="#4338ca" /></g>)}<text x="118" y="100" textAnchor="middle" fontSize="9" fill="#64748b">{n >= 1e6 ? "1,000 × 1,000" : "10 × 10 × 10"}</text></g>}
    </Frame>
  );
}

// ── รูปทรง ──────────────────────────────────────────────
const SHAPES = {
  CIRCLE: <circle cx="80" cy="55" r="34" />,
  SQUARE: <rect x="46" y="21" width="68" height="68" rx="4" />,
  TRIANGLE: <path d="M80 18 L118 88 H42 Z" />,
  STAR: <path d="M80 16 l10 24 26 2 -20 17 6 26 -22 -14 -22 14 6 -26 -20 -17 26 -2z" />,
  HEART: <path d="M80 92 C 40 64 40 34 60 28 c 10 -3 18 4 20 10 c 2 -6 10 -13 20 -10 c 20 6 20 36 -20 64z" />,
  RECTANGLE: <rect x="30" y="33" width="100" height="44" rx="4" />,
  OVAL: <ellipse cx="80" cy="55" rx="44" ry="28" />,
  "OVAL EGG": <path d="M80 18 c 22 0 32 26 32 44 c 0 18 -14 30 -32 30 s -32 -12 -32 -30 c 0 -18 10 -44 32 -44z" />,
  DIAMOND: <path d="M80 16 L120 55 L80 94 L40 55 Z" />,
  PENTAGON: <path d="M80 18 L116 44 L102 88 H58 L44 44 Z" />,
  HEXAGON: <path d="M62 22 H98 L116 55 L98 88 H62 L44 55 Z" />,
  CRESCENT: <path d="M92 18 A38 38 0 1 0 92 92 A30 30 0 1 1 92 18z" />,
  LINE: <rect x="24" y="52" width="112" height="6" rx="3" />,
  ARROW: <path d="M24 48 H100 V34 L136 55 L100 76 V62 H24 Z" />,
  CUBE: null,
};
function ShapeCard({ word }) {
  if (word === "CUBE") return <Frame bg="#f0f9ff" bg2="#e0f2fe"><g transform="translate(52 30)"><rect width="46" height="46" fill="#38bdf8" /><path d="M0 0 l16 -14 h46 l-16 14z" fill="#7dd3fc" /><path d="M46 0 l16 -14 v46 l-16 14z" fill="#0284c7" /><rect width="46" height="46" fill="none" stroke="#0c4a6e" strokeWidth="1.5" /></g></Frame>;
  const s = SHAPES[word]; if (!s) return null;
  return <Frame bg="#fdf2f8" bg2="#fce7f3">{React.cloneElement(s, { fill:"#ec4899", stroke:"#9d174d", strokeWidth:3, strokeLinejoin:"round", filter:"url(#cp-sh)" })}{React.cloneElement(s, { fill:"url(#cp-gloss)", stroke:"none" })}</Frame>;
}

// ── วัน เดือน เวลา ──────────────────────────────────────
const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_COLOR = { SUNDAY:"#ef4444", MONDAY:"#facc15", TUESDAY:"#f472b6", WEDNESDAY:"#22c55e", THURSDAY:"#f97316", FRIDAY:"#38bdf8", SATURDAY:"#a855f7" };
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const MONTH_ICON = ["🎆", "💝", "☀️", "💦", "🌧️", "🌿", "🌧️", "🌧️", "☔", "🍂", "🪷", "🎄"];
function CalendarFrame({ color, title, children }) {
  return <Frame bg="#fff" bg2="#f8fafc"><rect x="20" y="12" width="120" height="86" rx="10" fill="#fff" stroke="#e2e8f0" filter="url(#cp-sh)" /><rect x="20" y="12" width="120" height="22" rx="10" fill={color} /><rect x="20" y="24" width="120" height="10" fill={color} /><circle cx="44" cy="12" r="4" fill="#fff" stroke="#94a3b8" /><circle cx="116" cy="12" r="4" fill="#fff" stroke="#94a3b8" /><text x="80" y="28" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Prompt, system-ui">{title}</text>{children}</Frame>;
}
function TimeCard({ word }) {
  const di = DAYS.indexOf(word);
  if (di >= 0) return (
    <CalendarFrame color={DAY_COLOR[word]} title={word.slice(0, 3) + " · " + ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][di]}>
      {DAYS.map((d, i) => <g key={d}><rect x={26 + i * 15.6} y="44" width="13" height="40" rx="4" fill={i === di ? DAY_COLOR[d] : "#f1f5f9"} stroke={i === di ? "none" : "#e2e8f0"} /><text x={32.5 + i * 15.6} y="68" textAnchor="middle" fontSize="8" fontWeight="800" fill={i === di ? "#fff" : "#94a3b8"}>{d[0]}</text></g>)}
    </CalendarFrame>);
  const mi = MONTHS.indexOf(word);
  if (mi >= 0) return (
    <CalendarFrame color="#6366f1" title={word.slice(0, 3) + " · เดือนที่ " + (mi + 1)}>
      {MONTHS.map((m, i) => <rect key={m} x={28 + (i % 6) * 17.6} y={44 + Math.floor(i / 6) * 13} width="14" height="10" rx="3" fill={i === mi ? "#6366f1" : "#eef2ff"} />)}
      <text x="80" y="92" textAnchor="middle" fontSize="16">{MONTH_ICON[mi]}</text>
    </CalendarFrame>);
  if (word === "TODAY" || word === "TOMORROW" || word === "YESTERDAY") {
    const k = { YESTERDAY:0, TODAY:1, TOMORROW:2 }[word];
    return <CalendarFrame color="#0ea5e9" title={word}>{["YESTERDAY", "TODAY", "TOMORROW"].map((d, i) => <g key={d}><rect x={28 + i * 36} y="42" width="32" height="44" rx="6" fill={i === k ? "#0ea5e9" : "#f1f5f9"} stroke={i === k ? "none" : "#e2e8f0"} /><text x={44 + i * 36} y="68" textAnchor="middle" fontSize="14" fontWeight="900" fill={i === k ? "#fff" : "#94a3b8"}>{i === 0 ? "−1" : i === 1 ? "★" : "+1"}</text></g>)}</CalendarFrame>;
  }
  if (word === "WEEK") return <CalendarFrame color="#22c55e" title="7 days">{DAYS.map((d, i) => <rect key={d} x={26 + i * 15.6} y="44" width="13" height="40" rx="4" fill={DAY_COLOR[d]} />)}</CalendarFrame>;
  if (word === "WEEKEND") return <CalendarFrame color="#a855f7" title="Sat · Sun">{DAYS.map((d, i) => <rect key={d} x={26 + i * 15.6} y="44" width="13" height="40" rx="4" fill={i === 0 || i === 6 ? DAY_COLOR[d] : "#f1f5f9"} stroke={i === 0 || i === 6 ? "none" : "#e2e8f0"} />)}</CalendarFrame>;
  if (word === "MONTH") return <CalendarFrame color="#f97316" title="30 days">{[...Array(30)].map((_, i) => <rect key={i} x={30 + (i % 10) * 10.2} y={42 + Math.floor(i / 10) * 16} width="8" height="12" rx="2" fill="#fed7aa" />)}</CalendarFrame>;
  if (word === "YEAR") return <CalendarFrame color="#ef4444" title="12 months">{MONTHS.map((m, i) => <g key={m}><rect x={28 + (i % 6) * 17.6} y={42 + Math.floor(i / 6) * 24} width="14" height="18" rx="3" fill="#fee2e2" /><text x={35 + (i % 6) * 17.6} y={55 + Math.floor(i / 6) * 24} textAnchor="middle" fontSize="8" fontWeight="800" fill="#b91c1c">{i + 1}</text></g>)}</CalendarFrame>;
  if (word === "HOUR" || word === "MINUTE" || word === "O'CLOCK") {
    const hi = word === "HOUR", mi2 = word === "MINUTE";
    return <Frame bg="#fff7ed" bg2="#ffedd5"><circle cx="80" cy="55" r="40" fill="#fff" stroke="#fb923c" strokeWidth="4" filter="url(#cp-sh)" />{[...Array(12)].map((_, i) => <line key={i} x1={80 + 33 * Math.sin(i * Math.PI / 6)} y1={55 - 33 * Math.cos(i * Math.PI / 6)} x2={80 + 37 * Math.sin(i * Math.PI / 6)} y2={55 - 37 * Math.cos(i * Math.PI / 6)} stroke="#9a3412" strokeWidth={i % 3 ? 1.5 : 3} />)}<line x1="80" y1="55" x2="80" y2="26" stroke={mi2 ? "#f97316" : "#9a3412"} strokeWidth={mi2 ? 5 : 3} strokeLinecap="round" /><line x1="80" y1="55" x2={hi || word === "O'CLOCK" ? 98 : 80} y2={hi || word === "O'CLOCK" ? 45 : 26} stroke={hi ? "#f97316" : "#9a3412"} strokeWidth={hi ? 6 : 4} strokeLinecap="round" opacity={word === "O'CLOCK" ? 0 : 1} /><line x1="80" y1="55" x2="80" y2="30" stroke="#9a3412" strokeWidth="6" strokeLinecap="round" opacity={word === "O'CLOCK" ? 1 : 0} /><circle cx="80" cy="55" r="3.5" fill="#9a3412" /></Frame>;
  }
  return null;
}

// ── คำตรงข้ามเชิงตำแหน่ง/ปริมาณ (ภาพเปรียบเทียบ ตัวที่หมายถึงเด่น ตัวตรงข้ามจาง) ──
const Person = ({ x, y, h, c = "#6366f1", o = 1 }) => <g opacity={o}><circle cx={x} cy={y - h} r={h * 0.14 + 3} fill="#fcd9b6" /><rect x={x - h * 0.13 - 3} y={y - h + h * 0.14 + 4} width={h * 0.26 + 6} height={h * 0.86 - 4} rx={5} fill={c} /></g>;
function OppositeCard({ word }) {
  const F = ({ bg = "#f0fdf4", bg2 = "#dcfce7", children }) => <Frame bg={bg} bg2={bg2}>{children}</Frame>;
  switch (word) {
    case "TALL": return <F><line x1="20" y1="92" x2="140" y2="92" stroke="#86efac" strokeWidth="3" /><Person x={56} y={92} h={70} /><Person x={108} y={92} h={32} c="#cbd5e1" o={0.6} /><path d="M30 24 v68" stroke="#16a34a" strokeWidth="2" strokeDasharray="3 3" /><path d="M26 28 l4 -6 4 6" fill="none" stroke="#16a34a" strokeWidth="2" /></F>;
    case "SHORT": return <F><line x1="20" y1="92" x2="140" y2="92" stroke="#86efac" strokeWidth="3" /><Person x={56} y={92} h={70} c="#cbd5e1" o={0.5} /><Person x={108} y={92} h={32} /><path d="M134 62 v30" stroke="#16a34a" strokeWidth="2" strokeDasharray="3 3" /></F>;
    case "LONG": return <F><rect x="14" y="36" width="132" height="12" rx="6" fill="#6366f1" filter="url(#cp-sh)" /><rect x="14" y="66" width="40" height="12" rx="6" fill="#cbd5e1" /><path d="M14 28 h132" stroke="#16a34a" strokeWidth="2" strokeDasharray="3 3" /></F>;
    case "THICK": return <F><rect x="26" y="30" width="48" height="60" rx="4" fill="#6366f1" filter="url(#cp-sh)" /><rect x="26" y="30" width="8" height="60" fill="#4338ca" /><rect x="100" y="30" width="12" height="60" rx="3" fill="#cbd5e1" /></F>;
    case "THIN": return <F><rect x="26" y="30" width="48" height="60" rx="4" fill="#cbd5e1" opacity="0.6" /><rect x="100" y="30" width="12" height="60" rx="3" fill="#6366f1" filter="url(#cp-sh)" /></F>;
    case "UP": return <F bg="#eff6ff" bg2="#dbeafe"><path d="M80 14 L112 50 H94 V94 H66 V50 H48 Z" fill="#2563eb" filter="url(#cp-sh)" /><Person x={28} y={92} h={30} c="#93c5fd" /><Person x={132} y={92} h={30} c="#93c5fd" /></F>;
    case "DOWN": return <F bg="#eff6ff" bg2="#dbeafe"><path d="M80 96 L112 60 H94 V16 H66 V60 H48 Z" fill="#2563eb" filter="url(#cp-sh)" /></F>;
    case "LEFT": return <F bg="#fff7ed" bg2="#ffedd5"><path d="M14 55 L52 22 V40 H146 V70 H52 V88 Z" fill="#f97316" filter="url(#cp-sh)" /><circle cx="22" cy="55" r="0" /></F>;
    case "RIGHT": return <F bg="#fff7ed" bg2="#ffedd5"><path d="M146 55 L108 22 V40 H14 V70 H108 V88 Z" fill="#f97316" filter="url(#cp-sh)" /></F>;
    case "IN": return <F bg="#fefce8" bg2="#fef9c3"><path d="M40 46 h80 v44 h-80z" fill="#fbbf24" /><path d="M40 46 l12 -12 h80 l-12 12z" fill="#fde68a" /><path d="M120 46 l12 -12 v44 l-12 12z" fill="#d97706" /><circle cx="80" cy="70" r="14" fill="#ef4444" filter="url(#cp-sh)" /><path d="M80 20 v16" stroke="#ef4444" strokeWidth="3" /><path d="M74 30 l6 8 6 -8" fill="none" stroke="#ef4444" strokeWidth="3" /></F>;
    case "OUT": return <F bg="#fefce8" bg2="#fef9c3"><path d="M26 46 h70 v44 h-70z" fill="#fbbf24" /><path d="M26 46 l12 -12 h70 l-12 12z" fill="#fde68a" /><path d="M96 46 l12 -12 v44 l-12 12z" fill="#d97706" /><circle cx="134" cy="78" r="14" fill="#ef4444" filter="url(#cp-sh)" /><path d="M104 60 h16" stroke="#ef4444" strokeWidth="3" /><path d="M114 54 l8 6 -8 6" fill="none" stroke="#ef4444" strokeWidth="3" /></F>;
    case "FRONT": return <F bg="#f5f3ff" bg2="#ede9fe"><Person x={96} y={96} h={60} c="#c4b5fd" o={0.6} /><Person x={64} y={100} h={70} c="#7c3aed" /></F>;
    case "BACK": return <F bg="#f5f3ff" bg2="#ede9fe"><Person x={64} y={100} h={70} c="#c4b5fd" o={0.5} /><Person x={96} y={96} h={60} c="#7c3aed" /></F>;
    case "NEAR": return <F><line x1="0" y1="92" x2="160" y2="92" stroke="#86efac" strokeWidth="3" /><Person x={40} y={92} h={56} /><circle cx="72" cy="78" r="12" fill="#ef4444" filter="url(#cp-sh)" /><circle cx="138" cy="86" r="4" fill="#fca5a5" /></F>;
    case "FAR": return <F><line x1="0" y1="92" x2="160" y2="92" stroke="#86efac" strokeWidth="3" /><Person x={28} y={92} h={56} /><circle cx="140" cy="86" r="5" fill="#ef4444" filter="url(#cp-sh)" /><path d="M48 72 q46 -20 86 8" stroke="#16a34a" strokeWidth="2" strokeDasharray="3 3" fill="none" /></F>;
    case "FULL": return <F bg="#ecfeff" bg2="#cffafe"><path d="M52 22 h56 l-6 70 h-44z" fill="#fff" stroke="#0e7490" strokeWidth="3" /><path d="M55 26 h50 l-5.5 64 h-39z" fill="#22d3ee" /><path d="M55 26 h50" stroke="#fff" strokeWidth="3" /></F>;
    case "EMPTY": return <F bg="#ecfeff" bg2="#cffafe"><path d="M52 22 h56 l-6 70 h-44z" fill="#fff" stroke="#0e7490" strokeWidth="3" /><path d="M60 88 h40" stroke="#a5f3fc" strokeWidth="3" strokeDasharray="4 3" /></F>;
    case "SAME": return <F bg="#fdf2f8" bg2="#fce7f3">{[40, 80, 120].map((x, i) => <circle key={i} cx={x} cy="55" r="16" fill="#ec4899" filter="url(#cp-sh)" />)}<text x="80" y="96" textAnchor="middle" fontSize="18" fontWeight="900" fill="#9d174d">= = =</text></F>;
    case "DIFFERENT": return <F bg="#fdf2f8" bg2="#fce7f3">{[32, 64, 96].map((x, i) => <circle key={i} cx={x} cy="55" r="13" fill="#f9a8d4" />)}<path d="M128 38 l5 11 12 1 -9 8 3 12 -11 -7 -11 7 3 -12 -9 -8 12 -1z" fill="#ec4899" filter="url(#cp-sh)" /></F>;
    case "EASY": return <F><rect x="22" y="30" width="116" height="50" rx="12" fill="#fff" stroke="#86efac" strokeWidth="2" filter="url(#cp-sh)" /><text x="80" y="64" textAnchor="middle" fontSize="26" fontWeight="900" fill="#16a34a">1 + 1 = 2</text><text x="80" y="98" textAnchor="middle" fontSize="12" fill="#16a34a">😊 ง่ายจัง</text></F>;
    case "DIFFICULT": return <F bg="#fef2f2" bg2="#fee2e2"><rect x="22" y="30" width="116" height="50" rx="12" fill="#fff" stroke="#fca5a5" strokeWidth="2" filter="url(#cp-sh)" /><text x="80" y="62" textAnchor="middle" fontSize="15" fontWeight="900" fill="#b91c1c">√(x²+7) ÷ 13 = ?</text><text x="80" y="98" textAnchor="middle" fontSize="12" fill="#b91c1c">😣 ยากจัง</text></F>;
    case "POOR": return <F bg="#f8fafc" bg2="#f1f5f9"><rect x="44" y="34" width="72" height="48" rx="8" fill="#a16207" /><rect x="44" y="34" width="72" height="14" rx="6" fill="#854d0e" /><rect x="100" y="52" width="16" height="12" rx="3" fill="#fde68a" /><path d="M56 60 q10 -8 20 0" stroke="#fde68a" strokeWidth="2" fill="none" strokeDasharray="2 2" /><text x="80" y="100" textAnchor="middle" fontSize="11" fill="#64748b">0 ฿</text></F>;
    case "WEAK": return <F bg="#f8fafc" bg2="#f1f5f9"><Person x={80} y={96} h={66} c="#cbd5e1" /><path d="M58 60 q-12 6 -10 18" stroke="#fcd9b6" strokeWidth="8" strokeLinecap="round" fill="none" /><path d="M102 60 q12 6 10 18" stroke="#fcd9b6" strokeWidth="8" strokeLinecap="round" fill="none" /><text x="124" y="40" fontSize="14">💨</text></F>;
    case "NEW": return <F bg="#fffbeb" bg2="#fef3c7"><rect x="40" y="28" width="80" height="56" rx="10" fill="#fff" stroke="#fbbf24" strokeWidth="3" filter="url(#cp-sh)" /><text x="80" y="64" textAnchor="middle" fontSize="20" fontWeight="900" fill="#d97706">NEW</text><path d="M30 20 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#fbbf24" /><path d="M128 14 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#fbbf24" /></F>;
    default: return null;
  }
}

// ── ความรู้สึก: หน้าแสดงอารมณ์ (parametric face) ──
// eyes: open|closed|wide|droopy|wink · brow: 0 ปกติ · + โกรธ (ชี้ลงกลาง) · − เศร้า/กังวล (ชี้ขึ้นกลาง) · mouth: smile|big|flat|frown|o|wavy|tongue
const FACES = {
  HAPPY:{ eyes:"open", brow:0, mouth:"smile", bg:"#fef9c3", prop:"sparkle" },
  SAD:{ eyes:"droopy", brow:-1, mouth:"frown", bg:"#dbeafe", prop:"tear" },
  ANGRY:{ eyes:"open", brow:1.4, mouth:"flat", bg:"#fee2e2", skin:"#fca5a5", prop:"steam" },
  SCARED:{ eyes:"wide", brow:-1, mouth:"o", bg:"#ede9fe", skin:"#e9d5ff", prop:"shake" },
  TIRED:{ eyes:"droopy", brow:0, mouth:"flat", bg:"#f1f5f9", prop:"bags" },
  HUNGRY:{ eyes:"open", brow:0, mouth:"o", bg:"#ffedd5", prop:"fork" },
  THIRSTY:{ eyes:"droopy", brow:0, mouth:"tongue", bg:"#cffafe", prop:"drop" },
  SICK:{ eyes:"closed", brow:-0.6, mouth:"wavy", bg:"#dcfce7", skin:"#bbf7d0", prop:"thermo" },
  SURPRISED:{ eyes:"wide", brow:-0.8, mouth:"o", bg:"#fef3c7", prop:"bang" },
  EXCITED:{ eyes:"wide", brow:-0.5, mouth:"big", bg:"#fce7f3", prop:"stars" },
  BORED:{ eyes:"droopy", brow:0, mouth:"flat", bg:"#f1f5f9", prop:"dots" },
  SHY:{ eyes:"closed", brow:-0.4, mouth:"smile", bg:"#fce7f3", prop:"blush" },
  PROUD:{ eyes:"closed", brow:0, mouth:"smile", bg:"#fef3c7", prop:"medal" },
  NERVOUS:{ eyes:"wide", brow:-1, mouth:"wavy", bg:"#f5f3ff", prop:"sweat" },
  SLEEPY:{ eyes:"closed", brow:0, mouth:"o", bg:"#e0e7ff", prop:"zzz" },
  CALM:{ eyes:"closed", brow:0, mouth:"smile", bg:"#d1fae5", prop:"leaf" },
  LONELY:{ eyes:"droopy", brow:-0.8, mouth:"frown", bg:"#e2e8f0", prop:"rain" },
  BRAVE:{ eyes:"open", brow:0.6, mouth:"smile", bg:"#ffedd5", prop:"shield" },
  LOVE:{ eyes:"heart", brow:0, mouth:"smile", bg:"#ffe4e6", prop:"hearts" },
  WORRIED:{ eyes:"open", brow:-1.2, mouth:"wavy", bg:"#f1f5f9", prop:"sweat" },
  CONFUSED:{ eyes:"open", brow:-0.3, mouth:"wavy", bg:"#f5f3ff", prop:"question" },
  SILLY:{ eyes:"wink", brow:0, mouth:"tongue", bg:"#fef9c3", prop:"stars" },
  GRUMPY:{ eyes:"droopy", brow:1.2, mouth:"frown", bg:"#e2e8f0", prop:"cloud" },
  CURIOUS:{ eyes:"wide", brow:-0.4, mouth:"o", bg:"#cffafe", prop:"magnifier" },
  THANKFUL:{ eyes:"closed", brow:0, mouth:"smile", bg:"#fef3c7", prop:"hands" },
  SORRY:{ eyes:"droopy", brow:-1, mouth:"wavy", bg:"#f1f5f9", prop:"sweat" },
  HURT:{ eyes:"closed", brow:-1, mouth:"frown", bg:"#fee2e2", prop:"bandage" },
  FULL:{ eyes:"closed", brow:0, mouth:"smile", bg:"#ffedd5", prop:"plate" },
  COLD:{ eyes:"open", brow:-0.5, mouth:"wavy", bg:"#e0f2fe", skin:"#bae6fd", prop:"snow" },
  HOT:{ eyes:"droopy", brow:0, mouth:"o", bg:"#fee2e2", skin:"#fecaca", prop:"sun" },
};
function Eye({ x, kind }) {
  if (kind === "closed") return <path d={`M${x - 8} 50 q8 6 16 0`} stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />;
  if (kind === "heart") return <path d={`M${x} 58 c -10 -7 -10 -16 -4 -17 c 2 0 4 2 4 3 c 0 -1 2 -3 4 -3 c 6 1 6 10 -4 17z`} fill="#e11d48" />;
  if (kind === "wink" && x > 80) return <path d={`M${x - 8} 50 q8 6 16 0`} stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />;
  const r = kind === "wide" ? 7.5 : 6;
  return <g><circle cx={x} cy="50" r={r} fill="#fff" stroke="#1f2937" strokeWidth="1.5" /><circle cx={x + 1} cy="51" r={kind === "wide" ? 4.5 : 3.6} fill="#1f2937" /><circle cx={x + 2.5} cy="49" r="1.3" fill="#fff" />{kind === "droopy" && <path d={`M${x - 8} 45 h16`} stroke="#fcd9b6" strokeWidth="6" />}{kind === "droopy" && <path d={`M${x - 8} 46 q8 -2 16 0`} stroke="#1f2937" strokeWidth="2" fill="none" />}</g>;
}
function Mouth({ kind }) {
  switch (kind) {
    case "smile": return <path d="M66 68 q14 14 28 0" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />;
    case "big": return <path d="M62 66 q18 24 36 0z" fill="#7f1d1d" stroke="#1f2937" strokeWidth="2" />;
    case "flat": return <path d="M68 72 h24" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />;
    case "frown": return <path d="M66 78 q14 -12 28 0" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />;
    case "o": return <ellipse cx="80" cy="73" rx="7" ry="9" fill="#7f1d1d" stroke="#1f2937" strokeWidth="2" />;
    case "wavy": return <path d="M66 74 q5 -5 10 0 t10 0 t8 0" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />;
    case "tongue": return <g><path d="M66 68 q14 14 28 0" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" /><ellipse cx="86" cy="76" rx="5" ry="7" fill="#f472b6" stroke="#be185d" /></g>;
    default: return null;
  }
}
function Prop({ kind }) {
  switch (kind) {
    case "tear": return <path d="M66 58 q-6 10 0 14 q6 -4 0 -14z" fill="#38bdf8" />;
    case "steam": return <g fill="#ef4444"><path d="M118 22 q4 -6 0 -12" stroke="#ef4444" strokeWidth="3" fill="none" /><path d="M128 26 q4 -6 0 -12" stroke="#ef4444" strokeWidth="3" fill="none" /><path d="M138 22 q4 -6 0 -12" stroke="#ef4444" strokeWidth="3" fill="none" /></g>;
    case "sweat": return <path d="M112 36 q-6 10 0 14 q6 -4 0 -14z" fill="#38bdf8" />;
    case "zzz": return <text x="112" y="34" fontSize="18" fontWeight="900" fill="#6366f1">z<tspan fontSize="13" dy="-8">z</tspan><tspan fontSize="9" dy="-6">z</tspan></text>;
    case "hearts": return <g fill="#f43f5e"><path d="M126 30 c -8 -6 -8 -14 -3 -15 c 2 0 3 2 3 3 c 0 -1 1 -3 3 -3 c 5 1 5 9 -3 15z" /><path d="M140 18 c -6 -4 -6 -10 -2 -11 c 1 0 2 1 2 2 c 0 -1 1 -2 2 -2 c 4 1 4 7 -2 11z" /></g>;
    case "stars": return <g fill="#f59e0b"><path d="M120 20 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" /><path d="M30 24 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" /></g>;
    case "sparkle": return <g fill="#f59e0b"><path d="M30 24 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" /><path d="M132 20 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" /></g>;
    case "question": return <text x="118" y="40" fontSize="30" fontWeight="900" fill="#7c3aed">?</text>;
    case "bang": return <text x="116" y="40" fontSize="30" fontWeight="900" fill="#d97706">!</text>;
    case "fork": return <g transform="translate(118 26) rotate(20)"><rect x="-1.5" y="0" width="3" height="30" fill="#64748b" /><rect x="-6" y="-2" width="12" height="10" rx="2" fill="#64748b" /><rect x="-4" y="-6" width="2" height="6" fill="#64748b" /><rect x="-1" y="-6" width="2" height="6" fill="#64748b" /><rect x="2" y="-6" width="2" height="6" fill="#64748b" /></g>;
    case "drop": return <path d="M126 20 q-10 16 0 22 q10 -6 0 -22z" fill="#0ea5e9" />;
    case "thermo": return <g><rect x="120" y="14" width="8" height="30" rx="4" fill="#fff" stroke="#64748b" /><circle cx="124" cy="46" r="6" fill="#ef4444" /><rect x="122" y="28" width="4" height="16" fill="#ef4444" /></g>;
    case "blush": return <g fill="#fb7185" opacity="0.6"><ellipse cx="58" cy="62" rx="7" ry="4" /><ellipse cx="102" cy="62" rx="7" ry="4" /></g>;
    case "medal": return <g><path d="M118 10 l6 16 6 -16z" fill="#3b82f6" /><circle cx="124" cy="30" r="9" fill="#fbbf24" stroke="#d97706" strokeWidth="2" /><text x="124" y="34" textAnchor="middle" fontSize="10" fontWeight="900" fill="#92400e">1</text></g>;
    case "leaf": return <path d="M112 36 q6 -20 24 -18 q-2 18 -24 18z" fill="#22c55e" />;
    case "rain": return <g stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><line x1="118" y1="14" x2="114" y2="26" /><line x1="128" y1="18" x2="124" y2="30" /><line x1="138" y1="14" x2="134" y2="26" /></g>;
    case "shield": return <path d="M124 12 l12 5 v10 c0 8 -6 13 -12 16 c-6 -3 -12 -8 -12 -16 v-10z" fill="#f97316" stroke="#9a3412" strokeWidth="1.5" />;
    case "cloud": return <g><ellipse cx="126" cy="26" rx="14" ry="7" fill="#94a3b8" /><circle cx="120" cy="22" r="7" fill="#94a3b8" /><circle cx="130" cy="20" r="8" fill="#94a3b8" /></g>;
    case "magnifier": return <g><circle cx="122" cy="26" r="10" fill="#e0f2fe" stroke="#0369a1" strokeWidth="3" /><line x1="129" y1="33" x2="140" y2="44" stroke="#0369a1" strokeWidth="4" strokeLinecap="round" /></g>;
    case "hands": return <g fill="#fcd9b6" stroke="#d97706"><path d="M112 44 q4 -14 12 -16 l4 18z" /><path d="M136 44 q-4 -14 -12 -16 l-4 18z" /></g>;
    case "bandage": return <g transform="translate(96 30) rotate(-30)"><rect x="-14" y="-5" width="28" height="10" rx="4" fill="#fcd34d" stroke="#d97706" /><rect x="-5" y="-5" width="10" height="10" fill="#fef3c7" /></g>;
    case "plate": return <g><ellipse cx="124" cy="36" rx="16" ry="6" fill="#fff" stroke="#94a3b8" /><text x="124" y="24" textAnchor="middle" fontSize="10" fill="#64748b">✓</text></g>;
    case "snow": return <g fill="#38bdf8" fontSize="14"><text x="112" y="26">❄</text><text x="132" y="40">❄</text><text x="24" y="30">❄</text></g>;
    case "sun": return <g><circle cx="128" cy="24" r="9" fill="#f59e0b" />{[...Array(8)].map((_, i) => <line key={i} x1={128 + 12 * Math.cos(i * Math.PI / 4)} y1={24 + 12 * Math.sin(i * Math.PI / 4)} x2={128 + 16 * Math.cos(i * Math.PI / 4)} y2={24 + 16 * Math.sin(i * Math.PI / 4)} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />)}<path d="M108 40 q-6 10 0 14 q6 -4 0 -14z" fill="#38bdf8" /></g>;
    case "bags": return <g stroke="#94a3b8" strokeWidth="1.5" fill="none"><path d="M60 58 q8 4 16 0" /><path d="M84 58 q8 4 16 0" /></g>;
    case "dots": return <text x="112" y="40" fontSize="18" fontWeight="900" fill="#94a3b8">…</text>;
    case "shake": return <g stroke="#a78bfa" strokeWidth="2" fill="none"><path d="M28 50 q3 -3 0 -6 q-3 -3 0 -6" /><path d="M132 50 q3 -3 0 -6 q-3 -3 0 -6" /></g>;
    default: return null;
  }
}
function FaceCard({ word }) {
  const f = FACES[word]; if (!f) return null;
  const skin = f.skin || "#fde1c6";
  const browL = `M58 ${38 - f.brow * 3} q8 ${-2 + f.brow * 5} 16 ${f.brow * 4}`;
  const browR = `M86 ${38 + f.brow * 4} q8 ${-2 - f.brow * 5} 16 ${-f.brow * 4}`;
  return (
    <Frame bg={f.bg} bg2="#ffffff">
      <circle cx="80" cy="58" r="36" fill={skin} filter="url(#cp-sh)" />
      <circle cx="80" cy="58" r="36" fill="url(#cp-gloss)" opacity="0.5" />
      <path d={browL} stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={browR} stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Eye x={66} kind={f.eyes === "wink" ? "open" : f.eyes} />
      <Eye x={94} kind={f.eyes} />
      <Mouth kind={f.mouth} />
      <Prop kind={f.prop} />
    </Frame>
  );
}


// ── ร่างกาย: เงาคนยืนด้านหน้า ไฮไลต์ส่วนที่หมายถึง (ใช้กับคำที่ไม่มีรูปถ่ายดีๆ) ──
const BODY_PARTS = {
  BODY: null,
  LEG: [<rect key="l" x="66" y="64" width="11" height="34" rx="5" />, <rect key="r" x="83" y="64" width="11" height="34" rx="5" />],
  NECK: [<rect key="n" x="74" y="28" width="12" height="9" rx="3" />],
  ELBOW: [<circle key="e1" cx="53" cy="62" r="6" />, <circle key="e2" cx="107" cy="62" r="6" />],
  HIP: [<rect key="h" x="64" y="56" width="32" height="12" rx="6" />],
  CHEST: [<rect key="c" x="66" y="38" width="28" height="16" rx="6" />],
  ME: null,
};
function BodyCard({ word }) {
  const parts = BODY_PARTS[word]; const all = word === "BODY" || word === "ME";
  const skin = "#f1c9a5", hi = "#ef4444";
  return (
    <Frame bg="#eff6ff" bg2="#dbeafe">
      <g opacity={all ? 1 : 0.45}>
        <circle cx="80" cy="18" r="11" fill={skin} />
        <rect x="74" y="28" width="12" height="9" rx="3" fill={skin} />
        <rect x="62" y="36" width="36" height="32" rx="10" fill="#60a5fa" />
        <rect x="46" y="38" width="10" height="30" rx="5" fill={skin} transform="rotate(12 51 38)" />
        <rect x="104" y="38" width="10" height="30" rx="5" fill={skin} transform="rotate(-12 109 38)" />
        <rect x="66" y="64" width="11" height="34" rx="5" fill="#1e40af" />
        <rect x="83" y="64" width="11" height="34" rx="5" fill="#1e40af" />
      </g>
      {parts && <g fill={hi} stroke="#fff" strokeWidth="1.5" style={{ filter:"drop-shadow(0 0 4px rgba(239,68,68,.7))" }}>{parts}</g>}
      {word === "ME" && <g><path d="M118 40 l-18 10" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" /><circle cx="122" cy="38" r="5" fill="#ef4444" /><text x="128" y="30" fontSize="14" fontWeight="900" fill="#1e40af">ME!</text></g>}
      {word === "BODY" && <path d="M40 10 v88 M120 10 v88" stroke="#1e40af" strokeWidth="2" strokeDasharray="4 4" />}
    </Frame>
  );
}

// ── ทางเข้า ── (คืน null เมื่อไม่มีภาพของคำนั้น → <Pic> จะใช้อีโมจิแทน)
const TIME_WORDS = new Set([...DAYS, ...MONTHS, "TODAY", "TOMORROW", "YESTERDAY", "WEEK", "WEEKEND", "MONTH", "YEAR", "HOUR", "MINUTE", "O'CLOCK"]);
const OPP_WORDS = new Set(["TALL", "SHORT", "LONG", "THICK", "THIN", "UP", "DOWN", "LEFT", "RIGHT", "IN", "OUT", "FRONT", "BACK", "NEAR", "FAR", "FULL", "EMPTY", "SAME", "DIFFERENT", "EASY", "DIFFICULT", "POOR", "WEAK", "NEW"]);
export function conceptFor(w) {
  if (!w) return null;
  const word = (w.word || "").toUpperCase();
  switch (w.cat) {
    case "colors": return COLORS[word] ? <ColorCard word={word} /> : null;
    case "numbers": return (typeof w.num === "number" || word in NUM_WORDS || ["FIRST", "SECOND", "THIRD", "HALF"].includes(word)) ? <NumberCard w={w} /> : null;
    case "shapes": return (word === "CUBE" || SHAPES[word]) ? <ShapeCard word={word} /> : null;
    case "time": return TIME_WORDS.has(word) ? <TimeCard word={word} /> : null;
    case "feelings": return FACES[word] ? <FaceCard word={word} /> : null;
    case "opposites": return OPP_WORDS.has(word) ? <OppositeCard word={word} /> : FACES[word] ? <FaceCard word={word} /> : null;
    case "body": return word in BODY_PARTS ? <BodyCard word={word} /> : null;
    case "family": return word === "ME" ? <BodyCard word={word} /> : null;
    default: return null;
  }
}
export const hasConcept = w => !!conceptFor(w);
// รายการคำทั้งหมดที่มีภาพออกแบบ (ใช้ทำหน้าตรวจ ?concepts=1)
export const CONCEPT_WORDS = { body:Object.keys(BODY_PARTS), colors:Object.keys(COLORS), shapes:[...Object.keys(SHAPES)], time:[...TIME_WORDS], feelings:Object.keys(FACES), opposites:[...OPP_WORDS] };

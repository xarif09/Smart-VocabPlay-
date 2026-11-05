// ═══════════════════════════════════════════════════════
// Icons — ไอคอน illustration ชุดเดียวกันทั้งแอป (SVG วาดเอง สไตล์ "soft 3D": รูปทรงมน ไฮไลต์ด้านบน เงานุ่ม)
//  <CatIcon id="animals" size={40}/>  ไอคอนหมวด 26
//  <GameIcon id="quiz" size={40}/>    ไอคอนเกม 24
//  ทุกตัวใช้เทมเพลตเดียว: badge วงกลมไล่สี + สัญลักษณ์เรียบง่ายสีขาว/สีเน้น → ดูเป็นชุดเดียวกัน
// ═══════════════════════════════════════════════════════
import React from "react";

const Badge = ({ size, c1, c2, children, id }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ display:"block", overflow:"visible" }}>
    <defs>
      <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
      <radialGradient id={`h-${id}`} cx="35%" cy="25%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
      <filter id={`s-${id}`} x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={c2} floodOpacity=".45" /></filter>
    </defs>
    <g filter={`url(#s-${id})`}>
      <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#g-${id})`} />
      <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#h-${id})`} />
    </g>
    <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">{children}</g>
  </svg>
);
const W = "#fff";
// ── สัญลักษณ์หมวด (วาดใน 64×64, พื้นที่กลาง 16..48) ──
const CAT = {
  animals:   { c:["#fbbf24","#f97316"], d:<g><circle cx="32" cy="34" r="12" fill={W} stroke="none" /><path d="M20 26 L17 15 L27 22 Z M44 26 L47 15 L37 22 Z" fill={W} stroke="none" /><circle cx="27" cy="33" r="1.8" fill="#f97316" stroke="none" /><circle cx="37" cy="33" r="1.8" fill="#f97316" stroke="none" /><path d="M29 39 q3 3 6 0" stroke="#f97316" strokeWidth="2" /></g> },
  fruits:    { c:["#f87171","#dc2626"], d:<g><circle cx="32" cy="36" r="13" fill={W} stroke="none" /><path d="M32 23 q1 -8 8 -9" stroke={W} /><path d="M32 23 q-6 -4 -4 -9 q6 1 4 9" fill="#86efac" stroke="none" /></g> },
  food:      { c:["#fb923c","#ea580c"], d:<g><circle cx="32" cy="34" r="14" fill={W} stroke="none" /><path d="M32 20 L32 48 M18 34 L46 34" stroke="#ea580c" strokeWidth="2" /><circle cx="26" cy="28" r="2.5" fill="#ea580c" stroke="none" /><circle cx="38" cy="40" r="2.5" fill="#ea580c" stroke="none" /><circle cx="38" cy="27" r="2" fill="#ea580c" stroke="none" /></g> },
  colors:    { c:["#a78bfa","#7c3aed"], d:<g><path d="M22 44 L24 24 L30 24 L32 44 Z" fill="#f43f5e" stroke="none" /><path d="M31 44 L33 20 L39 20 L41 44 Z" fill="#facc15" stroke="none" /><path d="M40 44 L42 26 L48 26 L50 44 Z" fill="#22d3ee" stroke="none" /><rect x="18" y="42" width="34" height="6" rx="3" fill={W} stroke="none" /></g> },
  school:    { c:["#60a5fa","#2563eb"], d:<g><path d="M18 24 L32 18 L46 24 L32 30 Z" fill={W} stroke="none" /><path d="M23 28 V38 q9 6 18 0 V28" /><path d="M46 24 V36" /></g> },
  body:      { c:["#f472b6","#db2777"], d:<g><circle cx="32" cy="24" r="6" fill={W} stroke="none" /><path d="M22 46 q0 -14 10 -14 q10 0 10 14 Z" fill={W} stroke="none" /></g> },
  weather:   { c:["#38bdf8","#0284c7"], d:<g><circle cx="26" cy="26" r="7" fill="#fde047" stroke="none" /><path d="M24 44 h18 a7 7 0 0 0 0 -14 a9 9 0 0 0 -17 3 a5.5 5.5 0 0 0 -1 11 Z" fill={W} stroke="none" /></g> },
  numbers:   { c:["#34d399","#059669"], d:<g><text x="32" y="43" textAnchor="middle" fontSize="30" fontWeight="900" fill={W} stroke="none" fontFamily="Prompt, system-ui">123</text></g> },
  vehicles:  { c:["#818cf8","#4f46e5"], d:<g><path d="M17 38 L20 28 q1 -3 4 -3 h16 q3 0 4 3 l3 10 Z" fill={W} stroke="none" /><rect x="15" y="36" width="34" height="7" rx="3" fill={W} stroke="none" /><circle cx="23" cy="44" r="4" fill="#4f46e5" stroke={W} /><circle cx="41" cy="44" r="4" fill="#4f46e5" stroke={W} /></g> },
  jobs:      { c:["#2dd4bf","#0d9488"], d:<g><rect x="18" y="26" width="28" height="20" rx="4" fill={W} stroke="none" /><path d="M26 26 v-4 h12 v4" /><path d="M18 34 h28" stroke="#0d9488" strokeWidth="2" /></g> },
  clothes:   { c:["#e879f9","#c026d3"], d:<g><path d="M24 20 l8 4 l8 -4 l8 6 l-5 5 l-3 -2 v17 h-16 v-17 l-3 2 l-5 -5 Z" fill={W} stroke="none" /></g> },
  home:      { c:["#a3e635","#65a30d"], d:<g><path d="M16 34 L32 18 L48 34" /><path d="M21 31 V46 h22 V31" fill={W} stroke="none" /><rect x="29" y="36" width="6" height="10" fill="#65a30d" stroke="none" /></g> },
  nature:    { c:["#4ade80","#16a34a"], d:<g><path d="M32 46 V30" /><path d="M32 30 q-14 -2 -12 -16 q14 2 12 16 Z" fill={W} stroke="none" /><path d="M32 36 q14 -2 12 -16 q-14 2 -12 16 Z" fill={W} stroke="none" /></g> },
  sports:    { c:["#60a5fa","#1d4ed8"], d:<g><circle cx="32" cy="32" r="13" fill={W} stroke="none" /><path d="M32 19 l4 7 l-4 7 l-4 -7 Z M22 26 l6 3 M42 26 l-6 3 M24 41 l4 -8 M40 41 l-4 -8" stroke="#1d4ed8" strokeWidth="2" /></g> },
  family:    { c:["#fb7185","#e11d48"], d:<g><circle cx="24" cy="25" r="5" fill={W} stroke="none" /><circle cx="40" cy="25" r="5" fill={W} stroke="none" /><circle cx="32" cy="33" r="4" fill={W} stroke="none" /><path d="M16 46 q0 -10 8 -10 q4 0 6 3 q2 -3 6 -3 q8 0 8 10 Z" fill={W} stroke="none" /></g> },
  actions:   { c:["#f472b6","#be185d"], d:<g><circle cx="36" cy="20" r="4" fill={W} stroke="none" /><path d="M34 26 l-8 6 l6 6 l-4 10 M34 26 l8 4 l4 -4 M32 38 l6 8" /></g> },
  feelings:  { c:["#fbbf24","#d97706"], d:<g><circle cx="32" cy="32" r="14" fill={W} stroke="none" /><circle cx="27" cy="29" r="2" fill="#d97706" stroke="none" /><circle cx="37" cy="29" r="2" fill="#d97706" stroke="none" /><path d="M25 37 q7 6 14 0" stroke="#d97706" /></g> },
  shapes:    { c:["#c084fc","#9333ea"], d:<g><circle cx="24" cy="24" r="7" fill={W} stroke="none" /><rect x="33" y="17" width="14" height="14" rx="2" fill={W} stroke="none" /><path d="M24 47 l-8 -13 h16 Z" fill={W} stroke="none" /><path d="M40 33 l7 7 l-7 7 l-7 -7 Z" fill={W} stroke="none" /></g> },
  toys:      { c:["#fbbf24","#f59e0b"], d:<g><circle cx="32" cy="26" r="8" fill={W} stroke="none" /><circle cx="24" cy="21" r="3.5" fill={W} stroke="none" /><circle cx="40" cy="21" r="3.5" fill={W} stroke="none" /><ellipse cx="32" cy="41" rx="9" ry="7" fill={W} stroke="none" /><circle cx="29" cy="25" r="1.3" fill="#f59e0b" stroke="none" /><circle cx="35" cy="25" r="1.3" fill="#f59e0b" stroke="none" /></g> },
  places:    { c:["#2dd4bf","#0f766e"], d:<g><rect x="17" y="26" width="12" height="20" fill={W} stroke="none" /><rect x="31" y="18" width="16" height="28" fill={W} stroke="none" /><path d="M35 23 h3 M41 23 h3 M35 29 h3 M41 29 h3 M35 35 h3 M41 35 h3 M20 31 h3 M20 37 h3" stroke="#0f766e" strokeWidth="2" /></g> },
  vegetables:{ c:["#84cc16","#4d7c0f"], d:<g><path d="M32 46 q-12 -6 -10 -20 q10 0 10 12 q0 -12 10 -12 q2 14 -10 20 Z" fill={W} stroke="none" /><path d="M32 46 V30" stroke="#4d7c0f" strokeWidth="2" /></g> },
  technology:{ c:["#38bdf8","#0369a1"], d:<g><rect x="22" y="16" width="20" height="32" rx="4" fill={W} stroke="none" /><rect x="25" y="20" width="14" height="20" rx="1.5" fill="#0369a1" stroke="none" /><circle cx="32" cy="44" r="1.6" fill="#0369a1" stroke="none" /></g> },
  music:     { c:["#e879f9","#a21caf"], d:<g><path d="M26 42 V20 l16 -4 v22" /><circle cx="22" cy="42" r="4.5" fill={W} stroke="none" /><circle cx="38" cy="38" r="4.5" fill={W} stroke="none" /></g> },
  opposites: { c:["#fb923c","#c2410c"], d:<g><path d="M18 26 h22 l-5 -5 M40 26 l-5 5" /><path d="M46 38 h-22 l5 -5 M24 38 l5 5" /></g> },
  time:      { c:["#22d3ee","#0e7490"], d:<g><circle cx="32" cy="33" r="14" fill={W} stroke="none" /><path d="M32 24 v9 l6 4" stroke="#0e7490" /><circle cx="32" cy="33" r="1.5" fill="#0e7490" stroke="none" /></g> },
  countries: { c:["#4ade80","#15803d"], d:<g><circle cx="32" cy="32" r="14" fill={W} stroke="none" /><path d="M18 32 h28 M32 18 q9 14 0 28 M32 18 q-9 14 0 28" stroke="#15803d" strokeWidth="2" /><ellipse cx="32" cy="32" rx="14" ry="6" stroke="#15803d" strokeWidth="2" /></g> },
};
// ── สัญลักษณ์เกม ──
const GAME = {
  quiz:     { c:["#fbbf24","#d97706"], d:<g><path d="M24 26 q0 -8 8 -8 q8 0 8 7 q0 5 -6 7 v4" /><circle cx="34" cy="43" r="2" fill={W} stroke="none" /></g> },
  spell:    { c:["#a78bfa","#6d28d9"], d:<g><text x="32" y="42" textAnchor="middle" fontSize="26" fontWeight="900" fill={W} stroke="none" fontFamily="Prompt, system-ui">Ab</text></g> },
  memory:   { c:["#f472b6","#be185d"], d:<g><rect x="16" y="20" width="14" height="22" rx="3" fill={W} stroke="none" /><rect x="34" y="20" width="14" height="22" rx="3" fill={W} stroke="none" /><path d="M20 31 l3 3 l5 -6" stroke="#be185d" strokeWidth="2.5" /><text x="41" y="35" textAnchor="middle" fontSize="12" fill="#be185d" stroke="none" fontWeight="900">?</text></g> },
  speed:    { c:["#f59e0b","#dc2626"], d:<g><path d="M36 16 L22 36 h10 l-4 12 l14 -20 h-10 Z" fill={W} stroke="none" /></g> },
  habitat:  { c:["#86efac","#15803d"], d:<g><path d="M16 36 L32 22 L48 36" /><path d="M21 33 V46 h22 V33" fill={W} stroke="none" /><circle cx="32" cy="40" r="3" fill="#15803d" stroke="none" /></g> },
  match:    { c:["#22d3ee","#0e7490"], d:<g><rect x="16" y="22" width="13" height="20" rx="3" fill={W} stroke="none" /><rect x="35" y="22" width="13" height="20" rx="3" fill={W} stroke="none" /><path d="M29 32 h6" stroke={W} /></g> },
  colormix: { c:["#f43f5e","#7c3aed"], d:<g><circle cx="26" cy="30" r="9" fill="#f43f5e" stroke="none" opacity=".9" /><circle cx="38" cy="30" r="9" fill="#38bdf8" stroke="none" opacity=".9" /><circle cx="32" cy="40" r="9" fill="#fde047" stroke="none" opacity=".9" /></g> },
  count:    { c:["#34d399","#047857"], d:<g><circle cx="24" cy="26" r="4" fill={W} stroke="none" /><circle cx="36" cy="26" r="4" fill={W} stroke="none" /><circle cx="30" cy="38" r="4" fill={W} stroke="none" /><text x="46" y="44" fontSize="14" fontWeight="900" fill={W} stroke="none">3</text></g> },
  bodydr:   { c:["#f9a8d4","#be185d"], d:<g><path d="M24 20 v10 a8 8 0 0 0 16 0 v-10" /><circle cx="42" cy="42" r="4" fill={W} stroke="none" /><path d="M32 38 q0 6 6 4" /></g> },
  dress:    { c:["#67e8f9","#0e7490"], d:<g><path d="M24 20 l8 4 l8 -4 l8 6 l-5 5 l-3 -2 v17 h-16 v-17 l-3 2 l-5 -5 Z" fill={W} stroke="none" /></g> },
  boss:     { c:["#4c1d95","#1f2937"], d:<g><path d="M18 42 l2 -18 l8 8 l4 -12 l4 12 l8 -8 l2 18 Z" fill="#fbbf24" stroke="none" /><rect x="18" y="42" width="28" height="4" fill="#f59e0b" stroke="none" /></g> },
  listen:   { c:["#a78bfa","#5b21b6"], d:<g><path d="M22 28 v8 h5 l7 6 V22 l-7 6 Z" fill={W} stroke="none" /><path d="M38 27 q4 5 0 10 M42 23 q7 9 0 18" /></g> },
  sentence: { c:["#f472b6","#9d174d"], d:<g><rect x="16" y="22" width="12" height="8" rx="2" fill={W} stroke="none" /><rect x="30" y="22" width="18" height="8" rx="2" fill={W} stroke="none" /><rect x="16" y="34" width="20" height="8" rx="2" fill={W} stroke="none" /><rect x="38" y="34" width="10" height="8" rx="2" fill={W} stroke="none" /></g> },
  mole:     { c:["#a16207","#713f12"], d:<g><ellipse cx="32" cy="44" rx="14" ry="5" fill="#3f2a14" stroke="none" /><circle cx="32" cy="34" r="9" fill={W} stroke="none" /><circle cx="29" cy="32" r="1.5" fill="#713f12" stroke="none" /><circle cx="35" cy="32" r="1.5" fill="#713f12" stroke="none" /><path d="M40 16 l8 8" strokeWidth="4" /><path d="M46 14 l4 4" strokeWidth="6" /></g> },
  balloon:  { c:["#f472b6","#be185d"], d:<g><ellipse cx="28" cy="27" rx="9" ry="11" fill={W} stroke="none" /><ellipse cx="41" cy="31" rx="7" ry="9" fill="#fde68a" stroke="none" /><path d="M28 38 q-2 6 2 10 M41 40 q2 4 -1 8" /></g> },
  ninja:    { c:["#64748b","#1e293b"], d:<g><path d="M18 46 L40 24" strokeWidth="5" stroke={W} /><path d="M40 24 L48 16" strokeWidth="3" stroke="#cbd5e1" /><circle cx="22" cy="42" r="4" fill="#fbbf24" stroke="none" /><path d="M14 30 l4 -2 M20 24 l3 -3" /></g> },
  runner:   { c:["#22d3ee","#7c3aed"], d:<g><path d="M14 50 L26 20 h12 L50 50 Z" fill="rgba(255,255,255,.35)" stroke="none" /><path d="M32 22 v6 M32 33 v6 M32 44 v5" stroke={W} strokeWidth="3" /><circle cx="40" cy="22" r="5" fill={W} stroke="none" /><path d="M38 28 l-6 8 l6 4 l-3 8 M32 36 l-8 2" stroke={W} strokeWidth="3.5" /></g> },
  feed:     { c:["#fb923c","#e11d48"], d:<g><circle cx="30" cy="34" r="13" fill={W} stroke="none" /><circle cx="26" cy="31" r="2" fill="#e11d48" stroke="none" /><circle cx="34" cy="31" r="2" fill="#e11d48" stroke="none" /><path d="M24 38 q6 6 12 0" stroke="#e11d48" strokeWidth="3" fill="none" /><circle cx="48" cy="22" r="6" fill="#fde047" stroke="none" /><path d="M48 16 v-4" stroke={W} strokeWidth="2.5" /></g> },
  bingo:    { c:["#34d399","#047857"], d:<g>{[0,1,2].map(r => [0,1,2].map(c => <rect key={r+"-"+c} x={20+c*9} y={20+r*9} width="7" height="7" rx="2" fill={(r===c)?"#fbbf24":W} stroke="none" />))}</g> },
  speak:    { c:["#fb7185","#be123c"], d:<g><rect x="27" y="16" width="10" height="18" rx="5" fill={W} stroke="none" /><path d="M22 30 q0 10 10 10 q10 0 10 -10 M32 40 v6 M27 46 h10" /></g> },
  phonics:  { c:["#22d3ee","#1d4ed8"], d:<g><text x="32" y="44" textAnchor="middle" fontSize="30" fontWeight="900" fill={W} stroke="none" fontFamily="Prompt, system-ui">A</text><path d="M44 22 q3 3 0 6" /></g> },
  grammar:  { c:["#fbbf24","#b45309"], d:<g><path d="M22 44 l16 -16 l4 4 l-16 16 h-4 Z" fill={W} stroke="none" /><path d="M36 26 l4 4" stroke="#b45309" /><path d="M18 46 h28" /></g> },
  time:     { c:["#22d3ee","#0e7490"], d:<g><circle cx="32" cy="33" r="14" fill={W} stroke="none" /><path d="M32 24 v9 l6 4" stroke="#0e7490" /></g> },
  money:    { c:["#fbbf24","#b45309"], d:<g><circle cx="32" cy="32" r="13" fill={W} stroke="none" /><text x="32" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill="#b45309" stroke="none">฿</text></g> },
  calendar: { c:["#60a5fa","#1e40af"], d:<g><rect x="18" y="20" width="28" height="26" rx="4" fill={W} stroke="none" /><rect x="18" y="20" width="28" height="7" fill="#1e40af" stroke="none" /><path d="M24 33 h4 M30 33 h4 M36 33 h4 M24 39 h4 M30 39 h4" stroke="#1e40af" strokeWidth="2.5" /></g> },
  numbers100:{ c:["#34d399","#047857"], d:<g><text x="32" y="42" textAnchor="middle" fontSize="20" fontWeight="900" fill={W} stroke="none" fontFamily="Prompt, system-ui">100</text></g> },
  test:     { c:["#818cf8","#3730a3"], d:<g><rect x="20" y="16" width="24" height="32" rx="3" fill={W} stroke="none" /><path d="M25 26 l3 3 l5 -6 M25 36 l3 3 l5 -6" stroke="#3730a3" strokeWidth="2.5" /><path d="M36 27 h4 M36 37 h4" stroke="#3730a3" strokeWidth="2.5" /></g> },
  droleplay:{ c:["#fb923c","#c2410c"], d:<g><path d="M18 22 h18 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-8 l-6 5 v-5 h-4 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4 Z" fill={W} stroke="none" /><circle cx="42" cy="40" r="5" fill="#fde68a" stroke="none" /></g> },
  dfill:    { c:["#fb923c","#9a3412"], d:<g><rect x="16" y="28" width="12" height="8" rx="2" fill={W} stroke="none" /><rect x="30" y="28" width="12" height="8" rx="2" fill="none" stroke={W} strokeDasharray="3 3" /><rect x="44" y="28" width="6" height="8" rx="2" fill={W} stroke="none" /></g> },
  squiz:    { c:["#a855f7","#6b21a8"], d:<g><path d="M18 20 h11 q3 0 3 3 v23 q-3 -3 -6 -3 h-8 Z M46 20 h-11 q-3 0 -3 3 v23 q3 -3 6 -3 h8 Z" fill={W} stroke="none" /><text x="32" y="30" textAnchor="middle" fontSize="12" fontWeight="900" fill="#6b21a8" stroke="none">?</text></g> },
};
const COVER_FALLBACK = { c:["#94a3b8","#475569"], d:<circle cx="32" cy="32" r="10" fill={W} stroke="none" /> };

export function CatIcon({ id, size = 40 }) { const d = CAT[id] || COVER_FALLBACK; return <Badge size={size} c1={d.c[0]} c2={d.c[1]} id={`c-${id}`}>{d.d}</Badge>; }
export function GameIcon({ id, size = 40 }) { const d = GAME[id] || COVER_FALLBACK; return <Badge size={size} c1={d.c[0]} c2={d.c[1]} id={`g-${id}`}>{d.d}</Badge>; }
export const hasCatIcon = id => !!CAT[id];
export const hasGameIcon = id => !!GAME[id];

// ═══════════════════════════════════════════════════════
// M3 — Material 3 Expressive (Android 16) สำหรับ Smart VocabPlay
//  • สีไดนามิกแบบโทน (oklch) จาก seed hue → บทบาทสี md.sys.color.* เป็น CSS var บน :root
//  • รูปทรง expressive (cookie / clover / burst / pill) · ปุ่มแคปซูล · navigation bar มี pill
//  • สวิตช์ M3 · bottom sheet · แถบความคืบหน้าแบบคลื่น · โมชันสปริง
//  ใช้ร่วมกับโทเค็น T ใน App.jsx (T.* อ่านจาก --md-* ที่ตั้งไว้ที่นี่)
// ═══════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from "react";

// ── 1) สีไดนามิก ───────────────────────────────────────
// ธีมที่ซื้อในร้าน → hue หลัก (องศา oklch) · space = โหมดมืด
export const THEME_SEEDS = {
  aurora: { h: 295, dark: false }, ocean: { h: 215, dark: false }, forest: { h: 145, dark: false },
  sunset: { h: 40, dark: false }, candy: { h: 345, dark: false }, space: { h: 285, dark: true },
};
const ok = (l, c, h) => `oklch(${l} ${c} ${((h % 360) + 360) % 360})`;
export function m3Roles(h, dark) {
  const h2 = h + 60, h3 = h - 40;   // tertiary = hue เสริม · accent ที่สาม
  if (!dark) return {
    primary: ok(0.5, 0.17, h), onPrimary: "#ffffff", primaryContainer: ok(0.92, 0.07, h), onPrimaryContainer: ok(0.28, 0.1, h),
    secondary: ok(0.5, 0.06, h), onSecondary: "#ffffff", secondaryContainer: ok(0.91, 0.045, h), onSecondaryContainer: ok(0.28, 0.06, h),
    tertiary: ok(0.52, 0.13, h2), onTertiary: "#ffffff", tertiaryContainer: ok(0.92, 0.07, h2), onTertiaryContainer: ok(0.28, 0.09, h2),
    accent: ok(0.62, 0.17, h3), accentContainer: ok(0.93, 0.06, h3),
    error: "oklch(0.55 0.2 27)", onError: "#ffffff", errorContainer: "oklch(0.93 0.05 27)", onErrorContainer: "oklch(0.3 0.12 27)",
    ok: "oklch(0.56 0.15 150)", okContainer: "oklch(0.92 0.08 150)", onOkContainer: "oklch(0.28 0.09 150)",
    surface: ok(0.985, 0.006, h), surfaceDim: ok(0.9, 0.012, h), surfaceBright: ok(0.985, 0.006, h),
    surfaceContainerLowest: "#ffffff", surfaceContainerLow: ok(0.972, 0.008, h), surfaceContainer: ok(0.957, 0.01, h),
    surfaceContainerHigh: ok(0.94, 0.012, h), surfaceContainerHighest: ok(0.92, 0.014, h),
    onSurface: ok(0.2, 0.02, h), onSurfaceVariant: ok(0.42, 0.03, h), outline: ok(0.6, 0.025, h), outlineVariant: ok(0.85, 0.02, h),
    inverseSurface: ok(0.25, 0.02, h), inverseOnSurface: ok(0.95, 0.01, h), inversePrimary: ok(0.82, 0.1, h),
    scrim: "rgba(0,0,0,.45)", shadow: "0 1px 3px rgba(0,0,0,.12), 0 6px 18px rgba(0,0,0,.08)",
    heroGrad: `linear-gradient(135deg, ${ok(0.55, 0.18, h)}, ${ok(0.6, 0.17, h2)})`,
  };
  return {
    primary: ok(0.82, 0.12, h), onPrimary: ok(0.3, 0.12, h), primaryContainer: ok(0.4, 0.12, h), onPrimaryContainer: ok(0.93, 0.05, h),
    secondary: ok(0.8, 0.05, h), onSecondary: ok(0.3, 0.06, h), secondaryContainer: ok(0.38, 0.05, h), onSecondaryContainer: ok(0.92, 0.04, h),
    tertiary: ok(0.82, 0.1, h2), onTertiary: ok(0.3, 0.1, h2), tertiaryContainer: ok(0.4, 0.1, h2), onTertiaryContainer: ok(0.93, 0.05, h2),
    accent: ok(0.78, 0.14, h3), accentContainer: ok(0.4, 0.09, h3),
    error: "oklch(0.8 0.1 27)", onError: "oklch(0.3 0.12 27)", errorContainer: "oklch(0.38 0.13 27)", onErrorContainer: "oklch(0.93 0.05 27)",
    ok: "oklch(0.8 0.12 150)", okContainer: "oklch(0.36 0.09 150)", onOkContainer: "oklch(0.93 0.05 150)",
    surface: ok(0.17, 0.015, h), surfaceDim: ok(0.17, 0.015, h), surfaceBright: ok(0.3, 0.02, h),
    surfaceContainerLowest: ok(0.13, 0.015, h), surfaceContainerLow: ok(0.2, 0.017, h), surfaceContainer: ok(0.23, 0.018, h),
    surfaceContainerHigh: ok(0.27, 0.02, h), surfaceContainerHighest: ok(0.3, 0.022, h),
    onSurface: ok(0.93, 0.01, h), onSurfaceVariant: ok(0.8, 0.02, h), outline: ok(0.6, 0.02, h), outlineVariant: ok(0.36, 0.02, h),
    inverseSurface: ok(0.93, 0.01, h), inverseOnSurface: ok(0.25, 0.02, h), inversePrimary: ok(0.5, 0.17, h),
    scrim: "rgba(0,0,0,.6)", shadow: "0 1px 3px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35)",
    heroGrad: `linear-gradient(135deg, ${ok(0.42, 0.14, h)}, ${ok(0.45, 0.13, h2)})`,
  };
}
const kebab = s => s.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
// ตั้ง CSS var ทั้งชุด (+ ตัวแปร --vp-* เดิม ให้โค้ดเก่าได้สีใหม่อัตโนมัติ)
export function applyM3Theme(themeId = "aurora") {
  if (typeof document === "undefined") return;
  const seed = THEME_SEEDS[themeId] || THEME_SEEDS.aurora;
  const r = m3Roles(seed.h, seed.dark);
  const st = document.documentElement.style;
  for (const k in r) st.setProperty(`--md-${kebab(k)}`, r[k]);
  st.setProperty("--vp-bg", r.surface); st.setProperty("--vp-card", r.surfaceContainerLowest);
  st.setProperty("--vp-ink", r.onSurface); st.setProperty("--vp-ink2", r.onSurfaceVariant); st.setProperty("--vp-ink3", r.outline);
  st.setProperty("--vp-grad", r.heroGrad);
  document.documentElement.setAttribute("data-theme", themeId);
  document.documentElement.setAttribute("data-dark", seed.dark ? "1" : "0");
  document.documentElement.style.colorScheme = seed.dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", seed.dark ? "#1a1726" : "#ffffff");
}
export const isDarkTheme = id => !!(THEME_SEEDS[id] || THEME_SEEDS.aurora).dark;

// ── 2) โทเค็น M3 ───────────────────────────────────────
const v = k => `var(--md-${k})`;
export const MD = {
  primary: v("primary"), onPrimary: v("on-primary"), primaryC: v("primary-container"), onPrimaryC: v("on-primary-container"),
  secondary: v("secondary"), onSecondary: v("on-secondary"), secondaryC: v("secondary-container"), onSecondaryC: v("on-secondary-container"),
  tertiary: v("tertiary"), onTertiary: v("on-tertiary"), tertiaryC: v("tertiary-container"), onTertiaryC: v("on-tertiary-container"),
  accent: v("accent"), accentC: v("accent-container"),
  error: v("error"), onError: v("on-error"), errorC: v("error-container"), onErrorC: v("on-error-container"),
  ok: v("ok"), okC: v("ok-container"), onOkC: v("on-ok-container"),
  surface: v("surface"), surfDim: v("surface-dim"), surfLowest: v("surface-container-lowest"), surfLow: v("surface-container-low"),
  surf: v("surface-container"), surfHigh: v("surface-container-high"), surfHighest: v("surface-container-highest"),
  onSurface: v("on-surface"), onSurfaceV: v("on-surface-variant"), outline: v("outline"), outlineV: v("outline-variant"),
  inverseSurface: v("inverse-surface"), inverseOnSurface: v("inverse-on-surface"), scrim: v("scrim"), shadow: v("shadow"), heroGrad: v("hero-grad"),
  // shape scale (M3 Expressive ใช้มุมใหญ่)
  rXS: 8, rS: 12, rM: 16, rL: 24, rXL: 28, rXXL: 36, rFull: 999,
  // motion: spring (expressive) · standard
  spring: "cubic-bezier(.34,1.56,.64,1)", emph: "cubic-bezier(.2,0,0,1)", quick: "cubic-bezier(.3,0,.8,.15)",
};
export const FONT = "'Prompt', 'Noto Sans Thai', 'Roboto', system-ui, -apple-system, sans-serif";
// type scale (ปรับขนาดสำหรับเด็ก/ภาษาไทย)
export const TYPE = {
  displayS: { fontSize:36, lineHeight:1.15, fontWeight:700, letterSpacing:-0.5 },
  headlineL: { fontSize:30, lineHeight:1.2, fontWeight:700, letterSpacing:-0.3 },
  headlineM: { fontSize:26, lineHeight:1.2, fontWeight:700 },
  headlineS: { fontSize:22, lineHeight:1.25, fontWeight:700 },
  titleL: { fontSize:20, lineHeight:1.3, fontWeight:600 },
  titleM: { fontSize:16, lineHeight:1.4, fontWeight:600 },
  titleS: { fontSize:14, lineHeight:1.4, fontWeight:600 },
  bodyL: { fontSize:16, lineHeight:1.5, fontWeight:400 },
  bodyM: { fontSize:14, lineHeight:1.5, fontWeight:400 },
  bodyS: { fontSize:12, lineHeight:1.45, fontWeight:400 },
  labelL: { fontSize:14, lineHeight:1.3, fontWeight:600 },
  labelM: { fontSize:12, lineHeight:1.3, fontWeight:600 },
  labelS: { fontSize:11, lineHeight:1.3, fontWeight:600 },
};

// ── 3) สไตล์สำเร็จรูป ──────────────────────────────────
const base = { border:"none", cursor:"pointer", fontFamily:FONT, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, transition:`transform .18s ${MD.spring}, background .2s, box-shadow .2s` };
export const M3 = {
  // ปุ่ม (ทรงแคปซูล · ขนาด M = 40 / L = 56 ตาม expressive)
  filled: (extra = {}) => ({ ...base, background:MD.primary, color:MD.onPrimary, borderRadius:MD.rFull, minHeight:48, padding:"0 24px", ...TYPE.labelL, boxShadow:"none", ...extra }),
  tonal: (extra = {}) => ({ ...base, background:MD.secondaryC, color:MD.onSecondaryC, borderRadius:MD.rFull, minHeight:48, padding:"0 22px", ...TYPE.labelL, ...extra }),
  tertiaryBtn: (extra = {}) => ({ ...base, background:MD.tertiaryC, color:MD.onTertiaryC, borderRadius:MD.rFull, minHeight:48, padding:"0 22px", ...TYPE.labelL, ...extra }),
  outlined: (extra = {}) => ({ ...base, background:"transparent", color:MD.primary, border:`1px solid ${MD.outline}`, borderRadius:MD.rFull, minHeight:48, padding:"0 22px", ...TYPE.labelL, ...extra }),
  text: (extra = {}) => ({ ...base, background:"transparent", color:MD.primary, borderRadius:MD.rFull, minHeight:44, padding:"0 14px", ...TYPE.labelL, ...extra }),
  elevated: (extra = {}) => ({ ...base, background:MD.surfLowest, color:MD.primary, borderRadius:MD.rFull, minHeight:48, padding:"0 22px", ...TYPE.labelL, boxShadow:MD.shadow, ...extra }),
  iconBtn: (extra = {}) => ({ ...base, width:48, height:48, borderRadius:MD.rFull, background:"transparent", color:MD.onSurfaceV, fontSize:22, padding:0, ...extra }),
  iconTonal: (extra = {}) => ({ ...base, width:48, height:48, borderRadius:MD.rFull, background:MD.secondaryC, color:MD.onSecondaryC, fontSize:20, padding:0, ...extra }),
  fab: (extra = {}) => ({ ...base, minHeight:56, padding:"0 20px", borderRadius:MD.rM, background:MD.primaryC, color:MD.onPrimaryC, ...TYPE.titleM, boxShadow:MD.shadow, ...extra }),
  // การ์ด
  card: (extra = {}) => ({ background:MD.surfLow, borderRadius:MD.rXL, color:MD.onSurface, ...extra }),
  cardHigh: (extra = {}) => ({ background:MD.surfHigh, borderRadius:MD.rXL, color:MD.onSurface, ...extra }),
  cardElev: (extra = {}) => ({ background:MD.surfLowest, borderRadius:MD.rXL, boxShadow:MD.shadow, color:MD.onSurface, ...extra }),
  cardOutl: (extra = {}) => ({ background:MD.surface, borderRadius:MD.rXL, border:`1px solid ${MD.outlineV}`, color:MD.onSurface, ...extra }),
  chip: (on = false, extra = {}) => ({ ...base, minHeight:32, padding:"0 12px", borderRadius:MD.rXS, ...TYPE.labelL, background:on ? MD.secondaryC : "transparent", color:on ? MD.onSecondaryC : MD.onSurfaceV, border:`1px solid ${on ? "transparent" : MD.outlineV}`, ...extra }),
  assist: (extra = {}) => ({ display:"inline-flex", alignItems:"center", gap:6, minHeight:36, padding:"0 12px", borderRadius:MD.rFull, background:MD.surfHigh, color:MD.onSurface, ...TYPE.labelL, ...extra }),
  listItem: (extra = {}) => ({ display:"flex", alignItems:"center", gap:14, minHeight:72, padding:"12px 16px", width:"100%", textAlign:"left", cursor:"pointer", border:"none", background:MD.surfLow, color:MD.onSurface, fontFamily:FONT, borderRadius:MD.rL, ...extra }),
  sectionTitle: (extra = {}) => ({ ...TYPE.titleM, color:MD.onSurfaceV, margin:"18px 4px 10px", ...extra }),
};

// ── 4) รูปทรง expressive (M3 shapes) ───────────────────
// คืน path ใน viewBox 0 0 100 100 · cookie = วงกลมหยัก n กลีบ · clover = 4 กลีบ · burst = ดาวมน · pill = แคปซูล
function cookiePath(n = 12, amp = 0.09) {
  const pts = []; const N = n * 8;
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const r = 46 * (1 + amp * Math.cos(n * a)); pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]); }
  return "M" + pts.map(p => p.map(x => x.toFixed(2)).join(" ")).join("L") + "Z";
}
export const SHAPE_PATHS = {
  cookie12: cookiePath(12, 0.08), cookie9: cookiePath(9, 0.1), cookie6: cookiePath(6, 0.12), cookie4: cookiePath(4, 0.16),
  clover: "M50 4 C70 4 76 20 76 30 C86 30 96 36 96 50 C96 64 86 70 76 70 C76 80 70 96 50 96 C30 96 24 80 24 70 C14 70 4 64 4 50 C4 36 14 30 24 30 C24 20 30 4 50 4Z",
  burst: cookiePath(8, 0.2), sunny: cookiePath(16, 0.06), pill: "M30 10 H70 A40 40 0 0 1 70 90 H30 A40 40 0 0 1 30 10Z", circle: "M50 4 A46 46 0 1 1 49.99 4Z",
  arch: "M8 96 V50 A42 42 0 0 1 92 50 V96 Z", diamond: "M50 4 C60 30 70 40 96 50 C70 60 60 70 50 96 C40 70 30 60 4 50 C30 40 40 30 50 4Z",
};
// <Shape kind="cookie12" size={96} fill={MD.primaryC} morph> พื้นทรง expressive · morph = สลับทรงช้าๆ
export function Shape({ kind = "cookie12", size = 96, fill = MD.primaryC, morph = false, spin = false, style = {}, children }) {
  const kinds = morph ? ["cookie12", "clover", "burst", "cookie6"] : [kind];
  const [i, setI] = useState(0);
  useEffect(() => { if (!morph) return; const t = setInterval(() => setI(x => (x + 1) % kinds.length), 2600); return () => clearInterval(t); }, [morph]);
  const d = SHAPE_PATHS[morph ? kinds[i] : kind] || SHAPE_PATHS.circle;
  return (
    <span style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center", width:size, height:size, flexShrink:0, ...style }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position:"absolute", inset:0, animation: spin ? "m3Spin 24s linear infinite" : "none" }}>
        <path d={d} fill={fill} style={{ transition:`d 1.2s ${MD.emph}` }} />
      </svg>
      <span style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>{children}</span>
    </span>
  );
}

// ── 5) คอมโพเนนต์ ──────────────────────────────────────
// สวิตช์ M3 (52×32 · thumb มีไอคอน ✓)
export function M3Switch({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{ width:60, height:44, background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ width:52, height:32, borderRadius:999, background: on ? MD.primary : MD.surfHighest, border:`2px solid ${on ? MD.primary : MD.outline}`, position:"relative", display:"block", transition:"background .2s, border-color .2s" }}>
        <span style={{ position:"absolute", top:"50%", left: on ? 22 : 4, width: on ? 24 : 16, height: on ? 24 : 16, marginTop: on ? -12 : -8, borderRadius:"50%", background: on ? MD.onPrimary : MD.outline, transition:`left .25s ${MD.spring}, width .2s, height .2s, margin .2s`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {on && <svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill={MD.primary} /></svg>}
        </span>
      </span>
    </button>
  );
}

// ไอคอนแถบนำทาง (Material Symbols แบบย่อ: outlined / filled)
const NavIcon = ({ id, on }) => {
  const c = "currentColor";
  switch (id) {
    case "home": return <svg width="24" height="24" viewBox="0 0 24 24">{on ? <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" fill={c} /> : <path d="M12 5.7 18 10.6V19h-3v-6H9v6H6v-8.4l6-4.9m0-2.6L4 9.5V21h7v-6h2v6h7V9.5z" fill={c} />}</svg>;
    case "learnhub": return <svg width="24" height="24" viewBox="0 0 24 24">{on ? <path d="M21 5c-1.1-.4-2.3-.5-3.5-.5-1.9 0-4 .4-5.5 1.5-1.5-1.1-3.6-1.5-5.5-1.5S2.5 4.9 1 6v14.6c0 .3.3.5.5.5.1 0 .2 0 .2-.1 1.4-.6 3.4-1 4.8-1 1.9 0 4 .4 5.5 1.5 1.4-.9 3.9-1.5 5.5-1.5 1.7 0 3.4.3 4.8 1.1.1.1.2.1.3.1.3 0 .5-.3.5-.5V6c-.7-.4-1.4-.8-2.1-1z" fill={c} /> : <path d="M21 5c-1.1-.4-2.3-.5-3.5-.5-1.9 0-4 .4-5.5 1.5-1.5-1.1-3.6-1.5-5.5-1.5S2.5 4.9 1 6v14.6c0 .3.3.5.5.5.1 0 .2 0 .2-.1 1.4-.6 3.4-1 4.8-1 1.9 0 4 .4 5.5 1.5 1.4-.9 3.9-1.5 5.5-1.5 1.7 0 3.4.3 4.8 1.1.1.1.2.1.3.1.3 0 .5-.3.5-.5V6c-.7-.4-1.4-.8-2.1-1zm0 13.5c-1.1-.3-2.3-.5-3.5-.5-1.7 0-4.1.6-5.5 1.5V8c1.4-.9 3.8-1.5 5.5-1.5 1.2 0 2.4.2 3.5.5z" fill={c} />}</svg>;
    case "playhub": return <svg width="24" height="24" viewBox="0 0 24 24">{on ? <path d="M21.6 9.6c-.3-2.3-2.3-4.1-4.6-4.1H7c-2.3 0-4.3 1.8-4.6 4.1L1.5 16.4c-.2 1.4.9 2.6 2.3 2.6.6 0 1.2-.2 1.6-.7L8.5 15h7l3.1 3.3c.4.4 1 .7 1.6.7 1.4 0 2.5-1.2 2.3-2.6zM9 12H7.5v1.5h-1V12H5v-1h1.5V9.5h1V11H9zm6.5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm2.5-2a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill={c} /> : <path d="M21.6 9.6c-.3-2.3-2.3-4.1-4.6-4.1H7c-2.3 0-4.3 1.8-4.6 4.1L1.5 16.4c-.2 1.4.9 2.6 2.3 2.6.6 0 1.2-.2 1.6-.7L8.5 15h7l3.1 3.3c.4.4 1 .7 1.6.7 1.4 0 2.5-1.2 2.3-2.6zM4.2 17c-.2.2-.6.1-.7-.2v-.3l.9-6.8c.2-1.3 1.3-2.2 2.6-2.2h10c1.3 0 2.4.9 2.6 2.2l.9 6.8c0 .3-.2.5-.5.5h-.2L16 13H8zM9 12H7.5v1.5h-1V12H5v-1h1.5V9.5h1V11H9zm6.5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm2.5-2a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill={c} />}</svg>;
    default: return <svg width="24" height="24" viewBox="0 0 24 24">{on ? <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z" fill={c} /> : <path d="M12 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4m0 10c2.7 0 5.8 1.3 6 2H6c.2-.7 3.3-2 6-2m0-12a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z" fill={c} />}</svg>;
  }
};
// Navigation bar M3: เต็มความกว้าง สูง 80 · ตัวที่เลือกมี pill (secondaryContainer) หลังไอคอน
export function M3NavBar({ tabs, tab, onTab }) {
  return (
    <nav style={{ position:"fixed", left:0, right:0, bottom:0, zIndex:120, background:MD.surf, paddingBottom:"env(safe-area-inset-bottom, 0px)", boxShadow:"0 -1px 0 var(--md-outline-variant)" }}>
      <div style={{ maxWidth:560, margin:"0 auto", display:"flex", height:80 }}>
        {tabs.map(([k, label]) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => onTab(k)} aria-current={on ? "page" : undefined} style={{ flex:1, border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, fontFamily:FONT, color: on ? MD.onSurface : MD.onSurfaceV, padding:"12px 0 16px" }}>
              <span style={{ width:64, height:32, borderRadius:999, display:"flex", alignItems:"center", justifyContent:"center", background: on ? MD.secondaryC : "transparent", color: on ? MD.onSecondaryC : MD.onSurfaceV, transition:`background .25s, transform .3s ${MD.spring}`, transform: on ? "scale(1)" : "scale(.92)" }}>
                <NavIcon id={k} on={on} />
              </span>
              <span style={{ ...TYPE.labelM, fontWeight: on ? 700 : 600 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Top app bar M3 (small / centered) · โปร่งบน surface · ปุ่มไอคอน 48
export function M3TopBar({ title, onBack, actions, large = false }) {
  return (
    <header style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"color-mix(in oklab, var(--md-surface) 88%, transparent)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:4, padding:"calc(env(safe-area-inset-top, 0px) + 6px) 8px 6px", maxWidth:560, margin:"0 auto", minHeight:64 }}>
        {onBack ? <button onClick={onBack} aria-label="ย้อนกลับ" style={M3.iconBtn()}><svg width="24" height="24" viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" fill="currentColor" /></svg></button> : <span style={{ width:8 }} />}
        <div style={{ flex:1, minWidth:0, ...(large ? TYPE.headlineS : TYPE.titleL), color:MD.onSurface, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingLeft:4 }}>{title}</div>
        {actions}
      </div>
    </header>
  );
}

// Bottom sheet M3: surfaceContainerLow · มุมบน 28 · drag handle 32×4
export function M3Sheet({ onClose, children, maxWidth = 560, z = 200 }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:z, display:"flex", flexDirection:"column", justifyContent:"flex-end", background:MD.scrim, animation:"m3Fade .2s both" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:MD.surfLow, color:MD.onSurface, borderRadius:`${MD.rXL}px ${MD.rXL}px 0 0`, padding:"8px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)", maxWidth, width:"100%", margin:"0 auto", maxHeight:"92dvh", overflowY:"auto", animation:`m3SheetUp .35s ${MD.emph} both` }}>
        <div style={{ width:32, height:4, background:MD.onSurfaceV, opacity:.4, borderRadius:999, margin:"6px auto 14px" }} />
        {children}
      </div>
    </div>
  );
}

// แถบความคืบหน้าแบบคลื่น (M3 Expressive wavy linear progress)
export function WavyProgress({ value = 0, height = 14, color = MD.primary, track = MD.secondaryC, style = {} }) {
  const pct = Math.max(0, Math.min(100, value));
  const id = useRef("w" + Math.random().toString(36).slice(2, 8)).current;
  const amp = height * 0.28, period = height * 1.6;
  let d = `M0 ${height / 2}`; for (let x = 0; x <= 400; x += period / 2) d += ` Q${x + period / 4} ${height / 2 + (Math.floor(x / (period / 2)) % 2 ? amp : -amp)} ${x + period / 2} ${height / 2}`;
  return (
    <div style={{ position:"relative", height, width:"100%", ...style }}>
      <svg width="100%" height={height} preserveAspectRatio="none" viewBox={`0 0 100 ${height}`} style={{ position:"absolute", inset:0, overflow:"visible" }}>
        <line x1={`${pct + 2}`} y1={height / 2} x2="100" y2={height / 2} stroke={track} strokeWidth={height * 0.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx="99.5" cy={height / 2} r={height * 0.18} fill={color} />
      </svg>
      <svg width={`${pct}%`} height={height} viewBox={`0 0 400 ${height}`} preserveAspectRatio="none" style={{ position:"absolute", left:0, top:0, overflow:"hidden", transition:"width .6s cubic-bezier(.2,0,0,1)" }}>
        <defs><clipPath id={id}><rect x="0" y="-4" width="400" height={height + 8} /></clipPath></defs>
        <g clipPath={`url(#${id})`} style={{ animation:"m3Wave 1.6s linear infinite" }}>
          <path d={d} fill="none" stroke={color} strokeWidth={height * 0.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} transform={`translate(${period * 2} 0)`} fill="none" stroke={color} strokeWidth={height * 0.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}

// กลุ่มปุ่มเชื่อมกัน (Expressive connected button group)
export function ButtonGroup({ items, style = {} }) {
  return (
    <div style={{ display:"flex", gap:2, width:"100%", ...style }}>
      {items.map(([label, onClick, on], i) => {
        const first = i === 0, last = i === items.length - 1;
        return <button key={i} onClick={onClick} style={{ ...base, flex:1, minHeight:48, padding:"0 10px", ...TYPE.labelL, background: on ? MD.primary : MD.secondaryC, color: on ? MD.onPrimary : MD.onSecondaryC, borderRadius: `${first ? 24 : 8}px ${last ? 24 : 8}px ${last ? 24 : 8}px ${first ? 24 : 8}px`, whiteSpace:"nowrap" }}>{label}</button>;
      })}
    </div>
  );
}

// ── 6) CSS กลาง (keyframes + ripple state layer) ───────
export const M3_CSS = `
@keyframes m3Fade { from { opacity:0 } to { opacity:1 } }
@keyframes m3SheetUp { from { transform: translateY(40px); opacity:.6 } to { transform:none; opacity:1 } }
@keyframes m3Spin { to { transform: rotate(360deg) } }
@keyframes m3Wave { to { transform: translateX(-${100}px) } }
@keyframes m3Pop { 0% { transform: scale(.6); opacity:0 } 60% { transform: scale(1.08) } 100% { transform: scale(1); opacity:1 } }
button { -webkit-tap-highlight-color: transparent; }
.m3-press { transition: transform .18s cubic-bezier(.34,1.56,.64,1) !important; }
.m3-press:active { transform: scale(.95) !important; }
@media (prefers-reduced-motion: reduce) { .m3-press, .m3-press:active { transform: none !important; } }
`;
export function injectM3Css() {
  if (typeof document === "undefined" || document.getElementById("m3-css")) return;
  const st = document.createElement("style"); st.id = "m3-css"; st.textContent = M3_CSS; document.head.appendChild(st);
}

// ═══════════════════════════════════════════════════════
// FX — ชั้นเอฟเฟกต์/แอนิเมชัน "อลังการ" ของแอป
//  · fx.burst(x,y)  ระเบิดดาว/อนุภาคที่ตำแหน่งแตะ
//  · fx.float(x,y,"+1 ⭐") ตัวเลขลอยขึ้น
//  · fx.shake()     สั่นจอ (ตอบผิด)
//  · fx.flash(color) แสงวาบเต็มจอ (เลเวลอัป/ชนะ)
//  · fx.confetti()  คอนเฟตตีฝน
//  · <Ambient/>     พื้นหลังมีชีวิต: ออโรราไหล + อนุภาคลอย
//  · <Reveal/>      ลูกๆ เลื่อนเข้าทีละอันแบบ stagger
//  · ใช้ CSS animation + DOM โดยตรง ไม่เพิ่มไลบรารี · ปิดได้ (โหมดประหยัด / prefers-reduced-motion)
// ═══════════════════════════════════════════════════════
import { useEffect, useRef, useState, Children, cloneElement, isValidElement } from "react";

let enabled = true;
export const setFxEnabled = v => { enabled = !!v; };
export const fxEnabled = () => enabled && !(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

let layer = null;
function getLayer() {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement("div");
  layer.id = "vp-fx-layer";
  Object.assign(layer.style, { position:"fixed", inset:0, pointerEvents:"none", zIndex:9400, overflow:"hidden" });
  document.body.appendChild(layer);
  return layer;
}
const rm = (el, ms) => setTimeout(() => el.remove(), ms);
const vibrate = p => { try { navigator.vibrate?.(p); } catch (_) {} };

const PALETTE = ["#ffd166","#ff6fae","#6d5dfc","#22d3ee","#34d399","#fb923c","#f43f5e","#a855f7"];
const SHAPES = ["⭐","✨","💫","⭐","🌟"];

export const fx = {
  // ระเบิดอนุภาค + ดาว ที่พิกัดหน้าจอ (ถ้าไม่ส่งพิกัด = กลางจอ)
  burst(x, y, opt = {}) {
    if (!fxEnabled()) return;
    const L = getLayer(); const cx = x ?? innerWidth / 2, cy = y ?? innerHeight / 2;
    const n = opt.count ?? 18;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("span");
      const star = i % 3 === 0;
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5, dist = 60 + Math.random() * 90;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30;
      el.textContent = star ? SHAPES[i % SHAPES.length] : "";
      Object.assign(el.style, { position:"absolute", left:cx + "px", top:cy + "px", width:star?"auto":"10px", height:star?"auto":"10px",
        fontSize: (14 + Math.random() * 14) + "px", lineHeight:1, borderRadius:"50%", background: star ? "transparent" : PALETTE[i % PALETTE.length],
        transform:"translate(-50%,-50%)", willChange:"transform,opacity", filter: star ? "drop-shadow(0 0 6px rgba(255,209,102,.9))" : "none" });
      el.animate([
        { transform:"translate(-50%,-50%) scale(.4) rotate(0deg)", opacity:1 },
        { transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1) rotate(${Math.random()*360}deg)`, opacity:1, offset:.6 },
        { transform:`translate(calc(-50% + ${dx*1.2}px), calc(-50% + ${dy*1.2 + 60}px)) scale(.2) rotate(${Math.random()*720}deg)`, opacity:0 },
      ], { duration: 700 + Math.random() * 400, easing:"cubic-bezier(.2,.8,.3,1)", fill:"forwards" });
      L.appendChild(el); rm(el, 1200);
    }
    // วงแหวนขยาย
    const ring = document.createElement("span");
    Object.assign(ring.style, { position:"absolute", left:cx + "px", top:cy + "px", width:"20px", height:"20px", borderRadius:"50%", border:`4px solid ${opt.color || "#ffd166"}`, transform:"translate(-50%,-50%)", boxShadow:`0 0 24px ${opt.color || "#ffd166"}` });
    ring.animate([{ transform:"translate(-50%,-50%) scale(.5)", opacity:.9 }, { transform:"translate(-50%,-50%) scale(7)", opacity:0 }], { duration:600, easing:"ease-out", fill:"forwards" });
    L.appendChild(ring); rm(ring, 700);
    vibrate(opt.vibrate ?? 15);
  },
  // ข้อความลอยขึ้น (เช่น +1 ⭐ · +10 🪙 · Perfect!)
  float(x, y, text, opt = {}) {
    if (!fxEnabled()) return;
    const L = getLayer(); const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, { position:"absolute", left:(x ?? innerWidth/2) + "px", top:(y ?? innerHeight/2) + "px", transform:"translate(-50%,-50%)",
      fontFamily:"'Prompt', system-ui, sans-serif", fontWeight:900, fontSize:(opt.size || 26) + "px", color: opt.color || "#fff",
      textShadow:"0 2px 0 rgba(0,0,0,.25), 0 0 18px rgba(255,209,102,.8)", whiteSpace:"nowrap", willChange:"transform,opacity" });
    el.animate([
      { transform:"translate(-50%,-50%) scale(.6)", opacity:0 },
      { transform:"translate(-50%,-90%) scale(1.25)", opacity:1, offset:.25 },
      { transform:"translate(-50%,-180%) scale(1)", opacity:0 },
    ], { duration: opt.duration || 1100, easing:"cubic-bezier(.2,.8,.3,1)", fill:"forwards" });
    L.appendChild(el); rm(el, (opt.duration || 1100) + 50);
  },
  // สั่นจอ (ตอบผิด)
  shake(strength = 8) {
    if (!fxEnabled()) return;
    const root = document.getElementById("root"); if (!root) return;
    root.animate([
      { transform:"translateX(0)" }, { transform:`translateX(-${strength}px)` }, { transform:`translateX(${strength}px)` },
      { transform:`translateX(-${strength*0.6}px)` }, { transform:`translateX(${strength*0.6}px)` }, { transform:"translateX(0)" },
    ], { duration: 380, easing:"ease-in-out" });
    this.flash("rgba(244,63,94,0.28)", 260);
    vibrate([30, 40, 30]);
  },
  // แสงวาบเต็มจอ
  flash(color = "rgba(255,255,255,0.7)", ms = 500) {
    if (!fxEnabled()) return;
    const L = getLayer(); const el = document.createElement("div");
    Object.assign(el.style, { position:"absolute", inset:0, background:color });
    el.animate([{ opacity:1 }, { opacity:0 }], { duration: ms, easing:"ease-out", fill:"forwards" });
    L.appendChild(el); rm(el, ms + 20);
  },
  // รัศมีแสงพุ่ง (เลเวลอัป / ชนะบอส)
  rays(color = "#ffd166") {
    if (!fxEnabled()) return;
    const L = getLayer(); const el = document.createElement("div");
    Object.assign(el.style, { position:"absolute", left:"50%", top:"50%", width:"240vmax", height:"240vmax", transform:"translate(-50%,-50%) rotate(0deg)",
      background:`repeating-conic-gradient(from 0deg, ${color}33 0deg 12deg, transparent 12deg 30deg)`, borderRadius:"50%", mixBlendMode:"screen" });
    el.animate([{ transform:"translate(-50%,-50%) rotate(0deg) scale(.2)", opacity:0 }, { opacity:.9, offset:.2 }, { transform:"translate(-50%,-50%) rotate(60deg) scale(1)", opacity:0 }], { duration:1600, easing:"ease-out", fill:"forwards" });
    L.appendChild(el); rm(el, 1700);
  },
  // คอนเฟตตีฝน (ใช้ DOM แทน component เพื่อเรียกจากที่ไหนก็ได้)
  confetti(count = 90) {
    if (!fxEnabled()) return;
    const L = getLayer();
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      const s = 6 + Math.random() * 8, left = Math.random() * 100, dur = 1800 + Math.random() * 1600, delay = Math.random() * 600;
      const round = i % 3 === 0, ribbon = i % 5 === 0;
      Object.assign(el.style, { position:"absolute", top:"-20px", left:left + "%", width:s + "px", height:(round ? s : ribbon ? s * 3 : s * 1.6) + "px",
        background:PALETTE[i % PALETTE.length], borderRadius: round ? "50%" : "2px", opacity:0, willChange:"transform,opacity" });
      el.animate([
        { transform:`translate(0,0) rotate(0deg)`, opacity:1 },
        { transform:`translate(${(Math.random()-0.5)*160}px, ${innerHeight*0.55}px) rotate(${360+Math.random()*360}deg)`, opacity:1, offset:.55 },
        { transform:`translate(${(Math.random()-0.5)*260}px, ${innerHeight+40}px) rotate(${720+Math.random()*720}deg)`, opacity:.8 },
      ], { duration: dur, delay, easing:"cubic-bezier(.3,.6,.4,1)", fill:"forwards" });
      L.appendChild(el); rm(el, dur + delay + 50);
    }
  },
  // ชุดสำเร็จรูป
  correct(e, text = "+1 ⭐") {
    const p = pointOf(e); this.burst(p.x, p.y); this.float(p.x, p.y - 20, text, { color:"#fff" });
  },
  wrong() { this.shake(); },
  win(stars = 3) { this.confetti(stars >= 3 ? 140 : 90); if (stars >= 3) this.rays("#ffd166"); this.flash("rgba(255,255,255,0.55)", 600); vibrate([40, 60, 40, 60, 120]); },
  levelUp() { this.rays("#a855f7"); this.flash("rgba(168,85,247,0.35)", 700); this.confetti(80); this.float(innerWidth/2, innerHeight*0.35, "LEVEL UP!", { size:40, color:"#ffd166", duration:1600 }); vibrate([60, 40, 60, 40, 200]); },
};
// หาพิกัดจาก event / element / {x,y}
function pointOf(e) {
  // ไม่ส่ง event มา → ใช้ตำแหน่งที่แตะล่าสุด (ภายใน 1.5 วิ) ไม่งั้นกลางจอ
  if (!e) return (lastPt && performance.now() - lastPt.t < 1500) ? lastPt : { x: innerWidth / 2, y: innerHeight / 2 };
  if (typeof e.x === "number") return e;
  const t = e.currentTarget || e.target;
  if (e.clientX != null && e.clientX > 0) return { x: e.clientX, y: e.clientY };
  if (t?.getBoundingClientRect) { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  return { x: innerWidth / 2, y: innerHeight / 2 };
}
export const fxPoint = pointOf;

// ── Ripple บนปุ่มทุกปุ่ม (event delegation ครั้งเดียว) ──
let lastPt = null;
let rippleInstalled = false;
export function installRipple() {
  if (rippleInstalled || typeof document === "undefined") return; rippleInstalled = true;
  document.addEventListener("pointerdown", e => {
    lastPt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!fxEnabled()) return;
    const b = e.target.closest?.("button"); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(); const d = Math.max(r.width, r.height) * 1.6;
    const s = document.createElement("span");
    Object.assign(s.style, { position:"absolute", left:(e.clientX - r.left - d/2) + "px", top:(e.clientY - r.top - d/2) + "px", width:d + "px", height:d + "px", borderRadius:"50%",
      background:"radial-gradient(circle, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 70%)", pointerEvents:"none", transform:"scale(0)", mixBlendMode:"screen" });
    const pos = getComputedStyle(b).position; if (pos === "static") b.style.position = "relative";
    if (getComputedStyle(b).overflow === "visible") b.style.overflow = "hidden";
    b.appendChild(s);
    s.animate([{ transform:"scale(0)", opacity:1 }, { transform:"scale(1)", opacity:0 }], { duration:520, easing:"ease-out", fill:"forwards" });
    rm(s, 560);
  }, { passive: true });
}

// ── พื้นหลังมีชีวิต: ออโรราไหลช้าๆ + อนุภาคลอย (canvas เบา ~30 จุด) ──
export function Ambient({ intensity = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!fxEnabled()) return;
    const c = ref.current; const ctx = c.getContext("2d"); let raf, W, H;
    const dots = Array.from({ length: Math.round(28 * intensity) }, () => ({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 3, s: 0.0002 + Math.random() * 0.0005, o: 0.15 + Math.random() * 0.35, h: Math.random() * 360, dx: (Math.random() - 0.5) * 0.0003 }));
    const resize = () => { W = c.width = innerWidth * devicePixelRatio; H = c.height = innerHeight * devicePixelRatio; };
    resize(); addEventListener("resize", resize);
    let last = 0;
    const tick = t => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return; last = t;   // ~30fps พอ
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        d.y -= d.s; d.x += d.dx + Math.sin(t / 2000 + d.h) * 0.00015;
        if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
        if (d.x < -0.05) d.x = 1.05; if (d.x > 1.05) d.x = -0.05;
        const g = ctx.createRadialGradient(d.x * W, d.y * H, 0, d.x * W, d.y * H, d.r * devicePixelRatio * 4);
        g.addColorStop(0, `hsla(${d.h},90%,75%,${d.o})`); g.addColorStop(1, `hsla(${d.h},90%,75%,0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r * devicePixelRatio * 4, 0, Math.PI * 2); ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, [intensity]);
  return (
    <>
      <div className="vp-aurora" aria-hidden />
      <canvas ref={ref} aria-hidden style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:0 }} />
    </>
  );
}

// ── เลื่อนเข้าแบบ stagger: ห่อลูกๆ แล้วแต่ละอันเด้งเข้ามาเรียงกัน ──
export function Reveal({ children, delay = 0, step = 60, from = "up", style, className, as: Tag = "div" }) {
  const [on, setOn] = useState(!fxEnabled());
  const ref = useRef(null);
  useEffect(() => {
    if (!fxEnabled()) return;
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { setOn(true); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  const kids = Children.toArray(children);
  return (
    <Tag ref={ref} style={style} className={className}>
      {kids.map((k, i) => {
        const st = { animation: on ? `vpIn${from === "up" ? "Up" : from === "scale" ? "Scale" : "Left"} .6s cubic-bezier(.2,.8,.2,1) ${delay + i * step}ms both` : "none", opacity: on ? undefined : 0 };
        return isValidElement(k) ? cloneElement(k, { style: { ...(k.props.style || {}), ...st } }) : <div key={i} style={st}>{k}</div>;
      })}
    </Tag>
  );
}

// ── เครื่องนับตัวเลขไหล (0 → ค่าจริง) ──
export function CountUp({ to = 0, ms = 900, prefix = "", suffix = "" }) {
  const [v, setV] = useState(fxEnabled() ? 0 : to);
  useEffect(() => {
    if (!fxEnabled()) { setV(to); return; }
    let raf; const t0 = performance.now();
    const tick = t => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{prefix}{v}{suffix}</>;
}

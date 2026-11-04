// ═══════════════════════════════════════════════════════
// SHARE — แชร์ "ชุดคำ" ให้เครื่องอื่นด้วยลิงก์/QR โดยไม่มีเซิร์ฟเวอร์
//  ข้อมูลทั้งหมดบีบอัด (deflate-raw ถ้าเบราว์เซอร์มี) แล้วเข้ารหัส base64url ไว้ใน hash ของ URL
//  รูปแบบ: #set=z:<base64url(deflate(json))> หรือ #set=j:<base64url(json)> (เครื่องเก่าที่ไม่มี CompressionStream)
// ═══════════════════════════════════════════════════════
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = str => { const s = str.replace(/-/g, "+").replace(/_/g, "/"); const pad = s + "=".repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(pad), c => c.charCodeAt(0)); };
async function pipe(bytes, Ctor, fmt) {
  const cs = new Ctor(fmt); const w = cs.writable.getWriter(); w.write(bytes); w.close();
  const out = []; const r = cs.readable.getReader();
  for (;;) { const { value, done } = await r.read(); if (done) break; out.push(value); }
  const n = out.reduce((a, b) => a + b.length, 0); const buf = new Uint8Array(n); let o = 0; for (const c of out) { buf.set(c, o); o += c.length; }
  return buf;
}
// ย่อ field ให้สั้น (QR เล็กลง): w=word m=meaning c=cat e=emoji r=read s=sen t=senTh
const pack = set => ({ n: set.name || "", f: set.from || "", w: set.words.map(x => [x.cat, x.word, x.meaning, x.emoji || "", x.read || "", x.sen || "", x.senTh || ""]) });
const unpack = o => ({ name: o.n || "", from: o.f || "", words: (o.w || []).map(a => ({ cat: a[0], word: a[1], meaning: a[2], emoji: a[3] || "📦", read: a[4] || "", sen: a[5] || "", senTh: a[6] || "" })) });

export async function encodeSet(set) {
  const json = new TextEncoder().encode(JSON.stringify(pack(set)));
  try {
    if (typeof CompressionStream !== "undefined") { const z = await pipe(json, CompressionStream, "deflate-raw"); if (z.length < json.length) return "z:" + b64url(z); }
  } catch (_) {}
  return "j:" + b64url(json);
}
export async function decodeSet(str) {
  if (!str) return null;
  const kind = str.slice(0, 2), body = str.slice(2);
  let bytes = unb64url(body);
  if (kind === "z:") bytes = await pipe(bytes, DecompressionStream, "deflate-raw");
  const o = JSON.parse(new TextDecoder().decode(bytes));
  const set = unpack(o);
  if (!Array.isArray(set.words) || !set.words.length) return null;
  return set;
}
export const BASE_URL = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
export function setLink(encoded) {
  const origin = typeof location !== "undefined" ? location.origin : "https://xarif09.github.io";
  return `${origin}${BASE_URL}#set=${encoded}`;
}
// อ่าน #set= จาก URL ตอนเปิดแอป (แล้วล้าง hash ทิ้ง เพื่อไม่ให้ถามซ้ำเมื่อรีเฟรช)
export function readIncomingSet() {
  try {
    const m = (location.hash || "").match(/[#&]set=([^&]+)/);
    if (!m) return null;
    const enc = decodeURIComponent(m[1]);
    history.replaceState(null, "", location.pathname + location.search);
    return enc;
  } catch (_) { return null; }
}

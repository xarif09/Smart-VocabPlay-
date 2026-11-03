// ═══════════════════════════════════════════════════════
// SFX — เสียงเอฟเฟกต์สั้นๆ ด้วย Web Audio (ไม่ใช้ไฟล์เสียง)
// unlockSfx() ต้องเรียกใน onClick ครั้งแรก (iOS) หลังจากนั้นเล่นได้ทุกที่
// ═══════════════════════════════════════════════════════
let ctx = null;
let enabled = true;

export function unlockSfx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
  } catch (_) {}
}

export function setSfxEnabled(v) { enabled = !!v; }

function tone(f, t0, dur, type = "sine", vol = 0.15) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function play(fn) {
  if (!enabled || !ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    fn(ctx.currentTime);
  } catch (_) {}
}

export const sfx = {
  tap:  () => { try { navigator.vibrate?.(6); } catch (_) {} play(t => tone(600, t, 0.06, "square", 0.04)); },
  ok:   () => play(t => { tone(660, t, 0.12); tone(880, t + 0.1, 0.2); }),
  bad:  () => play(t => { tone(220, t, 0.18, "sawtooth", 0.07); tone(160, t + 0.12, 0.25, "sawtooth", 0.07); }),
  coin: () => play(t => { tone(1200, t, 0.08, "square", 0.05); tone(1600, t + 0.07, 0.16, "square", 0.05); }),
  star: () => play(t => { tone(1047, t, 0.1, "triangle", 0.1); tone(1319, t + 0.08, 0.22, "triangle", 0.1); }),
  win:  () => play(t => [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.35, "triangle", 0.12))),
  lose: () => play(t => [392, 330, 262].forEach((f, i) => tone(f, t + i * 0.18, 0.3, "triangle", 0.1))),
};

// ═══════════════════════════════════════════════════════
// MUSIC — ดนตรีประกอบเบาๆ สังเคราะห์ด้วย Web Audio (ออฟไลน์ได้ ไม่มีไฟล์)
//  เพลงลูป 8 ห้อง แบบ music box: ทำนองเพนทาโทนิก + เบส + แพด · เปิด/ปิดในตั้งค่า
// ═══════════════════════════════════════════════════════
let music = null;
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const MELODY = [72,74,76,79, 81,79,76,74, 72,76,79,81, 84,81,79,76, 74,76,79,74, 72,74,76,72, 69,72,74,76, 79,76,74,72];
const BASS   = [48,48,55,55, 57,57,52,52, 48,48,55,55, 53,53,55,55];
export function startMusic(volume = 0.12) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!ctx) ctx = new AC(); if (ctx.state === "suspended") ctx.resume();
    if (music) return;
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2);
    const step = 0.28; let i = 0; const t0 = ctx.currentTime + 0.1;
    const timer = setInterval(() => {
      if (!music) return;
      const now = ctx.currentTime; const ahead = t0 + i * step;
      while (t0 + i * step < now + 0.6) {
        const t = t0 + i * step, m = MELODY[i % MELODY.length], b = BASS[Math.floor(i / 2) % BASS.length];
        // ทำนอง music box
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = NOTE(m);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.6);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + step * 1.7);
        const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = "triangle"; o2.frequency.value = NOTE(m + 12);
        g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + step);
        o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t + step * 1.1);
        // เบสทุก 2 สเต็ป
        if (i % 2 === 0) { const ob = ctx.createOscillator(), gb = ctx.createGain(); ob.type = "sine"; ob.frequency.value = NOTE(b);
          gb.gain.setValueAtTime(0.0001, t); gb.gain.exponentialRampToValueAtTime(0.35, t + 0.02); gb.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.9);
          ob.connect(gb); gb.connect(master); ob.start(t); ob.stop(t + step * 2); }
        // แพดทุก 8 สเต็ป
        if (i % 8 === 0) { [b + 12, b + 16, b + 19].forEach(n => { const op = ctx.createOscillator(), gp = ctx.createGain(); op.type = "triangle"; op.frequency.value = NOTE(n);
          gp.gain.setValueAtTime(0.0001, t); gp.gain.linearRampToValueAtTime(0.06, t + 0.6); gp.gain.linearRampToValueAtTime(0.0001, t + step * 8);
          op.connect(gp); gp.connect(master); op.start(t); op.stop(t + step * 8.2); }); }
        i++;
      }
    }, 200);
    music = { master, timer };
  } catch (_) {}
}
export function stopMusic() {
  if (!music) return;
  try { music.master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8); const m = music; setTimeout(() => { try { m.master.disconnect(); } catch (_) {} }, 1000); clearInterval(music.timer); } catch (_) {}
  music = null;
}
export const musicPlaying = () => !!music;

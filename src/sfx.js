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
  tap:  () => play(t => tone(600, t, 0.06, "square", 0.04)),
  ok:   () => play(t => { tone(660, t, 0.12); tone(880, t + 0.1, 0.2); }),
  bad:  () => play(t => { tone(220, t, 0.18, "sawtooth", 0.07); tone(160, t + 0.12, 0.25, "sawtooth", 0.07); }),
  coin: () => play(t => { tone(1200, t, 0.08, "square", 0.05); tone(1600, t + 0.07, 0.16, "square", 0.05); }),
  star: () => play(t => { tone(1047, t, 0.1, "triangle", 0.1); tone(1319, t + 0.08, 0.22, "triangle", 0.1); }),
  win:  () => play(t => [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.35, "triangle", 0.12))),
  lose: () => play(t => [392, 330, 262].forEach((f, i) => tone(f, t + i * 0.18, 0.3, "triangle", 0.1))),
};

// ─────────────────────────────────────────────────────────────────────────────
// procedural.js — hand-built (code-only) props for FindRoom3D, used for words
// that have no suitable CC0 model (toys, stationery, flat clothes …).
// Every builder returns a THREE.Group in metres, roughly resting on y = 0.
// The caller re-fits size / grounding, so proportions matter more than scale.
// ─────────────────────────────────────────────────────────────────────────────
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export function makeProcedural(THREE, kind, opts = {}) {
  const T = THREE;
  const g = new T.Group();
  const owned = opts.owned || [];                       // textures created here (caller disposes)
  const add = (geo, m, x = 0, y = 0, z = 0, parent = g) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const std = (color, o = {}) => new T.MeshStandardMaterial({ color, roughness:.6, metalness:0, ...o });
  const plastic = (color, o = {}) => new T.MeshPhysicalMaterial({ color, roughness:.32, clearcoat:.6, clearcoatRoughness:.25, ...o });
  const metal = (color = "#c9ced6", o = {}) => new T.MeshStandardMaterial({ color, roughness:.28, metalness:1, ...o });
  const ctex = (w, h, draw, srgb = true) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; owned.push(t); return t; };
  const lathe = (pts, seg = 28) => new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg);
  // flat cloth piece: shape extruded thin with soft bevel, lying in XZ plane (top = +y)
  const cloth = (shape, m, thick = .018) => { const geo = new T.ExtrudeGeometry(shape, { depth:thick, bevelEnabled:true, bevelThickness:thick * .6, bevelSize:thick * .9, bevelSegments:3, curveSegments:18 });
    geo.rotateX(-Math.PI / 2); wrinkle(geo, .012); const o = add(geo, m); return o; };
  const wrinkle = (geo, amt) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + (Math.sin(x * 23 + z * 7) * .5 + Math.sin(z * 31 - x * 11) * .5) * amt); } geo.computeVertexNormals(); };
  const fabricTex = (base, stripe, n = 0, dots = false) => ctex(256, 256, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h);
    if (stripe) { x.fillStyle = stripe; for (let i = 0; i < n; i++) x.fillRect(0, (i + .5) * h / n - h / n / 4, w, h / n / 2); }
    if (dots) { x.fillStyle = dots; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { x.beginPath(); x.arc(i * 29 + (j % 2) * 14, j * 29, 6, 0, 7); x.fill(); } }
    for (let i = 0; i < 2400; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "255,255,255"},.05)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); } });
  const clothMat = (tex, rep = 3) => { tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(rep, rep); return new T.MeshStandardMaterial({ map:tex, roughness:.92, normalMap:opts.fabricNor || null, normalScale:new T.Vector2(.6, .6) }); };

  switch (kind) {
    // ───────────── TOYS ─────────────
    case "teddy": {
      const fur = new T.MeshPhysicalMaterial({ color:"#b07a45", roughness:.95, sheen:1, sheenRoughness:.5, sheenColor:new T.Color("#f3d2a8") });
      const light = new T.MeshPhysicalMaterial({ color:"#ecc99b", roughness:.95, sheen:1, sheenColor:new T.Color("#fff0d8") });
      const dark = new T.MeshStandardMaterial({ color:"#1b1210", roughness:.25 });
      add(new T.SphereGeometry(.16, 28, 20), fur, 0, .17, 0).scale.set(1, 1.1, .9);
      add(new T.SphereGeometry(.1, 20, 14), light, 0, .16, .1).scale.set(1, 1.2, .5);
      const head = new T.Group(); head.position.set(0, .41, .01); g.add(head);
      add(new T.SphereGeometry(.13, 28, 20), fur, 0, 0, 0, head);
      add(new T.SphereGeometry(.06, 18, 12), light, 0, -.03, .11, head).scale.set(1.2, .9, .8);
      add(new T.SphereGeometry(.022, 12, 8), dark, 0, -.01, .165, head).scale.set(1.3, 1, 1);
      for (const s of [-1, 1]) {
        add(new T.SphereGeometry(.018, 12, 8), dark, s * .05, .035, .115, head);
        const ear = add(new T.SphereGeometry(.05, 16, 12), fur, s * .1, .1, -.01, head); ear.scale.z = .55;
        add(new T.SphereGeometry(.03, 12, 8), light, s * .1, .1, .012, head).scale.z = .4;
        const arm = add(new T.CapsuleGeometry(.045, .1, 6, 12), fur, s * .16, .24, .04); arm.rotation.z = s * .9; arm.rotation.x = -.5;
        const leg = add(new T.CapsuleGeometry(.055, .09, 6, 12), fur, s * .09, .055, .13); leg.rotation.x = Math.PI / 2.2;
        add(new T.SphereGeometry(.04, 12, 8), light, s * .09, .055, .2).scale.set(1, 1, .4);
      }
      const bow = plastic("#e11d48"); add(new T.SphereGeometry(.025, 10, 8), bow, 0, .29, .1);
      for (const s of [-1, 1]) add(new T.ConeGeometry(.035, .07, 10), bow, s * .04, .29, .1).rotation.z = s * Math.PI / 2;
      break;
    }
    case "blocks": {
      const cols = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"], letters = ["A", "B", "C", "1", "2"];
      const faceMat = (L, c) => new T.MeshStandardMaterial({ roughness:.55, map:ctex(128, 128, (x, w, h) => { x.fillStyle = "#f6e7c8"; x.fillRect(0, 0, w, h); x.strokeStyle = c; x.lineWidth = 12; x.strokeRect(8, 8, w - 16, h - 16);
        x.fillStyle = c; x.font = "bold 84px Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(L, w / 2, h / 2 + 4); }) });
      const P = [[0, 0, 0, .1], [.13, 0, .02, -.25], [.065, .11, .01, .4], [-.12, 0, .1, .7], [.02, 0, .16, -.5]];
      P.forEach(([x, y, z, r], i) => { const ms = [0, 1, 2, 3, 4, 5].map(k => faceMat(letters[(i + k) % 5], cols[(i + k) % 5]));
        const b = add(new T.BoxGeometry(.11, .11, .11), ms, x, y + .055, z); b.rotation.y = r; });
      break;
    }
    case "dice": {
      const pip = n => new T.MeshStandardMaterial({ roughness:.3, map:ctex(128, 128, (x, w) => { x.fillStyle = "#fbfbf7"; x.fillRect(0, 0, w, w); x.fillStyle = n === 1 ? "#dc2626" : "#111";
        const P = { 1:[[2, 2]], 2:[[1, 1], [3, 3]], 3:[[1, 1], [2, 2], [3, 3]], 4:[[1, 1], [3, 1], [1, 3], [3, 3]], 5:[[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6:[[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] }[n];
        P.forEach(([i, j]) => { x.beginPath(); x.arc(i * w / 4, j * w / 4, n === 1 ? 17 : 12, 0, 7); x.fill(); }); }) });
      const ms = [1, 6, 2, 5, 3, 4].map(pip);
      const d1 = add(new T.BoxGeometry(.09, .09, .09), ms, 0, .045, 0); d1.rotation.y = .5;
      const d2 = add(new T.BoxGeometry(.09, .09, .09), ms, .12, .045, .05); d2.rotation.set(Math.PI / 2, 1.1, 0);
      break;
    }
    case "balloon": {
      const c = opts.color || "#ef4444";
      const m = new T.MeshPhysicalMaterial({ color:c, roughness:.18, clearcoat:1, clearcoatRoughness:.05, sheen:.3 });
      add(lathe([[0, 0], [.03, .01], [.12, .08], [.165, .2], [.16, .3], [.11, .39], [0, .42]], 32), m, 0, .02, 0);
      add(new T.ConeGeometry(.02, .03, 10), m, 0, .015, 0).rotation.x = Math.PI;
      const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new T.Vector3(Math.sin(t * 9) * .03, -t * (opts.string || .9), Math.cos(t * 7) * .02)); }
      add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, .003, 5), std("#f5f5f5"));
      break;
    }
    case "kite": {
      const tex = ctex(256, 256, (x, w, h) => { const C = ["#ef4444", "#facc15", "#3b82f6", "#22c55e"]; [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j], k) => { x.fillStyle = C[k]; x.fillRect(i * w / 2, j * h / 2, w / 2, h / 2); }); });
      const s = new T.Shape(); s.moveTo(0, .36); s.lineTo(.2, .1); s.lineTo(0, -.36); s.lineTo(-.2, .1); s.closePath();
      const geo = new T.ShapeGeometry(s); const uv = geo.attributes.uv, p = geo.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + .2) / .4, (p.getY(i) + .36) / .72);
      const sail = add(geo, new T.MeshStandardMaterial({ map:tex, side:T.DoubleSide, roughness:.7 }), 0, 0, 0); sail.position.y = .4;
      const stick = std("#8b5a2b"); add(new T.BoxGeometry(.008, .72, .008), stick, 0, .4, .006); add(new T.BoxGeometry(.4, .008, .008), stick, 0, .5, .006);
      const tail = []; for (let i = 0; i <= 16; i++) tail.push(new T.Vector3(Math.sin(i * .8) * .05, .04 - i * .035, .01));
      add(new T.TubeGeometry(new T.CatmullRomCurve3(tail), 40, .003, 5), std("#334155"));
      [3, 7, 11, 15].forEach((i, k) => { const b = add(new T.ConeGeometry(.02, .04, 4), std(["#ef4444", "#3b82f6", "#facc15", "#22c55e"][k]), tail[i].x, tail[i].y, .012); b.rotation.z = Math.PI / 2; b.scale.z = .3; });
      break;
    }
    case "drum": {
      const side = ctex(512, 128, (x, w, h) => { x.fillStyle = "#dc2626"; x.fillRect(0, 0, w, h); x.strokeStyle = "#fde68a"; x.lineWidth = 7; x.beginPath();
        for (let i = 0; i <= 16; i++) x.lineTo(i * w / 16, i % 2 ? h - 18 : 18); x.stroke(); });
      add(new T.CylinderGeometry(.15, .15, .17, 36, 1, true), new T.MeshStandardMaterial({ map:side, roughness:.4, side:T.DoubleSide }), 0, .095, 0);
      add(new T.CircleGeometry(.15, 36), std("#f8f1df", { roughness:.8 }), 0, .181, 0).rotation.x = -Math.PI / 2;
      const gold = metal("#e2b24a"); for (const y of [.012, .178]) add(new T.TorusGeometry(.152, .011, 8, 40), gold, 0, y, 0).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) { const st = add(new T.CylinderGeometry(.005, .007, .3, 8), std("#d6a86a"), s * .05, .2, .05); st.rotation.set(Math.PI / 2 - .25, 0, s * .5); }
      break;
    }
    case "lego": {
      const cols = ["#dc2626", "#2563eb", "#facc15", "#16a34a", "#f97316"];
      const brick = (c, nx, nz) => { const b = new T.Group(); const m = plastic(c, { roughness:.25 }); const W = nx * .032, D = nz * .032;
        add(new T.BoxGeometry(W, .038, D), m, 0, .019, 0, b); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) add(new T.CylinderGeometry(.0095, .0095, .009, 14), m, (i - (nx - 1) / 2) * .032, .042, (j - (nz - 1) / 2) * .032, b); return b; };
      [[0, 0, 0, 0, 4, 2], [.004, .038, .01, .3, 2, 2], [.15, 0, .03, 1.1, 4, 2], [-.1, 0, .08, -.6, 2, 2], [.05, 0, .14, .2, 3, 2]].forEach(([x, y, z, r, nx, nz], i) => { const b = brick(cols[i % 5], nx, nz); b.position.set(x, y, z); b.rotation.y = r; g.add(b); });
      break;
    }
    case "top": {
      const tex = ctex(256, 64, (x, w, h) => { const C = ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#a855f7", "#f97316"]; for (let i = 0; i < 12; i++) { x.fillStyle = C[i % 6]; x.fillRect(i * w / 12, 0, w / 12 + 1, h); } });
      add(lathe([[0, 0], [.01, .012], [.05, .045], [.1, .085], [.11, .1], [.09, .12], [.02, .13], [0, .13]], 36), new T.MeshPhysicalMaterial({ map:tex, roughness:.3, clearcoat:.8 }));
      add(new T.CylinderGeometry(.012, .014, .07, 12), std("#7c4a1e"), 0, .16, 0);
      break;
    }
    case "yoyo": {
      const m = plastic(opts.color || "#22c55e");
      for (const z of [-.018, .018]) add(new T.CylinderGeometry(.06, .06, .028, 32), m, 0, .06, z).rotation.x = Math.PI / 2;
      add(new T.CylinderGeometry(.012, .012, .015, 12), std("#e5e7eb"), 0, .06, 0).rotation.x = Math.PI / 2;
      for (const z of [-.033, .033]) add(new T.CircleGeometry(.03, 24), std("#fef08a"), 0, .06, z).rotation.y = z < 0 ? Math.PI : 0;
      const pts = []; for (let i = 0; i <= 14; i++) pts.push(new T.Vector3(.01 + i * .02, .06 - Math.sin(i / 14 * Math.PI) * .05 - i * .002, Math.sin(i) * .01));
      add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 30, .0025, 5), std("#f8fafc"));
      break;
    }
    case "piano": {
      add(new RoundedBoxGeometry(.42, .14, .22, 3, .02), plastic("#e11d48"), 0, .14, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new T.CylinderGeometry(.012, .012, .08, 10), plastic("#e11d48"), sx * .18, .04, sz * .08);
      const white = std("#fafafa", { roughness:.35 }), black = std("#111", { roughness:.3 });
      for (let i = 0; i < 12; i++) add(new T.BoxGeometry(.03, .02, .1), white, -.18 + i * .0327, .218, .05);
      [0, 1, 3, 4, 5, 7, 8, 10].forEach(i => add(new T.BoxGeometry(.018, .022, .06), black, -.163 + i * .0327, .232, .03));
      break;
    }
    case "crayons": {
      const box = ctex(256, 128, (x, w, h) => { x.fillStyle = "#facc15"; x.fillRect(0, 0, w, h); x.fillStyle = "#16a34a"; x.fillRect(0, h * .55, w, h * .45);
        x.fillStyle = "#b91c1c"; x.font = "bold 40px Arial"; x.textAlign = "center"; x.fillText("CRAYONS", w / 2, 50); });
      add(new T.BoxGeometry(.16, .1, .05), [std("#facc15"), std("#facc15"), std("#facc15"), std("#facc15"), new T.MeshStandardMaterial({ map:box, roughness:.7 }), new T.MeshStandardMaterial({ map:box, roughness:.7 })], 0, .05, 0);
      const C = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4"];
      C.forEach((c, i) => { const cr = crayon(c); cr.position.set(-.065 + i * .022, .1, 0); cr.rotation.z = (i % 2 ? .06 : -.05); g.add(cr); });
      [["#ef4444", .14, .03, 1.2], ["#3b82f6", .1, .09, -.4], ["#22c55e", -.13, .07, .5]].forEach(([c, x, z, r]) => { const cr = crayon(c); cr.rotation.set(0, r, Math.PI / 2); cr.position.set(x, .009, z); g.add(cr); });
      break;
    }
    case "crayon": { const cr = crayon(opts.color || "#3b82f6", 2.2); cr.rotation.z = Math.PI / 2; cr.position.y = .02; g.add(cr); break; }
    case "puzzle": {
      const tex = ctex(256, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#7dd3fc"); gr.addColorStop(.6, "#bae6fd"); gr.addColorStop(.6, "#4ade80"); gr.addColorStop(1, "#16a34a"); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.fillStyle = "#facc15"; x.beginPath(); x.arc(200, 60, 30, 0, 7); x.fill(); x.fillStyle = "#ef4444"; x.fillRect(50, 110, 70, 50); x.fillStyle = "#92400e"; x.beginPath(); x.moveTo(40, 112); x.lineTo(85, 75); x.lineTo(130, 112); x.fill(); });
      const piece = (i, j) => { const S = .07, s = new T.Shape(); const k = S * .18;
        s.moveTo(0, 0); s.lineTo(S * .38, 0); s.absarc(S * .5, -k * .3, k, Math.PI, 0, (i + j) % 2 === 0); s.lineTo(S, 0); s.lineTo(S, S * .38); s.absarc(S + k * .3, S * .5, k, -Math.PI / 2, Math.PI / 2, false);
        s.lineTo(S, S); s.lineTo(0, S); s.closePath();
        const geo = new T.ExtrudeGeometry(s, { depth:.008, bevelEnabled:true, bevelThickness:.002, bevelSize:.002, bevelSegments:1, curveSegments:8 }); geo.rotateX(-Math.PI / 2);
        const uv = geo.attributes.uv, p = geo.attributes.position; for (let q = 0; q < p.count; q++) uv.setXY(q, (p.getX(q) + i * S) / (S * 3), (-p.getZ(q) + j * S) / (S * 3));
        return geo; };
      const m = new T.MeshStandardMaterial({ map:tex, roughness:.6 });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const loose = (i * 3 + j) % 4 === 3; const o = add(piece(i, j), m, (i - 1.5) * .07 + (loose ? .1 * (i - 1) : 0), .002, -(j - 1.5) * .07 + (loose ? .09 : 0)); if (loose) o.rotation.y = .7 * (j - 1) + .4; }
      break;
    }
    // ───────────── SCHOOL ─────────────
    case "calculator": {
      const face = ctex(160, 256, (x, w, h) => { x.fillStyle = "#334155"; x.fillRect(0, 0, w, h); x.fillStyle = "#a3c9a8"; x.fillRect(14, 14, w - 28, 56); x.fillStyle = "#1f2937"; x.font = "bold 34px monospace"; x.textAlign = "right"; x.fillText("123", w - 22, 56);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { x.fillStyle = c === 3 ? "#f97316" : r === 0 ? "#94a3b8" : "#e2e8f0"; x.beginPath(); x.roundRect(14 + c * 34, 88 + r * 33, 28, 26, 5); x.fill(); } });
      const side = std("#1e293b", { roughness:.4 });
      add(new T.BoxGeometry(.09, .016, .145), [side, side, new T.MeshStandardMaterial({ map:face, roughness:.4 }), side, side, side], 0, .008, 0);
      break;
    }
    case "ruler": {
      const tex = ctex(512, 64, (x, w, h) => { x.fillStyle = "#fcd34d"; x.fillRect(0, 0, w, h); x.fillStyle = "#1f2937"; for (let i = 0; i <= 60; i++) { const L = i % 10 === 0 ? 26 : i % 5 === 0 ? 18 : 10; x.fillRect(8 + i * (w - 16) / 60, 0, 2, L); }
        x.font = "bold 14px Arial"; for (let i = 0; i <= 6; i++) x.fillText(String(i * 5), 4 + i * (w - 16) / 6, 44); });
      const s = std("#f5c542", { roughness:.5 });
      add(new T.BoxGeometry(.32, .006, .035), [s, s, new T.MeshStandardMaterial({ map:tex, roughness:.5 }), s, s, s], 0, .003, 0);
      break;
    }
    case "scissors": {
      const steel = metal("#d6dbe2"), handle = plastic(opts.color || "#2563eb");
      for (const s of [-1, 1]) { const b = new T.Shape(); b.moveTo(0, -.008); b.lineTo(.13, -.002); b.lineTo(.13, .002); b.lineTo(0, .008); b.closePath();
        const geo = new T.ExtrudeGeometry(b, { depth:.003, bevelEnabled:false }); geo.rotateX(-Math.PI / 2);
        const bl = add(geo, steel, 0, .006 + (s > 0 ? .004 : 0), 0); bl.rotation.y = s * .14;
        const ring = add(new T.TorusGeometry(.024, .007, 10, 24), handle, -.03, .008, s * .022); ring.rotation.x = Math.PI / 2; ring.scale.set(1.3, 1, 1); }
      add(new T.CylinderGeometry(.005, .005, .014, 10), steel, 0, .008, 0);
      break;
    }
    case "marker": {
      const c = opts.color || "#16a34a";
      const body = new T.Group(); g.add(body);
      add(new T.CylinderGeometry(.011, .011, .1, 18), std("#f1f5f9", { roughness:.35 }), 0, 0, 0, body);
      add(new T.CylinderGeometry(.0125, .0125, .045, 18), plastic(c), 0, .065, 0, body);
      add(new T.CylinderGeometry(.006, .0125, .012, 18), plastic(c), 0, .093, 0, body);
      add(new T.CylinderGeometry(.0115, .0115, .012, 18), plastic(c), 0, -.056, 0, body);
      add(new T.BoxGeometry(.004, .03, .004), plastic(c), .013, .07, 0, body);
      body.rotation.z = Math.PI / 2; body.position.y = .012;
      break;
    }
    case "glue": {
      const label = ctex(256, 128, (x, w, h) => { x.fillStyle = "#fef3c7"; x.fillRect(0, 0, w, h); x.fillStyle = "#ea580c"; x.fillRect(0, 0, w, 26); x.fillRect(0, h - 20, w, 20);
        x.fillStyle = "#1e3a8a"; x.font = "bold 50px Arial"; x.textAlign = "center"; x.fillText("GLUE", w / 2, 86); });
      add(lathe([[0, 0], [.03, 0], [.032, .006], [.032, .1], [.025, .115], [.012, .122], [0, .122]], 28), new T.MeshPhysicalMaterial({ color:"#ffffff", roughness:.35, clearcoat:.4 }));
      add(new T.CylinderGeometry(.0325, .0325, .06, 28, 1, true), new T.MeshStandardMaterial({ map:label, roughness:.5 }), 0, .055, 0);
      add(lathe([[0, 0], [.013, 0], [.013, .02], [.004, .045], [0, .05]], 20), plastic("#f97316"), 0, .12, 0);
      break;
    }
    case "paintbrush": {
      const b = new T.Group(); g.add(b);
      add(lathe([[0, 0], [.006, .002], [.008, .12], [.0065, .17], [0, .172]], 14), std("#c2410c", { roughness:.35 }), 0, 0, 0, b);
      add(new T.CylinderGeometry(.0075, .0085, .03, 14), metal("#cbd5e1"), 0, -.012, 0, b);
      add(lathe([[0, 0], [.0085, 0], [.01, -.02], [.006, -.045], [0, -.055]], 14), std("#3b82f6", { roughness:.9 }), 0, -.027, 0, b);
      b.rotation.z = Math.PI / 2 - .05; b.position.y = .01;
      break;
    }
    case "lunchbox": {
      const c = opts.color || "#0ea5e9";
      add(new RoundedBoxGeometry(.22, .12, .14, 3, .02), plastic(c), 0, .06, 0);
      add(new RoundedBoxGeometry(.225, .03, .145, 2, .01), plastic("#fde047"), 0, .115, 0);
      const h = add(new T.TorusGeometry(.045, .008, 8, 20, Math.PI), plastic("#fde047"), 0, .13, 0);
      for (const s of [-1, 1]) add(new T.BoxGeometry(.02, .035, .006), plastic("#fde047"), s * .07, .1, .073);
      break;
    }
    case "tape": {
      add(new T.TorusGeometry(.04, .018, 14, 32), new T.MeshPhysicalMaterial({ color:"#e8d6a8", roughness:.25, transmission:0, opacity:.92, transparent:true, clearcoat:1 }), 0, .018, 0).rotation.x = Math.PI / 2;
      add(new T.CylinderGeometry(.03, .03, .035, 24, 1, true), std("#d6b98c", { side:T.DoubleSide, roughness:.9 }), 0, .018, 0);
      break;
    }
    case "globe": {
      const tex = ctex(512, 256, (x, w, h) => { x.fillStyle = "#2b7fd4"; x.fillRect(0, 0, w, h);
        const land = [[120, 70, 50, 30], [90, 100, 40, 40], [140, 170, 25, 45], [270, 70, 40, 25], [280, 140, 35, 50], [370, 80, 70, 35], [400, 175, 30, 18], [250, 40, 20, 12]];
        x.fillStyle = "#4caf50"; land.forEach(([cx, cy, rx, ry]) => { x.beginPath(); for (let a = 0; a < 6.3; a += .3) { const r = 1 + Math.sin(a * 3 + cx) * .25; x.lineTo(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r); } x.fill(); });
        x.fillStyle = "#f8fafc"; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 16, w, 16); x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, i * h / 6); x.lineTo(w, i * h / 6); x.stroke(); } });
      const ball = add(new T.SphereGeometry(.14, 40, 28), new T.MeshStandardMaterial({ map:tex, roughness:.35 }), 0, .23, 0); ball.rotation.z = .41; ball.rotation.y = 1;
      const arc = add(new T.TorusGeometry(.155, .006, 8, 40, Math.PI * 1.2), metal("#d4a84b"), 0, .23, 0); arc.rotation.set(0, Math.PI / 2, -Math.PI / 2 - .19);
      add(new T.CylinderGeometry(.012, .016, .08, 12), metal("#d4a84b"), 0, .05, 0);
      add(new T.CylinderGeometry(.07, .08, .02, 28), std("#4b2e19", { roughness:.4 }), 0, .01, 0);
      break;
    }
    case "map": {
      const tex = ctex(512, 320, (x, w, h) => { x.fillStyle = "#f3ead2"; x.fillRect(0, 0, w, h); x.fillStyle = "#9fd3f0"; x.fillRect(16, 16, w - 32, h - 32);
        const land = [[110, 100, 60, 40], [90, 150, 40, 40], [150, 225, 32, 52], [260, 95, 42, 28], [275, 185, 42, 62], [380, 110, 80, 45], [420, 230, 35, 22]];
        x.fillStyle = "#f2c46d"; land.forEach(([cx, cy, rx, ry], i) => { x.fillStyle = ["#86c56b", "#f2c46d", "#e98f6b", "#b59ad8"][i % 4]; x.beginPath(); for (let a = 0; a < 6.3; a += .25) { const r = 1 + Math.sin(a * 3 + cx) * .22; x.lineTo(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r); } x.fill(); });
        x.strokeStyle = "#7c5a2e"; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); x.fillStyle = "#334155"; x.font = "bold 22px Arial"; x.fillText("N", w - 52, 52); });
      add(new T.BoxGeometry(.9, .56, .012), [std("#7c5a2e"), std("#7c5a2e"), std("#7c5a2e"), std("#7c5a2e"), new T.MeshStandardMaterial({ map:tex, roughness:.8 }), std("#7c5a2e")], 0, .28, 0);
      break;
    }
    case "paper": {
      const tex = ctex(256, 320, (x, w, h) => { x.fillStyle = "#fdfdfb"; x.fillRect(0, 0, w, h); x.strokeStyle = "#93c5fd"; x.lineWidth = 2; for (let y = 50; y < h; y += 22) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
        x.strokeStyle = "#fca5a5"; x.beginPath(); x.moveTo(36, 0); x.lineTo(36, h); x.stroke(); x.fillStyle = "#1e40af"; x.font = "28px 'Comic Sans MS', cursive"; x.fillText("A B C", 50, 90); x.fillText("1 2 3", 50, 156); });
      const m = new T.MeshStandardMaterial({ map:tex, roughness:.9, side:T.DoubleSide });
      [[0, 0, .2], [.06, .02, -.35]].forEach(([x, z, r], i) => { const geo = new T.PlaneGeometry(.21, .28, 6, 6); geo.rotateX(-Math.PI / 2); wrinkle(geo, .004); const o = add(geo, m, x, .003 + i * .002, z); o.rotation.y = r; });
      break;
    }
    // ───────────── CLOTHES ─────────────
    case "tshirt": {
      const s = new T.Shape(); s.moveTo(-.12, -.3); s.lineTo(.12, -.3); s.lineTo(.12, .08); s.lineTo(.2, .03); s.lineTo(.25, .12); s.lineTo(.13, .22); s.quadraticCurveTo(0, .17, -.13, .22); s.lineTo(-.25, .12); s.lineTo(-.2, .03); s.lineTo(-.12, .08); s.closePath();
      cloth(s, clothMat(fabricTex(opts.color || "#f97316", "#fff7ed", 6), 2));
      break;
    }
    case "shirt": {
      const s = new T.Shape(); s.moveTo(-.13, -.32); s.lineTo(.13, -.32); s.lineTo(.13, .06); s.lineTo(.28, -.18); s.lineTo(.33, -.14); s.lineTo(.15, .22); s.lineTo(.05, .24); s.lineTo(0, .2); s.lineTo(-.05, .24); s.lineTo(-.15, .22); s.lineTo(-.33, -.14); s.lineTo(-.28, -.18); s.lineTo(-.13, .06); s.closePath();
      cloth(s, clothMat(ctex(256, 256, (x, w, h) => { x.fillStyle = "#e0f2fe"; x.fillRect(0, 0, w, h); x.strokeStyle = "#60a5fa"; x.lineWidth = 6; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); } }), 3));
      const btn = std("#f8fafc", { roughness:.3 }); for (let i = 0; i < 4; i++) add(new T.CylinderGeometry(.009, .009, .006, 12), btn, 0, .03, .14 - i * .11);
      break;
    }
    case "pants": case "shorts": {
      const L = kind === "pants" ? .5 : .24, s = new T.Shape(); s.moveTo(-.17, .2); s.lineTo(.17, .2); s.lineTo(.2, .2 - L); s.lineTo(.03, .2 - L); s.lineTo(0, .05); s.lineTo(-.03, .2 - L); s.lineTo(-.2, .2 - L); s.closePath();
      const m = kind === "pants" && opts.denim ? new T.MeshStandardMaterial({ map:opts.denim, normalMap:opts.fabricNor || null, roughness:.95 }) : clothMat(fabricTex(opts.color || "#16a34a"), 2);
      if (m.map && opts.denim) { m.map.wrapS = m.map.wrapT = T.RepeatWrapping; m.map.repeat.set(2, 2); }
      cloth(s, m, .022);
      add(new T.BoxGeometry(.34, .012, .035), std(kind === "pants" ? "#1e3a8a" : "#14532d", { roughness:.8 }), 0, .04, -.19);
      break;
    }
    case "dress": {
      const s = new T.Shape(); s.moveTo(-.28, -.34); s.quadraticCurveTo(0, -.38, .28, -.34); s.lineTo(.1, .02); s.lineTo(.11, .2); s.lineTo(.06, .22); s.quadraticCurveTo(0, .15, -.06, .22); s.lineTo(-.11, .2); s.lineTo(-.1, .02); s.closePath();
      cloth(s, clothMat(fabricTex(opts.color || "#ec4899", null, 0, "#fdf2f8"), 2.5));
      add(new T.TorusGeometry(.03, .01, 8, 16), std("#fdf2f8"), 0, .04, -.02).rotation.x = Math.PI / 2;
      break;
    }
    case "skirt": {
      const s = new T.Shape(); s.moveTo(-.12, .12); s.lineTo(.12, .12); s.lineTo(.25, -.16); s.quadraticCurveTo(0, -.21, -.25, -.16); s.closePath();
      cloth(s, clothMat(ctex(256, 256, (x, w, h) => { x.fillStyle = "#7c3aed"; x.fillRect(0, 0, w, h); x.fillStyle = "rgba(250,204,21,.55)"; for (let i = 0; i < 8; i++) { x.fillRect(i * 32, 0, 10, h); x.fillRect(0, i * 32, w, 10); } }), 2), .02);
      break;
    }
    case "socks": {
      const sock = c => { const s = new T.Shape(); s.moveTo(-.035, .14); s.lineTo(.035, .14); s.lineTo(.035, -.04); s.quadraticCurveTo(.04, -.08, .1, -.085); s.quadraticCurveTo(.13, -.1, .11, -.125); s.lineTo(-.01, -.125); s.quadraticCurveTo(-.04, -.11, -.035, -.06); s.closePath();
        return s; };
      [["#ef4444", 0, 0, 0], ["#ef4444", .1, .03, .5]].forEach(([c, x, z, r]) => { const o = cloth(sock(c), clothMat(fabricTex(c, "#ffffff", 5), 1.5), .016); o.position.set(x, 0, z); o.rotation.y = r; });
      break;
    }
    case "scarf": {
      const pts = [[-.3, 0, .05], [-.15, 0, -.08], [0, 0, .02], [.12, 0, .12], [.25, 0, .04], [.33, 0, -.1]].map(p => new T.Vector3(...p));
      const curve = new T.CatmullRomCurve3(pts); const tex = ctex(64, 512, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? "#facc15" : "#dc2626"; x.fillRect(0, i * h / 16, w, h / 16); } });
      tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(1, 2);
      const geo = new T.TubeGeometry(curve, 80, .04, 10); geo.scale(1, .35, 1);
      add(geo, new T.MeshStandardMaterial({ map:tex, roughness:.95, normalMap:opts.fabricNor || null }), 0, .015, 0);
      for (const e of [0, 1]) { const p = curve.getPoint(e), d = curve.getTangent(e); for (let k = -2; k <= 2; k++) { const f = add(new T.CylinderGeometry(.004, .004, .05, 4), std("#dc2626"), p.x + d.x * .03 + k * .012 * d.z, .01, p.z + d.z * .03 - k * .012 * d.x); f.rotation.set(Math.PI / 2, 0, Math.atan2(d.x, d.z)); } }
      break;
    }
    case "cap": {
      const c = opts.color || "#2563eb";
      const m = new T.MeshStandardMaterial({ color:c, roughness:.85, normalMap:opts.fabricNor || null });
      add(new T.SphereGeometry(.1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0, 0).scale.set(1, .85, 1.05);
      const brim = new T.Shape(); brim.absellipse(0, 0, .095, .08, 0, Math.PI * 2); const bg = new T.ExtrudeGeometry(brim, { depth:.008, bevelEnabled:true, bevelSize:.003, bevelThickness:.002, curveSegments:24 }); bg.rotateX(-Math.PI / 2);
      add(bg, m, 0, .004, .1).rotation.x = -.12;
      add(new T.SphereGeometry(.012, 10, 8), std("#f8fafc"), 0, .086, 0);
      break;
    }
    case "umbrella": {
      const N = 8, tex = ctex(512, 64, (x, w, h) => { for (let i = 0; i < N; i++) { x.fillStyle = i % 2 ? "#facc15" : "#ef4444"; x.fillRect(i * w / N, 0, w / N + 1, h); } });
      const can = add(new T.ConeGeometry(.42, .2, N, 1, true), new T.MeshStandardMaterial({ map:tex, side:T.DoubleSide, roughness:.55 }), 0, .55, 0);
      add(new T.CylinderGeometry(.007, .007, .62, 8), metal("#9ca3af"), 0, .32, 0);
      add(new T.TorusGeometry(.035, .009, 8, 20, Math.PI), plastic("#7c2d12"), -.035, .01, 0).rotation.z = Math.PI;
      add(new T.SphereGeometry(.012, 10, 8), metal("#9ca3af"), 0, .66, 0);
      g.rotation.z = 0; can.castShadow = true;
      break;
    }
    case "tie": {
      const s = new T.Shape(); s.moveTo(-.025, .2); s.lineTo(.025, .2); s.lineTo(.035, .16); s.lineTo(.06, -.18); s.lineTo(0, -.24); s.lineTo(-.06, -.18); s.lineTo(-.035, .16); s.closePath();
      cloth(s, clothMat(ctex(128, 128, (x, w, h) => { x.fillStyle = "#1e3a8a"; x.fillRect(0, 0, w, h); x.strokeStyle = "#fbbf24"; x.lineWidth = 9; for (let i = -4; i < 8; i++) { x.beginPath(); x.moveTo(i * 24, 0); x.lineTo(i * 24 + h, h); x.stroke(); } }), 3), .012);
      break;
    }
    // ───────────── HOME ─────────────
    case "glass": {
      add(lathe([[0, 0], [.035, 0], [.037, .005], [.042, .12], [.039, .12], [.033, .008], [0, .008]], 28), new T.MeshPhysicalMaterial({ color:"#e0f2fe", roughness:.05, transparent:true, opacity:.38, clearcoat:1, side:T.DoubleSide, depthWrite:false }));
      add(new T.CylinderGeometry(.034, .032, .06, 24), new T.MeshPhysicalMaterial({ color:"#fb923c", roughness:.1, transparent:true, opacity:.75 }), 0, .038, 0);
      break;
    }
    case "toothbrush": {
      const b = new T.Group(); g.add(b);
      add(new RoundedBoxGeometry(.018, .012, .17, 2, .005), plastic(opts.color || "#06b6d4"), 0, 0, 0, b);
      add(new T.BoxGeometry(.016, .016, .03), std("#f8fafc", { roughness:.9 }), 0, .013, .07, b);
      for (let i = 0; i < 3; i++) add(new T.BoxGeometry(.017, .004, .006), std("#22d3ee", { roughness:.9 }), 0, .022, .06 + i * .01, b);
      b.position.y = .008;
      break;
    }
    case "soap": {
      add(new RoundedBoxGeometry(.1, .035, .065, 3, .014), new T.MeshPhysicalMaterial({ color:"#f9a8d4", roughness:.35, clearcoat:.5, sheen:.4 }), 0, .018, 0);
      const bub = new T.MeshPhysicalMaterial({ color:"#ffffff", roughness:.05, transparent:true, opacity:.45, clearcoat:1, depthWrite:false });
      [[.03, .045, .01, .015], [-.02, .05, -.01, .012], [.0, .065, .02, .009]].forEach(([x, y, z, r]) => add(new T.SphereGeometry(r, 14, 10), bub, x, y, z));
      break;
    }
    default: add(new T.BoxGeometry(.1, .1, .1), std("#f0f"), 0, .05, 0);
  }
  return g;

  function crayon(c, s = 1) { const cg = new T.Group();
    const wrap = ctex(128, 64, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, 8, w, 4); x.fillRect(0, h - 12, w, 4); x.fillStyle = "rgba(255,255,255,.7)"; x.font = "bold 16px Arial"; x.fillText("~~~", 40, 38); });
    const m = std(c, { roughness:.55 });
    add(new T.CylinderGeometry(.0075 * s, .0075 * s, .07 * s, 14), new T.MeshStandardMaterial({ map:wrap, roughness:.8 }), 0, 0, 0, cg);
    add(new T.CylinderGeometry(.0072 * s, .0075 * s, .012 * s, 14), m, 0, .041 * s, 0, cg);
    add(new T.ConeGeometry(.0072 * s, .016 * s, 14), m, 0, .055 * s, 0, cg);
    return cg; }
}

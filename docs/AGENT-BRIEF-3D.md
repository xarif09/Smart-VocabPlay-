> **เลิกใช้แล้ว (v3.21)** — เกม 3D ถูกแทนด้วยเกม 2D ใน `src/game2d/` ดู skill `vocabplay-new-game`

# Shared brief for 3D mini-game agents (Smart VocabPlay)

Repo: /home/user/Smart-VocabPlay- (Vite 8 + React 19 + three.js 0.170, base "/Smart-VocabPlay-/"). Kids' (age 4–9, Thai) English vocab app; many kids can't read yet.

Reference implementation to copy patterns from (read, don't edit unless your brief says so): `src/Runner3D.jsx`, `src/runner/environment.js` (setupEnvironment: HDRI sky + PBR ground/road per theme: jungle, park, school, snow, city, beach, candy, space), `src/runner/props.js` (loadPropKit). Assets: `public/3d/` (Poly Haven CC0), `public/models/*.glb` (characters: fox, shiba, bunnykid, redpanda, mage, robot, deer, horse — all face +Z; clip names in `src/Runner3D.jsx` CHARS).

## Component contract (default-export React component, lazy-loaded by App)
props `{ words, speak, track, catId, sfx, Prompt, ui }`
- `words`: array of `{ id, word:"APPLE", meaning:"แอปเปิล", emoji, cat, read }` for the category (20–100 items).
- `speak(word, thaiMeaning)` plays audio. iOS rule: the FIRST speak must happen synchronously inside a click handler (e.g. the Start button); later rounds may call it from timers.
- `track.correct(wordObj, event?)` / `track.wrong(wordObj)` per answer; `track.finish(score, total, { label })` once at the end (App shows the result screen).
- `sfx`: `{ tap(), coin(), ok(), bad(), win() }`.
- `Prompt`: React component — render `<Prompt w={target} onClick={() => ui.say(target)} />` above the 3D view whenever there's a target (big 🔊 + English word + Thai meaning). Prompts must ALWAYS be sound + written word.
- `ui`: `{ imageUrl(w) → photo URL or null, say(w), correct(w), wrong(w), unlock(), tokens:{ card, ink, primary, onPrimary, shadow } }`. Use `ui.tokens` for HTML UI colours (never hardcode UI colours; colours inside the 3D world are fine).

## UI rules
Mobile first (test 390×844 and 360×640), nothing overlapping, buttons ≥ 44 px, big touch targets, minimal text, Thai labels. Start screen with a big "▶ เริ่ม!" button. 8–10 rounds. localStorage only in try/catch. WebGL creation in try/catch with a Thai fallback message. Dispose everything on unmount. Mobile performance: pixelRatio ≤ 1.6, modest triangles/draw calls, shadow maps 1024–2048.

## Assets
CC0 preferred, CC-BY OK (record attribution). Reachable: raw.githubusercontent.com, github.com (git clone public repos), api.polyhaven.com, dl.polyhaven.org, registry.npmjs.org. Blocked: quaternius.com, sketchfab, poly.pizza, itch.io, jsdelivr, kenney.nl.
Good sources: https://github.com/trebeljahr/quaternius-showcase (Quaternius CC0 mirror, `public/glb/<pack>/...`, see LICENSES.md) · https://github.com/KayKit-Game-Assets (KayKit CC0 packs: city builder, furniture bits, …) · Poly Haven API (`/assets?t=models`, `/files/<id>`; send a browser-like User-Agent).
Keep each model ≲ 1.5 MB (`npx @gltf-transform/cli` to dedup/resample/resize textures ≤ 512; decode Draco). Put files in `public/models/<your-folder>/` with `public/models/<your-folder>/CREDITS.md` (source URL, license, author per file).

## Testing
Do NOT start vite dev/preview servers (port 4173 is in use). Test with Playwright (`chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] })`): bundle a tiny harness with esbuild into your scratchpad and serve files with `page.route()` from disk. Look at your own screenshots critically (looks good? subject visible? readable at phone size?) and iterate.

Don't edit `src/App.jsx`, `src/Runner3D.jsx` or other agents' files. Final report: files, how to mount (props), suitable categories, word→model mapping, credits, screenshot paths, limitations. Short, English.

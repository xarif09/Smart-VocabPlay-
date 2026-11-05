# 3D models — Penalty Kick 3D (`src/PenaltyKick3D.jsx`)

| File | What | Source | Author | License |
| --- | --- | --- | --- | --- |
| `player.glb` | Goalkeeper + kicker (one rigged mesh, cloned and re-coloured at runtime). Mesh: **KayKit Mannequin (Medium)**. Clips: Idle_A, Hit_A, Death_A, Dodge_Left/Right, Running_A, Jump_Full_Short, Melee_Unarmed_Attack_Kick, Melee_Unarmed_Idle, Melee_Block, Melee_Blocking, Cheering, Waving from **KayKit Character Animations 1.1** (Rig_Medium) | Mesh: `tools/reference/Mannequin_Medium.glb`; clips: `library/animations/Rig_Medium_*.glb` in https://github.com/NoLimitNexus/game-models (mirror of the KayKit packs; licence text in its `licenses/`) — originals at https://kaylousberg.itch.io | Kay Lousberg (www.kaylousberg.com) | CC0 1.0 |
| `football.glb` | Football (soccer ball) | Poly Haven "Dirty Football" — https://polyhaven.com/a/dirty_football | Rohit Seervi | CC0 1.0 |

Processing (gltf-transform): clips copied onto the mannequin skeleton by bone name, resampled, deduped; mannequin texture 256 px PNG.
Football: 1k glTF → welded, simplified, textures resized to 512 px (≈15k tris, 0.67 MB).

Other scene assets come from `public/3d/` (Poly Haven CC0: `park` HDRI sky, `leafy_grass` PBR textures — see `public/3d/CREDITS.md`).
Pitch markings, net, stands, crowd, floodlights and LED boards are procedural (code + canvas textures).

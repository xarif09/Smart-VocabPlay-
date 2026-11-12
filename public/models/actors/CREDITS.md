# public/models/actors — credits

All files here are **CC0 1.0** (public domain). Used by `src/ActionStage3D.jsx`.

| File | What | Source | Author | License |
|---|---|---|---|---|
| knight.glb, mage.glb, barbarian.glb, ranger.glb | KayKit Adventurers 2.0 characters (Rig_Medium, no clips) | KayKit "Adventurers" pack, files taken from the npm package `hearthling@0.2.0` (`public/assets/characters/*.glb`, README credits KayKit) | Kay Lousberg — https://kaylousberg.com/game-assets | CC0 |
| anim-general.glb | Clips `Idle_A`, `Throw`, `Use_Item` (skeleton only) | KayKit Character Animations 1.1 — `Rig_Medium_General.glb` (via npm `hearthling@0.2.0`, `public/assets/anims/`) | Kay Lousberg | CC0 |
| anim-move.glb | Clips `Running_A`, `Walking_A`, `Jump_Full_Short` | KayKit Character Animations 1.1 — `Rig_Medium_MovementBasic.glb` (same route) | Kay Lousberg | CC0 |
| anim-tools.glb | Clips `Digging`, `Hammering` | KayKit Character Animations 1.1 — `Rig_Medium_Tools.glb` (same route) | Kay Lousberg | CC0 |
| anim-extra.glb | Clips `Cheer`, `Sit_Floor_Idle`, `Lie_Idle`, `Lie_StandUp`, `Unarmed_Melee_Attack_Kick` (IK/control bones stripped; same bone names as Rig_Medium) | KayKit Character Pack: Adventures 1.0 — `Characters/gltf/Rogue.glb`, https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (LICENSE.txt: CC0) | Kay Lousberg | CC0 |
| mug.glb | Mug prop (`mug_full`) | same GitHub repo, `Assets/gltf/mug_full.gltf` | Kay Lousberg | CC0 |

Processing: unused clips/meshes removed, keyframes resampled, `EXT_meshopt_compression` applied
with `@gltf-transform/cli` (the loader needs `MeshoptDecoder`, which ships with three.js).

Also used (already in `public/models/`, CC0): `robot.glb` (Dance, Wave, ThumbsUp, Jump, Running, Walking, Yes, Idle),
`bunnykid.glb`, `redpanda.glb` (Quaternius — Run, Walk, Wave, Jump, Yes, Idle).

Shovel, hammer, ball, pillow, blanket, dirt mound, work bench and confetti are built procedurally in code.

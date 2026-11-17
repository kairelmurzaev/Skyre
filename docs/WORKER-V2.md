# Temporary General Worker v2 — Skyre v1.2

## What shipped
The last approved General Worker v2 3D model is in the running game by
default; previous v0.9 villagers are retained as an automatic fallback.
All current villagers share the one body/head, with scarf accent colors
distinguishing most job roles. This is deliberately temporary.

- 23-joint KayKit-derived humanoid rig and custom Skyre clothing/face meshes
- Native animation clips in GLB: Idle, Walk, Work, PickUp, UseItem
- Game name maps Carry -> Walk, Wave -> UseItem until future Blender clips
- Skin clones and independent animation mixers for each resident
- Character Studio at /character-studio.html, with previous prototype
  comparison at ?hero=1
- Browser save format and worker logic are untouched

## Packing / delivery
worker-v2.js fetches ten static base64 fragments from
assets/characters/worker-v2, combines them and uses DecompressionStream
(gzip), then Three.js GLTFLoader.parse. The decompressed GLB has real
skinned meshes and five animation tracks. Static deployment has no
additional image/texture hosting requirement; materials are embedded.
Unsupported browsers or interrupted downloads revert to the original
rigged villager GLB automatically.

The archived model is derived from KayKit Adventurers v2.0 FREE, by
Kay Lousberg. CC0 asset pack: https://kaylousberg.itch.io/kaykit-adventurers
The fabric, scarf, curl and face details were modified for Skyre.

## Later Blender replacements
Export a GLB with named humanoid skeleton and named clips.
Replace worker-v2.js to load the new GLB and update rigged-characters.js's
createWorkerV2Rig / motion mapping. The old v0.9 factory remains
available as a fallback, preserving functionality while reviewing art.

No server deployment, billing, Telegram token or external APIs are needed
to view the models on Netlify.

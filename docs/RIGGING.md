# Skyre rigged villager v0.9

This directory documents the **original, skinned 3D character asset** created for Skyre. The previously approved character illustration is a style reference, **not an actual scan, Mixamo asset, or existing editable 3D model**. The glTF is a new modeled interpretation, intentionally more dimensional and articulated than the earlier primitive characters.

## Model

- `assets/characters/skyre-villager.glb` — glTF 2.0 binary containing the mesh, a **17-joint armature**, skin weights, painted procedural cloth/hair/leather/skin/straw textures, hats, aprons and baskets.
- **Animation clips** (baked into GLB): `Idle`, `Walk`, `Carry`, `Work`, and `Wave`.
- **Eight consistent identities:** Stable hash of the worker ID chooses skin tone and hairstyle. The same character is retained when switching jobs; the job selects the outfit/hat.
- `rigged-characters.js` preloads the GLB once and clones the hierarchy with `SkeletonUtils.clone` so each villager has their own independent skeleton. An `AnimationMixer` blends between work, walk, carry and idle based on actual worker routing. The old procedural meshes remain as an emergency fallback if the asset can't load.
- The GLB has no external dependencies: textures are inside the file. The Three.js runtime is still delivered through the existing pinned CDN import map.

## Regenerate editable 3D asset

Run `python tools/build_villager.py` with Python, NumPy, SciPy and Pillow available, then `npm test`. The generator is checked in so hairstyles, clothing meshes, proportions and animations can be evolved later. The GLB can also be imported into Blender for professional sculpting, hand-painted details, and further refinements; export it again retaining bone names and the five clip names.

## Performance and quality boundaries

The 1.7 MB GLB is downloaded once, and each resident reuses geometry while receiving unique skeletons and materials. The five bone-driven animations are animated in real time. It is a **proper skinned, rigged character**, but it is still stylized procedural modeling, *not* a professional character scan or a literal reconstruction of every detail in the concept illustration. It should be tested for frame rate, shadows, clipping and touch controls on real phones. The multiplayer server, farming and inventory rules are unchanged.

## Verification

Run `npm run check` and `npm test`. The asset tests inspect mesh skin weights, armature names, keyframe quaternions, costumes, embedded textures, and static HTTP delivery. Test render the characters on real iOS and Android devices before release.

# Skyre v1.7.1 — Mobile visual quality adjustment

Player feedback from iPhone 15 Pro running Chrome found 30 FPS visibly choppy and DPR 1.0 blurry. v1.7.1 restores the v1.6 pixel ratio cap (1.5), 1024x1024 PCFSoft shadows, and targets 60 FPS on mobile. It retains background render suspension and avoids explicitly requesting high-performance GPU on phones. These changes trade increased foreground GPU work for image and motion quality; phone temperature should be reassessed. No saved worlds, game rules, or camera bounds are changed.

## QA

- Verify smooth orbit / drag / zoom, preserved crisp textures / edges, normal shadows.
- Verify backgrounding Chrome freezes rendering and returning resumes the world.
- Compare iPhone heat and battery at equal screen brightness, network, and play duration (15–20 min, unplugged).
- `npm test` and `npm run check` must succeed before merge.

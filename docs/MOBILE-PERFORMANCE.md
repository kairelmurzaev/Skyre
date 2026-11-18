# Skyre v1.7 — Mobile battery performance (first pass)

## Goal

Reduce sustained GPU work on phones, including iPhone 15 Pro in third-party browsers, without changing saved worlds, camera bounds, building mechanics, or villager behavior.

## Changes

- Touch-first devices with viewport width <= 1024 CSS pixels use a 30 FPS rendering target (requestAnimationFrame still schedules at browser cadence, but expensive updates and drawing are skipped until the next render slot).
- Mobile render pixel ratio is capped at 1.0 instead of 1.5. Anti-aliasing stays enabled for an initial visual-quality comparison.
- Mobile sun shadow map is 512x512 instead of 1024x1024; mobile shadows use PCF instead of PCFSoft.
- Mobile WebGL renderer uses the default GPU power preference rather than explicitly requesting high performance.
- The 3D frame loop cancels while the document is hidden and resumes when shown, with lifecycle cleanup on scene disposal.
- Desktop remains uncapped at its existing 1.5 pixel-ratio ceiling, 1024² PCFSoft shadows.

## Important limitations

- These changes are not a measured battery or temperature improvement. Only profiling on the target phone can establish actual savings.
- A 30 FPS target is not a guarantee: busy scenes can run slower, and browser display timing may yield somewhat fewer renders.
- This pass does not add adaptive resolution, instancing, LOD, or a graphics settings interface yet.
- The existing 2-second local game simulation and 4-second remote synchronization timers remain active as designed; hiding only pauses the render loop.
- The touch/viewport heuristic is intentionally conservative and should be evaluated for desktop touchscreens/tablets.

## Test plan

1. Run `npm run check` and `npm test`.
2. Load on iPhone 15 Pro in the browser actually used by the player. Check island, desk and villager details for unacceptable aliasing or shadow artifacts.
3. Rotate, pan and zoom from overhead to very low angles; ensure v1.6 desk camera bounds still work.
4. Build and move an object; confirm touch editing and world saves behave exactly as before.
5. Switch to another tab/app for 30 seconds, return, and confirm animation and camera interaction resume (no black canvas or frozen controls).
6. Compare phone heat and battery drain over two 15–20 minute sessions with matched brightness, ambient temperature, activity and charger state. Avoid testing while charging.
7. Repeat on desktop and a lower-powered phone before merging.

## Further optimization candidates

- FPS/frame time + `renderer.info` draw-call diagnostics;
- quality selection and user override;
- mobile scene-level shadow-caster reduction;
- movement-dependent and distance-dependent animation updates;
- object pooling in the active villager expedition route;
- LOD/geometry batching after profiling actual draw calls.

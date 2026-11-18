# Skyre v1.4 — Beyond the Island

## New gameplay

- The wooden desk now holds a detailed clickable coffee mug, a stack of books,
  a potted plant, and a little letter. The desk lamp and moon mirror keep
  their existing shared-world behavior.
- Four glowing build markers: Book Crossing, Mug Corner, Plant Corner,
  Study Nook. Current placement is intentionally limited to these safe sites.
- Build: Pencil Footbridge (10 wood, 3 stone, requires Book Crossing), Crumb
  Stall (9 wood, 4 stone), Leaf Camp (12 wood, 4 stone), Paper Workshop (11 wood,
  7 stone), or Desk Lantern (4 wood, 2 stone). Allowed site types vary.
- The mug gives 2 seeds + 1 coin every 45 seconds when tapped/collected;
  the desk plant grants 3 seeds every 60 seconds. Collect through the panel.
- Once the bridge exists, press Send explorer at the giant books; a villager
  travels across the island, down the little bridge and to the books, then
  returns with 4–8 coins and one seed. The trip takes 32 seconds.
- Tap the floating coffee button or More > Desk adventures to view the desk.
  Use Look closer to focus specific objects; Return to island resets camera.

## Implementation

- desk.js: pure rules; validates costs, sites and building types, cooldowns,
  expedition assignment and single-claim rewards. Shared by browser and server.
- desk-art.js: standalone 3D art, clickable objects, marker billboards,
  construction meshes, animated mug steam.
- scene.js: desk raycasting, desk camera, explorer animation.
- app.js: desk panel, tool selection, build/removal and collection actions.
- server/actions.js: four new desk commands (deskBuild, deskRemove,
  deskCollect, deskExplore), validated with the same pure rules.
- core.js adds an optional desk state with automatic old-save migration;
  workers.js applies expedition rewards once even after being offline.

## Limitations and future improvements

This is a small, tested first release, not a large explorable map. Structures
cannot yet be placed anywhere on the desk, and the book expedition is an
animated short activity, not a fully navigated or branching mission. Broader
construction, puzzles, new destinations and deeper villager autonomy can come
later. No separate save migration is required.

## Testing

npm run check && npm test runs all regressions. Manual browser QA should
check phone portrait/landscape, scene tap targets, expedition animation,
saving, opening and closing desk tools, and WebGL errors.

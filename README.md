# Someone Else's Sky — Living Worlds · Milestone 1.5

A cozy 3D farming-and-building game where every Telegram group's village will eventually live inside someone else's miniature world.

## Running the prototype

Start a static HTTP server in this folder:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000`. Three.js is loaded from a CDN, so the browser needs an internet connection and WebGL. Run logic tests with `npm test` (Node.js 20+).

## How to play

1. **Explore:** drag to orbit, scroll/pinch to zoom, tap trees and rocks for building materials. Resource nodes replenish every 12 seconds. Tap a ripe Dream Orchard to collect fruit and seeds.
2. **Farm:** choose Cloud Wheat, Sunroot or Moonflower, then tap an empty garden plot. Plants visibly grow and sway, even when the game was closed, and become harvestable at maturity.
3. **Build:** select a structure and tap a highlighted tile. A translucent silhouette previews its footprint when you hover; green is available and affordable, red is occupied/unaffordable. Press R or tap Rotate to turn a preview. New: a Dream Orchard produces 4 food and 1 seed every 90 seconds; tap it in Explore to collect.
4. **Move:** select a placed building then an empty tile. Moving is free, and crops inside a moved plot keep their growth progress. Press R or use Rotate to turn the selected building.
5. **Remove:** reclaim half a building's original materials.
6. **Produce:** grow wheat, process 3 wheat into 2 flour at a windmill, and convert 2 flour into 6 food and 4 coins at a bakery.
7. **Village goals:** optionally claim one-time rewards for harvesting, expanding your village, unlocking the production chain and helping your neighboring world.
8. **Connect worlds:** group A and B are simulated in this browser. Your lamp affects their crop sunlight, your moon mirror gives them harvest bonuses, and you can gift their world seeds.

## Changes in 1.5

- Moving villagers (two per cottage, up to six), ambient chimney smoke, continuously turning windmill sails and live crop animation.
- Red/green construction preview, move-and-rotate mode, orchard and four gentle milestone goals.
- Better legacy save migration: previously saved villages stay intact and receive new progress defaults.
- Twelve deterministic core rule tests.

## Current boundaries

Villagers are currently **visual ambience**, not automated workers. The connected worlds share local browser state only; this is **not yet multiplayer or Telegram group authentication**. All game state is saved to `localStorage` under `skyre-village-v1`; resetting clears that local data. Grow times are timestamp based.

Before real Telegram group launch, implement server-authoritative world state, authenticated actions with validated Telegram `initData`, persistence in a database and safe cross-world permission checks. Never ship a bot token or secret to client-side code.
# Someone Else's Sky — Living Worlds (v0.4)

A cozy, low-pressure 3D farming and village-building prototype. The village sits inside a glass globe; each group's lamp, mirror, gifts, and windmill can affect another world's growing conditions.

**Milestone 1.6: real walkable logistics.** Workers now navigate the island using a deterministic, weighted grid pathfinder. Stone Paths improve travel time and therefore actual automated job throughput; grass remains walkable so a missing road never locks casual players out of farming. Villagers visibly follow routes and return with baskets, and you can inspect routes through the worker cards.

## Run locally

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000` on a modern browser with WebGL and internet access (Three.js 0.170.0 is loaded from a CDN). No `npm install` is required to play.

```bash
npm test
```

Runs the deterministic Node.js game-logic tests, including route connectivity, road effects on job timers, off-line catch-up, legacy save restoration, and resource safety (Node.js 20+).

## Play

1. **Farm:** plant Cloud Wheat, Sunroot or Moonflowers. Growth continues between visits.
2. **Build:** choose cottages, plots, windmills, bakeries, moonwells, Dream Orchards and **Stone Paths**. Preview green/red placement; use `R` to rotate. Move existing structures without losing crops.
3. **Hire:** a cottage houses two villagers. Assign farmer, miller, baker, forager or rest. Farmers harvest, millers make flour, bakers make bread, and foragers collect materials.
4. **Lay out roads:** paths reduce travel costs from a villager's cottage to the currently selected field/workshop. Shorter routes let the worker finish more jobs per hour. A building occupying a cell cannot be passed through.
5. **Inspect journeys:** in the Villagers section, select *Show walking route* on a worker. A dashed line highlights the route in the 3D village and the worker card shows a projected cycle duration. A blocked workplace is identified clearly.
6. **Complete a gentle milestone:** build four Stone Paths to unlock the Little Footsteps reward.
7. **Build your production chain:** wheat → flour → bread; adjust worker jobs to keep things moving. The entire village shares inventory in this prototype; it's **not** a simulation of per-building stockpiles or item-by-item transfers yet.
8. **Connect worlds:** switch simulated group A/B to give sunlight, moonlight, windmill breeze and seeds to the other group. The other group need not be online for your village to function.
9. **Keep your progress:** worlds are persisted to localStorage under `skyre-village-v1`. Offline worker catch-up is limited to four hours and applied at most once for a given elapsed interval.

## Implementation

- `core.js` — pure game state, resource economy, land/building rules, crops and shared-world bonuses
- `routing.js` — deterministic Dijkstra shortest-time routes on the existing 9×9 island mask; road tiles are faster than grass; cache invalidates when buildings move, appear or disappear; no rendering dependencies
- `workers.js` — reproducible worker scheduling, route-derived round-trip travel times, offline catch-up and save-safe trip metadata
- `scene.js` — Three.js island with crops, villagers, parcel props and route overlays
- `app.js` — UI, assignments, input, resource display and selection
- `tests/` — unit/regression tests for game rules, workers and routes

**Design choice:** Unlike stricter road networks used by games such as Anno, roads in Skyre are an **efficiency incentive**, not an absolute prerequisite. The grid routing technique follows established weighted-graph pathfinding practices. Inspired by production-chain clarity from city builders and transport systems in factory games.

## Current limitations and deployment safety

This is a **local-browser demo**. The A/B worlds are stored in **one browser**, not synchronized between devices. It's **not yet** a live Telegram game or server-authoritative multiplayer. Group IDs must eventually be derived from authenticated Telegram context, never trusted from client requests. When a secure server is implemented, validate Telegram `initData` cryptographically, keep the bot token in server-side secrets, and authorize every change to shared worlds. No bot credentials are included here.

For production we also need a proper mobile performance budget, WebGL visual QA on physical devices, and a backend with transactional saves. This codebase deliberately avoids claiming those production features are complete.

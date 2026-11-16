# Someone Else's Sky · v0.5 — The Little Supply Chain

A cozy 3D village builder with farming, job-based automation, roads, **building inventories**, a **real delivery chain**, and two *simulated* connected worlds. Built for mobile browsers as a future Telegram Mini App.

## Run

Requires a modern WebGL-capable browser and internet access for the Three.js CDN. No dependencies or build needed for the playable demo.

```sh
python3 -m http.server 8000
# open http://localhost:8000
npm test        # Node.js 20+, all deterministic game-logic suites
```

## How to play

1. **Grow:** select Farm, pick Cloud Wheat / Sunroot / Moonflower, tap an empty garden plot. Tap ripe crops to harvest them directly into village stores. Crops continue growing between sessions.
2. **Build:** select Build, choose a structure, tap a valid empty cell. Build fields, cottages, Stone Paths, a Windmill, a Bakery, an Orchard, and the new **Storehouse**. Move and rotate structures to lay out efficient paths.
3. **Worker jobs:** each cottage houses two villagers. Assign Farmer, Hauler, Miller, Baker, Forager or Rest in the worker panel.
4. **Physical inventories:** farmers place wheat or food into their **plot stock**, not directly into the village stores. Orchards also stock fruit locally. The **Hauler** job carries batches of up to four goods from farms or the shared stores to workshops and from workshops back to the stores.
5. **Local production:** millers consume **3 wheat stored at a windmill** and create **2 flour there**; bakers consume **2 flour stored at a bakery** and make **6 food at the bakery**, plus 4 coins. Haulers complete the chain by delivering flour and bread. No goods are duplicated or teleported between buildings by automated jobs.
6. **Optional hands-on logistics:** press **Collect** on any stocked building to move available goods into the shared stores, or **Supply** on a workshop to stock it from shared stores. These buttons are intentionally instant for relaxed play. The manual Craft & Produce buttons still work with supplies already in the village stores.
7. **Storage:** the village begins with **36 shared storage spaces** for *wheat + flour + food combined*. A **Storehouse** adds **64 spaces**. Goods waiting inside production buildings have separate per-building limits. Other materials (wood, stone, seeds and coins) do not count toward this goods cap. Full storage blocks new deposits and manual goods harvests; it never deletes items.
8. **Paths:** haulers travel along actual shortest routes from home to pickup to drop-off and back. Roads reduce travel time. The route button shows a worker's journey. Grass remains walkable, so roads are a useful improvement rather than a hard requirement.
9. **Connected worlds:** switch between the simulated villages A and B. Your lamp lights the other village, the mirror gifts moonlight, windmills provide a breeze to their orchards, and you can send seeds. These interactions are local demo mechanics, not cross-device multiplayer.

**Suggested first production setup:** Build a Windmill and Bakery, add another Cottage for enough villagers, assign one Farmer, one Hauler, one Miller and one Baker. Add Stone Paths and a Storehouse when space gets tight. Or just farm and decorate at your own pace.

## Design and implementation notes

- `core.js` — deterministic core game rules, upgrades, shared village inventory, migration.
- `logistics.js` — pure stock tracking, hard capacity checks, planned delivery options and **transactional transfers**. Village stores are pooled across cottages/storehouses for simple player-facing logistics; individual producer stocks are real and must be moved by a hauler or manually.
- `routing.js` — weighted grid pathfinding, blocked structures, shorter roads, multi-stop hauler routing.
- `workers.js` — timed production simulation with limited offline catch-up, job scheduling, stock-producing farmers, real mill/bakery stock consumption and atomic hauler transfers.
- `scene.js` — procedural Three.js world, warehouse model, visible stock crates, job-colored villagers and route-following movement.
- `app.js`, `index.html`, `style.css` — inventory dashboard, building controls, production actions, village panels and mobile layout.
- `tests/*.test.mjs` — regression, migration, routing, inventory conservation, capacity and full production-chain tests.

Existing `skyre-village-v1` browser saves migrate in place; new building stock defaults to empty. All persistent data currently lives in each browser's `localStorage`, so **there is no real Telegram login, shared server database or cross-device world syncing**. A later multiplayer milestone must validate Telegram Mini App `initData` on the backend and implement server-authoritative game mutations. Never commit bot credentials.

### Scope limitations

The demo uses CDN-hosted Three.js and has not been cross-browser performance tested on real phones. Work routes and production are simulated in deterministic timer steps, not with individual animated physical items. Shared village stores are a single pooled depot inventory even if multiple storehouses exist. These are deliberate prototype simplifications, not a secure multiplayer economy.

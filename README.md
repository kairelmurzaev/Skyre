# Someone Else's Sky — Living Worlds · Milestone 1

**A cozy 3D farming and building game where your island lives inside another group's world.**

## Run

Use a modern browser with WebGL and an internet connection. The game uses Three.js from a CDN; no package installation or build step is needed.

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. For logic tests run `npm test` (Node.js 20+).

## How to play

- **Explore:** drag to rotate the island and zoom with a mouse wheel or pinch. Tap trees and rocks in the scene (or the Gather buttons) for wood and stone. Resource nodes regrow after 12 seconds.
- **Farm:** select Cloud Wheat, Sunroot, or Moonflower, then tap an empty garden plot. Tap again after it grows to harvest. Crop growth continues while the browser is closed.
- **Build:** choose Garden Plot, Cottage, Windmill, Bakery, Moonwell, or Stone Path. Tap an empty highlighted cell to place it. Press `R` or tap **Rotate building** to change orientation.
- **Remove:** tap an unwanted building for a 50% materials refund (rounded down).
- **Craft & produce:** collect wheat from your fields, build a Windmill to process 3 wheat → 2 flour, then build a Bakery to process 2 flour → 6 food + 4 coins.
- **Connect worlds:** the desk lamp you control changes the *other* group's sky. Their lamp gives your crops a 20% growth boost. The mirror adds harvest bonuses when aligned. Sending a seed gives the other world two seeds. Switch A/B to play both groups.

## Scope and security

This is a **single-browser prototype**, not actual live Telegram multiplayer. Two simulated group villages persist in **this browser's localStorage**, under `skyre-village-v1`. It does not synchronize between devices. Each world's progress is saved after any action; crop growth is derived from planting timestamps. The Reset button deletes local demo data.

To connect real Telegram groups in a later milestone, add a backend and database, validate Telegram `initData` on the server, derive group identity from trusted Telegram context rather than client input, and store world state transactionally. Never put a bot token in client-side JavaScript.

## Structure

- `core.js` — game rules, saves, farming, construction, crafting, and connected-world effects
- `scene.js` — procedural Three.js miniature island, buildings, lamps, rocks, trees, and raycast interaction
- `app.js` — tool selection, inventory, panel events, and UI
- `index.html` + `style.css` — responsive browser interface
- `tests/core.test.mjs` — deterministic game logic tests
# Someone Else’s Sky — Living Worlds · v0.3

A cozy **3D farming and village-building game** in which every group’s island is tied to another world inside a glass globe. This is a static, single-browser playable prototype, **not a deployed Telegram multiplayer bot**.

## Play locally

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000** in a modern browser with WebGL and internet access. Three.js loads from a CDN; there is no build step. Automated game-rule tests: `npm test` (Node.js 20+).

## Features

- **Explore:** rotate the 3D island, zoom, collect wood and stone from trees/rocks.
- **Farm:** plant Cloud Wheat, Sunroot, and Moonflower in garden plots. Crops grow while you're away.
- **Build:** choose structures, preview valid/invalid tiles, rotate with R or the UI, move structures without losing their crops, and recycle materials.
- **Production:** grind 3 wheat into 2 flour at a windmill, then bake 2 flour into 6 food and 4 coins at a bakery. Manual production remains available even without employed villagers.
- **Dream Orchard:** periodically produces food and magical seeds. A windmill in the other group brings a breeze that makes the orchard mature **20% faster**.
- **Connected worlds:** Group A/B simulation, gifts of seeds, sunlight growth bonuses and moonlight harvest bonuses. The other world is available even if nobody is online.
- **Goals:** optional milestones provide resources. There is no energy timer or paid shortcut.

## New in v0.3 — Little Hands, Big Dreams

Every cottage houses **two villagers**. The first cottage starts with a **farmer** and **forager**; additional cottages add residents who are initially off duty. In the **Little hands, big dreams** section, choose a job per resident:

| Job | What happens automatically | Interval |
| --- | --- | --- |
| Farmer | Plants your selected crop in an empty plot; harvests ripe crops or a Dream Orchard | 12s |
| Miller | Processes wheat into flour when a windmill is built | 20s |
| Baker | Bakes bread and earns coins when a bakery is built and flour is available | 24s |
| Forager | Adds 3 wood + 2 stone up to 250 each in automated storage | 28s |
| Rest | Enjoys the village without gathering or crafting | — |

Workers visibly move toward the type of building they serve and wear role-specific clothes. Jobs use the village's shared inventory: **logistics paths and physically carrying goods are not implemented yet**. Work is simulated chronologically by the browser and stored in localStorage. When you reopen the game, it catches up for **up to four hours**; this protects the small prototype economy from extreme accumulation. Each village has a local work journal and saved job assignments.

You can manually build, plant, harvest, craft, or gather at any time, even with no workers assigned. Saving, migration of earlier `skyre-village-v1` saves, and offline simulation have automated tests.

## Security and Telegram scope

**No bot token is used, saved or required in this repository.** This prototype stores both simulated groups in one browser's `localStorage`. Switching groups is for development testing, **not authentication**. This game is not yet synchronized between devices or connected to actual Telegram groups.

For real Telegram play, add a backend and database; validate Telegram `initData` server-side; use trusted group context; authorize cross-world actions; enforce rate limits and transactional inventory updates. Store any future bot credential only in private server-side environment secrets, never in public code or client-side JavaScript.

## Source layout

- `core.js`: farming/building/resources/world-link game rules
- `workers.js`: worker roster, jobs, offline production simulator
- `scene.js`: procedural Three.js island and villagers
- `app.js`: interface, inventories, worker assignment, save wiring
- `index.html` and `style.css`: mobile-friendly UI
- `tests/*.test.mjs`: deterministic game-rule regression tests

# Skyre v1.6 — Bounded Camera

The camera now stays connected to the actual wooden desk. You can freely
**rotate 360 degrees, tilt all the way down into an overhead view, zoom in
closely on any island/desk object, and pan across the desk**. The focus
cannot be dragged beyond the physical tabletop, so it is no longer possible
to lose the world off-screen.

Camera bounds preserve the same view angle and zoom when you reach an edge:
rather than snapping back or resetting, the camera simply stops panning
further. They also limit extreme vertical panning and dynamically adjust
close-up, low-angle views so the desk remains visible.

**Controls:** drag to rotate; scroll/pinch to zoom; right-drag on desktop
or two-finger drag on phones to move across the desk. The existing zoom
button and Desk Adventures camera presets still work. Existing worlds,
villagers, buildings, and saves are unchanged.

See [Camera controls](docs/CAMERA-CONTROLS.md) for limits and QA notes.

# Skyre v1.5 — Free Desk Editor + Mobile Usability

Skyre now supports **free placement of Crumb Stalls, Leaf Camps, Paper
Workshops and Desk Lanterns on the open wooden desk**, in addition to its
existing marked construction spots and fixed Pencil Footbridge.

**Use it:** open the full-screen game, tap the coffee icon for Desk
Adventures, and choose one of the four movable projects. The panel
closes so the world remains visible. Tap or drag on the desk to move
the green/red preview. Rotate with the button (R on desktop), then
tap Build or Cancel. Buildings snap in half-unit steps and cannot
overlap the island, desk edge, giant objects or other structures.

**Edit afterward:** tap a finished structure in 3D, or select it from
the Placed Desk Objects list. Use Move, Rotate or Store. Moving is free;
storing refunds half its materials and asks for confirmation. Existing
small v1.4 desk structures can be relocated without being charged again;
the bridge stays at the fixed Book Crossing for expeditions.

**Saves preserved:** the original skyre-village-v1 save key and Telegram
database schema remain unchanged; desk.props and desk.nextPropId are
additive fields initialized for older worlds. All actions are validated
on the server as well as locally.

The new [Clash of Clans design reference](docs/CLASH-DESIGN-REVIEW.md)
reviews the game systems, visual readability, contextual tools,
onboarding, progression and long-term activities, with a
Skyre-specific adaptation plan.

# Skyre v1.4 — Beyond the Island

The desk is now part of the world. In the full-screen game, tap the coffee
button or choose More > Desk adventures. The giant mug, book tower,
and plant are clickable landmarks. Collect crumbs by the mug or seeds from
the plant (with cooldowns), build miniature structures on four marked desk
locations, and send a resident on a 32-second trip to explore the books.

The first four desk areas support a Pencil Footbridge, Crumb Stall,
Leaf Camp, Paper Workshop and Desk Lantern (some types share a
location). Select an object in the Desk adventures panel and tap the marked
spot in the 3D world, or build directly from that panel. A footbridge is
required for book expeditions. Desk construction uses the existing wood and
stone resources; discoveries grant coins and seeds exactly once per trip.

Existing games are safe: the skyre-village-v1 save key stays unchanged;
older saves receive a new, additive desk field. Desk actions are validated
on the Telegram server as well as locally. The current release deliberately
uses four designated desk sites (not freeform placement anywhere); this is
the first playable stage of a more open desk sandbox.

See [Beyond the Island documentation](docs/BEYOND-THE-ISLAND.md).

# Skyre v1.3 — Mobile Game Experience

Skyre launches with our **approved golden Skyre title artwork**, a loading
state and game home screen. Choose **Continue my world** to enter a real
full-viewport game (no surrounding website sections). A mobile HUD provides
resources, camera controls and Build / Farm / Decorate / People / More tools.
The existing management panels remain available as scrollable game overlays.

**Install on your phone:** in supported browsers, choose *Install App* or
*Add to Home Screen*. Installed PWA mode is standalone. A normal browser tab
may still display its address bar; the browser decides whether a Fullscreen
API request is permitted. Telegram Mini Apps request expansion/fullscreen only
on versions that support those methods.

**Safety:** existing local saves (`skyre-village-v1`), world logic, residents,
recipes and Telegram server protocols remain unchanged. **Creative Mode is not
yet implemented**; its menu button is visibly marked coming later. Use the
existing confirmed reset button for New World in local-demo mode.

See [Mobile Game Experience guide](docs/MOBILE-GAME-EXPERIENCE.md).

# Skyre v1.2 — General Worker v2 integrated

**The last approved General Worker v2 is now the default temporary model
for all villagers in the actual game and Character Studio.** It uses a real
23-bone KayKit-based skinned mesh, tailored vest, olive scarf, detailed face
and hairstyle, and five embedded animation clips (Idle, Walk, Work, PickUp,
UseItem). Workers can still follow paths, harvest, haul and work. We translate
Carry -> Walk and Wave -> UseItem until replacement clips are available.

The old v0.9 rigged models are still an automatic loading fallback. Browser
saves, worker jobs, buildings and multiplayer protocols are unchanged.
We are **not** claiming distinct finished Farmer/Baker sculpts: all roles
temporarily share the v2 body with scarf-color accents, ready to replace later
with user-created Blender models.

Read [the integration and replacement guide](docs/WORKER-V2.md).

# Someone Else's Sky — v1.1, World Remaster

**Major environment update.** Cottages now have actual gabled roofs, windows,
timber framing, chimneys, front doors, porches and flowers. The bakery,
storehouse, windmill and well are rebuilt. The island has painted
grass/stone/soil/wood/tile materials, lush trees, decorated paths, and softer
water and shoreline details. Open the
[World Showcase](world-showcase.html) to inspect the new 3D models.

Farm mechanics, villager characters, saves and optional server integration
are unchanged. See [World Remaster Guide](docs/WORLD-REMASTER.md).

# Someone Else's Sky — v0.9, Real Character Rigs

**New visual milestone:** villagers now use a real glTF 2.0 skinned model with 17 bones, embedded painterly cloth/leather/hair textures, five baked animations (Idle, Walk, Carry, Work, Wave), eight stable appearances and job-dependent hats/aprons. The file is cloned with independent skeletons and played through `AnimationMixer`; jobs and roads still drive movement. In case it cannot load, the earlier geometry-based figure remains as a fallback.

Try the **[Character Studio](character-studio.html)** to inspect all eight villagers, change uniforms, play animations and rotate the camera on your phone.

This is an original, improved interpretation of the approved concept illustration, **not a literal conversion of the 2D image into a studio-quality sculpt**. See [docs/RIGGING.md](docs/RIGGING.md) for the asset-generation pipeline and remaining visual quality limitations.

The game works in local mode (including Netlify previews). Server multiplayer remains optional and needs a real deployment later.


A cozy 3D farming/building game where Telegram groups share **real persistent worlds** and can influence a paired group’s sunlight, moonlight and seeds. The farming, local inventories, village workers, roads, hauling and automation from v0.5 remain.

## New in v0.8 — Living Faces

The character sheet approved for the game is a **visual concept**, not a rigged 3D asset. See the [character art direction](docs/CHARACTERS.md) and its reference image.
This release translates that art direction into lightweight, in-engine Three.js figures:

- Round storybook proportions, expressive faces, individual hair styles and skin tones, real arms, hands, legs, boots and clothing layers.
- Job uniforms: farmer's straw hat and overalls; baker's chef hat and apron; forager's kerchief and apron; hauler's cap; miller's cap and work apron; casual villagers.
- Separate articulated legs, arms and heads for walking, idle motion and carrying baskets along the existing logistics routes.
- Stable, deterministic face/hair variations derived from existing worker IDs. Changing a villager's job changes only the uniform, not their identity. No new save fields or player data migration is necessary.
- Geometry and material caches, reused resident models and reduced material setup protect mobile performance.
- Both static Netlify mode and the optional Node backend serve the character modules. The game remains playable offline-from-backend (with its Three.js CDN loaded), without a Telegram bot.

These are original **procedural interpretations** of the approved concept. The character-sheet image itself is not a drop-in, animated 3D model. More detailed sculpted GLB characters, authored texture maps, and animation clips can be swapped in later without changing the game rules.

## Previously in v0.7 — The island grows with you

- **Expand land:** Unlock The Green Shore and The Far Meadow with wood, stone and coins. The 3D shoreline and playable/buildable grid expand together, and the unlock is saved per world.
- **Landscape:** Use the Landscape tool to place Flower Gardens (1 charm) and Lily Ponds (3 charm), or clear them. Ponds block construction and worker routes; decorative flowers are traversable but must be cleared to build on the tile. A new charm goal rewards decorating your island.
- **Upgrade:** Upgrade a Cottage to welcome a third resident, upgrade a Storehouse for 32 more storage spaces, or upgrade a Windmill to make 3 flour from 3 wheat. Upgrades are one-time, cost materials, and are reflected in the 3D models.
- **Compatibility:** Existing browser saves and server worlds retain their buildings, resources, crops, workers and other saved gameplay data. The land expansion and decorating rules are shared by local and server action handlers.
- **How to try:** Use the **Expand island** button, the **Landscape** and **Upgrade** tabs, and tap tiles or buildings in the 3D scene. Local demo mode works without a Telegram bot. The server integration remains available for later deployment; multiplayer is not required to play.

## How it works

- **Inside a Telegram group:** use a direct link to the bot's Mini App (not a keyboard web_app button). Telegram signs `chat_type`, `chat_instance`, and `user` in `initData`. The Node server verifies that signature and the timestamp **on every request**, and creates a unique persistent world for the verified group. Multiple members of that group edit the **same world**. Never accept a world ID or resources from the browser.
- **Find a neighbor:** press *Find a neighboring sky*. The server only pairs groups that opt in. When a second group chooses to connect, both groups see the other's game-world state, can gift seeds, and influence weather and orchards. The first group sees the connection within roughly four seconds.
- **Progress and updates:** the server processes named gameplay commands inside SQLite transactions; it rejects invalid actions and stores worlds on disk. Worker automation and crop growth advance based on server time, including offline catch-up (max four hours). A unique request ID prevents the same successful action from being applied twice after retries. Game clients poll every four seconds for updates.
- **Ordinary browsers:** open without signed group `initData` to play the original two-world demo saved only in browser `localStorage`. The demo **does not sync** with Telegram. It is intentionally separate from live worlds.

## Run and test locally

Requires **Node.js 22.16+** (uses `node:sqlite`; experimental warning on some Node 22 builds), a modern browser with WebGL, and internet access for the pinned Three.js CDN.

```bash
npm test
# For backend test: set a valid *new*, private token in your local environment:
BOT_TOKEN='YOUR_NEW_TOKEN' DATABASE_PATH=.data/skyre.db npm start
```

Visit `http://localhost:3000` to try a local demo. To use Telegram group authentication, host this same Node app at a public **HTTPS** address and configure a **direct-link Mini App** in @BotFather. Open the Mini App **from the Telegram group**, not from a private bot chat: Telegram only supplies the signed group context in the direct-link launch. You do **not** need to add the bot as an administrator merely for the Mini App to share state.

### Container deployment

```bash
# Set BOT_TOKEN as a secret in your deployment platform, never in source code.
docker compose up --build -d
```

`compose.yaml` publishes only to local port 3000 for a reverse proxy. Put HTTPS (e.g. Caddy or Nginx) in front of it. The `skyre_data` named volume survives container recreation. **Use one application instance with one persistent SQLite file**; this starter is not configured for stateless scaling across multiple servers. Back up the SQLite file **using SQLite's backup API** or by stopping the server before copying; the game needs persistent storage and a reliable backup policy to avoid data loss.

**Do not use GitHub Pages for the live game.** GitHub Pages can display the local demo but cannot run this backend or persist group worlds. Hosting secrets need `BOT_TOKEN`; optional settings: `DATABASE_PATH` (default `.data/skyre.db`) and `PORT` (default 3000). There are **no bot credentials committed to the repository**. Rotate any token previously pasted in a chat, and never paste the replacement into source control.

### Important limits

This is a tested multiplayer **MVP**, not a production launch certification. There is no bot webhook or push notification system (the game uses same-origin polling), no moderation or ownership roles within groups, no friend-pairing codes, and no transfer of old **local demo saves** to server worlds. Automatic pairing is opt-in and matches the oldest waiting group; it is not a private invitation system. The single SQLite host still needs proper operations (TLS proxy, monitoring, volume snapshots/backups and uptime). Security tests cover signed init data, group isolation, duplicate requests, malicious payloads, and transactional persistence; full 3D graphics and cross-device Telegram launch must be manually smoke-tested on real devices after deployment.

## Architecture

- `core.js`, `workers.js`, `routing.js`, `logistics.js`: shared deterministic rules; the server executes all mutating commands.
- `server/auth.js`: bot-token HMAC validation; group identity comes solely from verified Telegram context.
- `server/actions.js`: small allowlisted command protocol with input validation.
- `server/db.js`: WAL-mode SQLite storage, serialized transactions, opt-in group matchmaking, replay protection.
- `server/http.js`: same-origin static files and `GET /api/world`, `POST /api/action`, `GET /api/health`.
- `app.js`: local demo or signed live group with server polling and no client-side live saves.
- `tests/`: deterministic rules and backend security/integration tests (`npm test`).


## Experimental master worker character (v1.0 preview)

Character Studio includes an opt-in **Preview experimental master worker** link at `character-studio.html?hero=1`. Add `?hero=1` to the game URL to preview the character on unassigned villagers; all other jobs use the stable v0.9 cast. Existing characters and gameplay stay unchanged by default.

This is an **editable Blender character study**, not the approved final-quality model. It has an 18-joint humanoid armature, sculpted head and hair curls, layered clothing, separate fingers and detailed footwear; five animation states are driven by named bones. It still falls short of the cinematic character concept. Third-party multi-view modeling was blocked by insufficient Higgsfield credits; **no credits were spent**.

The optional GLB is stored as six base64 text parts under `assets/characters/master-worker/` (~416 KiB gzip-compressed in total). The browser fetches it only when the preview is enabled, inflates it with `DecompressionStream`, validates its skeleton and falls back on failure. The individual cloth/hair meshes have not yet been production-optimized.

[Open the editable master character scene](https://higgsfield.ai/3d-jutsu/be80feb4-cbc5-4e1c-9173-4cd1a76413bd).

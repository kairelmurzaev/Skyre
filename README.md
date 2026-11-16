# Someone Else’s Sky — v0.6, Shared Skies

A cozy 3D farming/building game where Telegram groups share **real persistent worlds** and can influence a paired group’s sunlight, moonlight and seeds. The farming, local inventories, village workers, roads, hauling and automation from v0.5 remain.

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

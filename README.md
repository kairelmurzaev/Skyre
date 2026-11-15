# Someone Else's Sky (Skyre)

A playable 3D proof of concept for a Telegram Mini App where each group controls objects that affect another group's miniature world.

## Play it

Open `index.html` via a local HTTP server (ES modules require HTTP):

```bash
python3 -m http.server 8000
```

Visit http://localhost:8000. Internet access is required for the Three.js CDN.

Use the A/B group buttons to switch between two simulated groups. Turn the lamp, rotate the mirror (three positions), or release seeds. The simulated world state persists in this browser's localStorage.

## Not yet implemented

- **Real multiplayer:** this is a local demo, not cross-device sync. The next milestone is a server and database with authenticated world actions.
- **Telegram identities and group context:** including server-side validation of Telegram `initData` and mapping groups to worlds.
- **Gameplay progression:** puzzles, invitations, discoveries and moderation.
- **Deployment:** GitHub Pages can host the static demo; a secure HTTPS backend is needed for the multiplayer version.

Never trust client-submitted chat/group IDs for authorization, and never commit the Telegram bot token.

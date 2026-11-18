# Skyre v1.3 — Mobile Game Experience

## New app flow

1. The approved golden-logo loading art appears immediately. It has landscape
   and composed portrait image variants, derived from the same user-approved art.
2. Once the WebGL world initializes, show the title menu (Continue my world,
   New World, Settings). New World uses the existing local reset confirmation.
   On an authenticated Telegram world, New World is disabled.
3. Tapping Continue enters an immersive island view that fills the phone
   viewport. The menu can be reopened from the top-left button.
4. A translucent fixed resource ribbon and floating action bar replace the old
   scrolling dashboard. Build, Farm, Decorate, People, and More open the
   existing game controls in an overlay. The game simulation code remains
   authoritative for all actions and saves.
5. Settings allows optional native fullscreen, demo-world switch, and home-
   screen install instructions. Creative Mode is deliberately disabled and
   labelled as a future feature.

## Mobile UI

- Responsive `100dvh` canvas, phone safe-area insets, portrait and landscape
  toolbars, one-handed buttons, and scrollable selection sheets.
- The prior information panels still exist in the DOM and are shown on demand.
- Character view, camera zoom, jobs, inventory, land expansion, crafting,
  trading with neighbors, and goals route through the existing app logic.
- Hero General Worker v2 characters remain unchanged from v1.2.

## PWA and browser limitations

- `manifest.webmanifest` declares a standalone app identity and custom icons.
- `sw.js` caches the basic game shell, approved artwork and previously fetched
  same-origin resources; Telegram `/api` is never cached.
- HTTPS is needed for installability except on localhost.
- Android Chrome may enter document fullscreen after explicit Start gesture.
  iPhone Safari normal tabs can retain address bars; use Add to Home Screen
  for a standalone experience. Telegram expands via available official APIs.
- The external Three.js CDN can be cached once loaded, but initial launch
  still requires internet access and a compatible WebGL device.

## Testing

`npm run check` validates JavaScript syntax and `npm test` runs game rules,
server, asset and mobile-shell regression tests. Browser QA covers portrait
and landscape start/menu/HUD/drawers.

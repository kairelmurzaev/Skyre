# Skyre v1.5: Free Desk Placement

## How to build

1. Launch Skyre and enter your island.
2. Tap the floating coffee icon for Desk Adventures.
3. Choose Crumb Stall, Leaf Camp, Paper Workshop, or Desk Lantern.
   The bridge stays at its original crossing for book expeditions.
4. Tap or drag to a half-unit snapped location on the desk.
   On phones, use two fingers to pan/zoom to other corners of the desk.
5. Green = valid, red = blocked. Rotate, Build or Cancel.
6. The resource bar shows the wood and stone relevant to construction.

## How to edit

Tap the structure in the 3D world or select it from Placed Desk Objects.
Move is free, Rotate changes its orientation, and Store returns half
the construction resources with confirmation. Legacy fixed-site
structures gain a Move option that migrates them to the free layout.

## Safety constraints

Furniture cannot overlap the island, desk edges, huge desk landmarks,
fixed structures, bridge, or other furniture. A 40-object cap protects
mobile WebGL. Existing worlds load without migration.

## Architecture

- Half-unit snapping, resource costs, validation and mutations live
  in pure desk.js rules shared by local game and authoritative server.
- 3D ghost geometry updates directly on hover/touch, not via a complete
  scene rebuild on every pointer event.
- Prop meshes and shared materials rebuild only when placed data changes.
- Original save key and expedition rewards remain unchanged.

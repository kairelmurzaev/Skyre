# Skyre v1.1 — World Remaster

This update replaces visible environment placeholders with purpose-built
Three.js meshes and deterministic painterly materials. **Gameplay, saves,
worker jobs, inventories, land prices, and multiplayer protocols are unchanged.**

## Rebuilt assets

- Cottage — real gabled tile roof, plaster triangle ends, wood-framed windows
  and shutters, timber crossbraces, front door, porch steps, chimney and flowers.
- Upgraded cottage — dormer, attic window and decorative upgrade detail.
- Bakery — gabled roof, striped awning, bakery sign, bread display and chimney.
- Storehouse — broad barn roof, cross-braced double doors, timber frame, sign,
  barrels and crates.
- Windmill — tapered stone tower, opening and window, four rotating linen sails.
- Well — masonry rim, roof, crank, rope and water.
- Orchard — branching tree, leafy lobes, individual leaf geometry, fruit and crate.
- Trees — branched organic trunks, leaf clusters and instanced colored leaves.
- Paths — irregular flagstones and green edges.
- Farms — raised wood planting beds, ploughed soil and crop furrows.
- Flower gardens and ponds — modeled petals, stone edges and lily pads.
- Ground/water — seed-painted grass, sand, stone, soil, shingles, water and
  shoreline foam; warm light and atmospheric fog.
- UI — botanical frame and an art-preview link.

The texture materials in world-materials.js are painted locally with seeded
noise and canvas effects. There are no third-party texture downloads.

## Preview
- Visit index.html for the live gameplay scene.
- Visit world-showcase.html for an interactive gallery of the six buildings;
  drag to orbit and pinch or scroll to zoom.

## Implementation and stability

- world-materials.js: reusable tiled texture maps and material library.
- world-art.js: all building, nature, foliage, water and shore meshes.
- scene.js: delegates rendering but retains build, upgrade, gather and crop logic.
- server/http.js: explicitly permits the new static files.
- Leaves and ground grasses are InstancedMesh to reduce mobile draw calls.
- Shared texture/materials survive scene refresh; transient model geometry is
  disposed on removal.
- Existing villager asset/animation files are not modified.

## Art limitations

These are original stylized procedural meshes, not high-poly Blender
sculpts or photogrammetry materials. Blender-authored mesh and texture
replacements remain an option later. This update is visual-only.

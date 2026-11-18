# Camera constraints — Skyre v1.6

## Player behavior

- Rotate freely around any focused point (including 360 degrees).
- Tilt all the way toward a top-down view and down toward a low angle.
- Zoom smoothly between close inspection and a practical whole-desk view.
- Pan across the physical desk with a mouse right-drag or phone two-finger
  pan without losing the tabletop off the screen.
- When reaching a desk boundary, panning stops at the edge. There is
  no abrupt camera reset, no change in zoom or direction, and no invisible
  unlimited off-table drift.
- The existing island reset/zoom, desk overview, villager-focus and
  individual desk-object camera commands remain valid.

## Implementation details

- Bounds are defined by the actual 23 x 18 unit desk. The orbital target
  stays inside x: -9.9..9.9 and z: -7.35..7.35, leaving a rim of wood
  so the view never points entirely away from the physical desk.
- Vertical panning is constrained separately. At close zoom and a
  shallow viewing angle, the maximum target height is dynamically
  reduced so the tabletop remains within the camera's vertical field
  of view.
- The correction translates the camera position and orbital target by
  the same amount, preserving actual zoom, yaw, pitch and damping.
- The maximum zoom-out distance is 43 world units. The minimum zoom
  distance is unchanged: 1.35 units for close inspection.
- Limits are applied after OrbitControls updates on every rendered
  frame, including momentum/inertia, and when resetting camera presets.
- No gameplay data and no saved-world structures are modified.

## QA

Run:
  npm run check
  npm test

Browser QA additionally checks desktop, portrait mobile and landscape
mobile with repeated extreme panning gestures, high zoom levels, top-down
rotation and existing camera presets. The camera state is accessible for
local automated tests with ?cameraQA=1 only on localhost.

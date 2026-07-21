# Little Worlds — The Persistent Living Miniature

An executable React Three Fiber spatial twin: six permanent rooms coexist inside one handcrafted house, room navigation reveals existing architecture, and the camera travels through the same continuous world without loading or replacement.

## Run

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
npm run preview
```

## Product flow

1. Orbit, pan, and zoom the 1:24 house freely on its pedestal.
2. As the camera approaches, the roof, floors, and reveal panels respond continuously to camera distance.
3. Several rooms become visible at once; softened walls preserve the dollhouse floor plan while close orbit remains readable.
4. Tap any visible object to focus the camera naturally and open its memory record.
5. Room buttons remain optional shortcuts to the same camera-focus system. There is no room mode or loader.

## Production architecture

- `src/object-dna/catalog.js` is the canonical data boundary for object identity, construction family, touchpoint, edge family, paint family, and memory.
- `src/scene/Objects.jsx` is a procedural Little Worlds kit: rounded laminated masses, captured panels, collars, pegs, tapered/turned supports, and visible functional joins.
- `src/scene/HouseScene.jsx` owns the single world, articulated architecture, camera spline, lighting, shadows, and scale-state choreography.
- `src/rooms/Rooms.jsx` mounts all six room components simultaneously into fixed world coordinates. It contains no selected-room rendering branch.
- `src/state/experience.js` is the finite experience state and shared transition clock.
- `src/ui/Interface.jsx` is the accessible DOM layer for wayfinding and memory records.

## Scaling rules

- New objects are compositions of shared construction parts, never isolated imported meshes.
- Materials are shared instances; variation belongs in DNA and paint regions, not per-mesh material creation.
- Every visible peg, seam, collar, or captured panel must explain assembly, movement, maintenance, or interaction.
- Object memories remain data. Geometry never owns application records.
- Repeated architectural elements should move to instanced meshes when room counts increase.
- Future AI asset authoring should output validated ObjectDNA plus a constrained part graph. Reject untouched primitives, missing touchpoints, unsupported materials, decorative joins, silhouette duplication, and geometry outside the room scale envelope before runtime ingestion.

The demo deliberately has no room loader or outside/inside mode switch. Camera distance continuously drives the reveal, room shortcuts and object clicks share the same damped focus path, and every room and object remains mounted at its permanent coordinate throughout the experience. Close walls become translucent construction panels rather than clipping through the model.

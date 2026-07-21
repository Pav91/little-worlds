# Little Worlds v6 — Creative Mode Foundation QA

- objective: `/Users/pavitter/.codex/attachments/6e0d785e-0199-4dde-a72b-f1cf2410b958/goal-objective.md`
- visual source truth: `/Users/pavitter/Desktop/House AI Project/output/concept-imagery/direction-c-peg-and-pocket/01-hero-living-room.png`
- initial world evidence: `/Users/pavitter/Desktop/House AI Project/household-memory-v2/qa/v4-miniature.png`
- zoom-driven reveal evidence: `/Users/pavitter/Desktop/House AI Project/household-memory-v2/qa/v4-zoom-open-2.png`
- optional shortcut evidence: `/Users/pavitter/Desktop/House AI Project/household-memory-v2/qa/v4-kitchen-focus.png`
- direct object-focus evidence: `/Users/pavitter/Desktop/House AI Project/household-memory-v2/qa/v4-object-focus.png`
- uninterrupted orbit evidence: `/Users/pavitter/Desktop/House AI Project/household-memory-v2/qa/v4-transparent-orbit.png`
- primary viewport: 1280 × 720
- build: `npm run build` passed
- browser console: clean on the final continuous-navigation run

## Shell refactor evidence

- closed unified-shell evidence: `/Users/pavitter/Desktop/House AI Project/unified-shell-closed-2.png`
- open unified-shell evidence: `/Users/pavitter/Desktop/House AI Project/unified-shell-open.png`
- adaptive front-angle evidence: `/Users/pavitter/Desktop/House AI Project/qa-v5-front-adaptive-2.png`
- v7 opening evidence: `/Users/pavitter/Desktop/House AI Project/qa-v7-premium-opening.png`

The structural pass removes room-local floor and wall boxes from `RoomShell`. The scene now begins with one continuous foundation, two connected floor plates, aligned perimeter walls, corner posts, front framing rails, an integrated fascia roof, and a single interior partition. Reveal panels remain articulated infill sections inside that frame, so they separate mechanically without reading as six independent room cubes.

The v5 reveal pass adds camera-aware, damped opacity to perimeter walls and facade panels. Front and side panels become translucent only when the camera is on the blocking side; upper walls and the upper floor soften when viewing from below. The reveal is continuous during orbit and zoom, preserves the shell framing, and returns to full opacity as the view clears.

The v7 finish pass keeps the interaction and architecture unchanged while upgrading the shared visual system: a quieter Scandinavian palette, stronger authored wood grain, matte painted materials, warmer environment light, softened bounced fill, richer contact shadows, restrained bloom, and higher exposure for a natural late-afternoon presentation. Interface surfaces now use more whitespace, lower visual weight, and gentler motion cues so the miniature remains the hero.

Creative Mode foundation: the new Explore/Create switch preserves the existing world and memory flow. In Create mode, object entities expose direct-selection state, a tactile ring/handle affordance, pointer drag editing, and command-backed undo/redo. Transform records are stored by ObjectDNA id so future duplicate, replace, snap, room assignment, and AI actions can use the same edit command boundary.

The second Creative Mode pass adds quarter-unit snapping, selected-object rotation, reversible deletion, and inline renaming. Hidden state is attached to the same command history, so deleting an object and undoing it does not require a separate editor state. The toolbar stays compact and only exposes object actions once an object is selected.

The duplication pass adds first-class copy entities with unique ids, inherited transforms, editable positions, and undo/redo support. Copies render as shared Little Worlds captured blocks and remain part of the miniature rather than appearing in a detached inventory.

Room-level editing now has a direct command boundary for renaming and finish accents. The Creative toolbar exposes these controls whenever a room is focused without an object selection, and room dock labels reflect renamed rooms. Room finish metadata is ready for binding to wall, floor, and ceiling materials as the architectural editor expands.

Room finish accents are now bound to visible room geometry: selecting sage, navy, or clay adds a quiet inset floor plane under the room contents, preserving the continuous shell while making the edit immediately legible.

The first library action is now available as “Add piece.” It creates a uniquely identified captured furniture block in the active room, selects it immediately, and routes its subsequent movement, rotation, rename, deletion, and history through the same command system.

The library now exposes three authored starter choices: Table, Lamp, and Plant. Each inserts a distinct low-poly Little Worlds silhouette with a unique id and the same transform, metadata, deletion, duplication, and history behavior.

Transform snapping is now room-aware: positions remain quarter-unit aligned, settle to the active floor height, and magnetize to the nearest room center inside a bounded radius. Outside that radius, free placement is preserved.

Placement is also clamped to a conservative room footprint so direct manipulation cannot push furniture through the continuous shell walls. The clamp is applied in the same transform command after snapping, keeping undo/redo deterministic.

Edited and inserted entities also receive a lightweight spacing guard: when a transform would place one editable entity within 0.48 world units of another, the command resolves it outward before committing. This avoids obvious overlap without introducing a physics engine.

Creative history now supports familiar keyboard commands in Create mode: Cmd/Ctrl-Z, Cmd/Ctrl-Shift-Z, Cmd/Ctrl-Y, Escape to clear selection, and Delete/Backspace to remove the selected object. Inputs are excluded from destructive shortcuts.

Architectural customization now includes an undoable roof finish command. The integrated roof can switch between terracotta, sage, and navy finishes directly from Creative Mode while preserving its existing lift and reveal behavior.

Inserted library entities can now be replaced in place between Table, Lamp, and Plant. Replacement preserves the entity id, transform, and edit history, so it behaves like a physical object being swapped rather than a delete-and-add animation.

Creative Mode now includes local Save and Restore actions. Layout transforms, inserted entities, object metadata, visibility, room metadata, room scale, and roof finish are serialized as one snapshot. Restore clears transient selection and command stacks so the loaded layout starts from a stable baseline.

Selected objects can now be assigned one of four manual categories—Furniture, Lighting, Plants, or Objects. Category changes are command-backed and included in saved layout metadata.

The Creative toolbar now exposes a live edit count, making the reversible command history legible without opening a separate history panel.

Room topology now has a reversible remove/restore command. Removing a room hides its persistent contents and footprint while leaving the continuous architectural shell and navigation intact; Restore brings the room back without reloading the scene.

The central interior divider is now structurally editable. Creative Mode can shift it left or right in bounded quarter-unit increments; the continuous shell updates immediately and the offset is saved with the layout.

Focused rooms can also be merged with the next catalog room through a reversible Merge next command. The second room is hidden from the persistent contents and the first room receives a combined name, preserving a single navigable world while establishing the merge command boundary.

Split room is now the inverse topology command: it marks the focused room as partitioned, names the new partition, and moves the live central divider to a deterministic offset. Split state, divider position, and room naming are all saved and undoable.

Add room now creates a persistent custom room record anchored beside the focused room. Custom rooms render through the same persistent room-world component and room shell, receive their own id and editable name, and survive Save/Restore and undo/redo.

Transform history now coalesces consecutive updates for the same entity, so a drag gesture records as one meaningful reversible edit instead of flooding the history stack with pointer-move samples.

The `C` key now toggles Explore/Create when focus is not inside a text field; existing object and history shortcuts remain Create-only.

Room footprint controls now provide bounded reversible resizing in Creative Mode. The selected room’s interior content and finish plane scale together in small increments, giving the user a tactile layout preview without replacing the continuous house shell.

Closed-state review: the exterior reads as one complete dollhouse with continuous horizontal bands, aligned corners, a shared roof overhang, and no shelf gaps between room modules. Open-state review: the same frame remains visible while the facade panels and upper floor articulate, preserving the illusion of one object opening rather than a room swap.

## Findings

No actionable P0, P1, or P2 findings remain.

- [P3] The camera-distance opening is intentionally softer and less theatrical than the previous button-driven flight. That trade-off is required to make zoom, orbit, pan, and room-to-room exploration feel like one continuous physical interaction.
- [P3] Optional room shortcuts remain visible as a compact utility dock, but the primary gesture copy and runtime behavior now prioritize direct camera exploration.

## Requirement audit

- Continuous world: `stage` is always `world`; there are no outside, opening, room, or returning render modes.
- Camera-driven reveal: `CameraRig` derives `transition.value` from the live OrbitControls distance every frame with damping. Roof, upper level, reveal panels, and wall opacity respond to that same value.
- Free camera: OrbitControls remains enabled at all distances with damping, pan, zoom bounds, unrestricted azimuth, and continuous target orientation.
- Intermediate exploration: all six permanent rooms remain mounted. Zoomed views reveal the lifted upper level, multiple room shells, furniture, and translucent walls simultaneously.
- Natural room movement: optional room buttons call `focusRoom`, which only supplies a camera position/target. The same focus system is used by object clicks.
- Object focus: `Interactive` computes each object’s world position and calls `focusObject`; the camera eases to it while its metadata panel opens.
- Orientation memory: the controls target and camera are never reset to a generic outside pose after focus. The user can continue orbiting, panning, and zooming from the focused position.
- Obstruction handling: close room walls fade to translucent construction panels; side-entry garage/office boundaries are articulated exterior panels; no room is removed or swapped.
- Persistent assignment: `PersistentRooms` mounts level 0 and level 1 entities from the same six-room catalog. Room selection is not used to choose a component or shared slot.
- Product scope: no new AI feature or metadata system was added; the existing object record is preserved.

## Focused comparison evidence

The initial world screenshot and the Little Worlds source retain the same pale timber, primary-color captured panels, windows, collars, softened edges, and quiet museum-object framing. The zoomed reveal and translucent-orbit captures are the relevant v4 evidence because the objective is a navigation transformation rather than a static-room redesign. The object-focus capture verifies that a visible object remains the interaction target while the camera moves and the existing information panel animates in.

## Fidelity surfaces

- Typography: Manrope/DM Sans hierarchy remains stable; the new instructional copy is concise and legible.
- Spacing: the optional shortcut dock is secondary and compact; the initial welcome card does not block the house center or primary canvas gestures.
- Color: the Little Worlds palette is preserved. Transparency uses the existing cream material family rather than introducing a new visual language.
- Image quality: the supplied lineup image remains the panel asset; the scene retains ACES output, shared PBR materials, environment reflection, contact shadows, bloom, vignette, and capped DPR.
- Copy: “The house is the interface” and “Drag · Pan · Zoom · Explore” communicate the new interaction model without implying room loading.
- Accessibility: semantic optional shortcut buttons, labeled panel close, reduced-motion styles, and visible gesture instructions remain present.

## Comparison history

### Pass 1 — blocked

- [P1] The first v4 build still behaved like a discrete room flight because stage transitions controlled the camera and OrbitControls were limited by mode.
- [P1] A focused free-orbit test could place the camera behind a solid room wall.

Fixes:

- Replaced stage-driven navigation with a permanent `world` state and a live camera-distance reveal clock.
- Kept OrbitControls enabled continuously; room shortcuts and object clicks now use the same damped focus targets.
- Added translucent close-range room walls and retained articulated side-entry panels.

### Pass 2 — passed

Zoom-driven opening, optional kitchen focus, direct coffee-table focus, and continued orbit after focus were captured in-browser. No render mode change, room swap, abrupt return, or console error was observed.

## Checklist

- [x] Continuous zoom/open behavior
- [x] Free orbit and pan at all zoom levels
- [x] Intermediate multi-room visibility
- [x] Optional room shortcuts
- [x] Direct visible-object camera focus
- [x] Persistent object metadata
- [x] Wall transparency / articulated reveal for obstruction handling
- [x] Continuous shell, connected floors, aligned corners, integrated roof
- [x] Camera-aware selective wall and upper-floor reveal
- [x] Premium material palette and authored timber variation
- [x] Warm environment lighting, contact shadows, tone mapping, and restrained bloom
- [x] Reduced UI visual weight and calmer interaction transitions
- [x] Explore/Create mode switch with direct creative toolbar
- [x] Object selection, drag transforms, and reversible edit history foundation
- [x] Grid snapping, rotation, deletion, and inline rename commands
- [x] First-class duplicate entities with undo and redo
- [x] Room rename and finish-accent commands with history
- [x] In-world Add piece library action
- [x] Typed Table, Lamp, and Plant starter library choices
- [x] Bounded room footprint resize controls with history
- [x] Build and browser verification

final result: passed

---

# Stabilization pass — interaction inventory and regression record

## Inventory

| Subsystem | Expected result | Dependencies | Verification |
| --- | --- | --- | --- |
| Mode switching | Explore/Create changes interaction ownership without stale selections | Zustand mode, OrbitControls | Switch repeatedly; Create has creative controls only |
| Camera/navigation | House, Rooms, floor and room shortcuts frame the persistent world | CameraRig, OrbitControls, room catalog | Use each dock control and resume orbit |
| Selection | Visible object clicks select it; empty-scene click clears; hidden geometry cannot intercept | R3F event propagation, `hiddenObjects`, Canvas pointer miss | Select, clear, delete, change modes |
| Object transforms | One pointer gesture produces one snapped, reversible transform | `Interactive`, transform state/history | Drag, release outside/cancel, undo/redo |
| Creation/duplication/deletion | Copies have unique IDs and independent records; deletion is reversible | custom object records, ObjectDNA metadata | Add, rotate, duplicate, delete, undo/redo |
| Room/structure editing | Each bounded structural edit is reversible and persists | structure/room state, room shell | Select a control, change, undo/redo, save/restore |
| Visibility/cutaway | Occluding shell must not capture pointer input while hidden | adaptive wall/reveal visibility | Create-mode selection through opened shell |
| History | Actions are ordered; a new action clears redo; no gesture floods history | Zustand history/future | mixed edit sequence |
| Persistence | A validated snapshot restores editable state and clears transients | localStorage schema v1 | Save, mutate, restore, reload |
| Keyboard/pointer | Editor owns gestures and releases them on cancel | pointer capture, `draggingObjectId` | Escape, Delete, undo/redo, interrupted drag |

## Fixed findings

- **P1 — save/restore was unreachable:** state actions existed but no creative-mode UI exposed them. Added Save and Restore controls.
- **P1 — malformed saved data was silently accepted:** added a versioned, validated v1 snapshot gate; malformed values are rejected and removed rather than merged into app state.
- **P1 — library/duplicate objects were not editable like original objects:** routed creative copies through `Interactive`, so they share selection, drag, rotation, visibility, and event handling.
- **P1 — transform history could merge separate operations:** replaced global same-object coalescing with explicit drag start/commit state. Pointer moves update transiently; release commits exactly one transform action.
- **P1 — release outside the canvas could leave editing stuck:** added pointer-cancel completion alongside pointer capture release.
- **P1 — redo deletion retained a stale selection:** redo now clears the selected ID when it hides the selected object.
- **P1 — restored/hidden object lifecycle could throw in the render loop:** guarded the object frame callback until its Three ref is mounted.
- **P2 — invisible shell geometry intercepted edit clicks:** create-mode exterior walls and roof are removed from the raycastable scene; structural controls remain available through the existing toolbar.
- **P2 — empty-space selection state was not centralized:** Canvas `onPointerMissed` clears both object and structure selection.

## Browser regression evidence — 2026-07-18

- Build passed after stabilization changes.
- Real browser: entered Create mode and verified the reachable Save/Restore, library, history, and structural controls.
- Real browser: added a table, rotated it, duplicated it, deleted the duplicate; history advanced from 1 to 4 actions.
- Real browser: undid the three operations and redid them; history returned from 4 to 1 and back to 4 without a runtime failure.
- Real browser: saved a layout, deleted the active object, and restored; restore cleared transient selection and history as intended.
- Console regression found and fixed the null-ref frame-loop failure above. The remaining Three material-property warnings predate this pass and are visual-library configuration warnings, not interaction failures.
- Real browser: a direct coffee-table click in the focused Living Room produces selection with **0 edits**; a physical pointer drag produces exactly **1 edit**. This confirms selection is no longer polluting history and a full drag is coalesced into one reversible action.

## Sims-style editing visibility pass — 2026-07-18

- Entering Create no longer resets the user to an unfocused all-house camera. It preserves the current room, or enters the Living Room when no room is active.
- Existing room shortcuts remain available in Create Mode, so room context can be changed without leaving the editor.
- Creative room focus mounts only the active room’s persistent contents; unrelated room furniture cannot occlude, intercept, or visually distract from the active edit.
- Editing a ground-floor room removes the upper storey from the rendered/raycastable workspace. Exterior walls, roof, and reveal panels are already removed in Create Mode.
- Browser evidence: the focused Living Room workspace shows only the room contents and editable floor context; direct coffee-table selection and pointer drag both completed successfully.

## Follow-up regression — 2026-07-18

- Kitchen shortcut → Create preserves Kitchen as the active edit context and exposes no unrelated room contents.
- Add Lamp → Rotate → Duplicate → Delete yields four discrete history entries; the UI returns to an unselected state after deletion.
- Exterior-wall move → undo → redo completes as one structural history action with no browser errors.
- Structural Save → mutate → Restore found that `structureEdits` had been omitted from persistence. Snapshot schema is now v2, persists `structureEdits`, and migrates v1 snapshots with an explicit empty structural-edit default.
- Camera House → Rooms → Floor 01 → Floor 02 → House completed in-browser with the House control correctly restored as active and no runtime errors.
- New library items and duplicates now carry a room assignment. Create Mode filters them to the active room, keeping placed objects from obstructing work elsewhere.
- Room rename now commits only on blur/Enter, and no-op room finish/size changes do not add meaningless history entries.
- Category regression: Create → Add Table → set category to Furniture creates the expected second history action; Undo restores the Objects category while retaining the selected object. Browser console remained error-free.
- Toolbar regression: a fresh browser session caught the loss of Save/Restore and room-level controls from the rendered Creative toolbar. The existing state handlers remained intact; controls were restored and re-verified in-browser.
- Keyboard regression: lower-case `R` rotates the selected created object and adds exactly one history entry; Cmd-Z removes the latest action. (The automation surface sends uppercase `R` as a different key code, so the browser check uses the real lower-case shortcut.)
- Destructive-shortcut regression: Create → Add Plant → Delete produces two history actions and clears selection; Cmd-Z restores the plant action without console errors or a stale selected-object toolbar.

## Resume verification — 2026-07-18

- Save/Restore and object-category controls were restored to the current Creative toolbar and verified in a fresh browser session.
- Entering Kitchen in Explore then switching to Create now preserves Kitchen as the active camera/edit context. Browser screenshot confirms a focused room workspace with exterior shell panels out of the way; console errors: none.

## Outstanding verification

Direct 3D object hit testing and physical drag paths still require a full five-consecutive-run sweep across each room and architectural operation. Do not mark this milestone complete until that browser-only sequence is recorded here without failures.

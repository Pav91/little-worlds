# Little Worlds — Showcase submission copy

## What the 43-project showcase corpus does consistently

The official Showcase projects are not presented as feature inventories. Their presentation follows a compact, repeatable shape:

1. **Name the world, then the action.** Titles are short and concrete. Taglines use a vivid noun plus a single understandable verb: *a living procedural terrarium with adjustable ecosystems*; *a tiny living town where zones grow*.
2. **Lead with the thing a visitor can do in seconds.** The best descriptions put the player or user in motion immediately: place, steer, tune, drag, choose, watch. The “signature interaction” is usually singular and visible.
3. **Use sensory detail to make the project memorable.** Warm lights, translucent forms, sunlit rooms, tactile glaze, and miniature worlds earn their place because they explain the feeling of the demo—not because they decorate a technical claim.
4. **Keep the card description to one sentence.** It establishes the premise, the primary action, and the resulting change. Technical context is deferred to the full description.
5. **Make the long description a single clear paragraph.** It identifies what the project is, who it is for, and the few behaviors that make it feel alive. It avoids implementation detail unless that detail is part of the experience.
6. **Write prompts as creative briefs with constraints.** They begin with “Build” or “Create,” define a focused central view, describe the main interaction and feedback, set an art direction, and close with requirements that preserve usability, responsiveness, or authenticity.
7. **Show progress as a small story.** Build notes use concrete verbs—explored, chose, added, expanded, developed, hardened—rather than generic claims of quality.

For Little Worlds, the signature interaction is not “a 3D scene editor.” It is: **bring an object from a photo or a few words into a small, living room, then place it where it belongs.** The technical system stays in the background, described only when it explains why the object feels personal rather than generic.

---

## Title

**Little Worlds**

## Tagline / card copy

**A living miniature home where remembered objects can be made, placed, and kept.**

## Short description

Little Worlds is a calm spatial keepsake built with Codex. Start with a photo or a description, create a one-of-a-kind household object, and place it inside a warm, editable miniature home.

## Long description

Little Worlds is an interactive home miniature built with Codex. A single open-plan studio holds a kitchen, living room, and bedroom in one continuous scene. Users bring in an object from a photo or a few words, watch it become a distinct piece of the home, then pick it up, turn it, and settle it into place. Late-afternoon light moves through the windows, lamps travel with the objects they illuminate, and every addition remains part of the room’s growing collection.

---

## Demo script

### 0:00–0:08 — Open on the room

Open directly on the miniature. Let the room sit for a moment: the kitchen at left, the brighter living area in the center, and the quieter bedroom at right. The warm window light should already make the studio feel inhabited.

**Voiceover:** “Little Worlds is a small home for the objects you want to remember.”

### 0:08–0:18 — Bring in a memory

Open **Generate from Photo** and select a photo of a familiar object—for example, a favorite lamp, chair, or keepsake. Keep the input moment short and legible.

**Voiceover:** “Start with something you already know: a photo, or just a few words.”

### 0:18–0:30 — Let the object arrive

Show the honest, four-step progress sequence: reading the photo, proposing the object, shaping it, and checking it. Reveal the new object in the room as soon as it is ready.

**Voiceover:** “Little Worlds turns that clue into a new object with its own shape, material, and small details.”

### 0:30–0:44 — Make it belong

Pick up the generated object. Use the existing soft drag behavior to move it into the living area, rotate it once, and set it down. Let the camera stay still while the object is selected, then show the tiny settling motion and local light response if it is a lamp.

**Voiceover:** “Then place it where it belongs. Move it, turn it, and make the room yours.”

### 0:44–0:54 — Show continuity

Open **Add Object**, switch to **Generated**, and show the same object available for reuse with its name, source, and finish intact. Add a sibling variation or duplicate only if it makes the frame better.

**Voiceover:** “Each object stays with the home, ready to return whenever you need it.”

### 0:54–1:00 — End on the feeling

Release selection and make one gentle camera move across the living room. End with the newly placed object inside the sunlit studio.

**Voiceover:** “Not a catalog. A place that slowly remembers you.”

---

## Initial prompt

Build **“Little Worlds,”** a calm interactive 3D home miniature where people can bring remembered household objects into a small living space. The experience should open directly into one continuous open-plan studio: a compact kitchen on the left, a generous sunlit living area in the center, and a quieter bedroom on the right. It should feel like a museum-quality architectural miniature, not a game level, CAD model, or generic cozy room.

The central experience is simple. A person can either upload a photo of a household object or describe one in a few words. Turn that input into a distinct, placeable object with a believable silhouette, material, color, and construction details. Do not silently substitute a generic stock object. If the input is uncertain, make an honest, constrained interpretation that still feels unique to the memory.

Place the new object in the room immediately. The person should be able to select it directly, pick it up with a soft, satisfying drag interaction, move it through the studio, rotate it, duplicate it as a visible sibling variation, delete it, or settle it into place. Keep the camera cinematic and constrained; when an object is selected, freeze camera movement so placing it feels calm and intentional.

Make the creation flow clear and reassuring. Use a bottom bar with **Generate from Photo** as the primary action, **Describe Object** as the secondary action, and **Add Object** as the tertiary action. While an object is being created, show real progress through four readable stages: **Reading photo evidence**, **Proposing ObjectDNA**, **Compiling Held Geometry**, and **Validating the asset**. Only advance when the corresponding work is actually complete.

Use a clear Little Worlds construction language throughout: pale laminated hardwood, captured panels, visible functional pegs and collars, softened edges, and seams that explain how something is assembled or moves. Use ivory architecture, a pale cream floor and plinth, light natural wood, sparse dark structural wood, deep blue, coral, mustard, and fresh green accents. Keep surfaces clean and tactile rather than realistic or noisy.

Light the studio with neutral daylight and one restrained late-afternoon sun. A readable window-shaped pool of light should cross the living-room floor and coffee table; the sofa should receive the warmest bounce; the bedroom should stay quieter. Lamps must carry their own local light so their effect moves with them. Add subtle weather and time-of-day controls, but keep them peripheral to the object-making moment.

Keep the home continuous and alive. There should be no room switcher, overview mode, floor changes, roof, or loading transition. The home is one place, and every created object remains reusable in a dedicated **Generated** collection with its name, source, finish, and lineage preserved.

Prioritize a beautiful first minute: choose a photo or describe an object, watch it arrive, place it in the light, and see the room become more personal.

---

## Showcase page copy

### Hero

**Little Worlds**

**A living miniature home where remembered objects can be made, placed, and kept.**

**Try it live**

### Description

Little Worlds is an interactive home miniature built with Codex. Begin with a photo or a few words, create a distinct household object, and place it in a warm open-plan studio. Every object can be moved, turned, settled, and kept in the room’s reusable collection.

### Build notes

#### Initial prompt

Use the **Initial prompt** above.

#### Iterations

- Explored several ways to represent a home, then chose one continuous studio miniature so the room could feel like a single place rather than a set of screens.
- Centered the experience on a simple proof: bring in one remembered object, see it arrive, and put it where it belongs.
- Built the Little Worlds object language around captured panels, softened forms, visible pegs, collars, and seams that make each piece feel assembled rather than generated from a generic catalog.
- Added photo and text creation paths, then kept the generated result visibly distinct instead of allowing a fallback stock object.
- Developed the placement interaction so objects can be picked up, moved, rotated, duplicated into sibling variations, and settled with a small physical response.
- Made the living room the visual anchor, with a larger sofa, close coffee table, late-afternoon window light, and a quieter bedroom beyond it.
- Added real local light to lamps so the object and its illumination travel together through the room.
- Kept the interface in creation mode: generate from a photo, describe an object, add a piece, then make a small adjustment without leaving the space.
- Preserved each generated object’s source, finish, and lineage so the home can become a growing collection of remembered things.
- Refined the progress states and camera behavior so creation feels honest, placement feels focused, and the room remains calm.

### Suggested metadata

- **Built with:** Codex + GPT-5.6 Sol
- **Model:** GPT-5.6 Sol
- **APIs / Products:** Codex, Responses API
- **Tech stack:** React, React Three Fiber, Three.js
- **Use case:** Visual experience, Image generation
- **Harness:** Codex
- **Type:** App

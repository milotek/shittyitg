# shittyITG

A small web rhythm game built around ITG-style modcharts.

The point of the project is the modcharts.
Everything else exists to give them something to happen to.

**ITG is the inspiration, not the specification.**
Its mods get borrowed because twenty years of people playing them proved the shapes read well in motion, which is expensive to rediscover from scratch.
That is the whole of the debt.
Where an ITG behaviour is worse than an alternative the alternative wins, mods ITG never had are fair game, and nothing here is ever measured against a reference capture.
This is not a port and fidelity is not a goal.

## What ships

Open a URL, pick one of three songs, play it, watch the field come apart.

- Three songs, selectable.
  `ftw` is the showpiece and carries a full modchart.
  The other two are playable with a light mod pass so the wheel is not bare.
- Twelve or more ITG mods, including the perspective family.
- Hold bodies that bend along the mod path.
- Hit feedback and a combo counter.

## What does not ship

- No life meter, no failing, no percentage score, no results screen.
  Grading is the least visible third of the work and nobody watching a demo can see it.
- No options screen.
- No chart editor.
- No multiplayer, no second player.
- No NotITG actor system, no Lua, no shaders, no render targets.
  Nothing in scope needs them.

Budget is roughly 15 to 20 hours.
The engine is the smaller half; authoring the `ftw` modchart is the expensive part and cannot be delegated.

**The rule that protects the project: it has to look visibly cool at the end of the first session.**
If session one ends with arrows scrolling and `drunk` working, momentum carries it.
If it ends with a simfile converter and nothing on screen, it dies the way the last two attempts did.

## Why greenfield

This was researched properly rather than assumed, so it does not need relitigating.

- **No FNF engine ships a working web build.**
  Psych is archived and desktop-only, Codename's CI builds Windows, macOS and Linux with no html5 job, P-Slice documents desktop only.
  They all forked from Funkin' 0.2.7 and went native for Lua scripting, video cutscenes, Discord RPC and filesystem mod folders.
- **Base Funkin' does ship web, but cannot be modcharted.**
  `html5` is in its CI matrix, but its holds are one self-rendering `SustainTrail` mesh doing its own `drawTriangles`, and FunkinModchart cannot drive that.
- **FunkinModchart is a dead end regardless.**
  Its author marks it unmaintained and lists inconsistent camera resolving, vertex colouring bugs and frame spikes.
  It is missing ten of the twenty-four mods this project needs, including the entire perspective family and `dizzy`.
  It has no way to render a non-arrow sprite, so no actors.
- **No StepMania has ever been compiled to the web.**
  Zero repositories for StepMania with Emscripten or WebAssembly.
- **No community web rhythm game is a usable base.**
  `In-the-Browser` is 29 KB, tap-only, and has no mods at all; it reads note types `1`, `2` and `4` as identical taps and drops `3` entirely.
  Bemuse is mature but is a finished BMS game with no mod system.

Nothing external has a notefield transform to hang mods on, which is the only genuinely hard part.

## Decisions

Each is a position and the reason for it.
The reason carries the weight, because most later questions are not literal matches for the position.

### Stack

- **Pixi v8 on TypeScript, built with Vite, tested with Vitest.**
  One transform pipeline for dev, prod and tests means a module that runs in the app runs in the test.
- **The renderer is the only thing that knows Pixi exists.**
  Mod maths, timing and chart handling stay renderer-agnostic so the drawing layer can be replaced without touching them.

### Charts are data

- **Charts are data, never code.**
  Someone can author a chart without touching the engine, which is how every rhythm game works and the only way the format survives contact with a second author.
- **A song is a folder served over HTTP, not an archive.**
  The browser caches per file and streams the audio, and there is no unzip step.
  Archives are for offline distribution and user-supplied packs, which is a later feature or never.
- **Notes are converted from `.sm` to the project's own JSON offline.**
  Runtime consumes a format it likes, with no MSD tokeniser and no BPM arithmetic on load, while any real simfile can still be dropped through the converter.
- **Mods live in their own file beside the notes.**
  Mods are the file that gets iterated on constantly; steps are written once.
  Keeping them apart means swapping either without touching the other.

### Mod authoring

- **The mod schema follows the Mirin Template's shape, not ITG's mod strings.**
  `{ beat, len, ease, set: {...} }` is what NotITG modders already think in, and it beats parsing `*9999 drunk` at runtime.
- **Easing curves, not ITG's linear approach.**
  `PlayerOptions::Approach` walks toward a target at a fixed rate because that is all a 2005 engine could express.
  These charts are new, so they get real easing functions.

### Mods

- **`ArrowEffects` is where the formulas start, not where they end.**
  Read OpenITG's copy rather than SM5's: it is shorter, frozen, and closer to the mods people actually remember.
  Then tune the constants, rename what is badly named, drop what is not fun and add what ITG never had.
  A formula being different from ITG's is not a bug.
- **Mod maths works in arrow cells, not pixels and not ITG's 640x480.**
  One cell is one arrow width, so a formula means the same thing at any resolution and nothing is pinned to a 2005 virtual screen.
  The previous attempt's magnitudes drifted precisely because its unit system was left implicit.
- **Layout is fully responsive, targeting 16:9.**
  It has to look right on a 2K display on someone else's machine, because the deliverable is a link.

### Rendering

- **Everything draws as a four-corner quad written into one buffer, not as Pixi sprites.**
  Bending holds already require a subdivided quad strip, so the mesh machinery is in scope no matter what, and putting taps through the same path costs one transform function rather than two draw paths.
  It also keeps `roll`, `twirl` and genuine per-note foreshortening available, which sprites would have ruled out permanently.
  One `Geometry` of interleaved position, UV and tint, rewritten each frame, one draw call per texture.
- **Four transformed corners, and nothing beyond that.**
  No 4x4 matrix stack, no frustum or lookAt, no `w` component, no depth buffer, no render targets.
  That machinery exists in the previous TypeScript attempt because NotITG charts need models, proxies and render-to-texture, and none of those are in scope here.
- **Draw order is a sort, not a depth buffer.**
  Sorting is sufficient while nothing has to genuinely intersect, and it keeps the draw layer at one buffer and one state.
- **Depth is faked on the quad, never given a per-note matrix.**
  Four corners already buy foreshortening, tumbling and arrows shrinking away down the field, which is everything depth would visibly give at this scale.
  A real depth buffer only earns its place when things must occlude each other correctly, and nothing planned does.

### Timing

- **`Clock.timeSeconds()` is an interface; Web Audio is what happens to be behind it.**
  Nothing above the clock knows or cares where time comes from.
- **The backing implementation is `AudioContext.currentTime`, and that part is load-bearing.**
  `HTMLAudioElement.currentTime` updates coarsely and quantised, so no smoothing layer on top of it recovers beat accuracy.
- **Input is graded against `event.timeStamp`, not the frame that noticed it.**
  Polling per frame bakes up to 16 ms of error into every hit at 60 fps and cannot be tightened later without redoing it.
- **Everything is time-driven, never frame-driven.**
  The game has to behave the same at 60, 120 and 144 fps.

### Assets

- **Peter's Scalable Cel, baked offline to animated sprite sheets.**
  The mesh is a flat cel arrow and its animation is a UV scroll, not bone animation, so a textured quad is visually indistinguishable from the model.
  The existing `bake_noteskin.py` already emits exactly this: six tap quantisations, mine, receptor, and hold and roll body, cap and top in active and inactive.
- **No runtime 3D model loading.**
  Users download PNGs; the `.ms3d` conversion is a build step that never reaches them.
- **Baked assets are committed.**
  A shareable URL and a portfolio piece both require the repository to clone and run on a machine that has never had NotITG installed.
  This is the specific failure the previous TypeScript attempt has: its songs and noteskins are gitignored and generated from a local install, so it only runs on one machine.

## Architecture sketch

```
src/
  engine/          no Pixi, no DOM
    timing/        beat <-> second, BPM changes, stops
    notes/         note data, the converted JSON shape
    mods/          the mod vector: current, goal, easing
    effects/       ArrowEffects port, ITG units in and out
    play/          hit detection, combo
  render/          the only place Pixi is imported
    notefield/     arrows, receptors, bending hold strips
    hud/
  tools/
    sm2json/       offline .sm to notes.json
    noteskin/      offline .ms3d to sprite sheets
  client/
    select/        song wheel
    gameplay/
public/songs/<slug>/
  manifest.json    title, artist, bpm, audio filename, difficulties
  notes.json       converted steps
  mods.json        the modchart
  audio.ogg
  bg.png
```

## Open questions

- Which two songs join `ftw`.
- How the perspective family is applied to the notefield container.
  A shear plus a per-column scale may be enough; a real projection is the fallback.
  Either way it is one transform on the field, never per note.
- How many subdivisions a hold body needs before it stops visibly faceting under `drunk` and `tornado`.
  Start at eight per beat and tune by eye.

## Where the 2D decision stops holding

Four-corner quads already cover `roll`, `twirl` and per-note foreshortening, so the wall is further out than it would be with sprites.
What 2D genuinely cannot do is anything needing true depth: arrows correctly occluding each other, render-to-texture effects, or 3D models.
Reaching for any of those means a depth buffer and a projection matrix, and at that point it is a different project.
Nothing above the draw layer would change, which is why the renderer stays the only thing that knows Pixi exists.

## Risks

- **`ftw`'s audio is presumably copyrighted.**
  It is the chosen showpiece and that is settled, but a public URL and a portfolio piece both mean it stays up, so this is a known and accepted exposure rather than an oversight.
- **Authoring three modcharts is the real cost.**
  The mitigation is that only one is heavy.
  If it slips, cut the other two to a handful of mod rows each rather than cutting the showpiece.
- **Scope creep toward NotITG.**
  Actors, Lua, shaders and render targets are all out, permanently, for this project.
  `assets/songs/ftw/modfile.xml` is a reference and an inspiration.
  It is not a spec and it is never executed.

## Prior art in this tree

Neither is a dependency; both are worth reading before writing the equivalent code.

- `~/Projects/webmania` (Haxe, uncommitted) has a working `.sm` parser, ITG timing, judgment windows and `bake_noteskin.py`, which is reused directly.
- `milotek/webmania` (TypeScript, private) has `src/engine/arrow/effects.ts`, a 421-line OpenITG `ArrowEffects` port covering roughly forty mods.
  It is the best available reference for the formulas, though its perspective mods parse and then do nothing.

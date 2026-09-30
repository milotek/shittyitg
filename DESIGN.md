# shitITG

## Overview

shitITG is a browser rhythm game whose purpose is to display modcharts.

A modchart is a timed sequence of transformations applied to the notefield: the arrows bend, rotate, split, tumble and recede while the chart plays.
Everything else in the system exists to give those transformations something to act on.

The deliverable is a URL.
It must load and run on an unfamiliar machine, in a stock browser, with no local install step and no assets generated on first run.

### Relationship to In The Groove

In The Groove is the inspiration, not the specification.

Its mod set is borrowed because two decades of play established which transformations read well in motion, and rediscovering that empirically is expensive.
That is the extent of the debt.

Three consequences follow:

- Where an ITG behaviour is worse than an available alternative, the alternative wins.
- Mods ITG never had are in scope.
- Output is never compared against a reference capture from any StepMania build.
  This is not a port, and fidelity is not a success criterion.

## Scope

### v1 ships

- A song wheel with three selectable songs.
- `ftw` as the showpiece, carrying a full modchart.
- Two further songs with a light mod pass, so the wheel is not bare.
- Twelve or more mods, including a perspective family.
- Hold bodies that bend along the mod path.
- Hit feedback and a combo counter.
- Responsive layout targeting 16:9, correct at 2K.

### v1 does not ship

- Life meter, failure state, percentage score, or results screen.
  Grading is a large share of the work and none of it is visible to someone watching the game run.
- Options screen.
- Chart editor.
- Second player.
- Actor system, scripting layer, shaders, or render targets.
  These are sequenced rather than rejected.
  See [Roadmap](#roadmap).

### Effort shape

The engine is the smaller half of the work.
Authoring the `ftw` modchart is the larger half, and it cannot be parallelised or delegated.

Build order follows from that: arrows scrolling with one working mod comes before anything structural.
A converter with nothing on screen is the wrong first milestone, because it defers the only part that validates the design.

## Architecture

### Stack

Pixi v8, TypeScript, Vite, Vitest.

One transform pipeline covers dev, production and tests, so a module that runs in the app runs unmodified in a test.

### Layering rule

The renderer is the only part of the tree that imports Pixi.

Mod mathematics, timing and chart handling are renderer-agnostic.
The drawing layer can be replaced, and a projection matrix or depth buffer can be introduced, without changes above it.

The notefield is one consumer of the draw layer rather than its entirety.
An actor system becomes a second consumer without restructuring.

## Chart format

### Charts are data, not code

A chart must be authorable without touching engine source.
This is how every rhythm game works, and it is the only form in which the format survives a second author.

### A song is an HTTP folder, not an archive

The browser caches per file and streams the audio, and there is no unzip step on load.
Archive support belongs to user-supplied packs, which is later work or never.

### Steps are converted offline

`.sm` files convert to the project's own JSON through a build-time tool.
The runtime consumes a shape it already likes, with no tokeniser and no BPM arithmetic at load time, while any real simfile can still be fed through the converter.

### Mods live beside the notes, in their own file

Mods are iterated on constantly.
Steps are written once.
Separate files mean either can be replaced without touching the other.

## Mod system

### Schema

The mod schema follows the shape of the Mirin Template:

```
{ beat, len, ease, set: { ... } }
```

This is the form modders already think in, and it removes any need to parse mod strings such as `*9999 drunk` at runtime.

### Easing, not fixed-rate approach

`PlayerOptions::Approach` walks a value toward its target at a constant rate because that is the whole of what a 2005 engine could express.

These charts are new, so they get real easing functions.

### Formula source

OpenITG's `ArrowEffects` is the starting point for the formulas, not the specification for them.

OpenITG's copy is preferred over SM5's because it is shorter, frozen, and closer to the mods people remember.

From there: tune the constants, rename what is badly named, drop what is not fun, and add what ITG never had.
A formula differing from ITG's is not a defect.

### Units

Mod mathematics takes arrow cells in and returns arrow cells out.

One cell is one arrow width.
A formula therefore means the same thing at any resolution, and nothing is pinned to a 640x480 virtual screen.
An earlier attempt's magnitudes drifted specifically because its unit system was left implicit.

## Rendering

### One primitive

Everything draws as a four-corner quad written into a single buffer.

Bending hold bodies already require a subdivided quad strip, so the mesh machinery is in scope regardless.
Routing taps through the same path costs one transform function rather than a second draw path.
It also keeps tumbling and genuine per-note foreshortening available, which a sprite-based path would have closed off permanently.

One geometry of interleaved position, UV and tint, rewritten each frame, one draw call per texture.

### Four corners and no more

No 4x4 matrix stack, no frustum or lookAt, no `w` component, no depth buffer, no render targets.

### Draw order is a sort

Sorting is sufficient while nothing in the scene has to genuinely intersect, and it holds the draw layer at one buffer and one pipeline state.

### Depth is faked on the quad

Four transformed corners already produce foreshortening, tumbling, and arrows shrinking away down the field, which covers everything real depth would visibly contribute at this scale.

A depth buffer earns its place only when objects must occlude each other correctly.
Nothing in v1 does.

## Timing

- `Clock.timeSeconds()` is an interface.
  Nothing above it knows where time comes from.
- The backing implementation is `AudioContext.currentTime`, and that choice is load-bearing.
  `HTMLAudioElement.currentTime` updates coarsely and in quantised steps, and no smoothing layer on top of it recovers beat accuracy.
- Everything is time-driven, never frame-driven.
  Behaviour must be identical at 60, 120 and 144 fps.

## Input

Input is graded against `event.timeStamp`, not against the frame that observed the event.

Per-frame polling bakes up to 16 ms of error into every hit at 60 fps, and that cannot be tightened afterwards without redoing the input path.

## Assets

- The noteskin is Peter's Scalable Cel, baked offline into animated sprite sheets.
  The source mesh is a flat cel arrow whose animation is a UV scroll rather than bone animation, so a textured quad is visually indistinguishable from the model.
  The source is `Not-ITG/peters-scalable-cel-HD` from Peter's Noteskins on GitHub, released under the Unlicense.
  The baker in `tools/noteskin/` emits the required set: six tap quantisations, mine, receptor, and hold and roll body, cap and top, each in active and inactive states.
- No runtime 3D model loading.
  Users download PNGs, and the `.ms3d` conversion is a build step that never reaches them.
- Baked assets are committed.
  A shareable link and a portfolio piece both require the repository to clone and run on a machine that has never had NotITG installed.
  Generating songs and noteskins from a local install produces a project that runs on exactly one machine.

## Layout

```
src/
  engine/          no Pixi, no DOM
    timing/        beat <-> second, BPM changes, stops
    notes/         note data, the converted JSON shape
    mods/          the mod vector: current, goal, easing
    effects/       mod formulas, arrow cells in and out
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

## Prior art evaluated

No existing project was adopted as a base.
The following was established by inspection and does not need repeating.

**No Friday Night Funkin' engine ships a working web build.**
Psych is archived and desktop-only.
Codename's CI builds Windows, macOS and Linux with no html5 job.
P-Slice documents desktop only.
All forked from Funkin' 0.2.7 and then committed to native targets for Lua scripting, video cutscenes, Discord RPC and filesystem mod folders.

**Base Funkin' ships web but cannot be modcharted.**
`html5` is genuinely in its CI matrix, but its holds are a single self-rendering `SustainTrail` mesh performing its own `drawTriangles`, which a modchart layer cannot drive.

**FunkinModchart is unusable regardless.**
Its author marks it unmaintained and documents inconsistent camera resolving, vertex colouring bugs and frame spikes.
It lacks ten of the twenty-four mods this project wants, including the entire perspective family and `dizzy`.
It cannot render a non-arrow sprite, so it has no actor concept.

**No StepMania build has been compiled to the web.**
There are no repositories pairing StepMania with Emscripten or WebAssembly.

**No community web rhythm game is a usable base.**
`In-the-Browser` is 29 KB and tap-only with no mod system; it treats note types `1`, `2` and `4` as identical taps and discards `3`.
Bemuse is mature and well built, but it is a finished BMS game with no mod system.

The conclusion is that nothing external provides a notefield transform to hang mods on, and that transform is the only genuinely difficult component.

Earlier attempts at this project are not reference material.
Everything here is written against this document and sourced fresh.

## Roadmap

Post-v1, and stated here so v1 does not design against it.

**OpenITG feature parity.**
The full mod set and the appearance options a player would expect to find.
v1 takes the dozen or so that look best; parity is the destination.

**An actor system.**
ActorFrames, sprites, text and tween queues: the machinery that lets a chart put something on screen that is not an arrow.
It is the line between a modchart and a mod sequence, and `ftw`'s own source file depends on it, with four ActorFrames and six BitmapTexts.

**A scripting layer.**
Charts remain data in v1, because data is the correct default and the format has to survive a second author.
A script hook alongside the data is the natural extension, not a replacement for it.

### Where the 2D decision stops holding

Four-corner quads already cover tumbling and per-note foreshortening, so the limit is further out than a sprite-based renderer's would be.

What quads cannot do is anything requiring true depth: arrows occluding each other correctly, render-to-texture effects, or 3D models.
Any of those requires a depth buffer and a projection matrix.

Nothing above the draw layer changes when that arrives, which is the reason the renderer stays the only component aware of Pixi.

## Risks

- **`ftw`'s audio is presumably copyrighted.**
  It is the chosen showpiece, and both a public link and a portfolio piece mean it stays published.
  This is an accepted exposure rather than an oversight.
- **Authoring three modcharts is the dominant cost.**
  Only one is heavy, which is the mitigation.
  If the schedule slips, the two light charts drop to a handful of mod rows each rather than the showpiece being cut.
- **Roadmap work migrating into v1.**
  Actors, scripting and full parity are all correct directions.
  The risk is that beginning any of them now means nothing ships.
  `ftw`'s modchart is remade in this project's schema to the original's feel, never transcribed from its modfile.

## Open questions

- Which two songs join `ftw`.
- How the perspective family shapes the field's corner transform.
  A shear plus a per-column scale may be sufficient.
- How many subdivisions a hold body needs before it stops visibly faceting under heavy mods.
  Start at eight per beat and tune by eye.

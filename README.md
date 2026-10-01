# shitITG

A browser rhythm game for showing modcharts.
`DESIGN.md` says why it is built the way it is.

## Running it

Everything runs inside the flake's devshell, which `direnv` enters on its own (or run `nix develop`).

```sh
npm install
npm run dev     # http://localhost:5173
npm run check   # Biome and the type checker
npm test        # the engine maths
npm run build   # a static site in dist/
```

In a dev build, `?song=<slug>&at=<beat>` skips the wheel and starts a song partway through, and a panel in the corner pins any mod to a slider.

## Adding a song

Put the simfile, its audio and its background in a folder, then:

```sh
node src/tools/sm2json/sm2json.ts path/to/song.sm <slug>
```

That writes `public/songs/<slug>/` with `notes.json`, `manifest.json`, `audio.ogg` and `bg.png`.
The wheel picks the folder up with no other change.
Reconverting never touches an existing `mods.json`, so a modchart survives new steps.

A modchart is `public/songs/<slug>/mods.json`: rows of `{ beat, len, ease, set }`, the Mirin Template's shape.
Values are percentages, except `xmod` and `cmod`, which are a multiplier and a BPM, and the rotation mods, which are degrees.
A chart is written by hand, and `ftw`'s is the worked example.
It follows the original NotITG modchart's structure: its section boundaries, its recurring gestures and its beats.
The magnitudes are this engine's own, because the mod formulas here work in arrow cells and a percentage does not mean what it meant in ITG.

## Rebuilding assets

The baked noteskin and the click-track song are committed, so none of this is needed to run the game.

```sh
uv run src/tools/noteskin/bake.py              # Peter's Scalable Cel, fetched from upstream at a pinned commit
node src/tools/clicktrack/clicktrack.ts        # the metronome fixture
```

## Licences

The noteskin is Peter's Noteskins, released under the Unlicense.
The HUD typeface is Chakra Petch, under the SIL Open Font License; its licence is in `public/fonts/`.

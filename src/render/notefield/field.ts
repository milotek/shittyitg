import { type DrawList, Layer } from '../../engine/draw/drawlist.ts'
import { corners, flat, type Placement, placement, type Warp } from '../../engine/draw/quad.ts'
import { place, type SongPosition, scrollOffset } from '../../engine/effects/effects.ts'
import { COLUMNS, DRAW_AHEAD, DRAW_BEHIND } from '../../engine/effects/field.ts'
import type { ModState } from '../../engine/mods/track.ts'
import type { Note } from '../../engine/notes/notes.ts'
import type { Skin } from './skin.ts'

/** The skin draws a down arrow; the other columns are that arrow turned, as its `.actor` files say. */
const COLUMN_SPIN = [Math.PI / 2, 0, Math.PI, -Math.PI / 2] as const

/** Beats either side of the song position worth even computing a scroll offset for. */
const LOOK_BEHIND = 8
const LOOK_AHEAD = 48

export type FieldChart = {
  notes: readonly Note[]
  /** Each note's time in seconds, precomputed from the timing data. */
  seconds: Float64Array
}

export type FieldFrame = {
  chart: FieldChart
  mods: ModState
  song: SongPosition
  skin: Skin
  /** Set once a note has been hit and should stop drawing. */
  gone: Uint8Array
  warp?: Warp
}

const spot = placement()

export function drawField(list: DrawList, frame: FieldFrame): void {
  const { chart, mods, song, skin, gone } = frame
  const warp = frame.warp ?? flat

  drawReceptors(list, mods, song, skin, warp)

  const notes = chart.notes
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i] as Note
    if (gone[i]) continue
    const ahead = note.beat - song.beat
    if (ahead < -LOOK_BEHIND) continue
    if (ahead > LOOK_AHEAD) break

    const offset = scrollOffset(mods, song, note.beat, chart.seconds[i] as number)
    if (offset < DRAW_BEHIND || offset > DRAW_AHEAD) continue

    place(mods, song, note.column, offset, spot)
    drawNote(list, note, offset, song, skin, warp, spot)
  }
}

function drawReceptors(list: DrawList, mods: ModState, song: SongPosition, skin: Skin, warp: Warp) {
  const receptor = skin.sprite('receptor')
  // The skin's receptor flashes on each beat and settles to 40% by the half beat, starting a
  // touch early so the flash reads as on time rather than late.
  const phase = (((song.beat + 0.05) % 1) + 1) % 1
  const level = phase < 0.5 ? 1 - (phase / 0.5) * 0.6 : 0.4

  for (let column = 0; column < COLUMNS; column++) {
    place(mods, song, column, 0, spot)
    const index = list.add(Layer.receptor, 0)
    corners(
      spot,
      receptor.width,
      receptor.height,
      COLUMN_SPIN[column] as number,
      warp,
      list.positions,
      index * 8,
    )
    list.paint(index, receptor.uv, level, level, level, spot.alpha, spot.glow)
  }
}

function drawNote(
  list: DrawList,
  note: Note,
  offset: number,
  song: SongPosition,
  skin: Skin,
  warp: Warp,
  p: Placement,
) {
  const mine = note.kind === 'mine'
  const uv = mine ? skin.mine(song.beat) : skin.tap(note.quant, song.beat)
  // Mines have no direction to show, so they turn with the beat instead of their column.
  const spin = mine ? (song.beat * Math.PI) / 2 : (COLUMN_SPIN[note.column] as number)

  const index = list.add(Layer.note, offset)
  corners(p, 1, 1, spin, warp, list.positions, index * 8)
  list.paint(index, uv, 1, 1, 1, p.alpha, p.glow)
}

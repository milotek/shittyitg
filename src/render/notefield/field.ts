import { type DrawList, Layer, type UvRect } from '../../engine/draw/drawlist.ts'
import { corners, type Placement, placement, type Warp } from '../../engine/draw/quad.ts'
import {
  place,
  receptorAlpha,
  type SongPosition,
  scrollOffset,
  visibility,
} from '../../engine/effects/effects.ts'
import { COLUMNS, DRAW_AHEAD, DRAW_BEHIND } from '../../engine/effects/field.ts'
import type { ModState } from '../../engine/mods/track.ts'
import type { Note } from '../../engine/notes/notes.ts'
import { NoteState } from '../../engine/play/state.ts'
import type { Skin, Sprite } from './skin.ts'

/** The skin draws a down arrow; the other columns are that arrow turned, as its `.actor` files say. */
const COLUMN_SPIN = [Math.PI / 2, 0, Math.PI, -Math.PI / 2] as const

/** Beats either side of the song position worth even computing a scroll offset for. */
const LOOK_BEHIND = 8
const LOOK_AHEAD = 48

/** Hold body samples per beat. More stops a body faceting under heavy mods, at a quad each. */
const HOLD_SAMPLES_PER_BEAT = 8

/** A dropped hold greys toward black rather than vanishing, so the drop is visible. */
const DROPPED_LEVEL = 0.45

export type FieldChart = {
  notes: readonly Note[]
  /** Each note's time in seconds, precomputed from the timing data. */
  seconds: Float64Array
  secondAt: (beat: number) => number
}

export type FieldFrame = {
  chart: FieldChart
  mods: ModState
  song: SongPosition
  skin: Skin
  state: Uint8Array
  /** How brightly each column's receptor is lit by a press, 0 to 1. */
  pressed: readonly number[]
  warp: Warp
}

const spot = placement()
const edge = placement()

export function drawField(list: DrawList, frame: FieldFrame): void {
  drawReceptors(list, frame)

  const { chart, song, state } = frame
  const notes = chart.notes
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i] as Note
    const ahead = note.beat - song.beat
    if (ahead > LOOK_AHEAD) break

    const status = state[i]
    if (status === NoteState.gone) continue
    if ((note.endBeat ?? note.beat) - song.beat < -LOOK_BEHIND) continue

    if (note.endBeat !== undefined) drawHold(list, frame, note, status ?? NoteState.pending)

    const holding = status === NoteState.holding
    const offset = holding
      ? 0
      : scrollOffset(frame.mods, song, note.beat, chart.seconds[i] as number)
    if (offset < DRAW_BEHIND || offset > DRAW_AHEAD) continue

    place(frame.mods, song, note.column, offset, holding ? 0 : ahead, spot)
    visibility(frame.mods, note.column, offset, spot)
    drawNote(list, frame, note, offset, spot)
  }
}

function drawReceptors(list: DrawList, frame: FieldFrame) {
  const { mods, song, skin, warp } = frame
  const receptor = skin.sprite('receptor')
  // The skin's receptor flashes on each beat and settles to 40% by the half beat, starting a
  // touch early so the flash reads as on time rather than late.
  const phase = (((song.beat + 0.05) % 1) + 1) % 1
  const pulse = phase < 0.5 ? 1 - (phase / 0.5) * 0.6 : 0.4

  for (let column = 0; column < COLUMNS; column++) {
    place(mods, song, column, 0, 0, spot)
    const alpha = receptorAlpha(mods, column)
    const pressed = frame.pressed[column] ?? 0
    const level = pulse + (1 - pulse) * pressed
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
    list.paint(index, receptor.uv, level, level, level, alpha, pressed * 0.3 * alpha)
  }
}

function drawNote(list: DrawList, frame: FieldFrame, note: Note, offset: number, p: Placement) {
  const { skin, song } = frame
  const mine = note.kind === 'mine'
  const uv = mine ? skin.mine(song.beat) : skin.tap(note.quant, song.beat)
  // Mines have no direction to show, so they turn with the beat instead of their column.
  const spin = mine ? (song.beat * Math.PI) / 2 : (COLUMN_SPIN[note.column] as number)

  const index = list.add(Layer.note, offset)
  corners(p, 1, 1, spin, frame.warp, list.positions, index * 8)
  list.paint(index, uv, 1, 1, 1, p.alpha, p.glow)
}

const piece = { u0: 0, v0: 0, u1: 0, v1: 0 }
const samples: { beat: number; offset: number }[] = []
const cuts: number[] = []

/**
 * A hold body is a strip sampled along the same path its arrows travel, so it bends with every
 * mod for free. The texture tiles from the tail, which keeps it still while a held body shortens,
 * and the strip is cut at every tile boundary so no quad ever has to wrap inside the atlas.
 */
function drawHold(list: DrawList, frame: FieldFrame, note: Note, status: number) {
  const { chart, mods, song, skin } = frame
  const end = note.endBeat as number
  const roll = note.kind === 'roll'
  const active = status === NoteState.holding
  const level = status === NoteState.dropped || status === NoteState.missed ? DROPPED_LEVEL : 1
  const name = roll ? 'roll' : 'hold'
  const body = skin.sprite(`${name}Body${active ? 'Active' : ''}`)
  const cap = skin.sprite(`${name}Cap${active ? 'Active' : ''}`)

  const from = Math.max(active ? song.beat : note.beat, song.beat - LOOK_BEHIND)
  const to = Math.min(end, song.beat + LOOK_AHEAD)
  if (to <= from) return

  const offsetAt = (beat: number) => scrollOffset(mods, song, beat, chart.secondAt(beat))
  const tail = offsetAt(end)

  samples.length = 0
  const steps = Math.max(Math.ceil((to - from) * HOLD_SAMPLES_PER_BEAT), 1)
  for (let s = 0; s <= steps; s++) {
    const beat = from + ((to - from) * s) / steps
    samples.push({ beat, offset: active && s === 0 ? 0 : offsetAt(beat) })
  }

  for (let s = 0; s < steps; s++) {
    const a = samples[s] as { beat: number; offset: number }
    const b = samples[s + 1] as { beat: number; offset: number }
    if (Math.max(a.offset, b.offset) < DRAW_BEHIND || Math.min(a.offset, b.offset) > DRAW_AHEAD)
      continue

    // Distance from the tail in tiles; the strip is cut wherever that crosses a whole number.
    const ta = (tail - a.offset) / body.height
    const tb = (tail - b.offset) / body.height
    cuts.length = 0
    cuts.push(0)
    for (let k = Math.floor(Math.min(ta, tb)) + 1; k < Math.max(ta, tb); k++) {
      cuts.push((k - ta) / (tb - ta))
    }
    cuts.push(1)
    cuts.sort((x, y) => x - y)
    for (let c = 0; c < cuts.length - 1; c++) {
      stripQuad(
        list,
        frame,
        note,
        body,
        a,
        b,
        cuts[c] as number,
        cuts[c + 1] as number,
        ta,
        tb,
        level,
      )
    }
  }

  if (to === end && tail >= DRAW_BEHIND && tail <= DRAW_AHEAD) {
    const a = { beat: end, offset: tail }
    const b = { beat: end, offset: tail + cap.height }
    piece.u0 = cap.uv.u0
    piece.u1 = cap.uv.u1
    capQuad(list, frame, note, cap, a, b, level)
  }
}

function stripQuad(
  list: DrawList,
  frame: FieldFrame,
  note: Note,
  body: Sprite,
  a: { beat: number; offset: number },
  b: { beat: number; offset: number },
  start: number,
  stop: number,
  ta: number,
  tb: number,
  level: number,
) {
  const lerp = (t: number) => ({
    beat: a.beat + (b.beat - a.beat) * t,
    offset: a.offset + (b.offset - a.offset) * t,
  })
  const near = lerp(start)
  const far = lerp(stop)
  const tNear = ta + (tb - ta) * start
  const tFar = ta + (tb - ta) * stop
  const tile = Math.floor((tNear + tFar) / 2)
  const vNear = 1 - (tNear - tile)
  const vFar = 1 - (tFar - tile)

  const index = list.add(Layer.holdBody, near.offset)
  const alpha = edgePair(frame, note, near, far, list.positions, index * 8, body.width)
  const uv = body.uv
  piece.u0 = uv.u0
  piece.u1 = uv.u1
  piece.v0 = uv.v0 + (uv.v1 - uv.v0) * clamp01(vNear)
  piece.v1 = uv.v0 + (uv.v1 - uv.v0) * clamp01(vFar)
  list.paint(index, piece, level, level, level, alpha, edge.glow)
}

function capQuad(
  list: DrawList,
  frame: FieldFrame,
  note: Note,
  cap: Sprite,
  a: { beat: number; offset: number },
  b: { beat: number; offset: number },
  level: number,
) {
  const index = list.add(Layer.holdCap, a.offset)
  const alpha = edgePair(frame, note, a, b, list.positions, index * 8, cap.width)
  piece.v0 = cap.uv.v0
  piece.v1 = cap.uv.v1
  list.paint(index, piece as UvRect, level, level, level, alpha, edge.glow)
}

/**
 * Writes a strip quad's corners from two points along the path. The body follows its column
 * rather than spinning with the arrow, so its edges run straight across the column.
 */
function edgePair(
  frame: FieldFrame,
  note: Note,
  near: { beat: number; offset: number },
  far: { beat: number; offset: number },
  out: Float32Array,
  at: number,
  width: number,
): number {
  const { mods, song, warp } = frame
  place(mods, song, note.column, near.offset, near.beat - song.beat, edge)
  const half = (width / 2) * edge.scaleX
  warp(edge.x - half, edge.y, edge.depth, out, at)
  warp(edge.x + half, edge.y, edge.depth, out, at + 2)
  visibility(mods, note.column, near.offset, edge)
  const alpha = edge.alpha
  const glow = edge.glow

  place(mods, song, note.column, far.offset, far.beat - song.beat, edge)
  const halfFar = (width / 2) * edge.scaleX
  warp(edge.x + halfFar, edge.y, edge.depth, out, at + 4)
  warp(edge.x - halfFar, edge.y, edge.depth, out, at + 6)
  edge.glow = glow
  return alpha
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

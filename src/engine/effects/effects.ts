import type { Placement } from '../draw/quad.ts'
import type { ModState } from '../mods/track.ts'
import { COLUMN_X, FIELD_HEIGHT, RECEPTOR_Y, REVERSE_RECEPTOR_Y } from './field.ts'

export type SongPosition = {
  beat: number
  seconds: number
}

/**
 * How far an arrow still has to travel before it reaches its receptor, in cells. Positive means
 * not yet arrived. At 1x an arrow covers one cell per beat.
 */
export function scrollOffset(
  mods: ModState,
  song: SongPosition,
  noteBeat: number,
  noteSeconds: number,
): number {
  const cmod = mods.get('cmod')
  if (cmod > 0) return ((noteSeconds - song.seconds) * cmod) / 60
  return (noteBeat - song.beat) * mods.get('xmod')
}

export function receptorY(mods: ModState, column: number): number {
  const reverse = mods.column('reverse', column)
  const y = RECEPTOR_Y + (REVERSE_RECEPTOR_Y - RECEPTOR_Y) * reverse
  return y * (1 - mods.get('centered'))
}

/**
 * Where an arrow sits. Holds call this at points between head and tail, which is how a hold body
 * bends through exactly the path its arrows take.
 */
export function place(
  mods: ModState,
  song: SongPosition,
  column: number,
  offset: number,
  out: Placement,
): Placement {
  const direction = 1 - 2 * mods.column('reverse', column)
  let x = COLUMN_X[column] ?? 0

  const drunk = mods.column('drunk', column)
  if (drunk !== 0) {
    x += drunk * 0.5 * Math.cos(song.seconds + column * 0.2 + (offset * 10) / FIELD_HEIGHT)
  }

  out.x = x
  out.y = receptorY(mods, column) + offset * direction
  out.depth = 0
  out.scaleX = 1
  out.scaleY = 1
  out.rotX = 0
  out.rotY = 0
  out.rotZ = 0
  out.alpha = 1
  out.glow = 0
  return out
}

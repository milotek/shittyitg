import type { Placement } from '../draw/quad.ts'
import type { ModState } from '../mods/track.ts'
import {
  COLUMN_X,
  COLUMNS,
  FADE_LINE,
  FADE_WIDTH,
  FIELD_HEIGHT,
  RECEPTOR_Y,
  REVERSE_RECEPTOR_Y,
} from './field.ts'

export type SongPosition = {
  beat: number
  seconds: number
}

const DEGREE = Math.PI / 180

/** Acceleration mods move an arrow at most this far, however hard they are pushed. */
const ACCEL_LIMIT = FIELD_HEIGHT * (5 / 6)

/**
 * How far an arrow still has to travel before it reaches its receptor, in cells. Positive means
 * not yet arrived. At 1x an arrow covers one cell per beat. Acceleration mods only act on the way
 * in, so everything past the receptors keeps moving at the plain rate.
 */
export function scrollOffset(
  mods: ModState,
  song: SongPosition,
  noteBeat: number,
  noteSeconds: number,
): number {
  const cmod = mods.get('cmod')
  const offset =
    cmod > 0
      ? ((noteSeconds - song.seconds) * cmod) / 60
      : (noteBeat - song.beat) * mods.get('xmod')
  if (offset < 0) return offset

  let adjust = 0

  const boost = mods.get('boost')
  if (boost !== 0) {
    const moved = (offset * 1.5) / ((offset + FIELD_HEIGHT / 1.2) / FIELD_HEIGHT)
    adjust += clamp(boost * (moved - offset), -ACCEL_LIMIT, ACCEL_LIMIT)
  }

  const brake = mods.get('brake')
  if (brake !== 0) {
    const moved = offset * Math.min(offset / FIELD_HEIGHT, 1)
    adjust += clamp(brake * (moved - offset), -ACCEL_LIMIT, ACCEL_LIMIT)
  }

  const wave = mods.get('wave')
  if (wave !== 0) adjust += wave * 0.3125 * Math.sin(offset / 0.6)

  return offset + adjust
}

/**
 * The share of the way each column is toward the bottom. The pattern mods fold back past 100% so
 * stacking them bounces between up and down rather than overshooting.
 */
export function reversal(mods: ModState, column: number): number {
  let r = mods.column('reverse', column)
  if (column >= COLUMNS / 2) r += mods.get('split')
  if (column % 2 === 1) r += mods.get('alternate')
  if (column > 0 && column < COLUMNS - 1) r += mods.get('cross')
  r = ((r % 2) + 2) % 2
  return r > 1 ? 2 - r : r
}

export function receptorY(mods: ModState, column: number): number {
  const y = RECEPTOR_Y + (REVERSE_RECEPTOR_Y - RECEPTOR_Y) * reversal(mods, column)
  return y * (1 - mods.get('centered'))
}

/**
 * Where an arrow sits, `offset` cells before its receptor and `ahead` beats before it is due.
 * Holds call this between head and tail, which is how a hold body bends through exactly the path
 * its arrows take. Visibility is separate, because receptors are placed but never faded.
 */
export function place(
  mods: ModState,
  song: SongPosition,
  column: number,
  offset: number,
  ahead: number,
  out: Placement,
): Placement {
  const base = COLUMN_X[column] ?? 0
  let x = base
  let y = receptorY(mods, column) + offset * (1 - 2 * reversal(mods, column))
  let z = 0
  const time = song.seconds

  const drunk = mods.column('drunk', column)
  if (drunk !== 0) {
    x += drunk * 0.5 * Math.cos(time + column * 0.2 + (offset * 10) / FIELD_HEIGHT)
  }

  const tornado = mods.column('tornado', column)
  if (tornado !== 0) {
    const low = Math.max(column - 3, 0)
    const high = Math.min(column + 3, COLUMNS - 1)
    const minX = COLUMN_X[low] as number
    const maxX = COLUMN_X[high] as number
    const between = ((base - minX) / (maxX - minX)) * 2 - 1
    const angle = Math.acos(clamp(between, -1, 1)) + (offset * 6) / FIELD_HEIGHT
    x += (minX + ((Math.cos(angle) + 1) / 2) * (maxX - minX) - base) * tornado
  }

  const flip = mods.get('flip')
  if (flip !== 0) x += ((COLUMN_X[COLUMNS - 1 - column] as number) - base) * flip

  const invert = mods.get('invert')
  if (invert !== 0) x += ((COLUMN_X[column ^ 1] as number) - base) * invert

  const beat = mods.get('beat')
  if (beat !== 0) x += beat * beatPulse(song.beat) * Math.cos(offset * 4.27)

  x += mods.column('movex', column)
  y += mods.column('movey', column)

  const tipsy = mods.column('tipsy', column)
  if (tipsy !== 0) y += tipsy * 0.4 * Math.cos(time * 1.2 + column * 1.8)

  const bumpy = mods.column('bumpy', column)
  if (bumpy !== 0) z += bumpy * 0.625 * Math.sin(offset * 4)
  z += mods.column('movez', column)

  const zoom = Math.max(1 - mods.column('mini', column) * 0.5, 0.01)

  out.x = x * zoom
  out.y = y * zoom
  out.depth = z * zoom
  out.scaleX = zoom
  out.scaleY = zoom
  out.rotX = mods.column('roll', column) * offset * 32 * DEGREE
  out.rotY = mods.column('twirl', column) * offset * 32 * DEGREE
  out.rotZ =
    ahead * mods.column('dizzy', column) +
    song.beat * mods.column('confusion', column) +
    mods.column('confusionoffset', column) * DEGREE
  out.alpha = 1
  out.glow = 0
  return out
}

/**
 * How visible an arrow is. Past the receptors everything shows, so a miss is always seen.
 * The cut is hard at half, and the glow peaks exactly there: an arrow flashes white as it
 * vanishes instead of dissolving, which is what makes the fade mods readable at speed.
 */
export function visibility(mods: ModState, column: number, offset: number, out: Placement): void {
  let visible = 1
  let stealth = 0
  if (offset >= 0) {
    const sudden = mods.column('sudden', column)
    if (sudden !== 0) {
      const line = FADE_LINE * (1 + mods.get('suddenoffset'))
      visible += sudden * clamp(-(offset - line) / FADE_WIDTH, -1, 0)
    }
    const hidden = mods.column('hidden', column)
    if (hidden !== 0) {
      const line = FADE_LINE * (1 + mods.get('hiddenoffset'))
      visible += hidden * clamp((offset - line) / FADE_WIDTH, -1, 0)
    }
    stealth = clamp(mods.column('stealth', column), 0, 1)
  }

  visible = clamp(visible, 0, 1)
  // Stealth is a plain transparency rather than a fade, so it dims what the fades leave
  // instead of being cut by them. A chart that sits on stealth 50% for a phrase wants
  // half-lit arrows; through the cut it would get none at all.
  out.alpha = (visible > 0.5 ? 1 : 0) * (1 - stealth)
  out.glow = clamp(1 - Math.abs(visible - 0.5) * 2, 0, 1) * (visible < 1 ? 1 : 0)
}

export function receptorAlpha(mods: ModState, column: number): number {
  return clamp(1 - mods.column('dark', column), 0, 1)
}

/**
 * The beat mod's kick: a sharp throw on each beat that settles by the half, alternating sides.
 * Quick attack, eased release, so it reads as a hit rather than a wobble.
 */
function beatPulse(songBeat: number): number {
  const attack = 0.2
  const length = 0.5
  const phase = songBeat + attack
  if (phase < 0) return 0
  const within = phase - Math.floor(phase)
  if (within >= length) return 0
  const amount =
    within < attack ? (within / attack) ** 2 : 1 - ((within - attack) / (length - attack)) ** 2
  return 0.3125 * amount * (Math.floor(phase) % 2 === 0 ? 1 : -1)
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}

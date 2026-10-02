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
import { perspectiveTilt } from './warp.ts'

export type SongPosition = {
  beat: number
  seconds: number
  /** Beats per second here, which the beat mod slows itself against on a fast song. */
  bps: number
  /** The fastest the song ever gets, which is what `mmod` scales the scroll against. */
  peakBpm: number
}

const DEGREE = Math.PI / 180

/** Acceleration mods move an arrow at most this far, however hard they are pushed. */
const ACCEL_LIMIT = FIELD_HEIGHT * (5 / 6)

/** Cells the acceleration mods gain to work over for each unit of tilt, as the field leans away. */
const TILT_REACH = 3.125

/**
 * How hard an arrow flashes as a fade takes it. Over one on purpose: the draw layer clamps it, so
 * the excess widens the band that flashes rather than brightening the flash, which is what makes a
 * fade read as a cut at speed instead of a dissolve.
 */
const GLOW_PEAK = 1.3

/** Radians a second the blink strobe runs at, and the steps ITG quantises it into. */
const BLINK_RATE = 10
const BLINK_STEP = 1 / 3

/** How far either side of the fade line randomvanish reaches, in cells. */
const VANISH_REACH = 1.25

/**
 * What each periodic mod does at 100% with its knobs left alone: how far it throws an arrow, in
 * cells, and how fast its wave runs. Every knob scales one of these rather than replacing it, so a
 * chart that never names a knob gets the shape the mod has always had.
 *
 * Where a value is ITG's own it is written as the division that produced it. ITG measures in pixels
 * at 64 to the cell, so its `sin(y / 38)` for wave is 64/38 waves per cell here, and a decimal
 * rounded off that division would be a number nobody could check against the source.
 */
const DRUNK_SWAY = 0.5
const DRUNK_SPREAD = 0.2
const DRUNK_WAVES = 10
const TIPSY_LIFT = 0.4
const TIPSY_RATE = 1.2
const TIPSY_SPREAD = 1.8
const TORNADO_WAVES = 6
const BUMPY_DEPTH = 0.625
const BUMPY_WAVES = 4
const BEAT_THROW = 0.3125
const BEAT_ATTACK = 0.2
const BEAT_LENGTH = 0.5
/** Past this the beat mod halves its own rate again, so a fast song shakes rather than strobes. */
const BEAT_SLOW_ABOVE_BPM = 150
const BEAT_WAVES = 64 / 15
const WAVE_THROW = 0.3125
const WAVE_WAVES = 64 / 38
const EXPAND_CENTRE = 1.25
const EXPAND_SWING = 0.5
const EXPAND_RATE = 3

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
  // `mmod` names the speed the song's fastest stretch should read at, so it resolves to whatever
  // multiplier gets there: m600 on a song that peaks at 150 is 4x.
  const mmod = mods.get('mmod')
  let speed = mmod > 0 ? mmod / song.peakBpm : mods.get('xmod')

  const expand = mods.get('expand')
  if (expand !== 0) {
    const swing =
      EXPAND_CENTRE +
      EXPAND_SWING *
        mods.get('expandsize') *
        Math.cos(song.seconds * EXPAND_RATE * mods.get('expandperiod'))
    speed *= 1 + expand * (swing - 1)
  }
  // The acceleration mods shape the plain scroll and the speed multiplies what they produce, which
  // is the order ITG works in. At 2x a boost therefore covers twice the ground rather than bending
  // twice as hard, and wave keeps its wavelength in beats instead of in cells.
  const plain = cmod > 0 ? ((noteSeconds - song.seconds) * cmod) / 60 : noteBeat - song.beat
  if (plain < 0) return plain * speed

  // Tipping the field away spreads the same arrows over more of it, so the distance the
  // acceleration mods work over grows to match.
  const reach = FIELD_HEIGHT + Math.abs(perspectiveTilt(mods)) * TILT_REACH
  let adjust = 0

  const boost = mods.get('boost')
  if (boost !== 0) {
    const moved = (plain * 1.5) / ((plain + reach / 1.2) / reach)
    adjust += clamp(boost * (moved - plain), -ACCEL_LIMIT, ACCEL_LIMIT)
  }

  const brake = mods.get('brake')
  if (brake !== 0) {
    const moved = (plain * plain) / reach
    adjust += clamp(brake * (moved - plain), -ACCEL_LIMIT, ACCEL_LIMIT)
  }

  const wave = mods.get('wave')
  if (wave !== 0) {
    adjust +=
      wave *
      WAVE_THROW *
      mods.get('wavesize') *
      Math.sin(plain * WAVE_WAVES * mods.get('waveperiod') + mods.get('waveoffset'))
  }

  let shaped = plain + adjust

  // Boomerang bends the whole shaped scroll into a parabola, so an arrow overshoots its receptor
  // and falls back onto it. ITG reads only whether this is on and ignores how much, which leaves no
  // way to ease it in; blending by the level does, and lands on ITG's own curve at 100%.
  const boomerang = mods.get('boomerang')
  if (boomerang !== 0) {
    const thrown = (-shaped * shaped) / FIELD_HEIGHT + 1.5 * shaped
    shaped += boomerang * (thrown - shaped)
  }

  return shaped * speed
}

/**
 * The share of the way each column is toward the bottom. The pattern mods fold back past 100% so
 * stacking them bounces between up and down rather than overshooting, which makes 130% reverse read
 * as 70%. `reversetype` turns the fold off for a chart that wants to scroll straight past it.
 */
export function reversal(mods: ModState, column: number): number {
  let r = mods.column('reverse', column)
  if (column >= COLUMNS / 2) r += mods.get('split')
  if (column % 2 === 1) r += mods.get('alternate')
  if (column > 0 && column < COLUMNS - 1) r += mods.get('cross')
  if (mods.get('reversetype') > 0.5) return r
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
    x +=
      drunk *
      DRUNK_SWAY *
      mods.get('drunksize') *
      Math.cos(
        time * mods.get('drunkspeed') +
          column * DRUNK_SPREAD * mods.get('drunkspacing') +
          (offset * DRUNK_WAVES * mods.get('drunkperiod')) / FIELD_HEIGHT +
          mods.get('drunkoffset'),
      )
  }

  const tornado = mods.column('tornado', column)
  if (tornado !== 0) {
    const low = Math.max(column - 3, 0)
    const high = Math.min(column + 3, COLUMNS - 1)
    const minX = COLUMN_X[low] as number
    const maxX = COLUMN_X[high] as number
    const between = ((base - minX) / (maxX - minX)) * 2 - 1
    const angle =
      Math.acos(clamp(between, -1, 1)) +
      (offset * TORNADO_WAVES * mods.get('tornadoperiod')) / FIELD_HEIGHT +
      mods.get('tornadooffset')
    x += (minX + ((Math.cos(angle) + 1) / 2) * (maxX - minX) - base) * tornado
  }

  const flip = mods.get('flip')
  if (flip !== 0) x += ((COLUMN_X[COLUMNS - 1 - column] as number) - base) * flip

  const invert = mods.get('invert')
  if (invert !== 0) x += ((COLUMN_X[column ^ 1] as number) - base) * invert

  const beat = mods.get('beat')
  if (beat !== 0) {
    const divide = Math.max(1, Math.trunc((song.bps * 60) / BEAT_SLOW_ABOVE_BPM))
    const pulse = beatPulse(song.beat * mods.get('beatmult') + mods.get('beatoffset'), divide)
    x +=
      beat *
      BEAT_THROW *
      mods.get('beatsize') *
      pulse *
      Math.cos(offset * BEAT_WAVES * mods.get('beatperiod'))
  }

  x += mods.column('movex', column)
  y += mods.column('movey', column)

  const tipsy = mods.column('tipsy', column)
  if (tipsy !== 0) {
    y +=
      tipsy *
      TIPSY_LIFT *
      Math.cos(
        time * TIPSY_RATE * mods.get('tipsyspeed') +
          column * TIPSY_SPREAD * mods.get('tipsyspacing') +
          mods.get('tipsyoffset'),
      )
  }

  const bumpy = mods.column('bumpy', column)
  if (bumpy !== 0) {
    z +=
      bumpy *
      BUMPY_DEPTH *
      mods.get('bumpysize') *
      Math.sin(offset * BUMPY_WAVES * mods.get('bumpyperiod') + mods.get('bumpyoffset'))
  }
  z += mods.column('movez', column)

  // `mini` shrinks the field and `tiny` shrinks only the arrow, so a position takes the first and
  // the drawn size takes both. That is the whole difference between them.
  const zoom = fieldZoom(mods, column)
  const size = zoom * Math.max(1 - mods.column('tiny', column) * 0.5, 0.01)

  out.x = x * zoom
  out.y = y * zoom
  out.depth = z * zoom
  out.scaleX = size
  out.scaleY = size
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
export function visibility(
  mods: ModState,
  song: SongPosition,
  column: number,
  offset: number,
  out: Placement,
): void {
  let visible = 1
  let stealth = 0

  const past = offset < 0
  if (!past || mods.get('stealthpastreceptors') > 0.5) {
    stealth = clamp(mods.column('stealth', column), 0, 1)
  }

  if (!past) {
    const sudden = mods.column('sudden', column)
    const hidden = mods.column('hidden', column)
    const vanish = mods.column('randomvanish', column)
    if (sudden !== 0 || hidden !== 0 || vanish !== 0) {
      // Mini shrinks the field underneath the fades, so the line they cut on rides down with it.
      const centre = FADE_LINE / Math.abs(fieldZoom(mods, column))
      // Asking for both pushes them apart, so the lit strip they leave between them stays open.
      const apart = FADE_WIDTH * 0.25 * hidden * sudden
      if (sudden !== 0) {
        const line = centre * (1 + mods.get('suddenoffset')) + apart
        visible += sudden * clamp(-(offset - line) / FADE_WIDTH, -1, 0)
      }
      if (hidden !== 0) {
        const line = centre * (1 + mods.get('hiddenoffset')) - apart
        visible += hidden * clamp((offset - line) / FADE_WIDTH, -1, 0)
      }
      // Clears whatever is far from the fade line in either direction and takes what is near it,
      // so arrows surface on the way in and again on the way out rather than fading once.
      if (vanish !== 0) {
        visible += vanish * ((Math.abs(offset - centre) - VANISH_REACH) / VANISH_REACH - 1)
      }
    }

    const blink = mods.column('blink', column)
    if (blink !== 0) {
      visible += blink * (quantize(Math.sin(song.seconds * BLINK_RATE), BLINK_STEP) - 1)
    }
  }

  visible = clamp(visible, 0, 1)
  // Stealth is a plain transparency rather than a fade, so it dims what the fades leave
  // instead of being cut by them. A chart that sits on stealth 50% for a phrase wants
  // half-lit arrows; through the cut it would get none at all.
  out.alpha = (visible > 0.5 ? 1 : 0) * (1 - stealth)
  out.glow = GLOW_PEAK * clamp(1 - Math.abs(visible - 0.5) * 2, 0, 1)
}

/**
 * How far the field shrinks for a column. Positions scale with this as well as the arrows do.
 * Past 200% it goes negative and the field turns through itself, which is ITG's behaviour and a
 * thing charts use; only the zero itself is guarded, because that is where the field vanishes.
 */
function fieldZoom(mods: ModState, column: number): number {
  const zoom = 1 - mods.column('mini', column) * 0.5
  return Math.abs(zoom) < 0.01 ? 0.01 : zoom
}

export function receptorAlpha(mods: ModState, column: number): number {
  return clamp(1 - mods.column('dark', column), 0, 1)
}

/**
 * The beat mod's kick, as a share of its full throw: a sharp rise on each beat that settles by the
 * half, alternating sides. Quick attack, eased release, so it reads as a hit rather than a wobble.
 *
 * `divide` stretches the whole gesture over that many beats. ITG raises it on a fast song so the
 * kick stays legible instead of blurring into a vibration; `beatmult` is the knob for asking
 * directly, and this is the floor under it.
 */
function beatPulse(songBeat: number, divide: number): number {
  const attack = BEAT_ATTACK / divide
  const length = BEAT_LENGTH / divide
  const phase = (songBeat + attack) / divide
  if (phase < 0) return 0
  const within = phase - Math.floor(phase)
  if (within >= length) return 0
  const amount =
    within < attack ? (within / attack) ** 2 : 1 - ((within - attack) / (length - attack)) ** 2
  return amount * (Math.floor(phase) % 2 === 0 ? 1 : -1)
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}

/** ITG's own rounding: toward zero rather than down, which is what makes the strobe uneven. */
function quantize(value: number, step: number): number {
  return Math.trunc((value + step / 2) / step) * step
}

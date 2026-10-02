import { describe, expect, it } from 'vitest'
import { placement } from '../draw/quad.ts'
import { ModState } from '../mods/track.ts'
import { place, receptorAlpha, reversal, scrollOffset, visibility } from './effects.ts'
import {
  COLUMN_X,
  FADE_LINE,
  FADE_WIDTH,
  FIELD_HEIGHT,
  RECEPTOR_Y,
  REVERSE_RECEPTOR_Y,
} from './field.ts'
import { fieldWarp } from './warp.ts'

/** The showpiece's own tempo, steady throughout. */
const TEMPO = { bps: 130 / 60, peakBpm: 130 }
const song = { beat: 12.25, seconds: 5.6, ...TEMPO }

const modsWith = (set: Record<string, number>) => {
  const mods = new ModState([])
  for (const [name, value] of Object.entries(set)) mods.override(name, value)
  mods.update(song.beat)
  return mods
}

const placed = (mods: ModState, column: number, offset: number, ahead = offset) =>
  place(mods, song, column, offset, ahead, placement())

const EVERY_MOD = [
  'reverse',
  'split',
  'alternate',
  'cross',
  'centered',
  'mini',
  'flip',
  'invert',
  'drunk',
  'tipsy',
  'tornado',
  'bumpy',
  'beat',
  'wave',
  'boost',
  'brake',
  'dizzy',
  'roll',
  'twirl',
  'confusion',
  'confusionoffset',
  'stealth',
  'dark',
  'sudden',
  'hidden',
  'movex',
  'movey',
  'movez',
  'overhead',
  'incoming',
  'space',
  'hallway',
  'distant',
  'tilt',
  'skew',
  'rotationx',
  'rotationy',
  'rotationz',
]

describe('effects at rest', () => {
  it('scrolls one cell per beat at 1x', () => {
    expect(scrollOffset(modsWith({}), song, 15.25, 0)).toBeCloseTo(3)
  })

  it('places an arrow on its column, offset cells below its receptor', () => {
    const p = placed(modsWith({}), 2, 3)
    expect(p.x).toBe(COLUMN_X[2])
    expect(p.y).toBeCloseTo(RECEPTOR_Y + 3)
    expect([p.scaleX, p.rotX, p.rotY, p.rotZ, p.depth]).toEqual([1, 0, 0, 0, 0])
  })

  it('is unchanged by every mod set to zero', () => {
    const rest = modsWith({})
    const zeroed = modsWith(Object.fromEntries(EVERY_MOD.map((name) => [name, 0])))
    for (let column = 0; column < 4; column++) {
      for (const offset of [-1, 0, 0.5, 4, 9]) {
        expect(placed(zeroed, column, offset)).toEqual(placed(rest, column, offset))
        expect(scrollOffset(zeroed, song, song.beat + offset, 0)).toBeCloseTo(
          scrollOffset(rest, song, song.beat + offset, 0),
        )
        const a = placement()
        const b = placement()
        visibility(zeroed, column, offset, a)
        visibility(rest, column, offset, b)
        expect(a).toEqual(b)
      }
    }
  })

  it('leaves arrows fully visible and receptors lit', () => {
    const p = placement()
    visibility(modsWith({}), 1, 3, p)
    expect([p.alpha, p.glow]).toEqual([1, 0])
    expect(receptorAlpha(modsWith({}), 1)).toBe(1)
  })

  it('warps nothing', () => {
    const out = new Float32Array(2)
    fieldWarp(modsWith({}))(1.25, -2, 0, out, 0)
    expect([...out]).toEqual([1.25, -2])
  })
})

describe('effects', () => {
  it('reverse moves the receptor down and turns the scroll around', () => {
    const p = placed(modsWith({ reverse: 1 }), 0, 2)
    expect(p.y).toBeCloseTo(REVERSE_RECEPTOR_Y - 2)
  })

  it('flip mirrors the columns and invert swaps within each half', () => {
    expect(placed(modsWith({ flip: 1 }), 0, 1).x).toBeCloseTo(COLUMN_X[3])
    expect(placed(modsWith({ invert: 1 }), 2, 1).x).toBeCloseTo(COLUMN_X[3])
  })

  it('folds reverse past 100% unless reversetype says not to', () => {
    expect(reversal(modsWith({ reverse: 1.3 }), 0)).toBeCloseTo(0.7)
    expect(reversal(modsWith({ reverse: 1.3, reversetype: 1 }), 0)).toBeCloseTo(1.3)
  })

  it('reverses only the columns a pattern mod names', () => {
    const mods = modsWith({ split: 1 })
    expect(placed(mods, 1, 0).y).toBeCloseTo(RECEPTOR_Y)
    expect(placed(mods, 2, 0).y).toBeCloseTo(REVERSE_RECEPTOR_Y)
  })

  it('stealth hides arrows on the way in but never after the receptors', () => {
    const mods = modsWith({ stealth: 1 })
    const before = placement()
    const after = placement()
    visibility(mods, 0, 2, before)
    visibility(mods, 0, -0.5, after)
    expect(before.alpha).toBe(0)
    expect(after.alpha).toBe(1)
  })

  it('part of a stealth leaves part of an arrow, where a fade would have cut it', () => {
    const half = placement()
    visibility(modsWith({ stealth: 0.5 }), 0, 2, half)
    expect(half.alpha).toBeCloseTo(0.5)
  })

  it('drunk sways by at most half a cell', () => {
    const mods = modsWith({ drunk: 1 })
    for (let offset = 0; offset < FIELD_HEIGHT; offset += 0.1) {
      expect(Math.abs(placed(mods, 1, offset).x - (COLUMN_X[1] as number))).toBeLessThanOrEqual(0.5)
    }
  })

  it('distant shrinks the far end of the field and hallway grows it', () => {
    const measure = (set: Record<string, number>) => {
      const warp = fieldWarp(modsWith(set))
      const out = new Float32Array(4)
      warp(-0.5, 3, 0, out, 0)
      warp(0.5, 3, 0, out, 2)
      return (out[2] as number) - (out[0] as number)
    }
    expect(measure({ distant: 1 })).toBeLessThan(1)
    expect(measure({ hallway: 1 })).toBeGreaterThan(1)
  })

  // These two carry a sideways shift as well, so they are checked by which way they lean rather
  // than by the exact width: `space` recedes like `distant`, `incoming` comes at you like `hallway`.
  it('leans space away and incoming toward, as their names say', () => {
    const lean = (set: Record<string, number>) => {
      const warp = fieldWarp(modsWith(set))
      const out = new Float32Array(4)
      warp(-0.5, 3, 0, out, 0)
      warp(0.5, 3, 0, out, 2)
      return (out[2] as number) - (out[0] as number)
    }
    expect(lean({ space: 1 })).toBeLessThan(1)
    expect(lean({ incoming: 1 })).toBeGreaterThan(1)
    expect(lean({ space: 1 })).toBeCloseTo(lean({ distant: 1, skew: 1 }))
    expect(lean({ incoming: 1 })).toBeCloseTo(lean({ hallway: 1, skew: 1 }))
  })
})

describe('periodic mod knobs', () => {
  const at = (seconds: number, set: Record<string, number>, column = 0, offset = 0) => {
    const mods = new ModState([])
    for (const [name, value] of Object.entries(set)) mods.override(name, value)
    mods.update(0)
    return place(mods, { beat: 0, seconds, ...TEMPO }, column, offset, 0, placement())
  }
  const sway = (seconds: number, set: Record<string, number>, column = 0, offset = 0) =>
    at(seconds, { drunk: 1, ...set }, column, offset).x - (COLUMN_X[column] as number)

  it('leaves a mod exactly where it was with every knob at rest', () => {
    const rest = { drunk: 1, tipsy: 1, tornado: 1, bumpy: 1, beat: 1, wave: 1 }
    const pinned = {
      ...rest,
      drunksize: 1,
      drunkspeed: 1,
      drunkperiod: 1,
      drunkspacing: 1,
      drunkoffset: 0,
      tipsyspeed: 1,
      tipsyspacing: 1,
      tipsyoffset: 0,
      tornadoperiod: 1,
      tornadooffset: 0,
      bumpysize: 1,
      bumpyperiod: 1,
      bumpyoffset: 0,
      beatsize: 1,
      beatmult: 1,
      beatperiod: 1,
      beatoffset: 0,
      wavesize: 1,
      waveperiod: 1,
      waveoffset: 0,
    }
    for (let column = 0; column < 4; column++) {
      for (const offset of [0, 0.5, 3, 9]) {
        expect(at(1.4, pinned, column, offset)).toEqual(at(1.4, rest, column, offset))
      }
    }
  })

  it('scales the throw with size', () => {
    expect(sway(0, {})).toBeCloseTo(0.5)
    expect(sway(0, { drunksize: 2 })).toBeCloseTo(1)
    expect(sway(0, { drunksize: 0 })).toBeCloseTo(0)
  })

  it('runs the wave faster with speed, and further along with period', () => {
    expect(sway(1, { drunkspeed: 2 })).toBeCloseTo(sway(2, {}))
    expect(sway(0, { drunkperiod: 2 }, 0, 1)).toBeCloseTo(sway(0, {}, 0, 2))
  })

  it('shifts the phase with offset and the column spread with spacing', () => {
    expect(sway(0, { drunkoffset: Math.PI })).toBeCloseTo(-sway(0, {}))
    expect(sway(0, {}, 2)).toBeCloseTo(sway(0, { drunkspacing: 2 }, 1))
  })

  it('beats twice as often at double mult', () => {
    const kick = (beat: number, set: Record<string, number>) => {
      const mods = new ModState([])
      for (const [name, value] of Object.entries({ beat: 1, ...set })) mods.override(name, value)
      mods.update(beat)
      return (
        place(mods, { beat, seconds: 0, ...TEMPO }, 0, 0, 0, placement()).x -
        (COLUMN_X[0] as number)
      )
    }
    expect(kick(0.1, { beatmult: 2 })).toBeCloseTo(kick(0.2, {}))
    expect(kick(0.1, { beatsize: 2 })).toBeCloseTo(kick(0.1, {}) * 2)
  })
})

describe('appearance mods', () => {
  const seen = (set: Record<string, number>, offset: number, column = 0) => {
    const out = placement()
    visibility(modsWith(set), column, offset, out)
    return out
  }

  it('rides the fade line down with mini', () => {
    expect(seen({ hidden: 1 }, FADE_LINE).alpha).toBe(1)
    // Half the field size puts the line at twice the distance, so the same arrow is now inside it.
    expect(seen({ hidden: 1, mini: 1 }, FADE_LINE).alpha).toBe(0)
  })

  // Both fades share a line, so asking for both would close the lit strip entirely. ITG pushes
  // them a quarter of a fade apart instead, and this offset falls in the gap that opens up.
  it('holds the strip open when a chart asks for hidden and sudden together', () => {
    const between = FADE_LINE - 0.625 * FADE_WIDTH
    expect(seen({ hidden: 1 }, between).alpha).toBe(0)
    expect(seen({ hidden: 1, sudden: 1 }, between).alpha).toBe(1)
  })

  it('keeps stealth past the receptors only when asked', () => {
    expect(seen({ stealth: 1 }, -0.5).alpha).toBe(1)
    expect(seen({ stealth: 1, stealthpastreceptors: 1 }, -0.5).alpha).toBe(0)
  })

  // Over one on purpose: the draw layer clamps it, so the excess widens the flashing band rather
  // than brightening it, which is how a fade reads as a cut rather than a dissolve.
  it('flashes past full as an arrow crosses a fade', () => {
    expect(seen({ hidden: 1 }, FADE_LINE - FADE_WIDTH / 2).glow).toBeCloseTo(1.3)
    expect(seen({}, 3).glow).toBe(0)
  })
})

describe('mini and tiny', () => {
  it('shrinks the field with mini and only the arrow with tiny', () => {
    const small = placed(modsWith({ mini: 1 }), 3, 4)
    expect(small.scaleX).toBeCloseTo(0.5)
    expect(small.x).toBeCloseTo((COLUMN_X[3] as number) * 0.5)

    const thin = placed(modsWith({ tiny: 1 }), 3, 4)
    expect(thin.scaleX).toBeCloseTo(0.5)
    expect(thin.x).toBeCloseTo(COLUMN_X[3] as number)
    expect(thin.y).toBeCloseTo(placed(modsWith({}), 3, 4).y)
  })

  it('turns the field through itself past 200% mini', () => {
    expect(placed(modsWith({ mini: 3 }), 3, 4).scaleX).toBeCloseTo(-0.5)
    expect(placed(modsWith({ mini: 2 }), 3, 4).scaleX).toBe(0.01)
  })
})

describe('tempo-aware mods', () => {
  it('resolves mmod to whatever multiplier reaches that speed', () => {
    expect(scrollOffset(modsWith({ mmod: 260 }), song, song.beat + 3, 0)).toBeCloseTo(6)
    expect(scrollOffset(modsWith({ mmod: 65 }), song, song.beat + 3, 0)).toBeCloseTo(1.5)
  })

  it('lets mmod win over xmod, since it is choosing the same thing', () => {
    expect(scrollOffset(modsWith({ mmod: 260, xmod: 9 }), song, song.beat + 3, 0)).toBeCloseTo(6)
  })

  // At 320 the divisor is two, which stretches the kick over two beats. Beat 1.1 lands inside the
  // pulse at 130 and in the gap after it at 320.
  it('stretches the beat kick on a fast song so it shakes rather than strobes', () => {
    const kick = (bps: number) => {
      const mods = modsWith({ beat: 1 })
      return (
        place(mods, { beat: 1.1, seconds: 0, bps, peakBpm: bps * 60 }, 0, 0, 0, placement()).x -
        (COLUMN_X[0] as number)
      )
    }
    expect(kick(130 / 60)).not.toBeCloseTo(0)
    expect(kick(320 / 60)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { placement } from '../draw/quad.ts'
import { ModState } from '../mods/track.ts'
import { place, receptorAlpha, scrollOffset, visibility } from './effects.ts'
import { COLUMN_X, FIELD_HEIGHT, RECEPTOR_Y, REVERSE_RECEPTOR_Y } from './field.ts'
import { fieldWarp } from './warp.ts'

const song = { beat: 12.25, seconds: 5.6 }

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
})

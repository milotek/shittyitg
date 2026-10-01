import { describe, expect, it } from 'vitest'
import { buildTracks, ModState, read } from './track.ts'

const track = (rows: Parameters<typeof buildTracks>[0], name: string) => {
  const found = buildTracks(rows).get(name)
  if (!found) throw new Error(`no track for ${name}`)
  return found
}

describe('mod tracks', () => {
  it('rests before any row and holds after the last', () => {
    const drunk = track([{ beat: 4, len: 2, ease: 'linear', set: { drunk: 100 } }], 'drunk')
    expect(read(drunk, 0)).toBe(0)
    expect(read(drunk, 5)).toBeCloseTo(0.5)
    expect(read(drunk, 100)).toBe(1)
  })

  it('keeps raw-unit mods in their own unit and rests xmod at 1', () => {
    const xmod = track([{ beat: 0, len: 0, ease: 'linear', set: { xmod: 2.5 } }], 'xmod')
    expect(xmod.rest).toBe(1)
    expect(read(xmod, 1)).toBe(2.5)
  })

  it('starts each row from wherever the mod already is', () => {
    const tipsy = track(
      [
        { beat: 0, len: 4, ease: 'linear', set: { tipsy: 100 } },
        { beat: 2, len: 2, ease: 'linear', set: { tipsy: 0 } },
      ],
      'tipsy',
    )
    expect(read(tipsy, 2)).toBeCloseTo(0.5)
    expect(read(tipsy, 3)).toBeCloseTo(0.25)
    expect(read(tipsy, 10)).toBe(0)
  })

  it('returns to the start after a transient ease', () => {
    const beat = track(
      [
        { beat: 0, len: 0, ease: 'instant', set: { mini: 50 } },
        { beat: 1, len: 1, ease: 'bell', set: { mini: 150 } },
      ],
      'mini',
    )
    expect(read(beat, 1.5)).toBeCloseTo(1.5)
    expect(read(beat, 3)).toBeCloseTo(0.5)
  })

  it('does not depend on the order it is read in', () => {
    const rows = [
      { beat: 0, len: 8, ease: 'inOutSine', set: { drunk: 200 } } as const,
      { beat: 3, len: 1, ease: 'outBack', set: { drunk: -50 } } as const,
    ]
    const forwards = new ModState([...rows])
    const jumping = new ModState([...rows])
    for (let beat = 0; beat < 10; beat += 1 / 60) forwards.update(beat)
    jumping.update(9.99)
    forwards.update(9.99)
    expect(jumping.get('drunk')).toBe(forwards.get('drunk'))
  })

  it('adds a per-column variant onto the mod', () => {
    const state = new ModState([
      { beat: 0, len: 0, ease: 'instant', set: { reverse: 50, reverse2: 50 } },
    ])
    state.update(1)
    expect(state.column('reverse', 2)).toBe(1)
    expect(state.column('reverse', 1)).toBe(0.5)
  })
})

describe('mod names', () => {
  const build = (set: Record<string, number>) =>
    buildTracks([{ beat: 0, len: 1, ease: 'linear', set }])

  it('rejects a mod nothing answers to', () => {
    expect(() => build({ drunkk: 100 })).toThrow('unknown mod "drunkk"')
    expect(() => build({ hiddenoffest: 50 })).toThrow('unknown mod "hiddenoffest"')
  })

  it('rejects a column variant of a mod that does not take one', () => {
    expect(() => build({ beat2: 100 })).toThrow('unknown mod "beat2"')
  })

  it('rejects a column the field does not have', () => {
    expect(() => build({ drunk4: 100 })).toThrow('unknown mod "drunk4"')
    expect(() => build({ drunk3: 100 })).not.toThrow()
  })

  it('keeps a column variant in its base mod unit', () => {
    const tracks = build({ confusionoffset2: 90, drunk2: 50 })
    expect(read(tracks.get('confusionoffset2') as never, 1)).toBe(90)
    expect(read(tracks.get('drunk2') as never, 1)).toBeCloseTo(0.5)
  })
})

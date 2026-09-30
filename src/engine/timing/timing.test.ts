import { describe, expect, it } from 'vitest'
import { Timing } from './timing.ts'

describe('Timing', () => {
  it('places beat 0 at minus the offset', () => {
    const timing = new Timing({ offset: 0.25, bpms: [{ beat: 0, bpm: 120 }], stops: [] })
    expect(timing.secondAt(0)).toBeCloseTo(-0.25)
    expect(timing.secondAt(4)).toBeCloseTo(1.75)
    expect(timing.beatAt(-0.25)).toBeCloseTo(0)
  })

  it('extrapolates before beat 0', () => {
    const timing = new Timing({ offset: 0, bpms: [{ beat: 0, bpm: 60 }], stops: [] })
    expect(timing.secondAt(-2)).toBeCloseTo(-2)
    expect(timing.beatAt(-3)).toBeCloseTo(-3)
  })

  it('changes rate at a BPM change', () => {
    const timing = new Timing({
      offset: 0,
      bpms: [
        { beat: 0, bpm: 60 },
        { beat: 4, bpm: 120 },
      ],
      stops: [],
    })
    expect(timing.secondAt(4)).toBeCloseTo(4)
    expect(timing.secondAt(6)).toBeCloseTo(5)
    expect(timing.beatAt(5)).toBeCloseTo(6)
  })

  it('holds the beat through a stop, and a note on the stop is hit before it', () => {
    const timing = new Timing({
      offset: 0,
      bpms: [{ beat: 0, bpm: 60 }],
      stops: [{ beat: 2, seconds: 1.5 }],
    })
    expect(timing.secondAt(2)).toBeCloseTo(2)
    expect(timing.secondAt(3)).toBeCloseTo(4.5)
    expect(timing.beatAt(2.7)).toBeCloseTo(2)
    expect(timing.beatAt(3.5)).toBeCloseTo(2)
    expect(timing.beatAt(4.5)).toBeCloseTo(3)
  })

  it('round-trips across changes and stops', () => {
    const timing = new Timing({
      offset: -0.1,
      bpms: [
        { beat: 0, bpm: 130 },
        { beat: 32, bpm: 65 },
        { beat: 48, bpm: 260 },
      ],
      stops: [
        { beat: 16, seconds: 0.5 },
        { beat: 40.5, seconds: 0.25 },
      ],
    })
    for (let beat = -4; beat < 80; beat += 0.37) {
      if (Math.abs(beat - 16) < 1e-9 || Math.abs(beat - 40.5) < 1e-9) continue
      expect(timing.beatAt(timing.secondAt(beat))).toBeCloseTo(beat, 9)
    }
  })
})

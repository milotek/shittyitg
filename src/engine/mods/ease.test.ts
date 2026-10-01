import { describe, expect, it } from 'vitest'
import { EASES, type EaseName } from './ease.ts'

/** Every ease name the Mirin Template defines, so a chart written against it keeps working. */
const MIRIN = [
  'instant',
  'linear',
  'inQuad',
  'outQuad',
  'inOutQuad',
  'outInQuad',
  'inCubic',
  'outCubic',
  'inOutCubic',
  'outInCubic',
  'inQuart',
  'outQuart',
  'inOutQuart',
  'outInQuart',
  'inQuint',
  'outQuint',
  'inOutQuint',
  'outInQuint',
  'inSine',
  'outSine',
  'inOutSine',
  'outInSine',
  'inExpo',
  'outExpo',
  'inOutExpo',
  'outInExpo',
  'inCirc',
  'outCirc',
  'inOutCirc',
  'outInCirc',
  'inBack',
  'outBack',
  'inOutBack',
  'outInBack',
  'inElastic',
  'outElastic',
  'inOutElastic',
  'outInElastic',
  'inBounce',
  'outBounce',
  'inOutBounce',
  'outInBounce',
  'bounce',
  'tri',
  'bell',
  'pop',
  'tap',
  'pulse',
  'spike',
  'inverse',
  'popElastic',
  'tapElastic',
  'pulseElastic',
  'impulse',
] as const

/** The group that leaves its start value and comes back, which is what makes a row a gesture. */
const TRANSIENT = [
  'bounce',
  'tri',
  'bell',
  'pop',
  'tap',
  'pulse',
  'spike',
  'popElastic',
  'tapElastic',
  'pulseElastic',
  'impulse',
  'wiggle',
] as const satisfies readonly EaseName[]

describe('eases', () => {
  it('defines every Mirin ease', () => {
    expect(MIRIN.filter((name) => !(name in EASES))).toEqual([])
  })

  it('runs the whole 0 to 1 group from 0 to 1', () => {
    for (const name of MIRIN) {
      if (name === 'instant' || name === 'inverse' || TRANSIENT.includes(name as never)) continue
      const ease = EASES[name]
      expect(ease(0), `${name} at 0`).toBeCloseTo(0, 2)
      expect(ease(1), `${name} at 1`).toBeCloseTo(1, 2)
    }
  })

  // Mirin's curves are not normalised to land exactly on their target, and a chart's residue
  // depends on that, so the overshoot and undershoot are pinned rather than rounded away.
  it("keeps Mirin's endpoints exactly, residue and all", () => {
    expect(EASES.inExpo(1)).toBe(0.999)
    expect(EASES.outExpo(0)).toBeCloseTo(0.001, 12)
    expect(EASES.outElastic(1)).toBe(1.00048828125)
    expect(EASES.inElastic(0)).toBe(-0.00048828125)
  })

  it('returns every transient to its start', () => {
    for (const name of TRANSIENT) {
      expect(EASES[name](0), `${name} at 0`).toBeCloseTo(0, 3)
      expect(EASES[name](1), `${name} at 1`).toBeCloseTo(0, 3)
    }
  })

  // pop and tap being each other reversed is the whole point of having both: one throws a mod out
  // at the top of a phrase and the other lands it on the next hit.
  it('mirrors pop and tap through each other', () => {
    for (let t = 0; t <= 1; t += 1 / 64) expect(EASES.tap(t)).toBeCloseTo(EASES.pop(1 - t), 12)
    expect(EASES.pop(0.2)).toBeCloseTo(1.0018, 4)
    expect(EASES.tap(0.8)).toBeCloseTo(1.0018, 4)
  })

  it('swings pulse through zero rather than stepping', () => {
    expect(EASES.pulse(0.4)).toBeCloseTo(1.0018, 4)
    expect(EASES.pulse(0.6)).toBeCloseTo(-1.0018, 4)
    for (let t = 0; t <= 1; t += 1 / 64) expect(EASES.pulse(t)).toBeCloseTo(-EASES.pulse(1 - t), 12)
  })

  it('peaks bell in the middle of the row', () => {
    expect(EASES.bell(0.5)).toBe(1)
    expect(EASES.bell(0.25)).toBeCloseTo(0.5, 12)
  })

  // Mirin's inverse really does divide by zero at its midpoint. A chart landing a row exactly
  // there gets Infinity and draws nothing, so the hole is recorded rather than patched over.
  it('leaves the hole in the middle of inverse', () => {
    expect(EASES.inverse(0.5)).toBe(Number.POSITIVE_INFINITY)
    expect(EASES.inverse(0.49)).toBeCloseTo(6.245, 3)
    expect(EASES.inverse(0.51)).toBeCloseTo(-6.245, 3)
  })
})

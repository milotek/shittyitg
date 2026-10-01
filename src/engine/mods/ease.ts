export type Ease = (t: number) => number

const { sin, cos, PI, sqrt, pow, abs, exp, asin } = Math

const BACK = 1.70158
const ELASTIC_AMPLITUDE = 1
const ELASTIC_PERIOD = 0.3
const ELASTIC_DAMPING = 1.4
const ELASTIC_SWINGS = 6

const inExpoAt: Ease = (t) => 1000 ** (t - 1) - 0.001
const outExpoAt: Ease = (t) => 1.001 - 1000 ** -t
const inCircAt: Ease = (t) => 1 - sqrt(1 - t * t)
const outCircAt: Ease = (t) => sqrt(-t * t + 2 * t)
const inSineAt: Ease = (t) => 1 - cos(t * (PI / 2))
const outSineAt: Ease = (t) => sin(t * (PI / 2))

const outBounceAt: Ease = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) return 7.5625 * (t - 1.5 / 2.75) ** 2 + 0.75
  if (t < 2.5 / 2.75) return 7.5625 * (t - 2.25 / 2.75) ** 2 + 0.9375
  return 7.5625 * (t - 2.625 / 2.75) ** 2 + 0.984375
}
const inBounceAt: Ease = (t) => 1 - outBounceAt(1 - t)

const inOutQuintAt: Ease = (t) => {
  const u = t * 2
  return u < 1 ? 0.5 * u ** 5 : 1 - 0.5 * (2 - u) ** 5
}
const triAt: Ease = (t) => 1 - abs(2 * t - 1)
const popAt: Ease = (t) => 3.5 * (1 - t) * (1 - t) * sqrt(t)
const tapAt: Ease = (t) => 3.5 * t * t * sqrt(1 - t)

const outElasticAt = (t: number, a: number, p: number) =>
  a * pow(2, -10 * t) * sin((t - (p / (2 * PI)) * asin(1 / a)) * ((2 * PI) / p)) + 1
const inElasticAt = (t: number, a: number, p: number) => 1 - outElasticAt(1 - t, a, p)
const inBackAt = (t: number, a: number) => t * t * (a * t + t - a)
const outBackAt = (t: number, a: number) => (t - 1) * (t - 1) * ((a + 1) * (t - 1) + a) + 1

const popElasticAt = (t: number, damp: number, swings: number) =>
  (pow(1000, -pow(t, damp)) - 0.001) * sin(swings * PI * t)
const tapElasticAt = (t: number, damp: number, swings: number) =>
  (pow(1000, -pow(1 - t, damp)) - 0.001) * sin(swings * PI * (1 - t))

/**
 * The Mirin Template's `ease.lua`, transcribed. The first group runs from 0 to 1. The second group
 * is transient: it leaves the start value and comes back to it, so a row using one of them is a
 * gesture rather than a change of state.
 *
 * Mirin's curves do not all quite reach their endpoints, and that is kept rather than rounded off:
 * `inExpo` lands on 0.999 and `outElastic` on 1.0005. `Track` already stores `ease(1)` rather than
 * assuming 1, so a row settles exactly where Mirin would leave it.
 */
export const EASES = {
  instant: () => 1,
  linear: (t) => t,

  inQuad: (t) => t * t,
  outQuad: (t) => -t * (t - 2),
  inOutQuad: (t) => (t * 2 < 1 ? 0.5 * (t * 2) ** 2 : 1 - 0.5 * (2 - t * 2) ** 2),
  outInQuad: (t) => (t * 2 < 1 ? 0.5 - 0.5 * (1 - t * 2) ** 2 : 0.5 + 0.5 * (t * 2 - 1) ** 2),

  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t * 2 < 1 ? 0.5 * (t * 2) ** 3 : 1 - 0.5 * (2 - t * 2) ** 3),
  outInCubic: (t) => (t * 2 < 1 ? 0.5 - 0.5 * (1 - t * 2) ** 3 : 0.5 + 0.5 * (t * 2 - 1) ** 3),

  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutQuart: (t) => (t * 2 < 1 ? 0.5 * (t * 2) ** 4 : 1 - 0.5 * (2 - t * 2) ** 4),
  outInQuart: (t) => (t * 2 < 1 ? 0.5 - 0.5 * (1 - t * 2) ** 4 : 0.5 + 0.5 * (t * 2 - 1) ** 4),

  inQuint: (t) => t ** 5,
  outQuint: (t) => 1 - (1 - t) ** 5,
  inOutQuint: inOutQuintAt,
  outInQuint: (t) => (t * 2 < 1 ? 0.5 - 0.5 * (1 - t * 2) ** 5 : 0.5 + 0.5 * (t * 2 - 1) ** 5),

  inSine: inSineAt,
  outSine: outSineAt,
  inOutSine: (t) => 0.5 - 0.5 * cos(t * PI),
  outInSine: (t) => (t < 0.5 ? outSineAt(t * 2) * 0.5 : inSineAt(t * 2 - 1) * 0.5 + 0.5),

  inExpo: inExpoAt,
  outExpo: outExpoAt,
  inOutExpo: (t) =>
    t * 2 < 1 ? 0.5 * 1000 ** (t * 2 - 1) - 0.0005 : 1.0005 - 0.5 * 1000 ** (1 - t * 2),
  outInExpo: (t) => (t < 0.5 ? outExpoAt(t * 2) * 0.5 : inExpoAt(t * 2 - 1) * 0.5 + 0.5),

  inCirc: inCircAt,
  outCirc: outCircAt,
  inOutCirc: (t) =>
    t * 2 < 1 ? 0.5 - 0.5 * sqrt(1 - (t * 2) ** 2) : 0.5 + 0.5 * sqrt(1 - (t * 2 - 2) ** 2),
  outInCirc: (t) => (t < 0.5 ? outCircAt(t * 2) * 0.5 : inCircAt(t * 2 - 1) * 0.5 + 0.5),

  inBack: (t) => inBackAt(t, BACK),
  outBack: (t) => outBackAt(t, BACK),
  inOutBack: (t) =>
    t < 0.5 ? 0.5 * inBackAt(t * 2, BACK) : 0.5 + 0.5 * outBackAt(t * 2 - 1, BACK),
  outInBack: (t) =>
    t < 0.5 ? 0.5 * outBackAt(t * 2, BACK) : 0.5 + 0.5 * inBackAt(t * 2 - 1, BACK),

  inElastic: (t) => inElasticAt(t, ELASTIC_AMPLITUDE, ELASTIC_PERIOD),
  outElastic: (t) => outElasticAt(t, ELASTIC_AMPLITUDE, ELASTIC_PERIOD),
  inOutElastic: (t) =>
    t < 0.5
      ? 0.5 * inElasticAt(t * 2, ELASTIC_AMPLITUDE, ELASTIC_PERIOD)
      : 0.5 + 0.5 * outElasticAt(t * 2 - 1, ELASTIC_AMPLITUDE, ELASTIC_PERIOD),
  outInElastic: (t) =>
    t < 0.5
      ? 0.5 * outElasticAt(t * 2, ELASTIC_AMPLITUDE, ELASTIC_PERIOD)
      : 0.5 + 0.5 * inElasticAt(t * 2 - 1, ELASTIC_AMPLITUDE, ELASTIC_PERIOD),

  inBounce: inBounceAt,
  outBounce: outBounceAt,
  inOutBounce: (t) => (t < 0.5 ? inBounceAt(t * 2) * 0.5 : outBounceAt(t * 2 - 1) * 0.5 + 0.5),
  outInBounce: (t) => (t < 0.5 ? outBounceAt(t * 2) * 0.5 : inBounceAt(t * 2 - 1) * 0.5 + 0.5),

  bounce: (t) => 4 * t * (1 - t),
  tri: triAt,
  bell: (t) => inOutQuintAt(triAt(t)),
  pop: popAt,
  tap: tapAt,
  pulse: (t) => (t < 0.5 ? tapAt(t * 2) : -popAt(t * 2 - 1)),
  spike: (t) => exp(-10 * abs(2 * t - 1)),
  // Mirin's own definition, and it genuinely divides by zero at the midpoint.
  inverse: (t) => (t * t * (1 - t) * (1 - t)) / (0.5 - t),
  popElastic: (t) => popElasticAt(t, ELASTIC_DAMPING, ELASTIC_SWINGS),
  tapElastic: (t) => tapElasticAt(t, ELASTIC_DAMPING, ELASTIC_SWINGS),
  pulseElastic: (t) =>
    t < 0.5
      ? tapElasticAt(t * 2, ELASTIC_DAMPING, ELASTIC_SWINGS)
      : -popElasticAt(t * 2 - 1, ELASTIC_DAMPING, ELASTIC_SWINGS),
  impulse: (t) => {
    const u = t ** 0.9
    return u * (1000 ** -u - 0.001) * 18.6
  },
  /** Not Mirin's: a decaying wobble, which its `popElastic` only approximates. */
  wiggle: (t) => sin(4 * PI * t) * (1 - t),
} satisfies Record<string, Ease>

export type EaseName = keyof typeof EASES

export type Ease = (t: number) => number

const { sin, cos, PI, sqrt, pow } = Math

const outBounce: Ease = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) return 7.5625 * (t - 1.5 / 2.75) ** 2 + 0.75
  if (t < 2.5 / 2.75) return 7.5625 * (t - 2.25 / 2.75) ** 2 + 0.9375
  return 7.5625 * (t - 2.625 / 2.75) ** 2 + 0.984375
}

const BACK = 1.70158

/**
 * The first group runs from 0 to 1. The second group is transient: it leaves the start value
 * and comes back to it, so a row using one of them is a gesture rather than a change of state.
 */
export const EASES = {
  instant: () => 1,
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) ** 2,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t ** 3,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  inQuart: (t) => t ** 4,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  inQuint: (t) => t ** 5,
  outQuint: (t) => 1 - (1 - t) ** 5,
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  inSine: (t) => 1 - cos((t * PI) / 2),
  outSine: (t) => sin((t * PI) / 2),
  inOutSine: (t) => -(cos(PI * t) - 1) / 2,
  inExpo: (t) => (t === 0 ? 0 : pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? pow(2, 20 * t - 10) / 2 : (2 - pow(2, -20 * t + 10)) / 2,
  inCirc: (t) => 1 - sqrt(1 - t * t),
  outCirc: (t) => sqrt(1 - (t - 1) ** 2),
  inOutCirc: (t) =>
    t < 0.5 ? (1 - sqrt(1 - (2 * t) ** 2)) / 2 : (sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,
  inBack: (t) => (BACK + 1) * t ** 3 - BACK * t * t,
  outBack: (t) => 1 + (BACK + 1) * (t - 1) ** 3 + BACK * (t - 1) ** 2,
  inOutBack: (t) => {
    const c = BACK * 1.525
    return t < 0.5
      ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2
      : ((2 * t - 2) ** 2 * ((c + 1) * (t * 2 - 2) + c) + 2) / 2
  },
  inElastic: (t) =>
    t === 0 || t === 1 ? t : -pow(2, 10 * t - 10) * sin((t * 10 - 10.75) * ((2 * PI) / 3)),
  outElastic: (t) =>
    t === 0 || t === 1 ? t : pow(2, -10 * t) * sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1,
  inBounce: (t) => 1 - outBounce(1 - t),
  outBounce,

  bounce: (t) => 4 * t * (1 - t),
  tri: (t) => 1 - Math.abs(2 * t - 1),
  bell: (t) => sin(PI * t) ** 2,
  pop: (t) => 3.5 * (1 - t) ** 2 * t,
  tap: (t) => (t < 0.1 ? t * 10 : (1 - t) / 0.9),
  pulse: (t) => (t < 0.5 ? 1 : 0),
  spike: (t) => Math.exp(-10 * Math.abs(2 * t - 1)),
  wiggle: (t) => sin(4 * PI * t) * (1 - t),
} satisfies Record<string, Ease>

export type EaseName = keyof typeof EASES

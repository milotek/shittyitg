import { COLUMNS } from '../effects/field.ts'

/**
 * A mod's natural unit. A percentage is what a modder types and is divided by 100 on the way in;
 * the other two are already the number a person would write.
 */
export type Unit = 'percent' | 'degrees' | 'raw'

export type Mod = {
  unit: Unit
  /** What the mod reads before any row has touched it. */
  rest: number
  /** Whether `<name><column>` is accepted alongside the bare name. */
  columns: boolean
}

const wholeField = (unit: Unit = 'percent', rest = 0): Mod => ({ unit, rest, columns: false })
const perColumn = (unit: Unit = 'percent', rest = 0): Mod => ({ unit, rest, columns: true })

/** What each knob reads when a chart leaves it alone: a phase shifts by nothing, the rest scale by one. */
const KNOB_REST = { size: 1, speed: 1, period: 1, spacing: 1, mult: 1, offset: 0 } as const
type Knob = keyof typeof KNOB_REST

/**
 * The knobs NotITG hangs off a periodic mod, each a percentage of the shape that mod has with them
 * left alone. A chart that never names one therefore gets exactly the behaviour it had before the
 * knob existed, which is what lets them be bolted onto mods charts already use.
 */
const knobs = (mod: string, ...names: Knob[]): Record<string, Mod> =>
  Object.fromEntries(names.map((name) => [`${mod}${name}`, wholeField('percent', KNOB_REST[name])]))

/**
 * Every mod a chart may name, declared once. Nothing else keeps a list: the unit conversion, the
 * resting value, which names take a column suffix and the dev panel's menu all read from here, so
 * adding a mod is one line rather than four edits that can disagree.
 *
 * Insertion order is the order the dev panel offers them in, so related mods stay together.
 */
export const MODS: Record<string, Mod> = {
  xmod: wholeField('raw', 1),
  cmod: wholeField('raw'),
  mmod: wholeField('raw'),

  reverse: perColumn(),
  split: wholeField(),
  alternate: wholeField(),
  cross: wholeField(),
  centered: wholeField(),
  reversetype: wholeField(),

  mini: perColumn(),
  tiny: perColumn(),
  flip: wholeField(),
  invert: wholeField(),

  drunk: perColumn(),
  ...knobs('drunk', 'size', 'speed', 'period', 'spacing', 'offset'),
  tipsy: perColumn(),
  ...knobs('tipsy', 'speed', 'spacing', 'offset'),
  tornado: perColumn(),
  ...knobs('tornado', 'period', 'offset'),
  bumpy: perColumn(),
  ...knobs('bumpy', 'size', 'period', 'offset'),
  beat: wholeField(),
  ...knobs('beat', 'size', 'mult', 'period', 'offset'),
  wave: wholeField(),
  ...knobs('wave', 'size', 'period', 'offset'),
  boost: wholeField(),
  brake: wholeField(),

  dizzy: perColumn(),
  roll: perColumn(),
  twirl: perColumn(),
  confusion: perColumn(),
  confusionoffset: perColumn('degrees'),

  stealth: perColumn(),
  dark: perColumn(),
  cover: wholeField(),
  sudden: perColumn(),
  suddenoffset: wholeField(),
  hidden: perColumn(),
  hiddenoffset: wholeField(),
  stealthpastreceptors: wholeField(),

  movex: perColumn(),
  movey: perColumn(),
  movez: perColumn(),

  overhead: wholeField(),
  incoming: wholeField(),
  space: wholeField(),
  hallway: wholeField(),
  distant: wholeField(),
  tilt: wholeField(),
  skew: wholeField(),
  rotationx: wholeField('degrees'),
  rotationy: wholeField('degrees'),
  rotationz: wholeField('degrees'),
}

const COLUMN_SUFFIX = /^(.*?)([0-9]+)$/

/**
 * The mod a chart's name refers to, resolving a column suffix onto its base. Undefined for a name
 * nothing answers to, which is the point: a mistyped mod is caught when the chart loads instead of
 * quietly doing nothing for the length of a song.
 */
export function modOf(name: string): Mod | undefined {
  const direct = MODS[name]
  if (direct) return direct

  const suffixed = COLUMN_SUFFIX.exec(name)
  if (!suffixed) return undefined
  const base = MODS[suffixed[1] as string]
  if (!base?.columns) return undefined
  return Number(suffixed[2]) < COLUMNS ? base : undefined
}

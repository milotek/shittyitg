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

  reverse: perColumn(),
  split: wholeField(),
  alternate: wholeField(),
  cross: wholeField(),
  centered: wholeField(),

  mini: perColumn(),
  flip: wholeField(),
  invert: wholeField(),

  drunk: perColumn(),
  tipsy: perColumn(),
  tornado: perColumn(),
  bumpy: perColumn(),
  beat: wholeField(),
  wave: wholeField(),
  boost: wholeField(),
  brake: wholeField(),

  dizzy: perColumn(),
  roll: perColumn(),
  twirl: perColumn(),
  confusion: perColumn(),
  confusionoffset: perColumn('degrees'),

  stealth: perColumn(),
  dark: perColumn(),
  sudden: perColumn(),
  suddenoffset: wholeField(),
  hidden: perColumn(),
  hiddenoffset: wholeField(),

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

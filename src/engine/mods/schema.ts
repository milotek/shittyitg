import type { EaseName } from './ease.ts'

/**
 * The Mirin Template's row shape. Values are percentages, as modders write them, except for the
 * mods listed in `RAW_UNITS`, whose natural unit is already the number a person would type.
 */
export type ModRow = {
  beat: number
  len: number
  ease: EaseName
  set: Record<string, number>
}

export type ModsFile = {
  rows: ModRow[]
}

/** Degrees and multipliers are typed as themselves; everything else is a percentage. */
export const RAW_UNITS = new Set([
  'xmod',
  'cmod',
  'confusionoffset',
  'confusionoffset0',
  'confusionoffset1',
  'confusionoffset2',
  'confusionoffset3',
  'rotationx',
  'rotationy',
  'rotationz',
])

export const REST: Record<string, number> = { xmod: 1 }

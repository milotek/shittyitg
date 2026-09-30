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

export const RAW_UNITS = new Set(['xmod', 'cmod'])

export const REST: Record<string, number> = { xmod: 1 }

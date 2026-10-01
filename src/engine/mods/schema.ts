import type { EaseName } from './ease.ts'

/**
 * The Mirin Template's row shape. Values are in each mod's own unit, as `registry.ts` declares it:
 * a percentage for most, degrees for the rotations, and its own number for `xmod` and `cmod`.
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

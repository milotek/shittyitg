export const Grade = {
  fantastic: 0,
  excellent: 1,
  great: 2,
  decent: 3,
  wayOff: 4,
  miss: 5,
} as const

export type GradeValue = (typeof Grade)[keyof typeof Grade]

/** ITG's windows, in seconds either side of the note. */
const WINDOWS = [0.0215, 0.043, 0.102, 0.135, 0.18] as const

/** The widest window: a press further out than this touches nothing. */
export const HIT_WINDOW = WINDOWS[WINDOWS.length - 1] as number

/** A mine goes off if a press lands this close to it, as well as if the column is held through it. */
export const MINE_WINDOW = 0.07

/** How long a hold may be let go, or a roll left untapped, before it drops. */
export const HOLD_WINDOW = 0.25
export const ROLL_WINDOW = 0.35

export function grade(error: number): GradeValue {
  const magnitude = Math.abs(error)
  for (let i = 0; i < WINDOWS.length; i++) {
    if (magnitude <= (WINDOWS[i] as number)) return i as GradeValue
  }
  return Grade.miss
}

/** Decent and worse break the combo, as a Great still reads as keeping up. */
export function keepsCombo(value: GradeValue): boolean {
  return value <= Grade.great
}

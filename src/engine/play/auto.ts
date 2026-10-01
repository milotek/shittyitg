import type { Note } from '../notes/notes.ts'
import { HIT_WINDOW, ROLL_WINDOW } from './judge.ts'

/** How long a tap is held for: long enough to be a press, short enough to clear the next note. */
const TAP = 0.02

/** A roll is tapped again this often, comfortably inside the window one survives on. */
const RETAP = ROLL_WINDOW / 3

/**
 * How well a player that is not a person plays.
 *
 * Both of these at zero is an autoplay: every press lands on its note and nothing is left
 * alone, which is the mode for watching a modchart rather than reading it. Anything above zero
 * is a CPU, and the two numbers are the whole of what separates one from the other.
 */
export type Skill = {
  /** The widest a press is thrown off its note, in seconds. */
  stray: number
  /** The share of notes it never presses, and of holds it lets go of early. */
  slip: number
}

export const PERFECT: Skill = { stray: 0, slip: 0 }

/**
 * The CPU's strengths, worst to best, pitched against the judgment windows: the weakest sprays
 * presses wide enough to be Way Off and leaves one note in eight alone, and the strongest sits
 * inside the Fantastic window and only ever fumbles a hold.
 */
export const CPU: readonly Skill[] = [
  { stray: 0.165, slip: 0.12 },
  { stray: 0.14, slip: 0.085 },
  { stray: 0.112, slip: 0.055 },
  { stray: 0.085, slip: 0.035 },
  { stray: 0.06, slip: 0.018 },
  { stray: 0.045, slip: 0.008 },
  { stray: 0.034, slip: 0.003 },
  { stray: 0.025, slip: 0.001 },
]

/** Where a CPU lands when a strength is asked for without saying which. */
export const CPU_DEFAULT = 4

/**
 * A number in [0, 1) for a note, so a CPU plays a given chart the same way every time it is
 * watched. A run that cannot be repeated could not be compared against the one before it.
 */
function scatter(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/** Separate draws off one note, so its timing and whether it is played at all are unrelated. */
const STRAY = 0x51ed270b
const DROP = 0x1b873593

/**
 * Plays a chart back through the same presses and releases a keyboard makes, each one timed
 * against its note rather than against the frame that noticed it. Nothing here knows how a note
 * is judged: `Play` decides that, exactly as it does for a person, which is what keeps a CPU's
 * score and an autoplay's score worth the same as one somebody earned.
 */
export class AutoPlayer {
  readonly #notes: readonly Note[]
  readonly #seconds: Float64Array
  readonly #ends: Float64Array
  readonly #columns: number[][]
  readonly #skill: Skill
  readonly #cursor: number[]
  /** When the column currently down should let go, or NaN while nothing is held. */
  readonly #until: number[]
  /** When the roll being tapped runs out, or NaN when no roll is in progress. */
  readonly #roll: number[]
  readonly #tapped: number[]

  constructor(
    notes: readonly Note[],
    seconds: Float64Array,
    secondAt: (beat: number) => number,
    columns: number,
    skill: Skill = PERFECT,
  ) {
    this.#notes = notes
    this.#seconds = seconds
    this.#skill = skill
    this.#ends = Float64Array.from(notes, (note) =>
      note.endBeat === undefined ? Number.NaN : secondAt(note.endBeat),
    )
    this.#columns = Array.from({ length: columns }, () => [])
    notes.forEach((note, index) => this.#columns[note.column]?.push(index))
    this.#cursor = new Array(columns).fill(0)
    this.#until = new Array(columns).fill(Number.NaN)
    this.#roll = new Array(columns).fill(Number.NaN)
    this.#tapped = new Array(columns).fill(Number.NaN)
  }

  step(
    now: number,
    press: (column: number, at: number) => void,
    release: (column: number, at: number) => void,
  ): void {
    for (let column = 0; column < this.#columns.length; column++) {
      const until = this.#until[column] as number
      if (until <= now) {
        release(column, until)
        this.#until[column] = Number.NaN
      }
      if (!Number.isNaN(this.#until[column])) continue

      // A roll is kept alive by being tapped again, never by being held down, so it has to be
      // taken up again before anything else in the column is.
      const ends = this.#roll[column] as number
      if (!Number.isNaN(ends)) {
        const again = (this.#tapped[column] as number) + RETAP
        if (again < ends) {
          if (again <= now) this.#tap(column, again, press)
          continue
        }
        this.#roll[column] = Number.NaN
      }

      const index = this.#next(column, now)
      if (index === undefined) continue
      const note = this.#notes[index] as Note
      const at = this.#pressAt(index)
      this.#tap(column, at, press)
      // A hold is simply kept down to its end. A roll is let go of and taken up again.
      if (note.kind === 'hold') this.#until[column] = this.#letGo(index, at)
      else if (note.kind === 'roll') this.#roll[column] = this.#ends[index] as number
    }
  }

  #tap(column: number, at: number, press: (column: number, at: number) => void): void {
    press(column, at)
    this.#tapped[column] = at
    this.#until[column] = at + TAP
  }

  /**
   * When a hold is let go of. A slipped one goes early enough in the hold to actually drop it:
   * let go any later than the grace window before the end and it finishes anyway.
   */
  #letGo(index: number, at: number): number {
    const end = this.#ends[index] as number
    if (scatter(index ^ DROP) >= this.#skill.slip) return end
    return at + (end - at) * (0.15 + scatter(index) * 0.35)
  }

  /** When the press for a note lands, which for anything but a perfect player is not on it. */
  #pressAt(index: number): number {
    const at = this.#seconds[index] as number
    if (this.#skill.stray === 0) return at
    return at + (scatter(index ^ STRAY) * 2 - 1) * this.#skill.stray
  }

  /**
   * The next note in the column worth pressing. Mines are stepped over rather than played, and
   * so is anything already past saving, which is what lets a start partway through a song catch
   * up in one frame instead of hammering the column.
   */
  #next(column: number, now: number): number | undefined {
    const list = this.#columns[column] as number[]
    let cursor = this.#cursor[column] as number
    while (cursor < list.length) {
      const index = list[cursor] as number
      if (this.#pressAt(index) > now) break
      cursor++
      this.#cursor[column] = cursor
      if ((this.#notes[index] as Note).kind === 'mine') continue
      if (scatter(index) < this.#skill.slip) continue
      if (now - (this.#seconds[index] as number) > HIT_WINDOW) continue
      return index
    }
    this.#cursor[column] = cursor
    return undefined
  }
}

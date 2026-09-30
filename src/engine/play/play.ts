import type { Note } from '../notes/notes.ts'
import {
  Grade,
  type GradeValue,
  grade,
  HIT_WINDOW,
  HOLD_WINDOW,
  keepsCombo,
  MINE_WINDOW,
  ROLL_WINDOW,
} from './judge.ts'
import { NoteState } from './state.ts'

export type PlayEvent =
  | { kind: 'judgment'; grade: GradeValue; error: number; column: number; at: number }
  | { kind: 'hold'; held: boolean; column: number; at: number }
  | { kind: 'mine'; column: number; at: number }

type Holding = { note: number; column: number; roll: boolean; end: number; lastTouch: number }

/**
 * Grades presses against the time each one happened, which the caller supplies from the input
 * event rather than from the frame that noticed it. Everything else, misses and drops included,
 * is decided at the exact moment its window closed, so the result is the same at any frame rate.
 */
export class Play {
  readonly state: Uint8Array
  readonly events: PlayEvent[] = []
  combo = 0

  readonly #notes: readonly Note[]
  readonly #seconds: Float64Array
  readonly #ends: Float64Array
  readonly #columns: number[][]
  readonly #cursor: number[]
  readonly #downSince: (number | undefined)[]
  readonly #holding: (Holding | undefined)[]

  constructor(
    notes: readonly Note[],
    seconds: Float64Array,
    secondAt: (beat: number) => number,
    columns: number,
  ) {
    this.#notes = notes
    this.#seconds = seconds
    this.#ends = Float64Array.from(notes, (note) =>
      note.endBeat === undefined ? Number.NaN : secondAt(note.endBeat),
    )
    this.state = new Uint8Array(notes.length)
    this.#columns = Array.from({ length: columns }, () => [])
    notes.forEach((note, index) => this.#columns[note.column]?.push(index))
    this.#cursor = new Array(columns).fill(0)
    this.#downSince = new Array(columns).fill(undefined)
    this.#holding = new Array(columns).fill(undefined)
  }

  isDown(column: number): boolean {
    return this.#downSince[column] !== undefined
  }

  press(column: number, at: number): void {
    if (this.#downSince[column] !== undefined) return
    this.#settle(at)
    this.#downSince[column] = at

    const holding = this.#holding[column]
    if (holding?.roll) holding.lastTouch = at

    let best = -1
    let bestError = Number.POSITIVE_INFINITY
    for (const index of this.#pending(column)) {
      const note = this.#notes[index] as Note
      const error = at - (this.#seconds[index] as number)
      if (error < -HIT_WINDOW) break
      if (note.kind === 'mine') {
        if (Math.abs(error) <= MINE_WINDOW) this.#mine(index, at)
        continue
      }
      if (Math.abs(error) < Math.abs(bestError)) {
        best = index
        bestError = error
      }
    }
    if (best >= 0) this.#hit(best, bestError, at)
  }

  release(column: number, at: number): void {
    const since = this.#downSince[column]
    if (since === undefined) return
    this.#settle(at)
    this.#downSince[column] = undefined
    const holding = this.#holding[column]
    if (holding && !holding.roll) holding.lastTouch = at
  }

  /** Brings everything up to `now`: misses, finished and dropped holds, mines held through. */
  update(now: number): void {
    this.#settle(now)
  }

  #settle(now: number): void {
    for (let column = 0; column < this.#columns.length; column++) {
      this.#settleHold(column, now)

      for (const index of this.#pending(column)) {
        const note = this.#notes[index] as Note
        const due = this.#seconds[index] as number
        if (due > now) break

        if (note.kind === 'mine') {
          const since = this.#downSince[column]
          if (since !== undefined && since <= due) this.#mine(index, due)
          else if (now - due > MINE_WINDOW) this.state[index] = NoteState.missed
          continue
        }

        if (now - due > HIT_WINDOW) {
          this.state[index] = note.endBeat === undefined ? NoteState.missed : NoteState.dropped
          this.#judge(Grade.miss, 0, column, due + HIT_WINDOW)
        }
      }
    }
  }

  #settleHold(column: number, now: number): void {
    const holding = this.#holding[column]
    if (!holding) return

    const down = this.#downSince[column] !== undefined
    const window = holding.roll ? ROLL_WINDOW : HOLD_WINDOW
    const touching = !holding.roll && down
    const dropAt = touching ? Number.POSITIVE_INFINITY : holding.lastTouch + window

    if (dropAt < holding.end && dropAt <= now) {
      this.state[holding.note] = NoteState.dropped
      this.#holding[column] = undefined
      this.combo = 0
      this.events.push({ kind: 'hold', held: false, column, at: dropAt })
    } else if (holding.end <= now) {
      this.state[holding.note] = NoteState.gone
      this.#holding[column] = undefined
      this.events.push({ kind: 'hold', held: true, column, at: holding.end })
    }
  }

  #hit(index: number, error: number, at: number): void {
    const note = this.#notes[index] as Note
    const value = grade(error)
    this.#judge(value, error, note.column, at)
    if (note.endBeat === undefined) {
      this.state[index] = NoteState.gone
      return
    }
    this.state[index] = NoteState.holding
    this.#holding[note.column] = {
      note: index,
      column: note.column,
      roll: note.kind === 'roll',
      end: this.#ends[index] as number,
      lastTouch: at,
    }
  }

  #mine(index: number, at: number): void {
    const column = (this.#notes[index] as Note).column
    this.state[index] = NoteState.gone
    this.events.push({ kind: 'mine', column, at })
  }

  #judge(value: GradeValue, error: number, column: number, at: number): void {
    this.combo = keepsCombo(value) ? this.combo + 1 : 0
    this.events.push({ kind: 'judgment', grade: value, error, column, at })
  }

  /** The column's notes still waiting on a verdict, oldest first. */
  *#pending(column: number): Generator<number> {
    const list = this.#columns[column] as number[]
    let cursor = this.#cursor[column] as number
    while (cursor < list.length && this.state[list[cursor] as number] !== NoteState.pending)
      cursor++
    this.#cursor[column] = cursor
    for (let i = cursor; i < list.length; i++) {
      const index = list[i] as number
      if (this.state[index] === NoteState.pending) yield index
    }
  }
}

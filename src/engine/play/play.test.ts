import { describe, expect, it } from 'vitest'
import type { Note } from '../notes/notes.ts'
import { Grade } from './judge.ts'
import { Play, type PlayEvent } from './play.ts'
import { NoteState } from './state.ts'

const tap = (beat: number, column = 0): Note => ({ beat, column, kind: 'tap', quant: 4 })
const hold = (beat: number, length: number, column = 0, kind: 'hold' | 'roll' = 'hold'): Note => ({
  beat,
  column,
  kind,
  quant: 4,
  endBeat: beat + length,
})
const mine = (beat: number, column = 0): Note => ({ beat, column, kind: 'mine', quant: 4 })

/** One beat per second keeps the arithmetic readable. */
const play = (notes: Note[]) =>
  new Play(
    notes,
    Float64Array.from(notes, (n) => n.beat),
    (beat) => beat,
    4,
  )

const judgments = (events: PlayEvent[]) =>
  events.flatMap((e) => (e.kind === 'judgment' ? [e.grade] : []))

describe('Play', () => {
  it('grades a press by when it happened, not when it was processed', () => {
    const game = play([tap(1)])
    game.update(0.9)
    game.press(0, 1.03)
    game.update(1.5)
    expect(judgments(game.events)).toEqual([Grade.excellent])
    expect(game.state[0]).toBe(NoteState.gone)
    expect(game.combo).toBe(1)
  })

  it('misses a note once its window closes and breaks the combo', () => {
    const game = play([tap(1), tap(2)])
    game.press(0, 1)
    game.update(3)
    expect(judgments(game.events)).toEqual([Grade.fantastic, Grade.miss])
    expect(game.state[1]).toBe(NoteState.missed)
    expect(game.combo).toBe(0)
  })

  it('ignores a press too early to touch anything', () => {
    const game = play([tap(1)])
    game.press(0, 0.5)
    expect(game.events).toEqual([])
    expect(game.state[0]).toBe(NoteState.pending)
  })

  it('takes the nearer of two notes in reach', () => {
    const game = play([tap(1), tap(1.15)])
    game.press(0, 1.12)
    expect(game.state).toEqual(new Uint8Array([NoteState.pending, NoteState.gone]))
  })

  it('finishes a hold kept down to the end', () => {
    const game = play([hold(1, 2)])
    game.press(0, 1)
    game.update(3.5)
    expect(game.events.at(-1)).toMatchObject({ kind: 'hold', held: true, at: 3 })
    expect(game.state[0]).toBe(NoteState.gone)
  })

  it('drops a hold exactly one window after it was let go', () => {
    const game = play([hold(1, 2)])
    game.press(0, 1)
    game.release(0, 1.5)
    game.update(2.9)
    expect(game.events.at(-1)).toMatchObject({ kind: 'hold', held: false, at: 1.75 })
    expect(game.state[0]).toBe(NoteState.dropped)
  })

  it('forgives a hold let go and caught again inside the window', () => {
    const game = play([hold(1, 2)])
    game.press(0, 1)
    game.release(0, 1.5)
    game.press(0, 1.7)
    game.update(3.1)
    expect(game.events.at(-1)).toMatchObject({ kind: 'hold', held: true })
  })

  it('keeps a roll alive only while it is tapped', () => {
    const kept = play([hold(1, 1, 0, 'roll')])
    for (let t = 1; t < 2.1; t += 0.3) {
      kept.press(0, t)
      kept.release(0, t + 0.05)
    }
    kept.update(2.5)
    expect(kept.events.at(-1)).toMatchObject({ kind: 'hold', held: true })

    const held = play([hold(1, 1, 0, 'roll')])
    held.press(0, 1)
    held.update(2.5)
    expect(held.events.at(-1)).toMatchObject({ kind: 'hold', held: false, at: 1.35 })
  })

  it('sets off a mine held through, and not one passed over', () => {
    const through = play([mine(1)])
    through.press(0, 0.5)
    through.update(1.2)
    expect(through.events).toEqual([{ kind: 'mine', column: 0, at: 1 }])

    const clear = play([mine(1)])
    clear.update(1.2)
    expect(clear.events).toEqual([])
    expect(clear.state[0]).toBe(NoteState.missed)
  })

  it('reaches the same verdicts whatever the frame step', () => {
    const chart = [tap(1), hold(2, 1, 1), tap(2.5, 2), mine(3, 3), hold(3.5, 1, 0, 'roll'), tap(5)]
    const inputs: [number, 'press' | 'release', number][] = [
      [1.01, 'press', 0],
      [1.1, 'release', 0],
      [1.98, 'press', 1],
      [2.52, 'press', 2],
      [2.6, 'release', 2],
      [2.7, 'release', 1],
      [2.8, 'press', 3],
      [3.5, 'press', 0],
      [3.55, 'release', 0],
      [3.8, 'press', 0],
      [3.85, 'release', 0],
    ]
    const run = (step: number) => {
      const game = play(chart)
      let next = 0
      for (let now = 0; now <= 7; now += step) {
        while (next < inputs.length && (inputs[next] as [number, string, number])[0] <= now) {
          const [at, action, column] = inputs[next++] as [number, 'press' | 'release', number]
          game[action](column, at)
        }
        game.update(now)
      }
      return { events: [...game.events].sort((a, b) => a.at - b.at), combo: game.combo }
    }
    expect(run(1 / 144)).toEqual(run(1 / 60))
    expect(run(1 / 120)).toEqual(run(1 / 60))
  })
})

import { describe, expect, it } from 'vitest'
import type { Note } from '../notes/notes.ts'
import { AutoPlayer, CPU, PERFECT, type Skill } from './auto.ts'
import { Grade } from './judge.ts'
import { Play, type PlayEvent } from './play.ts'

const tap = (beat: number, column = 0): Note => ({ beat, column, kind: 'tap', quant: 4 })
const hold = (beat: number, length: number, column = 0, kind: 'hold' | 'roll' = 'hold'): Note => ({
  beat,
  column,
  kind,
  quant: 4,
  endBeat: beat + length,
})
const mine = (beat: number, column = 0): Note => ({ beat, column, kind: 'mine', quant: 4 })

/** One beat per second, stepped at 60fps, which is the game's own loop with nobody at the keys. */
function watch(notes: Note[], skill: Skill, until = 20) {
  const seconds = Float64Array.from(notes, (n) => n.beat)
  const game = new Play(notes, seconds, (beat) => beat, 4)
  const auto = new AutoPlayer(notes, seconds, (beat) => beat, 4, skill)
  for (let frame = 0; frame * (1 / 60) <= until; frame++) {
    const now = frame * (1 / 60)
    auto.step(
      now,
      (column, at) => game.press(column, at),
      (column, at) => game.release(column, at),
    )
    game.update(now)
  }
  return game
}

const judgments = (events: readonly PlayEvent[]) =>
  events.flatMap((e) => (e.kind === 'judgment' ? [e.grade] : []))

describe('AutoPlayer', () => {
  it('lands every tap on its note however the frames fall', () => {
    const game = watch([tap(1), tap(1.25, 1), tap(1.5, 2), tap(2, 3)], PERFECT)
    expect(judgments(game.events)).toEqual([
      Grade.fantastic,
      Grade.fantastic,
      Grade.fantastic,
      Grade.fantastic,
    ])
    expect(game.combo).toBe(4)
  })

  it('keeps a hold down to its end and taps a roll through to its own', () => {
    const game = watch([hold(1, 4), hold(1, 4, 1, 'roll')], PERFECT)
    expect(judgments(game.events)).toEqual([Grade.fantastic, Grade.fantastic])
    expect(game.events.filter((e) => e.kind === 'hold' && e.held)).toHaveLength(2)
    expect(game.events.some((e) => e.kind === 'hold' && !e.held)).toBe(false)
  })

  it('steps over a mine rather than setting it off', () => {
    const game = watch([tap(1), mine(1.5), tap(2)], PERFECT)
    expect(game.events.some((e) => e.kind === 'mine')).toBe(false)
    expect(game.combo).toBe(2)
  })

  it('plays a chart the same way every time, so two runs can be compared', () => {
    const chart = [tap(1), tap(1.5, 1), tap(2, 2), hold(3, 2, 3), tap(6), tap(6.5, 1)]
    const first = watch(chart, CPU[2] as Skill)
    const second = watch(chart, CPU[2] as Skill)
    expect(judgments(first.events)).toEqual(judgments(second.events))
  })

  it('plays better the stronger it is', () => {
    const chart = Array.from({ length: 64 }, (_, i) => tap(1 + i * 0.25, i % 4))
    const perfect = (skill: Skill) =>
      judgments(watch(chart, skill).events).filter((g) => g === Grade.fantastic).length
    expect(perfect(CPU[0] as Skill)).toBeLessThan(perfect(CPU[4] as Skill))
    expect(perfect(CPU[4] as Skill)).toBeLessThan(perfect(CPU[7] as Skill))
    expect(perfect(PERFECT)).toBe(chart.length)
  })

  it('leaves notes alone when it is weak enough to, and never when it is not', () => {
    const chart = Array.from({ length: 64 }, (_, i) => tap(1 + i * 0.25, i % 4))
    const missed = (skill: Skill) =>
      judgments(watch(chart, skill).events).filter((g) => g === Grade.miss).length
    expect(missed(CPU[0] as Skill)).toBeGreaterThan(0)
    expect(missed(PERFECT)).toBe(0)
  })
})

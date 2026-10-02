import { COLUMNS } from '../../engine/effects/field.ts'
import { fieldWarp } from '../../engine/effects/warp.ts'
import { ModState } from '../../engine/mods/track.ts'
import type { Chart } from '../../engine/notes/notes.ts'
import { AutoPlayer, type Skill } from '../../engine/play/auto.ts'
import { Grade } from '../../engine/play/judge.ts'
import { Play, type PlayEvent } from '../../engine/play/play.ts'
import { NoteState } from '../../engine/play/state.ts'
import { Timing } from '../../engine/timing/timing.ts'
import type { Background } from '../../render/background.ts'
import type { Hud } from '../../render/hud/hud.ts'
import type { Flash } from '../../render/notefield/field.ts'
import type { NotefieldView } from '../../render/notefield/view.ts'
import type { Stage } from '../../render/stage.ts'
import { SongAudio } from '../audio.ts'
import { bindInput } from '../input.ts'
import type { SongFiles } from '../song.ts'

const LEAD_IN = 2

const FLASH_SPRITE: Record<number, string> = {
  [Grade.fantastic]: 'flashMarvelous',
  [Grade.excellent]: 'flashPerfect',
  [Grade.great]: 'flashGreat',
  [Grade.decent]: 'flashGood',
  [Grade.wayOff]: 'flashBoo',
}

export class Gameplay {
  readonly audio = new SongAudio()
  readonly #stage: Stage
  readonly #field: NotefieldView
  readonly #hud: Hud
  readonly #background: Background
  readonly #song: SongFiles
  readonly #chart: Chart
  readonly #timing: Timing
  readonly #mods: ModState
  readonly #seconds: Float64Array
  readonly #play: Play
  readonly #flashes: (Flash | undefined)[] = new Array(COLUMNS).fill(undefined)
  readonly #holding: boolean[] = new Array(COLUMNS).fill(false)
  readonly #pressed: number[] = new Array(COLUMNS).fill(0)
  #auto: AutoPlayer | undefined
  #stopFrames: (() => void) | undefined
  #unbind: (() => void) | undefined
  #consumed = 0
  #finished: (() => void) | undefined

  constructor(
    stage: Stage,
    views: { field: NotefieldView; hud: Hud; background: Background },
    song: SongFiles,
    chartIndex: number,
  ) {
    this.#stage = stage
    this.#field = views.field
    this.#hud = views.hud
    this.#background = views.background
    this.#song = song
    this.#timing = new Timing(song.notes.timing)
    this.#mods = new ModState(song.mods.rows)

    const chart = song.notes.charts[chartIndex]
    if (!chart) throw new Error(`${song.slug} has no chart ${chartIndex}`)
    this.#chart = chart
    this.#seconds = Float64Array.from(chart.notes, (note) => this.#timing.secondAt(note.beat))
    this.#play = new Play(chart.notes, this.#seconds, (b) => this.#timing.secondAt(b), COLUMNS)
  }

  get mods(): ModState {
    return this.#mods
  }

  get events(): readonly PlayEvent[] {
    return this.#play.events
  }

  songBeat(): number {
    return this.#timing.beatAt(this.audio.timeSeconds())
  }

  /**
   * Resolves once the song has played out or the player backs out with Escape. Starts from
   * `fromBeat` only while inspecting a chart. Given a `skill`, nobody is at the keyboard: the
   * chart plays itself at that strength and the input stays unbound.
   */
  async play(fromBeat = 0, skill?: Skill): Promise<void> {
    const { base, manifest } = this.#song
    await Promise.all([
      this.audio.load(base + manifest.audio),
      this.#background.show(manifest.background ? base + manifest.background : undefined),
    ])
    this.#hud.reset()
    this.#stage.show(this.#background, this.#field, this.#hud)
    this.#auto = skill
      ? new AutoPlayer(
          this.#chart.notes,
          this.#seconds,
          (b) => this.#timing.secondAt(b),
          COLUMNS,
          skill,
        )
      : undefined
    this.#stopFrames = this.#stage.every(() => this.#frame())
    const unbindPlay = skill
      ? undefined
      : bindInput(
          (column, stamp) => this.#play.press(column, this.audio.at(stamp)),
          (column, stamp) => this.#play.release(column, this.audio.at(stamp)),
        )
    const onEscape = (event: KeyboardEvent) => {
      if (event.code === 'Escape') this.#end()
    }
    addEventListener('keydown', onEscape)
    this.#unbind = () => {
      unbindPlay?.()
      removeEventListener('keydown', onEscape)
    }
    const done = new Promise<void>((resolve) => {
      this.#finished = resolve
    })
    await this.audio.play(this.#timing.secondAt(fromBeat), LEAD_IN)
    return done
  }

  #end(): void {
    this.#unbind?.()
    this.audio.stop()
    void this.audio.context.close()
    this.#stopFrames?.()
    this.#stage.hide(this.#background, this.#field, this.#hud)
    this.#background.hide()
    this.#finished?.()
  }

  #frame(): void {
    const seconds = this.audio.timeSeconds()
    const beat = this.#timing.beatAt(seconds)
    // Before the update, so a note due this frame is pressed rather than already missed.
    this.#auto?.step(
      seconds,
      (column, at) => this.#play.press(column, at),
      (column, at) => this.#play.release(column, at),
    )
    this.#play.update(seconds)
    this.#consume()
    this.#mods.update(beat)

    for (let column = 0; column < COLUMNS; column++) {
      this.#pressed[column] = this.#play.isDown(column) ? 1 : 0
    }

    const { width, height } = this.#stage
    this.#background.layout(width, height)
    this.#background.dim(this.#mods.get('cover'))
    const cell = this.#field.layout(width, height)
    this.#hud.layout(cell, width, height)
    this.#hud.update(seconds, this.#play.combo)
    this.#hud.container.visible = this.#mods.get('blind') <= 0.5
    this.#field.render({
      chart: {
        notes: this.#chart.notes,
        seconds: this.#seconds,
        secondAt: (b) => this.#timing.secondAt(b),
      },
      mods: this.#mods,
      song: {
        beat,
        seconds,
        bps: this.#timing.beatsPerSecondAt(beat),
        peakBpm: this.#timing.peakBpm,
      },
      state: this.#play.state,
      pressed: this.#pressed,
      flashes: this.#flashes,
      holding: this.#holding,
      warp: fieldWarp(this.#mods),
    })

    if (seconds > this.audio.duration + 1) this.#end()
  }

  #consume(): void {
    const blind = this.#mods.get('blind') > 0.5
    const events = this.#play.events
    for (; this.#consumed < events.length; this.#consumed++) {
      const event = events[this.#consumed]
      if (!event) continue
      if (event.kind === 'judgment') {
        this.#hud.judge(event.grade, event.at)
        const sprite = FLASH_SPRITE[event.grade]
        // Blind takes every scrap of feedback away, so a hit that would flash still flashes, but
        // it flashes the best grade whatever it actually was.
        const shown = blind ? FLASH_SPRITE[Grade.fantastic] : sprite
        if (sprite) this.#flashes[event.column] = { sprite: shown, at: event.at, additive: false }
      } else if (event.kind === 'mine') {
        this.#flashes[event.column] = { sprite: 'flashMarvelous', at: event.at, additive: true }
      } else if (!event.held) {
        this.#hud.judge(Grade.miss, event.at)
      }
    }

    this.#holding.fill(false)
    const notes = this.#chart.notes
    for (let i = 0; i < notes.length; i++) {
      if (this.#play.state[i] === NoteState.holding)
        this.#holding[(notes[i] as { column: number }).column] = true
    }
  }
}

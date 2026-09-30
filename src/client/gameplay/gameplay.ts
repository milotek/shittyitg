import type { Application } from 'pixi.js'
import { ModState } from '../../engine/mods/track.ts'
import { Timing } from '../../engine/timing/timing.ts'
import type { NotefieldView } from '../../render/notefield/view.ts'
import { SongAudio } from '../audio.ts'
import type { SongFiles } from '../song.ts'

const LEAD_IN = 2

export class Gameplay {
  readonly audio = new SongAudio()
  readonly #app: Application
  readonly #field: NotefieldView
  readonly #song: SongFiles
  readonly #timing: Timing
  readonly #mods: ModState
  readonly #seconds: Float64Array
  readonly #gone: Uint8Array
  readonly #tick = () => this.#frame()

  constructor(app: Application, field: NotefieldView, song: SongFiles, chartIndex = 0) {
    this.#app = app
    this.#field = field
    this.#song = song
    this.#timing = new Timing(song.notes.timing)
    this.#mods = new ModState(song.mods.rows)

    const chart = song.notes.charts[chartIndex]
    if (!chart) throw new Error(`${song.slug} has no chart ${chartIndex}`)
    this.#seconds = Float64Array.from(chart.notes, (note) => this.#timing.secondAt(note.beat))
    this.#gone = new Uint8Array(chart.notes.length)
  }

  async start(): Promise<void> {
    await this.audio.load(this.#song.base + this.#song.manifest.audio)
    this.#app.stage.addChild(this.#field.container)
    this.#app.ticker.add(this.#tick)
    await this.audio.play(0, LEAD_IN)
  }

  stop(): void {
    this.audio.stop()
    this.#app.ticker.remove(this.#tick)
    this.#app.stage.removeChild(this.#field.container)
  }

  #frame(): void {
    const seconds = this.audio.timeSeconds()
    const beat = this.#timing.beatAt(seconds)
    this.#mods.update(beat)
    this.#field.layout(this.#app.screen.width, this.#app.screen.height)

    const chart = this.#song.notes.charts[0]
    if (!chart) return
    this.#field.render({
      chart: { notes: chart.notes, seconds: this.#seconds },
      mods: this.#mods,
      song: { beat, seconds },
      gone: this.#gone,
    })
  }
}

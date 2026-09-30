import type { Clock } from '../engine/timing/clock.ts'

/**
 * Song time comes from the audio hardware's clock, never from frames: `HTMLAudioElement` reports
 * time too coarsely to recover beat accuracy, and a frame counter drifts with the frame rate.
 */
export class SongAudio implements Clock {
  readonly context = new AudioContext({ latencyHint: 'interactive' })
  #buffer: AudioBuffer | undefined
  #source: AudioBufferSourceNode | undefined
  /** Context time at which song second 0 is heard. */
  #origin = 0

  async load(url: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`could not load ${url}: ${response.status}`)
    this.#buffer = await this.context.decodeAudioData(await response.arrayBuffer())
  }

  get duration(): number {
    return this.#buffer?.duration ?? 0
  }

  /** Starts from `fromSeconds` after `leadIn` seconds of silence, during which song time is negative. */
  async play(fromSeconds: number, leadIn: number): Promise<void> {
    if (!this.#buffer) throw new Error('play() before load()')
    await this.context.resume()
    this.stop()

    const source = this.context.createBufferSource()
    source.buffer = this.#buffer
    source.connect(this.context.destination)
    const when = this.context.currentTime + leadIn
    source.start(when, Math.max(fromSeconds, 0))
    this.#source = source
    this.#origin = when - fromSeconds
  }

  stop(): void {
    this.#source?.stop()
    this.#source?.disconnect()
    this.#source = undefined
  }

  timeSeconds(): number {
    return this.at(performance.now())
  }

  /**
   * Song time at a `performance.now()` instant, which is also the clock `event.timeStamp` uses,
   * so a key press is graded at the moment it happened rather than at the next frame.
   */
  at(performanceMs: number): number {
    const stamp = this.context.getOutputTimestamp()
    if (
      this.context.state !== 'running' ||
      stamp.contextTime === undefined ||
      stamp.performanceTime === undefined ||
      stamp.contextTime === 0
    ) {
      return (
        this.context.currentTime -
        this.context.baseLatency -
        this.context.outputLatency -
        this.#origin
      )
    }
    // Just after a resume the stamp can be stale, and extrapolating from it overshoots. What is
    // being heard can never be ahead of what the context has already rendered.
    const heard = stamp.contextTime + (performanceMs - stamp.performanceTime) / 1000
    return Math.min(heard, this.context.currentTime) - this.#origin
  }
}

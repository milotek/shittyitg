export type TimingData = {
  /** Seconds, StepMania's sign: beat 0 lands at `-offset`. */
  offset: number
  bpms: { beat: number; bpm: number }[]
  stops: { beat: number; seconds: number }[]
}

type Anchor = { beat: number; second: number; beatsPerSecond: number }

export class Timing {
  readonly #anchors: Anchor[]
  /** The fastest the song ever gets, which is what `mmod` scales the scroll against. */
  readonly peakBpm: number

  constructor(data: TimingData) {
    const first = data.bpms[0]
    if (!first) throw new Error('a chart needs at least one BPM')

    const changes = [
      ...data.bpms.map((b) => ({ beat: b.beat, bpm: b.bpm, stop: 0 })),
      ...data.stops.map((s) => ({ beat: s.beat, bpm: 0, stop: s.seconds })),
    ].sort((a, b) => a.beat - b.beat || a.stop - b.stop)

    let at: Anchor = { beat: 0, second: -data.offset, beatsPerSecond: first.bpm / 60 }
    const anchors = [at]
    const move = (beat: number) => ({
      beat,
      second: at.second + (beat - at.beat) / at.beatsPerSecond,
    })

    for (const change of changes) {
      if (change.stop > 0) {
        const start = move(change.beat)
        const frozen = { ...start, beatsPerSecond: 0 }
        at = { ...start, second: start.second + change.stop, beatsPerSecond: at.beatsPerSecond }
        anchors.push(frozen, at)
      } else {
        at = { ...move(change.beat), beatsPerSecond: change.bpm / 60 }
        anchors.push(at)
      }
    }

    this.#anchors = anchors
    this.peakBpm = Math.max(...anchors.map((a) => a.beatsPerSecond)) * 60
  }

  /**
   * A stop on a note's own beat happens after the note is hit, so the anchor is the last one
   * strictly before the beat and never includes a stop starting on it.
   */
  #anchorBefore(beat: number): Anchor {
    const anchors = this.#anchors
    let found = anchors[0] as Anchor
    let low = 0
    let high = anchors.length - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      const anchor = anchors[mid] as Anchor
      if (anchor.beat < beat) {
        found = anchor
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return found
  }

  /** Zero through a stop, which is the honest answer and leaves the beat mod running at its base rate. */
  beatsPerSecondAt(beat: number): number {
    return this.#anchorBefore(beat).beatsPerSecond
  }

  secondAt(beat: number): number {
    const found = this.#anchorBefore(beat)
    if (found.beatsPerSecond === 0) return found.second
    return found.second + (beat - found.beat) / found.beatsPerSecond
  }

  beatAt(second: number): number {
    const anchors = this.#anchors
    let found = anchors[0] as Anchor
    let low = 0
    let high = anchors.length - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      const anchor = anchors[mid] as Anchor
      if (anchor.second <= second) {
        found = anchor
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return found.beat + (second - found.second) * found.beatsPerSecond
  }
}

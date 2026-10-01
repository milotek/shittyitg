import { EASES, type Ease } from './ease.ts'
import { MODS, modOf } from './registry.ts'
import type { ModRow } from './schema.ts'

type Segment = {
  beat: number
  end: number
  from: number
  to: number
  ease: Ease
  /** What the mod reads once the segment is over, which a later row can cut short. */
  after: number
}

export type Track = { rest: number; segments: Segment[] }

/**
 * Rows become one keyframe track per mod ahead of time. Reading a track afterwards needs nothing
 * but the beat, so a mod's value can never depend on the frame rate or on the path taken to get
 * there, which a stateful approach toward a goal could not promise.
 */
export function buildTracks(rows: ModRow[]): Map<string, Track> {
  const tracks = new Map<string, Track>()
  const ordered = rows.map((row, index) => ({ row, index }))
  ordered.sort((a, b) => a.row.beat - b.row.beat || a.index - b.index)

  for (const { row } of ordered) {
    const ease = EASES[row.ease]
    if (!ease) throw new Error(`unknown ease "${row.ease}" at beat ${row.beat}`)

    for (const [name, level] of Object.entries(row.set)) {
      const mod = modOf(name)
      if (!mod) throw new Error(`unknown mod "${name}" at beat ${row.beat}`)

      let track = tracks.get(name)
      if (!track) {
        track = { rest: mod.rest, segments: [] }
        tracks.set(name, track)
      }

      const from = read(track, row.beat)
      const last = track.segments.at(-1)
      if (last && last.end > row.beat) {
        last.end = row.beat
        last.after = from
      }

      const to = mod.unit === 'percent' ? level / 100 : level
      const end = row.beat + Math.max(row.len, 0)
      track.segments.push({
        beat: row.beat,
        end,
        from,
        to,
        ease,
        after: from + (to - from) * ease(1),
      })
    }
  }

  return tracks
}

export function read(track: Track, beat: number): number {
  const segments = track.segments
  let low = 0
  let high = segments.length - 1
  let found: Segment | undefined
  while (low <= high) {
    const mid = (low + high) >> 1
    const segment = segments[mid] as Segment
    if (segment.beat <= beat) {
      found = segment
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (!found) return track.rest
  if (beat >= found.end) return found.after
  const t = (beat - found.beat) / (found.end - found.beat)
  return found.from + (found.to - found.from) * found.ease(t)
}

/** Every mod's value at one beat, which is all the effect formulas ever see. */
export class ModState {
  readonly #tracks: Map<string, Track>
  readonly #values = new Map<string, number>()
  readonly #overrides = new Map<string, number>()

  constructor(rows: ModRow[]) {
    this.#tracks = buildTracks(rows)
  }

  update(beat: number): void {
    for (const [name, track] of this.#tracks) this.#values.set(name, read(track, beat))
    for (const [name, value] of this.#overrides) this.#values.set(name, value)
  }

  /** Pins a mod regardless of the chart, in the engine's own units. For inspecting one mod at a time. */
  override(name: string, value: number | undefined): void {
    if (value === undefined) {
      this.#overrides.delete(name)
      this.#values.delete(name)
    } else {
      this.#overrides.set(name, value)
    }
  }

  get(name: string): number {
    return this.#values.get(name) ?? MODS[name]?.rest ?? 0
  }

  /** A mod plus its per-column variant, so `reverse2` adds to `reverse` for column 2 only. */
  column(name: string, column: number): number {
    return this.get(name) + (this.#values.get(`${name}${column}`) ?? 0)
  }
}

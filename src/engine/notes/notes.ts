import type { TimingData } from '../timing/timing.ts'

export type NoteKind = 'tap' | 'hold' | 'roll' | 'mine'

export type Note = {
  beat: number
  column: number
  kind: NoteKind
  /** The note value its row falls on: 4 for a quarter, 8 for an eighth, up to 192. */
  quant: number
  /** Holds and rolls only. */
  endBeat?: number
}

export type Chart = {
  difficulty: string
  meter: number
  notes: Note[]
}

export type NotesFile = {
  timing: TimingData
  charts: Chart[]
}

export type Manifest = {
  title: string
  artist: string
  /** Display only. Timing lives in notes.json. */
  bpm: string
  audio: string
  background?: string
  /** Seconds into the audio the wheel previews from. */
  preview: number
  /** One per chart in notes.json, in the same order. */
  difficulties: { name: string; meter: number }[]
}

const ROWS_PER_BEAT = 48
const QUANTS = [4, 8, 12, 16, 24, 32, 48, 64, 192]

export function quantOf(beat: number): number {
  const row = Math.round(beat * ROWS_PER_BEAT)
  for (const quant of QUANTS) {
    if (row % ((ROWS_PER_BEAT * 4) / quant) === 0) return quant
  }
  return 192
}
